'use client';
import React, {
    useEffect,
    useRef,
    useState,
    useMemo,
    useCallback,
    useLayoutEffect,
} from "react";
import { toast } from "sonner";

import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { EXGFilter, Notch } from '@/components/filters';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    CircleX,
    CircleOff,
    ReplaceAll,
    BicepsFlexed,
    Loader,
    Battery,
    BatteryLow,
    BatteryMedium,
    BatteryFull,
    BatteryWarning
} from "lucide-react";
import { useTheme } from "next-themes";

// Device configuration interface
interface DeviceConfig {
    maxChannels: number;
    sampleLength: number;
    hasBattery: boolean;
    name: string;
}

const defaultConfig: DeviceConfig = {
    maxChannels: 3,
    sampleLength: 7, 
    hasBattery: true,
    name: ""
};

const MuscleStrength = () => {
    const [isDisplay, setIsDisplay] = useState<boolean>(true); // Display state
    const samplingrateref = useRef<number>(250);
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const connectedDeviceRef = useRef<any | null>(null); // UseRef for device tracking
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const dataPointCountRef = useRef<number>(2000); // To track the calculated value
    const sweepPositions = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    const currentSweepPos = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    const maxCanvasElementCountRef = useRef<number>(6);
    const isOldfirmwareRef = useRef<boolean>(false); // Ref to track if the device has old firmware

    // Centralized device configuration
    const deviceConfigRef = useRef<DeviceConfig>(defaultConfig);
    const [deviceConfig, setDeviceConfig] = useState<DeviceConfig>(defaultConfig);
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null); // Battery level percentage for UI
    const [deviceName, setDeviceName] = useState<string>(""); // Store device name for UI
    const [refreshKey, setRefreshKey] = useState(0); // Force re-render when config changes

    const channelNames = useMemo(() =>
        Array.from({ length: deviceConfig.maxChannels }, (_, i) => `CH${i + 1}`),
        [deviceConfig.maxChannels]
    );

    // Dynamic band names based on device configuration
    const bandNames = useMemo(
        () => Array.from({ length: deviceConfig.maxChannels }, (_, i) => `CH${i}`),
        [deviceConfig.maxChannels]
    );

    const numChannels = deviceConfig.maxChannels;
    const [selectedChannels, setSelectedChannels] = useState<number[]>([0, 1, 2]);
    const { theme } = useTheme(); // Current theme of the app
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Track loading state for asynchronous operations
    const [open, setOpen] = useState(false);
    const selectedChannelsRef = useRef(selectedChannels);
    const [Zoom, SetZoom] = useState<number>(1); // Number of canvases
    const [timeBase, setTimeBase] = useState<number>(10); // To track the current index to show
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const latestDataRef = useRef<number[] | null>(null);
    const animationRef = useRef<number>(0);
    const prevBandPowerData = useRef<number[]>(Array(deviceConfig.maxChannels).fill(0));

    const [bandPowerData, setBandPowerData] = useState<number[]>(
        Array(deviceConfig.maxChannels).fill(0)
    );
    const NUM_POINTS = 2500; // Number of points per line

    const wglpRefs = useRef<WebglPlot[]>([]);
    const linesRefs = useRef<WebglLine[][]>([]); // Now it's an array of arrays

    // Envelope filters for all channels
    const envelopeFilters = useRef<EnvelopeFilter[]>([]);

    // Function to update device configuration based on name
    const updateDeviceConfiguration = (name: string) => {
        let newConfig: DeviceConfig;

        if (name.includes("3CH")) {
            newConfig = {
                maxChannels: 3,
                sampleLength: 7, // 3 channels * 2 bytes + 1 byte counter = 7 bytes
                hasBattery: true,
                name
            };
            isOldfirmwareRef.current = false; // Mark as new firmware if 3CH device is detected

        } else if (name.includes("6CH")) {
            newConfig = {
                maxChannels: 6,
                sampleLength: 13, // 6 channels * 2 bytes + 1 byte counter = 13 bytes
                hasBattery: true,
                name
            };
            isOldfirmwareRef.current = false; // Mark as new firmware if 3CH device is detected

        } else {
            newConfig = {
                maxChannels: 3,
                sampleLength: 7,
                hasBattery: false,
                name
            };
            isOldfirmwareRef.current = true; // Mark as old firmware if device name doesn't match known patterns

        }

        // Update both ref and state
        deviceConfigRef.current = newConfig;
        setDeviceConfig(newConfig);
        setDeviceName(name);

        // Initialize envelope filters for all channels
        envelopeFilters.current = [];
        for (let i = 0; i < newConfig.maxChannels; i++) {
            envelopeFilters.current.push(new EnvelopeFilter(64));
        }

        // Reset band power data array size
        const newBandPowerData = Array(newConfig.maxChannels).fill(0);
        setBandPowerData(newBandPowerData);
        prevBandPowerData.current = newBandPowerData;

        // Reset UI states
        setSelectedChannels(Array.from({ length: newConfig.maxChannels }, (_, i) => i));
        setBatteryLevel(null);

        // Force re-render to update UI with new channel count
        setRefreshKey(prev => prev + 1);
    };

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
        const canvasWrapper1 = document.createElement("div");
        canvasWrapper1.className = "absolute inset-0";
        const opacityDarkMajor = "0.2";
        const opacityDarkMinor = "0.05";
        const opacityLightMajor = "0.4";
        const opacityLightMinor = "0.1";
        const distanceminor = 500 * 0.04;
        const numGridLines = (500 * 4) / distanceminor;

        for (let j = 1; j < numGridLines; j++) {
            const gridLineX = document.createElement("div");
            gridLineX.className = "absolute bg-[rgb(128,128,128)]";
            gridLineX.style.width = "1px";
            gridLineX.style.height = "100%";
            gridLineX.style.left = `${((j / numGridLines) * 100).toFixed(3)}%`;
            gridLineX.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
            canvasWrapper1.appendChild(gridLineX);
        }

        const horizontalline = 50;
        for (let j = 1; j < horizontalline; j++) {
            const gridLineY = document.createElement("div");
            gridLineY.className = "absolute bg-[rgb(128,128,128)]";
            gridLineY.style.height = "1px";
            gridLineY.style.width = "100%";
            gridLineY.style.top = `${((j / horizontalline) * 100).toFixed(3)}%`;
            gridLineY.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
            canvasWrapper1.appendChild(gridLineY);
        }
        container.appendChild(canvasWrapper1);

        // Create canvasElements for each selected channel
        selectedChannels.forEach((channelNumber, index) => {
            const canvasWrapper = document.createElement("div");
            canvasWrapper.className = "canvas-container relative flex-[1_1_0%] ";

            const canvas = document.createElement("canvas");
            canvas.id = `canvas${channelNumber}`;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight / selectedChannels.length;
            canvas.className = "w-full h-full block rounded-xl";

            const badge = document.createElement("div");
            badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";
            badge.innerText = `CH${channelNumber + 1}`;

            canvasWrapper.appendChild(badge);
            canvasWrapper.appendChild(canvas);
            container.appendChild(canvasWrapper);
            if (!canvas) return;
            const wglp = new WebglPlot(canvas);

            // Ensure linesRefs.current[index] is initialized as an array
            if (!linesRefs.current[index]) {
                linesRefs.current[index] = [];
            }

            wglpRefs.current[index] = wglp;

            // Define colors for two different data sets
            const color1 = new ColorRGBA(1, 0, 0, 1); // Red (Raw EMG data)
            const color2 = new ColorRGBA(0, 1, 1, 1); // Cyan (Envelope data)

            // First data line (Raw EMG)
            const line1 = new WebglLine(color1, NUM_POINTS);
            line1.lineSpaceX(-1, 2 / NUM_POINTS);
            wglp.addLine(line1);

            // Second data line (Envelope)
            const line2 = new WebglLine(color2, NUM_POINTS);
            line2.lineSpaceX(-1, 2 / NUM_POINTS);
            wglp.addLine(line2);

            // Store references
            linesRefs.current[index][0] = line1;
            linesRefs.current[index][1] = line2;
            // Animation loop
            const animate = () => {
                wglp.update();
                requestAnimationFrame(animate);
            };
            animate();

        });
    }

    // Re-build everything any time the container really changes size
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => {
            createCanvasElements();
            rebuildInfoBoxes();   // <-- whatever your right-hand sizing fn is

            function rebuildInfoBoxes() {
                console.log("Rebuilding info boxes...");
                // Add your logic here
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [
        theme,
        timeBase,
        selectedChannels,
        refreshKey,
        /* …any other state your build fns read */
    ]);

    useEffect(() => {
        const handleResize = () => {
            createCanvasElements();

        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [createCanvasElements]);

    const updateData = (newData: number[], evn: number[]) => {
        if (!linesRefs.current.length) return;

        linesRefs.current.forEach((line, i) => {
            const line1 = linesRefs.current[i][0]; // First dataset (Raw EMG)
            const line2 = linesRefs.current[i][1]; // Second dataset (Envelope)

            if (!line1 || !line2) {
                console.warn(`Line at index ${i} is undefined.`);
                return;
            }

            // Ensure sweepPositions.current[i] is initialized
            if (sweepPositions.current[i] === undefined) {
                sweepPositions.current[i] = 0;
            }

            // Calculate the current position
            const currentPos = sweepPositions.current[i] % line1.numPoints;

            if (Number.isNaN(currentPos)) {
                console.error(`Invalid currentPos at index ${i}. sweepPositions.current[i]:`, sweepPositions.current[i]);
                return;
            }

            // ✅ **Plot data for both lines**
            try {
                line1.setY(currentPos, newData[i + 1]); // Raw EMG data (index i+1 because newData[0] is counter)
                line2.setY(currentPos, evn[i]); // Envelope data
            } catch (error) {
                console.error(`Error plotting data for line ${i} at position ${currentPos}:`, error);
            }

            // ✅ **Clear the next point for a smooth sweep effect**
            const clearPosition = Math.ceil((currentPos + dataPointCountRef.current / 100) % line1.numPoints);
            try {
                line1.setY(clearPosition, NaN);
                line2.setY(clearPosition, NaN);
            } catch (error) {
                console.error(`Error clearing data at position ${clearPosition} for line ${i}:`, error);
            }

            // ✅ **Increment the sweep position**
            sweepPositions.current[i] = (currentPos + 1) % line1.numPoints;
        });
    };

    // Update powerBuffer when bandNames changes
    useEffect(() => {
        powerBuffer.current = bandNames.map(() => []);
    }, [bandNames]);

    const powerBuffer = useRef<number[][]>(bandNames.map(() => []));

    const drawGraph = useCallback(
        (data: number[]) => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            if (data.some(isNaN)) return;

            // Responsive sizing + DPR - Force layout recalculation
            container.style.display = 'block';
            const { width: cssW, height: cssH } = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Resize canvas if needed
            if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
                canvas.width = Math.floor(cssW * dpr);
                canvas.height = Math.floor(cssH * dpr);
                canvas.style.width = `${cssW}px`;
                canvas.style.height = `${cssH}px`;
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Clear the ENTIRE canvas with background color
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            // Clear the canvas completely
            ctx.clearRect(0, 0, cssW, cssH);

            // Fill with background color (optional - if you want solid background)

            const W = cssW;
            const H = cssH;

            // Calculate scale based on effective width
            const scale = W / 800;
            const padding = 5 * scale;
            const axisGap = Math.max(1 * scale, 1);

            const barCount = data.length;

            // Calculate bar width with safety margins
            const availableWidth = W - (padding * 2);
            const barPaddingFactor = 0.12;
            const barSpace = availableWidth * barPaddingFactor / barCount;
            const barActW = availableWidth / barCount - barSpace;

            // Fixed height for top info and bottom labels
            let infoH = 50 * scale;
            let labelBoxH = 40 * scale;

            // Full drawable height for bars
            const barAreaH = H - padding * 2 - infoH - labelBoxH - axisGap * 9;

            // Adjust heights based on zoom
            if (dpr < 2) {
                infoH *= 1.2;
            }

            const fontMain = infoH * 0.3;
            const fontLabel = Math.max(infoH * 0.3, 14 * scale);

            if (H < 600) {
                infoH *= 0.8;
                labelBoxH *= 0.8;
            }

            const axisColor = theme === "dark" ? "#fff" : "#000";
            const bgColor = theme === "dark" ? "#020817" : "#fff";
            const radius = 15 * scale;

            // Update buffer
            data.forEach((v, i) => {
                const buf = powerBuffer.current[i];
                if (!buf) {
                    // Initialize buffer if it doesn't exist
                    powerBuffer.current[i] = [];
                }
                if (powerBuffer.current[i].length >= 500) powerBuffer.current[i].shift();
                powerBuffer.current[i].push(v);
            });

            // Draw bars and info blocks
            data.forEach((v, i) => {
                let adjustedBarPosition;
                if (dpr > 1.1) {
                    const totalBarsWidth = barCount * (barActW + barSpace);
                    const leftMargin = Math.max(0, (cssW - totalBarsWidth) / 2);
                    adjustedBarPosition = leftMargin + i * (barActW + barSpace);
                } else {
                    adjustedBarPosition = padding + i * (barActW + barSpace);
                }

                const x0 = Math.min(adjustedBarPosition, cssW - padding - barActW);

                // Info block
                ctx.fillStyle = bgColor;
                ctx.strokeStyle = axisColor;
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.roundRect(x0, padding, barActW, infoH, [radius, radius, 0, 0]);
                ctx.fill();
                ctx.stroke();

                // Info text
                ctx.fillStyle = axisColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = `${fontMain}px Arial`;

                const cx = x0 + barActW / 2;
                ctx.fillText("Current Value", cx, padding + infoH * 0.3);
                ctx.fillText(v.toFixed(2), cx, padding + infoH * 0.7);
            });

            // Draw bar backgrounds and bars
            data.forEach((v, i) => {
                let adjustedBarPosition;
                if (dpr > 1.1) {
                    const totalBarsWidth = barCount * (barActW + barSpace);
                    const leftMargin = Math.max(0, (W - totalBarsWidth) / 2);
                    adjustedBarPosition = leftMargin + i * (barActW + barSpace);
                } else {
                    adjustedBarPosition = padding + i * (barActW + barSpace);
                }

                const x0 = Math.min(adjustedBarPosition, W - padding - barActW);
                const barY = padding + infoH + axisGap;

                // Draw bar background
                ctx.fillStyle = bgColor;
                ctx.strokeStyle = axisColor;
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.roundRect(
                    x0,
                    padding + infoH + axisGap,
                    barActW,
                    barAreaH
                );
                ctx.fill();
                ctx.stroke();

                // Draw filled bar
                const max = Math.max(...(powerBuffer.current[i] || [1]), 1);
                const bh = (v / max) * barAreaH;
                const barTopY = padding + infoH + axisGap + (barAreaH - bh);

                // Create gradient based on height
                const grad = ctx.createLinearGradient(x0, barY + barAreaH, x0, barY + barAreaH - bh);
                const one3 = barAreaH / 3;

                if (bh <= one3) {
                    grad.addColorStop(0, "green");
                    grad.addColorStop(1, "green");
                } else if (bh <= one3 * 2) {
                    grad.addColorStop(0, "green");
                    grad.addColorStop(one3 / bh, "green");
                    grad.addColorStop(1, "yellow");
                } else {
                    grad.addColorStop(0, "green");
                    grad.addColorStop(one3 / bh, "green");
                    grad.addColorStop((one3 * 2) / bh, "yellow");
                    grad.addColorStop(1, "red");
                }

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(
                    x0,
                    barTopY,
                    barActW,
                    bh
                );
                ctx.fill();
            });

            // Draw X-axis labels
            data.forEach((_, i) => {
                const totalBarsWidth = barCount * (barActW + barSpace);
                const leftMargin = Math.max(0, (W - totalBarsWidth) / 2);
                const adjustedBarPosition = leftMargin + i * (barActW + barSpace);
                const x0 = Math.min(adjustedBarPosition, W - padding - barActW);

                const labelX = x0 + barActW / 2;
                const barY = padding + infoH + axisGap;
                const labelY = barY + barAreaH + axisGap;

                // Label background
                ctx.fillStyle = bgColor;
                ctx.strokeStyle = axisColor;

                ctx.beginPath();
                ctx.roundRect(labelX - barActW / 2, labelY, barActW, labelBoxH, [0, 0, radius / 2, radius / 2]);
                ctx.fill();
                ctx.stroke();

                // Label text
                ctx.fillStyle = axisColor;
                ctx.font = `${fontLabel}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(bandNames[i], labelX, labelY + fontLabel);
            });
        },
        [theme, bandNames]
    );
    useEffect(() => {
        if (canvasRef.current && containerRef.current && latestDataRef.current) {
            drawGraph(latestDataRef.current);
        }
    }, [containerRef, canvasRef]);  // Or after `selectedChannels` change


    // Improved resize handling with zoom level detection
    useEffect(() => {
        // Debounced resize handler to prevent too many redraws
        let resizeTimeout: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (latestDataRef.current) {
                    drawGraph(latestDataRef.current);
                }
            }, 100); // 100ms debounce
        };

        // Handle zoom changes by checking device pixel ratio changes
        let currentDpr = window.devicePixelRatio || 1;
        const handleZoom = () => {
            const newDpr = window.devicePixelRatio || 1;
            if (newDpr !== currentDpr) {
                currentDpr = newDpr;
                if (latestDataRef.current) {
                    drawGraph(latestDataRef.current);
                }
            }
        };

        // Initial draw and event registration
        window.addEventListener("resize", handleResize);
        window.addEventListener("zoom", handleZoom); // Some browsers support this

        // Also check periodically for zoom changes (for browsers that don't support zoom event)
        const zoomCheckInterval = setInterval(handleZoom, 1000);

        return () => {
            clearTimeout(resizeTimeout);
            clearInterval(zoomCheckInterval);
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("zoom", handleZoom);
        };
    }, [drawGraph]);

    const animateGraph = useCallback(() => {
        const interpolationFactor = 0.1;

        const currentValues = bandPowerData.map((target, i) => {
            const prev = prevBandPowerData.current[i];
            return prev + (target - prev) * interpolationFactor;
        });

        drawGraph(currentValues);
        prevBandPowerData.current = currentValues;

        animationRef.current = requestAnimationFrame(animateGraph);
    }, [bandPowerData, drawGraph]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animateGraph);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [animateGraph]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            animationRef.current = requestAnimationFrame(animateGraph);
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [animateGraph]);

    useEffect(() => {
        selectedChannelsRef.current = selectedChannels;
    }, [selectedChannels]);

    //filters
    const appliedFiltersRef = React.useRef<{ [key: number]: number }>({});
    const appliedEXGFiltersRef = React.useRef<{ [key: number]: number }>({});
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const [, forceEXGUpdate] = React.useReducer((x) => x + 1, 0);

    const removeEXGFilter = (channelIndex: number) => {
        delete appliedEXGFiltersRef.current[channelIndex]; // Remove the filter for the channel
        forceEXGUpdate(); // Trigger re-render

    };

    // Function to handle frequency selection
    const handleFrequencySelectionEXG = (channelIndex: number, frequency: number) => {
        appliedEXGFiltersRef.current[channelIndex] = frequency; // Update the filter for the channel
        forceEXGUpdate(); //Trigger re-render

    };

    // Function to set the same filter for all channels
    const applyEXGFilterToAllChannels = (channels: number[], frequency: number) => {
        channels.forEach((channelIndex) => {
            appliedEXGFiltersRef.current[channelIndex] = frequency; // Set the filter for the channel
        });
        forceEXGUpdate(); // Trigger re-render

    };
    // Function to remove the filter for all channels
    const removeEXGFilterFromAllChannels = (channels: number[]) => {
        channels.forEach((channelIndex) => {
            delete appliedEXGFiltersRef.current[channelIndex]; // Remove the filter for the channel
        });
        forceEXGUpdate(); // Trigger re-render

    };
    const removeNotchFilter = (channelIndex: number) => {
        delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
        forceUpdate(); // Trigger re-render
    };
    // Function to handle frequency selection
    const handleFrequencySelection = (channelIndex: number, frequency: number) => {
        appliedFiltersRef.current[channelIndex] = frequency; // Update the filter for the channel
        forceUpdate(); //Trigger re-render
    };

    // Function to set the same filter for all channels
    const applyFilterToAllChannels = (channels: number[], frequency: number) => {
        channels.forEach((channelIndex) => {
            appliedFiltersRef.current[channelIndex] = frequency; // Set the filter for the channel
        });
        forceUpdate(); // Trigger re-render
    };

    // Function to remove the filter for all channels
    const removeNotchFromAllChannels = (channels: number[]) => {
        channels.forEach((channelIndex) => {
            delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
        });
        forceUpdate(); // Trigger re-render
    };
    useEffect(() => {
        dataPointCountRef.current = (samplingrateref.current * timeBase);
    }, [timeBase]);
    const zoomRef = useRef(Zoom);

    useEffect(() => {
        zoomRef.current = Zoom;
    }, [Zoom]);

    const DEVICE_NAME = "ESP32_BLE_Device";
    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const DATA_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    const CONTROL_CHAR_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";
    const BATTERY_CHAR_UUID = "f633d0ec-46b4-43c1-a39f-1ca06d0602e1";  // Battery characteristic UUID

    const SINGLE_SAMPLE_LEN = deviceConfigRef.current.sampleLength; // Dynamic sample length
    const BLOCK_COUNT = 10; // 10 samples batched per notification
    const NEW_PACKET_LEN = SINGLE_SAMPLE_LEN * BLOCK_COUNT; // Dynamic packet length

    let prevSampleCounter: number | null = null;
    const samplesReceivedRef = useRef(0);
    let channelData: number[] = [];
    let envData: number[] = [];
    const notchFilters = Array.from(
        { length: maxCanvasElementCountRef.current },
        () => new Notch()
    );
    const EXGFilters = Array.from(
        { length: maxCanvasElementCountRef.current },
        () => new EXGFilter()
    );

    notchFilters.forEach((filter) => {
        filter.setbits(samplingrateref.current);
    });
    EXGFilters.forEach((filter) => {
        filter.setbits("12", samplingrateref.current);
    });

    function processSample(dataView: DataView): void {
        const config = deviceConfigRef.current;

        if (dataView.byteLength !== config.sampleLength) {
            return;
        }

        const sampleCounter = dataView.getUint8(0);// Counter at index 0
        if (prevSampleCounter === null) {
            prevSampleCounter = sampleCounter;
        } else {
            const expected = (prevSampleCounter + 1) % 256;
            if (sampleCounter !== expected) {
                console.log(`Missing sample: expected ${expected}, got ${sampleCounter}`);
            }
            prevSampleCounter = sampleCounter;
        }
        channelData.push(sampleCounter); 

        // Process all channels based on device configuration
        for (let channel = 0; channel < config.maxChannels; channel++) {
            const sample = dataView.getInt16(1 + (channel * 2), false);
            channelData.push(
                notchFilters[channel].process(
                    EXGFilters[channel].process(sample, appliedEXGFiltersRef.current[channel]),
                    appliedFiltersRef.current[channel]
                )
            );
        }

        // Initialize envelope filters if needed
        if (envelopeFilters.current.length === 0) {
            for (let i = 0; i < config.maxChannels; i++) {
                envelopeFilters.current.push(new EnvelopeFilter(64));
            }
        }

        // Calculate envelopes for ALL channels
        const envValues = [];
        // channelData[0] is counter, so channel data starts at index 1
        for (let i = 1; i <= config.maxChannels; i++) {
            envValues.push(envelopeFilters.current[i - 1].getEnvelope(Math.abs(channelData[i])));
        }

        updateData(channelData, envValues);
        setBandPowerData(envValues);
        channelData = [];
        envData = [];
        samplesReceivedRef.current += 1;
    }

    interface BluetoothRemoteGATTCharacteristicExtended extends EventTarget {
        value?: DataView;
    }
    class EnvelopeFilter {
        private circularBuffer: number[];
        private sum: number = 0;
        private dataIndex: number = 0;
        private readonly bufferSize: number;

        constructor(bufferSize: number) {
            this.bufferSize = bufferSize;
            this.circularBuffer = new Array(bufferSize).fill(0);
        }

        getEnvelope(absEmg: number): number {
            this.sum -= this.circularBuffer[this.dataIndex];
            this.sum += absEmg;
            this.circularBuffer[this.dataIndex] = absEmg;
            this.dataIndex = (this.dataIndex + 1) % this.bufferSize;
            return (this.sum / this.bufferSize);
        }
    }

    function handledata(event: Event): void {
        try {
            const target = event.target as BluetoothRemoteGATTCharacteristicExtended;
            if (!target.value) {
                console.log("Received event with no value.");
                return;
            }
            const config = deviceConfigRef.current;
            const value = target.value;
            const currentPacketLength = config.sampleLength * BLOCK_COUNT;

            if (value.byteLength === currentPacketLength) {
                for (let i = 0; i < currentPacketLength; i += config.sampleLength) {
                    const sampleBuffer = value.buffer.slice(i, i + config.sampleLength);
                    const sampleDataView = new DataView(sampleBuffer);
                    processSample(sampleDataView);
                }
            } else if (value.byteLength === config.sampleLength) {
                processSample(new DataView(value.buffer));
            } else {
                console.log("Unexpected packet length: " + value.byteLength);
            }
        } catch (error) {
            console.error("Error processing BLE data:", error);

        }
    }

    const batteryCharacteristicRef = useRef<any | null>(null); // Ref for battery characteristic
    const disconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);



    // Update the connectBLE function with the improved disconnect monitoring
    async function connectBLE(): Promise<void> {
        try {
            setIsLoading(true);
            const nav = navigator as any;
            if (!nav.bluetooth) {
                setIsLoading(false);
                toast("Web Bluetooth API is not available in your browser. Please use Chrome, Edge, or Opera.");
                return;
            }

            console.log("Requesting Bluetooth device...");
            const device = await nav.bluetooth.requestDevice({
                filters: [{ namePrefix: "NPG" }],
                optionalServices: [SERVICE_UUID],
            });

            // Update configuration based on device name
            updateDeviceConfiguration(device.name || "");

            console.log("Connecting to GATT Server...");
            const server = await device.gatt?.connect();
            if (!server) {
                console.log("Failed to connect to GATT Server.");
                return;
            }

            console.log("Getting Service...");
            const service = await server.getPrimaryService(SERVICE_UUID);

            console.log("Getting Control Characteristic...");
            const controlChar = await service.getCharacteristic(CONTROL_CHAR_UUID);
            console.log("Getting Data Characteristic...");
            const dataChar = await service.getCharacteristic(DATA_CHAR_UUID);

            // Try to get battery characteristic if device supports it
            if (deviceConfigRef.current.hasBattery) {
                try {
                    const batteryChar = await service.getCharacteristic(BATTERY_CHAR_UUID);
                    batteryCharacteristicRef.current = batteryChar;
                    await batteryChar.startNotifications();

                    batteryChar.addEventListener("characteristicvaluechanged", (event: any) => {
                        const target = event.target as BluetoothRemoteGATTCharacteristicExtended;
                        if (target.value && target.value.byteLength === 1) {
                            const batteryValue = target.value.getUint8(0);
                            setBatteryLevel(batteryValue);
                        }
                    });
                } catch (error) {
                    console.log("Battery characteristic not available:", error);
                }
            }

            console.log("Sending START command...");
            const encoder = new TextEncoder();
            await controlChar.writeValue(encoder.encode("START"));

            console.log("Starting notifications...");
            await dataChar.startNotifications();
            dataChar.addEventListener("characteristicvaluechanged", handledata);

            // Store the device globally for later disconnection
            connectedDeviceRef.current = device;

            setIsLoading(false);
            setIsConnected(true);

            console.log("Notifications started. Listening for data...");

            // Clear any existing interval first
            if (disconnectIntervalRef.current) {
                clearInterval(disconnectIntervalRef.current);
                disconnectIntervalRef.current = null;
            }

            // Create new interval for monitoring samples
            disconnectIntervalRef.current = setInterval(() => {
                if (samplesReceivedRef.current === 0) {
                    console.log("No samples received in 1 second, disconnecting...");
                    // Clear the interval before calling disconnect
                    if (disconnectIntervalRef.current) {
                        clearInterval(disconnectIntervalRef.current);
                        disconnectIntervalRef.current = null;
                    }
                    disconnect();
                }
                samplesReceivedRef.current = 0;
            }, 1000);
        } catch (error) {
            console.log("Error: " + (error instanceof Error ? error.message : error));
            setIsLoading(false);
        }
    }


    async function disconnect(): Promise<void> {
        try {
            setIsLoading(true); // Show loading while disconnecting

            // Clear the sample monitoring interval
            if (disconnectIntervalRef.current) {
                clearInterval(disconnectIntervalRef.current);
                disconnectIntervalRef.current = null;
            }

            if (!connectedDeviceRef.current) {
                console.log("No connected device to disconnect.");
                setIsLoading(false);
                setIsConnected(false);
                return;
            }

            const server = connectedDeviceRef.current.gatt;

            // Only try to cleanup if server exists and is connected
            if (server && server.connected) {
                try {
                    // Get the service
                    const service = await server.getPrimaryService(SERVICE_UUID);

                    // Stop data notifications
                    try {
                        const dataChar = await service.getCharacteristic(DATA_CHAR_UUID);
                        await dataChar.stopNotifications();
                        dataChar.removeEventListener("characteristicvaluechanged", handledata);
                    } catch (error) {
                        console.log("Error stopping data notifications:", error);
                    }

                    // Stop battery notifications if they exist
                    if (batteryCharacteristicRef.current) {
                        try {
                            await batteryCharacteristicRef.current.stopNotifications();
                            batteryCharacteristicRef.current = null;
                        } catch (error) {
                            console.log("Error stopping battery notifications:", error);
                        }
                    }

                    // Send stop command
                    try {
                        const controlChar = await service.getCharacteristic(CONTROL_CHAR_UUID);
                        const encoder = new TextEncoder();
                        await controlChar.writeValue(encoder.encode("STOP"));
                    } catch (error) {
                        console.log("Error sending STOP command:", error);
                    }

                    // Disconnect from device
                    server.disconnect();
                } catch (error) {
                    console.log("Error during service/characteristic access:", error);
                }
            }

            // Reset all states and refs - THIS SHOULD HAPPEN REGARDLESS OF CONNECTION STATE
            connectedDeviceRef.current = null;
            batteryCharacteristicRef.current = null;

            // Reset UI states
            setIsConnected(false);
            setBatteryLevel(null);
            setDeviceName("");

            // Reset device configuration to defaults
            deviceConfigRef.current = defaultConfig;
            setDeviceConfig(defaultConfig);

            // Reset sample tracking
            prevSampleCounter = null;
            channelData = [];
            envData = [];
            samplesReceivedRef.current = 0;

            // Clear lines and sweep positions
            linesRefs.current = [];
            sweepPositions.current = new Array(deviceConfig.maxChannels).fill(0);
            currentSweepPos.current = new Array(deviceConfig.maxChannels).fill(0);

            // Reset envelope filters
            envelopeFilters.current = [];

            // Clear any pending data in the graphs
            if (linesRefs.current.length > 0) {
                linesRefs.current.forEach((lineArray, i) => {
                    if (lineArray && lineArray[0] && lineArray[1]) {
                        try {
                            // Clear all points in the lines
                            for (let j = 0; j < NUM_POINTS; j++) {
                                lineArray[0].setY(j, NaN);
                                lineArray[1].setY(j, NaN);
                            }
                        } catch (error) {
                            console.log(`Error clearing line ${i}:`, error);
                        }
                    }
                });
            }

            // Reset band power data
            const emptyBandData = Array(deviceConfig.maxChannels).fill(0);
            setBandPowerData(emptyBandData);
            prevBandPowerData.current = emptyBandData;

            // Reset power buffer
            powerBuffer.current = bandNames.map(() => []);

            // Force re-render
            setRefreshKey(prev => prev + 1);

            setIsLoading(false);

            // Optional: Show success message
            toast.success("Device disconnected successfully");

        } catch (error) {
            console.log("Error during disconnection: " + (error instanceof Error ? error.message : error));

            // Even if there's an error, try to reset the state
            setIsConnected(false);
            connectedDeviceRef.current = null;
            batteryCharacteristicRef.current = null;
            setIsLoading(false);

            toast.error("Error during disconnection");
        }
    }

    // Add cleanup on component unmount
    useEffect(() => {
        return () => {
            // Clean up disconnect interval on unmount
            if (disconnectIntervalRef.current) {
                clearInterval(disconnectIntervalRef.current);
                disconnectIntervalRef.current = null;
            }

            // Disconnect device if component unmounts while connected
            if (connectedDeviceRef.current) {
                disconnect();
            }
        };
    }, []);

    // Function to get battery icon based on level
    const getBatteryIcon = (level: number | null) => {
        if (level === null) return <BatteryWarning size={30} />;

        if (level <= 10) return <Battery
            size={30}
            className="text-red-500 animate-blink"
        />;
        if (level <= 20.0 && level > 10.0) return <BatteryLow size={30} />;
        if (level <= 70.0 && level > 20.0) return <BatteryMedium size={30} />;
        if (level > 70) return <BatteryFull size={30} />;
        return <BatteryFull size={30} />;
    };

    // Function to get battery color based on level
    const getBatteryColor = (level: number | null) => {
        if (level === null) return "text-red-500";

        if (level <= 20.0 && level > 10.0) return "text-red-500";
        if (level <= 70.0 && level > 20.0) return "text-orange-500";
        if (level > 70) return "text-green-500";
        return "text-green-500";
    };

    // Battery notifications
    useEffect(() => {
        if (batteryLevel === null) return;

        let intervalId: number | undefined;

        // Handle battery level checks
        if (batteryLevel <= 10) {
            // Show immediate notification
            toast.error("Very low battery! Please recharge immediately.");

            // Set up interval to show notification every minute
            intervalId = window.setInterval(() => {
                toast.error("Very low battery! Please recharge immediately.");
            }, 60000); // 60000ms = 1 minute

        } else if (batteryLevel === 20) {
            toast.warning("Battery is low at " + batteryLevel + "%. Consider recharging soon.");
        } else if (batteryLevel === 70) {
            toast.success("Battery level is " + batteryLevel + "%.");
        } else if (batteryLevel === 99) {
            toast.success("Battery fully charged.");
        }

        // Cleanup function to clear interval when batteryLevel changes or component unmounts
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [batteryLevel]);

    return (
        <div className="flex flex-col h-screen m-0 p-0 bg-g">

            <div className="bg-highlight">
                <Navbar isDisplay={true} />
            </div>
            <div className="flex flex-row flex-1 overflow-auto  relative">
                {/* Left Panel */}
                <main className="w-2/3 m-3 relative flex  bg-highlight rounded-2xl ">

                    <div
                        ref={canvasContainerRef}
                        className="absolute inset-0  rounded-2xl "
                    />
                </main>


                {/* Right Panel */}
                <main className="w-1/3 m-3 relative flex overflow-hidden">
                    <div
                        ref={containerRef}
                        className="absolute inset-0  rounded-2xl"

                    >
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full"
                        />
                    </div>
                </main>
            </div>

            <div className="flex-none pb-1 flex items-center justify-center bg-g gap-3 z-10" >
                {/* Center-aligned buttons */}
                <div className="flex gap-3 items-center justify-center">
                    {/* Connection button with tooltip */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="flex items-center gap-1 py-2 px-4 rounded-xl font-semibold"
                                    onClick={() => (isConnected ? disconnect() : connectBLE())}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader size={17} className="animate-spin" />
                                            Connecting...
                                        </>
                                    ) : isConnected ? (
                                        <>
                                            Disconnect
                                            <CircleX size={17} />
                                        </>
                                    ) : (
                                        <>
                                            Connect
                                        </>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isConnected ? "Disconnect Device" : "Connect Device"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>


                    {/* filters */}
                    <Popover
                        open={isFilterPopoverOpen}
                        onOpenChange={setIsFilterPopoverOpen}
                    >
                        <PopoverTrigger asChild>
                            <Button
                                className="flex items-center justify-center px-3 py-2 select-none min-w-12 whitespace-nowrap rounded-xl"
                                disabled={!isDisplay}
                            >
                                Filter
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-50 p-4 mx-4 mb-2">
                            <div className="flex flex-col max-h-80 overflow-y-auto">
                                <div className="flex items-center pb-2 ">
                                    {/* Filter Name */}
                                    <div className="text-sm font-semibold w-12"><ReplaceAll size={20} /></div>
                                    {/* Buttons */}
                                    <div className="flex space-x-2">
                                        <div className="flex items-center border border-input rounded-xl mx-0 px-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeEXGFilterFromAllChannels(Array.from({ length: deviceConfig.maxChannels }, (_, i) => i))}
                                                className={`rounded-xl rounded-r-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === 0
                                                        ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                                        : "bg-white-500" // Active background
                                                    }`}
                                            >
                                                <CircleOff size={17} />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applyEXGFilterToAllChannels(Array.from({ length: deviceConfig.maxChannels }, (_, i) => i), 4)}
                                                className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === deviceConfig.maxChannels && Object.values(appliedEXGFiltersRef.current).every((value) => value === 4)
                                                        ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                                        : "bg-white-500" // Active background
                                                    }`}
                                            >
                                                <BicepsFlexed size={17} />
                                            </Button>
                                        </div>
                                        <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeNotchFromAllChannels(Array.from({ length: deviceConfig.maxChannels }, (_, i) => i))}
                                                className={`rounded-xl rounded-r-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === 0
                                                        ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                                        : "bg-white-500" // Active background
                                                    }`}
                                            >
                                                <CircleOff size={17} />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applyFilterToAllChannels(Array.from({ length: deviceConfig.maxChannels }, (_, i) => i), 1)}
                                                className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === deviceConfig.maxChannels && Object.values(appliedFiltersRef.current).every((value) => value === 1)
                                                        ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                                        : "bg-white-500" // Active background
                                                    }`}
                                            >
                                                50Hz
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applyFilterToAllChannels(Array.from({ length: deviceConfig.maxChannels }, (_, i) => i), 2)}
                                                className={`rounded-xl rounded-l-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === deviceConfig.maxChannels && Object.values(appliedFiltersRef.current).every((value) => value === 2)
                                                        ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                                        : "bg-white-500" // Active background
                                                    }`}
                                            >
                                                60Hz
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    {channelNames.map((filterName, index) => (
                                        <div key={filterName} className="flex items-center">
                                            {/* Filter Name */}
                                            <div className="text-sm font-semibold w-12">{filterName}</div>
                                            {/* Buttons */}
                                            <div className="flex space-x-2">
                                                <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeEXGFilter(index)}
                                                        className={`rounded-xl rounded-r-none border-l-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === undefined
                                                                ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                                                : "bg-white-500" // Active background
                                                            }`}
                                                    >
                                                        <CircleOff size={17} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleFrequencySelectionEXG(index, 4)}
                                                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === 4
                                                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                                                : "bg-white-500" // Active background
                                                            }`}
                                                    >
                                                        <BicepsFlexed size={17} />
                                                    </Button>

                                                </div>
                                                <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeNotchFilter(index)}
                                                        className={`rounded-xl rounded-r-none border-0
                                                        ${appliedFiltersRef.current[index] === undefined
                                                                ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                                                : "bg-white-500" // Active background
                                                            }`}
                                                    >
                                                        <CircleOff size={17} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleFrequencySelection(index, 1)}
                                                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                        ${appliedFiltersRef.current[index] === 1
                                                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                                                : "bg-white-500" // Active background
                                                            }`}
                                                    >
                                                        50Hz
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleFrequencySelection(index, 2)}
                                                        className={
                                                            `rounded-xl rounded-l-none border-0 ${appliedFiltersRef.current[index] === 2
                                                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white "
                                                                : "bg-white-500 animate-fade-in-right"
                                                            }`
                                                        }
                                                    >
                                                        60Hz
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Battery display when connected */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                className={
                                    `flex items-center justify-center select-none whitespace-nowrap rounded-lg ${getBatteryColor(batteryLevel)}`
                                }
                            >
                                {getBatteryIcon(batteryLevel)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-fit p-2 mb-2 rounded-md shadow-md text-sm">
                            {!isConnected ? (
                                <div className=" ">
                                    <p className="text-lg font-semibold">Device Not Connected!</p>
                                    <p className="text-sm">Please connect your device to view battery status.</p>
                                </div>
                            ) : (
                                <>
                                    {isOldfirmwareRef.current ? (
                                        <div className="mb-2 p-2">
                                            <p className="text-lg font-semibold">Old Firmware Detected</p>
                                            <p className="text-sm">
                                                Update firmware using <a
                                                    className="font-semibold text-blue-600 hover:underline"
                                                    href="https://upsidedownlabs.github.io/NPG-Lite-Flasher-Web"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    NPG Lite Flasher
                                                </a>.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {batteryLevel === null ? (
                                                <div className="p-1">
                                                    <p className="text-sm font-semibold"></p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col space-y-2">
                                                    <div className="flex items-center space-x-2">
                                                        {getBatteryIcon(batteryLevel)}
                                                        <span className="font-semibold">{batteryLevel}%</span>
                                                    </div>

                                                    {batteryLevel < 10 && (
                                                        <span className="text-sm text-red-500 animate-blink">
                                                            Low Battery
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );

}

export default MuscleStrength;