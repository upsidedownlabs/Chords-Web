import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import Link from "next/link";
import PlotIt from "./PlotIt";

const FAQSection = () => {
  const FAQs: { question: string; answer: React.ReactNode }[] = [
    {
      question: `What is the purpose of plot it?`,
      answer: (
        <>
          <PlotIt /> is made to plot biopotential signals like ECG, EMG or EOG
          in real time. It is made for educational & research purposes.
        </>
      ),
    },
    {
      question: `What kind of data plot it collects?`,
      answer: (
        <>
          It collects the biopotential data from the device connected to the
          serial port. It does not collect any private data or cookies from the
          user.
        </>
      ),
    },
    {
      question: "How can I raise an issue, or suggest an improvement?",
      answer: (
        <>
          You can raise an issue or suggest an improvement on our{" "}
          <Link
            href="https://github.com/upsidedownlabs/BioSignal-Recorder-Web/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline underline-offset-4"
          >
            GitHub Issues page
          </Link>
          .
        </>
      ),
    },
    {
      question: "From where I can collect required hardware for plot it?",
      answer: (
        <>
          You can collect the required hardware from{" "}
          <Link
            href="https://linktr.ee/Upside_Down_Labs_Stores"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline underline-offset-4"
          >
            Upside Down Labs Stores
          </Link>{" "}
          directly.
        </>
      ),
    },
    {
      question: "What are the limitations of plot it?",
      answer: (
        <>
          <PlotIt /> uses{" "}
          <Link
            href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline underline-offset-4"
          >
            web serial api
          </Link>{" "}
          to connect to the device port, which is only supported in chromium
          based broswers (Google chrome, Opera, Microsoft Edge).
        </>
      ),
    },
    {
      question: "For how long the data can be recorded?",
      answer: (
        <>
          For data recording we are using{" "}
          <Link
            href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline underline-offset-4"
          >
            IndexedDB API
          </Link>
          , which allows to store upto 80% of the disk space of your laptop.
          <br />
        </>
      ),
    },
    {
      question: "What data format does Plot It support?",
      answer: (
        <>
          Plot It supports an array format: [counter, A0, A1, ..., A6], where
          counter is a uint8_t (0-255) and A0-A6 are raw signal values. Array
          example : [10, 468, 472, 463, 466, 465]. For implementation details,
          see our{" "}
          <Link
            href="https://github.com/upsidedownlabs/BioSignal-Recorder-Web/blob/main/ArduinoFirmware/ArduinoFirmware.ino"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline underline-offset-4"
          >
            Arduino firmware code
          </Link>
          .
        </>
      ),
    },
    {
      question: "Which microcontrollers are supported by plot it?",
      answer: (
        <>
          Arduino Uno, Arduino Nano & Maker Uno are tested and supported by{" "}
          <PlotIt />.
        </>
      ),
    },
    {
      question:
        "Can I use any microcontroller other than the ones mentioned above?",
      answer: (
        <>
          Yes, you just have to make sure that microcontroller is providing a
          compatible data format to the software. By doing this you can use any
          microcontroller with <PlotIt />
        </>
      ),
    },
    {
      question: "How to check if I have dropped samples/data?",
      answer: (
        <>
          There are two checks for dropped samples, first is the counter value,
          if it is not incrementing by 1 then there are dropped samples. Second
          if data rate is below 245 samples per second. In both cases you can
          find how much data you lost in console.
        </>
      ),
    },
    {
      question: "How to check the drift of my recorded data?",
      answer: (
        <>
          The default sampling rate we are using is 250 samples/second. The
          number of samples which were expected in the given time and the number
          of samples which were actually recorded can be used to calculate the
          drift in data. For example for 10 mintues of recording we should have
          250*60*10 = 150000 samples. If we have less than 150000 samples then
          we have a drift in our data.
        </>
      ),
    },
  ];
  return (
    <section className="w-full py-8 pb-12 md:pb-24 lg:pb-24 mx-auto lg:md:sm:px-0 px-3">
      <h1 className="text-3xl font-bold text-center text-foreground md:text-4xl lg:text-5xl">
        Frequently Asked Questions
      </h1>
      <div className="max-w-3xl mx-auto mt-8">
        <Accordion type="single" collapsible className="w-full">
          {FAQs.map((faq, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger>
                <p className="text-lg font-semibold text-foreground/90 text-left">
                  {faq.question}
                </p>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-[1rem] text-muted-foreground">
                  {faq.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
