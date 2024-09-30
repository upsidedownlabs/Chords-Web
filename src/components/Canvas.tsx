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

  // Function to resize canvases based on their parent elements
  const resizeCanvas = () => {
    channels.forEach((_, index) => {
      // Loop through each channel and its corresponding index
      const canvas = document.getElementById(
        `smoothie-chart-${index + 1}` // Get the canvas element for the current channel
      ) as HTMLCanvasElement;

      const parentDiv = canvas?.parentElement; // Get the parent element of the canvas
      if (parentDiv) {
        // If the parent element exists
        canvas.height = parentDiv.offsetHeight - 2; // Set the canvas height to the parent’s height minus 2 pixels
        canvas.width = parentDiv.offsetWidth; // Set the canvas width to the parent’s width
      }
    });
  };

  // Callback function to update chart colors and options based on the current theme and settings
  const updateChartColors = useCallback(() => {
    const colors = getThemeColors(); // Retrieve the current theme colors
    chartRef.current.forEach((chart, index) => {
      // Loop through each chart and its corresponding index
      if (chart) {
        // Check if the chart instance exists
        chart.options.grid = {
          // Update grid options for the chart
          ...chart.options.grid, // Preserve existing grid options
          fillStyle: colors.background, // Set the grid background color
          strokeStyle: colors.grid, // Set the grid stroke color
        };

        if (chart.options.labels) {
          // Check if labels are defined in the chart options
          chart.options.labels.fillStyle = colors.text; // Set the label text color
        }

        // Set scaling options for the chart based on selectedBits
        if (shouldAutoScale(selectedBits)) {
          // If auto-scaling is enabled
          chart.options.maxValue = undefined; // Remove max value limit
          chart.options.minValue = undefined; // Remove min value limit
        } else {
          // If auto-scaling is not enabled
          chart.options.maxValue = getMaxValue(selectedBits); // Set max value based on selectedBits
          chart.options.minValue = shouldAutoScale(selectedBits)
            ? undefined // Set min value to undefined if auto-scaling is enabled
            : 0; // Set min value to 0 otherwise
        }

        const series = seriesRef.current[index]; // Get the corresponding time series for the chart
        if (series) {
          // Check if the series instance exists
          chart.removeTimeSeries(series); // Remove the existing time series from the chart
          chart.addTimeSeries(series, {
            // Add the time series back with updated styling
            strokeStyle: getChannelColor(index), // Set the stroke color based on the channel index
            lineWidth: 1, // Set the line width
          });
        }

        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}` // Get the canvas element for the current chart
        ) as HTMLCanvasElement;

        if (canvas) {
          // Check if the canvas element exists
          chart.streamTo(canvas, 500); // Start streaming chart data to the canvas with a 500 ms interval
        }
      }
    });
  }, [
    getThemeColors, // Dependency: function to get theme colors
    selectedBits, // Dependency: currently selected bits for scaling
    getMaxValue, // Dependency: function to get the maximum value
    shouldAutoScale, // Dependency: function to check if auto-scaling should be applied
    getChannelColor, // Dependency: function to get the color for a specific channel
  ]);

 // Callback function to process a batch of data and append it to the corresponding time series
const processBatch = useCallback(() => { 
  // Exit early if the batch buffer is empty or the global state is paused
  if (batchBuffer.length === 0 || isGlobalPaused) return;

  // Iterate over each batch in the batch buffer
  batchBuffer.forEach((batch: Batch) => {
    // Iterate over each channel to update the corresponding time series
    channels.forEach((_, index) => {
      const series = seriesRef.current[index]; // Get the time series for the current channel
      if (
        series && // Check if the series exists
        batch.values[index] !== undefined && // Ensure the batch has a value for the current channel
        !isNaN(batch.values[index]) // Check that the value is a valid number
      ) {
        series.append(batch.time, batch.values[index]); // Append the time and value to the series
      }
    });
  });

  // Clear the batch buffer after processing
  batchBuffer.length = 0; 
}, [channels, batchBuffer, isGlobalPaused]); // Dependencies for the useCallback


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
      const colors = getThemeColors(); // Get the current theme colors
  
      // Clean up existing charts before initializing new ones
      chartRef.current.forEach((chart, index) => {
        if (chart) {
          chart.stop(); // Stop the chart streaming to prevent data overlap
          const series = seriesRef.current[index]; // Get the corresponding time series for the chart
          if (series) {
            chart.removeTimeSeries(series); // Remove the existing time series from the chart
          }
        }
      });
  
      // Re-initialize all channels
      channels.forEach((_, index) => {
        // Loop through each channel to create a new chart
        const canvas = document.getElementById(
          `smoothie-chart-${index + 1}` // Get the canvas element for the current channel
        ) as HTMLCanvasElement;
        if (canvas) {
          // Check if the canvas element exists
          const chart = new SmoothieChart({
            // Create a new SmoothieChart instance with the specified options
            responsive: true, // Make the chart responsive to parent container
            millisPerPixel: 4, // Define the time interval in milliseconds per pixel
            interpolation: "bezier", // Set the interpolation style for the chart lines
            limitFPS: 100, // Limit the frames per second for performance
            grid: {
              // Define grid options
              fillStyle: colors.background, // Set the grid background color
              strokeStyle: colors.grid, // Set the grid line color
              borderVisible: true, // Make the grid border visible
              millisPerLine: 1000, // Set the time interval for grid lines
              lineWidth: 1, // Set the grid line width
            },
            labels: {
              // Define label options
              fillStyle: colors.text, // Set the label text color
            },
            minValue: shouldAutoScale(selectedBits) ? undefined : 0, // Set minimum value based on auto-scaling
            maxValue: shouldAutoScale(selectedBits)
              ? undefined
              : getMaxValue(selectedBits), // Set maximum value based on auto-scaling
          });
  
          const series = new TimeSeries(); // Create a new TimeSeries instance
          chartRef.current[index] = chart; // Store the chart in the ref array
          seriesRef.current[index] = series; // Store the series in the ref array
  
          chart.addTimeSeries(series, {
            // Add the time series to the chart with specified styling
            strokeStyle: getChannelColor(index), // Set the stroke color based on the channel index
            lineWidth: 1, // Set the line width
          });
  
          chart.streamTo(canvas, 100); // Stream data to the canvas at 100 ms intervals
        }
      });
      setIsChartInitialized(true); // Update state to indicate charts have been initialized
    };
  
    initializeCharts(); // Call the initialize function when canvasCount changes
  }, [canvasCount]); // Dependency array: re-run the effect only when canvasCount changes
  
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
          chart.options.minValue = shouldAutoScale(selectedBits)
            ? undefined
            : 0;

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
