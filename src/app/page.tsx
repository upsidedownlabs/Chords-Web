import React from "react";
import Navbar from "../components/Navbar";
import { Skeleton } from "../components/ui/skeleton";
import dynamic from "next/dynamic";
import Steps from "../components//LandingComp/Steps";
import { Separator } from "../components/ui/separator";
import { Features } from "../components/LandingComp/Features";
import FAQSection from "../components/LandingComp/FAQSection";
import Footer from "../components/LandingComp/Footer";

const HeadSection = dynamic(
  () => import("../components/LandingComp/HeadSection"),
  {
    loading: () => <SkeletonUI />,
    ssr: false,
  }
);

const TechStack = dynamic(() => import("../components/LandingComp/TechStack"), {
  ssr: false,
});

const SkeletonUI = () => (
  <div className="container max-w-6xl mx-auto p-4 space-y-16">
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-3/4 mx-auto" />
      <Skeleton className="h-12 w-2/3 mx-auto" />
    </div>
    <div className="flex space-x-4 justify-center">
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-10 w-32" />
    </div>

    <Skeleton className="h-[1000px] w-full" />
  </div>
);

const page = () => {
  return (
    <>
      <Navbar />
      <div className="flex flex-col">
        <HeadSection />
        <Separator className="mt-20" />
        <Steps />
        <Separator className="mt-20" />
        <Features />
        <Separator className="mt-20" />
        <TechStack />
        <Separator className="mt-20" />
        <FAQSection />
        <Footer />
      </div>
    </>
  );
};

export default page;
