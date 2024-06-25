"use client";
import Connection from "./Connection";
import Steps from "./Steps";
import React, { useState } from "react";
import FFTCanvas from "./FFTCanvas";

const DataPass = () => {
  const [data, setData] = useState("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  return (
    <>
      {isConnected ? <FFTCanvas data={data} /> : <Steps />}
      <Connection LineData={setData} Connection={setIsConnected} />
    </>
  );
};

export default DataPass;
