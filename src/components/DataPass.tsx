"use client";

import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState, useCallback, useRef } from "react";
import Canvas from "./Canvas";
import Navbar from "./Navbar"; // Import the Navbar
import FFT from "./FFT"; // Import the FFT

export type BitSelection = 10 | 12 | 14 | 16;

const DataPass = () => {
  const [selectedBits, setSelectedBits] = useState<BitSelection>(10); // Default to 10
  const [isConnected, setIsConnected] = useState<boolean>(false); // Connection status
  const [FFTConnected, setFFTConnected] = useState<boolean>(false); // Connection status
  const [isDisplay, setIsDisplay] = useState<boolean>(true); // Display state
  const [canvasCount, setCanvasCount] = useState<number>(1); // Number of canvases
  const [timeBase, setTimeBase] = useState<number>(4); // To track the current index to show
  const [currentSamplingRate, setCurrentSamplingRate] = useState<number>(0);
  const [channelCount, setChannelCount] = useState<number>(1); // Number of channels
  const canvasRef = useRef<any>(null); // Create a ref for the Canvas component
  const [selectedChannels, setSelectedChannels] = useState<number[]>([1]);
  let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
  const [Zoom, SetZoom] = useState<number>(1); // Number of canvases
  const [currentSnapshot, SetCurrentSnapshot] = useState<number>(0); // Number of canvases
  const pauseRef = useRef<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const handlePauseChange = (newPauseState: boolean) => {
    pauseRef.current = newPauseState;
  };
  const snapShotRef = useRef<boolean[]>(Array(6).fill(false));
  const datastream = useCallback((data: number[]) => {
    if (canvasRef.current) {
      canvasRef.current.updateData(data); // Assuming data is the new data to be displayed
    }
    if (previousCounter !== null) {
      // If there was a previous counter value
      const expectedCounter: number = (previousCounter + 1) % 256; // Calculate the expected counter value
      if (data[0] !== expectedCounter) {
        // Check for data loss by comparing the current counter with the expected counter
        console.warn(
          `Data loss detected in datapass! Previous counter: ${previousCounter}, Current counter: ${data[0]}`
        );
      }
    }
    previousCounter = data[0]; // Update the previous counter with the current counter
  }, []);
  return (
    <div className="flex flex-col h-screen m-0 p-0 bg-g ">
      <div className="bg-highlight">
        <Navbar isDisplay={isDisplay} />
      </div>
      {isConnected ? (
        <Canvas
          pauseRef={pauseRef}
          Zoom={Zoom}
          snapShotRef={snapShotRef}
          currentSnapshot={currentSnapshot}
          ref={canvasRef} // Pass the ref to the Canvas component
          selectedBits={selectedBits}
          isDisplay={isDisplay}
          canvasCount={canvasCount} // Pass canvas count
          selectedChannels={selectedChannels}
          timeBase={timeBase}
          currentSamplingRate={currentSamplingRate}
        />
      ) : FFTConnected ? (
        <FFT
        selectedChannel={selectedChannel}
        Zoom={Zoom}
        ref={canvasRef} // Pass the ref to the Canvas component
        canvasCount={canvasCount} // Pass canvas count
        selectedChannels={selectedChannels}
        timeBase={timeBase}
        currentSamplingRate={currentSamplingRate} 
        />
      ): (
        <Steps />
      )}
      <Connection
        onPauseChange={handlePauseChange}
        snapShotRef={snapShotRef}
        datastream={datastream}
        Connection={setIsConnected}
        FFT={setFFTConnected}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedBits={selectedBits}
        setSelectedBits={setSelectedBits}
        isDisplay={isDisplay}
        setIsDisplay={setIsDisplay}
        setCanvasCount={setCanvasCount}
        canvasCount={canvasCount}
        setTimeBase={setTimeBase}
        selectedChannels={selectedChannels}
        setSelectedChannels={setSelectedChannels}
        timeBase={timeBase}
        setCurrentSamplingRate={setCurrentSamplingRate}
        currentSamplingRate={currentSamplingRate}
        channelCount={channelCount}
        SetZoom={SetZoom}
        SetCurrentSnapshot={SetCurrentSnapshot}
        currentSnapshot={currentSnapshot}
        Zoom={Zoom}
      />
    </div>
  );
};

export default DataPass;