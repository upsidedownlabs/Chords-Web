export {};
self.onmessage = async (event: MessageEvent) => {
    const { action, data, filename, canvasnumbersRef } = event.data;

  try {
    const db = await openIndexedDB();

    if (action === "write") {
      const success = await writeToIndexedDB(db, data, filename, canvasnumbersRef);
      self.postMessage({ success });
    } else {
      self.postMessage({ error: "Invalid action in writeWorker" });
    }
  } catch (error) {
    console.error("Error in worker:", error);
    self.postMessage({ error });
  }

  };

// Function to open IndexedDB
const openIndexedDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ChordsRecordings", 2);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("ChordsRecordings")) {
        const store = db.createObjectStore("ChordsRecordings", {
          keyPath: "filename",
        });
        store.createIndex("filename", "filename", { unique: true });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

const writeToIndexedDB = (
    db: IDBDatabase,
    data: number[][],
    filename: string,
    canvasCount: number
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("ChordsRecordings", "readwrite");
      const store = tx.objectStore("ChordsRecordings");
  
      const getRequest = store.get(filename);
  
      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
  
        // Process data to filter and map valid rows
        const processedData = data
          .filter((item, index) => {
            if (!item || !Array.isArray(item)) {
              console.warn(`Skipping invalid data at index ${index}:`, item);
              return false;
            }
            return true;
          })
          .map((item) => item.slice(0, canvasCount + 1));
  
        if (existingRecord) {
            console.log(processedData);
          // Append processed data to existing content
          existingRecord.content.push(...processedData);
          const putRequest = store.put(existingRecord);
          putRequest.onsuccess = () => resolve(true);
          putRequest.onerror = () => reject(false);
        } else {
          // Create new record with processed data
          const newRecord = { filename, content: processedData };
          const putRequest = store.put(newRecord);
          putRequest.onsuccess = () => resolve(true);
          putRequest.onerror = () => reject(false);
        }
      };
  
      getRequest.onerror = () => reject(false);
    });
  };
  
