import JSZip from 'jszip';

// Global variables
let canvasCount = 0;
let selectedChannels: number[] = [];
const CHUNK_SIZE = 1000; // Store data in chunks of 1000 arrays

self.onmessage = async (event) => {
    const { action, data, filename, selectedChannels: channels, canvasElementCount } = event.data;

    // Open IndexedDB
    const db = await openIndexedDB();

    const handlePostMessage = (message: any) => {
        self.postMessage(message);
    };

    const handleError = (error: string) => {
        handlePostMessage({ error });
    };

    switch (action) {
        case 'setCanvasCount':
            canvasCount = event.data.canvasCount;
            handlePostMessage({ success: true, message: 'Canvas count updated' });
            break;

        case 'setSelectedChannels':
            if (Array.isArray(channels) && channels.every((ch) => typeof ch === 'number')) {
                selectedChannels = channels;
                handlePostMessage({ success: true, message: 'Selected channels updated' });
            } else {
                console.error('Invalid selectedChannels received:', channels);
                handlePostMessage({ success: false, message: 'Invalid selectedChannels format' });
            }
            break;

        case 'write':
            try {
                const success = await writeToIndexedDB(db, data, filename);
                handlePostMessage({ 
                    action: 'writeComplete', 
                    filename, 
                    success 
                });
            } catch (error) {
                handleError('Failed to write data to IndexedDB');
            }
            break;

        case 'getFileCountFromIndexedDB':
            try {
                const filenames = await getFileCountFromIndexedDB(db);
                handlePostMessage({ 
                    action: 'getFileCountFromIndexedDB',
                    allData: filenames 
                });
            } catch (error) {
                handleError('Failed to retrieve data from IndexedDB');
            }
            break;

        case 'saveAsZip':
            try {
                const zipBlob = await saveAllDataAsZip(canvasElementCount || canvasCount, selectedChannels);
                handlePostMessage({ 
                    action: 'saveAsZip',
                    blob: zipBlob 
                });
            } catch (error) {
                handleError('Failed to create ZIP file');
            }
            break;

        case 'saveDataByFilename':
            try {
                const blob = await saveDataByFilename(filename, canvasCount, selectedChannels);
                handlePostMessage({ 
                    action: 'saveDataByFilename',
                    blob, 
                    filename 
                });
            } catch (error) {
                handleError(error instanceof Error ? error.message : 'Unknown error');
            }
            break;

        case 'deleteFile':
            if (!filename) {
                throw new Error('Filename is required for deleteFile action.');
            }
            await deleteFilesByFilename(filename);
            handlePostMessage({ 
                success: true, 
                action: 'deleteFile',
                filename 
            });
            break;

        case 'deleteAll':
            await deleteAllDataFromIndexedDB();
            handlePostMessage({ 
                success: true, 
                action: 'deleteAll' 
            });
            break;

        default:
            handlePostMessage({ error: 'Invalid action' });
    }
};

// Interface for metadata
interface FileMetadata {
    filename: string;
    totalChunks: number;
    totalRecords: number;
    lastUpdated: Date;
    created: Date;
}

// Function to open IndexedDB
const openIndexedDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ChordsRecordings", 3); // Version bump

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create metadata store
            if (!db.objectStoreNames.contains("FileMetadata")) {
                const metadataStore = db.createObjectStore("FileMetadata", { keyPath: "filename" });
                metadataStore.createIndex("filename", "filename", { unique: true });
            }

            // Create data chunks store with composite key
            if (!db.objectStoreNames.contains("DataChunks")) {
                const chunksStore = db.createObjectStore("DataChunks", {
                    keyPath: ["filename", "chunkIndex"]
                });
                chunksStore.createIndex("byFilename", "filename", { unique: false });
            }
        };

        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
};

// Helper function for IndexedDB transactions
const performIndexDBTransaction = async <T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    try {
        return await callback(store);
    } catch (error) {
        throw new Error(`Transaction failed: ${error}`);
    }
};

