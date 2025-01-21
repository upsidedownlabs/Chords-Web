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
  selectedBits?: BitSelection;
  isDisplay: boolean;
  canvasCount?: number;
  selectedChannels: number[];
  timeBase?: number;
  currentSamplingRate: number;
  Zoom: number;
  currentSnapshot: number;
  snapShotRef: React.MutableRefObject<boolean[]>;
}

const Canvas = forwardRef(
  (
    {
      pauseRef,
      selectedBits,
      canvasCount = 6, // default value in case not provided
      timeBase = 4,
      currentSamplingRate,
      Zoom,
      selectedChannels,
      currentSnapshot,
      snapShotRef,
    }: CanvasProps,
    ref
  ) => {
    const { theme } = useTheme(); // Extract theme context
    let previousCounter: number | null = null; // Tracks the previous counter value for detecting data loss
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [numChannels, setNumChannels] = useState<number>(selectedChannels.length);
    const dataPointCountRef = useRef<number>(2000); // Ref to track the number of data points per line
    const [canvasElements, setCanvasElements] = useState<HTMLCanvasElement[]>([]); // Array of canvas elements
    const [wglPlots, setWglPlots] = useState<WebglPlot[]>([]);
    const [lines, setLines] = useState<WebglLine[]>([]);
    const linesRef = useRef<WebglLine[]>([]);
    const [samplingRate, setSamplingRate] = useState<number>(500);
    const sweepPositions = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    const currentSweepPos = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    const array3DRef = useRef<number[][][]>( // 3D buffer array for storing data
      Array.from({ length: 6 }, () =>
        Array.from({ length: 6 }, () => Array())
      )
    );
    const selectedChannelsRef = useRef(selectedChannels); // Ref for selected channels
    const activeBufferIndexRef =  useRef<number>(0); // Ref to track the active buffer index
    const dataIndicesRef = useRef<number[]>([]);  // Ref to store data indices

    //select point
    const getpoints = useCallback((bits: BitSelection): number => {
      switch (bits) {
        case 10:
          return 250;
        case 12:
        case 14:
        case 16:
          return 500;
        default:
          return 500; // Default fallback
      }
    }, []);

    useEffect(() => {
      dataPointCountRef.current = (currentSamplingRate * timeBase);

    }, [timeBase]);

    useEffect(() => {
      selectedChannelsRef.current = selectedChannels;
    }, [selectedChannels]);

    const prevCanvasCountRef = useRef<number>(canvasCount);

    const processIncomingData = (incomingData: number[]) => {
      const currentBuffer = array3DRef.current[activeBufferIndexRef.current];
    
      // Handle canvas count changes and reset buffers
      if (prevCanvasCountRef.current !== canvasCount) {
        for (let bufferIndex = 0; bufferIndex < 6; bufferIndex++) {
          array3DRef.current[bufferIndex] = Array.from({ length: canvasCount }, () => []);
          snapShotRef.current[bufferIndex] = false;
        }
        prevCanvasCountRef.current = canvasCount;
      }
    
      // Process incoming data for each canvas
      currentBuffer.forEach((buffer, i) => {
        if (buffer.length >= dataPointCountRef.current || 
            (!pauseRef.current && buffer.length < dataPointCountRef.current)) {
          currentBuffer[i] = [];
        }
        currentBuffer[i].push(incomingData[i + 1]);
      });
    
      // Update snapshot and buffer index when data is ready
      if (currentBuffer[0].length >= dataPointCountRef.current) {
        snapShotRef.current[activeBufferIndexRef.current] = true;
        activeBufferIndexRef.current = (activeBufferIndexRef.current + 1) % 6;
        snapShotRef.current[activeBufferIndexRef.current] = false;
      }
    
      // Update data indices for referencing past buffers
      dataIndicesRef.current = Array.from(
        { length: 5 },
        (_, i) => (activeBufferIndexRef.current - i - 1 + 6) % 6
      );
    };
    

    useEffect(() => {
      setNumChannels(selectedChannels.length);
    }, [selectedChannels]);


    useEffect(() => {
      // Reset when timeBase changes
      currentSweepPos.current = new Array(numChannels).fill(0);
      sweepPositions.current = new Array(numChannels).fill(0);
    }, [timeBase, theme]);

    useImperativeHandle(
      ref,
      () => ({
        updateData(data: number[]) {
          const [counter, ...channelData] = data;
    
          // Reset sweep positions if the number of channels changes or when not paused
          if (currentSweepPos.current.length !== numChannels || !pauseRef.current) {
            const resetArray = new Array(numChannels).fill(0);
            currentSweepPos.current = resetArray;
            sweepPositions.current = resetArray;
          }
    
          // Process and update plots if paused
          if (pauseRef.current) {
            processIncomingData(data);
            updatePlots(channelData, Zoom);
          }
    
          // Handle counter validation for data loss detection
          if (previousCounter !== null) {
            const expectedCounter = (previousCounter + 1) % 256;
            if (counter !== expectedCounter) {
              console.warn(
                `Data loss detected in canvas! Previous counter: ${previousCounter}, Current counter: ${counter}`
              );
            }
          }
    
          // Update the previous counter
          previousCounter = counter;
        },
      }),
      [Zoom, numChannels, timeBase]
    );
    

    const createcanvasElements = () => {
      const container = canvasContainerRef.current;
      if (!container) {
        return; // Exit if the ref is null
      }

      currentSweepPos.current = new Array(numChannels).fill(0);
      sweepPositions.current = new Array(numChannels).fill(0);

      // Clear existing child elements
      while (container.firstChild) {
        const firstChild = container.firstChild;
        if (firstChild instanceof HTMLCanvasElement) {
          const gl = firstChild.getContext("webgl");
          if (gl) {
            const loseContext = gl.getExtension("WEBGL_lose_context");
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
        container.removeChild(firstChild);
      }

      setCanvasElements([]);
      setWglPlots([]);
      linesRef.current = [];
      const newcanvasElements: HTMLCanvasElement[] = [];
      const newWglPlots: WebglPlot[] = [];
      const newLines: WebglLine[] = [];

      // Create grid lines
      const canvasWrapper = document.createElement("div");
      canvasWrapper.className = "absolute inset-0";
      const opacityDarkMajor = "0.2";
      const opacityDarkMinor = "0.05";
      const opacityLightMajor = "0.4";
      const opacityLightMinor = "0.1";
      const distanceminor = samplingRate * 0.04;
      const numGridLines = (getpoints(selectedBits ?? 10) * 4) / distanceminor;

      for (let j = 1; j < numGridLines; j++) {
        const gridLineX = document.createElement("div");
        gridLineX.className = "absolute bg-[rgb(128,128,128)]";
        gridLineX.style.width = "1px";
        gridLineX.style.height = "100%";
        gridLineX.style.left = `${((j / numGridLines) * 100).toFixed(3)}%`;
        gridLineX.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
        canvasWrapper.appendChild(gridLineX);
      }

      const horizontalline = 50;
      for (let j = 1; j < horizontalline; j++) {
        const gridLineY = document.createElement("div");
        gridLineY.className = "absolute bg-[rgb(128,128,128)]";
        gridLineY.style.height = "1px";
        gridLineY.style.width = "100%";
        gridLineY.style.top = `${((j / horizontalline) * 100).toFixed(3)}%`;
        gridLineY.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
        canvasWrapper.appendChild(gridLineY);
      }
      container.appendChild(canvasWrapper);

      // Create canvasElements for each selected channel
      selectedChannels.forEach((channelNumber) => {
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "canvas-container relative flex-[1_1_0%]";

        const canvas = document.createElement("canvas");
        canvas.id = `canvas${channelNumber}`;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight / selectedChannels.length;
        canvas.className = "w-full h-full block rounded-xl";

        const badge = document.createElement("div");
        badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";
        badge.innerText = `CH${channelNumber}`;

        canvasWrapper.appendChild(badge);
        canvasWrapper.appendChild(canvas);
        container.appendChild(canvasWrapper);

        newcanvasElements.push(canvas);
        const wglp = new WebglPlot(canvas);
        newWglPlots.push(wglp);
        wglp.gScaleY = Zoom;
        const line = new WebglLine(getLineColor(channelNumber, theme), dataPointCountRef.current);
        wglp.gOffsetY = 0;
        line.offsetY = 0;
        line.lineSpaceX(-1, 2 / dataPointCountRef.current);

        wglp.addLine(line);
        newLines.push(line);
      });

      linesRef.current = newLines;
      setCanvasElements(newcanvasElements);
      setWglPlots(newWglPlots);
      setLines(newLines);
    };

    const getLineColor = (i: number, theme: string | undefined): ColorRGBA => {
      // Predefine the color arrays for dark and light themes
      const colorsDark: ColorRGBA[] = [
        new ColorRGBA(180 / 255, 70 / 255, 120 / 255, 1), // Darkened #EC6FAA
        new ColorRGBA(150 / 255, 70 / 255, 125 / 255, 1), // Darkened #CE6FAC
        new ColorRGBA(130 / 255, 90 / 255, 140 / 255, 1), // Darkened #B47EB7
        new ColorRGBA(110 / 255, 110 / 255, 160 / 255, 1), // Darkened #9D8DC4
        new ColorRGBA(70 / 255, 100 / 255, 150 / 255, 1),  // Darkened #689AD2
        new ColorRGBA(40 / 255, 110 / 255, 140 / 255, 1),  // Darkened #35A5CC
        new ColorRGBA(35 / 255, 120 / 255, 130 / 255, 1),  // Darkened #30A8B4
        new ColorRGBA(35 / 255, 125 / 255, 120 / 255, 1),  // Darkened #32ABA2

      ];
    
      const colorsLight: ColorRGBA[] = [
        new ColorRGBA(236 / 255, 111 / 255, 170 / 255, 0.8), // Slightly transparent #EC6FAA
        new ColorRGBA(206 / 255, 111 / 255, 172 / 255, 0.8), // Slightly transparent #CE6FAC
        new ColorRGBA(180 / 255, 126 / 255, 183 / 255, 0.8), // Slightly transparent #B47EB7
        new ColorRGBA(157 / 255, 141 / 255, 196 / 255, 0.8), // Slightly transparent #9D8DC4
        new ColorRGBA(104 / 255, 154 / 255, 210 / 255, 0.8), // Slightly transparent #689AD2
        new ColorRGBA(53 / 255, 165 / 255, 204 / 255, 0.8),  // Slightly transparent #35A5CC
        new ColorRGBA(48 / 255, 168 / 255, 180 / 255, 0.8),  // Slightly transparent #30A8B4
        new ColorRGBA(50 / 255, 171 / 255, 162 / 255, 0.8),  // Slightly transparent #32ABA2

      ];
    
      // Select the appropriate color array based on the theme
      const colors = theme === "dark" ? colorsLight : colorsDark;
    
      // Return the color for the given index, wrapped with modulo for looping
      return colors[i % colors.length];
    };
    

    const updatePlots = useCallback(
      (data: number[], Zoom: number) => {
        const currentSelectedChannels = selectedChannelsRef.current;
    
        // Adjust zoom level for each WebglPlot only once per iteration
        wglPlots.forEach((wglp, index) => {
          if (wglp) {
            try {
              wglp.gScaleY = Zoom; // Adjust zoom value
            } catch (error) {
              console.error(`Error setting gScaleY for WebglPlot instance at index ${index}:`, error);
            }
          } else {
            console.warn(`WebglPlot instance at index ${index} is undefined.`);
          }
        });
    
        // Plot each line, with early returns for validation checks
        linesRef.current.forEach((line, i) => {
          if (!line) {
            console.warn(`Line at index ${i} is undefined.`);
            return;
          }
    
          // Map channel number from selectedChannels
          const channelNumber = currentSelectedChannels[i];
          if (channelNumber == null || channelNumber < 0 || channelNumber >= data.length) {
            console.warn(`Invalid channel number: ${channelNumber}. Skipping.`);
            return;
          }
    
          const channelData = data[channelNumber];
    
          // Initialize sweepPositions.current[i] if undefined
          if (sweepPositions.current[i] === undefined) {
            sweepPositions.current[i] = 0;
          }
    
          // Calculate the current position
          let currentPos = sweepPositions.current[i] % line.numPoints;
          if (Number.isNaN(currentPos)) {
            console.error(`Invalid currentPos at index ${i}. sweepPositions.current[i]:`, sweepPositions.current[i]);
            return;
          }
    
          // Plot the data
          try {
            line.setY(currentPos, channelData);
          } catch (error) {
            console.error(`Error plotting data for line ${i} at position ${currentPos}:`, error);
          }
    
          // Clear the next point for visual effect
          const clearPosition = Math.ceil((currentPos + dataPointCountRef.current / 100) % line.numPoints);
          try {
            line.setY(clearPosition, NaN);
          } catch (error) {
            console.error(`Error clearing data at position ${clearPosition} for line ${i}:`, error);
          }
    
          // Increment the sweep position for the next iteration
          sweepPositions.current[i] = (currentPos + 1) % line.numPoints;
        });
      },
      [wglPlots, linesRef, selectedChannelsRef, dataPointCountRef, sweepPositions]
    );
    

    useEffect(() => {
      createcanvasElements();
    }, [numChannels, theme, timeBase, selectedChannels]);


    const animate = useCallback(() => {
      if (!pauseRef.current) {
        // If paused, show the buffered data (this part runs when paused)
        updatePlotSnapshot(currentSnapshot);
      } else {
        // If not paused, continue with normal updates (e.g., real-time plotting)
        wglPlots.forEach((wglp) => wglp.update());
        requestAnimationFrame(animate); // Continue the animation loop
      }
    }, [currentSnapshot, dataPointCountRef.current, pauseRef.current, wglPlots, Zoom]);


    const updatePlotSnapshot = (currentSnapshot: number) => {
      // Access references and validate once to avoid repeated checks
      const dataIndices = dataIndicesRef.current;
      const array3D = array3DRef.current;
    
      // Early validation to avoid repeated checks inside the loop
      if (!dataIndices || !array3D || dataIndices[currentSnapshot] === undefined) {
        console.warn("One of the references is undefined or invalid");
        return;
      }
    
      // Process zoom settings for each WebglPlot only once
      wglPlots.forEach((wglp, index) => {
        if (wglp) {
          try {
            wglp.gScaleY = Zoom; // Adjust the zoom value
          } catch (error) {
            console.error(`Error setting gScaleY for WebglPlot instance at index ${index}:`, error);
          }
        } else {
          console.warn(`WebglPlot instance at index ${index} is undefined.`);
        }
      });
    
      // Process each canvas (or line) and update
      for (let i = 0; i < canvasCount; i++) {
        const lineData = array3D[dataIndices[currentSnapshot]];
    
        if (lineData && lineData[i]) {
          const yArray = new Float32Array(lineData[i]);
    
          // Ensure line exists before adding data
          const line = linesRef.current[i];
          if (line) {
            line.shiftAdd(yArray); // Efficiently add new points
          } else {
            console.error(`Line at index ${i} is undefined or null.`);
          }
        } else {
          console.warn(`No data found for snapshot ${currentSnapshot}, index ${i}.`);
        }
      }
    
      // Redraw the plots after all updates
      wglPlots.forEach((wglp) => wglp.update());
    };
    

    useEffect(() => {
      requestAnimationFrame(animate);

    }, [animate]);

    useEffect(() => {
      const handleResize = () => {
        createcanvasElements();

      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [createcanvasElements]);

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
