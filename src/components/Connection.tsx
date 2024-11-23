"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Notch } from './filters';

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
  Plus,
  Minus,
  ZoomIn, // For magnify/zoom in functionality
  ZoomOut, // For zoom out functionality
  CircleOff,
  ReplaceAll,
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
import { BitSelection } from "./DataPass";
import { Separator } from "./ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";

interface ConnectionProps {
  onPauseChange: (pause: boolean) => void; // Callback to pass pause state to parent
  datastream: (data: number[]) => void;
  Connection: (isConnected: boolean) => void;
  selectedBits: BitSelection;
  setSelectedBits: React.Dispatch<React.SetStateAction<BitSelection>>;
  isDisplay: boolean;
  setIsDisplay: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasCount: React.Dispatch<React.SetStateAction<number>>; // Specify type for setCanvasCount
  canvasCount: number;
  channelCount: number;
  SetZoom: React.Dispatch<React.SetStateAction<number>>;
  Zoom: number;
}

const Connection: React.FC<ConnectionProps> = ({
  onPauseChange,
  datastream,
  Connection,
  selectedBits,
  setSelectedBits,
  isDisplay,
  setIsDisplay,
  setCanvasCount,
  canvasCount,
  SetZoom,
  Zoom,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false); // State to track if the device is connected
  const isConnectedRef = useRef<boolean>(false); // Ref to track if the device is connected
  const isRecordingRef = useRef<boolean>(false); // Ref to track if the device is recording
  const [isEndTimePopoverOpen, setIsEndTimePopoverOpen] = useState(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null); // State to store the detected bits
  const detectedBitsRef = React.useRef<BitSelection | null>(null);
  const [isRecordButtonDisabled, setIsRecordButtonDisabled] = useState(false); // New state variable
  const [datasets, setDatasets] = useState<string[][][]>([]); // State to store the recorded datasets
  const [hasData, setHasData] = useState(false);
  const [recData, setrecData] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0); // State to store the recording duration
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Type for Node.js environment
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [customTime, setCustomTime] = useState<string>(""); // State to store the custom stop time input
  const endTimeRef = useRef<number | null>(null); // Ref to store the end time of the recording
  const startTimeRef = useRef<number | null>(null); // Ref to store the start time of the recording
  const bufferRef = useRef<number[][]>([]); // Ref to store the data temporary buffer during recording
  const portRef = useRef<SerialPort | null>(null); // Ref to store the serial port
  const indexedDBRef = useRef<IDBDatabase | null>(null);
  const [ifBits, setifBits] = useState<BitSelection>("auto");
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [FullZoom, setFullZoom] = useState(false);
  const readerRef = useRef<
    ReadableStreamDefaultReader<Uint8Array> | null | undefined
  >(null); // Ref to store the reader for the serial port
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );
  const buffer: number[] = []; // Buffer to store incoming data
  const bufferdRef = useRef<number[][][]>([[], []]); // Two buffers: [0] and [1]
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const filterRef = useRef<number | null>(null);

  const togglePause = () => {
    const newPauseState = !isDisplay;
    setIsDisplay(newPauseState);
    onPauseChange(newPauseState); // Notify parent about the change
  };
  const increaseCanvas = () => {
    if (canvasCount < 6) {
      setCanvasCount(canvasCount + 1); // Increase canvas count up to 6
    }
  };

  const decreaseCanvas = () => {
    if (canvasCount > 1) {
      setCanvasCount(canvasCount - 1); // Decrease canvas count but not below 1
    }
  };
  const toggleShowAllChannels = () => {
    if (canvasCount === 6) {
      setCanvasCount(1); // If canvasCount is 6, reduce it to 1
      setShowAllChannels(false);
    } else {
      setCanvasCount(6); // Otherwise, show all 6 canvases
      setShowAllChannels(true);
    }
  };

  const increaseZoom = () => {
    if (Zoom < 10) {
      SetZoom(Zoom + 1); // Increase canvas count up to 6
    }
  };

  const decreaseZoom = () => {
    if (Zoom > 1) {
      SetZoom(Zoom - 1); // Decrease canvas count but not below 1
    }
  };
  const toggleZoom = () => {
    if (Zoom === 10) {
      SetZoom(1); // If canvasCount is 6, reduce it to 1
      setFullZoom(false);
    } else {
      SetZoom(10); // Otherwise, show all 6 canvases
      setFullZoom(true);
    }
  };

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
        setifBits(board.bits as BitSelection);
        setSelectedBits(board.bits as BitSelection);
        detectedBitsRef.current = board.bits as BitSelection;
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
  let lastConnectedPort: SerialPort | null = null;

  const connectToDevice = async () => {
    try {
      if (portRef.current && portRef.current.readable) {
        await disconnectDevice();
      }

      const port = lastConnectedPort || await navigator.serial.requestPort();
      await port.open({ baudRate: 230400 });
      Connection(true);
      setIsConnected(true);
      onPauseChange(true);
      setIsDisplay(true);
      isConnectedRef.current = true;
      portRef.current = port;
      lastConnectedPort = port;
      toast.success("Connection Successful", {
        description: (
          <div className="mt-2 flex flex-col space-y-1">
            <p>Device: {formatPortInfo(port.getInfo())}</p>
            <p>Baud Rate: 230400</p>
          </div>
        ),
      });

      const reader = port.readable?.getReader();
      readerRef.current = reader;

      const writer = port.writable?.getWriter();
      if (writer) {
        setTimeout(function () {
          writerRef.current = writer;
          const message = new TextEncoder().encode("START\n");
          writerRef.current.write(message);
        }, 2000);
      } else {
        console.error("Writable stream not available");
      }

      readData();

      await navigator.wakeLock.request("screen");
    } catch (error) {
      await disconnectDevice();
      console.error("Error connecting to device:", error);
      toast.error("Failed to connect to device.");
    }
  };
  const sample = useCallback((bits: BitSelection | null): number => {
    if (bits === null) {
      return 0; // Default value for null input
    }
    console.log(bits);
    switch (bits) {
      case "fourteen":
        return 1;
      case "ten":
        return 2;
      default:
        return 0; // Fallback value for unexpected cases
    }
  }, []);

  const disconnectDevice = async (): Promise<void> => {
    try {
      if (portRef.current) {
        if (writerRef.current) {
          const stopMessage = new TextEncoder().encode("STOP\n");
          try {
            await writerRef.current.write(stopMessage);
          } catch (error) {
            console.error("Failed to send STOP command:", error);
          }
          writerRef.current.releaseLock();
          writerRef.current = null;
        }

        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (error) {
            console.error("Failed to cancel reader:", error);
          }
          readerRef.current.releaseLock();
          readerRef.current = null;
        }

        if (portRef.current.readable) {
          await portRef.current.close();
        }
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
      isConnectedRef.current = false;
      isRecordingRef.current = false;
      Connection(false);
    }
  };
  const appliedFiltersRef = React.useRef<{ [key: number]: number }>({});
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const removeFilter = (channelIndex: number) => {
    delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
    forceUpdate(); // Trigger re-render
    console.log(`Filter removed from Channel ${channelIndex}`);
  };

  // Function to handle frequency selection
  const handleFrequencySelection = (channelIndex: number, frequency: number) => {
    appliedFiltersRef.current[channelIndex] = frequency; // Update the filter for the channel
    forceUpdate(); //Trigger re-render
    console.log(
      `Channel ${channelIndex} selected with frequency ${frequency}Hz`
    );
  };

  // Function to set the same filter for all channels
  const applyFilterToAllChannels = (channels: number[], frequency: number) => {
    channels.forEach((channelIndex) => {
      appliedFiltersRef.current[channelIndex] = frequency; // Set the filter for the channel
    });
    forceUpdate(); // Trigger re-render
    console.log(
      `Filter set to ${frequency}Hz for all channels: ${channels.join(", ")}`
    );
  };

  // Function to remove the filter for all channels
  const removeFilterFromAllChannels = (channels: number[]) => {
    channels.forEach((channelIndex) => {
      delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
    });
    forceUpdate(); // Trigger re-render
    console.log(`Filters removed from all channels: ${channels.join(", ")}`);
  };

  // Function to read data from a connected device and process it
  const readData = async (): Promise<void> => {
    const HEADER_LENGTH = 3; // Length of the packet header
    const NUM_CHANNELS = 6; // Number of channels in the data packet
    const PACKET_LENGTH = 16; // Total length of each packet
    const SYNC_BYTE1 = 0xc7; // First synchronization byte to identify the start of a packet
    const SYNC_BYTE2 = 0x7c; // Second synchronization byte
    const END_BYTE = 0x01; // End byte to signify the end of a packet
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const notchFilters = [
      new Notch(), // Notch_1
      new Notch(), // Notch_2
      new Notch(), // Notch_3
      new Notch(), // Notch_4
      new Notch(), // Notch_5
      new Notch(), // Notch_6
    ];

    try {
      // Loop while the device is connected
      while (isConnectedRef.current) {
        const streamData = await readerRef.current?.read(); // Read data from the device
        if (streamData?.done) {
          // Check if the data stream has ended
          console.log("Thank you for using our app!"); // Log a message when the stream ends
          break; // Exit the loop if the stream is done
        }
        if (streamData) {
          const { value } = streamData; // Destructure the stream data to get its value
          buffer.push(...value); // Add the incoming data to the buffer
        }

        // Process packets while the buffer contains at least one full packet
        while (buffer.length >= PACKET_LENGTH) {
          // Find the index of the synchronization bytes in the buffer
          const syncIndex = buffer.findIndex(
            (byte, index) =>
              byte === SYNC_BYTE1 && buffer[index + 1] === SYNC_BYTE2
          );

          if (syncIndex === -1) {
            // If no sync bytes are found, clear the buffer and continue
            buffer.length = 0; // Clear the buffer
            continue;
          }

          if (syncIndex + PACKET_LENGTH <= buffer.length) {
            // Check if a full packet is available in the buffer
            const endByteIndex = syncIndex + PACKET_LENGTH - 1; // Calculate the index of the end byte

            if (
              buffer[syncIndex] === SYNC_BYTE1 &&
              buffer[syncIndex + 1] === SYNC_BYTE2 &&
              buffer[endByteIndex] === END_BYTE
            ) {
              // Validate the packet by checking the sync and end bytes
              const packet = buffer.slice(syncIndex, syncIndex + PACKET_LENGTH); // Extract the packet from the buffer
              const channelData: number[] = []; // Array to store the extracted channel data
              for (let channel = 0; channel < NUM_CHANNELS; channel++) {
                const highByte = packet[channel * 2 + HEADER_LENGTH];
                const lowByte = packet[channel * 2 + HEADER_LENGTH + 1];
                const value = (highByte << 8) | lowByte;

                if (appliedFiltersRef.current[channel] !== undefined) {
                  // Apply the filter if one is set for this channel
                  channelData.push(
                    notchFilters[channel].process(
                      value,
                      appliedFiltersRef.current[channel],
                      sample(detectedBitsRef.current)
                    )
                  );
                } else {
                  // Push raw value if no filter is applied
                  channelData.push(value);
                }
              }

              const counter = packet[2]; // Extract the counter value from the packet
              channelData.push(counter); // Add the counter to the channel data
              datastream(channelData); // Pass the channel data to the LineData function for further processing

              if (isRecordingRef.current) {
                // Check if recording is enabled
                bufferRef.current.push(channelData); // Store the channel data in the recording buffer
              }

              if (previousCounter !== null) {
                // If there was a previous counter value, check for data loss
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
              buffer.splice(0, syncIndex + 1); // If packet is incomplete, remove bytes up to the sync byte
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

  // Function to handle the recording process
  const handleRecord = async () => {
    // Check if a device is connected
    if (isConnected) {
      // If recording is already in progress, stop it
      if (isRecordingRef.current) {
        stopRecording(); // Stop the recording if it is already on
      } else {
        // Start a new recording session
        isRecordingRef.current = true; // Set the recording state to true
        const now = new Date(); // Get the current date and time
        const nowTime = now.getTime(); // Get the current time in milliseconds
        startTimeRef.current = nowTime; // Store the start time of the recording
        setElapsedTime(0); // Reset elapsed time for display
        timerIntervalRef.current = setInterval(checkRecordingTime, 1000); // Start a timer to check recording duration every second
        setrecData(true); // Set the state indicating recording data is being collected

        // Initialize IndexedDB for this recording session
        try {
          const db = await initIndexedDB(); // Attempt to initialize the IndexedDB
          indexedDBRef.current = db; // Store the database connection in a ref for later use
        } catch (error) {
          // Handle any errors during the IndexedDB initialization
          console.error("Failed to initialize IndexedDB:", error);
          toast.error(
            "Failed to initialize storage. Recording may not be saved."
          );
        }

        // Start reading and saving data
        recordingIntervalRef.current = setInterval(() => {
          const data = bufferRef.current; // Use bufferRef which stores actual data
          saveDataDuringRecording(data); // Save the data to IndexedDB
          bufferRef.current = []; // Clear the buffer after saving
        }, 1000); // Save data every 1 second or adjust the interval as needed
      }
    } else {
      // Notify the user if no device is connected
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
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ${seconds} second${seconds !== 1 ? "s" : ""
      }`;
  };

  // Updated stopRecording function
  const stopRecording = async () => {
    // Clear the timer if it is currently set
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const endTime = new Date(); // Capture the end time
    const recordedFilesCount = (await getAllDataFromIndexedDB()).length;

    // Check if startTimeRef.current is not null before using it
    if (startTimeRef.current !== null) {
      // Format the start and end times as readable strings
      const startTimeString = new Date(
        startTimeRef.current
      ).toLocaleTimeString();
      const endTimeString = endTime.toLocaleTimeString();

      // Calculate the duration of the recording
      const durationInSeconds = Math.floor(
        (endTime.getTime() - startTimeRef.current) / 1000
      );

      // Close IndexedDB reference
      if (indexedDBRef.current) {
        indexedDBRef.current.close();
        indexedDBRef.current = null; // Reset the reference
      }

      const allData = await getAllDataFromIndexedDB();
      setHasData(allData.length > 0);

      // Display the toast with all the details
      toast.success("Recording completed successfully", {
        description: (
          <div>
            <p>Start Time: {startTimeString}</p>
            <p>End Time: {endTimeString}</p>
            <p>Recording Duration: {formatDuration(durationInSeconds)}</p>
            <p>Samples Recorded: {recordedFilesCount}</p>
          </div>
        ),
      });
    } else {
      console.error("Start time is null. Unable to calculate duration.");
      toast.error("Recording start time was not captured.");
    }

    // Reset the recording state
    isRecordingRef.current = false;
    setElapsedTime(0);
    setrecData(false);
    setIsRecordButtonDisabled(true);
  };

  // Call this function when your component mounts or when you suspect the data might change
  useEffect(() => {
    const checkDataAndConnection = async () => {
      // Check if data exists in IndexedDB
      const allData = await getAllDataFromIndexedDB();
      setHasData(allData.length > 0);

      // Disable the record button if there is data in IndexedDB and device is connected
      setIsRecordButtonDisabled(allData.length > 0 || !isConnected);
    };

    checkDataAndConnection();
  }, [isConnected]);

  // Add this function to save data to IndexedDB during recording
  const saveDataDuringRecording = async (data: number[][]) => {
    if (!isRecordingRef.current || !indexedDBRef.current) return;

    try {
      const tx = indexedDBRef.current.transaction(["adcReadings"], "readwrite");
      const store = tx.objectStore("adcReadings");

      console.log(`Saving data for ${canvasCount} channels.`);

      for (const row of data) {
        // Ensure all channels are present by filling missing values with null
        const channels = row
          .slice(0, canvasCount)
          .map((value) => (value !== undefined ? value : null));

        await store.add({
          timestamp: new Date().toISOString(),
          channels, // Save the array of channels
          counter: row[6], // Adjust based on counter location
        });
      }
    } catch (error) {
      console.error("Error saving data during recording:", error);
    }
  };

  // Function to format time from seconds into a "MM:SS" string format

  const formatTime = (seconds: number): string => {
    // Calculate the number of minutes by dividing seconds by 60
    const mins = Math.floor(seconds / 60);

    // Calculate the remaining seconds after extracting minutes
    const secs = seconds % 60;

    // Return the formatted time string, ensuring two digits for minutes and seconds
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Function to initialize the IndexedDB and return a promise with the database instance
  const initIndexedDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      // Open a connection to the IndexedDB database named "adcReadings", version 1
      const request = indexedDB.open("adcReadings", 1);

      // Event handler for when the database needs to be upgraded (e.g., first creation)
      request.onupgradeneeded = (event) => {
        // Access the database instance from the event target
        const db = (event.target as IDBOpenDBRequest).result;

        // Create the object store "adcReadings" if it doesn't already exist
        if (!db.objectStoreNames.contains("adcReadings")) {
          const store = db.createObjectStore("adcReadings", {
            keyPath: "id", // Set the key path for the object store
            autoIncrement: true, // Enable auto-increment for the key
          });
          // Create an index for timestamps, allowing for easy querying
          store.createIndex("timestamp", "timestamp", { unique: false });
          // Create an index for channels, allowing for flexible data storage as an array
          store.createIndex("channels", "channels", { unique: false });
        }
      };

      // Event handler for successful opening of the database
      request.onsuccess = () => {
        resolve(request.result); // Resolve the promise with the database instance
      };

      // Event handler for any errors that occur during the request
      request.onerror = () => {
        reject(request.error); // Reject the promise with the error
      };
    });
  };

  // Delete all data from IndexedDB
  const deleteDataFromIndexedDB = async () => {
    try {
      // Initialize the IndexedDB
      const db = await initIndexedDB();

      // Start a readwrite transaction on the "adcReadings" object store
      const tx = db.transaction(["adcReadings"], "readwrite");
      const store = tx.objectStore("adcReadings");

      await store.clear();
      console.log("All data deleted from IndexedDB");
      toast.success("Recorded file is deleted.");

      // Check if there is any data left in the database after deletion
      const allData = await getAllDataFromIndexedDB();
      setHasData(allData.length > 0);
      setIsRecordButtonDisabled(false);
    } catch (error) {
      console.error("Error deleting data from IndexedDB:", error);
      toast.error("Failed to delete data. Please try again.");
    }
  };
  // Function to retrieve all data from the IndexedDB
  const getAllDataFromIndexedDB = async (): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Initialize the IndexedDB
        const db = await initIndexedDB();

        // Start a readonly transaction on the "adcReadings" object store
        const tx = db.transaction(["adcReadings"], "readonly");
        const store = tx.objectStore("adcReadings"); // Access the object store

        // Create a request to get all records from the store
        const request = store.getAll();

        // Event handler for successful retrieval of data
        request.onsuccess = () => {
          resolve(request.result); // Resolve the promise with the retrieved data
        };

        // Event handler for any errors that occur during the request
        request.onerror = (error) => {
          reject(error); // Reject the promise with the error
        };
      } catch (error) {
        // Handle any errors that occur during IndexedDB initialization
        reject(error); // Reject the promise with the initialization error
      }
    });
  };
  // Updated saveData function
  const saveData = async () => {
    try {
      const allData = await getAllDataFromIndexedDB(); // Fetch data from IndexedDB

      if (allData.length === 0) {
        toast.error("No data available to download.");
        return;
      }

      // Ensure all channel data is formatted properly and missing data is handled
      const formattedData = allData.map((item) => {
        const dynamicChannels: { [key: string]: number | null } = {};

        // Assume channels are stored as an array in `item.channels`
        const channels = item.channels || [];

        // Loop through the channels array based on canvasCount
        for (let i = 0; i < canvasCount; i++) {
          const channelKey = `channel_${i + 1}`; // Create a dynamic key for each channel
          dynamicChannels[channelKey] =
            channels[i] !== undefined ? channels[i] : null; // Handle missing data
        }

        return {
          timestamp: item.timestamp,
          ...dynamicChannels, // Spread the dynamic channels into the result object
          counter: item.counter || null, // Include the counter if available
        };
      });

      // Convert the formatted data to CSV
      const csvData = convertToCSV(formattedData);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });

      // Get the current date and time for the filename
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
      saveAs(blob, filename); // Trigger download

      // Delete the data from IndexedDB after saving
      await deleteDataFromIndexedDB(); // Clear the IndexedDB
      toast.success("Data downloaded and cleared from storage."); // Success notification

      // Check if any data remains after deletion
      const remainingData = await getAllDataFromIndexedDB();
      setHasData(remainingData.length > 0); // Update hasData state
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save data. Please try again.");
    }
  };
  // bg-gray-100 text-white p-2 flex-none flex items-center justify-center
  return (
    <div className="flex-none items-center justify-center pb-4 bg-g">
      {/* Left-aligned section */}
      <div className="absolute left-4 flex items-center mx-0 px-0 space-x-1">
        {isRecordingRef.current && (
          <div className="flex items-center space-x-1 w-min ml-2">
            <button className="flex items-center justify-center px-3 py-2   select-none min-w-20 bg-primary text-destructive whitespace-nowrap rounded-xl"
            >
              {formatTime(elapsedTime)}
            </button>
            <Separator orientation="vertical" className="bg-primary h-9 ml-2" />
            <div>
              <Popover
                open={isEndTimePopoverOpen}
                onOpenChange={setIsEndTimePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    className="flex items-center justify-center px-3 py-2   select-none min-w-12  text-destructive whitespace-nowrap rounded-xl"
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
                <PopoverContent className="w-64 p-4 mx-4 mb-2">
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

      {/* Center-aligned buttons */}
      <div className="flex gap-3 items-center justify-center">
        {/* Connection button with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="flex items-center justify-center gap-1 py-2 px-6 sm:py-3 sm:px-8 rounded-xl font-semibold" onClick={handleClick}>
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
            </TooltipTrigger>
            <TooltipContent>
              <p>{isConnected ? "Disconnect Device" : "Connect Device"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* Autoscale/Bit selection */}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <div className="flex items-center mx-0 px-0">
                {/* Decrease Canvas Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-xl rounded-r-none"
                      onClick={decreaseZoom}
                      disabled={Zoom === 1 || !isDisplay}
                    >
                      <ZoomOut size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{Zoom === 1 ? "We can't shrinkage" : "Decrease Zoom"}</p>
                  </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-full" />

                {/* Toggle All Channels Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="flex items-center justify-center px-3 py-2  rounded-none select-none min-w-12"
                      onClick={toggleZoom}
                      disabled={!isDisplay}
                    >
                      {Zoom}x
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{FullZoom ? "Remove Full Zoom" : "Full Zoom"}</p>
                  </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-full" />

                {/* Increase Canvas Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-xl rounded-l-none"
                      onClick={increaseZoom}
                      disabled={Zoom === 10 || !isDisplay}

                    >
                      <ZoomIn size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {Zoom >= 10 ? "Maximum Zoom Reached" : "Increase Zoom"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Display (Play/Pause) button with tooltip */}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="rounded-xl" onClick={togglePause}>
                  {isDisplay ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
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

        {/* Record button with tooltip */}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="rounded-xl"
                  onClick={handleRecord}
                  disabled={isRecordButtonDisabled || !isDisplay}
                >
                  {isRecordingRef.current ? (
                    <CircleStop />
                  ) : (
                    <Circle fill="red" />
                  )}
                </Button>
              </TooltipTrigger>
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

        {/* Save/Delete data buttons with tooltip */}
        {isConnected && (
          <TooltipProvider>
            <div className="flex">
              {hasData && datasets.length === 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-xl rounded-r-none"
                      onClick={saveData}
                      disabled={!hasData}
                    >
                      <Download size={16} className="mr-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save Data as CSV</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Separator orientation="vertical" className="h-full" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="rounded-xl rounded-r-none mr-1"
                    onClick={saveData}
                    disabled={!hasData}
                  >
                    <Download size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save Recording</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="rounded-xl rounded-l-none"
                    onClick={deleteDataFromIndexedDB}
                    disabled={!hasData}
                  >
                    <Trash2 size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Recording</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
        {isConnected && (
          <Popover
            open={isFilterPopoverOpen}
            onOpenChange={setIsFilterPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                className="flex items-center justify-center px-3 py-2 select-none min-w-12 whitespace-nowrap rounded-xl"
                disabled={!isDisplay}

              >
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-50 p-4 mx-4 mb-2">
              <div className="flex flex-col ">
                <div className="flex items-center pb-2 ">
                  {/* Filter Name */}
                  <div className="text-sm font-semibold w-12"><ReplaceAll size={20} /></div>
                  {/* Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFilterFromAllChannels([0, 1, 2, 3, 4, 5])}
                      className={
                        Object.keys(appliedFiltersRef.current).length === 0
                        ? "bg-red-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                      }
                    >
                      <CircleOff size={17} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyFilterToAllChannels([0, 1, 2, 3, 4, 5], 1)}
                      className={
                        Object.keys(appliedFiltersRef.current).length === 6 && Object.values(appliedFiltersRef.current).every((value) => value === 1)
                        ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                        : "bg-white-500" // Active background
                      }
                    >
                      50Hz
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyFilterToAllChannels([0, 1, 2, 3, 4, 5], 2)}
                      className={
                        Object.keys(appliedFiltersRef.current).length === 6 && Object.values(appliedFiltersRef.current).every((value) => value === 2)
                        ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                      }
                    >
                      60Hz
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  {["CH1", "CH2", "CH3", "CH4", "CH5", "CH6"].map((filterName, index) => (
                    <div key={filterName} className="flex items-center">
                      {/* Filter Name */}
                      <div className="text-sm font-semibold w-12">{filterName}</div>

                      {/* Buttons */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFilter(index)}
                          className={
                            appliedFiltersRef.current[index] === undefined
                            ? "bg-red-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }
                        >
                          <CircleOff size={17} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFrequencySelection(index, 1)}
                          className={
                            appliedFiltersRef.current[index] === 1
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }
                        >
                          50Hz
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFrequencySelection(index, 2)}
                          className={
                            appliedFiltersRef.current[index] === 2
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }
                        >
                          60Hz
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>

          </Popover>
        )}


        {/* Canvas control buttons with tooltip */}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <div className="flex items-center mx-0 px-0">
                {/* Decrease Canvas Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-xl rounded-r-none"
                      onClick={decreaseCanvas}
                      disabled={canvasCount === 1 || !isDisplay || recData}
                    >
                      <Minus size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {canvasCount === 1
                        ? "At Least One Canvas Required"
                        : "Decrease Channel"}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-full" />

                {/* Toggle All Channels Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="flex items-center justify-center px-3 py-2 rounded-none select-none"
                      onClick={toggleShowAllChannels}
                      disabled={!isDisplay || recData}
                    >
                      CH
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {showAllChannels
                        ? "Hide All Channels"
                        : "Show All Channels"}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-full" />

                {/* Increase Canvas Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="rounded-xl rounded-l-none"
                      onClick={increaseCanvas}
                      disabled={canvasCount >= 6 || !isDisplay || recData}
                    >
                      <Plus size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {canvasCount >= 6
                        ? "Maximum Channels Reached"
                        : "Increase Channel"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default Connection;