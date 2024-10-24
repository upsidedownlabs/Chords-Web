"use client";


import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useTheme } from "next-themes";
import Navbar from "../Navbar";


const HeadSection: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string | undefined>(undefined);


  useEffect(() => {
    setMounted(true);
  }, []);


  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => {
        setCurrentTheme(resolvedTheme);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mounted, resolvedTheme]);


  const preloadImage = (src: string) => {
    const img = new window.Image();
    img.src = src;
  };


  useEffect(() => {
    preloadImage("./assets/dark/HeroSignalsClean.png");
    preloadImage("./assets/light/HeroSignalsClean.png");
  }, []);


  if (!mounted) return null;


  const imageSrc =
    currentTheme === "dark"
      ? "./assets/dark/HeroSignalsClean.png"
      : "./assets/light/HeroSignalsClean.png";


  return (
    <>
      <Navbar isDisplay={true} />
      <section className="w-full pt-24 min-h-[70vh]">
  <div className="px-4 md:px-6 space-y-10 xl:space-y-16 max-w-7xl mx-auto">
    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
      {/* Text Section */}
      <div className="lg:w-1/2">
        <h1 className="lg:leading-tighter text-[2rem] sm:text-5xl md:text-6xl xl:text-[3.5rem] 2xl:text-[4rem] font-bold tracking-tighter text-left font-lobster">
          <span className="bg-clip-text font-lobster cursor-default tracking-wide duration-300 transition-all text-6xl sm:text-7xl">
            Tune Into Your EXG Data
          </span>
          <br /> With{" "}
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent bg-clip-text font-lobster cursor-default tracking-wide duration-300 transition-all">
            Chords
          </span>
        </h1>


        <div className="flex flex-col items-start space-y-4 mt-4">
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


      {/* Image Section */}
      <div className="lg:w-1/2 mt-10 lg:mt-0">
        {/* Loader */}
        {!isImageLoaded && (
          <div className="loader">
            <div className="spinner"></div>
          </div>
        )}
        {/* Image */}
        <div className="mx-auto">
          <Image
            src={imageSrc}
            alt="Plotter"
            width={2000}
            height={1500}
            priority
            className={`rounded transition-opacity duration-300 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoadingComplete={() => setIsImageLoaded(true)}
          />
        </div>
      </div>
    </div>
  </div>
</section>


    </>
  );
};


export default HeadSection;



