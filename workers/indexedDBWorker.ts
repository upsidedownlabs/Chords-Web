import JSZip from 'jszip';
import { Result } from 'postcss';
import { toast } from "sonner";
let canvasCount = 0;
let selectedChannels: number[] = []; // Explicitly specify the type as an array of numbers
self.onmessage = async (event) => {
  const { action, data, filename, selectedChannels: channels } = event.data;

  // Open IndexedDB
  const db = await openIndexedDB();

  switch (action) {
    case 'setCanvasCount':
      canvasCount = event.data.canvasCount; // Update canvas count independently
      self.postMessage({ success: true, message: 'Canvas count updated' });
      break;
    case 'setSelectedChannels':
      if (Array.isArray(channels) && channels.every((ch) => typeof ch === 'number')) {
        selectedChannels = channels; // Update selectedChannels in the worker
        console.log('Updated selectedChannels in worker:', selectedChannels);
        self.postMessage({ success: true, message: 'Selected channels updated' });
      } else {
        console.error('Invalid selectedChannels received:', channels);
        self.postMessage({ success: false, message: 'Invalid selectedChannels format' });
      }
      break;
    case 'write':
      const success = await writeToIndexedDB(db, data, filename, canvasCount, selectedChannels);
      self.postMessage({ success });
      break;
    case 'getAllData':
      try {
        const allData = await getAllDataFromIndexedDB(db);
        self.postMessage({ allData });
      } catch (error) {
        self.postMessage({ error: 'Failed to retrieve all data from IndexedDB' });
      }
      break;
    case 'getFileCountFromIndexedDB':
      try {
        const allData = await getFileCountFromIndexedDB(db);
        self.postMessage({ allData });
      } catch (error) {
        self.postMessage({ error: 'Failed to retrieve all data from IndexedDB' });
      }
      break;
    case 'saveAsZip':
      try {
        const zipBlob = await saveAllDataAsZip(canvasCount, selectedChannels);
        self.postMessage({ zipBlob });
      } catch (error) {
        self.postMessage({ error: 'Failed to create ZIP file' });
      }
      break;
    case 'saveDataByFilename':
      try {
        const blob = await saveDataByFilename(filename, canvasCount, selectedChannels);
        self.postMessage({ blob });
      } catch (error) {
        self.postMessage({ error });
      }
      break;
    default:
      self.postMessage({ error: 'Invalid action' });
  }
};

// Function to open IndexedDB
const openIndexedDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ChordsRecordings", 2);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const store = db.createObjectStore("ChordsRecordings", {
        keyPath: "filename",
      });
      store.createIndex("filename", "filename", { unique: true });
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

// Function to write data to IndexedDB
const writeToIndexedDB = async (db: IDBDatabase, data: number[][], filename: string, canvasCount: number, selectedChannels: number[]): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ChordsRecordings", "readwrite");
    const store = tx.objectStore("ChordsRecordings");
    console.log("selected channels in worker", selectedChannels)
    const getRequest = store.get(filename);


    getRequest.onsuccess = () => {
      const existingRecord = getRequest.result;

      if (existingRecord) {
        existingRecord.content.push(...data);
        const putRequest = store.put(existingRecord);
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(false);
      } else {
        const newRecord = { filename, content: [...data] };
        const putRequest = store.put(newRecord);
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(false);
      }
    };
    getRequest.onerror = () => reject(false);
  });
};

// Function to get all data
const getAllDataFromIndexedDB = async (db: IDBDatabase): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["ChordsRecordings"], "readonly");
    const store = tx.objectStore("ChordsRecordings");
    const request = store.getAll();

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
};

