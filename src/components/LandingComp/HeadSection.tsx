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
      <section className="w-full min-h-[10vh] flex items-center justify-center ">
        <div className="px-2 md:px-6 space-y-10 xl:space-y-16 max-w-6xl mx-auto flex items-center justify-center">
          <div className="flex flex-col lg:flex-row justify-center items-center gap-8 w-full">
            {/* Text Section */}
            <div className="w-full lg:w-1/2 text-center lg:text-left">
              <div className="lg:leading-tighter text-[1rem] sm:text-5xl md:text-6xl xl:text-[3.5rem] 2xl:text-[4rem] font-bold tracking-tighter font-lobster">
                <span className="block text-xl text-gray-500 transition tracking-wider word-spacing">
                  Hi, Welcome to Chords
                </span>

                <span className="inline-block bg-clip-text text-gray-600 font-lobster cursor-default tracking-wide duration-300 transition-all text-[2.5rem] leading-none">
                  Tune Into Your EXG Data
                </span>

                <span className="inline-block text-[2.5rem] mr-2 tracking-wide duration-300 transition-all text-gray-600 leading-none">
                  With
                </span>

                <span className="inline-block bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent text-[2.5rem] bg-clip-text font-lobster cursor-default tracking-wide duration-300 transition-all leading-none">
                  Chords
                </span>

                <div className="w-full text-sm text-gray-500 dark:text-gray-500 font-medium transition-all line-height-1 duration-300 mt-4 tracking-wide">
                  <span className="block">Transform bio signals into clear, insightful visuals,</span>
                  <span className="block">enabling deeper understanding of physiological patterns and processes.</span>
                </div>
              </div>

              <div className="flex flex-col space-y-4 text-center mt-[4rem]">
                <div className="flex space-x-4">
                  <Link href="/stream">
                    <Button className="py-3 px-6 rounded-full">
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
                      <p className="text-gradient-to-r from-pink-500 via-purple-500 to-blue-500">Visualize Now</p>
                    </Button>
                  </Link>
                  <Link
                    href="https://github.com/upsidedownlabs/Chords-Arduino-Firmware"
                    target="_blank"
                  >
                    <Button
                      variant={"outline"}
                      className="flex justify-center items-center py-3 px-6 rounded-full border border-gray-300"
                    >
                      <GitHubLogoIcon className="mr-2 h-4 w-4" />
                      <span>Arduino-Firmware</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* GIF Section */}
            <div className="w-full lg:w-1/2 flex justify-center">
              <img
                src="/assets/dark/signal.png"
                alt="Animated Png of Data"
                className="rounded transition-opacity duration-300 opacity-100"
                style={{ width: "100%", height: "100%",  }}
              />
            </div>
          </div>
        </div>
      </section>



    </>
  );
};

export default HeadSection;
