import React from "react";
import { Card } from "../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import Image from "next/image";
import { Separator } from "./ui/separator";
const InCompatibleBrowser = () => {
  const browsers = [
    {
      name: "Google Chrome",
      image:
        "https://img.icons8.com/?size=100&id=63785&format=png&color=000000",
    },
    {
      name: "Microsoft Edge",
      image:
        "https://img.icons8.com/?size=100&id=-5h34CbaUb09&format=png&color=000000",
    },
    {
      name: "Opera",
      image:
        "https://img.icons8.com/?size=100&id=63646&format=png&color=000000",
    },
  ];
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl w-full">
      <div className="flex flex-col gap-10 justify-center items-center">
        <h1 className="text-6xl text-destructive font-bold text-center mb-8 flex items-center justify-center gap-0 lg:gap-2 font-yanone">
          ! Browser Not Supported
        </h1>
      </div>

      <Separator className="my-7" />
      <div className="text-4xl font-semibold text-center mb-8">
        Supported Browsers
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-12">
        {browsers.map((browser) => (
          <Card key={browser.name} className="p-6 flex flex-col items-center">
            <Image
              width={70}
              height={70}
              src={browser.image}
              alt="Supported Browser"
            />
            <p className="text-center font-medium">{browser.name}</p>
          </Card>
        ))}
      </div>

      <Separator className=" my-7" />
      <h2 className="text-4xl font-semibold text-center mb-8">
        Frequently Asked Questions
      </h2>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Why is my browser not supported?</AccordionTrigger>
          <AccordionContent>
            This application uses the Web Serial API to establish a connection
            with the COM port. Youre seeing this message because the browser
            youre using does not support the Web Serial API.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger>How can I access the application?</AccordionTrigger>
          <AccordionContent>
            To access the application, please use a Chromium-based browser such
            as Google Chrome, Microsoft Edge or Opera. These browsers support
            the Web Serial API required for this application to function
            properly. You can download one of these browsers from their official
            websites.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger>
            Will other browsers be supported in the future?
          </AccordionTrigger>
          <AccordionContent>
            Support for the Web Serial API is determined by browser developers.
            While its primarily available in Chromium-based browsers now, other
            browsers may add support in the future. We recommend checking your
            preferred browsers documentation or using a supported browser for
            the best experience.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default InCompatibleBrowser;