// Function to get or create file metadata
const getFileMetadata = async (db: IDBDatabase, filename: string): Promise<FileMetadata> => {
    return performIndexDBTransaction(db, "FileMetadata", "readonly", (store) => {
        return new Promise<FileMetadata>((resolve, reject) => {
            const request = store.get(filename);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    // Create default metadata
                    resolve({
                        filename,
                        totalChunks: 0,
                        totalRecords: 0,
                        lastUpdated: new Date(),
                        created: new Date()
                    });
                }
            };
            request.onerror = () => reject(request.error);
        });
    });
};

// Function to update file metadata
const updateFileMetadata = async (db: IDBDatabase, metadata: FileMetadata): Promise<void> => {
    return performIndexDBTransaction(db, "FileMetadata", "readwrite", (store) => {
        return new Promise<void>((resolve, reject) => {
            const request = store.put(metadata);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

// Function to write data to IndexedDB (optimized with chunking)
const writeToIndexedDB = async (
    db: IDBDatabase,
    data: number[][],
    filename: string
): Promise<boolean> => {
    try {
        // Get or create metadata
        const metadata = await getFileMetadata(db, filename);

        // Calculate which chunks we need to write
        const startIndex = metadata.totalRecords;
        const endIndex = startIndex + data.length;
        const startChunk = Math.floor(startIndex / CHUNK_SIZE);
        const endChunk = Math.floor((endIndex - 1) / CHUNK_SIZE);

        // Process each chunk
        for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
            const chunkStart = chunkIndex * CHUNK_SIZE;
            const chunkEnd = chunkStart + CHUNK_SIZE;

            // Calculate what portion of data goes into this chunk
            const dataStart = Math.max(0, chunkStart - startIndex);
            const dataEnd = Math.min(data.length, chunkEnd - startIndex);

            if (dataStart >= dataEnd) continue;

            const chunkData = data.slice(dataStart, dataEnd);

            // Get existing chunk or create new
            const existingChunk = await performIndexDBTransaction(
                db,
                "DataChunks",
                "readwrite",
                (store) => {
                    return new Promise<any>((resolve, reject) => {
                        const key = [filename, chunkIndex];
                        const request = store.get(key);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                }
            );

            if (existingChunk) {
                // Append to existing chunk
                existingChunk.data.push(...chunkData);

                await performIndexDBTransaction(
                    db,
                    "DataChunks",
                    "readwrite",
                    (store) => {
                        return new Promise<void>((resolve, reject) => {
                            const request = store.put(existingChunk);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                    }
                );
            } else {
                // Create new chunk
                const newChunk = {
                    filename,
                    chunkIndex,
                    data: chunkData
                };

                await performIndexDBTransaction(
                    db,
                    "DataChunks",
                    "readwrite",
                    (store) => {
                        return new Promise<void>((resolve, reject) => {
                            const request = store.put(newChunk);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                    }
                );
            }
        }

        // Update metadata
        metadata.totalRecords += data.length;
        metadata.totalChunks = Math.ceil(metadata.totalRecords / CHUNK_SIZE);
        metadata.lastUpdated = new Date();

        await updateFileMetadata(db, metadata);

        return true;
    } catch (error) {
        console.error("Error writing to IndexedDB:", error);
        return false;
    }
};

// Function to read all data for a file
// Helper: merge two data arrays
const mergeArrays = (a: number[][], b: number[][]): number[][] => {
    if (!a || a.length === 0) return b || [];
    if (!b || b.length === 0) return a || [];
    return [...a, ...b];
};

// Function to read all data for a file (tree-style merging)
const readFileData = async (
    db: IDBDatabase,
    filename: string
): Promise<number[][]> => {
    const metadata = await getFileMetadata(db, filename);

    if (!metadata || metadata.totalChunks === 0) {
        return [];
    }

    // Step 1: Load all chunks into an array
    let chunkBuffers: number[][][] = [];

    for (let chunkIndex = 0; chunkIndex < metadata.totalChunks; chunkIndex++) {
        const chunk = await performIndexDBTransaction(
            db,
            "DataChunks",
            "readonly",
            (store) => {
                return new Promise<any>((resolve, reject) => {
                    const key = [filename, chunkIndex];
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            }
        );

        if (chunk && Array.isArray(chunk.data)) {
            chunkBuffers.push(chunk.data);
        }
    }

    // Step 2: Tree-style pairwise merge
    while (chunkBuffers.length > 1) {
        const nextLevel: number[][][] = [];

        for (let i = 0; i < chunkBuffers.length; i += 2) {
            if (i + 1 < chunkBuffers.length) {
                // merge pairs
                const merged = mergeArrays(chunkBuffers[i], chunkBuffers[i + 1]);
                nextLevel.push(merged);
            } else {
                // odd chunk, carry forward
                nextLevel.push(chunkBuffers[i]);
            }
        }

        chunkBuffers = nextLevel;
    }

    // Final merged result
    return chunkBuffers[0] || [];
};

// Function to convert data to CSV
const convertToCSV = (data: any[], canvasCount: number, selectedChannels: number[]): string => {
    if (!Array.isArray(data) || data.length === 0) return "";

    // Generate the header dynamically for the selected channels
    const header = ["Counter", ...selectedChannels.map((channel) => `Channel${channel}`)];

    const rows = data
        .filter((item, index) => {
            if (!item || !Array.isArray(item) || item.length === 0) {
                console.warn(`Skipping invalid data at index ${index}:`, item);
                return false;
            }
            return true;
        })
        .map((item, index) => {
            const filteredRow = [
                item[0], // Counter
                ...selectedChannels.map((channel, i) => {
                    if (channel && item[i + 1] !== undefined) {
                        return item[i + 1];
                    } else {
                        console.warn(`Missing data for channel ${channel} in item ${index}:`, item);
                        return "";
                    }
                }),
            ];

            return filteredRow
                .map((field) => (field !== undefined && field !== null ? JSON.stringify(field) : ""))
                .join(",");
        });

    const csvContent = [header.join(","), ...rows].join("\n");
    return csvContent;
};

// Function to save all data as a ZIP file
const saveAllDataAsZip = async (canvasCount: number, selectedChannels: number[]): Promise<Blob> => {
    try {
        const db = await openIndexedDB();

        const allMetadata = await performIndexDBTransaction(
            db,
            "FileMetadata",
            "readonly",
            (store) => {
                return new Promise<FileMetadata[]>((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            }
        );

        if (!allMetadata || allMetadata.length === 0) {
            throw new Error("No data available to download.");
        }

        const zip = new JSZip();

        for (const metadata of allMetadata) {
            try {
                const content = await readFileData(db, metadata.filename);
                const csvData = convertToCSV(content, canvasCount, selectedChannels);
                zip.file(metadata.filename, csvData);
            } catch (error) {
                console.error(`Error processing record ${metadata.filename}:`, error);
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        return content;
    } catch (error) {
        console.error("Error creating ZIP file:", error);
        throw error;
    }
};

// Function to save data by filename
const saveDataByFilename = async (
    filename: string,
    canvasCount: number,
    selectedChannels: number[]
): Promise<Blob> => {
    try {
        const db = await openIndexedDB();

        // Check if file exists
        const metadata = await performIndexDBTransaction(
            db,
            "FileMetadata",
            "readonly",
            (store) => {
                return new Promise<FileMetadata | undefined>((resolve, reject) => {
                    const request = store.get(filename);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            }
        );

        if (!metadata) {
            throw new Error("No data found for the given filename.");
        }

        // Read all data for this file
        const content = await readFileData(db, filename);

        if (!Array.isArray(content)) {
            throw new Error("Invalid data format.");
        }

        try {
            const csvData = convertToCSV(content, canvasCount, selectedChannels);
            const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
            return blob;
        } catch (conversionError) {
            console.error("Error converting data to CSV:", conversionError);
            throw new Error("Failed to convert data to CSV format.");
        }
    } catch (error) {
        console.error("Error during file download:", error);
        throw new Error("Error occurred during file download.");
    }
};

// Function to get file count from IndexedDB
const getFileCountFromIndexedDB = async (db: IDBDatabase): Promise<string[]> => {
    return performIndexDBTransaction(db, "FileMetadata", "readonly", (store) => {
        return new Promise<string[]>((resolve, reject) => {
            const filenames: string[] = [];
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    filenames.push(cursor.value.filename);
                    cursor.continue();
                } else {
                    resolve(filenames);
                }
            };

            cursorRequest.onerror = (event) => {
                const error = (event.target as IDBRequest).error;
                console.error("Error retrieving filenames from IndexedDB:", error);
                reject(error);
            };
        });
    });
};

const deleteFilesByFilename = async (filename: string) => {
    const dbRequest = indexedDB.open("ChordsRecordings", 3);

    return new Promise<void>((resolve, reject) => {
        dbRequest.onsuccess = async (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            try {
                // Delete metadata
                await performIndexDBTransaction(db, "FileMetadata", "readwrite", (store) => {
                    return new Promise<void>((resolveMeta, rejectMeta) => {
                        const request = store.delete(filename);
                        request.onsuccess = () => resolveMeta();
                        request.onerror = () => rejectMeta(request.error);
                    });
                });

                // Delete all chunks for this file
                await performIndexDBTransaction(db, "DataChunks", "readwrite", (store) => {
                    return new Promise<void>((resolveChunks, rejectChunks) => {
                        const index = store.index("byFilename");
                        const cursorRequest = index.openCursor(IDBKeyRange.only(filename));

                        cursorRequest.onsuccess = (cursorEvent) => {
                            const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
                            if (cursor) {
                                cursor.delete();
                                cursor.continue();
                            } else {
                                resolveChunks();
                            }
                        };

                        cursorRequest.onerror = () => rejectChunks(new Error("Error deleting chunks."));
                    });
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        };

        dbRequest.onerror = () => reject(new Error("Failed to open IndexedDB database."));
    });
};

const deleteAllDataFromIndexedDB = async () => {
    const dbRequest = indexedDB.open("ChordsRecordings", 3);

    return new Promise<void>((resolve, reject) => {
        dbRequest.onsuccess = async (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            try {
                // Clear metadata
                await performIndexDBTransaction(db, "FileMetadata", "readwrite", (store) => {
                    return new Promise<void>((resolveMeta, rejectMeta) => {
                        const request = store.clear();
                        request.onsuccess = () => resolveMeta();
                        request.onerror = () => rejectMeta(request.error);
                    });
                });

                // Clear data chunks
                await performIndexDBTransaction(db, "DataChunks", "readwrite", (store) => {
                    return new Promise<void>((resolveChunks, rejectChunks) => {
                        const request = store.clear();
                        request.onsuccess = () => resolveChunks();
                        request.onerror = () => rejectChunks(request.error);
                    });
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        };

        dbRequest.onerror = () => reject(new Error("Failed to open IndexedDB."));
        dbRequest.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create stores if they don't exist
            if (!db.objectStoreNames.contains("FileMetadata")) {
                const metadataStore = db.createObjectStore("FileMetadata", { keyPath: "filename" });
                metadataStore.createIndex("filename", "filename", { unique: true });
            }

            if (!db.objectStoreNames.contains("DataChunks")) {
                const chunksStore = db.createObjectStore("DataChunks", {
                    keyPath: ["filename", "chunkIndex"]
                });
                chunksStore.createIndex("byFilename", "filename", { unique: false });
            }
        };
    });
};