"use client";
import Connection from "@/components/Connection";
import Steps from "@/components/Steps";
import { useState } from "react";
import Canvas from "@/components/Canvas";

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
