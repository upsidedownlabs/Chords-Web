"use client";
import React, { useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Cable,
  Circle,
  CircleStop,
  CircleX,
  FileArchive,
  FileDown,
  Infinity,
} from "lucide-react";
import { vendorsList } from "./vendors";
import { BoardsList } from "./UDL_Boards";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { BitSelection } from "./DataPass";

import { Separator } from "./ui/separator";
import { Switch } from "../components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
interface ConnectionProps {
  LineData: Function;
  Connection: (isConnected: boolean) => void;
  selectedBits: BitSelection;
  setSelectedBits: React.Dispatch<React.SetStateAction<BitSelection>>;
}

const Connection: React.FC<ConnectionProps> = ({
  LineData,
  Connection,
  selectedBits,
  setSelectedBits,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false); // State to track if the device is connected
  const isConnectedRef = useRef<boolean>(false); // Ref to track if the device is connected
  const isRecordingRef = useRef<boolean>(false); // Ref to track if the device is recording
  const [isEndTimePopoverOpen, setIsEndTimePopoverOpen] = useState(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null); // State to store the detected bits
  const [datasets, setDatasets] = useState<string[][][]>([]); // State to store the recorded datasets
  const [elapsedTime, setElapsedTime] = useState<number>(0); // State to store the recording duration
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store the timer interval
  const [customTime, setCustomTime] = useState<string>(""); // State to store the custom stop time input
  const endTimeRef = useRef<number | null>(null); // Ref to store the end time of the recording
  const startTimeRef = useRef<number | null>(null); // Ref to store the start time of the recording
  const bufferRef = useRef<string[][]>([]); // Ref to store the data temporary buffer during recording

  const portRef = useRef<SerialPort | null>(null); // Ref to store the serial port
  const readerRef = useRef<
    ReadableStreamDefaultReader<Uint8Array> | null | undefined
  >(null); // Ref to store the reader for the serial port

  const handleTimeSelection = (minutes: number | null) => {
    // Function to handle the time selection
    if (minutes === null) {
      endTimeRef.current = null;
      toast.success("Recording set to no time limit");
    } else {
      // If the time is not null, set the end time
      const newEndTimeSeconds = minutes * 60;
      if (newEndTimeSeconds <= elapsedTime) {
        // Check if the end time is greater than the current elapsed time
        toast.error("End time must be greater than the current elapsed time");
      } else {
        endTimeRef.current = newEndTimeSeconds; // Set the end time
        toast.success(`Recording end time set to ${minutes} minutes`);
      }
    }
  };

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Function to handle the custom time input change
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomTime(value);
  };

  const handleCustomTimeSet = () => {
    // Function to handle the custom time input set
    const time = parseInt(customTime);
    if (!isNaN(time) && time > 0) {
      handleTimeSelection(time);
    } else {
      toast.error("Please enter a valid time in minutes");
    }
    setCustomTime("");
  };

  const formatPortInfo = useCallback(
    // Function to format the port info, which includes the board name and product ID in toast message
    (info: SerialPortInfo) => {
      if (!info || !info.usbVendorId) {
        return "Port with no info";
      }

      // First, check if the board exists in BoardsList
      const board = BoardsList.find(
        (b) => parseInt(b.field_pid) === info.usbProductId
      );
      if (board) {
        setDetectedBits(board.bits as BitSelection); // Set the detected bits
        setSelectedBits(board.bits as BitSelection); // Set the selected bits
        return `${board.name} | Product ID: ${info.usbProductId}`; // Return the board name and product ID
      }

      setDetectedBits(null);

      // If not found in BoardsList, fall back to the vendor check
      const vendorName =
        vendorsList.find((d) => parseInt(d.field_vid) === info.usbVendorId)
          ?.name ?? "Unknown Vendor";
      return `${vendorName} | Product ID: ${info.usbProductId}`;
    },
    [setSelectedBits]
  );

  const handleClick = () => {
    // Function to handle toggle for connect/disconnect button
    if (isConnected) {
      disconnectDevice();
    } else {
      connectToDevice();
    }
  };

  const connectToDevice = async () => {
    // Function to connect to the device
    try {
      const port = await navigator.serial.requestPort(); // Request the serial port
      await port.open({ baudRate: 115200 }); // Open the port with baud rate 115200
      Connection(true); // Set the connection state to true, which will enable the data visualization as it is getting used is DataPaas
      setIsConnected(true);
      isConnectedRef.current = true;
      portRef.current = port;
      toast.success("Connection Successfull", {
        description: (
          <div className="mt-2 flex flex-col space-y-1">
            <p>Device: {formatPortInfo(portRef.current.getInfo())}</p>
            <p>Baud Rate: 115200</p>
          </div>
        ),
      });
      const reader = port.readable?.getReader();
      readerRef.current = reader;
      readData(); // Start reading the data from the device
      await navigator.wakeLock.request("screen"); // Request the wake lock to keep the screen on
    } catch (error) {
      // If there is an error during connection, disconnect the device
      disconnectDevice();
      isConnectedRef.current = false;
      setIsConnected(false);
      console.error("Error connecting to device:", error);
    }
  };

  const disconnectDevice = async (): Promise<void> => {
    // Function to disconnect the device
    try {
      if (portRef.current && portRef.current.readable) {
        // Check if the port is available and readable
        if (readerRef.current) {
          await readerRef.current.cancel(); // Cancel the reader
          readerRef.current.releaseLock(); // Release the reader lock
        }
        await portRef.current.close();
        portRef.current = null;
        toast("Disconnected from device", {
          action: {
            label: "Reconnect",
            onClick: () => connectToDevice(),
          },
        });
      }
    } catch (error) {
      console.error("Error during disconnection:", error);
    } finally {
      setIsConnected(false);
      Connection(false);
      isConnectedRef.current = false;
      isRecordingRef.current = false;
    }
  };

  const readData = async (): Promise<void> => {
    // Function to read the data from the device
    const decoder = new TextDecoder(); // Create a new text decoder
    let lineBuffer = ""; // Initialize the line buffer
    while (isConnectedRef.current) {
      // Loop until the device is connected
      try {
        const StreamData = await readerRef.current?.read(); // Read the data from the device
        if (StreamData?.done) {
          console.log("Thank you for using our app!");
          break;
        }
        const receivedData = decoder.decode(StreamData?.value, {
          stream: true,
        });
        const lines = (lineBuffer + receivedData).split("\n"); // Split the data by new line
        lineBuffer = lines.pop() ?? ""; // Get the last line
        for (const line of lines) {
          // Loop through the lines
          const dataValues = line.split(",");
          if (dataValues.length === 1) {
          } else {
            LineData(dataValues); // Pass the data values to the LineData function which will be used by DataPass to pass to the Canvas component
            if (isRecordingRef.current) {
              bufferRef.current.push(dataValues); // Push the data values to the buffer if recording is on
            }
          }
        }
      } catch (error) {
        console.error("Error reading from device:", error);
        break;
      }
    }
    await disconnectDevice();
  };

  const columnNames = [
    "Counter",
    "Channel 1",
    "Channel 2",
    "Channel 3",
    "Channel 4",
  ];

  const convertToCSV = (buffer: string[][]): string => {
    // Function to convert the buffer data to CSV
    const headerRow = columnNames.join(",");
    const rows = buffer.map((row) => row.map(Number).join(","));
    const csvData = [headerRow, ...rows].join("\n");
    return csvData;
  };

  const handleRecord = () => {
    if (isConnected) {
      if (isRecordingRef.current) {
        stopRecording(); // Stop the recording if it is already on
      } else {
        isRecordingRef.current = true; // Set the recording state to true
        const now = new Date();
        const nowTime = now.getTime();
        startTimeRef.current = nowTime;
        setElapsedTime(0);
        timerIntervalRef.current = setInterval(checkRecordingTime, 1000);
      }
    } else {
      toast.warning("No device is connected");
    }
  };

  const checkRecordingTime = () => {
    setElapsedTime((prev) => {
      const newElapsedTime = prev + 1; // Increment the elapsed time by 1 second every second
      if (endTimeRef.current !== null && newElapsedTime >= endTimeRef.current) {
        stopRecording();
        return endTimeRef.current;
      }
      return newElapsedTime;
    });
  };

  const formatDuration = (durationInSeconds: number): string => {
    const minutes = Math.floor(durationInSeconds / 60); // Get the minutes
    const seconds = durationInSeconds % 60;
    if (minutes === 0) {
      return `${seconds} second${seconds !== 1 ? "s" : ""}`;
    }
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ${seconds} second${
      seconds !== 1 ? "s" : ""
    }`;
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      // Clear the timer interval if it is set
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (startTimeRef.current === null) {
      // Check if the start time is set properly
      toast.error("Start time was not set properly.");
      return;
    }

    const endTime = new Date();
    const endTimeString = endTime.toLocaleTimeString();
    const startTimeString = new Date(startTimeRef.current).toLocaleTimeString();
    const durationInSeconds = Math.round(
      (endTime.getTime() - startTimeRef.current) / 1000
    );

    if (bufferRef.current.length > 0) {
      const data = [...bufferRef.current]; // Create a copy of the current buffer
      setDatasets((prevDatasets) => {
        const newDatasets = [...prevDatasets, data];
        return newDatasets;
      });

      bufferRef.current = []; // Clear the buffer ref
    }

    toast.success("Recording completed Successfully", {
      description: (
        <div className="mt-2 flex flex-col space-y-1">
          <p>Start Time: {startTimeString}</p>
          <p>End Time: {endTimeString}</p>
          <p>Recording Duration: {formatDuration(durationInSeconds)}</p>
          <p>Stored Recorded Files: {datasets.length + 1}</p>
        </div>
      ),
    });

    isRecordingRef.current = false;

    startTimeRef.current = null;
    endTimeRef.current = null;
    setElapsedTime(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const saveData = async () => {
    if (datasets.length === 1) {
      const csvData = convertToCSV(datasets[0]);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
      saveAs(blob, "data.csv");
    } else if (datasets.length > 1) {
      const zip = new JSZip();
      datasets.forEach((data, index) => {
        const csvData = convertToCSV(data);
        zip.file(`data${index + 1}.csv`, csvData);
      });
      const zipContent = await zip.generateAsync({ type: "blob" });
      saveAs(zipContent, "datasets.zip");
    } else {
      toast.error("No data available to download.");
    }
  };

  return (
    <div className="flex h-14 items-center justify-between px-4">
      <div className="flex-1">
        {isRecordingRef.current && (
          <div className="flex justify-center items-center space-x-1 w-min">
            <div className="font-medium p-2 w-16 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm ring-offset-background transition-colors bg-primary text-destructive hover:bg-primary/90">
              {formatTime(elapsedTime)}
            </div>
            <Separator orientation="vertical" className="bg-primary h-9" />
            <div className="">
              <Popover
                open={isEndTimePopoverOpen}
                onOpenChange={setIsEndTimePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    className="text-lg w-16 h-9 font-medium p-2"
                    variant="destructive"
                  >
                    {endTimeRef.current === null ? (
                      <Infinity className="h-5 w-5 text-primary" />
                    ) : (
                      <div className="text-sm text-primary font-medium">
                        {formatTime(endTimeRef.current)}
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" side="right">
                  <div className="flex flex-col space-y-4">
                    <div className="text-sm font-medium">
                      Set End Time (minutes)
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 10, 20, 30].map((time) => (
                        <Button
                          key={time}
                          variant="outline"
                          size="sm"
                          onClick={() => handleTimeSelection(time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                    <div className="flex space-x-2 items-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Custom"
                        value={customTime}
                        onBlur={handleCustomTimeSet}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCustomTimeSet()
                        }
                        onChange={handleCustomTimeChange}
                        className="w-20"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTimeSelection(null)}
                      >
                        <Infinity className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-4 flex-1 justify-center">
        <Button className="bg-primary gap-2" onClick={handleClick}>
          {isConnected ? (
            <>
              Disconnect
              <CircleX size={17} />
            </>
          ) : (
            <>
              Connect
              <Cable size={17} />
            </>
          )}
        </Button>
        {isConnected && (
          <div className="flex items-center space-x-2">
            {detectedBits ? (
              <Button
                variant="outline"
                className=" w-36 gap-2 flex justify-between items-center overflow-hidden"
                onClick={() =>
                  setSelectedBits(
                    selectedBits === "auto" ? detectedBits : "auto"
                  )
                }
              >
                <span className="">Autoscale</span>
                <Switch
                  checked={selectedBits === "auto"}
                  onCheckedChange={() => {}}
                  className="mr-1 pointer-events-none"
                />
              </Button>
            ) : (
              <Select
                onValueChange={(value) =>
                  setSelectedBits(value as BitSelection)
                }
                value={selectedBits}
              >
                <SelectTrigger className="w-32 text-background bg-primary">
                  <SelectValue placeholder="Select bits" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value="ten">10 bits</SelectItem>
                  <SelectItem value="twelve">12 bits</SelectItem>
                  <SelectItem value="fourteen">14 bits</SelectItem>
                  <SelectItem value="auto">Auto Scale</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <Button onClick={handleRecord}>
                <TooltipTrigger asChild>
                  {isRecordingRef.current ? (
                    <CircleStop />
                  ) : (
                    <Circle fill="red" />
                  )}
                </TooltipTrigger>
              </Button>
              <TooltipContent>
                <p>
                  {!isRecordingRef.current
                    ? "Start Recording"
                    : "Stop Recording"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {datasets.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <Button onClick={saveData}>
                <TooltipTrigger asChild>
                  {datasets.length === 1 ? (
                    <FileDown />
                  ) : (
                    <span className="flex flex-row justify-center items-center">
                      <FileArchive />
                      <p className=" text-lg">{`(${datasets.length})`}</p>
                    </span>
                  )}
                </TooltipTrigger>
              </Button>
              <TooltipContent>
                {datasets.length === 1 ? (
                  <p>Save As CSV</p>
                ) : (
                  <p>Save As Zip</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex-1"></div>
    </div>
  );
};

export default Connection;
