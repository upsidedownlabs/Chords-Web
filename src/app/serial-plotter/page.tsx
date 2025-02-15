"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { WebglPlot, WebglLine, ColorRGBA } from "webgl-plot";
import { Button } from "@/components/ui/button";

interface DataPoint {
    values: number[];
}

const channelColors = ["#F5A3B1", "#86D3ED", "#7CD6C8", "#C2B4E2", "#48d967", "#FFFF8C"];

const SerialPlotter = () => {
    const [port, setPort] = useState<SerialPort | null>(null);
    const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [rawData, setRawData] = useState<string>("");
    const selectedChannelsRef = useRef<number[]>([]);
    const [showCombined, setShowCombined] = useState(true);
    const rawDataRef = useRef<HTMLDivElement | null>(null);
    const maxPoints = 1000;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wglpRef = useRef<WebglPlot | null>(null);
    const linesRef = useRef<WebglLine[]>([]);
    const [showCommandInput, setShowCommandInput] = useState(false);
    const [command, setCommand] = useState("");
    const [boardName, setBoardName] = useState<string | null>(null);
    const baudRateref = useRef<number>(115200);
    const bitsref = useRef<number>(10);

    useEffect(() => {
        if (rawDataRef.current) {
            rawDataRef.current.scrollTop = rawDataRef.current.scrollHeight;
        }
    }, [rawData]);

    const maxRawDataLines = 1000; // Limit for raw data lines

    const getLineColor = (index: number): ColorRGBA => {
        const hex = channelColors[index % channelColors.length];
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return new ColorRGBA(r, g, b, 1);
    };

    const connectToSerial = useCallback(async () => {
        try {
            const ports = await (navigator as any).serial.getPorts();
            let selectedPort = ports.length > 0 ? ports[0] : null;

            if (!selectedPort) {
                selectedPort = await (navigator as any).serial.requestPort();
            }

            await selectedPort.open({ baudRate: baudRateref.current });
            setPort(selectedPort);
            setIsConnected(true);
            setRawData("");
            wglpRef.current = null;
            linesRef.current = [];
            selectedChannelsRef.current = [];
            readSerialData(selectedPort);
        } catch (err) {
            console.error("Error connecting to serial:", err);
        }
    }, [ baudRateref.current, setPort, setIsConnected, setRawData, wglpRef, linesRef]);

    const readSerialData = async (serialPort: SerialPort) => {
        try {
            const serialReader = serialPort.readable?.getReader();
            if (!serialReader) return;
            setReader(serialReader);

            let buffer = "";
            let receivedData = false;
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
                            newData.push({ values });
                            updateWebGLPlot(values);
                            // ✅ Ensure `selectedChannels` updates before plotting
                            if (selectedChannelsRef.current.length !== values.length) {
                                selectedChannelsRef.current = Array.from({ length: values.length }, (_, i) => i);
                                createCanvas();
                            }
                            updateWebGLPlot(values);

                        }

                    });

                }
            }
            serialReader.releaseLock();
        } catch (err) {
            console.error("Error reading serial data:", err);
        }
    };


    const createCanvas = () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const wglp = new WebglPlot(canvas);
        wglpRef.current = wglp;

        // Clear and re-add lines
        linesRef.current = [];

        selectedChannelsRef.current.forEach((_, i) => {
            const line = new WebglLine(getLineColor(i), maxPoints);
            line.lineSpaceX(-1, 2 / maxPoints);
            wglp.addLine(line);
            linesRef.current.push(line);
        });

        wglp.update();
    };

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


    const updateWebGLPlot = useCallback((newData: number[]) => {
        if (!wglpRef.current || linesRef.current.length === 0) return;

        const bitsPoints = Math.pow(2, bitsref.current);
        const yScale = 2 / bitsPoints;

        // Update each channel with one new data point
        selectedChannelsRef.current.forEach((index) => {
            if (newData[index] !== undefined) {
                const yValue = ((newData[index] - bitsPoints / 2) * yScale);
                linesRef.current[index]?.shiftAdd(new Float32Array([yValue]));
            }
        });
    }, [bitsref.current, selectedChannelsRef.current]);




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
    };
    

    const handleBaudRateChange = async (newBaudRate: number) => {
        if (isConnected && port) {
            await disconnectSerial(); // Disconnect current connection
        }
        baudRateref.current =newBaudRate;
        setTimeout(() => {
            connectToSerial(); // Reconnect with the new baud rate
        }, 500);
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
        <div className="w-full h-screen mx-auto border rounded-2xl shadow-xl flex flex-col gap-4 overflow-hidden p-4">
            <h1 className="text-2xl font-bold text-center">Chords Serial Plotter & Monitor</h1>

            {/* Graph Container - Dynamic Height */}
            <div className="w-full flex-grow flex flex-col gap-2">
                {showCombined && (
                    <div className="border rounded-xl shadow-lg bg-[#1a1a2e] p-2 w-full h-full flex flex-col">
                        <h2 className="text-sm font-semibold text-center mb-1 text-white">Combined Plot</h2>
                        <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
                    </div>
                )}
            </div>

            {/* Raw Data Output / Command Input - Responsive Height */}
            <div ref={rawDataRef} className="w-full border rounded-xl shadow-lg bg-[#1a1a2e] text-white overflow-auto min-h-[160px] max-h-[40vh] flex flex-col relative">
                {/* Sticky Top-right Controls */}
                <div className="sticky top-0 right-0 flex items-center justify-end space-x-2 bg-[#1a1a2e] p-2 z-10">
                    {/* Baud Rate Selector */}
                    {/* Command Input or Raw Data */}
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
                    <div className="flex items-center space-x-2">
                        <label className="text-xs font-semibold">Bits</label>
                        <select
                            value={bitsref.current}
                            onChange={(e) => bitsref.current= Number(e.target.value)}
                            className="p-1 border rounded bg-gray-800 text-white text-xs"
                        >
                            {[10, 12, 14, 16].map((Bits) => (
                                <option key={Bits} value={Bits}>
                                    {Bits}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label className="text-xs font-semibold">Baud Rate:</label>
                        <select
                            value={ baudRateref.current}
                            onChange={(e) => handleBaudRateChange(Number(e.target.value))}
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


                <pre className="text-xs whitespace-pre-wrap break-words px-4 pb-4 flex-grow">{rawData}</pre>

            </div>
            <div className="flex justify-center flex-wrap gap-2">
                <Button onClick={connectToSerial} disabled={isConnected} className="px-4 py-2 text-sm font-semibold">
                    {isConnected ? "Connected" : "Connect Serial"}
                </Button>
                <Button onClick={disconnectSerial} disabled={!isConnected} className="px-4 py-2 text-sm font-semibold">
                    Disconnect
                </Button>
            </div>
        </div>


    );
};

export default SerialPlotter;