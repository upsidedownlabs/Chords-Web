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
  <div className="px-4 md:px-6 space-y-10 xl:space-y-16 max-w-7xl mx-auto">
    <div className="flex flex-col justify-center gap-8 items-center">
      <div>
        <h1 className="lg:leading-tighter text-[2rem] sm:text-5xl md:text-6xl xl:text-[3.5rem] 2xl:text-[4rem] font-bold tracking-tighter text-center font-lobster">
          <span className="bg-clip-text font-lobster cursor-default tracking-wide duration-300 transition-all text-6xl sm:text-7xl max-w-4xl lg:max-w-5xl xl:max-w-7xl">
            Tune Into Your EXG Data
          </span>
          <br /> With{" "}
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent bg-clip-text font-lobster cursor-default tracking-wide duration-300 transition-all">
            Chords
          </span>
        </h1>
      </div>
      <div className="flex flex-col items-center space-y-4 text-center mt-4">
        <div className="flex space-x-4">
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

    {/* Loader */}
    {!isImageLoaded && (
      <div className="loader">
        <div className="spinner"></div>
      </div>
    )}

    {/* Image */}
    <div className="mt-20 mx-auto max-w-[95%] lg:max-w-[95%]">
  <Image
    src={imageSrc}
    alt="Plotter"
    width={4000}  // Increased width for the image
    height={1500} // Adjusted height to maintain aspect ratio
    priority // Use priority to preload the image
    className={`rounded transition-opacity duration-300 ${
      isImageLoaded ? "opacity-100" : "opacity-0"
    }`}
    onLoadingComplete={() => setIsImageLoaded(true)}
  />
</div>
  </div>
</section>

    </>
  );
};

export default HeadSection;
