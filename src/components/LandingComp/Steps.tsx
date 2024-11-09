'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '../ui/card';

const CardSlider = () => {
  const cards = [
    {
      title: "Hardware",
      description: "Take a development board, BioAmp hardware, cables & electrodes. Make the connections.",
      image: "./steps/step1.webp",
    },
    {
      title: "Firmware",
      description: "Upload the provided code to your development board using Arduino IDE.",
      image: "./steps/step2.webp",
    },
    {
      title: "Connection",
      description: "Open Chords, click connect, choose COM port and start visualizing the signals.",
      image: "./steps/step3.webp",
    },
    {
      title: "Visualization",
      description: "Keep an eye on the system performance and make necessary adjustments.",
      image: "./steps/step4.webp",
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
      }, 2000);
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
    <div className="container grid items-center justify-center text-center max-w-7xl">
      {/* Heading */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl pb-8">
          Get Started in Few Steps
        </h2>
      </div>
  
      {/* Progress Line and Steps for small and medium screens */}
      <div className="relative mx-16 after:absolute after:left-8 after:right-8 after:top-1/2 after:block after:h-0.5 after:-translate-y-1/2 after:rounded-lg after:bg-primary max-w-7xl items-center lg:hidden">
        <ol className="relative z-10 flex justify-between text-sm font-medium text-primary">
          {Array.from({ length: 4 }).map((_, index) => (
            <li className="flex items-center bg-background p-2" key={index}>
              <button
                className={`size-6 rounded-full text-center text-[15px] font-bold text-background ${
                  index === currentIndex ? 'bg-primary' : 'bg-gray-400'
                }`}
                onMouseEnter={() => setIndex(index)}
                onMouseLeave={() => setIsPaused(false)}
              >
                <span>{index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
  
      {/* Labels for each step (shown on small and medium screens) */}
      <div className="flex justify-between w-full max-w-7xl lg:hidden">
        <div className="text-center pl-10">
          <p className="text-muted-foreground hidden sm:block">Hardware</p>
        </div>
        <div className="text-center pl-10">
          <p className="text-muted-foreground hidden sm:block">Firmware</p>
        </div>
        <div className="text-center pl-7">
          <p className="text-muted-foreground hidden sm:block">Connection</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground pr-10 hidden sm:block">Visualization</p>
        </div>
      </div>
  
      {/* Main Content with Sidebar on Right for Large Screens */}
      <div className="container flex flex-col lg:flex-row items-center justify-between text-center max-w-7xl sm-mt-10 md-mt-10">
        {/* Image */}
        <div className="w-full lg:w-[90%] h-auto">
          <Image
            src={currentCard.image}
            alt={currentCard.title}
            width={1500} // Adjust width for large screens
            height={500} // Adjust height for large screens
            className="rounded-md object-cover cursor-pointer lg:max-h-[500px]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onClick={handleImageClick}
          />
        </div>
  
        {/* Index Sidebar for Large Screens */}
        <div className="hidden lg:flex flex-col items-center ml-8">
          <ol className="space-y-4 text-sm font-medium text-primary">
            {Array.from({ length: 4 }).map((_, index) => (
              <li className="flex items-center bg-background p-2" key={index}>
                <button
                  className={`size-6 rounded-full text-center text-[15px] font-bold text-background ${
                    index === currentIndex ? 'bg-primary' : 'bg-gray-400'
                  }`}
                  onMouseEnter={() => setIndex(index)}
                  onMouseLeave={() => setIsPaused(false)}
                >
                  {index + 1}
                </button>
              </li>
            ))}
          </ol>
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
              className="rounded-md object-cover cursor-pointer"
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
