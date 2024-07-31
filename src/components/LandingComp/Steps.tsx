"use client";
import React from "react";
import { Card, CardContent, CardFooter } from "../ui/card";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { CircleAlert } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";

const Steps = () => {
  return (
    <section className="w-full py-6 md:py-12 lg:py-16">
      <div className="container grid items-center justify-center px-4 text-center md:px-6 lg:gap-6">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl pb-8">
            Get Started in 3 Simple Steps
          </h2>
        </div>
        <div>
          <div className="relative after:absolute after:inset-x-0 after:top-1/2 after:block after:h-0.5 after:-translate-y-1/2 after:rounded-lg after:bg-primary">
            <ol className="relative z-10 flex justify-between text-sm font-medium text-primary">
              <li className="flex items-center gap-2 bg-background p-2">
                <span className="size-6 rounded-full bg-primary text-center text-[10px]/6 font-bold text-background">
                  1
                </span>
                <span className="hidden sm:block">Step 1</span>
              </li>
              <li className="flex items-center gap-2 bg-background p-2">
                <span className="size-6 rounded-full bg-primary text-center text-[10px]/6 font-bold text-background">
                  2
                </span>
                <span className="hidden sm:block">Step 2</span>
              </li>
              <li className="flex items-center gap-2 bg-background p-2">
                <span className="size-6 rounded-full bg-primary text-center text-[10px]/6 font-bold text-background">
                  3
                </span>
                <span className="hidden sm:block">Step 3</span>
              </li>
            </ol>
          </div>
        </div>
        <div className="grid w-full max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Gather Hardware",
              description:
                "Take a developement board, BioAmp hardware, cables & electrodes. Make the connections.",
              image: "/steps/connections.png",
            },
            {
              title: "Upload The Code",
              description:
                "Upload the provided code to your developement board using Arduino IDE.",
              image: "/steps/UploadCode.jpg",
            },
            {
              title: "Start Visualizing",
              description:
                "Open plot it, click connect, choose COM port and start visualizing the signals.",
              image: "/steps/plotIt.jpg",
            },
          ].map((step, index) => (
            <Card key={index} className="flex flex-col h-full">
              <CardContent className="flex-grow p-6 flex flex-col justify-between">
                <div>
                  <HoverCard>
                    <HoverCardTrigger>
                      <Image
                        src={step.image}
                        alt={`Step ${index + 1}`}
                        width={320}
                        height={180}
                        className="w-full h-auto rounded-md mb-4 cursor-pointer object-cover"
                      />
                    </HoverCardTrigger>
                    <HoverCardContent className="max-w-2xl w-full">
                      <Image
                        src={step.image}
                        alt={`Step ${index + 1}`}
                        width={320}
                        height={320}
                        className="w-full h-auto rounded-md"
                      />
                    </HoverCardContent>
                  </HoverCard>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="p-4 text-xs text-plot hidden md:flex items-center justify-center">
                <CircleAlert size={16} className="mr-1" /> Hover over image to
                preview
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="flex justify-center pt-8">
          <Link href="/stream">
            <Button>Start Visualizing &rarr;</Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Steps;
