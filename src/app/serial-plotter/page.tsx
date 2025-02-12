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
    const [awaitingCommand, setAwaitingCommand] = useState(false);
    const [commandInput, setCommandInput] = useState("whoru");


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

            while (true) {
                const { value, done } = await serialReader.read();
                if (done) break;
                if (value) {
                    buffer += new TextDecoder().decode(value);
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // Keep any incomplete line for next read

                    let newData: DataPoint[] = [];

                    lines.forEach((line) => {
                        // Store raw data for display
                        setRawData((prev) => {
                            const newRawData = prev.split("\n").concat(line.trim().replace(/\s+/g, " "));
                            return newRawData.slice(-maxRawDataLines).join("\n");
                        });

                        // Convert the line into an array of numbers
                        const values = line.trim().split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));

                        if (values.length > 0) {
                            newData.push({ time: Date.now(), values });

                            // Update the number of detected channels dynamically
                            setSelectedChannels((prevChannels) => {
                                const detectedChannels = values.length;
                                if (prevChannels.length !== detectedChannels) {
                                    return Array.from({ length: detectedChannels }, (_, i) => i);
                                }
                                return prevChannels;
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
                canvas.height = 500;

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

    return (
        <div className="w-full max-w-8xl mx-auto p-6 border rounded-2xl shadow-xl">
            <h1 className="text-3xl font-bold text-center mb-6">Chords Serial Plotter & Monitor</h1>

            <div className="flex justify-center flex-wrap gap-4 mb-6">
                <Button onClick={connectToSerial} disabled={isConnected} className="px-6 py-3 text-lg font-semibold">
                    {isConnected ? "Connected" : "Connect Serial"}
                </Button>
                <Button onClick={disconnectSerial} disabled={!isConnected} className="px-6 py-3 text-lg font-semibold">
                    Disconnect
                </Button>
                <label className="flex items-center space-x-2 bg-gray-300 p-2 rounded">
                    <Checkbox checked={showCombined} onCheckedChange={(checked) => setShowCombined(!!checked)} />
                    <span>Show Combined Graph</span>
                </label>
                <label className="flex items-center space-x-2 bg-gray-300 p-2 rounded">
                    <Checkbox checked={showSeparate} onCheckedChange={(checked) => setShowSeparate(!!checked)} />
                    <span>Show Separate Graphs</span>
                </label>
            </div>

            {/* Zoom Control */}
            <div className="w-full flex justify-center items-center mb-6 p-2">
                <label className="mr-4">Zoom:</label>
                <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={zoomFactor}
                    className="w-1/2"
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
                <span className="ml-4">{zoomFactor.toFixed(1)}x</span>
            </div>

            {/* Combined Canvas */}
            {showCombined && (
                <div className="w-full border rounded-xl shadow-lg bg-[#1a1a2e] p-4 mb-6">
                    <h2 className="text-lg font-semibold text-center mb-2 text-white">Combined Plot</h2>
                    <canvas ref={canvasRef} className="w-full h-[300px] rounded-xl" />
                </div>
            )}

            {/* Separate Canvases */}
            {showSeparate && (
                <div className={`grid gap-4 ${selectedChannels.length % 2 === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {selectedChannels.map((index, i) => (
                        <div
                            key={index}
                            className="border rounded-xl shadow-lg bg-[#1a1a2e] p-4 w-full"
                            style={{ gridColumn: selectedChannels.length % 2 === 1 && i === selectedChannels.length - 1 ? "span 2 w-10px" : "span 1" }}
                        >
                            <h2 className="text-lg font-semibold text-center mb-2 text-white">
                                Channel {index + 1}
                            </h2>
                            <canvas
                                ref={(el) => {
                                    separateCanvasRefs.current[index] = el;
                                }}
                                className="w-full h-[300px] rounded-xl"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Raw Data Output */}
            <div
                ref={rawDataRef}
                className="w-full mt-6 py-4 border rounded-xl shadow-lg bg-[#1a1a2e] text-white overflow-auto h-40"
            >
                <h2 className="text-xl font-semibold text-center mb-2">Raw Data Output:</h2>
                <pre className="text-sm whitespace-pre-wrap break-words">{rawData}</pre>
            </div>
        </div>



    );
};

export default SerialPlotter;