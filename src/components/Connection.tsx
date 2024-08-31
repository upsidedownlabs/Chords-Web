"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { SmoothieChart } from "smoothie";
import { Input } from "./ui/input";
import {
  Cable,
  Circle,
  CircleStop,
  CircleX,
  FileArchive,
  FileDown,
  Infinity,
  ArrowUp,
  Trash2,
  Download,
  Pause,
  Play,
  Grid,
  List,
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

import { ReadableStreamDefaultReadResult } from "stream/web";

interface ConnectionProps {
  LineData: Function;
  Connection: (isConnected: boolean) => void;
  selectedBits: BitSelection;
  setSelectedBits: React.Dispatch<React.SetStateAction<BitSelection>>;
  isGridView: boolean;
  setIsGridView: React.Dispatch<React.SetStateAction<boolean>>;
  isDisplay: boolean;
  setIsDisplay: React.Dispatch<React.SetStateAction<boolean>>;
}

const Connection: React.FC<ConnectionProps> = ({
  LineData,
  Connection,
  selectedBits,
  setSelectedBits,
  isGridView,
  setIsGridView,
  isDisplay,
  setIsDisplay,
}) => {
  const [open, setOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(false); // State to track if the device is connected
  const isConnectedRef = useRef<boolean>(false); // Ref to track if the device is connected
  const isRecordingRef = useRef<boolean>(false); // Ref to track if the device is recording
  const [isEndTimePopoverOpen, setIsEndTimePopoverOpen] = useState(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null); // State to store the detected bits
  const [indexTracker, setIndexTracker] = useState<number[]>([]); //keep track of indexes of files
  const [isRecordButtonDisabled, setIsRecordButtonDisabled] = useState(false); // New state variable
  const [datasets, setDatasets] = useState<string[][][]>([]); // State to store the recorded datasets
  const [hasData, setHasData] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0); // State to store the recording duration
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store the timer interval
  const [customTime, setCustomTime] = useState<string>(""); // State to store the custom stop time input
  const endTimeRef = useRef<number | null>(null); // Ref to store the end time of the recording
  const startTimeRef = useRef<number | null>(null); // Ref to store the start time of the recording
  const bufferRef = useRef<string[][]>([]); // Ref to store the data temporary buffer during recording
  const chartRef = useRef<SmoothieChart[]>([]); // Define chartRef using useRef
  const portRef = useRef<SerialPort | null>(null); // Ref to store the serial port
  const indexedDBRef = useRef<IDBDatabase | null>(null);
  // const [isPaused, setIsPaused] = useState<boolean>(false); // State to track if the data display is pause
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
      await port.open({ baudRate: 57600 }); // Open the port with baud rate 115200
      Connection(true); // Set the connection state to true, which will enable the data visualization as it is getting used is DataPaas
      setIsConnected(true);
      isConnectedRef.current = true;
      portRef.current = port;
      toast.success("Connection Successfull", {
        description: (
          <div className="mt-2 flex flex-col space-y-1">
            <p>Device: {formatPortInfo(port.getInfo())}</p>
            <p>Baud Rate: 57600</p>
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
          await readerRef.current.cancel(); // Cancel the reader to stop data flow
          readerRef.current.releaseLock(); // Release the reader lock to allow other operations
        }
        await portRef.current.close(); // Close the port to disconnect the device
        portRef.current = null; // Reset the port reference to null
  
        // Notify the user of successful disconnection with a reconnect option
        toast("Disconnected from device", {
          action: {
            label: "Reconnect",
            onClick: () => connectToDevice(), // Reconnect when the "Reconnect" button is clicked
          },
        });
      }
    } catch (error) {
      // Handle any errors that occur during disconnection
      console.error("Error during disconnection:", error);
    } finally {
      // Ensure the connection state is properly updated
      setIsConnected(false); // Update state to indicate the device is disconnected
      Connection(false); // Update any relevant state or UI to reflect disconnection
      isConnectedRef.current = false; // Reset the connection reference
      isRecordingRef.current = false; // Ensure recording is stopped
    }
  };
  

  // Function to read the data from the device
  const readData = async (): Promise<void> => {
    let bufferIndex = 0;
    const buffer: number[] = [];
    const PACKET_LENGTH = 17;
    const SYNC_BYTE1 = 0xa5;
    const SYNC_BYTE2 = 0x5a;
    const END_BYTE = 0x01;
    let previousCounter: number | null = null;
    let hasRemovedInitialElements = false;

    try {
      while (isConnectedRef.current) {
        const streamData = await readerRef.current?.read();
        if (streamData?.done) {
          console.log("Thank you for using our app!");
          break;
        }
        if (streamData) {
          const { value } = streamData;
          buffer.push(...value);
        }

        while (buffer.length >= PACKET_LENGTH) {
          const syncIndex = buffer.findIndex(
            (byte, index) =>
              byte === SYNC_BYTE1 && buffer[index + 1] === SYNC_BYTE2
          );

          if (syncIndex === -1) {
            buffer.length = 0;
            continue;
          }

          if (syncIndex + PACKET_LENGTH <= buffer.length) {
            const endByteIndex = syncIndex + PACKET_LENGTH - 1;

            if (
              buffer[syncIndex] === SYNC_BYTE1 &&
              buffer[syncIndex + 1] === SYNC_BYTE2 &&
              buffer[endByteIndex] === END_BYTE
            ) {
              const packet = buffer.slice(syncIndex, syncIndex + PACKET_LENGTH);
              const channelData: string[] = [];
              for (let i = 0; i < 6; i++) {
                const highByte = packet[4 + i * 2];
                const lowByte = packet[5 + i * 2];
                const value = (highByte << 8) | lowByte;
                channelData.push(value.toString());
              }
              const counter = packet[3];
              channelData.push(counter.toString());

              LineData(channelData);
              if (isRecordingRef.current) {
                bufferRef.current.push(channelData);
              }

              if (previousCounter !== null) {
                const expectedCounter: number = (previousCounter + 1) % 256;
                if (counter !== expectedCounter) {
                  console.warn(
                    `Data loss detected! Previous counter: ${previousCounter}, Current counter: ${counter}`
                  );
                }
              }
              previousCounter = counter;
              buffer.splice(0, endByteIndex + 1);
            } else {
              buffer.splice(0, syncIndex + 1);
            }
          } else {
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error reading from device:", error);
    } finally {
      await disconnectDevice();
    }
  };

  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return "";

    const header = Object.keys(data[0]);
    const rows = data.map((item) =>
      header
        .map((fieldName) =>
          item[fieldName] !== undefined && item[fieldName] !== null
            ? JSON.stringify(item[fieldName])
            : ""
        )
        .join(",")
    );

    return [header.join(","), ...rows].join("\n");
  };

  const handleRecord = async () => {
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

        // Initialize IndexedDB for this recording session
        try {
          const db = await initIndexedDB();
          indexedDBRef.current = db; // Store the database connection in a ref
        } catch (error) {
          console.error("Failed to initialize IndexedDB:", error);
          toast.error(
            "Failed to initialize storage. Recording may not be saved."
          );
        }
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

  // Updated stopRecording function
  const stopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (startTimeRef.current === null) {
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
      await saveDataDuringRecording(bufferRef.current);
      bufferRef.current = [];
    }

    const allData = await getAllDataFromIndexedDB();
    setHasData(allData.length > 0);
    const recordedFilesCount = allData.length;

    if (indexedDBRef.current) {
      indexedDBRef.current.close();
      indexedDBRef.current = null;
    }

    toast.success("Recording completed Successfully", {
      description: (
        <div className="mt-2 flex flex-col mb-4">
          <p>Start Time: {startTimeString}</p>
          <p>End Time: {endTimeString}</p>
          <p>Recording Duration: {formatDuration(durationInSeconds)}</p>
          <p>Files Recorded: {recordedFilesCount}</p>
          <p>Data saved to IndexedDB</p>
        </div>
      ),
    });

    isRecordingRef.current = false;
    startTimeRef.current = null;
    endTimeRef.current = null;
    setElapsedTime(0);

    setIsRecordButtonDisabled(true);
  };

  const checkDataAvailability = async () => {
    const allData = await getAllDataFromIndexedDB();
    setHasData(allData.length > 0);
  };

  // Call this function when your component mounts or when you suspect the data might change
  useEffect(() => {
    checkDataAvailability();
  }, []);

  // Add this function to save data to IndexedDB during recording
  const saveDataDuringRecording = async (data: string[][]) => {
    if (!isRecordingRef.current || !indexedDBRef.current) return;

    try {
      const tx = indexedDBRef.current.transaction(["adcReadings"], "readwrite");
      const store = tx.objectStore("adcReadings");

      for (const row of data) {
        await store.add({
          timestamp: new Date().toISOString(),
          channel_1: Number(row[0]),
          channel_2: Number(row[1]),
          channel_3: Number(row[2]),
          channel_4: Number(row[3]),
          counter: Number(row[6]),
        });
      }
    } catch (error) {
      console.error("Error saving data during recording:", error);
    }
  };
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Initialize IndexedDB
  const initIndexedDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("adcReadings", 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("adcReadings")) {
          db.createObjectStore("adcReadings", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  // Delete all data from IndexedDB
  const deleteDataFromIndexedDB = async () => {
    try {
      const db = await initIndexedDB();
      const tx = db.transaction(["adcReadings"], "readwrite");
      const store = tx.objectStore("adcReadings");

      // Clear the store
      const clearRequest = store.clear();
      clearRequest.onsuccess = async () => {
        console.log("All data deleted from IndexedDB");
        toast.success("Recorded file is deleted.");
        setOpen(false);

        // Check if there is any data left after deletion
        const allData = await getAllDataFromIndexedDB();
        setHasData(allData.length > 0);

        setIsRecordButtonDisabled(false); // Enable the record button after deletion
      };

      clearRequest.onerror = (error) => {
        console.error("Error deleting data from IndexedDB:", error);
        toast.error("Failed to delete data. Please try again.");
      };
    } catch (error) {
      console.error("Error initializing IndexedDB for deletion:", error);
    }
  };

  // New function to retrieve all data from IndexedDB
  const getAllDataFromIndexedDB = async (): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await initIndexedDB();
        const tx = db.transaction(["adcReadings"], "readonly");
        const store = tx.objectStore("adcReadings");

        const request = store.getAll();
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  // Updated saveData function
  const saveData = async () => {
    try {
      const allData = await getAllDataFromIndexedDB();

      if (allData.length === 0) {
        toast.error("No data available to download.");
        return;
      }

      // Ensure data is in the correct format
      const formattedData = allData.map((item) => ({
        timestamp: item.timestamp,
        channel_1: item.channel_1,
        channel_2: item.channel_2,
        channel_3: item.channel_3,
        channel_4: item.channel_4,
      }));

      setOpen(false);
      const csvData = convertToCSV(formattedData);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });

      // Get the current date and time
      const now = new Date();
      const formattedTimestamp = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours()
      ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      // Use the timestamp in the filename
      const filename = `recorded_data_${formattedTimestamp}.csv`;
      saveAs(blob, filename);

      await deleteDataFromIndexedDB();
      toast.success("Data downloaded and cleared from storage.");
      setHasData(false); // Update state after data is deleted
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save data. Please try again.");
    }
  };

  return (
    <div className="flex h-14 items-center justify-between px-4">
      <div className="flex-1">
        {isRecordingRef.current && (
          <div className="flex justify-center items-center space-x-1 w-min mx-4">
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
                <PopoverContent className="w-64 p-4 mx-4">
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
                variant={selectedBits === "auto" ? "outline" : "outline"}
                className={`w-36 flex justify-center items-center overflow-hidden ${
                  selectedBits === "auto"
                    ? "bg-white text-black"
                    : "bg-dark text-light"
                }`}
                onClick={() =>
                  setSelectedBits(
                    selectedBits === "auto" ? detectedBits : "auto"
                  )
                }
              >
                Autoscale
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
              <TooltipTrigger asChild>
                <Button onClick={() => setIsDisplay(!isDisplay)}>
                  {isDisplay ? (
                    <Pause className="h-5 w-5" /> // Show Pause icon when playing
                  ) : (
                    <Play className="h-5 w-5" /> // Show Play icon when paused
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isDisplay ? "Pause Data Display" : "Resume Data Display"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <Button onClick={handleRecord} disabled={isRecordButtonDisabled}>
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
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <div className="flex">
                {hasData && datasets.length === 1 && (
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-r-none"
                      onClick={saveData}
                      disabled={!hasData}
                    >
                      <FileDown className="mr-2" />
                    </Button>
                  </TooltipTrigger>
                )}
                <Separator orientation="vertical" className="h-full" />
                {hasData && datasets.length === 1 ? (
                  <Button
                    className="rounded-l-none"
                    onClick={deleteDataFromIndexedDB}
                    disabled={!hasData}
                  >
                    <Trash2 size={20} />
                  </Button>
                ) : (
                  <>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          className="rounded-r-none mr-1"
                          disabled={!hasData}
                        >
                          <FileArchive className="mr-2" />
                          <p className="text-lg">{datasets}</p>
                        </Button>
                      </PopoverTrigger>
                      <Button
                        className="rounded-l-none"
                        onClick={deleteDataFromIndexedDB}
                        disabled={!hasData}
                      >
                        <Trash2 size={20} />
                      </Button>
                      <PopoverContent className="w-80">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-red-500">Recorded File</span>
                            <div className="space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={saveData}
                                disabled={!hasData}
                              >
                                <Download size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
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
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="bg-primary gap-2"
                  onClick={() => setIsGridView(!isGridView)}
                >
                  {isGridView ? <List size={20} /> : <Grid size={20} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isGridView ? "Grid" : "List"}</p>
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
