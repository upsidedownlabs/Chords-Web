import JSZip from 'jszip';
let canvasCount = 0; 
self.onmessage = async (event) => {
  const { action, data, filename} = event.data;

  // Open IndexedDB
  const db = await openIndexedDB();

  switch (action) {
    case 'setCanvasCount':
      canvasCount = event.data.canvasCount; // Update canvas count independently
      self.postMessage({ success: true, message: 'Canvas count updated' });
      break;
    case 'write':
      const success = await writeToIndexedDB(db, data, filename, canvasCount);
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
        const zipBlob = await saveAllDataAsZip(canvasCount);
        self.postMessage({ zipBlob });
      } catch (error) {
        self.postMessage({ error: 'Failed to create ZIP file' });
      }
      break;
    case 'saveDataByFilename':
      try {
        const blob = await saveDataByFilename(filename, canvasCount);
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
const writeToIndexedDB = async (db: IDBDatabase, data: number[][], filename: string, canvasCount: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ChordsRecordings", "readwrite");
    const store = tx.objectStore("ChordsRecordings");

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
const convertToCSV = (data: any[], canvasCount: number): string => {
  if (!Array.isArray(data) || data.length === 0) return "";

  // Generate the header dynamically based on the number of channels
  const header = ["Counter", ...Array.from({ length: canvasCount }, (_, i) => `Channel${i + 1}`)];

  // Create rows by filtering and mapping valid data
  const rows = data
    .filter((item, index) => {
      if (!item || !Array.isArray(item)) {
        console.warn(`Skipping invalid data at index ${index}:`, item);
        return false;
      }
      return true;
    })
    .map((item) =>
      [...item.slice(0, canvasCount + 1)]
        .map((field) => (field !== undefined && field !== null ? JSON.stringify(field) : ""))
        .join(",")
    );

  // Combine header and rows into a CSV format
  return [header.join(","), ...rows].join("\n");
};

// Function to save all data as a ZIP file
const saveAllDataAsZip = async (canvasCount: number): Promise<Blob> => {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("ChordsRecordings", "readonly");
    const store = tx.objectStore("ChordsRecordings");

    const allData: any[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!allData || allData.length === 0) {
      throw new Error("No data available to download.");
    }

    const zip = new JSZip();

    allData.forEach((record) => {
      try {
        const csvData = convertToCSV(record.content, canvasCount);
        zip.file(record.filename, csvData);
      } catch (error) {
        console.error(`Error processing record ${record.filename}:`, error);
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    return content;
  } catch (error) {
    console.error("Error creating ZIP file in worker:", error);
    throw error;
  }
};

const saveDataByFilename = async (filename: string, canvasCount: number): Promise<Blob> => {
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

          // Validate `result.content` before processing
          if (!result.content.every((item: any) => Array.isArray(item))) {
            reject(new Error("Content data contains invalid or non-array elements."));
            return;
          }

          const csvData = convertToCSV(result.content, canvasCount);
          const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
          resolve(blob);
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
