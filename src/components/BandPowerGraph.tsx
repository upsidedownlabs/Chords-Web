import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "next-themes";

interface GraphProps {
  fftData: number[][];
  samplingRate: number;
  className?: string;
  onBetaUpdate?: (betaValue: number) => void; // New prop

}

const Graph: React.FC<GraphProps> = ({
  fftData,
  samplingRate,
  className = "",
  onBetaUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bandPowerData, setBandPowerData] = useState<number[]>(
    Array(5).fill(-100)
  );
  const prevBandPowerData = useRef<number[]>(Array(5).fill(0));
  const animationRef = useRef<number>();
  const { theme } = useTheme();

  // Specific color strings for canvas drawing
  const bandColors = useMemo(
    () => [
      "#EF4444", // Tailwind red-500
      "#EAB308", // Tailwind yellow-500
      "#22C55E", // Tailwind green-500
      "#3B82F6", // Tailwind blue-500
      "#8B5CF6"  // Tailwind purple-500
    ],
    []
  );

  const bandNames = useMemo(
    () => ["Delta", "Theta", "Alpha", "Beta", "Gamma"],
    []
  );

  const DELTA_RANGE = [0.5, 4],
    THETA_RANGE = [4, 8],
    ALPHA_RANGE = [8, 12],
    BETA_RANGE = [12, 30],
    GAMMA_RANGE = [30, 100];

  const FREQ_RESOLUTION = samplingRate / 256;

  const calculateBandPower = useCallback(
    (fftMagnitudes: number[], freqRange: number[]) => {
      const [startFreq, endFreq] = freqRange;
      const startIndex = Math.max(1, Math.floor(startFreq / FREQ_RESOLUTION));
      const endIndex = Math.min(Math.floor(endFreq / FREQ_RESOLUTION), fftMagnitudes.length - 1);
      let power = 0;
      for (let i = startIndex; i <= endIndex; i++) {
        power += fftMagnitudes[i] * fftMagnitudes[i];
      }
      return power;
    },
    [FREQ_RESOLUTION]
  );
  
  useEffect(() => {
    if (fftData.length > 0 && fftData[0].length > 0) {
      const channelData = fftData[0];
  
      const deltaPower = calculateBandPower(channelData, DELTA_RANGE);
      const thetaPower = calculateBandPower(channelData, THETA_RANGE);
      const alphaPower = calculateBandPower(channelData, ALPHA_RANGE);
      const betaPower = calculateBandPower(channelData, BETA_RANGE);
      const gammaPower = calculateBandPower(channelData, GAMMA_RANGE);
      const total = deltaPower + thetaPower + alphaPower + betaPower + gammaPower;
  
      const newBandPowerData = [
        (deltaPower / total) * 100,
        (thetaPower / total) * 100,
        (alphaPower / total) * 100,
        (betaPower / total) * 100,
        (gammaPower / total) * 100,
      ];
  
      if (
        newBandPowerData.some((value) => !isNaN(value) && value > -Infinity)
      ) {
        setBandPowerData((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(newBandPowerData)) {
            return newBandPowerData;
          }
          return prev;
        });
  
        if (onBetaUpdate) {
          onBetaUpdate(newBandPowerData[3]);
        }
      } 
    }
  }, [fftData, calculateBandPower, onBetaUpdate && onBetaUpdate.toString()]); // Memoized dependencies
  

  const drawGraph = useCallback(
    (currentBandPowerData: number[]) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      if (currentBandPowerData.some(isNaN)) {
        console.error("NaN values detected in band power data");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Responsive canvas sizing
      const containerWidth = container.clientWidth;
      const containerHeight = Math.min(containerWidth * 0.5, 400); // Limit max height
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Responsive bar sizing and margins
      const leftMargin = width < 640 ? 40 : 70; // Smaller margin on mobile
      const rightMargin = 20;
      const bottomMargin = width < 640 ? 40 : 50; // Smaller margin on mobile
      const barWidth = (width - leftMargin - rightMargin) / bandNames.length;
      const barSpacing = barWidth * 0.2; // Space between bars

      let minPower = 0;
      let maxPower = 100;

      if (maxPower - minPower < 1) {
        maxPower = minPower + 1;
      }

      const axisColor = theme === "dark" ? "white" : "black";

      // Draw axes
      ctx.beginPath();
      ctx.moveTo(leftMargin, 10);
      ctx.lineTo(leftMargin, height - bottomMargin);
      ctx.lineTo(width - rightMargin, height - bottomMargin);
      ctx.strokeStyle = axisColor;
      ctx.stroke();

      // Draw bars
      currentBandPowerData.forEach((power, index) => {
        const x = leftMargin + index * barWidth;
        const normalizedHeight = Math.max(0, (power - minPower) / (maxPower - minPower)); 
        const barHeight = Math.max(0,normalizedHeight * (height - bottomMargin - 10));
        
        ctx.fillStyle = bandColors[index];
        ctx.fillRect(x + barSpacing / 2, height - bottomMargin - barHeight, barWidth - barSpacing, barHeight);
      });

      // Draw labels
      ctx.fillStyle = axisColor;
      const fontSize = width < 640 ? 10 : 12; // Smaller text on mobile
      ctx.font = `${fontSize}px Arial`;

      // Y-axis labels (log scale)
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yLabelCount = Math.min(5, Math.floor(height / 50)); // Fewer labels on small screens
      for (let i = 0; i <= yLabelCount; i++) {
        const value = minPower + (maxPower - minPower) * (i / yLabelCount);
        const labelY = height - bottomMargin - (i / yLabelCount) * (height - bottomMargin - 10);
        ctx.fillText(value.toFixed(1), leftMargin - 5, labelY);
      }

      // X-axis labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      bandNames.forEach((band, index) => {
        const labelX = leftMargin + index * barWidth + barWidth * 0.5;
        ctx.fillText(band, labelX, height - bottomMargin + 5);
      });

      // Title
      ctx.font = `${Math.min(fontSize + 2, 14)}px Arial`;
      ctx.fillText("EEG Band Power", width / 2, height - 20);

      // Rotate and position the y-axis label
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Power", -height / 2 + 15, fontSize);
      ctx.restore();
    },
    [theme, bandColors, bandNames]
  );

  // Rest of the component remains the same (animateGraph, useEffect hooks)
  const animateGraph = useCallback(() => {
    const interpolationFactor = 0.1;
    const currentValues = bandPowerData.map((target, i) => {
      const prev = prevBandPowerData.current[i];
      return prev + (target - prev) * interpolationFactor;
    });

    drawGraph(currentValues);
    prevBandPowerData.current = currentValues;

    animationRef.current = requestAnimationFrame(animateGraph);
  }, [bandPowerData, drawGraph]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animateGraph);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animateGraph]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animateGraph);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [animateGraph]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-0 min-w-0`}
    >
        <canvas
          ref={canvasRef}
          className="w-full h-full dark:bg-highlight rounded-md"
        />
    </div>
  );
};

export default Graph;