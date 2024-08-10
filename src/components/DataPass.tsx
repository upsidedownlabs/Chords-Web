"use client";

import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState } from "react";
import Canvas from "./Canvas";

export type BitSelection = "ten" | "twelve" | "fourteen" | "auto";

const DataPass = () => {
  const [data, setData] = useState(""); // Data from the serial port
  const [selectedBits, setSelectedBits] = useState<BitSelection>("auto"); // Selected bits
  const [isConnected, setIsConnected] = useState<boolean>(false); // Connection status
  const [isGridView, setIsGridView] = useState(true); // Grid view state

  return (
    <>
      {isConnected ? (
        <Canvas data={data} selectedBits={selectedBits} />
      ) : (
        <Steps />
      )}
      <Connection
        LineData={setData}
        Connection={setIsConnected}
        selectedBits={selectedBits}
        setSelectedBits={setSelectedBits}
        gridViewProps={{ isGridView, setIsGridView }} // Pass both state and setter in one prop
      />
    </>
  );
};

export default DataPass;
