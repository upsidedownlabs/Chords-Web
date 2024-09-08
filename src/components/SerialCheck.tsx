"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "../components/ui/skeleton";
import InCompatibleBrowser from "../components/InCompatibleBrowser";
import MobileUnsupported from "../components/MobileUnsupported";

const DataPass = dynamic(() => import("./DataPass"), {
  loading: () => <SkeletonUI />,
  ssr: false,
});

const SkeletonUI = () => (
  <div className="container mt-14 mx-auto px-4 py-8 space-y-8">
    <div className="text-center space-y-2">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-1/2 mx-auto" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left panel */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>

      {/* Middle panel */}
      <div className="border rounded-lg p-6">
        <Skeleton className="h-96 w-full" />
      </div>

      {/* Right panel */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  </div>
);

const isMobile = () => {
  if (typeof window === "undefined") return false; // for server-side rendering
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const SerialCheck = () => {
  const [serialState, setSerialState] = useState<
    "loading" | "available" | "unavailable"
  >("loading");
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setSerialState(navigator.serial ? "available" : "unavailable");
    setIsMobileDevice(isMobile());
  }, []);

  if (serialState === "loading") {
    return <SkeletonUI />;
  }

  if (isMobileDevice) {
    return <MobileUnsupported />;
  }

  return (
    <>{serialState === "available" ? <DataPass /> : <InCompatibleBrowser />}</>
  );
};

export default SerialCheck;
