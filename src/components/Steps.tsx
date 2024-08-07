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
    "https://docs.upsidedownlabs.tech/_images/connections-with-arduino.png",
    "https://docs.upsidedownlabs.tech/_images/connection-with-cable.png",
    "https://docs.upsidedownlabs.tech/_images/emg.png",
    "https://docs.upsidedownlabs.tech/_images/ecg.png",
    "https://docs.upsidedownlabs.tech/_images/eog-horizontal.png",
    "https://docs.upsidedownlabs.tech/_images/eog-vertical.png",
  ];

  const carouselItems = [
    {
      title: "BioAmp hardware to MCU/ADC Connection",
      content: (
        <>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>BioAmp</TableHead>
                <TableHead className="text-right">MCU/ADC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">VCC</TableCell>
                <TableCell className="text-right">5V</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GND</TableCell>
                <TableCell className="text-right">GND</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">OUT</TableCell>
                <TableCell className="text-right">ADC Input</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-destructive mt-4 text-sm font-semibold">
             Warning: If power pins are swapped, your BioAmp hardware will be
               fried and become unusable (DIE).
          </p>

        </>
      ),
    },
    {
      title: "Connection with Arduino",
      image: ImageLinks[0],
    },
    {
      title: "BioAmp Cable Connections",
      content: (
        <div className="flex flex-col items-center">
          <ol className="list-decimal pl-4 text-sm sm:text-base mb-4">
            <li>
              Connect the BioAmp cable to BioAmp hardware by inserting the cable
              end in the JST PH connector.
            </li>
            <li>Connect the BioAmp cable to gel electrodes.</li>
            <li>Peel the plastic backing from electrodes.</li>
          </ol>
          <Image
            alt="Cable connection"
            width={320}
            height={320}
            src={ImageLinks[1]}
            className="rounded-xl object-contain max-h-[200px]"
          />
        </div>
      ),
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
    <div className="flex flex-col justify-center items-center gap-4 min-h-[calc(100vh-8rem)] px-4">
      <div className="flex items-center justify-center text-sm sm:text-xl text-center">
        <span className="flex flex-row gap-2">
          Click{" "}
          <Badge className="cursor-default">
            <p className="text-sm sm:text-base">&quot;Connect&quot;</p>
          </Badge>{" "}
          For Board Connection.
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
      <div className="relative w-full max-w-7xl mt-4">
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full select-none px-12"
        >
          <CarouselContent>
            {carouselItems.map((item, index) => (
              <CarouselItem key={index} className="sm:basis-1/1 lg:basis-1/2">
                <Card className="border-primary h-full">
                  <CardContent className="flex flex-col h-[400px] p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold mb-4 text-left">
                      {item.title}
                    </h3>
                    <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
                      {item.image ? (
                        <Image
                          alt={item.title}
                          width={500}
                          height={500}
                          src={item.image}
                          className="rounded-xl h-full w-full object-contain"
                        />
                      ) : (
                        item.content
                      )}
                    </div>
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
