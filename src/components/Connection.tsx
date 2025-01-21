"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EXGFilter, Notch } from './filters';
import { useTheme } from "next-themes";
import {
  Cable,
  Circle,
  CircleStop,
  CircleX,
  Infinity,
  Trash2,
  Download,
  FileArchive,
  Pause,
  Play,
  CircleOff,
  ReplaceAll,
  Heart,
  Brain,
  Eye,
  BicepsFlexed,
  ArrowRightToLine,
  ArrowLeftToLine,
  Settings,
  Loader
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
  selectedBits?: BitSelection; // Add `?` if it's optional
  setSelectedBits: React.Dispatch<React.SetStateAction<BitSelection>>;
  isDisplay: boolean;
  setIsDisplay: React.Dispatch<React.SetStateAction<boolean>>;
  setCanvasCount: React.Dispatch<React.SetStateAction<number>>; // Specify type for setCanvasCount
  canvasCount: number;
  selectedChannels: number[]; // Array of selected channel indices
  setSelectedChannels: React.Dispatch<React.SetStateAction<number[]>>; // State updater for selectedChannels
  channelCount: number;
  timeBase: number;
  setTimeBase: React.Dispatch<React.SetStateAction<number>>;
  SetZoom: React.Dispatch<React.SetStateAction<number>>;
  SetCurrentSnapshot: React.Dispatch<React.SetStateAction<number>>;
  currentSamplingRate: number;
  setCurrentSamplingRate: React.Dispatch<React.SetStateAction<number>>;
  currentSnapshot: number;
  Zoom: number;
  snapShotRef: React.RefObject<boolean[]>;
}

