'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '../ui/card';

const CardSlider = () => {
  const cards = [
    {
      title: "Gather Hardware",
      description: "Take a development board, BioAmp hardware, cables & electrodes. Make the connections.",
      image: "/steps/step1.png",
    },
    {
      title: "Upload The Code",
      description: "Upload the provided code to your development board using Arduino IDE.",
      image: "/steps/step2.png",
    },
    {
      title: "Start Visualizing",
      description: "Open Chords, click connect, choose COM port and start visualizing the signals.",
      image: "/steps/step3.png",
    },
    {
      title: "Monitor Performance",
      description: "Keep an eye on the system performance and make necessary adjustments.",
      image: "/steps/step4.png",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Declare the interval variable with a clear type.
    let interval: NodeJS.Timeout | null = null;

    if (!isPaused) {
      // Start the interval if not paused.
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % cards.length);
      }, 3000);
    }

    // Clear the interval whenever `isPaused` changes.
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused, cards.length]); // Dependency array now includes isPaused.

  const currentCard = cards[currentIndex];

  const handleImageClick = () => {
    setIsModalOpen(true);
  };
  const setIndex = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true)
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <section className="flex flex-col mt-12">
      <div className="container grid items-center justify-center text-center  max-w-7xl">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl pb-8">
            Get Started in Few Steps
          </h2>
        </div>
        <div className="relative mx-10 pr-3 after:absolute after:left-8 after:right-8 after:top-1/2 after:block after:h-0.5 after:-translate-y-1/2 after:rounded-lg after:bg-primary max-w-7xl items-center ">
        <ol className="relative z-10 flex justify-between text-sm font-medium text-primary">
            {Array.from({ length: 4 }).map((_, index) => (
              <li className="flex items-center  bg-background p-2" key={index}>
                <button className={`size-6 rounded-full text-center text-[15px]/6 font-bold text-background ${index === currentIndex ? 'bg-primary' : 'bg-gray-400'
                  }`}
                  onMouseEnter={() => setIndex(index)}
                  onMouseLeave={() => setIsPaused(false)}
              >
                  <span
                    className={`size-6 rounded-full text-center text-[15px]/6 font-bold text-background ${index === currentIndex ? 'bg-primary' : 'bg-gray-400'
                      }`}
                  >
                    {index + 1}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
    <div className="flex px-6 justify-between w-full max-w-7xl ">
        <div className="text-center">
            <p className="text-muted-foreground pl-2">
                Hardware
            </p>
        </div>

        <div className="text-center pl-8">
            <p className="text-muted-foreground">
                Firmware
            </p>
        </div>

        <div className="text-center pl-6">
            <p className="text-muted-foreground">
              Connection
            </p>
        </div>

        <div className="text-center">
            <p className="text-muted-foreground pr-1">
               Visualization
            </p>
        </div>
    </div>
        <div className="container flex flex-col md:flex-row items-center justify-center text-center max-w-7xl">
              {/* Left Side - Image */}
              <div className=" w-full h-auto mt-10">
                <Image
                  src={currentCard.image}
                  alt={currentCard.title}
                  width={1150}
                  height={400}
                  className="rounded-md object-cover  cursor-pointer"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                  onClick={handleImageClick}
                />
              </div>
        </div>
        {/* Modal for Enlarged Image */}
        {isModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={closeModal}
          >
            <div className="relative bg-white p-4 rounded-lg shadow-lg">
              <Image
                src={currentCard.image}
                alt={currentCard.title}
                width={1200}
                height={1000}
                className="rounded-md object-cover"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              />
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-white bg-red-500 p-2 rounded-full shadow-lg hover:bg-red-600 transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                &times;
              </button>

            </div>
          </div>
        )}

      </div>
    </section>
  );
};

export default CardSlider;
