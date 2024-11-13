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

  return (
    <section className="w-full py-12 px-4 sm:px-8 lg:py-20">
      <div className="container max-w-6xl mx-auto">
        <div className="flex flex-col items-start justify-start space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 text-left">
          <div className="space-y-2 sm:space-y-3 md:space-y-4 flex flex-col justify-start items-start pl-2">
            <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-bold tracking-wide">
              {/* Mobile View */}
              <span className="inline-block sm:hidden overflow-hidden whitespace-nowrap">
                <span className="inline-block mr-2">Chords</span>
                <span className="inline-block mr-2">is packed</span>
                <br />
                <span className="inline-block mr-2">with</span>
                <span className="inline-block">features</span>
              </span>

              {/* Desktop View */}
              <span className="hidden sm:inline-block overflow-hidden whitespace-nowrap">
                {["Chords", "is", "packed", "with", "features"].map((word, index) => (
                  <span key={index} className="inline-block mr-4">
                    {word}
                  </span>
                ))}
              </span>
            </h1>
            <p className="max-w-xs sm:max-w-lg md:max-w-xl lg:max-w-full text-sm sm:text-base md:text-xl text-muted-foreground">
              An overview of all the core features <Chords /> provides.
            </p>
          </div>
        </div>

        {/* Grid Layout for Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-12 pl-2">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="flex flex-col items-center justify-center p-4 shadow-none"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center justify-center w-12 h-12 p-2 bg-primary rounded-full">
                  <Image
                    src={feature.image}
                    alt="Icon"
                    width={36}
                    height={36}
                    className="invert dark:invert-0"
                  />
                </div>
                <h2 className="text-lg font-bold text-center">{feature.title}</h2>
                <p className="text-primary/50 text-sm text-center max-w-xs">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>

  );
}
