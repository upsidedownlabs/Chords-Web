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

interface CanvasProps {
  data: string;
  selectedBits: BitSelection;
  isGridView: boolean;
  isDisplay: boolean;
}

const Canvas: React.FC<CanvasProps> = ({
  data,
  selectedBits,
  isGridView,
  isDisplay,
}) => {
  const { theme } = useTheme();
  const channels = useMemo(() => [true, true, true, true], []);
  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(true);
  const batchSize = 10;
  const batchBuffer = useMemo<Array<{ time: number; values: number[] }>>(
    () => [],
    []
  );

  const gridRef = useRef<HTMLDivElement>(null);

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
    // Get the current theme colors
    const colors = getThemeColors();

    // Iterate through each chart in the chartRef array
    chartRef.current.forEach((chart, index) => {
      if (chart) {
        // Update grid colors based on the theme
        chart.options.grid = {
          ...chart.options.grid,
          fillStyle: colors.background,
          strokeStyle: colors.grid,
        };

        // Update label and title colors based on the theme
        if (chart.options.labels && chart.options.title) {
          chart.options.labels.fillStyle = colors.text;
          chart.options.title.fillStyle = colors.text;
        }

        // Set scaling options for the chart
        if (shouldAutoScale(selectedBits)) {
          chart.options.maxValue = undefined;
          chart.options.minValue = undefined;
        } else {
          chart.options.maxValue = getMaxValue(selectedBits);
          chart.options.minValue = 0;
        }

        // Update the series with new color settings
        const series = seriesRef.current[index];
        if (series) {
          chart.removeTimeSeries(series);
          chart.addTimeSeries(series, {
            strokeStyle: getChannelColor(index),
            lineWidth: 1,
          });
        }

        // Stream chart data to the corresponding canvas element
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
    // Exit early if the batch buffer is empty or if global pause is active
    if (batchBuffer.length === 0 || isGlobalPaused) return;

    // Process each batch in the buffer
    batchBuffer.forEach((batch) => {
      // Iterate through each channel
      channels.forEach((channel, index) => {
        if (channel) {
          // Retrieve the corresponding series for the channel
          const series = seriesRef.current[index];
          if (series && !isNaN(batch.values[index])) {
            // Append the data point to the series if the value is valid
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
        const sensorValues = line.split(",").map(Number).slice(0);
        const timestamp = Date.now();

        batchBuffer.push({ time: timestamp, values: sensorValues });

        if (batchBuffer.length >= batchSize) {
          processBatch();
        }
      }
    },
    [processBatch, batchBuffer, isDisplay]
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
    // Check if the chart has not been initialized yet
    if (!isChartInitialized) {
      // Get the current theme colors for the chart
      const colors = getThemeColors();

      // Iterate over each channel to set up a chart
      channels.forEach((channel, index) => {
        if (channel) {
          // Get the canvas element for the current channel
          const canvas = document.getElementById(
            `smoothie-chart-${index + 1}`
          ) as HTMLCanvasElement;

          // Adjust canvas dimensions based on its parent element
          const parentDiv = canvas.parentElement;
          if (parentDiv) {
            canvas.height = parentDiv.offsetHeight - 2; // Subtracting 2 for margin/padding
            canvas.width = parentDiv.offsetWidth;
          }

          if (canvas) {
            // Create a new SmoothieChart instance with the current theme settings
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

            // Create a new TimeSeries instance for this chart
            const series = new TimeSeries();

            // Add the TimeSeries to the chart with specific styles
            chart.addTimeSeries(series, {
              strokeStyle: getChannelColor(index),
              lineWidth: 1,
            });

            // Start streaming data to the canvas with a specified update interval
            chart.streamTo(canvas, 500);

            // Store references to the chart and series for later use
            if (chartRef.current && seriesRef.current) {
              chartRef.current[index] = chart;
              seriesRef.current[index] = series;
            }
          }
        }
      });

      // Mark the chart as initialized
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

  return (
    <div className="flex flex-col justify-center items-start px-4 m-2 sm:m-4 md:m-4 lg:m-4 h-[60vh] sm:h-[70vh] md:h-[80vh]">
      <div
        ref={gridRef}
        className={`grid ${
          isGridView ? "md:grid-cols-2 grid-cols-1" : "grid-cols-1"
        } w-full h-full relative`}
        style={{
          backgroundColor:
            theme === "dark" ? "hsl(222.2, 84%, 4.9%)" : "hsl(0, 0%, 100%)",
          color:
            theme === "dark" ? "hsl(210, 40%, 98%)" : "hsl(222.2, 84%, 4.9%)",
        }}
      >
        {channels.map((channel, index) => {
          if (channel) {
            return (
              <div
                key={index}
                className={`border border-secondary-foreground w-full ${
                  isGridView
                    ? "h-[25vh] sm:h-[30vh] md:h-[35vh] lg:h-[40vh]"
                    : "h-[10vh] sm:h-[15vh] md:h-[20vh] lg:h-[20vh]"
                } relative`}
              >
                <canvas
                  id={`smoothie-chart-${index + 1}`}
                  className="w-full h-full"
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default Canvas;
