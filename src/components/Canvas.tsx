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
import FFTCanvas from "./FFTCanvas";
import { useTheme } from "next-themes";
import { Card, CardContent } from "./ui/card";
import { BitSelection } from "./DataPass";

interface CanvasProps {
  data: string;
  selectedBits: BitSelection;
}

const Canvas: React.FC<CanvasProps> = ({ data, selectedBits }) => {
  const { theme } = useTheme();

  const channels = useMemo(() => [true, true, true, true, false, false], []);

  const [isPaused, setIsPaused] = useState(Array(channels.length).fill(false));

  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);

  const getChannelColor = useCallback((index: number) => {
    const colors = ["red", "green", "blue", "purple"];
    return colors[index] || colors[colors.length - 1];
  }, []);

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

  const handleDataUpdate = useCallback(
    (line: string) => {
      if (line.trim() !== "") {
        const sensorValues = line.split(",").map(Number).slice(1);
        channels.forEach((channel, index) => {
          if (channel && !isPaused[index]) {
            const canvas = document.getElementById(
              `smoothie-chart-${index + 1}`
            );
            if (canvas) {
              const data = sensorValues[index];
              if (!isNaN(data)) {
                const series = seriesRef.current[index];
                series?.append(Date.now(), data);
              }
            }
          }
        });
      }
    },
    [channels, isPaused]
  );

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
              millisPerPixel: 12,
              interpolation: "bezier",
              // limitFPS: 30, // Limit the frame rate for performance
              grid: {
                fillStyle: colors.background,
                strokeStyle: colors.grid,
                borderVisible: true,
                millisPerLine: 250,
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
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      lines.forEach((line) => {
        handleDataUpdate(line);
      });
    }
  }, [data, isChartInitialized, handleDataUpdate, theme]);

  useEffect(() => {
    if (isChartInitialized) {
      updateChartColors();
    }
  }, [theme, isChartInitialized, updateChartColors]);

  const handlePauseClick = (index: number) => {
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
    <div className="flex justify-center items-center flex-row h-[85%] w-screen px-4 gap-10">
      <div className="flex justify-center items-center flex-col h-[85%] w-3/4">
        {channels.map((channel, index) => {
          if (channel) {
            return (
              <div key={index} className="flex flex-col w-full mb-1 relative">
                <div className="border border-secondary-foreground h-28 w-full">
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
      <div className="flex justify-center items-center w-1/3">
        <FFTCanvas data={data} maxFreq={100} />
      </div>
    </div>
  );
};

export default Canvas;
