"use client";
import React from "react";
import { useState } from 'react';

import { Card } from "../ui/card";
import Image from "next/image";
import Chords from "./Chords";

export function Features() {
  const features: {
    title: string;
    description: string;
    image: string;
  }[] = [
      {
        title: "Multi Channel Data Plot",
        description:
          "Plot data from multiple channels in different graphs. Each stream is different color coded for easy identification.",
        image: "./assets/MultiChannel.jpg",
      },
      {
        title: "Record & Save Data",
        description:
          "Record and save data for future reference. Export data in CSV/ZIP format for further analysis.",
        image: "./assets/DownloadIcon.png",
      },
      {
        title: "AutoScale & Board Detection",
        description:
          "Automatically detects ADC of developement board to scale the graph accordingly. No need to manually set the scale.",
        image: "./assets/Arduino.png",
      },
      {
        title: "Freeze Stream",
        description:
          "Freeze the stream to analyze the data. Resume the stream when you are ready to continue.",
        image: "./assets/Pause.png",
      },
    ];
  const [selectedFeature, setSelectedFeature] = useState(features[0]);
  return (
    <section className="w-full py-12">
      <div className="container px-4 md:px-6 max-w-7xl">
        {/* Heading */}
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="space-y-2 flex flex-col justify-center items-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center">
              <Chords /> is packed with features
            </h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed text-center">
              An overview of all the core features <Chords /> provides.
            </p>
          </div>
        </div>

        {/* Main Content: Sidebar and Feature Display */}
        <div className="flex pt-5 max-w-6xl mx-auto">
          {/* Sidebar with Icon Buttons Only */}
          <aside className="w-1/6  pr-4">
            <ul className="flex flex-col items-center space-y-4">
              {features.map((feature, index) => (
                <li
                  key={index}
                  className={`w-12 h-12 flex items-center justify-center rounded-full cursor-pointer ${selectedFeature.title === feature.title
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-primary"
                    }`}
                  onClick={() => setSelectedFeature(feature)}
                >
                  <Image
                    src={feature.image} // Use `image` property instead of `icon`
                    alt={feature.title}
                    width={24}
                    height={24}
                    className="invert dark:invert-0"
                  />
                </li>
              ))}
            </ul>
          </aside>

          {/* Feature Display Area */}
          <div className="w-5/6 p-6 ">
            <Card className="flex flex-col items-center justify-center space-y-4 p-6 shadow-none">
              {/* Feature Icon */}
              <div className="w-16 h-16 p-4 text-background bg-primary rounded-full mb-4">
                <Image
                  src={selectedFeature.image}
                  alt={`${selectedFeature.title} icon`}
                  width={48}
                  height={48}
                  className="invert dark:invert-0"
                />
              </div>

              {/* Feature Title */}
              <h2 className="text-xl font-bold text-center">
                {selectedFeature.title}
              </h2>

              {/* Feature Description */}
              <p className="text-primary/50 text-sm text-center max-w-md">
                {selectedFeature.description}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
