"use client";
import React from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useTheme } from "next-themes";
import PlotIt from "./PlotIt";

const HeadSection = () => {
  const { theme } = useTheme();
  return (
    <>
      <section className="w-full pt-12">
        <div className="px-4 md:px-6 space-y-10 xl:space-y-16">
          <div className="flex flex-col justify-center items-center">
            <div>
              <h1 className="lg:leading-tighter text-[1.90rem] font-bold tracking-tighter sm:text-5xl md:text-6xl xl:text-[3.5rem] 2xl:text-[4rem] text-center">
                BioPotential Signals Plotter for the web.
                <br />
                Smooth & Reliable
              </h1>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center mt-4">
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                <PlotIt /> is a free and open-source plotter for BioAmp signals.
                It is designed to be simple, fast, and accessable.
              </p>
              <div className="space-x-4 flex">
                <Link href="/stream">
                  <Button>
                    {theme === "dark" ? (
                      <Image
                        src="/assets/dark/favicon.ico"
                        width={16}
                        height={16}
                        alt="logo"
                        className="mr-2"
                      />
                    ) : (
                      <Image
                        src="/assets/light/favicon.ico"
                        width={16}
                        height={16}
                        alt="logo"
                        className="mr-2"
                      />
                    )}
                    Visualize Now
                  </Button>
                </Link>
                <Link
                  href="https://github.com/upsidedownlabs/BioSignal-Recorder-Web"
                  target="_blank"
                >
                  <Button
                    variant={"outline"}
                    className="flex justify-center items-center"
                  >
                    <GitHubLogoIcon className="mr-2 h-4 w-4" />
                    <span>Source Code</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        {theme === "dark" ? (
          <Image
            src="/assets/dark/HeroSignalsClean.png"
            alt="Plotter"
            width={1000}
            height={1000}
            className="mx-auto mt-20 rounded"
          />
        ) : (
          <Image
            src="/assets/light/HeroSignalsClean.png"
            alt="Plotter"
            width={1000}
            height={1000}
            className="mx-auto mt-20 rounded"
          />
        )}
      </section>
    </>
  );
};

export default HeadSection;
