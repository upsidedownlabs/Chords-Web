import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
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
    const { theme } = useTheme();
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [numChannels, setNumChannels] = useState<number>(canvasCount);
    const [canvases, setCanvases] = useState<HTMLCanvasElement[]>([]);
    const [wglPlots, setWglPlots] = useState<WebglPlot[]>([]);
    const [lines, setLines] = useState<WebglLine[]>([]);
    const linesRef = useRef<WebglLine[]>([]);
    const samplingRate = 500; // Set the sampling rate in Hz
    const sweepPositions = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    const currentSweepPos = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
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
          // Reset the sweep positions if the number of channels has changed
          if (currentSweepPos.current.length !== numChannels) {
            currentSweepPos.current = new Array(numChannels).fill(0);
            sweepPositions.current = new Array(numChannels).fill(0);
          }
          updatePlots(data, Zoom);
          if (previousCounter !== null) {
            // If there was a previous counter value
            const expectedCounter: number = (previousCounter + 1) % 256; // Calculate the expected counter value
            if (data[0] !== expectedCounter) {
              // Check for data loss by comparing the current counter with the expected counter
              console.warn(
                `Data loss detected in canvas! Previous counter: ${previousCounter}, Current counter: ${data[0]}`
              );
            }
          }
          previousCounter = data[0]; // Update the previous counter with the current counter
        },
      }),
      [Zoom, numChannels]
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
      const newLines = [];


      // // Create grid lines
      const canvasWrapper = document.createElement("div");
      canvasWrapper.className = "absolute inset-0"; // Make the wrapper fill the parent container
      const opacityDarkMajor = "0.2"; // Opacity for every 5th line in dark theme
      const opacityDarkMinor = "0.05"; // Opacity for other lines in dark theme
      const opacityLightMajor = "0.4"; // Opacity for every 5th line in light theme
      const opacityLightMinor = "0.1"; // Opacity for other lines in light theme
      const distanceminor = samplingRate * 0.04;
      const numGridLines = numX / distanceminor;
      for (let j = 1; j < numGridLines; j++) {
        const gridLineX = document.createElement("div");
        gridLineX.className = "absolute bg-[rgb(128,128,128)]";
        gridLineX.style.width = "1px";
        gridLineX.style.height = "100%";
        const divPoint = (j / numGridLines) * 100
        const a = parseFloat(divPoint.toFixed(3));
        gridLineX.style.left = `${a}%`
        gridLineX.style.top = "0";
        gridLineX.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);

        // Append grid lines to the wrapper
        canvasWrapper.appendChild(gridLineX);
      }
      const horizontalline=50;
      for (let j = 1; j < horizontalline; j++) {
        const gridLineY = document.createElement("div");
        gridLineY.className = "absolute bg-[rgb(128,128,128)]";
        gridLineY.style.height = "1px";
        gridLineY.style.width = "100%";
        const distance = (j / horizontalline) * 100
        const distancetop = parseFloat(distance.toFixed(3));
        gridLineY.style.top = `${distancetop}%`;
        gridLineY.style.left = "0";
        gridLineY.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);

        // Append grid lines to the wrapper
        canvasWrapper.appendChild(gridLineY);
      }
      canvasContainerRef.current.appendChild(canvasWrapper);
      for (let i = 0; i < numChannels; i++) {
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "canvas-container relative flex-[1_1_0%]"; // Add relative positioning for absolute grid positioning

        const canvas = document.createElement("canvas");
        canvas.id = `canvas${i + 1}`;
        canvas.width = canvasContainerRef.current.clientWidth ;
        const canvasHeight = (canvasContainerRef.current.clientHeight / numChannels) ;
        canvas.height = canvasHeight;
        canvas.className = "w-full h-full block rounded-xl";

        // Create a badge for the channel number
        const badge = document.createElement("div");
        badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";
        badge.innerText = `CH${i + 1}`;

        // Append the canvas and badge to the container
        canvasWrapper.appendChild(badge);
        canvasWrapper.appendChild(canvas);
        canvasContainerRef.current.appendChild(canvasWrapper);

        newCanvases.push(canvas);
        const wglp = new WebglPlot(canvas);
        newWglPlots.push(wglp);
        wglp.gScaleY = Zoom;
        const line = new WebglLine(getLineColor(i, theme), numX);
        wglp.gOffsetY = 0;
        line.offsetY = 0;
        line.lineSpaceX(-1, 2 / numX);

        wglp.addLine(line);
        newLines.push(line);
      }

      linesRef.current = newLines;
      setCanvases(newCanvases);
      setWglPlots(newWglPlots);
      setLines(newLines);
    };


    const getLineColor = (i: number, theme: string | undefined): ColorRGBA => {
      // Define bright colors
      const colorsDark: ColorRGBA[] = [
        new ColorRGBA(1, 0.286, 0.529, 1), // Bright Pink
        new ColorRGBA(0.475, 0.894, 0.952, 1), // Light Blue
        new ColorRGBA(0, 1, 0.753, 1), // Bright Cyan
        new ColorRGBA(0.431, 0.761, 0.031, 1), // Bright Green
        new ColorRGBA(0.678, 0.286, 0.882, 1), // Bright Purple
        new ColorRGBA(0.914, 0.361, 0.051, 1), // Bright Orange
      ];
      const colorsLight: ColorRGBA[] = [
        new ColorRGBA(0.820, 0.000, 0.329, 1), // #D10054 - Bright Pink
        new ColorRGBA(0.000, 0.478, 0.549, 1), // #007A8C - Light Blue
        new ColorRGBA(0.039, 0.408, 0.278, 1), // #0A6847 - Dark Green
        new ColorRGBA(0.404, 0.255, 0.533, 1), // #674188 - Bright Purple
        new ColorRGBA(0.902, 0.361, 0.098, 1), // #E65C19 - Bright Orange
        new ColorRGBA(0.180, 0.027, 0.247, 1), // #2E073F - Dark Purple
      ];


      // Return color based on the index, cycling through if necessary
      return theme === "dark"
        ? colorsDark[i % colorsDark.length]
        : colorsLight[i % colorsLight.length];
    };

    const updatePlots = useCallback(
      (data: number[], Zoom: number) => {

        wglPlots.forEach((wglp, index) => {
          if (wglp) {
            try {
              wglp.gScaleY = Zoom; // Adjust the zoom value
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
          const bitsPoints = Math.pow(2, getValue(selectedBits)); // Adjust according to your ADC resolution
          const yScale = 2 / bitsPoints;
          const chData = (data[i] - bitsPoints / 2) * yScale;

          // Use a separate sweep position for each line
          currentSweepPos.current[i] = sweepPositions.current[i];
          // Plot the new data at the current sweep position
          line.setY(currentSweepPos.current[i] % line.numPoints, chData);

          // Clear the next point to create a gap (optional, for visual effect)
          const clearPosition = (currentSweepPos.current[i] + (numX / 100)) % line.numPoints;
          line.setY(clearPosition, NaN);

          // Increment the sweep position for the current line
          sweepPositions.current[i] = (currentSweepPos.current[i] + 1) % line.numPoints;
        });
      },
      [lines, wglPlots, numChannels, theme]
    );

    useEffect(() => {
      createCanvases();
    }, [numChannels, theme]);

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
    }, [createCanvases,]);

    return (
      <main className=" flex flex-col flex-[1_1_0%] min-h-80 bg-highlight  rounded-2xl m-4 relative"
        ref={canvasContainerRef}
      >
      </main>
    );
  }
);
Canvas.displayName = "Canvas";
export default Canvas;