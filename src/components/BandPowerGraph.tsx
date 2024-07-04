import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "next-themes";

interface BandPowerGraphProps {
  fftData: number[][];
  samplingRate: number;
}

const BandPowerGraph: React.FC<BandPowerGraphProps> = ({
  fftData,
  samplingRate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bandPowerData, setBandPowerData] = useState<number[]>(
    Array(5).fill(0)
  );
  const prevBandPowerData = useRef<number[]>(Array(5).fill(0));
  const animationRef = useRef<number>();
  const { theme } = useTheme();

  const bandColors = useMemo(
    () => ["red", "yellow", "green", "blue", "purple"],
    []
  );
  const bandNames = useMemo(
    () => ["DELTA", "THETA", "ALPHA", "BETA", "GAMMA"],
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

  const calculateBandPower = useCallback(
    (fftChannelData: number[]) => {
      const freqResolution = samplingRate / (fftChannelData.length * 2);
      return bandRanges.map(([low, high]) => {
        const startIndex = Math.max(1, Math.floor(low / freqResolution));
        const endIndex = Math.min(
          Math.ceil(high / freqResolution),
          fftChannelData.length
        );
        if (startIndex >= endIndex) return 0;

        let bandPower = 0;
        for (let i = startIndex; i < endIndex; i++) {
          bandPower += fftChannelData[i] * fftChannelData[i];
        }

        // Normalize by the width of the frequency band
        const bandWidth = high - low;
        const normalizedPower = bandPower / bandWidth;

        // Convert to dB scale
        const powerDB = 10 * Math.log10(normalizedPower);

        return powerDB;
      });
    },
    [bandRanges, samplingRate]
  );

  useEffect(() => {
    if (fftData.length > 0 && fftData[0].length > 0) {
      const channelData = fftData[0]; // Use the first channel
      const newBandPowerData = calculateBandPower(channelData);
      setBandPowerData(newBandPowerData);
    }
  }, [fftData, calculateBandPower]);

  const drawGraph = useCallback(
    (currentBandPowerData: number[]) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width - 70) / bandNames.length;
      const minPower = Math.min(...currentBandPowerData);
      const maxPower = Math.max(...currentBandPowerData);

      const axisColor = theme === "dark" ? "white" : "black";

      // Draw axes
      ctx.beginPath();
      ctx.moveTo(70, 10);
      ctx.lineTo(70, height - 50);
      ctx.lineTo(width - 20, height - 50);
      ctx.strokeStyle = axisColor;
      ctx.stroke();

      // Draw bars
      currentBandPowerData.forEach((power, index) => {
        const x = 70 + index * barWidth; // Adjusted x position
        const normalizedHeight = (power - minPower) / (maxPower - minPower);
        const barHeight = normalizedHeight * (height - 60);
        ctx.fillStyle = bandColors[index];
        ctx.fillRect(x, height - 50 - barHeight, barWidth * 0.8, barHeight);
      });

      // Draw labels
      ctx.fillStyle = axisColor;
      ctx.font = "12px Arial";

      // Y-axis labels (log scale)
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yLabelCount = 5; // Number of labels on y-axis
      for (let i = 0; i <= yLabelCount; i++) {
        const value = minPower + (maxPower - minPower) * (i / yLabelCount);
        const labelY = height - 50 - (i / yLabelCount) * (height - 60);
        ctx.fillText(value.toFixed(1) + " dB", 65, labelY);
      }

      // X-axis labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      bandNames.forEach((band, index) => {
        const labelX = 70 + index * barWidth + barWidth * 0.4;
        ctx.fillText(band, labelX, height - 35);
      });

      ctx.font = "14px Arial";
      ctx.fillText("EEG Power Bands", width / 2, height - 15);

      // Rotate and position the y-axis label
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Power — dB", -height / 2 + 15, 0);
      ctx.restore();
    },
    [theme, bandColors, bandNames]
  );

  const animateGraph = useCallback(() => {
    const currentValues = prevBandPowerData.current.map((prev, i) => {
      const target = bandPowerData[i];
      const diff = target - prev;
      return prev + diff * 0.1; // Adjust this value to control animation speed
    });

    drawGraph(currentValues);
    prevBandPowerData.current = currentValues;

    if (
      currentValues.some((val, i) => Math.abs(val - bandPowerData[i]) > 0.01)
    ) {
      animationRef.current = requestAnimationFrame(animateGraph);
    }
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
    <div ref={containerRef} className="w-full h-[300px] max-w-[700px]">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default BandPowerGraph;
