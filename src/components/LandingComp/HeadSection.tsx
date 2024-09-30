"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useTheme } from "next-themes";
import Chords from "./Chords";
import Navbar from "../Navbar";

const HeadSection: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false); // Ensures the theme detection works after mounting
  const [currentTheme, setCurrentTheme] = useState<string | undefined>(
    undefined
  );

  // Set mounted to true after the client has mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update theme with 50ms delay to ensure proper theme matching
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        setCurrentTheme(resolvedTheme);
      },50 ); // Add a delay of 50ms
      return () => clearTimeout(timer); // Clean up the timer on unmount
    }
  }, [mounted, resolvedTheme]);

  // Preload dark and light images to avoid delay on theme switch
  const preloadImage = (src: string) => {
    const img = new window.Image();
    img.src = src;
  };

  // Preload images on component mount
  useEffect(() => {
    preloadImage("./assets/dark/HeroSignalsClean.png");
    preloadImage("./assets/light/HeroSignalsClean.png");
  }, []);

  // If the component is not mounted yet, avoid rendering to prevent flickering
  if (!mounted) return null;

  const imageSrc =
    currentTheme === "dark"
      ? "./assets/dark/HeroSignalsClean.png"
      : "./assets/light/HeroSignalsClean.png";

  return (
    <>
      <Navbar isDisplay={true} />
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
                        currentTheme === "dark"
                          ? "./assets/dark/favicon.ico"
                          : "./assets/light/favicon.ico"
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
                  href="https://github.com/upsidedownlabs/Chords-Arduino-Firmware"
                  target="_blank"
                >
                  <Button
                    variant={"outline"}
                    className="flex justify-center items-center"
                  >
                    <GitHubLogoIcon className="mr-2 h-4 w-4" />
                    <span>Arduino-Firmware</span>
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
          src={imageSrc}
          alt="Plotter"
          width={1000}
          height={1000}
          priority // Use priority to preload the image
          className={`mx-auto mt-20 rounded transition-opacity duration-300 ${
            isImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoadingComplete={() => setIsImageLoaded(true)}
        />
      </section>
    </>
  );
};

export default HeadSection;
