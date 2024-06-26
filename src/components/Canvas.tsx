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
import throttle from "lodash/throttle";
import FFTCanvas from "./FFTCanvas";
import { useTheme } from "next-themes";

const Canvas = ({ data }: { data: string }) => {
  const { theme } = useTheme();

  const channels = useMemo(() => [true, true, true, true, false, false], []);

  const [isPaused, setIsPaused] = useState(Array(channels.length).fill(false));

  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);

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

        const series = seriesRef.current[index];
        if (series) {
          chart.removeTimeSeries(series);
          chart.addTimeSeries(series, {
            strokeStyle: colors.line,
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
  }, [getThemeColors]);

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

  const throttledHandleDataUpdate = useMemo(
    () => throttle(handleDataUpdate, 100),
    [handleDataUpdate]
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
              title: {
                text: `Channel ${index + 1}`,
                fontSize: 16,
                fillStyle: colors.text,
                verticalAlign: "bottom",
              },
            });
            const series = new TimeSeries();

            chart.addTimeSeries(series, {
              strokeStyle: colors.line,
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
  }, [isChartInitialized, channels, getThemeColors]);

  useEffect(() => {
    if (isChartInitialized) {
      updateChartColors();
      const lines = String(data).split("\n");
      lines.forEach((line) => {
        throttledHandleDataUpdate(line);
      });
    }
  }, [
    data,
    isChartInitialized,
    throttledHandleDataUpdate,
    theme,
    updateChartColors,
  ]);

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
    <div className="flex justify-center items-center flex-row h-[85%] w-screen px-4 gap-4">
      <div className="flex justify-center items-center flex-col h-[85%] w-3/4">
        {channels.map((channel, index) => {
          if (channel) {
            return (
              <div key={index} className="flex flex-col w-full mb-6 relative">
                <div className="border border-secondary-foreground h-28 w-full">
                  <canvas
                    id={`smoothie-chart-${index + 1}`}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute top-0 right-0 -mr-4 -mt-4 z-10">
                  <Button
                    variant={"outline"}
                    className="border-primary rounded-full w-8 h-8 p-0 flex items-center justify-center"
                    onClick={() => handlePauseClick(index)}
                    size={"sm"}
                  >
                    {isPaused[index] ? <Play size={14} /> : <Pause size={14} />}
                  </Button>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
      <div className="w-1/4">
        <FFTCanvas data={data} maxFreq={100} />
      </div>
    </div>
  );
};

export default Canvas;
