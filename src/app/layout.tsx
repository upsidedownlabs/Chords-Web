import React from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "../components/Theming/theme-provider";
import {
  Inter,
  Lobster_Two,
  Yanone_Kaffeesatz,
  Poppins,
} from "next/font/google";
import { cn } from "../lib/utils";
import { Toaster } from "../components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chords",
  description: "Web Serial based Biopotential Signal recorder application.",
  manifest: "/Chords-Web/manifest.json", // ✅ Add this line to register the manifest
};

const lobsterTwo = Lobster_Two({
  subsets: ["latin"],
  variable: "--font-lobster_two",
  weight: "400",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: "400",
});

const yanoneKaffeesatz = Yanone_Kaffeesatz({
  subsets: ["latin"],
  variable: "--font-yanone_kaffeesatz",
  weight: "400",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/Chords-Web/manifest.json" /> {/* ✅ Added manifest */}
      </head>
      <body
        className={cn(
          lobsterTwo.variable,
          inter.className,
          yanoneKaffeesatz.variable,
          poppins.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}