"use client";
import Link from "next/link";
import React from "react";
import { Button } from "../ui/button";
import Image from "next/image";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import Chords from "./Chords";

const Stack = () => {
  const { theme } = useTheme();
  const stack = [
    {
      name: "Next.js",
      logo:
        theme === "light"
          ? "./assets/dark/next-js.png"
          : "./assets/light/nextjs.svg",
      url: "https://nextjs.org/",
      description: "The fantastic React framework for building web apps.",
    },
    {
      name: "Tailwind CSS",
      logo: "./assets/tailwindcss.svg",
      url: "https://tailwindcss.com/",
      description: "A utility-first CSS framework for rapid UI development.",
    },
    {
      name: "shadcn/ui",
      logo:
        theme === "light"
          ? "./assets/dark/ShadcnUI.png"
          : "./assets/light/ShadcnUI.png",
      url: "https://ui.shadcn.com",
      description: "Built with amazing components from shadcn/ui.",
    },
    {
      name: "webGl Plot",
      logo: "./assets/logo.svg",
      url: "https://github.com/danchitnis/webgl-plot",
      description: "Charts for plotting the data real time.",
    },
    {
      name: "Web Serial Api",
      logo:
        theme === "light"
          ? "./assets/dark/favicon.ico"
          : "./assets/light/favicon.ico",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API",
      description: "For connecting to the serial port of the device.",
    },
    {
      name: "IndexedDB API",
      logo:
        theme === "light"
          ? "./assets/dark/favicon.ico"
          : "./assets/light/favicon.ico",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API",
      description: "IndexedDB is a low-level API for client-side storage.",
    },
  ];
  return (
    <section className="w-full py-12">
  <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6 max-w-7xl">
    <div className="space-y-3">
      <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
        <Chords /> is open-source, and free to use.
      </h2>
      <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
        It is powered by the following technologies, that makes it super fast, efficient, and reliable.
      </p>
    </div>
    <div className="max-w-6xl mx-auto">
      <div className="grid gap-8 mt-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {stack.map((item, index) => (
          <Link
            key={index}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-6 space-y-4 transition-transform transform rounded-lg border border-gray-900 shadow-md hover:shadow-lg hover:scale-[1.05] hover:border-gray-500 hover:shadow-muted-foreground"
          >
            <Image
              src={item.logo}
              alt={item.name}
              width={60}
              height={60}
              className="w-16 h-16"
            />
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
    <div className="flex justify-center space-x-4 mt-8">
      <Link href="/stream">
        <Button>Visualize Now &rarr;</Button>
      </Link>
      <Link
        href="https://github.com/upsidedownlabs/Chords-Web"
        target="_blank"
      >
        <Button variant="outline">
          <GitHubLogoIcon className="mr-2 h-4 w-4" /> Source Code
        </Button>
      </Link>
    </div>
  </div>
</section>

  );
};

export default Stack;
