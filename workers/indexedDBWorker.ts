self.onmessage = async (event) => {
    const { action, data, filename } = event.data;
  
    // Open IndexedDB
    const db = await openIndexedDB();
  
    switch (action) {
      case 'write':
        const success = await writeToIndexedDB(db, data, filename);
        self.postMessage({ success });
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
  