const Connection: React.FC<ConnectionProps> = ({
  onPauseChange,
  datastream,
  Connection,
  setSelectedBits,
  isDisplay,
  setIsDisplay,
  setCanvasCount,
  canvasCount,
  setSelectedChannels,
  selectedChannels,
  SetCurrentSnapshot,
  currentSnapshot,
  snapShotRef,
  SetZoom,
  Zoom,
  timeBase,
  setTimeBase,
  currentSamplingRate,
  setCurrentSamplingRate
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false); // State to track if the device is connected
  const isConnectedRef = useRef<boolean>(false); // Ref to track if the device is connected
  const isRecordingRef = useRef<boolean>(false); // Ref to track if the device is recording
  const [isEndTimePopoverOpen, setIsEndTimePopoverOpen] = useState(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null); // State to store the detected bits
  const detectedBitsRef = React.useRef<BitSelection>(10);
  const [datasets, setDatasets] = useState<any[]>([]);
  const currentFilenameRef = useRef<string>("");
  const [isRecordButtonDisabled, setIsRecordButtonDisabled] = useState(false);
  const [isSelectAllDisabled, setIsSelectAllDisabled] = useState(false);
  const [recordingElapsedTime, setRecordingElapsedTime] = useState<number>(0); // State to store the recording duration
  const recordingStartTime = useRef<number>(0);
  const [customTime, setCustomTime] = useState<string>(""); // State to store the custom stop time input
  const [clickCount, setClickCount] = useState(0); // Track how many times the left arrow is clicked
  const endTimeRef = useRef<number | null>(null); // Ref to store the end time of the recording
  const [popoverVisible, setPopoverVisible] = useState(false);
  const portRef = useRef<SerialPort | null>(null); // Ref to store the serial port
  const [ifBits, setifBits] = useState<BitSelection>(10);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme(); // Get the current theme
  const isDarkMode = theme === "dark"; // Check if the theme is dark mode
  const canvasnumbersRef = useRef<number>(1);
  const maxCanvasCountRef = useRef<number>(1);
  const [isAllEnabledSelected, setIsAllEnabledSelected] = useState(false);
  const channelNamesfil = Array.from({ length: maxCanvasCountRef.current }, (_, i) => `CH${i + 1}`);
  const initialSelectedChannel = useRef<any[]>([1]);


  const readerRef = useRef<
    ReadableStreamDefaultReader<Uint8Array> | null | undefined
  >(null); // Ref to store the reader for the serial port
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );
  const buffer: number[] = []; // Buffer to store incoming data
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const NUM_BUFFERS = 4;
  const MAX_BUFFER_SIZE = 500;
  const recordingBuffers = Array(NUM_BUFFERS)
    .fill(null)
    .map(() => [] as number[][]);
  const fillingindex = useRef<number>(0); // Initialize useRef with 0

  let activeBufferIndex = 0;
  const togglePause = () => {
    const newPauseState = !isDisplay;
    setIsDisplay(newPauseState);
    onPauseChange(newPauseState); // Notify parent about the change
    SetCurrentSnapshot(0);
    setClickCount(0);

  };

  const enabledClicks = (snapShotRef.current?.filter(Boolean).length ?? 0) - 1;

  // Enable/Disable left arrow button
  const handlePrevSnapshot = () => {
    if (clickCount < enabledClicks) {
      setClickCount(clickCount + 1);
    }

    if (currentSnapshot < 4) {
      SetCurrentSnapshot(currentSnapshot + 1);
    }
  };
  useEffect(() => {
    const enabledChannels = Array.from({ length: maxCanvasCountRef.current }, (_, i) => i + 1);

    // Check localStorage for saved data
    const savedPorts = JSON.parse(localStorage.getItem('savedDevices') || '[]');
    const portInfo = portRef.current?.getInfo();

    let initialSelectedChannels = [1]; // Default to channel 1 if no saved channels are found

    if (portInfo) {
      const { usbVendorId, usbProductId } = portInfo;
      const deviceIndex = savedPorts.findIndex(
        (saved: SavedDevice) =>
          saved.usbVendorId === (usbVendorId ?? 0) &&
          saved.usbProductId === (usbProductId ?? 0)
      );

      if (deviceIndex !== -1) {
        const savedChannels = savedPorts[deviceIndex].selectedChannels;
        initialSelectedChannels = savedChannels.length > 0 ? savedChannels : [1]; // Load saved channels or default to [1]
      }
    }

    // Set initial selected channels
    setSelectedChannels(initialSelectedChannels);

    // Update the "Select All" button state based on the loaded channels
    const allSelected = initialSelectedChannels.length === enabledChannels.length;
    const selectAllDisabled = initialSelectedChannels.length === enabledChannels.length - 1;

    setIsAllEnabledSelected(allSelected);
    setIsSelectAllDisabled(selectAllDisabled);
  }, []); // Runs only on component mount


  useEffect(() => {
    setSelectedChannels(selectedChannels);
  }, [selectedChannels]);

  // UseEffect to track changes in selectedChannels and enabledChannels
  useEffect(() => {
    const enabledChannels = Array.from({ length: maxCanvasCountRef.current }, (_, i) => i + 1);

    // Disable "Select All" button if the difference is exactly 1
    setIsSelectAllDisabled(selectedChannels.length === enabledChannels.length - 1);

    // Update the "Select All" button state
    setIsAllEnabledSelected(selectedChannels.length === enabledChannels.length);
  }, [selectedChannels]); // Trigger whenever selectedChannels changes

  const handleSelectAllToggle = () => {
    const enabledChannels = Array.from({ length: maxCanvasCountRef.current }, (_, i) => i + 1);
    const remainingChannels = enabledChannels.filter(channel => !selectedChannels.includes(channel));

    if (!isAllEnabledSelected) {
      // If all channels are not selected, and only one channel is remaining, simulate selecting it
      if (remainingChannels.length === 1) {
        toggleChannel(remainingChannels[0]);
      } else {
        // Select all enabled channels
        enabledChannels.forEach((channel) => {
          if (!selectedChannels.includes(channel)) {
            toggleChannel(channel);
          }
        });
      }
    } else {
      // If "RESET" is clicked, reset to channel 1 or remove all selected channels
      setSelectedChannels([1]);
    }

    // Toggle the state to indicate whether all channels are selected
    setIsAllEnabledSelected(!isAllEnabledSelected);
  };

  const toggleChannel = (channelIndex: number) => {
    setSelectedChannels((prevSelected) => {
      // Toggle the selection of the channel
      const updatedChannels = prevSelected.includes(channelIndex)
        ? prevSelected.filter((ch) => ch !== channelIndex) // Remove channel
        : [...prevSelected, channelIndex]; // Add channel

      // Sort the updated channels before returning
      const sortedChannels = updatedChannels.sort((a, b) => a - b);

      // If no channel is selected after the toggle, set channel 1 as the default
      if (sortedChannels.length === 0) {
        sortedChannels.push(1); // Default to channel 1 if no channels are selected
      }

      // Update `selectedChannels` in localStorage for the connected device
      const savedPorts = JSON.parse(localStorage.getItem('savedDevices') || '[]');
      const portInfo = portRef.current?.getInfo();
      if (portInfo) {
        const { usbVendorId, usbProductId } = portInfo;
        const deviceIndex = savedPorts.findIndex(
          (saved: SavedDevice) =>
            saved.usbVendorId === (usbVendorId ?? 0) &&
            saved.usbProductId === (usbProductId ?? 0)
        );
        if (deviceIndex !== -1) {
          savedPorts[deviceIndex].selectedChannels = sortedChannels;
          localStorage.setItem('savedDevices', JSON.stringify(savedPorts));
        }
      }

      // Return the sorted array
      return sortedChannels;
    });
  };

  // Use effect to track when all channels are selected manually
  useEffect(() => {
    const enabledChannels = Array.from({ length: maxCanvasCountRef.current }, (_, i) => i + 1);

    // Check if all enabled channels are selected to update the "Select All" state
    setIsAllEnabledSelected(selectedChannels.length === enabledChannels.length);
  }, [selectedChannels]); // Trigger on any update to selectedChannels


  // Handle right arrow click (reset count and disable button if needed)
  const handleNextSnapshot = () => {
    if (clickCount > 0) {
      setClickCount(clickCount - 1); // Reset count after right arrow click
    }
    if (currentSnapshot > 0) {
      SetCurrentSnapshot(currentSnapshot - 1);
    }
  };


  // Added useEffect to sync canvasCount state with the canvasnumbersRef and re-render when isRecordingRef changes
  useEffect(() => {
    canvasnumbersRef.current = canvasCount; // Sync the ref with the state
  }, [canvasCount, isRecordingRef]);


  const handleTimeSelection = (minutes: number | null) => {
    // Function to handle the time selection
    if (minutes === null) {
      endTimeRef.current = null;
      toast.success("Recording set to no time limit");
    } else {
      // If the time is not null, set the end time
      const newEndTimeSeconds = minutes * 60 * 1000;
      if (newEndTimeSeconds <= recordingElapsedTime) {
        // Check if the end time is greater than the current elapsed time
        toast.error("End time must be greater than the current elapsed time");
      } else {
        endTimeRef.current = newEndTimeSeconds; // Set the end time
        toast.success(`Recording end time set to ${minutes} minutes`);
      }
    }
  };

  const workerRef = useRef<Worker | null>(null);

  const initializeWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../workers/indexedDBWorker.ts', import.meta.url), {
        type: 'module',
      });
    }
  };
  const setCanvasCountInWorker = (canvasCount: number) => {
    if (!workerRef.current) {
      initializeWorker();
    }
    setCanvasCount(selectedChannels.length)
    // Send canvasCount independently to the worker
    workerRef.current?.postMessage({ action: 'setCanvasCount', canvasCount: canvasnumbersRef.current });
  };
  setCanvasCountInWorker(canvasnumbersRef.current);

  const setSelectedChannelsInWorker = (selectedChannels: number[]) => {
    if (!workerRef.current) {
      initializeWorker();
    }

    // Send selectedChannels independently to the worker
    workerRef.current?.postMessage({
      action: 'setSelectedChannels',
      selectedChannels: selectedChannels,
    });

  };
  setSelectedChannelsInWorker(selectedChannels)

  const processBuffer = async (bufferIndex: number, canvasCount: number, selectChannel: number[]) => {
    if (!workerRef.current) {
      initializeWorker();
    }

    // If the buffer is empty, return early
    if (recordingBuffers[bufferIndex].length === 0) return;

    const data = recordingBuffers[bufferIndex];
    const filename = currentFilenameRef.current;

    if (filename) {
      // Check if the record already exists
      workerRef.current?.postMessage({ action: 'checkExistence', filename, canvasCount, selectChannel });
      writeToIndexedDB(data, filename, canvasCount, selectChannel);
    }
  };

  const writeToIndexedDB = (data: number[][], filename: string, canvasCount: number, selectChannel: number[]) => {
    workerRef.current?.postMessage({ action: 'write', data, filename, canvasCount, selectChannel });
  };

  const saveAllDataAsZip = async () => {
    try {
      if (workerRef.current) {
        workerRef.current.postMessage({ action: 'saveAsZip', canvasCount, selectedChannels });

        workerRef.current.onmessage = async (event) => {
          const { zipBlob, error } = event.data;

          if (zipBlob) {
            saveAs(zipBlob, 'ChordsWeb.zip');
          } else if (error) {
            console.error(error);
          }
        };
      }
    } catch (error) {
      console.error('Error while saving ZIP file:', error);
    }
  };

  // Function to handle saving data by filename
  const saveDataByFilename = async (filename: string, canvasCount: number, selectChannel: number[]) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: "saveDataByFilename", filename, canvasCount, selectChannel });
      workerRef.current.onmessage = (event) => {
        const { blob, error } = event.data;

        if (blob) {
          saveAs(blob, filename); // FileSaver.js
          toast.success("File downloaded successfully.");
        } else (error: any) => {
          console.error("Worker error:", error);
          toast.error(`Error during file download: ${error.message}`);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        toast.error("An unexpected worker error occurred.");
      };
    } else {
      console.error("Worker reference is null.");
      toast.error("Worker is not available.");
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
    (info: SerialPortInfo, deviceName: string, fieldPid?: number) => {
      if (!info || !info.usbVendorId) {
        return { formattedInfo: "Port with no info", bits: null, channel: null, baudRate: null, serialTimeout: null };
      }

      // Find the board matching both name and field_pid
      const board = BoardsList.find(
        (b) =>
          b.chords_id.toLowerCase() === deviceName.toLowerCase() &&
          (!fieldPid || (b.field_pid) === fieldPid) // Match field_pid if provided
      );

      if (board) {
        setifBits(board.adc_resolution as BitSelection);
        setSelectedBits(board.adc_resolution as BitSelection);
        detectedBitsRef.current = board.adc_resolution as BitSelection;

        const channel = board.channel_count ? (board.channel_count) : 0;
        maxCanvasCountRef.current = channel;
        if (board.sampling_rate) {
          setCurrentSamplingRate(board.sampling_rate);
        }

        return {
          formattedInfo: (
            <>
              {board.device_name} <br /> Product ID: {info.usbProductId}
            </>
          ),
          adcResolution: board.adc_resolution,
          channelCount: board.channel_count,
          baudRate: (board.baud_Rate),   // Return baudRate
          serialTimeout: (board.serial_timeout), // Return serialTimeout
        };
      }

      setDetectedBits(null);
      return { formattedInfo: `${deviceName}`, adcResolution: null, channelCount: null, baudRate: null, serialTimeout: null };
    },
    []
  );

  interface SavedDevice {
    usbVendorId: number;
    usbProductId: number;
    baudRate: number;
  }


  const connectToDevice = async () => {

    try {
      // Disconnect any previous connection if port is open
      if (portRef.current && portRef.current.readable) {
        await disconnectDevice();
      }

      // Retrieve saved devices from localStorage
      const savedPorts = JSON.parse(localStorage.getItem('savedDevices') || '[]');
      let port = null;

      // Get available serial ports
      const ports = await navigator.serial.getPorts();

      // Check if there is a saved port and match with available ports
      if (savedPorts.length > 0) {
        port =
          ports.find((p) => {
            const info = p.getInfo();
            return savedPorts.some(
              (saved: SavedDevice) =>
                saved.usbVendorId === (info.usbVendorId ?? 0) &&
                saved.usbProductId === (info.usbProductId ?? 0)
            );
          }) || null;
      }

      let baudRate;
      let serialTimeout;
      // If no saved port is found, request a new port and save it
      if (!port) {
        port = await navigator.serial.requestPort();
        const newPortInfo = await port.getInfo();
        const usbVendorId = newPortInfo.usbVendorId ?? 0;
        const usbProductId = newPortInfo.usbProductId ?? 0;

        // Match the board from BoardsList based on usbProductId
        const board = BoardsList.find((b) => b.field_pid === usbProductId);

        baudRate = board ? board.baud_Rate : 0;
        serialTimeout = board ? board.serial_timeout : 0;

        // Save the new device details in localStorage, including default selected channels
        savedPorts.push({
          usbVendorId,
          usbProductId,
          baudRate,
          serialTimeout,
          selectedChannels: [1], // Default to CH1 if not saved
        });
        localStorage.setItem('savedDevices', JSON.stringify(savedPorts));
        setSelectedChannels([1]); // Set channel 1 as the default

        // Open the port with the determined baud rate
        await port.open({ baudRate });
        setIsLoading(true); // Set loading state to true
      } else {
        setIsLoading(true); // Set loading state to true
        // If device is already found, retrieve its settings
        const info = port.getInfo();
        const savedDevice = savedPorts.find(
          (saved: SavedDevice) =>
            saved.usbVendorId === (info.usbVendorId ?? 0) &&
            saved.usbProductId === (info.usbProductId ?? 0)
        );
        const deviceIndex = savedPorts.findIndex(
          (saved: SavedDevice) =>
            saved.usbVendorId === (info.usbVendorId ?? 0) &&
            saved.usbProductId === (info.usbProductId ?? 0)
        );
  
        if (deviceIndex !== -1) {
          const savedChannels = savedPorts[deviceIndex].selectedChannels;
          initialSelectedChannel.current = savedChannels.length > 0 ? savedChannels : [1]; // Load saved channels or default to [1]
        }

        baudRate = savedDevice?.baudRate || 230400; // Default to 230400 if no saved baud rate
        serialTimeout = savedDevice?.serialTimeout || 2000; // Default timeout if not saved

        // Open the port with the saved baud rate
        await port.open({ baudRate });

        // Set the previously selected channels or default to [1]
        const lastSelectedChannels = savedDevice?.selectedChannels || [1];
        setSelectedChannels(lastSelectedChannels);
      }

      // Logic for handling device communication, e.g., reading from the port
      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        const writer = port.writable?.getWriter();
        if (writer) {
          writerRef.current = writer;

          // Query the device for its name
          const whoAreYouMessage = new TextEncoder().encode("WHORU\n");
          setTimeout(() => writer.write(whoAreYouMessage), serialTimeout);
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            if (value) {
              buffer += new TextDecoder().decode(value);
              if (buffer.includes("\n")) break;
            }
          }

          // Extract device name from response
          const response = buffer.trim().split("\n").pop();
          const extractedName =
            response?.match(/[A-Za-z0-9\-]+$/)?.[0] ?? "Unknown Device";

          const currentPortInfo = port.getInfo();
          const usbProductId = currentPortInfo.usbProductId ?? 0;

          // Format port info with device name and other details
          const {
            formattedInfo,
            adcResolution,
            channelCount,
            baudRate: extractedBaudRate,
            serialTimeout: extractedSerialTimeout,
          } = formatPortInfo(currentPortInfo, extractedName, usbProductId);
          const allSelected = initialSelectedChannel.current.length == channelCount;
          setIsAllEnabledSelected(allSelected);
          // Update baudRate and serialTimeout with extracted values
          baudRate = extractedBaudRate ?? baudRate;
          serialTimeout = extractedSerialTimeout ?? serialTimeout;

          toast.success("Connection Successful", {
            description: (
              <div className="mt-2 flex flex-col space-y-1">
                <p>Device: {formattedInfo}</p>
                <p>Baud Rate: {baudRate}</p>
                {adcResolution && <p>Resolution: {adcResolution} bits</p>}
                {channelCount && <p>Channel: {channelCount}</p>}
              </div>
            ),
          });

          // Start the communication with the device
          const startMessage = new TextEncoder().encode("START\n");
          setTimeout(() => writer.write(startMessage), 2000);
        } else {
          console.error("Writable stream not available");
        }
      } else {
        console.error("Readable stream not available");
      }

      // Update connection state
      Connection(true);
      setIsConnected(true);
      onPauseChange(true);
      setIsDisplay(true);
      setCanvasCount(1);
      isConnectedRef.current = true;
      portRef.current = port;

      // Retrieve datasets and initiate data reading
      const data = await getFileCountFromIndexedDB();
      setDatasets(data); // Update datasets with the latest data
      readData();

      // Request wake lock to prevent screen sleep
      await navigator.wakeLock.request("screen");
    } catch (error) {
      await disconnectDevice();
      console.error("Error connecting to device:", error);
      toast.error("Failed to connect to device.");
    }
    setIsLoading(false); // Always stop loading
  };


  const getFileCountFromIndexedDB = async (): Promise<any[]> => {
    if (!workerRef.current) {
      initializeWorker();
    }

    return new Promise((resolve, reject) => {
      if (workerRef.current) {
        workerRef.current.postMessage({ action: 'getFileCountFromIndexedDB' });

        workerRef.current.onmessage = (event) => {
          if (event.data.allData) {
            resolve(event.data.allData);
          } else if (event.data.error) {
            reject(event.data.error);
          }
        };

        workerRef.current.onerror = (error) => {
          reject(`Error in worker: ${error.message}`);
        };
      } else {
        reject('Worker is not initialized');
      }
    });
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
          if (writerRef.current) {
            writerRef.current.releaseLock();
            writerRef.current = null;
          }
        }
        snapShotRef.current?.fill(false);
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (error) {
            console.error("Failed to cancel reader:", error);
          }
          if (readerRef.current) {
            readerRef.current.releaseLock();
            readerRef.current = null;
          }
        }

        // Close port
        if (portRef.current.readable) {
          await portRef.current.close();
        }
        portRef.current = null;
        setIsConnected(false); // Update connection state
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
  const appliedEXGFiltersRef = React.useRef<{ [key: number]: number }>({});
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [, forceEXGUpdate] = React.useReducer((x) => x + 1, 0);

  const removeEXGFilter = (channelIndex: number) => {
    delete appliedEXGFiltersRef.current[channelIndex]; // Remove the filter for the channel
    forceEXGUpdate(); // Trigger re-render

  };

  // Function to handle frequency selection
  const handleFrequencySelectionEXG = (channelIndex: number, frequency: number) => {
    appliedEXGFiltersRef.current[channelIndex] = frequency; // Update the filter for the channel
    forceEXGUpdate(); //Trigger re-render

  };

  // Function to set the same filter for all channels
  const applyEXGFilterToAllChannels = (channels: number[], frequency: number) => {
    channels.forEach((channelIndex) => {
      appliedEXGFiltersRef.current[channelIndex] = frequency; // Set the filter for the channel
    });
    forceEXGUpdate(); // Trigger re-render

  };
  // Function to remove the filter for all channels
  const removeEXGFilterFromAllChannels = (channels: number[]) => {
    channels.forEach((channelIndex) => {
      delete appliedEXGFiltersRef.current[channelIndex]; // Remove the filter for the channel
    });
    forceEXGUpdate(); // Trigger re-render

  };
  const removeNotchFilter = (channelIndex: number) => {
    delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
    forceUpdate(); // Trigger re-render
  };
  // Function to handle frequency selection
  const handleFrequencySelection = (channelIndex: number, frequency: number) => {
    appliedFiltersRef.current[channelIndex] = frequency; // Update the filter for the channel
    forceUpdate(); //Trigger re-render
  };

  // Function to set the same filter for all channels
  const applyFilterToAllChannels = (channels: number[], frequency: number) => {
    channels.forEach((channelIndex) => {
      appliedFiltersRef.current[channelIndex] = frequency; // Set the filter for the channel
    });
    forceUpdate(); // Trigger re-render
  };

  // Function to remove the filter for all channels
  const removeNotchFromAllChannels = (channels: number[]) => {
    channels.forEach((channelIndex) => {
      delete appliedFiltersRef.current[channelIndex]; // Remove the filter for the channel
    });
    forceUpdate(); // Trigger re-render
  };
  useEffect(() => {
    setSelectedChannels(selectedChannels)

  }, [selectedChannels]);

  // Function to read data from a connected device and process it
  const readData = async (): Promise<void> => {
    const HEADER_LENGTH = 3; // Length of the packet header
    const NUM_CHANNELS = maxCanvasCountRef.current; // Number of channels in the data packet
    const PACKET_LENGTH = NUM_CHANNELS * 2 + HEADER_LENGTH + 1; // Total length of each packet
    const SYNC_BYTE1 = 0xc7; // First synchronization byte to identify the start of a packet
    const SYNC_BYTE2 = 0x7c; // Second synchronization byte
    const END_BYTE = 0x01; // End byte to signify the end of a packet
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const notchFilters = Array.from({ length: maxCanvasCountRef.current }, () => new Notch());
    const EXGFilters = Array.from({ length: maxCanvasCountRef.current }, () => new EXGFilter());
    notchFilters.forEach((filter) => {
      filter.setbits(detectedBitsRef.current.toString()); // Set the bits value for all instances
    });
    EXGFilters.forEach((filter) => {
      filter.setbits(detectedBitsRef.current.toString()); // Set the bits value for all instances
    });
    try {
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
              const counter = packet[2]; // Extract the counter value from the packet
              channelData.push(counter); // Add the counter to the channel data
              for (let channel = 0; channel < NUM_CHANNELS; channel++) {
                const highByte = packet[channel * 2 + HEADER_LENGTH];
                const lowByte = packet[channel * 2 + HEADER_LENGTH + 1];
                const value = (highByte << 8) | lowByte;

                channelData.push(
                  notchFilters[channel].process(
                    EXGFilters[channel].process(
                      value,
                      appliedEXGFiltersRef.current[channel]
                    ),
                    appliedFiltersRef.current[channel]
                  )
                );

              }
              datastream(channelData); // Pass the channel data to the LineData function for further processing
              if (isRecordingRef.current) {
                const channeldatavalues = channelData
                  .slice(0, canvasnumbersRef.current + 1)
                  .map((value) => (value !== undefined ? value : null))
                  .filter((value): value is number => value !== null); // Filter out null values
                // Check if recording is enabled
                recordingBuffers[activeBufferIndex][fillingindex.current] = channeldatavalues;

                if (fillingindex.current >= MAX_BUFFER_SIZE - 1) {
                  processBuffer(activeBufferIndex, canvasnumbersRef.current, selectedChannels);
                  activeBufferIndex = (activeBufferIndex + 1) % NUM_BUFFERS;
                }
                fillingindex.current = (fillingindex.current + 1) % MAX_BUFFER_SIZE;
                const elapsedTime = Date.now() - recordingStartTime.current;
                setRecordingElapsedTime((prev) => {
                  if (endTimeRef.current !== null && elapsedTime >= endTimeRef.current) {
                    stopRecording();
                    return endTimeRef.current;
                  }
                  return elapsedTime;
                });

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

  const existingRecordRef = useRef<any | undefined>(undefined);
  // Function to handle the recording process
  const handleRecord = async () => {
    if (isRecordingRef.current) {
      // Stop the recording if it is currently active
      stopRecording();

    } else {
      // Start a new recording session
      isRecordingRef.current = true;
      const now = new Date();
      recordingStartTime.current = Date.now();
      setRecordingElapsedTime(Date.now());
      setIsRecordButtonDisabled(true);
      setIsDisplay(false);
      const filename = `ChordsWeb-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-` +
        `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.csv`;

      currentFilenameRef.current = filename;
    }
  };

  const stopRecording = async () => {
    if (!recordingStartTime) {
      toast.error("Recording start time was not captured.");
      return;
    }
    isRecordingRef.current = false;
    setRecordingElapsedTime(0);
    setIsRecordButtonDisabled(false);
    setIsDisplay(true);
    // setRecordingStartTime(0);
    recordingStartTime.current = 0;
    existingRecordRef.current = undefined;
    // Re-fetch datasets from IndexedDB after recording stops
    const fetchData = async () => {
      const data = await getFileCountFromIndexedDB();
      setDatasets(data); // Update datasets with the latest data
    };
    // Call fetchData after stopping the recording
    fetchData();
  };

  // Function to format time from seconds into a "MM:SS" string format
  const formatTime = (milliseconds: number): string => {
    const date = new Date(milliseconds);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const deleteFilesByFilename = async (filename: string) => {
    try {
      const dbRequest = indexedDB.open("ChordsRecordings");

      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction("ChordsRecordings", "readwrite");
        const store = transaction.objectStore("ChordsRecordings");

        // Check if the "filename" index exists
        if (!store.indexNames.contains("filename")) {
          console.error("Index 'filename' does not exist.");
          toast.error("Unable to delete files: index not found.");
          return;
        }

        const index = store.index("filename");
        const deleteRequest = index.openCursor(IDBKeyRange.only(filename));

        // Make this callback async
        deleteRequest.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

          if (cursor) {
            cursor.delete(); // Delete the current record
            // Fetch the updated data and update state
            const data = await getFileCountFromIndexedDB();
            setDatasets(data); // Update datasets with the latest data
          } else {
            console.log(`No file found with filename: ${filename}`);
            toast.success("File deleted successfully.");
          }
        };

        deleteRequest.onerror = () => {
          console.error("Error during delete operation.");
          toast.error("Failed to delete the file. Please try again.");
        };

        transaction.oncomplete = () => {
          console.log("File deletion transaction completed.");
        };

        transaction.onerror = () => {
          console.error("Transaction failed during deletion.");
          toast.error("Failed to delete the file. Please try again.");
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

  // Function to delete all data from IndexedDB (for ZIP files or clear all)
  const deleteAllDataFromIndexedDB = async () => {
    return new Promise<void>((resolve, reject) => {
      try {
        const dbRequest = indexedDB.open("ChordsRecordings", 2);

        dbRequest.onerror = (error) => {
          console.error("Failed to open IndexedDB:", error);
          reject(new Error("Failed to open database"));
        };

        dbRequest.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Start a transaction and get the object store
          const transaction = db.transaction(["ChordsRecordings"], "readwrite");
          const store = transaction.objectStore("ChordsRecordings");

          // Clear all records from the store
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => {
            // Close the database connection
            db.close();

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
          if (!db.objectStoreNames.contains("ChordsRecordings")) {
            const store = db.createObjectStore("ChordsRecordings", {
              keyPath: "filename",

            });
            store.createIndex("filename", "filename", { unique: false });

          }
        };

      } catch (error) {
        console.error("Error in deleteAllDataFromIndexedDB:", error);
        reject(error);
      }
    });
  };

  return (
    <div className="flex-none items-center justify-center pb-4 bg-g">
      {/* Left-aligned section */}
      <div className="absolute left-4 flex items-center mx-0 px-0 space-x-1">
        {isRecordingRef.current && (
          <div className="flex items-center space-x-1 w-min">
            <button className="flex items-center justify-center px-1 py-2   select-none min-w-20 bg-primary text-destructive whitespace-nowrap rounded-xl"
            >
              {formatTime(recordingElapsedTime)}
            </button>
            <Separator orientation="vertical" className="bg-primary h-9 " />
            <div>
              <Popover
                open={isEndTimePopoverOpen}
                onOpenChange={setIsEndTimePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    className="flex items-center justify-center px-1 py-2   select-none min-w-10  text-destructive whitespace-nowrap rounded-xl"
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
              <Button
                className="flex items-center justify-center gap-1 py-2 px-2 sm:py-3 sm:px-4 rounded-xl font-semibold"
                onClick={isConnected ? disconnectDevice : connectToDevice}
                disabled={isLoading} // Disable button during loading
              >
                {isLoading ? (
                  <>
                    <Loader size={17} className="animate-spin" /> {/* Spinning loader */}
                    Connecting...
                  </>
                ) : isConnected ? (
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


        {/* Display (Play/Pause) button with tooltip */}
        {isConnected && (
          <div className="flex items-center gap-0.5 mx-0 px-0">
            <Button
              className="rounded-xl rounded-r-none"
              onClick={handlePrevSnapshot}
              disabled={isDisplay || clickCount >= enabledClicks}

            >
              <ArrowLeftToLine size={16} />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="rounded-xl rounded-l-none rounded-r-none" onClick={togglePause}>
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
            <Button
              className="rounded-xl rounded-l-none"
              onClick={handleNextSnapshot}
              disabled={isDisplay || clickCount == 0}
            >
              <ArrowRightToLine size={16} />
            </Button>
          </div>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="rounded-xl p-4">
                    <FileArchive size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-4 text-base shadow-lg rounded-xl w-full">
                  <div className="space-y-4">
                    {/* List each file with download and delete actions */}
                    {datasets.length > 0 ? (
                      datasets.map((dataset) => (
                        <div key={dataset} className="flex justify-between items-center">
                          {/* Display the filename directly */}
                          <span className=" mr-4">
                            {dataset}
                          </span>

                          <div className="flex space-x-2">
                            {/* Save file by filename */}
                            <Button
                              onClick={() => saveDataByFilename(dataset, canvasCount, selectedChannels)}
                              className="rounded-xl px-4"
                            >
                              <Download size={16} />
                            </Button>

                            {/* Delete file by filename */}
                            <Button
                              onClick={() => {
                                deleteFilesByFilename(dataset);
                              }}
                              className="rounded-xl px-4"
                            >
                              <Trash2 size={16} />
                            </Button>

                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-base ">No datasets available</p>
                    )}
                    {/* Download all as ZIP and delete all options */}
                    {datasets.length > 0 && (
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
                    )}
                  </div>
                </PopoverContent>
              </Popover>
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
                    <div className="flex items-center border border-input rounded-xl mx-0 px-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeEXGFilterFromAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i))}
                        className={`rounded-xl rounded-r-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === 0
                            ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <CircleOff size={17} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyEXGFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 4)}
                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === maxCanvasCountRef.current && Object.values(appliedEXGFiltersRef.current).every((value) => value === 4)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <BicepsFlexed size={17} />
                      </Button> <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyEXGFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 3)}
                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === maxCanvasCountRef.current&& Object.values(appliedEXGFiltersRef.current).every((value) => value === 3)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <Brain size={17} />
                      </Button> <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyEXGFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 1)}
                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === maxCanvasCountRef.current && Object.values(appliedEXGFiltersRef.current).every((value) => value === 1)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <Heart size={17} />
                      </Button> <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyEXGFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 2)}
                        className={`rounded-xl rounded-l-none border-0
                        ${Object.keys(appliedEXGFiltersRef.current).length === maxCanvasCountRef.current && Object.values(appliedEXGFiltersRef.current).every((value) => value === 2)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <Eye size={17} />
                      </Button>
                    </div>
                    <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeNotchFromAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i))}
                        className={`rounded-xl rounded-r-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === 0
                            ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        <CircleOff size={17} />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 1)}
                        className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === maxCanvasCountRef.current && Object.values(appliedFiltersRef.current).every((value) => value === 1)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        50Hz
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyFilterToAllChannels(Array.from({ length: maxCanvasCountRef.current }, (_, i) => i), 2)}
                        className={`rounded-xl rounded-l-none border-0
                          ${Object.keys(appliedFiltersRef.current).length === maxCanvasCountRef.current && Object.values(appliedFiltersRef.current).every((value) => value === 2)
                            ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                            : "bg-white-500" // Active background
                          }`}
                      >
                        60Hz
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  {channelNamesfil.map((filterName, index) => (
                    <div key={filterName} className="flex items-center">
                      {/* Filter Name */}
                      <div className="text-sm font-semibold w-12">{filterName}</div>
                      {/* Buttons */}
                      <div className="flex space-x-2">
                        <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeEXGFilter(index)}
                            className={`rounded-xl rounded-r-none border-l-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === undefined
                                ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <CircleOff size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelectionEXG(index, 4)}
                            className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === 4
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <BicepsFlexed size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelectionEXG(index, 3)}
                            className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                      ${appliedEXGFiltersRef.current[index] === 3
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <Brain size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelectionEXG(index, 1)}
                            className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === 1
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <Heart size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelectionEXG(index, 2)}
                            className={`rounded-xl rounded-l-none border-0
                                                        ${appliedEXGFiltersRef.current[index] === 2
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <Eye size={17} />
                          </Button>
                        </div>
                        <div className="flex border border-input rounded-xl items-center mx-0 px-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeNotchFilter(index)}
                            className={`rounded-xl rounded-r-none border-0
                                                        ${appliedFiltersRef.current[index] === undefined
                                ? "bg-red-700 hover:bg-white-500 hover:text-white text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            <CircleOff size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelection(index, 1)}
                            className={`flex items-center justify-center px-3 py-2 rounded-none select-none border-0
                                                        ${appliedFiltersRef.current[index] === 1
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white" // Disabled background
                                : "bg-white-500" // Active background
                              }`}
                          >
                            50Hz
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFrequencySelection(index, 2)}
                            className={
                              `rounded-xl rounded-l-none border-0 ${appliedFiltersRef.current[index] === 2
                                ? "bg-green-700 hover:bg-white-500 text-white hover:text-white "
                                : "bg-white-500 animate-fade-in-right"
                              }`
                            }
                          >
                            60Hz
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}



        {isConnected && (
          <Popover>
            <PopoverTrigger asChild>
              <Button className="flex items-center justify-center select-none whitespace-nowrap rounded-lg">
                <Settings size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[30rem] p-4 rounded-md shadow-md text-sm">
              <TooltipProvider>
                <div className="space-y-6">
                  {/* Channel Selection */}
                  <div className="flex items-center justify-center rounded-lg mb-[2.5rem]">
                    <div className=" w-full">
                      <div className="absolute inset-0 rounded-lg border-gray-300 dark:border-gray-600 opacity-50 pointer-events-none"></div>
                      <div className="relative">
                        {/* Heading and Select All Button */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-semibold text-gray-500">
                            <span className="font-bold text-gray-600">Channels Count:</span> {selectedChannels.length}
                          </h3>
                          <button
                            onClick={handleSelectAllToggle}
                            className={`px-4 py-1 text-xs font-light rounded-lg transition ${isSelectAllDisabled
                              ? "text-gray-400 bg-gray-200 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                              : "text-white bg-black hover:bg-gray-700 dark:bg-white dark:text-black dark:border dark:border-gray-500 dark:hover:bg-primary/70"
                              }`}
                            disabled={isSelectAllDisabled}
                          >
                            {isAllEnabledSelected ? "RESET" : "Select All"}
                          </button>

                        </div>

                        {/* Button Grid */}
                        <div id="button-container" className="relative space-y-2 rounded-lg">
                          {Array.from({ length: 2 }).map((_, container) => (
                            <div
                              key={container}
                              className={`grid grid-cols-8 gap-2`}
                            >
                              {Array.from({ length: 8 }).map((_, col) => {
                                const index = container * 8 + col;
                                const isChannelDisabled = index >= maxCanvasCountRef.current;

                                const buttonColors = [
                                  "bg-custom-1", "bg-custom-2", "bg-custom-3", "bg-custom-4",
                                  "bg-custom-5", "bg-custom-6", "bg-custom-7", "bg-custom-8",
                                  "bg-custom-9", "bg-custom-10", "bg-custom-11", "bg-custom-12",
                                  "bg-custom-13", "bg-custom-14", "bg-custom-15", "bg-custom-16",
                                ];

                                const backgroundColorClass = buttonColors[index % buttonColors.length];
                                const buttonClass = isChannelDisabled
                                  ? isDarkMode
                                    ? "bg-[#030c21] text-gray-700 cursor-not-allowed"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : selectedChannels.includes(index + 1)
                                    ? `${backgroundColorClass} text-white`
                                    : "bg-white text-black hover:bg-gray-100";

                                const isFirstInRow = col === 0;
                                const isLastInRow = col === 7;
                                const isFirstContainer = container === 0;
                                const isLastContainer = container === 1;

                                // Adjust rounded corners for each container individually
                                const roundedClass = `${isFirstInRow && isFirstContainer ? "rounded-tl-lg" : ""} 
                                                               ${isLastInRow && isFirstContainer ? "rounded-tr-lg" : ""} 
                                                               ${isFirstInRow && isLastContainer ? "rounded-bl-lg" : ""} 
                                                               ${isLastInRow && isLastContainer ? "rounded-br-lg" : ""}`;

                                return (
                                  <button
                                    key={index}
                                    onClick={() => !isChannelDisabled && toggleChannel(index + 1)}
                                    disabled={isChannelDisabled || isRecordButtonDisabled}
                                    className={`w-full h-8 text-xs font-medium py-1 border-[0.05px] border-gray-300 dark:border-gray-600 transition-colors duration-200 ${buttonClass} ${roundedClass}`}
                                  >
                                    {`CH${index + 1}`}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div className="relative w-full flex flex-col items-start text-sm mb-[2rem]">
                    <p className="absolute top-[-1.2rem] left-0 text-xs font-semibold text-gray-500">
                      <span className="font-bold text-gray-600">Zoom Level:</span> {Zoom}x
                    </p>
                    <div className="relative w-[28rem] flex items-center rounded-lg py-2 border border-gray-300 dark:border-gray-600 mb-4">
                      {/* Button for setting Zoom to 1 */}
                      <button
                        className="text-gray-700 dark:text-gray-400 mx-1 px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => SetZoom(1)}
                      >
                        1
                      </button>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={Zoom}
                        onChange={(e) => SetZoom(Number(e.target.value))}
                        style={{
                          background: `linear-gradient(to right, rgb(101, 136, 205) ${((Zoom - 1) / 9) * 100}%, rgb(165, 165, 165) ${((Zoom - 1) / 9) * 11}%)`,
                        }}
                        className="flex-1 h-[0.15rem] rounded-full appearance-none bg-gray-800 focus:outline-none focus:ring-0 slider-input"
                      />

                      {/* Button for setting Zoom to 10 */}
                      <button
                        className="text-gray-700 dark:text-gray-400 mx-2 px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => SetZoom(10)}
                      >
                        10
                      </button>
                      <style jsx>{` input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
                                            background-color: rgb(101, 136, 205); border-radius: 50%; cursor: pointer; } `}</style>
                    </div>
                  </div>

                  {/* Time-Base Selection */}
                  <div className="relative w-full flex flex-col items-start mt-3 text-sm">
                    <p className="absolute top-[-1.2rem] left-0 text-xs font-semibold text-gray-500">
                      <span className="font-bold text-gray-600">Time Base:</span> {timeBase} Seconds
                    </p>
                    <div className="relative w-[28rem] flex items-center rounded-lg py-2 border border-gray-300 dark:border-gray-600">
                      {/* Button for setting Time Base to 1 */}
                      <button
                        className="text-gray-700 dark:text-gray-400 mx-1 px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => setTimeBase(1)}
                      >
                        1
                      </button>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={timeBase}
                        onChange={(e) => setTimeBase(Number(e.target.value))}
                        style={{
                          background: `linear-gradient(to right, rgb(101, 136, 205) ${((timeBase - 1) / 9) * 100}%, rgb(165, 165, 165) ${((timeBase - 1) / 9) * 11}%)`,
                        }}
                        className="flex-1 h-[0.15rem] rounded-full appearance-none bg-gray-200 focus:outline-none focus:ring-0 slider-input"
                      />

                      {/* Button for setting Time Base to 10 */}
                      <button
                        className="text-gray-700 dark:text-gray-400 mx-2 px-2 py-1 border rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => setTimeBase(10)}
                      >
                        10
                      </button>
                      <style jsx>{` input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none;appearance: none; width: 15px; height: 15px;
                                             background-color: rgb(101, 136, 205); border-radius: 50%; cursor: pointer; }`}</style>
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};

export default Connection;

