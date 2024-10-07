import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";

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

const Canvas = forwardRef(
  (
    {
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
  const [marginBottom, setMarginBottom] = useState(0);
  const fps = 60;
  const samplingRate = 500; // Set the sampling rate in Hz
  const slidePoints = Math.floor(samplingRate / fps); // Set how many points to slide
  let numX: number;

    const getpoints = useCallback((bits: BitSelection): number => {
      switch (bits) {
        case "ten":
        return samplingRate*2;
        case "fourteen":
        return samplingRate*4;
        default:
          return 0; // Or any other fallback value you'd like
      }
    }, []);
  numX=getpoints(selectedBits);
    useEffect(() => {
      setNumChannels(canvasCount);
    }, [canvasCount]);

    useImperativeHandle(
      ref,
      () => ({
        updateData(data: number[]) {
          updatePlots(data, Zoom);
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
          previousCounter = data[6]; // Update the previous counter with the current counter
        },
      }),
      [Zoom]
    );


  useEffect(() => {
    const containerHeightPx = canvasContainerRef.current?.clientHeight || window.innerHeight;

    // Calculate dynamic margin-bottom based on container height
    const dynamicMarginBottom = containerHeightPx * 0.04; // Example: 5% of container height
    setMarginBottom(dynamicMarginBottom);
  }, []);

const createCanvases = () => {
  if (!canvasContainerRef.current) return;

      // Clean up all existing canvases and their WebGL contexts
      while (canvasContainerRef.current.firstChild) {
        const firstChild = canvasContainerRef.current.firstChild;

        // Ensure it's an HTMLCanvasElement before trying to get the context
        if (firstChild instanceof HTMLCanvasElement) {
          const gl = firstChild.getContext("webgl");

          // Lose the WebGL context if available
          if (gl) {
            const loseContext = gl.getExtension("WEBGL_lose_context");
            if (loseContext) {
              loseContext.loseContext();
            }
          }

          // Remove the canvas element from the container
          canvasContainerRef.current.removeChild(firstChild);
        } else {
          // Remove the badge or any other non-canvas element
          canvasContainerRef.current.removeChild(firstChild);
        }
      }

      // Clear the arrays holding canvases, WebGL plots, and lines
      setCanvases([]);
      setWglPlots([]);
      linesRef.current = [];

  const fixedCanvasWidth = canvasContainerRef.current.clientWidth;
  // const containerHeight = canvasContainerRef.current.clientHeight || window.innerHeight - 50;
 
  const containerHeightPx = canvasContainerRef.current.clientHeight || window.innerHeight;
  const canvasHeight = containerHeightPx / numChannels;
  const containerHeightVh = (containerHeightPx / window.innerHeight) * 100; // Convert pixels to vh
  const canvasHeightVh = containerHeightVh / numChannels; // Each channel's height in vh

      const newCanvases: HTMLCanvasElement[] = [];
      const newWglPlots: WebglPlot[] = [];
      const newLines: WebglLine[] = [];



      for (let i = 0; i < numChannels; i++) {
        const canvas = document.createElement("canvas");

        canvas.width = fixedCanvasWidth;
        canvas.height = canvasHeight;

    canvas.className = "border border-secondary-foreground w-full";
    canvas.style.height = `${canvasHeightVh}vh`;
    canvas.style.border = "0.5px solid #ccc";

        // Create a badge for the channel number
        const badge = document.createElement("div");
        badge.className =
          "absolute top-1 left-1 transform -translate-y-1/20 translate-x-1/6 text-gray-500 text-sm rounded-full";
        badge.innerText = `CH${i + 1}`; // Display channel number starting from 1

        // Append the canvas and badge to the container
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "relative"; // Ensure the badge is positioned relative to the canvas
        canvasWrapper.appendChild(canvas);
        canvasWrapper.appendChild(badge);

        canvasContainerRef.current.appendChild(canvasWrapper); // Append the wrapper to the container

        newCanvases.push(canvas);

    const wglp = new WebglPlot(canvas);
    newWglPlots.push(wglp);
    wglp.gScaleY = Zoom;
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

  
  const updatePlots = useCallback((data: number[],Zoom:number) => {
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
    linesRef.current.forEach((line, i) => {
      // Shift the data points efficiently using a single operation
      const bitsPoints = Math.pow(2, getValue(selectedBits)); // Adjust this according to your ADC resolution
      const yScale = 2 / bitsPoints;
      const chData = (data[i] - bitsPoints / 2) * yScale;
  
      for (let j = 1; j < line.numPoints; j++) {
        line.setY(j - 1, line.getY(j));
      }
      line.setY(line.numPoints - 1, chData);
    });

  }, [lines,wglPlots]); // Add dependencies here

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

  return (
    <div 
    // style={{ marginBottom: `${marginBottom}px` }} // Apply the dynamic margin-bottom here
    className="flex justify-center items-center min-h-[calc(100vh-8rem)]  mb-5 mt-3">
    {/* Canvas container taking 70% of the screen height */}
    <div className="flex flex-col justify-center items-start w-full px-3">
      <div className="grid w-full h-full relative">
    <div className="canvas-container flex flex-wrap justify-center items-center h-[80vh]  w-full" ref={canvasContainerRef} ></div>
    </div>
  </div>
</div>
  );
});
Canvas.displayName = "Canvas";
export default Canvas;
