"use client";
import { Pause, Play } from "lucide-react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { SmoothieChart, TimeSeries } from "smoothie";
import { Button } from "./ui/button";

const Canvas = ({ data }: { data: string }) => {
  const channels = useMemo(() => [true, true, true, true, false, false], []);

  const [isPaused, setIsPaused] = useState(Array(channels.length).fill(false));

  const chartRef = useRef<SmoothieChart[]>([]);
  const seriesRef = useRef<(TimeSeries | null)[]>([]);
  const [isChartInitialized, setIsChartInitialized] = useState(false);

  useEffect(() => {
    if (!isChartInitialized) {
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
              millisPerPixel: 10,
              interpolation: "bezier",
              grid: {
                borderVisible: true,
                millisPerLine: 250,
                lineWidth: 1,
                fillStyle: "rgba(2, 8, 23)",
              },
              title: {
                text: `Channel ${index + 1}`,
                fontSize: 16,
                fillStyle: "#ffffff",
                verticalAlign: "bottom",
              },
            });
            const series = new TimeSeries();

            chart.addTimeSeries(series, {
              strokeStyle: "rgba(0, 255, 0, 0.8)",
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
  }, [isChartInitialized, channels]);

  useEffect(() => {
    if (isChartInitialized) {
      const lines = String(data).split("\n");
      for (const line of lines) {
        if (line.trim() !== "") {
          const sensorValues = line.split(",").map(Number).slice(2);
          channels.forEach((channel, index) => {
            if (channel) {
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
      }
    }
  }, [data, isChartInitialized, channels]);

  const handlePauseClick = (index: number) => {
    setIsPaused((prevIsPaused) => {
      const updatedIsPaused = [...prevIsPaused];
      updatedIsPaused[index] = !prevIsPaused[index];

      if (updatedIsPaused[index]) {
        chartRef.current[index].stop();
      } else {
        chartRef.current[index]?.start();
      }
      return updatedIsPaused;
    });
  };

  return (
    <div className="flex justify-center items-center flex-col h-[85%] w-screen">
      {channels.map((channel, index) => {
        if (channel) {
          return (
            <div key={index} className="flex flex-row gap-5 max-w-7xl w-full">
              <div className="border border-secondary-foreground mb-4 h-28 w-full">
                <canvas id={`smoothie-chart-${index + 1}`} />
              </div>
              <div className="flex items-center mb-2">
                <Button
                  variant={"outline"}
                  className=" border-primary"
                  onClick={() => handlePauseClick(index)}
                  size={"sm"}
                >
                  {isPaused[index] ? <Play size={16} /> : <Pause size={16} />}
                </Button>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

export default Canvas;
