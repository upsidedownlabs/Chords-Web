"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import JSZip from 'jszip';

import {
  Cable,
  Circle,
  CircleStop,
  CircleX,
  Infinity,
  Trash2,
  Download,
  FileArchive,
  FileDown,
  Pause,
  Play,
  Plus,
  Minus,
  ZoomIn, // For magnify/zoom in functionality
  ZoomOut, // For zoom out functionality
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
import { getRandomValues } from "crypto";
interface Dataset {
  id: number;
  timestamp: string;
  data: string[]; // Each dataset is an array of strings
}
interface ChannelData {
  [key: string]: number; // Allows dynamic keys like "channel1", "channel2", etc.
}

interface SessionData {
  sessionId: string;
  fileName: string;
  timestamp: string;
  data: Array<{
    id: number;
    channels: number[];
    data: ChannelData;
  }>;
}
interface ConnectionProps {
  onPauseChange: (pause: boolean) => void; // Callback to pass pause state to parent
  dataSteam: (data: number[]) => void;
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
  dataSteam,
  Connection,
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
  const [isRecordButtonDisabled, setIsRecordButtonDisabled] = useState(false); // New state variable
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [currentSessionTimestamp, setCurrentSessionTimestamp] = useState<string>(''); 
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
  const [popoverVisible, setPopoverVisible] = useState(false);
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
// Use Ref to store the session start time globally within the component
const currentSessionStartTimeRef = useRef<number | null>(null);

  type Dataset = {
    sessionId: string; // Include sessionId for reference
    timestamp: string;
    data: object[]; // Actual data
  };


  useEffect(() => {
    const fetchDataFromIndexedDB = async () => {
      try {
        const db = await initIndexedDB();
        const transaction = db.transaction("adcReadings", "readonly");
        const objectStore = transaction.objectStore("adcReadings");
  
        const groupedData: Record<string, { data: object[]; timestamp: string }> = {};
        const cursorRequest = objectStore.openCursor();
  
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            const { sessionId, timestamp } = cursor.value;
  
            if (!groupedData[sessionId]) {
              groupedData[sessionId] = { data: [], timestamp };
            }
            groupedData[sessionId].data.push(cursor.value);
  
            cursor.continue();
          }
        };
  
        transaction.oncomplete = () => {
          const transformedDatasets: Dataset[] = Object.entries(groupedData).map(
            ([sessionId, { data, timestamp }]) => ({
              sessionId,
              data,
              timestamp,
            })
          );
  
          console.log({transformedDatasets})

          setDatasets(transformedDatasets);
        };
  
        cursorRequest.onerror = (event) => {
          console.error("Error fetching data from IndexedDB:", event);
        };
      } catch (error) {
        console.error("Error interacting with IndexedDB:", error);
      }
    };
  
    fetchDataFromIndexedDB();
  }, []); // Add dependency to refetch when refreshData changes
  



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

  // Function to read data from a connected device and process it
  const readData = async (): Promise<void> => {
    const HEADER_LENGTH = 3; // Length of the packet header
    const NUM_CHANNELS = 6; // Number of channels in the data packet
    const PACKET_LENGTH = 16; // Total length of each packet
    const SYNC_BYTE1 = 0xc7; // First synchronization byte to identify the start of a packet
    const SYNC_BYTE2 = 0x7c; // Second synchronization byte
    const END_BYTE = 0x01; // End byte to signify the end of a packet
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection

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
                // Loop through each channel in the packet
                const highByte = packet[channel * 2 + HEADER_LENGTH]; // Extract the high byte for the channel
                const lowByte = packet[channel * 2 + HEADER_LENGTH + 1]; // Extract the low byte for the channel
                const value = (highByte << 8) | lowByte; // Combine high and low bytes to get the channel value
                channelData.push(value); // Convert the value to string and store it in the array
              }
              const counter = packet[2]; // Extract the counter value from the packet
              channelData.push(counter); // Add the counter to the channel data
              dataSteam(channelData); // Pass the channel data to the LineData function for further processing

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
    console.log({ datasets });
    
    // Check if a device is connected
    if (isConnected) {
      // Check the length of existing datasets
      if (datasets.length >= 3) {
        console.log("Data set length in condition", datasets.length);
        toast.error(`You have reached the maximum allowed datasets limit (${3}).`);
        return; // Stop further execution if the limit is reached
      }
  
      // If recording is already in progress, stop it
      if (isRecordingRef.current) {
        stopRecording(); // Stop the recording if it is already on
      } else {
        // Start a new recording session
        isRecordingRef.current = true; // Set the recording state to true
        const now = new Date(); // Get the current date and time
        const nowTime = now.getTime(); // Get the current time in milliseconds
        startTimeRef.current = nowTime; // Store the start time of the recording
        currentSessionStartTimeRef.current = nowTime; // Store the session start time in Ref
        setElapsedTime(0); // Reset elapsed time for display
        timerIntervalRef.current = setInterval(checkRecordingTime, 1000); // Start a timer to check recording duration every second
        setrecData(true); // Set the state indicating recording data is being collected
  
        // Generate a unique session ID for this recording session
        const sessionId = `session-${Math.random().toString()}`;
  
        // Format the timestamp for the file name (yyyymmdd-hhmmdd.csv)
        const fileName = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.csv`;
  
        // Set session start timestamp (ISO format for consistency)
        const timestamp = now.toISOString();
  
        setCurrentSessionTimestamp(timestamp);
        setCurrentSessionId(sessionId);
  
        // Initialize IndexedDB for this recording session
        try {
          const db = await initIndexedDB(); // Attempt to initialize the IndexedDB
          indexedDBRef.current = db; // Store the database connection in a ref for later use
        } catch (error) {
          // Handle any errors during the IndexedDB initialization
          console.error("Failed to initialize IndexedDB:", error);
          toast.error("Failed to initialize storage. Recording may not be saved.");
          return; // Exit if initialization fails
        }
  
        // Start reading and saving data
        recordingIntervalRef.current = setInterval(() => {
          const data = bufferRef.current; // Use bufferRef which stores actual data
          saveDataDuringRecording(data, sessionId, fileName, timestamp); // Save the data to IndexedDB with session ID and file name
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
      // Clear the recording timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
     
  
      const endTime = new Date(); // Get the end time of the recording
  
      // Fetch the number of recorded files from IndexedDB
      const recordedFilesCount = (await getAllDataFromIndexedDB()).length;
      if (startTimeRef.current !== null) {
        // Convert start and end times to readable format
        const startTimeString = new Date(startTimeRef.current).toLocaleTimeString();
        const endTimeString = endTime.toLocaleTimeString();
  
        // Calculate the duration in seconds
        const durationInSeconds = Math.floor((endTime.getTime() - startTimeRef.current) / 1000);
  
        // Close the IndexedDB connection
        if (indexedDBRef.current) {
          indexedDBRef.current.close();
          indexedDBRef.current = null;
        }
  
        // Fetch all recorded data from IndexedDB
        const allData = await getAllDataFromIndexedDB();
        // console.log("datasets",datasets);
        // console.log("length of datasets:", datasets.length);

        setDatasets((datasets) => [...datasets, { sessionId: currentSessionId, timestamp: currentSessionTimestamp, data: allData}]);
        setHasData(allData.length > 0);
  
        // Show a success toast with details of the recording
        toast.success("Recording completed successfully", {
          description: (
            <div>
              <p>Session ID: {sessionId}</p>
              <p>Start Time: {startTimeString}</p>
              <p>End Time: {endTimeString}</p>
              <p>Recording Duration: {formatDuration(durationInSeconds)}</p>
              <p>Samples Recorded: {recordedFilesCount}</p>
            </div>
          ),
        });
  
        // Update states after recording is completed
        isRecordingRef.current = false; // Set recording state to false
        setElapsedTime(0); // Reset the elapsed time
        setrecData(false); // Indicate that recording is not in progress
        setIsRecordButtonDisabled(true); // Disable the record button
        setSessionId(null); // Clear session ID after recording stops
        setCurrentSessionId('');
        setCurrentSessionTimestamp('');
      } else {
        // If start time is null, log an error and show a toast
        console.error("Start time is null. Unable to calculate duration.");
        toast.error("Recording start time was not captured.");
      }
    };
  
    // Call this function when your component mounts or when you suspect the data might change
    useEffect(() => {
      const checkDataAndConnection = async () => {
        // Check if data exists in IndexedDB
        const allData = await getAllDataFromIndexedDB();
        setHasData(allData.length > 0);
        // setDatasets(datasets.length)
  
        // Disable the record button if there is data in IndexedDB and device is connected
        setIsRecordButtonDisabled(allData.length > 0 || !isConnected);
      };
  
      checkDataAndConnection();
    }, [isConnected, stopRecording]);
  
  
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

  
  // Updated saveDataDuringRecording function
  const saveDataDuringRecording = async (
    data: number[][],
    sessionId: string,
    fileName: string,
    timestamp: string
) => {
    if (!isRecordingRef.current || !indexedDBRef.current) return;

    try {
        const tx = indexedDBRef.current.transaction(["adcReadings"], "readwrite");
        const store = tx.objectStore("adcReadings");

        // Fetch existing record by sessionId
        const sessionDataRequest = store.index("sessionId").get(sessionId);

        sessionDataRequest.onsuccess = (event) => {
            const existingRecord = (event.target as IDBRequest).result;

            if (existingRecord) {
                // Append new data to existing record
                const updatedData = [...existingRecord.data, ...data];
                const updatedRecord = {
                    ...existingRecord,
                    data: updatedData,
                    timestamp, // Update the timestamp
                };

                const updateRequest = store.put(updatedRecord);
                updateRequest.onsuccess = () => {
                    console.log(`Appended data to session: ${sessionId}`);
                };
                updateRequest.onerror = (error) => {
                    console.error("Error updating session data:", error);
                };
            } else {
                // Create new record if session doesn't exist
                const newRecord = {
                    sessionId,
                    fileName,
                    timestamp,
                    data, // Save new data
                };

                const addRequest = store.add(newRecord);
                addRequest.onsuccess = () => {
                    console.log(`New session created: ${sessionId}`);
                };
                addRequest.onerror = (error) => {
                    console.error("Error adding new session:", error);
                };
            }
        };

        sessionDataRequest.onerror = (error) => {
            console.error("Error fetching session data:", error);
        };
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
// Function to initialize the IndexedDB and return a promise with the database instance
const initIndexedDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Open a connection to the IndexedDB database
    const request = indexedDB.open("adcReadings", 2); // Update version if schema changes

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      switch (event.oldVersion) {
        case 0: // Database doesn't exist, create initial schema
          const store = db.createObjectStore("adcReadings", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("sessionId", "sessionId", { unique: false });
          store.createIndex("channels", "channels", { unique: false });
          break;

        case 1: // Upgrade from version 1 to 2
          const transaction = request.transaction;
          if (transaction) {
            const existingStore = transaction.objectStore("adcReadings");
            if (!existingStore.indexNames.contains("channels")) {
              existingStore.createIndex("channels", "channels", { unique: false });
            }
          }
          break;

        default:
          console.warn("No schema updates for this version.");
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db); // Resolve the promise with the database instance
    };

    request.onerror = () => {
      reject(request.error); // Reject the promise with the error
    };
  });
};


  const getDataBySessionId = async (sessionId: string) => {
    return new Promise((resolve, reject) => {
      const dbRequest = indexedDB.open("adcReadings");
      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction("adcReadings", "readonly");
        const store = transaction.objectStore("adcReadings");
        const index = store.index("sessionId"); // Assuming you have an index on sessionId

        const request = index.getAll(sessionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Failed to fetch data.");
      };
      dbRequest.onerror = () => reject("Failed to open database.");
    });
  };


  const deleteFilesBySessionId = async (sessionId: string) => {
    try {
      const dbRequest = indexedDB.open("adcReadings");
  
      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction("adcReadings", "readwrite");
        const store = transaction.objectStore("adcReadings");
  
        // Check if the "sessionId" index exists
        if (!store.indexNames.contains("sessionId")) {
          console.error("Index 'sessionId' does not exist.");
          toast.error("Unable to delete files: index not found.");
          return;
        }
  
        const index = store.index("sessionId");
        const deleteRequest = index.openCursor(IDBKeyRange.only(sessionId));
  
        deleteRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
  
          if (cursor) {
            cursor.delete(); // Delete the current record
            cursor.continue(); // Move to the next matching record
          }
        };
  
        deleteRequest.onerror = () => {
          console.error("Error during delete operation.");
          toast.error("Failed to delete files. Please try again.");
        };
  
        // Ensure transaction completion
        transaction.oncomplete = () => {
          console.log("Files successfully deleted for session:", sessionId);
  
          // Update the datasets state by filtering out the deleted session
          setDatasets((prevDatasets) =>
            prevDatasets.filter((dataset) => dataset.sessionId !== sessionId)
          );
  
          // Show a toast notification for successful deletion
          toast.success("File deleted successfully.");
        };
  
        transaction.onerror = () => {
          console.error("Transaction failed during deletion.");
          toast.error("Failed to delete files. Please try again.");
        };
      };
  
      dbRequest.onerror = () => {
        console.error("Failed to open IndexedDB database.");
        toast.error("An error occurred while accessing the database.");
      };
    } catch (error) {
      console.error("Error occurred during file deletion:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };
  

  const saveDataBySessionId = async (sessionId: string) => {
    try {
      // Fetch the data matching the sessionId from IndexedDB
      const data = await getDataBySessionId(sessionId);

      // Ensure `data` is an array
      if (!Array.isArray(data)) {
        toast.error("Unexpected data format received.");
        return;
      }

      // Get the timestamp of the session
      const sessionData = data[0]; // Assuming the first entry contains the timestamp (you can adjust if needed)
      const timestamp = sessionData?.timestamp; // Extract the timestamp
      if (!timestamp) {
        toast.error("Timestamp not found for this session.");
        return;
      }

      // Convert data to CSV
      const csvData = convertToCSV(data);

      // Create a Blob from the CSV data
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });

      // Format the timestamp for the filename (e.g., YYYYMMDD-HHMMSS)
      const formattedTimestamp = new Date(timestamp);
      const formattedDate = `${formattedTimestamp.getFullYear()}${String(formattedTimestamp.getMonth() + 1).padStart(2, "0")}${String(formattedTimestamp.getDate()).padStart(2, "0")}`;
      const formattedTime = `${String(formattedTimestamp.getHours()).padStart(2, "0")}${String(formattedTimestamp.getMinutes()).padStart(2, "0")}${String(formattedTimestamp.getSeconds()).padStart(2, "0")}`;
      const finalTimestamp = `${formattedDate}-${formattedTime}`;

      // Generate the filename using the sessionId and formatted timestamp
      const filename = `chordsweb-${finalTimestamp}.csv`;

      // Trigger file download with the generated filename
      saveAs(blob, filename); // FileSaver.js
      toast.success("Data downloaded successfully.");
    } catch (error) {
      console.error("Error saving data by sessionId:", error);
      toast.error("Failed to save data. Please try again.");
    }
  };

  // Updated `getAllDataFromIndexedDB` to include IDs
  const getAllDataFromIndexedDB = async (): Promise<any[]> => {
    try {
      const db = await initIndexedDB();
      const tx = db.transaction(["adcReadings"], "readonly");
      const store = tx.objectStore("adcReadings");
      const request = store.getAll();
  
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const data = request.result.map((item: any, index: number) => ({
            id: index + 1,
            ...item,
          }));
          resolve(data);
        };
  
        request.onerror = (error) => {
          console.error("Error retrieving data from IndexedDB:", error);
          reject(error);
        };
      });
    } catch (error) {
      console.error("Error during IndexedDB operation:", error);
      return [];
    }
  };
  

  // Function to delete all data from IndexedDB (for ZIP files or clear all)
  const deleteAllDataFromIndexedDB = async () => {
    return new Promise<void>((resolve, reject) => {
      try {
        const dbRequest = indexedDB.open("adcReadings", 2);
  
        dbRequest.onerror = (error) => {
          console.error("Failed to open IndexedDB:", error);
          reject(new Error("Failed to open database"));
        };
  
        dbRequest.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Start a transaction and get the object store
          const transaction = db.transaction(["adcReadings"], "readwrite");
          const store = transaction.objectStore("adcReadings");
          
          // Clear all records from the store
          const clearRequest = store.clear();
  
          clearRequest.onsuccess = () => {
            // Close the database connection
            db.close();
            
            // Clear state and update UI
            setHasData(false);
            setDatasets([]);
            setPopoverVisible(false);
            toast.success("All files deleted successfully.");
            resolve();
          };
  
          clearRequest.onerror = (error) => {
            console.error("Failed to clear IndexedDB store:", error);
            toast.error("Failed to delete all files. Please try again.");
            reject(error);
          };
  
          transaction.onerror = (error) => {
            console.error("Transaction failed:", error);
            toast.error("Failed to delete all files. Please try again.");
            reject(error);
          };
        };
  
        dbRequest.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create the object store if it doesn't exist
          if (!db.objectStoreNames.contains("adcReadings")) {
            const store = db.createObjectStore("adcReadings", {
              keyPath: "id",
              autoIncrement: true,
            });
            store.createIndex("timestamp", "timestamp", { unique: false });
            store.createIndex("sessionId", "sessionId", { unique: false });
          }
        };
  
      } catch (error) {
        console.error("Error in deleteAllDataFromIndexedDB:", error);
        reject(error);
      }
    });
  };
  
  
  

  // Function to save a ZIP file containing all datasets
  const saveAllDataAsZip = async () => {
    try {
      const allData = await getAllDataFromIndexedDB();

      if (allData.length === 0) {
        toast.error("No data available to download.");
        return;
      }

      const zip = new JSZip();

      // Group data by sessionId
      const groupedData = allData.reduce((acc, item) => {
        if (!acc[item.sessionId]) {
          acc[item.sessionId] = [];
        }
        acc[item.sessionId].push(item); // Add item to the correct sessionId group
        return acc;
      }, {});

      // Loop through each sessionId group and create a CSV for each
      Object.keys(groupedData).forEach(sessionId => {
        const dataForSession = groupedData[sessionId]; // Get all items for the current sessionId
        const csvData = convertToCSV(dataForSession); // Convert the grouped data to CSV format
        const fileName = `session_${sessionId}.csv`; // Create a unique filename based on sessionId
        zip.file(fileName, csvData); // Add CSV file to the ZIP
      });

      // Extract the earliest or most recent timestamp from the data for the ZIP file name
      const earliestTimestamp = allData.reduce((earliest, item) => {
        return !earliest || new Date(item.timestamp) < new Date(earliest.timestamp) ? item : earliest;
      }, null)?.timestamp;

      if (!earliestTimestamp) {
        toast.error("Timestamp not found in the data.");
        return;
      }

      // Format the timestamp for the ZIP filename (e.g., YYYYMMDD-HHMMSS)
      const formattedTimestamp = new Date(earliestTimestamp);
      const formattedDate = `${formattedTimestamp.getFullYear()}${String(formattedTimestamp.getMonth() + 1).padStart(2, "0")}${String(formattedTimestamp.getDate()).padStart(2, "0")}`;
      const formattedTime = `${String(formattedTimestamp.getHours()).padStart(2, "0")}${String(formattedTimestamp.getMinutes()).padStart(2, "0")}${String(formattedTimestamp.getSeconds()).padStart(2, "0")}`;
      const finalTimestamp = `${formattedDate}-${formattedTime}`;

      // Generate the ZIP file
      const content = await zip.generateAsync({ type: "blob" });

      // Download the ZIP file with a name that includes the timestamp from the data
      saveAs(content, `ChordsWeb-${finalTimestamp}.zip`); // FileSaver.js
      setHasData(false);
      toast.success("ZIP file downloaded successfully.");
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      toast.error("Failed to create ZIP file. Please try again.");
    }
  };

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
        {/* Zoom  */}
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
              {/* FileArchive button enabled if at least one file exists */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="rounded-xl p-4"
                    disabled={datasets.length === 0} // Disable when no datasets exist
                  >
                    <FileArchive size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-4 bg-white shadow-lg rounded-xl w-full">
                  <div className="space-y-4">
                    {datasets.length > 0 ? (
                      <>
                        {/* List each file with download and delete actions */}
                        {datasets.map((dataset, index) => {
                          const timestamp = new Date(dataset.timestamp); // Convert ISO string to Date object
                          const formattedTimestamp = `${timestamp.getFullYear()}${(timestamp.getMonth() + 1)
                            .toString()
                            .padStart(2, "0")}${timestamp
                              .getDate()
                              .toString()
                              .padStart(2, "0")}-${timestamp
                                .getHours()
                                .toString()
                                .padStart(2, "0")}${timestamp
                                  .getMinutes()
                                  .toString()
                                  .padStart(2, "0")}${timestamp
                                    .getSeconds()
                                    .toString()
                                    .padStart(2, "0")}`;

                          return (
                            <div
                              key={dataset.sessionId}
                              className="flex justify-between items-center"
                            >
                              <span className="font-medium mr-4 text-black">
                                chordsweb-{formattedTimestamp}.csv
                              </span>
                              <div className="flex space-x-2 ">
                                <Button
                                  onClick={() => saveDataBySessionId(dataset.sessionId)}
                                  className="rounded-xl px-4"
                                >
                                  <Download size={16} />
                                </Button>
                                <Button
                                  onClick={() => {
                                    deleteFilesBySessionId(dataset.sessionId)
                                      .then(() => {
                                        setDatasets((prevDatasets) =>
                                          prevDatasets.filter(
                                            (d) => d.sessionId !== dataset.sessionId
                                          )
                                        );
                                        toast.success("File deleted successfully");
                                      })
                                      .catch(() => {
                                        toast.error("Failed to delete file");
                                      });
                                  }}
                                  className="rounded-xl px-4"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}


                        {/* Download all as ZIP and delete all options */}
                        <div className="flex justify-between mt-4">
                          <Button
                            onClick={saveAllDataAsZip}
                            className="rounded-xl p-2 w-full mr-2"
                          >
                            Download All as Zip
                          </Button>
                          <Button
                            onClick={deleteAllDataFromIndexedDB}
                            className="rounded-xl p-2 w-full"
                          >
                            Delete All
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500">No files available</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </TooltipProvider>
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