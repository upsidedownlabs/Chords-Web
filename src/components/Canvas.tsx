import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from "react";
import { captureLines, restoreLines, type FrozenLines } from "./frozenPlot";
import { useTheme } from "next-themes";
import { BitSelection } from "./DataPass";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";
import { lightThemeColors, darkThemeColors } from "./Colors";

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
        // Use resolvedTheme, not theme: the app defaults to the "system"
        // setting, so `theme` stays the literal string "system" until the
        // user manually picks light/dark — every `theme === "dark"` check
        // below would then be false even on a dark system, leaving the
        // WebGL-drawn lines/grid in light colors against a dark page.
        const { resolvedTheme: theme } = useTheme();
        const previousCounterRef = useRef<number | null>(null); // Variable to store the previous counter value for loss detection
        const canvasContainerRef = useRef<HTMLDivElement>(null);
        const [numChannels, setNumChannels] = useState<number>(selectedChannels.length);
        const dataPointCountRef = useRef<number>(2000); // To track the calculated value
        const [canvasElements, setCanvasElements] = useState<HTMLCanvasElement[]>([]);
        const [wglPlots, setWglPlots] = useState<WebglPlot[]>([]);
        const [lines, setLines] = useState<WebglLine[]>([]);
        const linesRef = useRef<WebglLine[]>([]);
        const frozenLinesRef = useRef<FrozenLines | null>(null); // screen at the moment of pausing
        const [samplingRate, setSamplingRate] = useState<number>(500);
        const sweepPositions = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
        const currentSweepPos = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
        const array3DRef = useRef<number[][][]>(
            Array.from({ length: 6 }, () =>
                Array.from({ length: 6 }, () => Array())
            )
        );
        const selectedChannelsRef = useRef(selectedChannels);
        const activeBufferIndexRef = useRef(0); // Initialize useRef with 0
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
            selectedChannelsRef.current = selectedChannels;
            dataPointCountRef.current = (currentSamplingRate * timeBase);

            // Any change to which channels are selected (not just how many),
            // or to the window size (timeBase / sampling rate), invalidates
            // every buffered snapshot: a slot may hold data for a channel
            // that's no longer shown, line up with the wrong index (e.g.
            // swapping CH1 for CH3 while keeping the count at 2), or be sized
            // for a different window length than buffers filled afterward.
            // Reset all 6 buffers so pause/rewind never mixes stale or
            // mismatched-length data into the "previous windows" view.
            for (let bufferIndex = 0; bufferIndex < 6; bufferIndex++) {
                array3DRef.current[bufferIndex] = Array.from(
                    { length: selectedChannels.length },
                    () => []
                );
                snapShotRef.current[bufferIndex] = false;
            }
            activeBufferIndexRef.current = 0;
            dataIndicesRef.current = [];
        }, [selectedChannels, timeBase, currentSamplingRate, snapShotRef]);

        const processIncomingData = (incomingData: number[]) => {
            // Ensure we have valid references
            if (!selectedChannelsRef.current || !array3DRef.current) return;

            const currentBuffer = array3DRef.current[activeBufferIndexRef.current];
            if (!currentBuffer) return;

            // Process incoming data for each selected channel
            selectedChannelsRef.current.forEach((channelNumber, i) => {
                // Ensure currentBuffer[i] exists
                if (!currentBuffer[i]) {
                    currentBuffer[i] = [];
                }

                // Clear buffer if needed
                if (currentBuffer[i].length >= dataPointCountRef.current ||
                    (!pauseRef.current && currentBuffer[i].length < dataPointCountRef.current)) {
                    currentBuffer[i] = [];
                }

                // Safely access incoming data
                if (channelNumber >= 0 && channelNumber < incomingData.length) {
                    currentBuffer[i].push(incomingData[channelNumber]);
                } else {
                    console.warn(`Invalid channel number ${channelNumber} or missing data`);
                    currentBuffer[i].push(0); // Push default value if data is missing
                }
            });

            // Update snapshot and buffer index when data is ready
            if (currentBuffer[0] && currentBuffer[0].length >= dataPointCountRef.current) {
                snapShotRef.current[activeBufferIndexRef.current] = true;
                activeBufferIndexRef.current = (activeBufferIndexRef.current + 1) % 6;
                snapShotRef.current[activeBufferIndexRef.current] = false;
            }

            // Update data indices for referencing past buffers
            dataIndicesRef.current = Array.from(
                { length: 5 },
                (_, i) => (activeBufferIndexRef.current - i + 5) % 6
            );
        };

        useEffect(() => {
            setNumChannels(selectedChannels.length);
        }, [selectedChannels]);


        useEffect(() => {
            // Reset when timeBase changes
            currentSweepPos.current = new Array(numChannels).fill(0);
            sweepPositions.current = new Array(numChannels).fill(0);
        }, [timeBase, theme, selectedChannels]); // plots are rebuilt: restart the sweep from the left

        useImperativeHandle(
            ref,
            () => ({
                updateData(data: number[]) {
                    // Reset the sweep positions if the number of channels has changed
                    // (not on pause: resuming continues from the frozen cursor)
                    if (currentSweepPos.current.length !== numChannels) {
                        currentSweepPos.current = new Array(numChannels).fill(0);
                        sweepPositions.current = new Array(numChannels).fill(0);
                    }

                    if (pauseRef.current) {
                        processIncomingData(data);
                        updatePlots(data, Zoom);
                    }
                    if (previousCounterRef.current !== null) {
                        // If there was a previous counter value
                        const expectedCounter: number = (previousCounterRef.current + 1) % 256; // Calculate the expected counter value
                        if (data[0] !== expectedCounter) {
                            // Check for data loss by comparing the current counter with the expected counter
                            console.warn(
                                `Data loss detected in canvas! Previous counter: ${previousCounterRef.current}, Current counter: ${data[0]}`
                            );
                        }
                    }
                    previousCounterRef.current = data[0]; // Update the previous counter with the current counter
                },
            }),
            [Zoom, numChannels, timeBase]
        );

        const createCanvasElements = () => {
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

        const getLineColor = (channelNumber: number, theme: string | undefined): ColorRGBA => {
            // Convert 1-indexed channel number to a 0-indexed index
            const index = channelNumber - 1;
            const colors = theme === "dark" ? darkThemeColors : lightThemeColors;
            const hex = colors[index % colors.length];

            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            const alpha = theme === "dark" ? 1 : 0.8;  // Slight transparency for light theme

            return new ColorRGBA(r, g, b, alpha);
        };


        const updatePlots = useCallback(
            (data: number[], Zoom: number) => {
                // Access the latest selectedChannels via the ref
                const currentSelectedChannels = selectedChannelsRef.current;

                // Adjust zoom level for each WebglPlot
                wglPlots.forEach((wglp, index) => {
                    if (wglp) {
                        try {
                            wglp.gScaleY = Zoom; // Adjust zoom value
                        } catch (error) {
                            console.warn(
                                `Error setting gScaleY for WebglPlot instance at index ${index}:`,
                                error
                            );
                        }
                    } else {
                        console.warn(`WebglPlot instance at index ${index} is undefined.`);
                    }
                });
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

                    // Ensure sweepPositions.current[i] is initialized
                    if (sweepPositions.current[i] === undefined) {
                        sweepPositions.current[i] = 0;
                    }

                    // Calculate the current position
                    const currentPos = sweepPositions.current[i] % line.numPoints;

                    if (Number.isNaN(currentPos)) {
                        console.warn(`Invalid currentPos at index ${i}. sweepPositions.current[i]:`, sweepPositions.current[i]);
                        return;
                    }

                    // Plot the data
                    try {
                        line.setY(currentPos, channelData);
                    } catch (error) {
                        console.warn(`Error plotting data for line ${i} at position ${currentPos}:`, error);
                    }

                    // Clear the next point for visual effect
                    const clearPosition = Math.ceil((currentPos + dataPointCountRef.current / 100) % line.numPoints);
                    try {
                        line.setY(clearPosition, NaN);
                    } catch (error) {
                        console.warn(`Error clearing data at position ${clearPosition} for line ${i}:`, error);
                    }

                    // Increment the sweep position
                    sweepPositions.current[i] = (currentPos + 1) % line.numPoints;
                });
            },
            [linesRef, wglPlots, selectedChannelsRef, dataPointCountRef, sweepPositions]
        );

        useEffect(() => {
            createCanvasElements();
        }, [numChannels, theme, timeBase, selectedChannels]);


        const animate = useCallback(() => {
            if (!pauseRef.current) {
                // Paused: snapshot 0 is the screen as it was when pausing;
                // 1+ step back through the buffered complete windows.
                if (!frozenLinesRef.current) frozenLinesRef.current = captureLines(linesRef.current);
                if (currentSnapshot === 0) {
                    restoreLines(linesRef.current, frozenLinesRef.current);
                    wglPlots.forEach((wglp) => {
                        wglp.gScaleY = Zoom;
                        wglp.update();
                    });
                } else {
                    updatePlotSnapshot(currentSnapshot - 1);
                }
            } else {
                // Resumed: put the paused screen back so the sweep continues
                // from where it stopped.
                if (frozenLinesRef.current) {
                    restoreLines(linesRef.current, frozenLinesRef.current);
                    frozenLinesRef.current = null;
                }
                wglPlots.forEach((wglp) => wglp.update());
                requestAnimationFrame(animate); // Continue the animation loop
            }
        }, [currentSnapshot, dataPointCountRef.current, pauseRef.current, wglPlots, Zoom]);


        const updatePlotSnapshot = (currentSnapshot: number) => {
            const currentSelectedChannels = selectedChannelsRef.current;

            currentSelectedChannels.forEach((channelNumber, i) => {
                const wglp = wglPlots[i];
                if (wglp) {
                    try {
                        wglp.gScaleY = Zoom;
                    } catch (error) {
                        console.warn(`Error setting gScaleY for WebglPlot instance at index ${i}:`, error);
                    }
                }

                if (array3DRef.current &&
                    dataIndicesRef.current &&
                    dataIndicesRef.current[currentSnapshot] !== undefined &&
                    array3DRef.current[dataIndicesRef.current[currentSnapshot]] &&
                    array3DRef.current[dataIndicesRef.current[currentSnapshot]][i] &&
                    array3DRef.current[dataIndicesRef.current[currentSnapshot]][i].length > 0) {

                    const channelData = array3DRef.current[dataIndicesRef.current[currentSnapshot]][i];

                    const line = linesRef.current[i];
                    if (line) {
                        // Write the buffered snapshot directly instead of shiftAdd:
                        // shiftAdd only overwrites `channelData.length` points and shifts
                        // the rest, so a short/partial buffer would leave stale, previously
                        // displayed data mixed in. Writing every point (NaN for any the
                        // buffer hasn't filled yet) guarantees the paused view always shows
                        // exactly the selected snapshot, not a blend with older frames.
                        for (let p = 0; p < line.numPoints; p++) {
                            line.setY(p, p < channelData.length ? channelData[p] : NaN);
                        }
                    } else {
                        console.warn(`Line at index ${i} is undefined or null.`);
                    }
                }
            });

            wglPlots.forEach((wglp) => wglp.update());
        };

        useEffect(() => {
            requestAnimationFrame(animate);

        }, [animate]);

        useEffect(() => {
            const handleResize = () => {
                createCanvasElements();

            };
            window.addEventListener("resize", handleResize);
            return () => {
                window.removeEventListener("resize", handleResize);
            };
        }, [createCanvasElements]);


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
