import React from "react";
import { Card } from "../ui/card";
import Image from "next/image";
import PlotIt from "./PlotIt";

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
      image: "/assets/MultiChannel.jpg",
    },
    {
      title: "Record & Save Data",
      description:
        "Record and save data for future reference. Export data in CSV/ZIP format for further analysis.",
      image: "/assets/DownloadIcon.png",
    },
    {
      title: "AutoScale & Board Detection",
      description:
        "Automatically detects ADC of developement board to scale the graph accordingly. No need to manually set the scale.",
      image: "/assets/Arduino.png",
    },
    {
      title: "Freeze Stream",
      description:
        "Freeze the stream to analyze the data. Resume the stream when you are ready to continue.",
      image: "/assets/Pause.png",
    },
  ];
  return (
    <section className="w-full py-8">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="space-y-2 flex flex-col justify-center items-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center">
              <PlotIt /> is packed with features
            </h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed text-center">
              An overview of all the core features <PlotIt /> provides.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-3xl items-start min-[600px]:grid-cols-2 pt-12 md:max-w-5xl lg:grid-cols-2 grid-cols-2 gap-2 lg:max-w-6xl">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="flex flex-col items-center lg:md:sm:justify-center justify-normal space-y-2 p-3 min-h-52 shadow-none hover:border hover:shadow hover:shadow-muted-foreground"
            >
              <div className="flex justify-center gap-2 items-center flex-col">
                <div className="flex items-center justify-center w-16 h-16 p-4 text-background bg-primary rounded-full">
                  <Image
                    src={feature.image}
                    alt="Icon"
                    width={48}
                    height={48}
                    className="invert dark:invert-0"
                  />
                </div>
                <h2 className="lg:md:sm:text-xl font-bold text-center">
                  {feature.title}
                </h2>
              </div>
              <p className="text-primary/50 lg:md:sm:text-[1rem] text-sm text-center">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
