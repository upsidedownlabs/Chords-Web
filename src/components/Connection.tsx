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
  Infinity,
  Trash2,
  Download,
  Pause,
  Play,
  Grid,
  List,
} from "lucide-react";
import { BoardsList } from "./boards";
import { toast } from "sonner";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { delay } from "framer-motion";

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
  const [open, setOpen] = useState(false); // State to track if the recording popover is open
  const [isConnected, setIsConnected] = useState<boolean>(false); // State to track if the device is connected
  const isConnectedRef = useRef<boolean>(false); // Ref to track if the device is connected
  const isRecordingRef = useRef<boolean>(false); // Ref to track if the device is recording
  const [isEndTimePopoverOpen, setIsEndTimePopoverOpen] = useState(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null); // State to store the detected bits
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
  const [ifBits, setifBits] = useState<BitSelection>("auto");
  const readerRef = useRef<
    ReadableStreamDefaultReader<Uint8Array> | null | undefined
  >(null); // Ref to store the reader for the serial port
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );

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
      // console.log(info);

      // First, check if the board exists in BoardsList
      const board = BoardsList.find(
        (b) => parseInt(b.field_pid) === info.usbProductId
      );
      if (board) {
        setifBits(board.bits as BitSelection);
        setSelectedBits(board.bits as BitSelection);
        return `${board.name} | Product ID: ${info.usbProductId}`; // Return the board name and product ID
      }

      setDetectedBits(null);
    },
    []
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
    try {
      const port = await navigator.serial.requestPort(); // Request the serial port
      await port.open({ baudRate: 115200 }); // Open the port with baud rate 115200
      Connection(true); // Set the connection state to true, enabling the data visualization
      setIsConnected(true);
      isConnectedRef.current = true;
      portRef.current = port;

      toast.success("Connection Successful", {
        description: (
          <div className="mt-2 flex flex-col space-y-1">
            <p>Device: {formatPortInfo(port.getInfo())}</p>
            <p>Baud Rate: 115200</p>
          </div>
        ),
      });

      // Get the reader from the port
      const reader = port.readable?.getReader();
      readerRef.current = reader;

      // Get the writer from the port (check if it's available)
      const writer = port.writable?.getWriter();
      if (writer) {
        setTimeout(function(){
          writerRef.current = writer;
          const message = new TextEncoder().encode("START\n");
          writerRef.current.write(message);
        },2000);
      } else {
        console.error("Writable stream not available");
      }

      // Start reading the data from the device
      readData();

      // Request the wake lock to keep the screen on
      await navigator.wakeLock.request("screen");
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
        // Check if the writer is available to send the STOP command
        if (writerRef.current) {
          const stopMessage = new TextEncoder().encode("STOP\n"); // Prepare the STOP command
          console.log(stopMessage);
          await writerRef.current.write(stopMessage); // Send the STOP command to the device
          writerRef.current.releaseLock(); // Release the writer lock
          writerRef.current = null; // Reset the writer reference
        }

        // Cancel the reader to stop data flow
        if (readerRef.current) {
          await readerRef.current.cancel(); // Cancel the reader
          readerRef.current.releaseLock(); // Release the reader lock to allow other operations
          readerRef.current = null; // Reset the reader reference
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
    const buffer: number[] = []; // Buffer to store incoming data from the device
    const HEADER_LENGTH = 3;
    const NUM_CHANNELS = 6;
    const PACKET_LENGTH = 16; // Length of the expected data packet
    const SYNC_BYTE1 = 0xc7; // First synchronization byte to identify the start of a packet
    const SYNC_BYTE2 = 0x7c; // Second synchronization byte to identify the start of a packet
    const END_BYTE = 0x01; // End byte to identify the end of a packet
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    let hasRemovedInitialElements = false; // Flag to check if initial buffer elements have been removed

    try {
      while (isConnectedRef.current) {
        // Loop while the device is connected
        const streamData = await readerRef.current?.read(); // Read data from the device
        if (streamData?.done) {
          // Check if the data stream has ended
          console.log("Thank you for using our app!"); // Log a message when the stream ends
          break;
        }
        if (streamData) {
          const { value } = streamData; // Get the data from the stream
          buffer.push(...value); // Append the data to the buffer
        }

        while (buffer.length >= PACKET_LENGTH) {
          // Process packets while the buffer contains at least one full packet
          const syncIndex = buffer.findIndex(
            (byte, index) =>
              byte === SYNC_BYTE1 && buffer[index + 1] === SYNC_BYTE2 // Find the index of the sync bytes
          );

          if (syncIndex === -1) {
            // If no sync bytes are found, clear the buffer
            buffer.length = 0;
            continue;
          }

          if (syncIndex + PACKET_LENGTH <= buffer.length) {
            // Check if a full packet is available in the buffer
            const endByteIndex = syncIndex + PACKET_LENGTH - 1; // Calculate the index of the end byte

            if (
              buffer[syncIndex] === SYNC_BYTE1 &&
              buffer[syncIndex + 1] === SYNC_BYTE2 &&
              buffer[endByteIndex] === END_BYTE // Verify that the packet has the correct start and end bytes
            ) {
              const packet = buffer.slice(syncIndex, syncIndex + PACKET_LENGTH); // Extract the packet from the buffer
              const channelData: string[] = []; // Array to store the extracted channel data
              for (let channel = 0; channel < NUM_CHANNELS; channel++) {
                // Loop through each channel in the packet
                const highByte = packet[channel * 2 + HEADER_LENGTH]; // Extract the high byte for the channel
                const lowByte = packet[channel * 2 + HEADER_LENGTH + 1]; // Extract the low byte for the channel
                const value = (highByte << 8) | lowByte; // Combine the high and low bytes to get the channel value
                channelData.push(value.toString()); // Convert the value to string and store it in the array
              }
              const counter = packet[2]; // Extract the counter value from the packet
              channelData.push(counter.toString()); // Add the counter value to the channel data
              LineData(channelData); // Pass the channel data to the LineData function for further processing
              if (isRecordingRef.current) {
                // Check if recording is enabled
                bufferRef.current.push(channelData); // Store the channel data in the buffer if recording
              }

              if (previousCounter !== null) {
                // If there was a previous counter value
                const expectedCounter: number = (previousCounter + 1) % 256; // Calculate the expected counter value
                if (counter !== expectedCounter) {
                  // Check for data loss by comparing the current counter with the expected counter
                  console.warn(
                    `Data loss detected! Previous counter: ${previousCounter}, Current counter: ${counter}`
                  );
                }
              }
              previousCounter = counter; // Update the previous counter with the current counter
              buffer.splice(0, endByteIndex + 1); // Remove the processed packet from the buffer
            } else {
              buffer.splice(0, syncIndex + 1); // If the packet is invalid, remove the sync bytes and try again
            }
          } else {
            break; // If a full packet is not available, exit the loop and wait for more data
          }
        }
      }
    } catch (error) {
      console.error("Error reading from device:", error); // Handle any errors that occur during the read process
    } finally {
      await disconnectDevice(); // Ensure the device is disconnected when finished
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
      const request = indexedDB.open("adcReadings", 1); // Open a connection to the "adcReadings" IndexedDB database with version 1

      request.onupgradeneeded = (event) => {
        // Event triggered if the database version changes or the database is created for the first time
        const db = (event.target as IDBOpenDBRequest).result; // Get the IDBDatabase instance

        // Check if the "adcReadings" object store exists; if not, create it
        if (!db.objectStoreNames.contains("adcReadings")) {
          db.createObjectStore("adcReadings", {
            keyPath: "id", // Define the primary key for the object store
            autoIncrement: true, // Enable auto-increment for the primary key
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result); // Resolve the promise with the IDBDatabase instance when the connection is successful
      };

      request.onerror = () => {
        reject(request.error); // Reject the promise with the error if the connection fails
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
    <div className="flex h-14 items-center justify-center px-4">
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
            {ifBits ? (
              <Button
                variant={selectedBits === "auto" ? "default" : "outline"}
                className={`w-36 flex justify-center items-center overflow-hidden `}
                onClick={() =>
                  setSelectedBits(selectedBits === "auto" ? ifBits : "auto")
                }
                aria-label="Toggle Autoscale"
                disabled={!isDisplay} // Disable when paused
              >
                Autoscale
              </Button>
            ) : (
              <Select
                onValueChange={(value) =>
                  setSelectedBits(value as BitSelection)
                }
                value={selectedBits}
                disabled={!isDisplay} // Disable when paused
              >
                <SelectTrigger className="w-32">
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
                      <Download size={16} className="mr-1" />
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
                    <Button
                      className="rounded-r-none mr-1"
                      onClick={saveData} // Adjust functionality for saving multiple datasets if needed
                      disabled={!hasData}
                    >
                      <Download size={16} className="" />
                      <p className="text-lg">{datasets}</p>
                    </Button>
                    <Button
                      className="rounded-l-none"
                      onClick={deleteDataFromIndexedDB}
                      disabled={!hasData}
                    >
                      <Trash2 size={20} />
                    </Button>
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
