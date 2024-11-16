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
          "Record and save data for future reference. Export data in CSV format for further analysis.",
        image: "./assets/DownloadIcon.png",
      },
      {
        title: "Auto Board Detection",
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

  return (
    <section className="w-full pt-12">
      <div className="container px-4 md:px-24 lg:px-12 xl:px-6 max-w-6xl">
        <div className="flex flex-col items-start justify-start space-y-3 text-left">
          <div className="space-y-2 flex flex-col justify-start items-start pl-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-wide text-left">
              <Chords /> is packed with features
            </h1>

            <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">
              An overview of all the core features <Chords /> provides.
            </p>
          </div>
        </div>

        {/* Grid Layout for Cards */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pt-12 ">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="flex flex-col items-center justify-center space-y-2 p-3 min-h-40 shadow-none"
            >
              <div className="flex justify-center gap-2 items-center flex-col">
                <div className="flex items-center justify-center w-12 h-12 p-2 text-background bg-primary rounded-full">
                  <Image
                    src={feature.image}
                    alt="Icon"
                    width={36}
                    height={36}
                    className="invert dark:invert-0"
                  />
                </div>
                <h2 className="text-lg font-bold text-center">{feature.title}</h2>
              </div>
              <p className="text-primary/50 text-sm text-center max-w-xs">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>


  );
}
