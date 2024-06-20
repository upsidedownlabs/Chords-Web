/* eslint-disable @next/next/no-img-element */
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

const Steps = () => {
  const ImageLinks = [
    "https://docs.upsidedownlabs.tech/_images/connections-with-arduino.png",
    "https://docs.upsidedownlabs.tech/_images/connection-with-cable.png",
    "https://docs.upsidedownlabs.tech/_images/emg.png",
  ];

  return (
    <div className="flex justify-center items-center gap-4 flex-col md:h-[85%] h-[78%]">
      <div className="flex items-center justify-center text-xl">
        <span className="flex flex-row gap-2">
          Click{" "}
          <Badge className="cursor-default">
            <p className="text-base">&quot;Connect&quot;</p>
          </Badge>{" "}
          For Board Connection.
        </span>
      </div>
      <div className="text-sm text-muted-foreground">
        For More Detailed Steps Please Refer{" "}
        <Link
          href={
            "https://docs.upsidedownlabs.tech/hardware/bioamp/bioamp-exg-pill/index.html"
          }
          className="underline underline-offset-2"
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
          {Array.from({ length: 6 }).map((_, index) => (
            <CarouselItem
              key={index}
              className="md:basis-1/2 lg:basis-1/3 select-none"
            >
              <div className="p-1">
                <Card className="border-primary">
                  <CardContent className="flex aspect-square items-center justify-center p-6">
                    {index % 2 === 0 ? (
                      <div className="">
                        {index === 0 && (
                          <div className="flex justify-center items-center flex-col gap-8 text-sm">
                            Connect your BioAmp EXG Pill to your MCU/ADC as per
                            the connection table shown below:
                            <Table>
                              <TableCaption>
                                BioAmp to MCU/ADC connection.
                              </TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className=" w-48">
                                    BioAmp
                                  </TableHead>
                                  <TableHead className="text-right">
                                    MCU/ADC
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    VCC
                                  </TableCell>

                                  <TableCell className="text-right">
                                    5V
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    GND
                                  </TableCell>

                                  <TableCell className="text-right">
                                    GND
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="font-medium">
                                    OUT
                                  </TableCell>

                                  <TableCell className="text-right">
                                    ADC Input
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {index === 2 && (
                          <div className="flex mb-14 flex-col">
                            <span className="text-xl font-semibold">
                              Connecting electrode cable
                              <Separator className="bg-primary" />
                            </span>
                            <div className="flex justify-center items-center">
                              <span className="w-2/3 text-lg mt-14">
                                Connect the BioAmp cable to BioAmp EXG Pill by
                                inserting the cable end in the JST PH connector
                                as shown in the Image{" "}
                                <MoveRight className="w-min inline" />
                              </span>
                            </div>
                          </div>
                        )}
                        {index === 4 && (
                          <div className="flex mb-14 flex-col">
                            <span className="text-xl font-semibold mb-14">
                              Electrodes placement for EMG
                              <Separator className="bg-primary" />
                            </span>
                            <div className="flex justify-center items-center">
                              <div className="w-2/3">
                                <ol className="list-decimal">
                                  <li>
                                    Connect the BioAmp cable to gel electrodes.
                                  </li>
                                  <li>
                                    Peel the plastic backing from electrodes.
                                  </li>
                                  <li>
                                    Place the IN+ and IN- cables on the arm near
                                    the ulnar nerve & REF (reference) at the
                                    back of your hand as shown in the connection
                                    diagram.
                                  </li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <img
                        alt={`Step ${index + 1}`}
                        src={ImageLinks[Math.floor(index / 2)]}
                        className="rounded-xl h-60"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="border-primary border-2" />
        <CarouselNext className="border-primary border-2" />
      </Carousel>
    </div>
  );
};

export default Steps;
