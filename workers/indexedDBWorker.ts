import { toast } from "sonner";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
self.onmessage = async (event) => {
  const { action, data, filename, canvasCount } = event.data;
 
  
    // Open IndexedDB
    const db = await openIndexedDB();
  
    switch (action) {
      case 'write':
        const success = await writeToIndexedDB(db, data, filename);
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
        case 'saveAsZip':
          try {
            const zipBlob = await saveAllDataAsZip();
            self.postMessage({ zipBlob });
          } catch (error) {
            self.postMessage({ error: 'Failed to create ZIP file' });
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
  const writeToIndexedDB = async (db: IDBDatabase, data: number[][], filename: string): Promise<boolean> => {
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
  
  // Function to check if a record exists in IndexedDB
  const checkRecordExistence = async (db: IDBDatabase, filename: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const tx = db.transaction("ChordsRecordings", "readonly");
      const store = tx.objectStore("ChordsRecordings");
      const getRequest = store.get(filename);
  
      getRequest.onsuccess = () => resolve(!!getRequest.result);
      getRequest.onerror = () => resolve(false);
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
// Function to convert data to CSV
const convertToCSV = (data: any[], canvasCount: number): string => {
  if (!data || data.length === 0) return "";

  // Generate the header dynamically based on the number of channels
  const header = ["Counter", ...Array.from({ length: canvasCount }, (_, i) => `Channel${i + 1}`)];

  // Create rows by mapping data to match the header fields
  const rows = data.map((item, index) =>
    (item ? [...item.slice(0, canvasCount + 1)].map((field) =>
      field !== undefined && field !== null ? JSON.stringify(field) : ""
    ).join(",") : "").trim()
  );

  // Combine header and rows into a CSV format
  return [header.join(","), ...rows].join("\n");
};

// Function to save all data as a ZIP file
const saveAllDataAsZip = async (): Promise<Blob> => {
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
    const canvasCount = 4; // Assuming canvasCount is defined

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
