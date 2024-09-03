import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { CircleAlert } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";

const Version = process.env.NEXT_PUBLIC_VERSION;
const contributors = [
  {
    name: "Deepak Khatri",
    github: "lorforlinux",
    avatar: "https://avatars.githubusercontent.com/u/20015794?v=4",
  },
  {
    name: "Deepesh Kumar",
    github: "akadeepesh",
    avatar: "https://avatars.githubusercontent.com/u/100466756?v=4",
  },
  {
    name: "Mahesh Tupe",
    github: "Asc91",
    avatar: "https://avatars.githubusercontent.com/u/55803500?v=4",
  },
  {
    name: "Ritika Mishra",
    github: "Ritika8081",
    avatar: "https://avatars.githubusercontent.com/u/103934960?v=4",
  },
  {
    name: "Aman Maheshwari",
    github: "Amanmahe",
    avatar: "https://avatars.githubusercontent.com/Amanmahe",
  },
];

const Contributors = () => {
  return (
    <div>
      <Dialog>
        <DialogTrigger>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3">
                  <CircleAlert />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Contributors</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogTrigger>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <Card className="border-none -m-5">
            <CardHeader>
              <p>Chords:{Version}</p>
              <CardTitle className="text-lg">Contributors</CardTitle>
              <Separator className="bg-primary" />
            </CardHeader>
            <CardContent className="flex justify-center items-center gap-5">
              {contributors.map((contributor) => (
                <Link
                  key={contributor.github}
                  href={`https://github.com/${contributor.github}`}
                  target="_blank"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant={"ghost"} size={"sm"}>
                          <Avatar>
                            <AvatarImage src={contributor.avatar} />
                            <AvatarFallback>
                              {contributor.name.split(" ")[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{contributor.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Link>
              ))}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contributors;
