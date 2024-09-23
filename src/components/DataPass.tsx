"use client";

import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState } from "react";
import Canvas from "./Canvas";
import Navbar from "./Navbar"; // Import the Navbar

export type BitSelection = "ten" | "twelve" | "fourteen" | "auto";

const DataPass = () => {
  const [data, setData] = useState(""); // Data from the serial port
  const [selectedBits, setSelectedBits] = useState<BitSelection>("auto"); // Selected bits
  const [isConnected, setIsConnected] = useState<boolean>(false); // Connection status
  const [isDisplay, setIsDisplay] = useState<boolean>(true); // Display state
  const [canvasCount, setCanvasCount] = useState<number>(1); // Number of canvases
  const [channelCount, setChannelCount] = useState<number>(1); // Number of channels

  return (
    <>
      <Navbar isDisplay={isDisplay} />
      {isConnected ? (
        <Canvas
          data={data}
          selectedBits={selectedBits}
          isDisplay={isDisplay}
          canvasCount={canvasCount} // Pass canvas count
        />
      ) : (
        <Steps />
      )}
      <Connection
        LineData={setData}
        Connection={setIsConnected}
        selectedBits={selectedBits}
        setSelectedBits={setSelectedBits}
        isDisplay={isDisplay}
        setIsDisplay={setIsDisplay}
        setCanvasCount={setCanvasCount}
        canvasCount={canvasCount}
        channelCount={channelCount}
      />
    </>
  );
};

export default DataPass;
