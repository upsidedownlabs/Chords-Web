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
      title: "BioAmp to MCU/ADC Connection",
      content: (
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
          <ol className="list-decimal pl-4 text-xs sm:text-sm mb-4">
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
      content: (
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs sm:text-sm">
            Place the IN+ and IN- cables on the arm near the ulnar nerve & REF
            (reference) at the back of your hand as shown in the diagram.
          </p>
          <Image
            alt="EMG electrode placement"
            width={360}
            height={360}
            src={ImageLinks[2]}
            className="rounded-xl object-contain max-h-[200px]"
          />
        </div>
      ),
    },
    {
      title: "Electrodes placement for ECG",
      content: (
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs sm:text-sm">
            Place the IN- cable on the left side, IN+ in the middle and REF
            (reference) on the far right side as shown in the diagram.
          </p>
          <Image
            alt="ECG electrode placement"
            width={360}
            height={360}
            src={ImageLinks[3]}
            className="rounded-xl object-contain max-h-[200px]"
          />
        </div>
      ),
    },
    {
      title: "Placement for EOG Horizontal",
      content: (
        <>
          <p className="text-xs sm:text-sm">
            Place the IN- cable on the right side of the eye, IN+ on the left
            side of the eye and REF (reference) at the bony part, on the back
            side of your earlobe as shown in the diagram.
          </p>
          <Image
            alt="EOG Horizontal electrode placement"
            width={320}
            height={320}
            src={ImageLinks[4]}
            className="rounded-xl max-h-[60%] object-contain mt-4"
          />
        </>
      ),
    },
    {
      title: "Placement for EOG Vertical",
      content: (
        <>
          <p className="text-xs sm:text-sm">
            Place the IN- & IN+ cables above and below the eye respectively and
            REF (reference) at the bony part, on the back side of your earlobe
            as shown in the diagram.
          </p>
          <Image
            alt="EOG Vertical electrode placement"
            width={340}
            height={340}
            src={ImageLinks[5]}
            className="rounded-xl max-h-[60%] object-contain mt-4"
          />
        </>
      ),
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
      <div className="text-xs sm:text-sm text-muted-foreground text-center">
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
              <CarouselItem key={index} className="sm:basis-1/2 lg:basis-1/3">
                <Card className="border-primary h-full">
                  <CardContent className="flex flex-col h-[400px] p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-4 text-center">
                      {item.title}
                    </h3>
                    <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
                      {item.image ? (
                        <Image
                          alt={item.title}
                          width={500}
                          height={500}
                          src={item.image}
                          className="rounded-xl max-h-full max-w-full object-contain"
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
