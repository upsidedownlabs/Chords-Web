import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "next-themes";
import * as math from "mathjs";

interface GraphProps
 {
  fftData: number[][];
  samplingRate: number;
}

const Graph
: React.FC<GraphProps
> = ({
  fftData,
  samplingRate,
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
////

const calculateBrainwavePower = (fftData: number[], freqs: number[]) => {
  const sumPower = (minFreq: number, maxFreq: number, divisor: number) => {
    const filtered = fftData.filter((_, index) => freqs[index] >= minFreq && freqs[index] <= maxFreq);
    return Math.sqrt(math.sum(filtered.map(x => x ** 2)) / divisor);
  };

  const deltaPower = sumPower(0.5, 4, 4);
  const thetaPower = sumPower(4, 8, 5);
  const alphaPower = sumPower(8, 13, 6);
  const betaPower = sumPower(13, 30, 18);
  const gammaPower = sumPower(30, 45, 16);

  return { deltaPower, thetaPower, alphaPower, betaPower, gammaPower };
};


  // const calculateBandPower = useCallback(
  //     (fftChannelData: number[]) => {
  //       const freqResolution = samplingRate / (fftChannelData.length * 2);
    
  //       // Compute raw power for each band
  //       const bandPowers = bandRanges.map(([low, high]) => {
  //         const startIndex = Math.max(1, Math.floor(low / freqResolution));
  //         const endIndex = Math.min(
  //           Math.ceil(high / freqResolution),
  //           fftChannelData.length - 1
  //         );
    
  //         let bandPower = 0;
  //         for (let i = startIndex; i <= endIndex; i++) {
  //           if (!isNaN(fftChannelData[i]) && i < fftChannelData.length) {
  //             bandPower += Math.pow(fftChannelData[i], 2); // Use square of magnitude
  //           }
  //         }
    
  //         // Normalize by number of bins
  //         return bandPower / (endIndex - startIndex + 1);
  //       });
    
  //       // Total power across all bands
  //       const totalPower = bandPowers.reduce((sum, power) => sum + power, 0);
    
  //       // Compute normalized power in dB
  //       return bandPowers.map((bandPower, index) => {
  //         if (index === 0) {
  //           return 10; // Fixed value for the first band
  //         } else if (index === 1) {
  //           const alpha = bandPowers[2] || 0;
  //           const beta = bandPowers[3] || 0;
  //           const alphaBetaPower = alpha + beta;
  //           const normalizedPower = totalPower > 0 ? alphaBetaPower / totalPower : 0;
  //           console.log(normalizedPower);
  //           return 10 * Math.log10(normalizedPower);
  //         } else {
  //           return -30; // Rest of the values set to 0
  //         }
  //       });
        
  //     },
  //     [bandRanges, samplingRate]
  //   );
    

  // useEffect(() => {
  //   if (fftData.length > 0 && fftData[0].length > 0) {
  //     const channelData = fftData[0];
  //     const newBandPowerData = calculateBrainwavePower(channelData);
  //     console.log(newBandPowerData);
  //     if (
  //       newBandPowerData.some((value) => !isNaN(value) && value > -Infinity)
  //     ) {
  //       setHasValidData(true);
  //       setBandPowerData(newBandPowerData);
  //     } else if (!hasValidData) {
  //       setBandPowerData(Array(5).fill(-100));
  //     }
  //   }
  // }, [fftData, calculateBandPower, hasValidData]);

  ///
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
            bandPower += Math.pow(fftChannelData[i], 2); // Use square of magnitude
          }
        }

        // Normalize by the number of frequency bins in the band
        const normalizedPower = bandPower / (endIndex - startIndex + 1);

        // Convert to dB
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

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width - 70) / bandNames.length;
      let minPower = Math.min(...currentBandPowerData);
      let maxPower = Math.max(...currentBandPowerData);

      if (maxPower - minPower < 1) {
        maxPower = minPower + 1;
      }

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
    <div ref={containerRef} className="w-full h-[300px] max-w-[700px]">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default Graph;