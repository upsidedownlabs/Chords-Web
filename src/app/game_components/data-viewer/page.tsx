// src/app/data-viewer/page.tsx
"use client";

import React, { useEffect } from "react";

export default function DataViewerPage() {
  useEffect(() => {
    // Define variables similar to the Python code
    const ws = new WebSocket("ws://multi-emg.local:81");
    ws.binaryType = "arraybuffer"; // Ensure we receive binary data

    const blockSize = 13;
    let packetCount = 0;
    let sampleCount = 0;
    let totalBytes = 0;
    let previousSampleNumber = -1;
    let previousData: number[] = [];
    let startTime = Date.now();

    // Helper function to calculate rates
    function calculateRate(count: number, elapsedTime: number): number {
      return count / elapsedTime;
    }

    // Placeholder for LSL outlet; in your implementation, replace this with your LSL integration
    function pushSample(channelData: number[]) {
      // Example: outlet.push_sample(channelData)
      // For now, we simply log the pushed sample.
      // console.log("Pushed sample:", channelData);
    }

    ws.onopen = function () {
      console.log("WebSocket connected!");
    };

    ws.onmessage = function (event) {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTime) / 1000; // seconds

      // Ensure the received data is an ArrayBuffer
      if (!(event.data instanceof ArrayBuffer)) {
        console.error("Received data is not an ArrayBuffer");
        return;
      }

      // Convert ArrayBuffer to a typed array
      const byteData = new Uint8Array(event.data);
      totalBytes += byteData.length;
      packetCount++;

      // Process data in blocks of blockSize bytes
      for (let offset = 0; offset < byteData.length; offset += blockSize) {
        sampleCount++;
        // Get a slice of the block
        const block = byteData.subarray(offset, offset + blockSize);
        // First byte is the sample number
        const sampleNumber = block[0];

        // Use DataView to read 16-bit signed integers (big-endian)
        const dataView = new DataView(block.buffer, block.byteOffset, block.byteLength);
        const channelData: number[] = [];
        for (let channel = 0; channel < 3; channel++) {
          const channelOffset = 1 + channel * 2;
          const sample = dataView.getInt16(channelOffset, false);
          channelData.push(sample);
        }

        // Check for missing or duplicate samples
        if (previousSampleNumber === -1) {
          previousSampleNumber = sampleNumber;
          previousData = channelData;
        } else {
          if (sampleNumber - previousSampleNumber > 1) {
            console.error("Error: Sample Lost");
            ws.close();
            return;
          } else if (sampleNumber === previousSampleNumber) {
            console.error("Error: Duplicate sample");
            ws.close();
            return;
          } else {
            previousSampleNumber = sampleNumber;
            previousData = channelData;
          }
        }

        // Log EEG data and push the sample
        console.log("Data:", sampleNumber, channelData[0], channelData[1], channelData[2]);
        pushSample(channelData);
      }

      // Every second, log rates and reset counters
      if (elapsedTime >= 1.0) {
        const samplesPerSecond = Math.floor(calculateRate(sampleCount, elapsedTime));
        const fps = Math.floor(calculateRate(packetCount, elapsedTime));
        const bytesPerSecond = Math.floor(calculateRate(totalBytes, elapsedTime));
        console.log(`${fps} FPS : ${samplesPerSecond} SPS : ${bytesPerSecond} BPS`);

        // Reset counters
        packetCount = 0;
        sampleCount = 0;
        totalBytes = 0;
        startTime = currentTime;
      }
    };

    ws.onerror = function (error) {
      console.error("WebSocket error:", error);
    };

    ws.onclose = function () {
      console.log("WebSocket connection closed.");
    };

    // Cleanup WebSocket on unmount
    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Data Viewer</h1>
      <p>Open the browser console to see incoming data.</p>
    </div>
  );
}
