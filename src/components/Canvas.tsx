"use client";
import { Pause, Play } from "lucide-react";
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { SmoothieChart, TimeSeries } from "smoothie";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { Card, CardContent } from "./ui/card";
import { BitSelection } from "./DataPass";

interface CanvasProps {
  data: string;
  selectedBits: BitSelection;
}

const Canvas: React.FC<CanvasProps> = ({ data, selectedBits }) => {
  const { theme } = useTheme(); // Get the current theme

  const channels = useMemo(() => [true, true, true, true], []); // Number of channels

  const [isPaused, setIsPaused] = useState(Array(channels.length).fill(false)); // Paused state for each channel

  const chartRef = useRef<SmoothieChart[]>([]); // Reference to the chart
  const seriesRef = useRef<(TimeSeries | null)[]>([]); // Reference to the timeseries
  const [isChartInitialized, setIsChartInitialized] = useState(false); // Chart initialization state

  const batchSize = 10; // Batch size for processing data
  const batchBuffer = useMemo<Array<{ time: number; values: number[] }>>( // Buffer for batch processing
    () => [],
    []
  );

  const getChannelColor = useCallback(
    // Get the color for each channel
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
    // Get the theme colors
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
    // Get the max value for the chart
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
    // Check if the chart should autoscale
    return bits === "auto";
  }, []);

  const updateChartColors = useCallback(() => {
    // Update the chart colors based on the theme
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

        // Restream the chart to apply changes
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
    // Process the batch data
    if (batchBuffer.length === 0) return;

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
  }, [channels, isPaused, batchBuffer]);

  const handleDataUpdate = useCallback(
    // Create batch data from the incoming data with timestamp
    (line: string) => {
      if (line.trim() !== "") {
        const sensorValues = line.split(",").map(Number).slice(1);
        const timestamp = Date.now();

        batchBuffer.push({ time: timestamp, values: sensorValues });

        if (batchBuffer.length >= batchSize) {
          processBatch();
        }
      }
    },
    [processBatch, batchBuffer]
  );

  useEffect(() => {
    // Update the chart with the incoming data
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach(handleDataUpdate);
    }
  }, [data, isChartInitialized, handleDataUpdate]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (batchBuffer.length > 0) {
        processBatch();
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
      processBatch(); // Process any remaining data
    };
  }, [processBatch, batchBuffer]);

  useEffect(() => {
    // Initialize the chart
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
              // Create a new chart instance for each channel
              responsive: true,
              millisPerPixel: 8,
              interpolation: "bezier",
              timestampFormatter: SmoothieChart.timeFormatter,
              grid: {
                fillStyle: colors.background,
                strokeStyle: colors.grid,
                borderVisible: true,
                millisPerLine: 2000,
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

            chart.streamTo(canvas, 500); // Stream the chart to the canvas with a delay of 500ms

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
      // Update the chart with the selected bits and autoscale
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
    if (isChartInitialized) {
      // Update the chart colors based on the theme when the chart is initialized
      updateChartColors();
    }
  }, [theme, isChartInitialized, updateChartColors]);

  const handlePauseClick = (index: number) => {
    // Handle the pause click for each channel
    setIsPaused((prevIsPaused) => {
      const updatedIsPaused = [...prevIsPaused];
      updatedIsPaused[index] = !prevIsPaused[index];

      if (updatedIsPaused[index]) {
        chartRef.current[index].stop();
      } else {
        chartRef.current[index].start();
      }
      return updatedIsPaused;
    });
  };

  return (
    <div className="flex justify-center items-center flex-row md:h-[85%] h-[80%] w-screen px-4 gap-10">
      <div className="flex justify-center items-center flex-col h-[85%] w-[95%]">
        {channels.map((channel, index) => {
          if (channel) {
            return (
              <div key={index} className="flex flex-col w-full mb-1 relative">
                <div className="border border-secondary-foreground md:h-36 h-28 w-full">
                  <canvas
                    id={`smoothie-chart-${index + 1}`}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute top-1/2 right-0 -mr-5 -mt-7 z-10">
                  <Card className="bg-secondary border-primary rounded-2xl">
                    <CardContent className="flex flex-col p-1 items-center justify-center gap-2">
                      <Button
                        variant={"outline"}
                        className="border-muted-foreground hover:bg-destructive w-7 h-7 p-0 rounded-full"
                        onClick={() => handlePauseClick(index)}
                        size={"sm"}
                      >
                        {isPaused[index] ? (
                          <Play size={14} />
                        ) : (
                          <Pause size={14} />
                        )}
                      </Button>
                      <p className="text-[10px]">{`CH${index + 1}`}</p>
                    </CardContent>
                  </Card>
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
