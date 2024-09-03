"use client";
import { Pause, Play, Grid, List } from "lucide-react";
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
  isDisplay: boolean; // New prop for play/pause functionality
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
  const [isPaused, setIsPaused] = useState(Array(channels.length).fill(false)); // Paused state for each channe
  const [isGlobalPaused, setIsGlobalPaused] = useState(!isDisplay);
  const batchSize = 10;
  const batchBuffer = useMemo<Array<{ time: number; values: number[] }>>(
    () => [],
    []
  );

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

    batchBuffer.forEach((batch) => {
      channels.forEach((channel, index) => {
        if (channel && !isPaused[index]) {
          const series = seriesRef.current[index];
          if (series && !isNaN(batch.values[index])) {
            series.append(batch.time, batch.values[index]);
          }
        }
      });
    });

    batchBuffer.length = 0;
  }, [channels, batchBuffer, isGlobalPaused, isPaused]);

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
  // console.log(data);
  useEffect(() => {
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach(handleDataUpdate);
    }
  }, [data, isChartInitialized, handleDataUpdate]);

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

          const parentDiv = canvas.parentElement;
          if (parentDiv) {
            canvas.height = parentDiv.offsetHeight - 2;
            canvas.width = parentDiv.offsetWidth;
          }

          if (canvas) {
            const chart = new SmoothieChart({
              responsive: true,
              millisPerPixel: 10,
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

            chart.addTimeSeries(series, {
              strokeStyle: getChannelColor(index),
              lineWidth: 1,
            });

            chart.streamTo(canvas, 500);

            if (chartRef.current && seriesRef.current) {
              chartRef.current[index] = chart;
              seriesRef.current[index] = series;
            }
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
    <div className="flex flex-col justify-center items-start px-4 m-4 h-[80vh]">
      <div
        className={`grid ${
          isGridView
            ? "md:grid-cols-2 grid-cols-1" // Apply the same spacing for both horizontal and vertical gaps
            : "grid-cols-1"
        } w-full h-full`}
      >
        {channels.map((channel, index) => {
          if (channel) {
            return (
              <div
                key={index}
                className={`flex flex-col w-full relative h-full${
                  isGridView ? "" : ""
                }`}
              >
                <div
                  className={`border border-secondary-foreground w-full ${
                    isGridView ? "h-[40vh]" : "h-[20vh]"
                  } relative`}
                >
                  <canvas
                    id={`smoothie-chart-${index + 1}`}
                    className="w-full h-full"
                  />
                </div>
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
