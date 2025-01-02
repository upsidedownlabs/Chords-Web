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
  data: string[]; // Each dataset is an array of strings
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


  // Define the Dataset type
  type Dataset = {
    sessionId: string; // Include sessionId for reference
    data: object[]; // Actual data
  };


  useEffect(() => {
    const fetchDataFromIndexedDB = async () => {
      try {
        const db = await initIndexedDB(); // Ensure database is initialized
        const transaction = db.transaction('adcReadings', 'readonly');
        const objectStore = transaction.objectStore('adcReadings');

        const groupedData: Record<string, object[]> = {};
        const cursorRequest = objectStore.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            const { sessionId } = cursor.value;

            if (!groupedData[sessionId]) {
              groupedData[sessionId] = [];
            }
            groupedData[sessionId].push(cursor.value);

            cursor.continue();
          } else {
            const transformedDatasets: Dataset[] = Object.entries(groupedData).map(([sessionId, data]) => ({
              sessionId: sessionId,
              data,
            }));

            setDatasets(transformedDatasets);
          }
        };

        cursorRequest.onerror = (event) => {
          console.error('Error fetching data from IndexedDB:', event);
        };
      } catch (error) {
        console.error('Error interacting with IndexedDB:', error);
      }
    };

    fetchDataFromIndexedDB();
  }, []);



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

        // Generate a unique session ID for this recording session
        const sessionId = `session-${Math.random().toString()}`;

        // Initialize IndexedDB for this recording session
        try {
          const db = await initIndexedDB(); // Attempt to initialize the IndexedDB
          indexedDBRef.current = db; // Store the database connection in a ref for later use
        } catch (error) {
          // Handle any errors during the IndexedDB initialization
          console.error("Failed to initialize IndexedDB:", error);
          toast.error("Failed to initialize storage. Recording may not be saved.");
        }

        // Start reading and saving data
        recordingIntervalRef.current = setInterval(() => {
          const data = bufferRef.current; // Use bufferRef which stores actual data
          saveDataDuringRecording(data, sessionId); // Save the data to IndexedDB with session ID
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
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const endTime = new Date();
    const recordedFilesCount = (await getAllDataFromIndexedDB()).length;

    if (startTimeRef.current !== null) {
      const startTimeString = new Date(startTimeRef.current).toLocaleTimeString();
      const endTimeString = endTime.toLocaleTimeString();
      const durationInSeconds = Math.floor((endTime.getTime() - startTimeRef.current) / 1000);

      if (indexedDBRef.current) {
        indexedDBRef.current.close();
        indexedDBRef.current = null;
      }

      const allData = await getAllDataFromIndexedDB();
      setHasData(allData.length > 0);

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

      // Reset states
      isRecordingRef.current = false;
      setElapsedTime(0);
      setrecData(false);
      setIsRecordButtonDisabled(true);
      setSessionId(null); // Clear session ID when recording is stopped
    } else {
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

      // Disable the record button if there is data in IndexedDB and device is connected
      setIsRecordButtonDisabled(allData.length > 0 || !isConnected);
    };

    checkDataAndConnection();
  }, [isConnected]);

  // Add this function to save data to IndexedDB during recording
  const saveDataDuringRecording = async (data: number[][], sessionId: string) => {
    if (!isRecordingRef.current || !indexedDBRef.current) return;

    try {
      const tx = indexedDBRef.current.transaction(["adcReadings"], "readwrite");
      const store = tx.objectStore("adcReadings");

      console.log(`Saving data for ${canvasCount} channels in session: ${sessionId}`);

      for (const row of data) {
        const channels = row.slice(0, canvasCount).map(value => (value !== undefined ? value : null));

        await store.add({
          sessionId: sessionId, // Store the session ID with each data entry
          timestamp: new Date().toISOString(),
          channels,
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
      // Open a connection to the IndexedDB database, increment version if schema changes
      const request = indexedDB.open("adcReadings", 4); // Increment version if needed

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("adcReadings")) {
          const store = db.createObjectStore("adcReadings", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("sessionId", "sessionId", { unique: false });
          store.createIndex("channels", "channels", { unique: false });
        } else {
          const store = (event.target as IDBRequest).transaction?.objectStore("adcReadings");

          if (store) {
            if (!store.indexNames.contains("sessionId")) {
              store.createIndex("sessionId", "sessionId", { unique: false });
            }
            if (!store.indexNames.contains("timestamp")) {
              store.createIndex("timestamp", "timestamp", { unique: false });
            }
            if (!store.indexNames.contains("channels")) {
              store.createIndex("channels", "channels", { unique: false });
            }
          }
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

        // Check if the index exists
        if (!store.indexNames.contains("sessionId")) {
          throw new Error("Index 'sessionId' does not exist.");
        }

        const index = store.index("sessionId");

        // Open cursor with KeyRange
        const deleteRequest = index.openCursor(IDBKeyRange.only(sessionId));

        deleteRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

          if (cursor) {
            cursor.delete(); // Delete the record
            cursor.continue(); // Move to the next record
          }
        };

        deleteRequest.onerror = () => {
          throw new Error("Failed to delete data.");
        };

        // Ensure transaction completion
        transaction.oncomplete = () => {
          // Successfully deleted from IndexedDB, now update the datasets state
          // Filter out the deleted file from the datasets array
          setDatasets(prevDatasets => prevDatasets.filter(dataset => dataset.sessionId !== sessionId));

          // Show toast notification for successful deletion
          toast.success("File deleted successfully");
        };

        transaction.onerror = () => {
          throw new Error("Transaction failed.");
        };
      };

      dbRequest.onerror = () => {
        throw new Error("Failed to open database.");
      };
    } catch (error) {
      // Handle errors and show toast notification if needed
      toast.error("An error occurred during deletion.");
    }
  };


  const saveDataBySessionId = async (sessionId: string) => {
    try {
      // Fetch data matching session ID from IndexedDB
      const data = await getDataBySessionId(sessionId);

      // Ensure `data` is an array
      if (!Array.isArray(data)) {
        toast.error("Unexpected data format received.");
        return;
      }

      const csvData = convertToCSV(data);

      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });

      // Generate a timestamped filename
      const now = new Date();
      const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
        now.getSeconds()
      ).padStart(2, "0")}`;
      const filename = `session_${sessionId}_${formattedTimestamp}.csv`;

      // Trigger file download
      saveAs(blob, filename);

      // Notify user of success
      toast.success("Data downloaded successfully.");
    } catch (error) {
      console.error("Error saving data by sessionId:", error);
      toast.error("Failed to save data. Please try again.");
    }
  };

  // Updated `getAllDataFromIndexedDB` to include IDs
  const getAllDataFromIndexedDB = async (): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await initIndexedDB();
        const tx = db.transaction(["adcReadings"], "readonly");
        const store = tx.objectStore("adcReadings");

        const request = store.getAll();
        request.onsuccess = () => {
          console.log("Data retrieved from IndexedDB:", request.result); // Log to debug
          resolve(request.result.map((item: any, index: number) => ({
            id: index + 1,
            ...item,
          })));
        };

        request.onerror = (error) => {
          console.error("Error retrieving data from IndexedDB:", error);
          reject(error);
        };
      } catch (error) {
        console.error("Error during IndexedDB operation:", error);
        reject(error);
      }
    });
  };

  // Function to delete all data from IndexedDB (for ZIP files or clear all)
 const deleteAllDataFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction(["adcReadings"], "readwrite");
    const store = tx.objectStore("adcReadings");

    await store.clear();
    console.log("All data deleted from IndexedDB");

    toast.success("All files deleted successfully.");

    // Update state
    setHasData(false);
    setDatasets([]); // Properly reset datasets state
    setPopoverVisible(false); // Ensure popover is hidden
  } catch (error) {
    console.error("Error deleting all data from IndexedDB:", error);
    toast.error("Failed to delete all files. Please try again.");
  }
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

      // Generate the ZIP file
      const content = await zip.generateAsync({ type: "blob" });

      // Get the current timestamp for the ZIP file name
      const now = new Date();
      const formattedTimestamp = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
        now.getHours()
      ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
        now.getSeconds()
      ).padStart(2, "0")}`;

      // Download the ZIP file with a name that includes the timestamp
      saveAs(content, `all_data_${formattedTimestamp}.zip`); // FileSaver.js
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
              {/* Save Data button for a single dataset or popover trigger for multiple datasets */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="rounded-xl rounded-r-none"
                    onClick={() => {
                      if (datasets.length >= 2) {
                        setPopoverVisible(true); // Open popover for multiple datasets
                      } else  {
                        saveAllDataAsZip(); // Directly download ZIP for a single dataset
                      }
                    }}
                    disabled={!hasData}
                  >
                    <Download size={16} className="mr-1" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{datasets.length >= 2 ? "Download/Delete Files" : "Download Data"}</p>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-full" />

              {/* Delete Recording Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="rounded-xl rounded-l-none"
                    onClick={deleteAllDataFromIndexedDB}
                    disabled={!hasData}
                  >
                    <Trash2 size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Recording</p>
                </TooltipContent>
              </Tooltip>

              {/* Popover content for multiple files */}
              {popoverVisible && datasets.length >= 2 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button className="rounded-xl p-4 ml-1" disabled={!hasData}>
                      ^
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-4 bg-white shadow-lg rounded-xl w-full">
                    <div className="space-y-4">
                      {datasets.map((dataset, index) => (
                        <div key={dataset.sessionId} className="flex justify-between items-center">
                          <span className="font-medium mr-4">File {index + 1}</span>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => saveDataBySessionId(dataset.sessionId)}
                              className="rounded-xl px-4"
                            >
                              <Download size={16} />
                            </Button>
                            <Button
                              onClick={() => {
                                deleteFilesBySessionId(dataset.sessionId).then(() => {
                                  setDatasets(prevDatasets =>
                                    prevDatasets.filter(d => d.sessionId !== dataset.sessionId)
                                  );
                                  toast.success("File deleted successfully");
                                }).catch(() => {
                                  toast.error("Failed to delete file");
                                });
                              }}
                              className="rounded-xl px-4"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between mt-4">
                        <Button
                          onClick={saveAllDataAsZip}
                          className="rounded-xl p-2 w-full mr-2"
                        >
                          Download Zip
                        </Button>
                        <Button
                          onClick={deleteAllDataFromIndexedDB}
                          className="rounded-xl p-2 w-full"
                        >
                          Delete All
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
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