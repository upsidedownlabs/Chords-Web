"use client";
import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState } from "react";
import Canvas from "./Canvas";

export type BitSelection = "ten" | "twelve" | "fourteen" | "auto";

const DataPass = () => {
  const [data, setData] = useState("");
  const [selectedBits, setSelectedBits] = useState<BitSelection>("auto");
  const [isConnected, setIsConnected] = useState<boolean>(false);

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
      />
    </>
  );
};

export default DataPass;
