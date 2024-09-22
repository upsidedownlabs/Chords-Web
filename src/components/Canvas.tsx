import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { SmoothieChart, TimeSeries } from "smoothie";
import { useTheme } from "next-themes";
import { BitSelection } from "./DataPass";

interface CanvasProps {
  data: string;
  selectedBits: BitSelection;
  isDisplay: boolean;
  canvasCount?: number;
}
interface Batch {
  time: number;
  values: number[];
}

const Canvas: React.FC<CanvasProps> = ({
  data,
  selectedBits,
  isDisplay,
  canvasCount = 6, // default value in case not provided
}) => {
  const { theme } = useTheme();
  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(true);
  const batchBuffer = useMemo<Batch[]>(() => [], []);
  const channels = useMemo(() => Array(canvasCount).fill(true), [canvasCount]);

  const getChannelColor = useCallback(
    (index: number) => {
      const colorsDark = [
        "#FF4985",
        "#79E6F3",
        "#00FFC1",
        "#6EC207",
        "#AD49E1",
        "#E85C0D",
      ];
      const colorsLight = [
        "#D10054",
        "#007A8C",
        "#0A6847",
        "#674188",
        "#E65C19",
        "#2E073F",
      ];
      return theme === "dark"
        ? colorsDark[index] || colorsDark[colorsDark.length - 1]
        : colorsLight[index] || colorsLight[colorsLight.length - 1];
    },
    [theme]
  );

  const getThemeColors = useCallback(() => {
    return theme === "dark"
      ? {
          background: "rgba(2, 8, 23)",
          line: "rgba(0, 255, 0, 0.8)",
          text: "#ffffff",
          grid: "#333333",
        }
      : {
          background: "rgba(255, 255, 255)",
          line: "rgba(0, 100, 0, 0.8)",
          text: "#000000",
          grid: "#cccccc",
        };
  }, [theme]);

  const getMaxValue = useCallback((bits: BitSelection): number => {
    switch (bits) {
      case "ten":
        return 1024;
      case "twelve":
        return 4096;
      case "fourteen":
        return 16384;
      default:
        return Infinity;
    }
  }, []);

  const shouldAutoScale = useCallback((bits: BitSelection): boolean => {
    return bits === "auto";
  }, []);

  const resizeCanvas = () => {
    channels.forEach((_, index) => {
      const canvas = document.getElementById(
        `smoothie-chart-${index + 1}`
      ) as HTMLCanvasElement;

      const parentDiv = canvas?.parentElement;
      if (parentDiv) {
        canvas.height = parentDiv.offsetHeight - 2;
        canvas.width = parentDiv.offsetWidth;
      }
    });
  };

  // Update chart options (colors and scaling)
  const updateChartColors = useCallback(() => {
    const colors = getThemeColors();
    chartRef.current.forEach((chart, index) => {
      if (chart) {
        chart.options.grid = {
          ...chart.options.grid,
          fillStyle: colors.background,
          strokeStyle: colors.grid,
        };

        if (chart.options.labels) {
          chart.options.labels.fillStyle = colors.text;
        }

        // Always update max and min values for each channel
        chart.options.maxValue = shouldAutoScale(selectedBits)
          ? undefined
          : getMaxValue(selectedBits);
        chart.options.minValue = 0;

        const series = seriesRef.current[index];
        if (series) {
          chart.removeTimeSeries(series);
          chart.addTimeSeries(series, {
            strokeStyle: getChannelColor(index),
            lineWidth: 1,
          });
        }

        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}`
        ) as HTMLCanvasElement;

        if (canvas) {
          chart.streamTo(canvas, 500);
        }
      }
    });
  }, [
    getThemeColors,
    selectedBits,
    getMaxValue,
    shouldAutoScale,
    getChannelColor,
  ]);

  const processBatch = useCallback(() => {
    if (batchBuffer.length === 0 || isGlobalPaused) return;

    batchBuffer.forEach((batch: Batch) => {
      channels.forEach((_, index) => {
        const series = seriesRef.current[index];
        if (
          series &&
          batch.values[index] !== undefined &&
          !isNaN(batch.values[index])
        ) {
          series.append(batch.time, batch.values[index]);
        }
      });
    });

    batchBuffer.length = 0;
  }, [channels, batchBuffer, isGlobalPaused]);

  // Improve the data update to handle data flow more consistently
  const handleDataUpdate = useCallback(
    (line: string) => {
      if (line.trim() !== "" && isDisplay) {
        const sensorValues = line.split(",").map(Number).slice(0);
        const timestamp = Date.now();
        batchBuffer.push({ time: timestamp, values: sensorValues });

        if (batchBuffer.length >= 5) {
          processBatch(); // Process batches more frequently
        }
      }
    },
    [batchBuffer, isDisplay, processBatch]
  );

  useEffect(() => {
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach(handleDataUpdate);
    }
  }, [data, isChartInitialized, handleDataUpdate]); // Check these dependencies

  useEffect(() => {
    // Initialize charts only when the number of channels (canvasCount) changes
    const initializeCharts = () => {
      const colors = getThemeColors();

      // Clean up existing charts before initializing new ones
      chartRef.current.forEach((chart, index) => {
        if (chart) {
          chart.stop(); // Stop the chart streaming
          const series = seriesRef.current[index];
          if (series) {
            chart.removeTimeSeries(series);
          }
        }
      });

      // Re-initialize all channels
      channels.forEach((_, index) => {
        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}`
        ) as HTMLCanvasElement;
        if (canvas) {
          const chart = new SmoothieChart({
            responsive: true,
            millisPerPixel: 4,
            interpolation: "linear",
            grid: {
              fillStyle: colors.background,
              strokeStyle: colors.grid,
              borderVisible: true,
              millisPerLine: 1000,
              lineWidth: 1,
            },
            labels: {
              fillStyle: colors.text,
            },
            minValue: shouldAutoScale(selectedBits) ? undefined : 0,
            maxValue: shouldAutoScale(selectedBits)
              ? undefined
              : getMaxValue(selectedBits),
          });

          const series = new TimeSeries();
          chartRef.current[index] = chart; // Store the chart
          seriesRef.current[index] = series; // Store the series

          chart.addTimeSeries(series, {
            strokeStyle: getChannelColor(index),
            lineWidth: 1,
          });

          chart.streamTo(canvas, 500); // Stream data to the canvas
        }
      });
      setIsChartInitialized(true);
    };

    initializeCharts(); // Initialize when canvasCount changes
  }, [canvasCount]); // Initialize charts only when canvasCount changes

  // Update chart properties (theme, selectedBits) without reinitializing the charts
  useEffect(() => {
    if (isChartInitialized) {
      updateChartColors(); // Update chart properties (colors, max/min values, etc.)
    }
  }, [theme, selectedBits, isChartInitialized, updateChartColors]);

  useEffect(() => {
    if (isChartInitialized) {
      updateChartColors();
    }
  }, [theme, isChartInitialized, updateChartColors]);

  useEffect(() => {
    setIsGlobalPaused(!isDisplay);

    chartRef.current.forEach((chart) => {
      if (chart) {
        if (isDisplay) {
          chart.start();
        } else {
          chart.stop();
        }
      }
    });
  }, [isDisplay]);

  useEffect(() => {
    resizeCanvas(); // Force resize on channel changes

    const handleResize = () => {
      resizeCanvas();
    };

    // Add resize event listener
    window.addEventListener("resize", handleResize);

    // Cleanup the event listener when component unmounts or when dependencies change
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [canvasCount, channels]); // Dependencies include canvasCount and channels

  useEffect(() => {
    const updateChannels = () => {
      channels.forEach((_, index) => {
        if (chartRef.current[index]) {
          const chart = chartRef.current[index];
          chart.options.maxValue = shouldAutoScale(selectedBits)
            ? undefined
            : getMaxValue(selectedBits);
          chart.options.minValue = 0;

          const series = seriesRef.current[index];
          if (series) {
            chart.removeTimeSeries(series);
            chart.addTimeSeries(series, {
              strokeStyle: getChannelColor(index),
              lineWidth: 1,
            });
          }
        }
      });
    };

    updateChannels();
  }, [canvasCount, selectedBits]);

  const getHeightClass = (count: number) => {
    switch (count) {
      case 1:
        return "h-[70vh]"; // Full height of the container for one canvas
      case 2:
        return "h-[35vh]"; // 50% of the container height for two canvases
      case 3:
        return "h-[23.33vh]"; // Approximately 1/3rd for three canvases
      case 4:
        return "h-[17.5vh]"; // Approximately 1/4th for four canvases
      case 5:
        return "h-[14vh]"; // For five canvases, slightly smaller
      case 6:
        return "h-[11.67vh]"; // 1/6th of the container
      default:
        return "h-[70vh]"; // Default for a single canvas
    }
  };

  return (
    <div className="flex justify-center items-center h-[85vh] mx-4">
      {/* Canvas container taking 70% of the screen height */}
      <div className="flex flex-col justify-center items-start w-full px-4">
        <div className="grid w-full h-full relative">
          {channels.map((_, index) => (
            <div
              key={index}
              className={`border border-secondary-foreground w-full ${getHeightClass(
                channels.length
              )} relative bg-white dark:bg-gray-900`}
            >
              <canvas
                id={`smoothie-chart-${index + 1}`}
                className="w-full h-full m-0 p-0"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Canvas;
