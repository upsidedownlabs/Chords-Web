"use client";

import React, { useEffect } from "react";

export default function DataViewerPage() {
    useEffect(() => {
        let packetCount = 0;
        let sampleCount = 0;
        let totalBytes = 0;
        let previousSampleNumber = -1;
        let previousData = [];
        let startTime = Date.now();

        const PACKET_SIZE = 10; // Matches the Arduino packet length

        // Helper function to calculate rates per second
        const calculateRate = (count: number, elapsedTime: number) => count / elapsedTime;

        const connectSerial = async () => {
            try {
                // Request and open a serial port
                const serialPort = await navigator.serial.requestPort();
                await serialPort.open({ baudRate: 230400 });
                console.log("Serial Port Connected!");

                // Send the START command to the Arduino
                const writer = serialPort.writable?.getWriter();
                if (writer) {
                    await writer.write(new TextEncoder().encode("START\n"));
                    writer.releaseLock();
                    console.log("Sent START command to device");
                }

                // Get the readable stream and set up a reader
                const reader = serialPort.readable?.getReader();
                if (!reader) {
                    console.error("Failed to get serial reader");
                    return;
                }

                let buffer = [];

                while (true) {
                    try {
                        const { value, done } = await reader.read();
                        if (done) {
                            console.warn("Serial stream closed by device");
                            break;
                        }
                        if (value) {
                            // Append new bytes to the buffer
                            buffer.push(...value);
                            totalBytes += value.length;
                            packetCount++;

                            // Process as many full packets as possible
                            while (buffer.length >= PACKET_SIZE) {
                                const packet = buffer.splice(0, PACKET_SIZE);
                                processPacket(packet);
                            }
                        }
                    } catch (readError) {
                        console.error("Read error:", readError);
                        break;
                    }
                }
            } catch (error) {
                console.error("Serial connection error:", error);
            }
        };

        const processPacket = (packet: number[]) => {
            // Validate packet length
            if (packet.length !== PACKET_SIZE) {
                console.error("Invalid packet length:", packet);
                return;
            }

            // Validate header and end bytes
            if (packet[0] !== 0xC7 || packet[1] !== 0x7C) {
                console.error("Invalid header:", packet);
                return;
            }
            if (packet[9] !== 0x01) {
                console.error("Invalid end byte:", packet);
                return;
            }

            // Extract sample counter and channel data
            const sampleNumber = packet[2];
            const dataView = new DataView(new Uint8Array(packet).buffer);
            const channelData = [
                dataView.getInt16(3, false), // Channel 1 (big-endian)
                dataView.getInt16(5, false), // Channel 2
                dataView.getInt16(7, false), // Channel 3
            ];

            // Check for missing or duplicate samples
            if (previousSampleNumber !== -1) {
                if (sampleNumber - previousSampleNumber > 1) {
                    console.error("Sample Lost! Expected:", previousSampleNumber + 1, "Got:", sampleNumber);
                    return;
                } else if (sampleNumber === previousSampleNumber) {
                    console.error("Duplicate sample:", sampleNumber);
                    return;
                }
            }
            previousSampleNumber = sampleNumber;
            previousData = channelData;
            sampleCount++;

            // Format and log the data as [counter, ch1, ch2, ch3]
            const formattedData = [sampleNumber, ...channelData];
            pushSample(formattedData);

            // Calculate and log the rates every second
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000;
            if (elapsedTime >= 1.0) {
                console.log(
                    `⚡ ${Math.floor(calculateRate(packetCount, elapsedTime))} FPS | ` +
                    `${Math.floor(calculateRate(sampleCount, elapsedTime))} SPS | ` +
                    `${Math.floor(calculateRate(totalBytes, elapsedTime))} BPS`
                );
                packetCount = 0;
                sampleCount = 0;
                totalBytes = 0;
                startTime = currentTime;
            }
        };

        // This function is a placeholder for handling processed samples
        const pushSample = (data: number[]) => {
            console.log("Processed Sample:", data);
            // Update state or forward data as needed.
        };

        // Connect to the serial port when the component mounts
        connectSerial();

        return () => {
            console.log("🔌 Closing serial connection...");
            // You might want to close the serial port here if necessary.
        };
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <h1 className="text-3xl font-bold mb-4">Serial Data Viewer</h1>
            <p>Open the console to see formatted values.</p>
        </div>
    );
}
