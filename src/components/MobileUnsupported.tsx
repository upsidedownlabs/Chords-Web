import React from "react";
import { motion } from "framer-motion";
import { TbDeviceMobileOff } from "react-icons/tb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { ChevronRight, Monitor } from "lucide-react";
import Chords from "./LandingComp/Chords";
import Link from "next/link";

export default function MobileUnsupported() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
<div className="min-h-screen bg-gradient-to-b from-black to-gray-800 text-white p-6 flex flex-col justify-between">
<motion.header
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5 }}
        className="text-center pt-10"
      >
        <h1 className="text-4xl font-bold mb-2">Oops! Mobile Detected</h1>
        <p className="text-xl">This app requires a desktop browser</p>
      </motion.header>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex justify-center items-center my-10"
      >
        <div className="relative">
          <TbDeviceMobileOff className="w-32 h-32 text-red-500" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-1 bg-red-500 rotate-45"></div>
          </div>
        </div>
        <ChevronRight className="w-12 h-12 mx-4" />
        <Monitor className="w-32 h-32 text-green-400" />
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white text-gray-800 rounded-lg p-6 shadow-lg"
      >
        <h2 className="text-2xl font-semibold mb-4">Why Desktop?</h2>
        <p className="mb-4">
          Our app uses advanced features like the Web Serial API, which are only
          available on desktop browsers. For the best experience, please switch
          to a desktop device.
        </p>
      </motion.div>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-8"
      >
        <h3 className="text-2xl font-semibold mb-4">FAQ</h3>
        <Accordion type="single" collapsible className="bg-white/10 rounded-lg">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-white mx-3">
              Can I use this app on my phone?
            </AccordionTrigger>
            <AccordionContent className="text-white/80 mx-3">
              Unfortunately, this app requires features only available on
              desktop browsers. For the full experience, please use a computer.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-white mx-3">
              Which desktop browsers are supported?
            </AccordionTrigger>
            <AccordionContent className="text-white/80 mx-3">
              We recommend using Chromium-based browsers like Google Chrome,
              Microsoft Edge, or Opera for the best compatibility.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-white mx-3">
              Will you develop a mobile version?
            </AccordionTrigger>
            <AccordionContent className="text-white/80 mx-3">
              We&apos;re always exploring ways to expand our app&apos;s
              accessibility. Stay tuned for updates on potential mobile support
              in the future!
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>

      <motion.footer
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="text-center py-6"
      >
        <p className="text-xs text-muted-foreground">
          <Chords /> | &copy; {new Date().getFullYear()}{" "}
          <Link href="https://upsidedownlabs.tech/" target="_blank">
            Upside Down Labs
          </Link>
        </p>
      </motion.footer>
    </div>
  );
}