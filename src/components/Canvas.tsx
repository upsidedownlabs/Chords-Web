"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { SmoothieChart, TimeSeries } from "smoothie";
import { useTheme } from "next-themes";
import { BitSelection } from "./DataPass";
import html2canvas from "html2canvas";

interface CanvasProps {
  data: string;
  selectedBits: BitSelection;
  isGridView: boolean;
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
  isGridView,
  isDisplay,
  canvasCount = 6, // default value in case not provided
}) => {
  const { theme } = useTheme();
  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const batchBuffer = useMemo<Batch[]>(() => [], []);

  const batchSize = 10;
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

  const updateChartColors = useCallback(() => {
    const colors = getThemeColors();
    chartRef.current.forEach((chart, index) => {
      if (chart) {
        chart.options.grid = {
          ...chart.options.grid,
          fillStyle: colors.background,
          strokeStyle: colors.grid,
        };

        if (chart.options.labels && chart.options.title) {
          chart.options.labels.fillStyle = colors.text;
          chart.options.title.fillStyle = colors.text;
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

        chart.streamTo(
          document.getElementById(
            `smoothie-chart-${index + 1}`
          ) as HTMLCanvasElement,
          500
        );
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
      channels.forEach((channel, index) => {
        if (channel) {
          const series = seriesRef.current[index];
          if (series && !isNaN(batch.values[index])) {
            series.append(batch.time, batch.values[index]);
          }
        }
      });
    });

    // Clear the batch buffer after processing
    batchBuffer.length = 0;
  }, [channels, batchBuffer, isGlobalPaused]);

  const handleDataUpdate = useCallback(
    (line: string) => {
      if (line.trim() !== "" && isDisplay) {
        // Split the incoming line of data by commas and convert them to numbers
        const sensorValues = line.split(",").map(Number).slice(0);
        const timestamp = Date.now();

        // Add the data to each series, making sure each channel gets its corresponding value
        channels.forEach((channel, index) => {
          if (channel && sensorValues[index] !== undefined) {
            const series = seriesRef.current[index];
            if (series && !isNaN(sensorValues[index])) {
              series.append(timestamp, sensorValues[index]);
            }
          }
        });
      }
    },
    [channels, isDisplay]
  );

  useEffect(() => {
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach(handleDataUpdate);
    }
  }, [data, isChartInitialized, handleDataUpdate]);

  // Updated to ensure colors are correctly applied when the theme changes
  useEffect(() => {
    if (isChartInitialized) {
      updateChartColors(); // Apply the updated theme colors to the chart
    }
  }, [theme, isChartInitialized, updateChartColors]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (batchBuffer.length > 0 && isDisplay) {
        processBatch();
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
      processBatch();
    };
  }, [processBatch, batchBuffer, isDisplay]);

  useEffect(() => {
    if (!isChartInitialized) {
      const colors = getThemeColors();
      channels.forEach((channel, index) => {
        if (channel) {
          const canvas = document.getElementById(
            `smoothie-chart-${index + 1}`
          ) as HTMLCanvasElement;

          const parentDiv = canvas?.parentElement;
          if (parentDiv) {
            canvas.height = parentDiv.offsetHeight - 2;
            canvas.width = parentDiv.offsetWidth;
          }

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

            // Add time series to the chart
            chart.addTimeSeries(series, {
              strokeStyle: getChannelColor(index),
              lineWidth: 1,
            });

            // Start streaming the chart to the canvas
            chart.streamTo(canvas, 500);

            // Store chart and series references
            chartRef.current[index] = chart;
            seriesRef.current[index] = series;
          }
        }
      });

      setIsChartInitialized(true);
    }
  }, [
    isChartInitialized,
    channels,
    getThemeColors,
    selectedBits,
    getMaxValue,
    shouldAutoScale,
    getChannelColor,
  ]);

  useEffect(() => {
    const resizeCanvas = () => {
      channels.forEach((channel, index) => {
        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}`
        ) as HTMLCanvasElement;

        const parentDiv = canvas.parentElement;
        if (parentDiv) {
          canvas.height = parentDiv.offsetHeight - 2;
          canvas.width = parentDiv.offsetWidth;
        }
      });
    };

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [channels]);

  useEffect(() => {
    if (isChartInitialized) {
      chartRef.current.forEach((chart) => {
        if (chart) {
          if (shouldAutoScale(selectedBits)) {
            chart.options.maxValue = undefined;
            chart.options.minValue = undefined;
          } else {
            chart.options.maxValue = getMaxValue(selectedBits);
            chart.options.minValue = 0;
          }
        }
      });
    }
  }, [selectedBits, isChartInitialized, getMaxValue, shouldAutoScale]);

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
    if (isChartInitialized) {
      updateChartColors();
    }
  }, [theme, isChartInitialized, updateChartColors]);

  // const getImageFilters = useCallback(() => {
  //   if (theme === "dark") {
  //     return "brightness(0.8) hue-rotate(180deg) saturate(2) contrast(1.2)";
  //   } else {
  //     return "brightness(1.2) saturate(0.8) contrast(0.9)";
  //   }
  // }, [theme]);

  return (
    <div className="flex flex-col h-full justify-center items-start px-4 m-2 sm:m-4 md:m-6 lg:m-8 h-[60vh] sm:h-[70vh] md:h-[80vh]">
      <div ref={gridRef} className={`grid  w-full h-full relative`}>
        {channels.map((_, index) => (
          <div
            key={index}
            className={`${
              isGridView ? "h-[50%]" : "h-[100%]"
            } relative bg-white dark:bg-gray-900`}
          >
            <canvas
              id={`smoothie-chart-${index + 1}`}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Canvas;
