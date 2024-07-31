import React from "react";
import Link from "next/link";
import PlotIt from "./PlotIt";
const Footer = () => {
  return (
    <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
      <p className="text-xs text-muted-foreground">
        <PlotIt /> | &copy; {new Date().getFullYear()}{" "}
        <Link href="https://upsidedownlabs.tech/" target="_blank">
          Upside Down Labs
        </Link>
      </p>
      <nav className="sm:ml-auto flex gap-4 sm:gap-6">
        <Link
          className="text-xs hover:underline underline-offset-4"
          target="_blank"
          href="https://www.linkedin.com/posts/upsidedownlabs_step-to-improve-signal-quality-activity-7210620110040965120-_sOk?utm_source=share&utm_medium=member_desktop"
        >
          Improve Signal Quality
        </Link>
        <Link
          className="text-xs hover:underline underline-offset-4"
          href="https://linktr.ee/Upside_Down_Labs_Stores"
          target="_blank"
        >
          Stores
        </Link>
      </nav>
    </footer>
  );
};

export default Footer;
