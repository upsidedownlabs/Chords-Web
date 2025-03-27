import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

interface GraphProps {
  fftData: number[][];
  samplingRate: number;
  className?: string;
}

const Graph: React.FC<GraphProps> = ({
  fftData,
  samplingRate,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bandPowerData, setBandPowerData] = useState<number[]>(
    Array(5).fill(-100)
  );
  const prevBandPowerData = useRef<number[]>(Array(5).fill(0));
  const animationRef = useRef<number>();
  const { theme } = useTheme();
  const [hasValidData, setHasValidData] = useState(false);

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

  const bandRanges = useMemo(
    () => [
      [0.5, 4],
      [4, 8],
      [8, 13],
      [13, 32],
      [32, 100],
    ],
    []
  );

  // Existing calculateBandPower method remains the same
  const calculateBandPower = useCallback(
    (fftChannelData: number[]) => {
      const freqResolution = samplingRate / (fftChannelData.length * 2);

      return bandRanges.map(([low, high]) => {
        const startIndex = Math.max(1, Math.floor(low / freqResolution));
        const endIndex = Math.min(
          Math.ceil(high / freqResolution),
          fftChannelData.length - 1
        );

        let bandPower = 0;
        for (let i = startIndex; i <= endIndex; i++) {
          if (!isNaN(fftChannelData[i]) && i < fftChannelData.length) {
            bandPower += Math.pow(fftChannelData[i], 2);
          }
        }

        const normalizedPower = bandPower / (endIndex - startIndex + 1);
        const powerDB = 10 * Math.log10(normalizedPower);

        return powerDB;
      });
    },
    [bandRanges, samplingRate]
  );

  useEffect(() => {
    if (fftData.length > 0 && fftData[0].length > 0) {
      const channelData = fftData[0];
      const newBandPowerData = calculateBandPower(channelData);

      if (
        newBandPowerData.some((value) => !isNaN(value) && value > -Infinity)
      ) {
        setHasValidData(true);
        setBandPowerData(newBandPowerData);
      } else if (!hasValidData) {
        setBandPowerData(Array(5).fill(-100));
      }
    }
  }, [fftData, calculateBandPower, hasValidData]);

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

      let minPower = Math.min(...currentBandPowerData);
      let maxPower = Math.max(...currentBandPowerData);

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
        const normalizedHeight = (power - minPower) / (maxPower - minPower);
        const barHeight = normalizedHeight * (height - bottomMargin - 10);
        ctx.fillStyle = bandColors[index];
        ctx.fillRect(x + barSpacing/2, height - bottomMargin - barHeight, barWidth - barSpacing, barHeight);
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
        ctx.fillText(value.toFixed(1) + " dB", leftMargin - 5, labelY);
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
      ctx.fillText("EEG Band Power", width / 2, height - 10);

      // Rotate and position the y-axis label
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Power — dB", -height / 2 + 15, fontSize);
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
      className={`w-full h-full flex justify-center items-center ${className}`}
    >
      <div className="w-full h-full max-w-4xl ">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full dark:bg-highlight rounded-md"
        />
      </div>
    </div>
  );
};

export default Graph;