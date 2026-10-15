"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { WebglPlot, WebglLine, ColorRGBA } from "webgl-plot";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { toast } from "@/lib/toast";

interface DataPoint {
    time: number;
    values: number[];
}

const channelColors = ["#F5A3B1", "#86D3ED", "#7CD6C8", "#C2B4E2", "#48d967", "#FFFF8C"];

const SerialPlotter = () => {
    const maxChannels = 0;
    const [data, setData] = useState<DataPoint[]>([]);
    const [port, setPort] = useState<SerialPort | null>(null);
    const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [rawData, setRawData] = useState<string>("");
    const [selectedChannels, setSelectedChannels] = useState<number[]>(Array.from({ length: maxChannels }, (_, i) => i));
    const [showCombined, setShowCombined] = useState(true);
    const [showPlotterData, setShowPlotterData] = useState(false);
    const selectedChannelsRef = useRef<number[]>([]);
    const rawDataRef = useRef<HTMLDivElement | null>(null);
    const maxPoints = 1000;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wglpRef = useRef<WebglPlot | null>(null);
    const linesRef = useRef<WebglLine[]>([]);
    const [showCommandInput, setShowCommandInput] = useState(false);
    const [command, setCommand] = useState("");
    const [boardName, setBoardName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"monitor" | "plotter" | "both">("both");
    const baudRateref = useRef<number>(115200);
    const bitsref = useRef<number>(10);
    const channelsref = useRef<number>(1);

    // Sweep positions per channel — starts at 0 (left edge)
    const sweepPositions = useRef<number[]>(new Array(6).fill(0));

    // Rolling autoscale: tracks global min/max across all received data
    const yRangeRef = useRef<{ min: number; max: number }>({ min: Infinity, max: -Infinity });

    const SYNC_BYTE_1 = 0xC7;
    const SYNC_BYTE_2 = 0x7C;
    const blockSize = 9;
    const maxSamples = 256;

    const plotDataRef = useRef<{ ch0: number[]; ch1: number[]; ch2: number[] }>({ ch0: [], ch1: [], ch2: [] });

    const maxRawDataLines = 1000;

    // Auto-scroll monitor to bottom
    useEffect(() => {
        if (rawDataRef.current) {
            rawDataRef.current.scrollTop = rawDataRef.current.scrollHeight;
        }
    }, [rawData]);

    function testWebGLShaderSupport(gl: WebGLRenderingContext) {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) {
            console.warn("Failed to create vertex shader");
            return false;
        }
        gl.shaderSource(vertexShader, "attribute vec4 position; void main() { gl_Position = position; }");
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.warn("WebGL shader compilation failed:", gl.getShaderInfoLog(vertexShader));
            return false;
        }
        return true;
    }

    // Shared helper — builds WebGL lines fresh, resets sweep to left
    const buildLines = (canvas: HTMLCanvasElement, channels: number[]) => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const wglp = new WebglPlot(canvas);
        wglpRef.current = wglp;
        linesRef.current = [];
        sweepPositions.current = new Array(6).fill(0); // always reset sweep to left edge

        channels.forEach((_, i) => {
            const line = new WebglLine(getLineColor(i), maxPoints);
            line.lineSpaceX(-1, 2 / maxPoints); // left→right: index 0 = left, maxPoints-1 = right
            wglp.addLine(line);
            linesRef.current.push(line);
        });

        wglp.update();
    };

    // Recreate lines when channel count changes
    useEffect(() => {
        if (!canvasRef.current || selectedChannels.length === 0) return;

        const canvas = canvasRef.current;
        const gl = canvas.getContext("webgl");
        if (!gl || !testWebGLShaderSupport(gl)) {
            console.warn("WebGL shader support check failed.");
            return;
        }

        buildLines(canvas, selectedChannels);
    }, [selectedChannels]);

    // Recreate lines when view mode or plotter visibility changes.
    // NOTE: `data` is intentionally NOT in deps — we never replay history into the sweep.
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;

        if ((viewMode === "both" || viewMode === "plotter") && showPlotterData) {
            buildLines(canvas, selectedChannels);
        } else {
            wglpRef.current = null;
        }
    }, [selectedChannels, showCombined, viewMode, showPlotterData]);

    const getLineColor = (index: number): ColorRGBA => {
        const hex = channelColors[index % channelColors.length];
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return new ColorRGBA(r, g, b, 1);
    };

    // Called with ONLY newly arrived data points — never historical data.
    // Uses rolling yRangeRef for stable autoscaling that never jumps per-batch.
    const updateWebGLPlot = (newData: DataPoint[]) => {
        if (!wglpRef.current || linesRef.current.length === 0 || newData.length === 0) return;

        // Use rolling global min/max — stable across all batches
        const yMin = yRangeRef.current.min === Infinity ? 0 : yRangeRef.current.min;
        const yMax = yRangeRef.current.max === -Infinity ? 1 : yRangeRef.current.max;
        const yRange = yMax - yMin || 1;

        newData.forEach((dataPoint) => {
            linesRef.current.forEach((line, i) => {
                if (i >= dataPoint.values.length) return;

                const yValue = Math.max(-1, Math.min(1, ((dataPoint.values[i] - yMin) / yRange) * 2 - 1));

                if (sweepPositions.current[i] === undefined) {
                    sweepPositions.current[i] = 0;
                }

                const currentPos = sweepPositions.current[i];

                // Write new data point at sweep position
                line.setY(currentPos, yValue);

                // Erase head: blank next ~1% of points ahead so overlap boundary is visible
                const eraseCount = Math.max(1, Math.floor(line.numPoints / 100));
                for (let e = 1; e <= eraseCount; e++) {
                    const erasePos = (currentPos + e) % line.numPoints;
                    line.setY(erasePos, NaN);
                }

                // Advance sweep left→right, wrap back to 0 after maxPoints
                sweepPositions.current[i] = (currentPos + 1) % line.numPoints;
            });
        });

        requestAnimationFrame(() => {
            if (wglpRef.current) wglpRef.current.update();
        });
    };

    const connectToSerial = useCallback(async () => {
        try {
            const ports = await (navigator as any).serial.getPorts();
            let selectedPort = ports.length > 0 ? ports[0] : null;

            if (!selectedPort) {
                selectedPort = await (navigator as any).serial.requestPort();
            }

            await selectedPort.open({ baudRate: baudRateref.current });
            setRawData("");
            setData([]);
            setPort(selectedPort);
            setIsConnected(true);
            wglpRef.current = null;
            linesRef.current = [];
            selectedChannelsRef.current = [];
            sweepPositions.current = new Array(6).fill(0);
            yRangeRef.current = { min: Infinity, max: -Infinity }; // reset autoscale on connect

            readSerialData(selectedPort);
            setShowPlotterData(true);
        } catch (err) {
            console.warn("Error connecting to serial:", err);
        }
    }, [baudRateref.current, setPort, setIsConnected, setRawData, wglpRef, linesRef]);

    const readSerialData = async (serialPort: SerialPort) => {
        const READ_TIMEOUT = 5000;
        const BATCH_SIZE = 10;

        try {
            const serialReader = serialPort.readable?.getReader();
            if (!serialReader) return;
            setReader(serialReader);

            let buffer = "";
            let receivedData = false;

            const timeoutId = setTimeout(() => {
                if (!receivedData) {
                    setShowCommandInput(true);
                    console.warn("No data received within timeout period");
                }
            }, READ_TIMEOUT);

            while (true) {
                try {
                    const readPromise = serialReader.read();
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Read timeout")), READ_TIMEOUT)
                    );

                    const { value, done } = await Promise.race([readPromise, timeoutPromise]);
                    if (done) break;
                    if (value) {
                        receivedData = true;
                        setShowCommandInput(false);

                        const decoder = new TextDecoder();
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        let newData: DataPoint[] = [];

                        for (let i = 0; i < lines.length; i += BATCH_SIZE) {
                            const batch = lines.slice(i, i + BATCH_SIZE);
                            batch.forEach((line) => {
                                setRawData((prev) => {
                                    const newRawData = prev.split("\n").concat(line.trim().replace(/\s+/g, " "));
                                    return newRawData.slice(-maxRawDataLines).join("\n");
                                });

                                if (line.includes("BOARD:")) {
                                    setBoardName(line.split(":")[1].trim());
                                    setShowCommandInput(true);
                                }

                                const values = line.trim().split(",").map(parseFloat).filter((v) => !isNaN(v));
                                if (values.length > 0) {
                                    newData.push({ time: Date.now(), values });
                                    channelsref.current = values.length;

                                    setSelectedChannels((prevChannels) => {
                                        return prevChannels.length !== values.length
                                            ? Array.from({ length: values.length }, (_, i) => i)
                                            : prevChannels;
                                    });
                                }
                            });
                        }

                        if (newData.length > 0) {
                            // Update rolling autoscale min/max from incoming data only
                            newData.forEach(dp => {
                                dp.values.forEach(v => {
                                    if (v < yRangeRef.current.min) yRangeRef.current.min = v;
                                    if (v > yRangeRef.current.max) yRangeRef.current.max = v;
                                });
                            });

                            // Store history for monitor display
                            setData((prev) => [...prev, ...newData].slice(-maxPoints));

                            // Feed ONLY new points into sweep — never full history
                            updateWebGLPlot(newData);
                        }
                    }
                } catch (error) {
                    console.warn("Error reading serial data chunk:", error);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
            }

            clearTimeout(timeoutId);
            serialReader.releaseLock();
        } catch (err) {
            console.warn("Error reading serial data:", err);

            setTimeout(() => {
                if (isConnected) {
                    toast.message("Attempting to reconnect...");
                    connectToSerial();
                }
            }, 5000);
        }
    };

    // Animation loop
    useEffect(() => {
        let isMounted = true;
        let animationFrameId: number;

        const animate = () => {
            if (!isMounted) return;
            if (wglpRef.current) {
                wglpRef.current.update();
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            isMounted = false;
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Port disconnect detection
    useEffect(() => {
        const checkPortStatus = async () => {
            if (port) {
                try {
                    await port.getInfo();
                } catch {
                    setIsConnected(false);
                    setPort(null);
                    console.warn("Serial device disconnected.");
                }
            }
        };

        const interval = setInterval(checkPortStatus, 3000);
        return () => clearInterval(interval);
    }, [port]);

    const disconnectSerial = async () => {
        if (reader) {
            await reader.cancel();
            reader.releaseLock();
            setReader(null);
        }
        if (port) {
            await port.close();
            setPort(null);
        }
        setData([]);
        setIsConnected(false);
        setShowPlotterData(false);

        if (wglpRef.current) {
            wglpRef.current.clear();
            wglpRef.current = null;
        }
        linesRef.current = [];
        sweepPositions.current = new Array(6).fill(0);
        yRangeRef.current = { min: Infinity, max: -Infinity }; // reset autoscale on disconnect
        setData([]);
    };

    const handleBaudRateChange = async (newBaudRate: number) => {
        if (isConnected && port) {
            await disconnectSerial();
        }
        baudRateref.current = newBaudRate;
        setTimeout(() => {
            connectToSerial();
        }, 500);
    };

    const sendCommand = async () => {
        if (!port?.writable || !command.trim()) return;

        try {
            const writer = port.writable.getWriter();
            await writer.write(new TextEncoder().encode(command + "\n"));
            writer.releaseLock();
        } catch (err) {
            console.warn("Error sending command:", err);
        }
    };

    return (
        <div className="w-full h-screen mx-auto border rounded-2xl shadow-xl flex flex-col gap- overflow-hidden px-4">
            <Navbar />

            <div className="w-full flex flex-col gap-2 flex-grow overflow-hidden">

                {/* Plotter */}
                {viewMode !== "monitor" && (
                    <div className="w-full flex flex-col flex-grow min-h-[40vh]">
                        <div className="border rounded-xl shadow-lg bg-[#1a1a2e] p-2 w-full h-full flex flex-col">
                            <div className="canvas-container w-full h-full flex items-center justify-center overflow-hidden">
                                <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Monitor */}
                {viewMode !== "plotter" && (
                    <div
                        ref={rawDataRef}
                        className="w-full border rounded-xl shadow-lg bg-[#1a1a2e] text-white overflow-auto flex flex-col"
                        style={{
                            height: viewMode === "monitor" ? "calc(100vh - 100px)" : "35vh",
                            maxHeight: viewMode === "monitor" ? "calc(100vh - 100px)" : "35vh",
                            minHeight: "35vh",
                        }}
                    >
                        <div className="sticky top-0 flex items-center justify-between bg-[#1a1a2e] p-2 z-10">
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        sendCommand();
                                    }
                                }}
                                placeholder="Enter command"
                                className="w-full p-2 text-xs font-semibold rounded bg-gray-800 text-white border border-gray-600"
                                style={{ height: "36px" }}
                            />
                            <div className="flex items-center space-x-2 mr-auto">
                                <Button
                                    onClick={sendCommand}
                                    className="px-4 py-2 text-xs font-semibold bg-gray-500 rounded shadow-md hover:bg-gray-500 transition ml-2"
                                    style={{ height: "36px" }}
                                >
                                    Send
                                </Button>
                                <button
                                    onClick={() => setRawData("")}
                                    className="px-4 py-2 text-xs bg-red-600 text-white rounded shadow-md hover:bg-red-700 transition"
                                    style={{ height: "36px" }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <pre className="text-xs whitespace-pre-wrap break-words px-4 pb-4 flex-grow overflow-auto rounded-xl">
                            {rawData}
                        </pre>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="flex flex-col gap-2 sm:flex-row py-2 m-2 w-full shrink-0 items-center justify-center px-2 md:px-4">

                <div className="flex justify-center">
                    <Button
                        onClick={isConnected ? disconnectSerial : connectToSerial}
                        className="px-4 py-2 text-sm font-semibold transition rounded-xl"
                    >
                        {isConnected ? "Disconnect" : "Connect"}
                    </Button>
                </div>

                <div className="flex items-center gap-0.5 mx-0 px-0">
                    {(["monitor", "plotter", "both"] as const).map((mode, index, arr) => (
                        <Button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-2 text-sm transition font-semibold
                                ${viewMode === mode
                                    ? "bg-primary text-white dark:text-gray-900 shadow-md"
                                    : "bg-gray-500 text-gray-900 hover:bg-gray-300"}
                                ${index === 0 ? "rounded-xl rounded-r-none" : ""}
                                ${index === arr.length - 1 ? "rounded-xl rounded-l-none" : ""}
                                ${index !== 0 && index !== arr.length - 1 ? "rounded-none" : ""}`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Button>
                    ))}
                </div>

                <div className="flex items-center space-x-2">
                    <label className="text-sm font-semibold">Baud Rate:</label>
                    <select
                        value={baudRateref.current}
                        onChange={(e) => handleBaudRateChange(Number(e.target.value))}
                        className="p-1 border rounded bg-gray-800 text-white text-sm"
                    >
                        {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
                            <option key={rate} value={rate}>{rate}</option>
                        ))}
                    </select>
                </div>
            </footer>
        </div>
    );
};

export default SerialPlotter;