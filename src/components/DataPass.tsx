"use client";

import Connection from "./Connection";
import Steps from "./steps";
import React, { useState } from "react";
import Canvas from "./Canvas";

export type BitSelection = "ten" | "twelve" | "fourteen" | "auto";

const DataPass = () => {
  const [data, setData] = useState(""); // Data from the serial port
  const [selectedBits, setSelectedBits] = useState<BitSelection>("auto"); // Selected bits
  const [isConnected, setIsConnected] = useState<boolean>(false); // Connection status
  const [isGridView, setIsGridView] = useState<boolean>(true); // Grid view state
  const [isDisplay, setIsDisplay] = useState<boolean>(true); // Display state

  return (
    <>
      {isConnected ? (
        <Canvas
          data={data}
          selectedBits={selectedBits}
          isGridView={isGridView}
          isDisplay={isDisplay}
        />
      ) : (
        <Steps />
      )}
      <Connection
        LineData={setData}
        Connection={setIsConnected}
        selectedBits={selectedBits}
        setSelectedBits={setSelectedBits}
        isGridView={isGridView}
        setIsGridView={setIsGridView}
        isDisplay={isDisplay}
        setIsDisplay={setIsDisplay}
      />
    </>
  );
};

export default DataPass;
