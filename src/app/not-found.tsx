import React from "react";
import { Button } from "../components/ui/button";
import Navbar from "../components/Navbar";
import Link from "next/link";

const FourOFourPage = async () => {
  return (
    <div className="">
      <Navbar isDisplay={true}/>
      <div className="flex flex-col min-h-[85vh] mx-auto justify-center items-center size-full">
        <div className="text-center py-10 px-4 sm:px-6 lg:px-8">
          <h1 className="text-7xl font-bold sm:text-9xl text-primary">404</h1>
          <p className="text-muted-foreground">
            Sorry, we couldnt find that page.
          </p>
          <div className="mt-5 flex flex-col justify-center items-center gap-2 sm:flex-row sm:gap-3">
            <Link href="/">
              <Button>Go back home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FourOFourPage;
