import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";
import Link from "next/link";
import Image from "next/image";

// Define the type for carousel items
type CarouselItemType = {
  title: string;
  image: string;
};

const Steps: React.FC = () => {
  const ImageLinks: string[] = [
    "./steps/1.webp",
    "./steps/2.webp",
    "./steps/3.webp",
    "./steps/4.webp",
    "./steps/5.webp",
    "./steps/6.webp",
  ];

  const carouselItems: CarouselItemType[] = [
    { title: "BioAmp hardware to MCU/ADC Connection", image: ImageLinks[0] },
    { title: "Connection with Arduino", image: ImageLinks[1] },
    { title: "BioAmp Cable Connections", image: ImageLinks[2] },
    { title: "Electrodes placement for ECG", image: ImageLinks[3] },
    { title: "Placement for EOG Horizontal", image: ImageLinks[4] },
    { title: "Placement for EOG Vertical", image: ImageLinks[5] },
  ];

  const [selectedItem, setSelectedItem] = React.useState<CarouselItemType | null>(null);

  const handleImageClick = (item: CarouselItemType) => {
    setSelectedItem(item);
  };

  const closeModal = () => {
    setSelectedItem(null);
  };

  return (
    <div className="flex flex-col flex-[1_1_0%] min-h-80 justify-center items-center gap-0 2xl:gap-2">
      <div className="flex items-center justify-center text-sm sm:text-xl text-center">
        <span className="flex flex-row gap-2 mt-6">
          Click Connect For Board Connection.
        </span>
      </div>
      <div className="text-sm sm:text-base text-muted-foreground text-center pb-4">
        For More Detailed Steps Please Refer{" "}
        <Link
          href="https://docs.upsidedownlabs.tech/hardware/bioamp/bioamp-exg-pill/index.html"
          className="underline underline-offset-4"
        >
          Official Documentation
        </Link>
      </div>
      <div className="relative w-full max-w-7xl 2xl:max-w-[195vh] overflow-x-auto">
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full select-none px-12"
        >
          <CarouselContent>
            {carouselItems.map((item, index) => (
              <CarouselItem
                key={index}
                className="sm:basis-1/1 md:basis-1/4 lg:basis-1/4 xl:basis-1/4 2xl:basis-1/4"
              >
                <div
                  onClick={() => handleImageClick(item)}
                  className="cursor-pointer"
                >
                  <Image
                    alt={item.title}
                    width={800}
                    height={300}
                    src={item.image}
                    layout="responsive"
                    className="rounded-xl md:max-h-[50vh] lg:max-h-[40vh] 2xl:w-[50vh] w-full object-contain h-auto"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="border-primary border-2 left-2 absolute" />
          <CarouselNext className="border-primary border-2 right-2 absolute" />
        </Carousel>
      </div>

      {/* Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={closeModal}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <Image
              alt={selectedItem.title}
              src={selectedItem.image}
              width={800}
              height={800}
              layout="responsive"
              className="rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Steps;
