"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface DataPoint {
    time: number;
    values: number[];
}

const channelColors = ["#F5A3B1", "#86D3ED", "#7CD6C8", "#C2B4E2", "#48d967", "#FFFF8C"];

const SerialPlotter = () => {
    const maxChannels = 6;
    const [data, setData] = useState<DataPoint[]>([]);
    const [port, setPort] = useState<SerialPort | null>(null);
    const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [rawData, setRawData] = useState<string>("");
    const [selectedChannels, setSelectedChannels] = useState<number[]>(Array.from({ length: maxChannels }, (_, i) => i));
    const rawDataRef = useRef<HTMLDivElement | null>(null);
    const [showCombined, setShowCombined] = useState(true);
    const [showSeparate, setShowSeparate] = useState(true);
    const rawDataBuffer = useRef("");
    const maxPoints = 100;


    useEffect(() => {
        if (rawDataRef.current) {
            rawDataRef.current.scrollTop = rawDataRef.current.scrollHeight;
        }
    }, [rawData]);

    const connectToSerial = async () => {
        try {
            const selectedPort = await (navigator as any).serial.requestPort();
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
                    buffer = lines.pop() || "";

                    let newData: DataPoint[] = [];

                    lines.forEach((line) => {
                        setRawData((prev) => prev + line.trim().replace(/\s+/g, " ") + "\n");
                        const values = line.trim().split(/\s+/).map(parseFloat).filter((v) => !isNaN(v));
                        if (values.length > 0) {
                            newData.push({ time: Date.now(), values });
                        }
                    });

                    if (newData.length > 0) {
                        setData((prev) => {
                            const updatedData = [...prev, ...newData];
                            return updatedData.length > maxPoints ? updatedData.slice(-maxPoints) : updatedData;
                        });
                    }
                }
            }
            serialReader.releaseLock();
        } catch (err) {
            console.error("Error reading serial data:", err);
        }
    };


    useEffect(() => {
        let animationFrameId: number;

        const updateRawData = () => {
            if (rawDataBuffer.current) {
                setRawData((prev) => prev + rawDataBuffer.current);
                rawDataBuffer.current = "";
            }
            animationFrameId = requestAnimationFrame(updateRawData);
        };

        animationFrameId = requestAnimationFrame(updateRawData);

        return () => cancelAnimationFrame(animationFrameId);
    }, []);


    const disconnectSerial = async () => {
        if (reader) {
            await reader.cancel();
            reader.releaseLock();
            setReader(null);
        }
        if (port) {
            await port.close();
            setPort(null);
            setIsConnected(false);
        }
    };

    const toggleChannel = (index: number) => {
        setSelectedChannels((prev) =>
            prev.includes(index) ? prev.filter((ch) => ch !== index) : [...prev, index]
        );
    };

    return (
        <div className="w-full max-w-8xl mx-auto p-6 border rounded-2xl shadow-xl bg-[#030c21] text-white">
            <h1 className="text-3xl font-bold text-center mb-6">Chords Serial Plotter & Monitor</h1>
            <div className="flex justify-center flex-wrap gap-4 mb-6">
                <Button onClick={connectToSerial} disabled={isConnected} className="px-6 py-3 text-lg font-semibold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/50 active:shadow-none active:translate-y-1 transition-all duration-200">
                    {isConnected ? "Connected" : "Connect Serial"}
                </Button>
                <Button onClick={disconnectSerial} disabled={!isConnected} className="px-6 py-3 text-lg font-semibold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/50 active:shadow-none active:translate-y-1 transition-all duration-200">
                    Disconnect
                </Button>
                <label className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-md bg-gray-800">
                    <Checkbox checked={showCombined} onCheckedChange={() => setShowCombined(!showCombined)} />
                    <span>Show Combined Plot</span>
                </label>
                <label className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-md bg-gray-800">
                    <Checkbox checked={showSeparate} onCheckedChange={() => setShowSeparate(!showSeparate)} />
                    <span>Show Separate Plots</span>
                </label>
            </div>


            {/* Channel Selection */}
            <div className="flex justify-center space-x-4 mb-4">
                {Array.from({ length: maxChannels }).map((_, index) => (
                    <label
                        key={index}
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-md bg-gray-800 transform active:translate-y-1 transition-all duration-200"
                        style={{ color: channelColors[index], border: `2px solid ${channelColors[index]}` }}
                    >
                        <Checkbox
                            checked={selectedChannels.includes(index)}
                            onCheckedChange={() => toggleChannel(index)}
                            style={{ accentColor: channelColors[index] }}
                        />
                        <span>Channel {index + 1}</span>
                    </label>
                ))}
            </div>

            {/* Combined Chart */}
            {showCombined && (
                <div className="w-full h-[300px] bg-[#1a1a2e] rounded-xl p-4 mb-6">
                    <h2 className="text-xl font-semibold text-center mb-2">Combined Plot</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke="#ccc" />
                            <YAxis stroke="#ccc" />
                            <Tooltip contentStyle={{ backgroundColor: "#222", borderColor: "#555" }} labelStyle={{ color: "#fff" }} />
                            {selectedChannels.map((index) => (
                                <Line key={index} type="monotone" dataKey={`values[${index}]`} stroke={channelColors[index]} strokeWidth={2} dot={false} name={`Channel ${index + 1}`} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Separate Charts for Each Channel */}
            {showSeparate && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedChannels.map((index) => (
                        <div key={index} className="w-full h-[175px] bg-[#1a1a2e] rounded-xl p-2">
                            <h2 className="text-lg font-semibold text-center mb-2">Channel {index + 1}</h2>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke="#ccc" />
                                    <YAxis stroke="#ccc" />
                                    <Tooltip contentStyle={{ backgroundColor: "#222", borderColor: "#555" }} labelStyle={{ color: "#fff" }} />
                                    <Line type="monotone" dataKey={`values[${index}]`} stroke={channelColors[index]} strokeWidth={2} dot={false} name={`Channel ${index + 1}`} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ))}
                </div>
            )}


            <div ref={rawDataRef} className="w-full mt-6 py-4 border rounded-xl bg-[#1a1a2e] text-white overflow-auto h-40">
                <h2 className="text-xl font-semibold text-center mb-2">Raw Data Output:</h2>
                <pre className="text-sm whitespace-pre-wrap break-words">{rawData}</pre>
            </div>

        </div>
    );
};

export default SerialPlotter;
