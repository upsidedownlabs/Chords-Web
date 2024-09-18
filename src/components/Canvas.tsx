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
      const colorsDark = ["#FF4985", "#79E6F3", "#00FFC1", "#ccc"];
      const colorsLight = ["#D10054", "#007A8C", "#008060", "#555555"];
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

        if (shouldAutoScale(selectedBits)) {
          chart.options.maxValue = undefined;
          chart.options.minValue = undefined;
        } else {
          chart.options.maxValue = getMaxValue(selectedBits);
          chart.options.minValue = 0;
        }

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

  const handleDataUpdate = useCallback(
    (line: string) => {
      if (line.trim() !== "" && isDisplay) {
        const sensorValues = line.split(",").map(Number).slice(0);
        const timestamp = Date.now();
        batchBuffer.push({ time: timestamp, values: sensorValues });

        // Process the batch buffer periodically or based on certain conditions
        if (batchBuffer.length >= 10) {
          // Example condition
          processBatch();
        }
      }
    },
    [batchBuffer, isDisplay, processBatch]
  );
  useEffect(() => {
    const intervalId = setInterval(() => {
      processBatch();
    }, 1000); // Adjust the interval as needed

    return () => clearInterval(intervalId);
  }, [processBatch]);

  useEffect(() => {
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach(handleDataUpdate);
    }
  }, [data, isChartInitialized, handleDataUpdate]); // Check these dependencies

  useEffect(() => {
    const initializeCharts = () => {
      const colors = getThemeColors();

      channels.forEach((_, index) => {
        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}`
        ) as HTMLCanvasElement;

        if (canvas) {
          const chart =
            chartRef.current[index] ||
            new SmoothieChart({
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
          const series = seriesRef.current[index] || new TimeSeries();

          if (!chartRef.current[index]) {
            chartRef.current[index] = chart;
            seriesRef.current[index] = series;
          }

          chart.addTimeSeries(series, {
            strokeStyle: getChannelColor(index),
            lineWidth: 1,
          });

          chart.streamTo(canvas, 500);
        }
      });

      setIsChartInitialized(true);
    };

    // Cleanup existing time series and stop the charts
    chartRef.current.forEach((chart, index) => {
      if (chart) {
        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}`
        ) as HTMLCanvasElement;
        const context = canvas?.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    });

    seriesRef.current.forEach((series) => {
      if (series) {
        series.clear();
      }
    });

    initializeCharts();
  }, [
    canvasCount,
    getThemeColors,
    getMaxValue,
    shouldAutoScale,
    getChannelColor,
    channels,
  ]);

  useEffect(() => {
    updateChartColors();
  }, [theme, updateChartColors]);

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
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener("resize", handleResize);
    resizeCanvas(); // Initial resize

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [channels]);

  const getHeightClass = (count: number) => {
    switch (count) {
      case 1:
        return "h-[78vh]";
      case 2:
        return "h-[39vh]";
      case 3:
        return "h-[26vh]";
      case 4:
        return "h-[19vh]";
      case 5:
        return "h-[15vh]";
      case 6:
        return "h-[13vh]";
      default:
        return "h-[78vh]";
    }
  };

  return (
    <div className="flex flex-col h-full justify-center items-start px-4 m-2 sm:m-2 md:m-2 lg:m-2 h-[60vh] sm:h-[70vh] md:h-[75vh]">
      <div className={`grid w-full h-full relative`}>
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
  );
};

export default Canvas;
