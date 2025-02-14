"use client";

import { useEffect, useState, useRef } from "react";
import { WebglPlot, WebglLine, ColorRGBA } from "webgl-plot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
    const [showSeparate, setShowSeparate] = useState(true);
    const [zoomFactor, setZoomFactor] = useState(1);
    const rawDataRef = useRef<HTMLDivElement | null>(null);
    const maxPoints = 100;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wglpRef = useRef<WebglPlot | null>(null);
    const linesRef = useRef<WebglLine[]>([]);
    const separateCanvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(maxChannels).fill(null));
    const separateWglpRefs = useRef<(WebglPlot | null)[]>(Array(maxChannels).fill(null));
    const separateLinesRefs = useRef<(WebglLine | null)[]>(Array(maxChannels).fill(null));
    const [showCommandInput, setShowCommandInput] = useState(false);
    const [command, setCommand] = useState("");
    const [boardName, setBoardName] = useState<string | null>(null);
    const [baudRate, setBaudRate] = useState(115200); // Default baud rate

    useEffect(() => {
        if (rawDataRef.current) {
            rawDataRef.current.scrollTop = rawDataRef.current.scrollHeight;
        }
    }, [rawData]);

    const maxRawDataLines = 1000; // Limit for raw data lines

    // ✅ RE-INITIALIZE WebGL when `selectedChannels` updates
    useEffect(() => {
        if (!canvasRef.current || selectedChannels.length === 0) return;

        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const wglp = new WebglPlot(canvas);
        wglpRef.current = wglp;

        // Clear old lines
        linesRef.current = [];

        selectedChannels.forEach((_, i) => {
            const line = new WebglLine(getLineColor(i), maxPoints);
            line.lineSpaceX(-1, 2 / maxPoints);
            wglp.addLine(line);
            linesRef.current.push(line);
        });

        wglp.update();
    }, [selectedChannels]); // ✅ Runs when channels are detected

    useEffect(() => {
        if (!canvasRef.current) return;

        if (!showCombined) {
            wglpRef.current = null; // Reset the WebGL plot reference when hiding
            return;
        }

        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const wglp = new WebglPlot(canvas);
        wglpRef.current = wglp;

        // Clear and re-add lines
        linesRef.current = [];

        selectedChannels.forEach((_, i) => {
            const line = new WebglLine(getLineColor(i), maxPoints);
            line.lineSpaceX(-1, 2 / maxPoints);
            wglp.addLine(line);
            linesRef.current.push(line);
        });

        wglp.update();
    }, [selectedChannels, showCombined]);

    const getLineColor = (index: number): ColorRGBA => {
        const hex = channelColors[index % channelColors.length];
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return new ColorRGBA(r, g, b, 1);
    };

    const connectToSerial = async () => {
        try {
            const ports = await (navigator as any).serial.getPorts();
            let selectedPort = ports.length > 0 ? ports[0] : null;

            if (!selectedPort) {
                selectedPort = await (navigator as any).serial.requestPort();
            }

            await selectedPort.open({ baudRate }); // Use selected baud rate
            setPort(selectedPort);
            setIsConnected(true);

            wglpRef.current = null;
            linesRef.current = [];
            setData([]);
            setSelectedChannels([]);

            readSerialData(selectedPort);
        } catch (err) {
            console.error("Error connecting to serial:", err);
        }
    };

    const readSerialData = async (serialPort: SerialPort) => {
        try {
            const serialReader = serialPort.readable?.getReader();
            if (!serialReader) return;
            setReader(serialReader);

            let buffer = "";
            let receivedData = false;

            // Timeout: If no data in 3 sec, show command input
            setTimeout(() => {
                if (!receivedData) {
                    setShowCommandInput(true);
                }
            }, 3000);

            while (true) {
                const { value, done } = await serialReader.read();
                if (done) break;
                if (value) {
                    receivedData = true;
                    setShowCommandInput(false);

                    buffer += new TextDecoder().decode(value);
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // Store incomplete line for next read

                    let newData: DataPoint[] = [];
                    lines.forEach((line) => {
                        setRawData((prev) => {
                            const newRawData = prev.split("\n").concat(line.trim().replace(/\s+/g, " "));
                            return newRawData.slice(-maxRawDataLines).join("\n");
                        });

                        // Detect Board Name
                        if (line.includes("BOARD:")) {
                            setBoardName(line.split(":")[1].trim());
                            setShowCommandInput(true);
                        }

                        // Convert to numeric data
                        const values = line.trim().split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
                        if (values.length > 0) {
                            newData.push({ time: Date.now(), values });

                            // ✅ Ensure `selectedChannels` updates before plotting
                            setSelectedChannels((prevChannels) => {
                                if (prevChannels.length !== values.length) {
                                    return Array.from({ length: values.length }, (_, i) => i);
                                }
                                return prevChannels;
                            });
                        }
                    });

                    if (newData.length > 0) {
                        updateWebGLPlot(newData);
                        setData((prev) => [...prev, ...newData].slice(-maxPoints));
                    }
                }
            }
            serialReader.releaseLock();
        } catch (err) {
            console.error("Error reading serial data:", err);
        }
    };
    // ✅ RE-INITIALIZE WebGL when `selectedChannels` updates
    useEffect(() => {
        if (!canvasRef.current || selectedChannels.length === 0) return;

        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const wglp = new WebglPlot(canvas);
        wglpRef.current = wglp;

        // Clear old lines
        linesRef.current = [];

        selectedChannels.forEach((_, i) => {
            const line = new WebglLine(getLineColor(i), maxPoints);
            line.lineSpaceX(-1, 2 / maxPoints);
            wglp.addLine(line);
            linesRef.current.push(line);
        });

        wglp.update();
    }, [selectedChannels]); // ✅ Runs when channels are detected


    useEffect(() => {
        let isMounted = true;

        const animate = () => {
            if (!isMounted) return;
            requestAnimationFrame(animate);
            requestAnimationFrame(() => {
                if (wglpRef.current) {
                    wglpRef.current.update();
                }
            });
        };

        requestAnimationFrame(animate); // Ensure continuous updates

        return () => {
            isMounted = false;
        };
    }, []);


    useEffect(() => {
        const checkPortStatus = async () => {
            if (port) {
                try {
                    await port.getInfo(); // This may throw an error if the device is disconnected
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


    const updateWebGLPlot = (newData: DataPoint[]) => {
        if (!wglpRef.current || linesRef.current.length === 0 || newData.length === 0) return;

        // Calculate Y-axis min and max values
        const yMin = Math.min(...newData.flatMap(dp => dp.values));
        const yMax = Math.max(...newData.flatMap(dp => dp.values));
        const yRange = yMax - yMin || 1; // Avoid division by zero

        // Iterate over new data points and update plots
        newData.forEach((dataPoint) => {
            selectedChannels.forEach((index) => {
                if (index >= dataPoint.values.length) return; // Prevent out-of-bounds errors

                const yValue = ((dataPoint.values[index] - yMin) / yRange) * 2 - 1;

                // Update combined plot
                const combinedLine = linesRef.current[index];
                if (combinedLine) {
                    combinedLine.shiftAdd(new Float32Array([yValue]));
                }

                // Update separate plots
                const separatePlot = separateWglpRefs.current[index];
                const separateLine = separateLinesRefs.current[index];
                if (separatePlot && separateLine) {
                    separateLine.shiftAdd(new Float32Array([yValue]));
                    separatePlot.update();
                }
            });
        });

        // Efficiently trigger a render update
        requestAnimationFrame(() => {
            if (wglpRef.current) wglpRef.current.update();
        });
    };



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

        setIsConnected(false);

        // Clear WebGL Plot
        if (wglpRef.current) {
            wglpRef.current.clear();
            wglpRef.current = null;
        }
        linesRef.current = [];
        setData([]);
    };


    const sendCommand = async () => {
        if (!port?.writable || !command.trim()) return;

        try {
            const writer = port.writable.getWriter(); // Get writer
            await writer.write(new TextEncoder().encode(command + "\n"));
            writer.releaseLock(); // Release writer after writing

        } catch (err) {
            console.error("Error sending command:", err);
        }
    };

    return (
        <div className="w-full mx-auto border rounded-2xl shadow-xl flex flex-col gap-4 h-screen">
            <h1 className="text-2xl font-bold text-center">Chords Serial Plotter & Monitor</h1>

            <div className="flex justify-center flex-wrap gap-2">
                <Button onClick={connectToSerial} disabled={isConnected} className="px-4 py-2 text-sm font-semibold">
                    {isConnected ? "Connected" : "Connect Serial"}
                </Button>
                <Button onClick={disconnectSerial} disabled={!isConnected} className="px-4 py-2 text-sm font-semibold">
                    Disconnect
                </Button>
            </div>

            {/* Zoom Control */}
            <div className="w-full flex justify-center items-center ">
                <label className="mr-2 text-sm">Zoom:</label>
                <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={zoomFactor}
                    className="w-1/3"
                    onChange={(e) => {
                        const newZoom = parseFloat(e.target.value);
                        setZoomFactor(newZoom);
                        linesRef.current.forEach((line) => {
                            if (line) line.scaleY = newZoom;
                        });
                        separateLinesRefs.current.forEach((line) => {
                            if (line) line.scaleY = newZoom;
                        });
                        wglpRef.current?.update();
                        separateWglpRefs.current.forEach((wglp) => wglp?.update());
                    }}
                />
                <span className="ml-2 text-sm">{zoomFactor.toFixed(1)}x</span>
            </div>

            {/* Graph Container */}
            <div className="w-full h-[500px] flex flex-col gap-2">
                {/* Combined Canvas */}
                {showCombined && (
                    <div className="border rounded-xl shadow-lg bg-[#1a1a2e] p-2 w-full h-full flex flex-col">
                        <h2 className="text-sm font-semibold text-center mb-1 text-white">Combined Plot</h2>
                        <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
                    </div>
                )}
            </div>

            {/* Raw Data Output / Command Input */}
            {/* Raw Data Output / Command Input */}
            <div ref={rawDataRef} className="w-full border rounded-xl shadow-lg bg-[#1a1a2e] text-white overflow-auto min-h-[160px] relative">

                {/* Sticky Top-right Controls */}
                <div className="sticky top-0 right-0 flex items-center justify-end space-x-2 bg-[#1a1a2e] p-2 z-10">
                    {/* Baud Rate Selector */}
                    <div className="flex items-center space-x-2">
                        <label className="text-xs font-semibold">Baud Rate:</label>
                        <select
                            value={baudRate}
                            onChange={(e) => setBaudRate(Number(e.target.value))}
                            className="p-1 border rounded bg-gray-800 text-white text-xs"
                        >
                            {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
                                <option key={rate} value={rate}>
                                    {rate}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clear Data Button */}
                    <button
                        onClick={() => setRawData("")}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded shadow-md hover:bg-red-700 transition"
                    >
                        Clear
                    </button>
                </div>

                {/* Title */}
                <h2 className="text-sm font-semibold text-center mb-4">
                    {boardName ? `Connected to: ${boardName}` : "Raw Data Output"}
                </h2>

                {/* Command Input or Raw Data */}
                {showCommandInput ? (
                    <div className="flex items-center space-x-1 p-1">
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder="Enter command (WHORU, START)"
                            className="w-full p-1 rounded bg-gray-800 text-white border border-gray-600 text-xs"
                        />
                        <Button onClick={sendCommand} className="px-2 py-1 text-xs font-semibold">Send</Button>
                    </div>
                ) : (
                    <pre className="text-xs whitespace-pre-wrap break-words px-4 pb-4">{rawData}</pre>
                )}
            </div>


        </div>

    );
};

export default SerialPlotter;