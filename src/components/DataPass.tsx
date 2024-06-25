"use client";
import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState } from "react";
import Canvas from "./Canvas";

const DataPass = () => {
  const [data, setData] = useState("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  return (
    <>
      {isConnected ? <Canvas data={data} /> : <Steps />}
      <Connection LineData={setData} Connection={setIsConnected} />
    </>
  );
};

export default DataPass;
