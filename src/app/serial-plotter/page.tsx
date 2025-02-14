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
    const [writer, setWriter] = useState<WritableStreamDefaultWriter | null>(null);

    useEffect(() => {
        if (rawDataRef.current) {
            rawDataRef.current.scrollTop = rawDataRef.current.scrollHeight;
        }
    }, [rawData]);

    const maxRawDataLines = 1000; // Limit for raw data lines

    useEffect(() => {
        if (!canvasRef.current) return;

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
    }, [selectedChannels]);


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

            await selectedPort.open({ baudRate: 115200 });
            setPort(selectedPort);
            setIsConnected(true);
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

                        if (line.includes("BOARD:")) {
                            setBoardName(line.split(":")[1].trim());
                            setShowCommandInput(true); // Ensure input is still shown even after getting the board name
                        }

                        // Convert data to numbers
                        const values = line.trim().split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
                        if (values.length > 0) {
                            newData.push({ time: Date.now(), values });

                            setSelectedChannels((prevChannels) => {
                                const detectedChannels = values.length;
                                return prevChannels.length !== detectedChannels
                                    ? Array.from({ length: detectedChannels }, (_, i) => i)
                                    : prevChannels;
                            });
                        }
                    });

                    if (newData.length > 0) {
                        setData((prev) => {
                            const updatedData = [...prev, ...newData];
                            return updatedData.length > maxPoints ? updatedData.slice(-maxPoints) : updatedData;
                        });

                        updateWebGLPlot(newData);
                    }
                }
            }
            serialReader.releaseLock();
        } catch (err) {
            console.error("Error reading serial data:", err);
        }
    };

    useEffect(() => {
        if (!showSeparate) {
            separateWglpRefs.current = Array(maxChannels).fill(null); // Reset separate plots
            return;
        }

        selectedChannels.forEach((index) => {
            const canvas = separateCanvasRefs.current[index];
            if (canvas) {
                canvas.width = canvas.clientWidth;
                canvas.height = 100;

                const wglp = new WebglPlot(canvas);
                separateWglpRefs.current[index] = wglp;

                const line = new WebglLine(getLineColor(index), maxPoints);
                line.lineSpaceX(-1, 2 / maxPoints);
                wglp.addLine(line);

                separateLinesRefs.current[index] = line;
                wglp.update();
            }
        });
    }, [selectedChannels, showSeparate]);

    useEffect(() => {
        separateCanvasRefs.current = separateCanvasRefs.current.slice(0, selectedChannels.length);
        separateWglpRefs.current = separateWglpRefs.current.slice(0, selectedChannels.length);
        separateLinesRefs.current = separateLinesRefs.current.slice(0, selectedChannels.length);

        selectedChannels.forEach((_, i) => {
            if (!separateCanvasRefs.current[i]) {
                separateCanvasRefs.current[i] = document.createElement("canvas");
            }

            if (!separateWglpRefs.current[i]) {
                const wglp = new WebglPlot(separateCanvasRefs.current[i]!);
                separateWglpRefs.current[i] = wglp;

                const line = new WebglLine(getLineColor(i), maxPoints);
                line.lineSpaceX(-1, 2 / maxPoints);
                wglp.addLine(line);
                separateLinesRefs.current[i] = line;
            }
        });
    }, [selectedChannels]);


    useEffect(() => {
        let isMounted = true;

        const animate = () => {
            if (!isMounted) return;
            wglpRef.current?.update();
            separateWglpRefs.current.forEach((wglp) => wglp?.update());
            requestAnimationFrame(animate);
        };

        animate();

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
        if (!wglpRef.current || !linesRef.current.length) return;

        const yMin = Math.min(...newData.flatMap(dp => dp.values));
        const yMax = Math.max(...newData.flatMap(dp => dp.values));
        const yRange = yMax - yMin || 1; // Avoid division by zero

        newData.forEach((dataPoint) => {
            selectedChannels.forEach((index) => {
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

        wglpRef.current.update();
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
        <div className="w-full mx-auto p-4 border rounded-2xl shadow-xl flex flex-col gap-4 "> 
        <h1 className="text-2xl font-bold text-center">Chords Serial Plotter & Monitor</h1>
    
        <div className="flex justify-center flex-wrap gap-2">
            <Button onClick={connectToSerial} disabled={isConnected} className="px-4 py-2 text-sm font-semibold">
                {isConnected ? "Connected" : "Connect Serial"}
            </Button>
            <Button onClick={disconnectSerial} disabled={!isConnected} className="px-4 py-2 text-sm font-semibold">
                Disconnect
            </Button>
            <label className="flex items-center space-x-1 bg-gray-300 p-1 rounded">
                <Checkbox checked={showCombined} onCheckedChange={(checked) => {
                    setShowCombined(!!checked);
                    setShowSeparate(!checked);
                }} />
                <span className="text-xs">Show Combined</span>
            </label>
            <label className="flex items-center space-x-1 bg-gray-300 p-1 rounded">
                <Checkbox checked={showSeparate} onCheckedChange={(checked) => {
                    setShowSeparate(!!checked);
                    setShowCombined(!checked);
                }} />
                <span className="text-xs">Show Separate</span>
            </label>
        </div>
    
        {/* Zoom Control */}
        <div className="w-full flex justify-center items-center p-1">
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
        <div className="w-full gap-2"
            style={{ gridTemplateColumns: `repeat(${selectedChannels.length >= 2 ? 2 : 1}` }}>
            {/* Combined Canvas */}
            {showCombined && (
                <div className="border rounded-xl shadow-lg bg-[#1a1a2e] p-2 w-full">
                    <h2 className="text-sm font-semibold text-center mb-1 text-white">Combined Plot</h2>
                    <canvas ref={canvasRef} className="w-full h-[150px] rounded-xl" />
                </div>
            )}
    
            {/* Separate Canvases */}
            {showSeparate && selectedChannels.map((index) => (
                <div key={index} className="border rounded-xl shadow-lg bg-[#1a1a2e] p-2 w-full">
                    <h2 className="text-sm font-semibold text-center mb-1 text-white">Channel {index + 1}</h2>
                    <canvas ref={(el) => { separateCanvasRefs.current[index] = el; }}
                        className="w-full h-[100px] rounded-xl" />
                </div>
            ))}
        </div>
    
        {/* Raw Data Output / Command Input */}
        <div ref={rawDataRef} className="w-full py-2 border rounded-xl shadow-lg bg-[#1a1a2e] text-white overflow-auto h-40">
            <h2 className="text-sm font-semibold text-center mb-1">
                {boardName ? `Connected to: ${boardName}` : "Raw Data Output"}
            </h2>
    
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
                <pre className="text-xs whitespace-pre-wrap break-words">{rawData}</pre>
            )}
        </div>
    </div>
      
    );
};

export default SerialPlotter;