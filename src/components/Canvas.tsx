import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle, 
  forwardRef,
} from "react";
import { SmoothieChart, TimeSeries } from "smoothie";
import { useTheme } from "next-themes";
import { BitSelection } from "./DataPass";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";

interface CanvasProps {
  pauseRef: React.RefObject<boolean>;
  selectedBits: BitSelection;
  isDisplay: boolean;
  canvasCount?: number;
  Zoom: number;

}
interface Batch {
  time: number;
  values: number[];
}

const Canvas= forwardRef( ({
  pauseRef,
  selectedBits,
  isDisplay,
  canvasCount = 6, // default value in case not provided
  Zoom,
}:CanvasProps, ref) => {

  let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [numChannels, setNumChannels] = useState<number>(canvasCount);
  const [canvases, setCanvases] = useState<HTMLCanvasElement[]>([]);
  const [wglPlots, setWglPlots] = useState<WebglPlot[]>([]);
  const [lines, setLines] = useState<WebglLine[]>([]);
  const linesRef = useRef<WebglLine[]>([]);
  const fps = 60;
  const samplingRate = 500; // Set the sampling rate in Hz
  const slidePoints = Math.floor(samplingRate / fps); // Set how many points to slide
  let numX: number;
  numX=samplingRate*4;
  // Update singleNumber whenever canvasCount changes
  const canvasbufferRef = useRef<number[][]>([]);
  const [bufferFull, setBufferFull] = useState(false);
  const bufferSize = 5; // Maximum size for each channel buffer
  const channelCount = 7; // Number of channels
  useEffect(() => {
    setNumChannels(canvasCount);
  }, [canvasCount]);


  useImperativeHandle(ref, () => ({
    updateData(data: number[]) {

      
      addToBuffer(data);

      if (previousCounter !== null) {
        // If there was a previous counter value
        const expectedCounter: number = (previousCounter + 1) % 256; // Calculate the expected counter value
        if (data[6] !== expectedCounter) {
          // Check for data loss by comparing the current counter with the expected counter
          console.warn(
            `Data loss detected in canvas! Previous counter: ${previousCounter}, Current counter: ${data[6]}`
          );
        }
      }
      previousCounter =data[6]; // Update the previous counter with the current counter
    }
  }),[Zoom]);

   // Function to add channel data to the buffer
 const addToBuffer = (channelData: number[]) => {
  if (channelData.length !== channelCount) {
    console.error(`Expected ${channelCount} channels, but got ${channelData.length}`);
    return;
  }

  // Add the channel data to the buffer
  canvasbufferRef.current.push(channelData);

  // Check if the buffer is full
  if (canvasbufferRef.current.length === bufferSize) {
    setBufferFull(true);

    // Process the buffer data (e.g., plot or save)
    // console.log("Buffer is full and ready for use:", canvasbufferRef.current);
    const processedData: number[][] = Array.from({ length: 6 }, () => []);

    // Distribute data points from the buffer into their respective channels
    canvasbufferRef.current.forEach((data) => {
      data.slice(0, 6).forEach((value, channelIndex) => {
        processedData[channelIndex].push(value);
      });
    });
    updatePlots(processedData);
    console.log("Processed Data (6x10 array):", processedData);


    // Reset the buffer for reuse
    canvasbufferRef.current = [];
    setBufferFull(false); // Reset the flag after processing
  }
};

  const createCanvases = () => {
    if (!canvasContainerRef.current) return;

    // Clear existing canvases
    canvasContainerRef.current.innerHTML = '';

    const fixedCanvasWidth = canvasContainerRef.current.clientWidth;
    const containerHeight = canvasContainerRef.current.clientHeight || window.innerHeight - 50;
    const canvasHeight = containerHeight / numChannels;

    const newCanvases: HTMLCanvasElement[] = [];
    const newWglPlots: WebglPlot[] = [];
    const newLines: WebglLine[] = [];

    for (let i = 0; i < numChannels; i++) {
      const canvas = document.createElement("canvas");

      canvas.width = fixedCanvasWidth;
      canvas.height = canvasHeight;

      canvas.className = "border border-secondary-foreground w-full";
 
      canvas.style.height = `${canvasHeight}px`;
      canvas.style.border="0.5px solid #ccc";

      canvasContainerRef.current.appendChild(canvas);
      newCanvases.push(canvas);

      const wglp = new WebglPlot(canvas);
      newWglPlots.push(wglp);
      
      const line = new WebglLine(getRandomColor(i), numX);
      line.lineSpaceX(-1, 2 / numX);
      wglp.addLine(line);
      newLines.push(line);

    }
    linesRef.current = newLines;
    setCanvases(newCanvases);
    setWglPlots(newWglPlots);
    setLines(newLines);
  };
 

  const getRandomColor = (i: number): ColorRGBA => {
    // Define bright colors
    const colors: ColorRGBA[] = [
      new ColorRGBA(1, 0.286, 0.529, 1), // Bright Pink
      new ColorRGBA(0.475, 0.894, 0.952, 1), // Light Blue
      new ColorRGBA(0, 1, 0.753, 1), // Bright Cyan
      new ColorRGBA(0.431, 0.761, 0.031, 1), // Bright Green
      new ColorRGBA(0.678, 0.286, 0.882, 1), // Bright Purple
      new ColorRGBA(0.914, 0.361, 0.051, 1)  // Bright Orange
    ];
  
    // Return color based on the index, cycling through if necessary
    return colors[i % colors.length]; // Ensure to always return a valid ColorRGBA
  };

  const updatePlots = useCallback((processedData: number[][]) => {
    wglPlots.forEach((wglp, index) => {
      if (wglp) {
        try {
          wglp.gScaleY = Zoom; // Adjust this value as needed
        } catch (error) {
          console.error(`Error setting gScaleY for WebglPlot instance at index ${index}:`, error);
        }
      } else {
        console.warn(`WebglPlot instance at index ${index} is undefined.`);
      }
    });
  
    linesRef.current.forEach((line, channelIndex) => {
      // Shift existing data points to make room for the 10 new points
      const bitsPoints = Math.pow(2, getValue(selectedBits)); // Adjust this according to your ADC resolution
      const yScale = 2 / bitsPoints;
  
      // The 10 points for this particular channel
      const newPoints = processedData[channelIndex].map(value => (value - bitsPoints / 2) * yScale);
  
      // Shift data points to the left by 10 positions
      for (let j = newPoints.length; j < line.numPoints; j++) {
        line.setY(j - newPoints.length, line.getY(j));
      }
      // for (let i = 1; i < numX; i++) {
      //   line.setY(i - 1, line.getY(i)); // Shift data to the left
      // }
  
  
      // Set the last 10 points with the new data
      for (let j = 0; j < newPoints.length; j++) {
        line.setY(line.numPoints - newPoints.length + j, newPoints[j]);
      }

      
    });
  }, [linesRef, wglPlots, selectedBits,Zoom]); // Ensure dependencies are correctly referenced
  

  // const updatePlots = useCallback((data: number[],Zoom:number) => {
  //   wglPlots.forEach((wglp, index) => {
  //     if (wglp) {
  //       try {
  //         wglp.gScaleY = Zoom; // Adjust this value as needed
  //       } catch (error) {
  //         console.error(`Error setting gScaleY for WebglPlot instance at index ${index}:`, error);
  //       }
  //     } else {
  //       console.warn(`WebglPlot instance at index ${index} is undefined.`);
  //     }
  //   });
  //   linesRef.current.forEach((line, i) => {
  //     // Shift the data points efficiently using a single operation
  //     const bitsPoints = Math.pow(2, getValue(selectedBits)); // Adjust this according to your ADC resolution
  //     const yScale = 2 / bitsPoints;
  //     const chData = (data[i] - bitsPoints / 2) * yScale;
  
      // for (let j = 1; j < line.numPoints; j++) {
      //   line.setY(j - 1, line.getY(j));
      // }
      // line.setY(line.numPoints - 1, chData);
  //   });
  // }, [lines,wglPlots]); // Add dependencies here


  

  useEffect(() => {
    createCanvases();
  }, [numChannels]);




  const getValue = useCallback((bits: BitSelection): number => {
    switch (bits) {
      case "ten":
        return 10;
      case "twelve":
        return 12;
      case "fourteen":
        return 14;
      default:
      return 0; // Or any other fallback value you'd like
    }
  }, []);




  const animate = useCallback(() => {
    if (pauseRef.current) {
      wglPlots.forEach((wglp) => wglp.update());
      requestAnimationFrame(animate);
    }
  }, [wglPlots, pauseRef]);

  useEffect(() => {
    if (pauseRef.current) {
      requestAnimationFrame(animate);
    }
  }, [pauseRef.current, animate]);
  

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
    <div className="canvas-container flex flex-wrap justify-center items-center h-[80vh] w-full" ref={canvasContainerRef} ></div>
    </div>
  </div>
</div>
  );
});
Canvas.displayName = "Canvas";
export default Canvas;
