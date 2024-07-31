"use client";
import Link from "next/link";
import React from "react";
import { Button } from "../ui/button";
import Image from "next/image";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import PlotIt from "./PlotIt";

const Stack = () => {
  const { theme } = useTheme();
  const stack = [
    {
      name: "Next.js",
      logo:
        theme === "light"
          ? "/assets/dark/next-js.png"
          : "/assets/light/nextjs.svg",
      url: "https://nextjs.org/",
      description: "The fantastic React framework for building web apps.",
    },
    {
      name: "Tailwind CSS",
      logo: "/assets/tailwindcss.svg",
      url: "https://tailwindcss.com/",
      description: "A utility-first CSS framework for rapid UI development.",
    },
    {
      name: "shadcn/ui",
      logo:
        theme === "light"
          ? "/assets/dark/ShadcnUI.png"
          : "/assets/light/ShadcnUI.png",
      url: "https://ui.shadcn.com",
      description: "Built with amazing components from shadcn/ui.",
    },
    {
      name: "Smoothie Charts",
      logo: "/assets/smoothie-logo.png",
      url: "http://smoothiecharts.org/",
      description: "Timeseries charts for plotting the data real time.",
    },
    {
      name: "Web Serial Api",
      logo:
        theme === "light"
          ? "/assets/dark/favicon.ico"
          : "/assets/light/favicon.ico",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API",
      description: "For connecting to the serial port of the device.",
    },
    {
      name: "JSZip",
      logo:
        theme === "light"
          ? "/assets/dark/favicon.ico"
          : "/assets/light/favicon.ico",
      url: "https://stuk.github.io/jszip/",
      description: "For creating and downloading the recorded data zip files.",
    },
  ];
  return (
    <section className="w-full py-12">
      <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            <PlotIt /> is open-source, and free to use.
          </h2>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            It is powered by the following technologies, that makes it super
            fast, efficient and reliable.
          </p>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="grid gap-6 mt-8 lg:md:sm:grid-cols-3 grid-cols-2">
            {stack.map((item, index) => (
              <Link
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-4 space-y-2 transition-transform transform rounded-lg shadow-md shadow-muted hover:shadow-sm hover:shadow-muted-foreground hover:scale-[1.025]"
              >
                <Image
                  src={item.logo}
                  alt={item.name}
                  width={48}
                  height={48}
                  className="w-12 h-12"
                />
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex justify-center space-x-4 mt-8">
          <Link href="/stream">
            <Button>Visualize Now &rarr;</Button>
          </Link>
          <Link
            href="https://github.com/upsidedownlabs/BioSignal-Recorder-Web"
            target="_blank"
          >
            <Button variant="outline">
              <GitHubLogoIcon className="mr-2 h-4 w-4" /> Source Code
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Stack;
