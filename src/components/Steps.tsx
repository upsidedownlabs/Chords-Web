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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Separator } from "./ui/separator";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import Image from "next/image";

const Steps = () => {
  const ImageLinks = [
    "https://docs.upsidedownlabs.tech/_images/connections-with-arduino.png",
    "https://docs.upsidedownlabs.tech/_images/connection-with-cable.png",
    "https://docs.upsidedownlabs.tech/_images/emg.png",
    "https://docs.upsidedownlabs.tech/_images/ecg.png",
    "https://docs.upsidedownlabs.tech/_images/eog-horizontal.png",
    "https://docs.upsidedownlabs.tech/_images/eog-vertical.png",
  ];

  return (
    <div className="flex flex-col justify-center items-center gap-4 min-h-[calc(100vh-8rem)] py-8 px-4">
      <div className="flex items-center justify-center text-sm sm:text-xl text-center whitespace-nowrap">
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
          href={
            "https://docs.upsidedownlabs.tech/hardware/bioamp/bioamp-exg-pill/index.html"
          }
          className="underline underline-offset-4"
        >
          Official Documentation
        </Link>
      </div>
      <Carousel
        opts={{
          align: "start",
        }}
        className="w-full max-w-7xl"
      >
        <CarouselContent>
          {/* First slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex aspect-square items-center justify-center p-2 sm:p-4 lg:p-6">
                  <div className="flex justify-center items-center flex-col gap-4 text-xs sm:text-sm h-full">
                    <p className=" text-lg font-semibold">
                      Connect your BioAmp hardware to your MCU/ADC as per the
                      connection table shown below:
                    </p>
                    <div className="w-full max-w-[200px] sm:max-w-none">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/2">BioAmp</TableHead>
                            <TableHead className="text-right">
                              MCU/ADC
                            </TableHead>
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
                            <TableCell className="text-right">
                              ADC Input
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* Second slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex aspect-square items-center justify-center p-2 sm:p-4 lg:p-6">
                  <Image
                    alt="Connection with Arduino"
                    width={500}
                    height={500}
                    src={ImageLinks[0]}
                    className="rounded-xl max-h-full max-w-full object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* Third slide: Combine cable connection and gel electrodes info */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex flex-col aspect-square items-center justify-between p-2 sm:p-4 lg:p-6">
                  <div className="text-xs sm:text-sm lg:text-base mb-4">
                    <h3 className="text-base sm:text-xl font-semibold mb-2">
                      BioAmp Cable Connections
                    </h3>
                    <ol className="list-decimal pl-4">
                      <li>
                        Connect the BioAmp cable to BioAmp hardware by inserting
                        the cable end in the JST PH connector.
                      </li>
                      <li>Connect the BioAmp cable to gel electrodes.</li>
                      <li>Peel the plastic backing from electrodes.</li>
                    </ol>
                  </div>
                  <Image
                    alt="Cable connection"
                    width={320}
                    height={320}
                    src={ImageLinks[1]}
                    className="rounded-xl max-h-[60%] object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* EMG slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex flex-col aspect-square items-center justify-between p-2 sm:p-4 lg:p-6">
                  <div className="text-xs sm:text-sm lg:text-base mb-4">
                    <h3 className="text-base sm:text-xl font-semibold mb-2">
                      Electrodes placement for EMG
                    </h3>
                    <p>
                      Place the IN+ and IN- cables on the arm near the ulnar
                      nerve & REF (reference) at the back of your hand as shown
                      in the diagram.
                    </p>
                  </div>
                  <Image
                    alt="EMG electrode placement"
                    width={360}
                    height={360}
                    src={ImageLinks[2]}
                    className="rounded-xl max-h-[60%] object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* ECG slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex flex-col aspect-square items-center justify-between p-2 sm:p-4 lg:p-6">
                  <div className="text-xs sm:text-sm lg:text-base mb-4">
                    <h3 className="text-base sm:text-xl font-semibold mb-2">
                      Electrodes placement for ECG
                    </h3>
                    <p>
                      Place the IN- cable on the left side, IN+ in the middle
                      and REF (reference) on the far right side as shown in the
                      diagram.
                    </p>
                  </div>
                  <Image
                    alt="ECG electrode placement"
                    width={360}
                    height={360}
                    src={ImageLinks[3]}
                    className="rounded-xl max-h-[60%] object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* EOG Horizontal slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex flex-col aspect-square items-center justify-between p-2 sm:p-4 lg:p-6">
                  <div className="text-xs sm:text-sm lg:text-base mb-4">
                    <h3 className="text-base sm:text-xl font-semibold mb-2">
                      Electrodes placement for EOG Horizontal
                    </h3>
                    <p>
                      Place the IN- cable on the right side of the eye, IN+ on
                      the left side of the eye and REF (reference) at the bony
                      part, on the back side of your earlobe as shown in the
                      diagram.
                    </p>
                  </div>
                  <Image
                    alt="EOG Horizontal electrode placement"
                    width={320}
                    height={320}
                    src={ImageLinks[4]}
                    className="rounded-xl max-h-[60%] object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>

          {/* EOG Vertical slide */}
          <CarouselItem className="sm:basis-1/2 lg:basis-1/3 select-none">
            <div className="p-1">
              <Card className="border-primary">
                <CardContent className="flex flex-col aspect-square items-center justify-between p-2 sm:p-4 lg:p-6">
                  <div className="text-xs sm:text-sm lg:text-base mb-4">
                    <h3 className="text-base sm:text-xl font-semibold mb-2">
                      Electrodes placement for EOG Vertical
                    </h3>
                    <p>
                      Place the IN- & IN+ cables above and below the eye
                      respectively and REF (reference) at the bony part, on the
                      back side of your earlobe as shown in the diagram.
                    </p>
                  </div>
                  <Image
                    alt="EOG Vertical electrode placement"
                    width={340}
                    height={340}
                    src={ImageLinks[5]}
                    className="rounded-xl max-h-[60%] object-contain"
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious className="border-primary border-2 hidden sm:flex" />
        <CarouselNext className="border-primary border-2 hidden sm:flex" />
      </Carousel>
    </div>
  );
};

export default Steps;