// Function to convert data to CSV
const convertToCSV = (data: any[], canvasCount: number, selectedChannels: number[]): string => {
  if (!Array.isArray(data) || data.length === 0) {
    console.error("Input data is empty or invalid.");
    return "";
  }
  console.log("Data received for CSV conversion:", data);

  // Generate the header dynamically for the selected channels
  const header = ["Counter", ...selectedChannels.map((channel) => `Channel${channel}`)];
  console.log("Generated Header:", header, data);

  // Create rows by filtering and mapping valid data
  const rows = data
    .filter((item, index) => {
      if (!item || !Array.isArray(item)) {
        console.warn(`Skipping invalid data at index ${index}:`, item);
        return false;
      }

      // Filter out rows where all channels are empty or invalid
      const hasValidData = item.some((field: any) => field !== '' && field !== null && field !== undefined);
      if (!hasValidData) {
        console.warn(`Skipping empty data at index ${index}:`, item);
      }
      return hasValidData;
    })
    .map((item, rowIndex) => {
      console.log("item", item);
      console.log(`Processing row ${rowIndex}:`, item);

      // Include Counter (assumed to be the first element) and selected channels' data
      const filteredRow = [
        item[0], // Counter
        ...selectedChannels.map((channel) => {
          if (channel < item.length) {
            const value = item[channel];
            console.log(`Row ${rowIndex}, Channel ${channel}:`, value);
            return value !== undefined && value !== null ? value : "";
          } else {
            console.warn(`Channel ${channel} out of bounds for row ${rowIndex}.`);
            return ""; // Fill missing values with an empty string
          }
        }),
      ];

      console.log("Filtered row:", filteredRow);
      return filteredRow
        .map((field) => (field !== undefined && field !== null ? JSON.stringify(field) : ""))
        .join(",");
    });

  // Combine header and rows into a CSV format
  return [header.join(","), ...rows].join("\n");
};


// Function to save all data as a ZIP file
const saveAllDataAsZip = async (canvasCount: number, selectedChannels: number[]): Promise<Blob> => {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("ChordsRecordings", "readonly");
    const store = tx.objectStore("ChordsRecordings");

    const allData: any[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    console.log("Alldata in csv", allData);
    if (!allData || allData.length === 0) {
      throw new Error("No data available to download.");
    }

    const zip = new JSZip();

    allData.forEach((record) => {
      try {
        console.log("Record content before conversion:", record.content);
        const csvData = convertToCSV(record.content, canvasCount, selectedChannels);
        zip.file(record.filename, csvData);
      } catch (error) {
        console.error(`Error processing record ${record.filename}:`, error);
      }
    });


    toast.success("Data successfully downloaded as ZIP.");

    const content = await zip.generateAsync({ type: "blob" });
    return content;
  } catch (error) {
    console.error("Error creating ZIP file in worker:", error);
    throw error;
  }
};


const saveDataByFilename = async (
  filename: string,
  canvasCount: number,
  selectedChannels: number[]
): Promise<Blob> => {
  try {
    const dbRequest = indexedDB.open("ChordsRecordings");

    return new Promise((resolve, reject) => {
      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction("ChordsRecordings", "readonly");
        const store = transaction.objectStore("ChordsRecordings");

        if (!store.indexNames.contains("filename")) {
          reject(new Error("Index 'filename' does not exist."));
          return;
        }

        const index = store.index("filename");
        const getRequest = index.get(filename);

        getRequest.onsuccess = () => {
          const result = getRequest.result;

          if (!result || !Array.isArray(result.content)) {
            reject(new Error("No data found for the given filename or invalid data format."));
            return;
          }

          // Validate the content structure
          if (!result.content.every((item: any) => Array.isArray(item))) {
            reject(new Error("Content data contains invalid or non-array elements."));
            return;
          }
          console.log("result", result);
          try {
            // Convert data to CSV with selected channels
            const csvData = convertToCSV(result.content, canvasCount, selectedChannels);

            // Create a Blob from the CSV data
            const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
            resolve(blob);
          } catch (conversionError) {
            console.error("Error converting data to CSV:", conversionError);
            reject(new Error("Failed to convert data to CSV format."));
          }
        };

        getRequest.onerror = () => {
          reject(new Error("Error during file retrieval."));
        };
      };

      dbRequest.onerror = () => {
        reject(new Error("Failed to open IndexedDB database."));
      };
    });
  } catch (error) {
    console.error("Error occurred during file download:", error);
    throw new Error("Error occurred during file download.");
  }
};


const getFileCountFromIndexedDB = async (db: IDBDatabase): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["ChordsRecordings"], "readonly");
    const store = tx.objectStore("ChordsRecordings");
    const filenames: string[] = [];

    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        const record = cursor.value;
        if (record.filename) {
          filenames.push(record.filename); // Replace `filename` with your actual property name
        }
        cursor.continue();
      } else {
        resolve(filenames); // All filenames collected
      }
    };

    cursorRequest.onerror = (event) => {
      const error = (event.target as IDBRequest).error;
      console.error("Error retrieving filenames from IndexedDB:", error);
      reject(error);
    };
  });
};
