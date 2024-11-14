import * as React from "react";
import { Card, CardContent } from "./ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import Link from "next/link";
import { Badge } from "./ui/badge";
import Image from "next/image";

const Steps: React.FC = () => {
  const ImageLinks = [
    "./steps/1.png",
    "./steps/2.png",
    "./steps/3.png",
    "./steps/4.png",
    "./steps/5.png",
    "./steps/6.png",
  ];

  const carouselItems = [
    {
      title: "BioAmp hardware to MCU/ADC Connection",
      image: ImageLinks[0],
    },
    {
      title: "Connection with Arduino",
      image: ImageLinks[1],
    },
    {
      title: "BioAmp Cable Connections",
      image: ImageLinks[2],
    },
    {
      title: "Electrodes placement for EMG",
      image: ImageLinks[2],
    },
    {
      title: "Electrodes placement for ECG",
      image: ImageLinks[3],
    },
    {
      title: "Placement for EOG Horizontal",
      image: ImageLinks[4],
    },
    {
      title: "Placement for EOG Vertical",
      image: ImageLinks[5],
    },
  ];

  return (
    <div className="flex flex-col flex-[1_1_0%] min-h-100 justify-center items-center gap-2 min-h-[calc(80vh)]  bg-g ">
      <div className="flex items-center justify-center text-sm sm:text-xl text-center">
      <span className="flex flex-row gap-2">
          Click Connect For Board Connection.
        </span>
      </div>
      <div className="text-sm sm:text-base text-muted-foreground text-center">
        For More Detailed Steps Please Refer{" "}
        <Link
          href="https://docs.upsidedownlabs.tech/hardware/bioamp/bioamp-exg-pill/index.html"
          className="underline underline-offset-4"
        >
          Official Documentation
        </Link>
      </div>
      <div className="relative w-full max-w-7xl mt-6">
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full select-none px-12"
        >
          <CarouselContent>
            {carouselItems.map((item, index) => (
              <CarouselItem key={index} className="sm:basis-1/1 md:basis-1/2 lg:basis-1/2 xl:basis-1/2 2xl:basis-1/3">
                <Card className="border-primary h-[60vh]">
                  <CardContent className="flex flex-col h-[calc(60vh)] p-4 sm:p-6">
                    <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
                      {item.image &&(
                        <Image
                          alt={item.title}
                          width={500}
                          height={500}
                          src={item.image}
                          className="rounded-xl h-full w-full object-contain"
                        />
                    )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-4 text-left">
                      {item.title}
                    </h3>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="border-primary border-2 left-2 absolute" />
          <CarouselNext className="border-primary border-2 right-2 absolute" />
        </Carousel>
      </div>
    </div>
  );
};

export default Steps;