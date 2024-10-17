import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
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
    }: CanvasProps,
    ref
  ) => {
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [numChannels, setNumChannels] = useState<number>(canvasCount);
    const [canvases, setCanvases] = useState<HTMLCanvasElement[]>([]);
    const [wglPlots, setWglPlots] = useState<WebglPlot[]>([]);
    const [lines, setLines] = useState<WebglLine[]>([]);
    const linesRef = useRef<WebglLine[]>([]);
    const samplingRate = 500; // Set the sampling rate in Hz

    let numX: number;

    const getpoints = useCallback((bits: BitSelection): number => {
      switch (bits) {
        case "ten":
          return samplingRate * 2;
        case "fourteen":
          return samplingRate * 4;
        default:
          return 0; // Or any other fallback value you'd like
      }
    }, []);
    numX = getpoints(selectedBits);
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

    const createCanvases = () => {
      if (!canvasContainerRef.current) return;

      // Clean up all existing canvases and their WebGL contexts
      while (canvasContainerRef.current.firstChild) {
        const firstChild = canvasContainerRef.current.firstChild;
        if (firstChild instanceof HTMLCanvasElement) {
          const gl = firstChild.getContext("webgl");
          if (gl) {
            const loseContext = gl.getExtension("WEBGL_lose_context");
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
        canvasContainerRef.current.removeChild(firstChild);
      }

      setCanvases([]);
      setWglPlots([]);
      linesRef.current = [];
      const newCanvases = [];
      const newWglPlots = [];
      const newLines = [];483
      for (let i = 0; i < numChannels; i++) { 
        const canvas = document.createElement("canvas");
        canvas.width = canvasContainerRef.current.clientWidth;
        const canvasHeightInVh = 
        window.innerHeight > 945 ? 91 :
        window.innerHeight > 585 ? 87 :
        window.innerHeight <= 483 ? 76 : 
        80;
      
      const canvasHeight = (canvasHeightInVh * window.innerHeight) / 100 / numChannels;
      canvas.height = canvasHeight;
        

        canvas.className = "w-full h-full border-b";


        // Create a badge for the channel number
        const badge = document.createElement("div");
        badge.className =
          "absolute top-3 left-3 text-gray-500 text-sm rounded-full";
        badge.innerText = `CH${i + 1}`;

        // Append the canvas and badge to the container
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "relative";
        canvasWrapper.appendChild(canvas);
        canvasWrapper.appendChild(badge);

        canvasContainerRef.current.appendChild(canvasWrapper);

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
        new ColorRGBA(0.914, 0.361, 0.051, 1), // Bright Orange
      ];

      // Return color based on the index, cycling through if necessary
      return colors[i % colors.length]; // Ensure to always return a valid ColorRGBA
    };

    const updatePlots = useCallback(
      (data: number[], Zoom: number) => {
        wglPlots.forEach((wglp, index) => {
          if (wglp) {
            try {
              wglp.gScaleY = Zoom; // Adjust this value as needed
            } catch (error) {
              console.error(
                `Error setting gScaleY for WebglPlot instance at index ${index}:`,
                error
              );
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
      },
      [lines, wglPlots]
    ); // Add dependencies here

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

    useEffect(() => {
      const handleResize = () => {
        createCanvases();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [createCanvases]);

    return (
        <div className="flex flex-col justify-center items-start w-full  p-0 m-0">
          <div
            className="canvas-container flex flex-wrap justify-center items-center w-full "
            ref={canvasContainerRef}
          >
          </div>
        </div>
    );
  }
);
Canvas.displayName = "Canvas";
export default Canvas;