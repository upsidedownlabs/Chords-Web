"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useTheme } from "next-themes";
import Chords from "./Chords";

const HeadSection: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only mount once, no need to reset image loading on theme change
  useEffect(() => {
    setMounted(true);
  }, []);

  // Preload images for fast loading and smooth transitions between themes
  useEffect(() => {
    const darkImage = new window.Image();
    darkImage.src = "/assets/dark/HeroSignalsClean.png";
    const lightImage = new window.Image();
    lightImage.src = "/assets/light/HeroSignalsClean.png";
  }, []);

  if (!mounted) return null; // Prevent render before mounting

  return (
    <section className="w-full pt-24">
      <div className="px-4 md:px-6 space-y-10 xl:space-y-16">
        <div className="flex flex-col justify-center gap-8 items-center">
          <div>
            <h1 className="lg:leading-tighter text-[1.90rem] font-bold tracking-tighter sm:text-5xl md:text-6xl xl:text-[3.5rem] 2xl:text-[4rem] text-center">
              <span className="text-7xl">Tune Into Your EXG Data</span>
              <br /> With <Chords />
            </h1>
          </div>
          <div className="flex flex-col items-center space-y-4 text-center mt-4">
            <div className="space-x-4 flex">
              <Link href="/stream">
                <Button>
                  <Image
                    src={
                      resolvedTheme === "dark"
                        ? "/assets/dark/favicon.ico"
                        : "/assets/light/favicon.ico"
                    }
                    width={16}
                    height={16}
                    alt="logo"
                    className="mr-2"
                  />
                  Visualize Now
                </Button>
              </Link>
              <Link
                href="https://github.com/upsidedownlabs/Chords-Web"
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

      {/* Loader */}
      {!isImageLoaded && (
        <div className="loader">
          <div className="spinner"></div>
        </div>
      )}

      {/* Image */}
      <Image
        src={
          resolvedTheme === "dark"
            ? "/assets/dark/HeroSignalsClean.png"
            : "/assets/light/HeroSignalsClean.png"
        }
        alt="Plotter"
        width={1000}
        height={1000}
        className={`mx-auto mt-20 rounded transition-opacity duration-300 ${
          isImageLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoadingComplete={() => setIsImageLoaded(true)}
      />
    </section>
  );
};

export default HeadSection;
