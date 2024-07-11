// Initialize the Bootstrap modal for the progress bar
const modal = new bootstrap.Modal(document.getElementById("myModal"));

class SmoothieChartManager {
  constructor(chartsContainer) {
    this.chartsContainer = chartsContainer; // Container for the charts
    this.smoothieCharts = []; // Array to hold SmoothieChart instances
    this.timeSeries = []; // Array to hold TimeSeries instances
    this.isConnected = false; // Flag for connection status
    this.isStreaming = false; // Flag for streaming status
    this.isRecording = false; // Flag for recording status
    this.buffer = []; // Buffer to store incoming data
    this.fileBreak = false; // Flag for file break during recording
    this.currentPacket = 0; // Counter for the current data packet
    this.bufferCounter = 0; // Counter for buffer
  }

  // Initialize the chart manager
  init() {
    this.initEventListeners(); // Set up event listeners
    this.loadSettings(); // Load settings from localStorage
    this.saveSettings(); // Save settings to localStorage
  }

  // Set up event listeners for UI elements
  initEventListeners() {
    // Helper function to add input listeners
    const addInputListener = (rangeId, valueId) => {
      document.getElementById(rangeId).addEventListener("input", (e) => {
        document.getElementById(valueId).textContent = e.target.value; // Update the display value when the input changes
      });
    };

    addInputListener("speedRange", "speedValue");
    addInputListener("heightRange", "heightValue");
    addInputListener("channelsRange", "channelsValue");

    // Helper function to add button listeners
    const addButtonListener = (buttonId, action) => {
      document.getElementById(buttonId).addEventListener("click", action); // Call the action function when the button is clicked
    };

    addButtonListener("saveChanges", () => this.saveSettings());
    addButtonListener("connectButton", () => this.toggleConnection());
    addButtonListener("startButton", () => this.toggleStreaming());
    addButtonListener("recordButton", () => this.toggleRecording());
    addButtonListener("saveButton", async () => {
      this.stopStreaming();
      await this.saveCsv(); // Save data to CSV file
    });

    window.addEventListener("load", () => this.checkBrowserCompatibility()); // Check browser compatibility on load
  }

  // Load settings from localStorage and update UI
  loadSettings() {
    const settings = this.getSettings();
    // Update range inputs and their corresponding value displays
    ["speed", "height", "channels"].forEach((setting) => {
      document.getElementById(`${setting}Range`).value = settings[setting];
      document.getElementById(`${setting}Value`).textContent =
        settings[setting];
    });
  }

  // Retrieve settings from localStorage with default values
  getSettings() {
    return {
      height: parseInt(localStorage.getItem("heightValue")) || 1,
      channels: parseInt(localStorage.getItem("channelsValue")) || 1,
      speed: parseInt(localStorage.getItem("speedValue")) || 2,
    };
  }

  // Save current settings to localStorage and update charts
  saveSettings() {
    ["speed", "height", "channels"].forEach((setting) => {
      localStorage.setItem(
        `${setting}Value`,
        document.getElementById(`${setting}Range`).value
      );
    });

    this.destroyCharts(); // Remove existing charts
    const settings = this.getSettings();
    const height = 200 + (settings.height - 1) * 40; // Calculate chart height based on settings
    this.drawCharts(settings.channels, height, settings.speed); // Draw new charts

    if (this.isConnected) {
      this.updateChartLabels(); // Update chart labels if connected
    }
  }

  // Create and display the charts
  drawCharts(channels, height, speed) {
    for (let i = 0; i < channels; i++) {
      const canvasDiv = document.createElement("div");
      canvasDiv.classList.add("canvas-container");
      canvasDiv.innerHTML = `
        <div class="parent m-4 p-1 bg-black text-white rounded-2 position-relative" id="parent-${i}">
            <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-light text-dark fs-6">
            ${this.isConnected ? `CH${i + 1}` : "No device connected!"}
            </span>
            <canvas id="waveform${i}"></canvas>
        </div>
      `;
      this.chartsContainer.appendChild(canvasDiv); // Append the chart container to the main container
      document.getElementById(`parent-${i}`).style.height = `${height}px`; // Set the height of the chart container

      const canvas = document.getElementById(`waveform${i}`);
      canvas.height = document.getElementById(`parent-${i}`).offsetHeight - 10;
      canvas.width = document.getElementById(`parent-${i}`).offsetWidth - 10;

      const smoothieChart = new SmoothieChart({
        millisPerPixel: 2,
        grid: {
          strokeStyle: "rgba(0, 0, 0, 0.1)",
          lineWidth: 1,
          millisPerLine: 250,
          verticalSections: 6,
        },
        labels: {
          fillStyle: "white",
          fontWeight: "bold",
          showIntermediateLabels: true,
        },
        tooltipLine: { strokeStyle: "#ffffff" },
      });

      const timeSeries = new TimeSeries();
      smoothieChart.addTimeSeries(timeSeries, {
        strokeStyle: "rgb(255, 255, 255)",
        lineWidth: 1,
      });
      smoothieChart.streamTo(canvas, 30);

      this.smoothieCharts.push(smoothieChart); // Add the chart to the list of charts
      this.timeSeries.push(timeSeries); // Add the time series to the list of time series
    }

    this.updateSpeed(speed); // Set the speed of the charts
  }

  // Update the speed of the charts based on user settings
  updateSpeed(speed) {
    const speeds = {
      1: 8,
      2: 4,
      3: 2,
    };
    this.smoothieCharts.forEach((smoothie) => {
      smoothie.options.millisPerPixel = speeds[speed] || 4; // Default to 4 if speed is not 1, 2, or 3
    });
  }

  // Remove all charts from the UI
  destroyCharts() {
    this.smoothieCharts.forEach((smoothie) => smoothie.stop());
    while (this.chartsContainer.firstChild) {
      this.chartsContainer.removeChild(this.chartsContainer.firstChild);
    }
    this.timeSeries = [];
    this.smoothieCharts = [];
  }

  // Toggle connection to the device
  async toggleConnection() {
    if (this.isConnected) {
      this.disconnectDevice();
    } else {
      this.connectToDevice();
    }
  }

  // Connect to the device via the serial port
  async connectToDevice() {
    try {
      this.port = await navigator.serial.requestPort({});
      await this.port.open({ baudRate: 115200 });

      document.getElementById("connectButton").classList.add("connected");
      document.getElementById("startButton").disabled = false;

      this.isConnected = true;
      this.startStreaming();
      this.updateChartLabels();

      this.reader = this.port.readable.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      while (this.isConnected) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.reader.releaseLock();
          break;
        }
        const receivedData = decoder.decode(value, { stream: true });
        const lines = (lineBuffer + receivedData).split("\n");
        lineBuffer = lines.pop();

        for (const line of lines) {
          const dataValues = line.split(",");
          if (dataValues.length > 1) {
            this.processData(dataValues);
          } else {
            console.log(`Received Data: ${line}`);
          }
        }
      }
    } catch (error) {
      if (this.isRecording) {
        this.saveCsv();
      }
      this.disconnectDevice();
      alert(
        "Error connecting to device: Please remove the device and insert it again."
      );
      console.error("Error connecting to device:", error);
    }
  }

  // Disconnect from the device
  async disconnectDevice() {
    try {
      if (this.port && this.port.readable) {
        if (this.reader) {
          await this.reader.cancel();
          this.reader.releaseLock();
        }
        await this.port.close();
        this.port = undefined;
      }
    } catch (error) {
      console.error("Error disconnecting from device:", error);
    }
    this.isConnected = false;
    this.isStreaming = false;
    this.isRecording = false;
    this.updateUIForDisconnectedState();
  }

  // Update UI elements for the disconnected state
  updateUIForDisconnectedState() {
    document.getElementById("connectButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-usb-symbol" viewBox="0 0 16 16">
        <path d="m7.792.312-1.533 2.3A.25.25 0 0 0 6.467 3H7.5v7.319a2.5 2.5 0 0 0-.515-.298L5.909 9.56A1.5 1.5 0 0 1 5 8.18v-.266a1.5 1.5 0 1 0-1 0v.266a2.5 2.5 0 0 0 1.515 2.298l1.076.461a1.5 1.5 0 0 1 .888 1.129 2.001 2.001 0 1 0 1.021-.006v-.902a1.5 1.5 0 0 1 .756-1.303l1.484-.848A2.5 2.5 0 0 0 11.995 7h.755a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h.741a1.5 1.5 0 0 1-.747 1.142L8.76 8.99a3 3 0 0 0-.26.17V3h1.033a.25.25 0 0 0 .208-.389L8.208.312a.25.25 0 0 0-.416 0"/>
      </svg>
    `;
    document.getElementById("connectButton").classList.remove("connected");
    document.getElementById("startButton").disabled = true;
    document.getElementById("startButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right-fill" viewBox="0 0 16 16">
        <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"/>
      </svg>
    `;
    document.getElementById("recordButton").disabled = true;
    document.getElementById("recordButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-record" viewBox="0 0 16 16">
        <path d="M8 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
      </svg>
    `;
    this.updateChartLabels("No device connected!");
  }

  // Update the chart labels based on connection status
  updateChartLabels(status = null) {
    const channels = parseInt(localStorage.getItem("channelsValue")) || 1;
    for (let i = 0; i < channels; i++) {
      const badge = document.querySelector(`#parent-${i} .badge`);
      if (badge) {
        badge.textContent = status || `CH${i + 1}`;
      }
    }
  }

  // Toggle streaming of data
  toggleStreaming() {
    if (!this.isStreaming) {
      this.startStreaming();
    } else {
      this.stopStreaming();
    }
  }

  // Start streaming data
  startStreaming() {
    this.isStreaming = true;
    document.getElementById("startButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause" viewBox="0 0 16 16">
        <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5"/>
      </svg>
    `;
    document.getElementById("recordButton").disabled = false;
    this.smoothieCharts.forEach((chart) => chart.start()); // Start all charts
  }

  // Stop streaming data
  stopStreaming() {
    this.isStreaming = false;
    document.getElementById("startButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right-fill" viewBox="0 0 16 16">
        <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"/>
      </svg>
    `;
    document.getElementById("recordButton").disabled = true;
    this.smoothieCharts.forEach((chart) => chart.stop()); // Stop all charts
  }

  // Toggle recording of data
  toggleRecording() {
    if (!this.isRecording) {
      this.startRecording();
    } else {
      this.stopRecording();
    }
  }

  // Start recording data
  startRecording() {
    this.isRecording = true;
    document.getElementById("recordButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-stop-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
        <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h3A1.5 1.5 0 0 1 11 6.5v3A1.5 1.5 0 0 1 9.5 11h-3A1.5 1.5 0 0 1 5 9.5z"/>
      </svg>
    `;
    document.getElementById("startButton").disabled = true;
    document.getElementById("saveButton").disabled = true;
  }

  // Stop recording data
  stopRecording() {
    this.isRecording = false;
    document.getElementById("recordButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-record" viewBox="0 0 16 16">
        <path d="M8 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
      </svg>
    `;
    document.getElementById("startButton").disabled = false;
    document.getElementById("saveButton").disabled = false;
    this.fileBreak = true; // Indicate a break in the recording file
  }

  // Save the recorded data to a CSV file
  async saveCsv() {
    console.log("first");
    const fileHandle = await this.getNewFileHandle();
    const writableStream = await fileHandle.createWritable();
    const columnNames = [
      "Counter",
      "Channel 1",
      "Channel 2",
      "Channel 3",
      "Channel 4",
      "Channel 5",
      "Channel 6",
    ];
    const headerRow = columnNames.join(",") + "\n";
    await writableStream.write(headerRow);

    const db = await idb.openDB("adcReadings", 1);
    const readableStream = this.makeReadableStream(db, "adcReadings");
    await readableStream.pipeTo(writableStream);

    indexedDB.deleteDatabase("adcReadings");
    document.getElementById("saveButton").disabled = true;
  }

  async getNewFileHandle() {
    // Options for the file picker dialog
    const opts = {
      suggestedName: "readings.csv", // Default file name
      types: [
        {
          description: "Text Files", // Description shown in file type dropdown
          accept: {
            "text/csv": [".csv"], // Acceptable file type
          },
        },
      ],
    };
    // Show file picker dialog and return the selected file handle
    return await window.showSaveFilePicker(opts);
  }

  makeReadableStream(db, store) {
    // Show the modal to indicate the saving process has started
    modal.show();
    let prevKey; // Key of the last processed item in the database
    const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 250 }); // Strategy to control the size of the queue
    return new ReadableStream(
      {
        async pull(controller) {
          // Define a range for fetching data from IndexedDB
          const range =
            prevKey !== undefined
              ? IDBKeyRange.lowerBound(prevKey, true)
              : undefined;
          const MIN_BATCH_SIZE = 1000; // Minimum number of items to process in one batch
          let batchCount = 0; // Counter for the number of processed items

          // Open a cursor to iterate over the IndexedDB store
          let cursor = await db
            .transaction(store, "readonly")
            .objectStore(store)
            .openCursor(range);

          while (cursor) {
            // Read data from the cursor
            const data = cursor.value;
            // Create a CSV row from the data
            const csvRow = `${data.counter},${data.channel_1},${data.channel_2},${data.channel_3},${data.channel_4},${data.channel_5},${data.channel_6}\n`;
            // Enqueue the CSV row to the stream
            controller.enqueue(csvRow);
            prevKey = cursor.key; // Update the key for the next iteration
            batchCount += 1; // Increment the batch counter

            // Check if we should continue fetching more data
            if (controller.desiredSize > 0 || batchCount < MIN_BATCH_SIZE) {
              cursor = await cursor.continue();
            } else {
              break;
            }
          }

          // Update the progress bar
          this.currentPacket += 1;
          const width = ((this.currentPacket * 4) / this.bufferCounter) * 100;
          document.getElementById("dynamic").style.width = width + "%";

          // Check if all data has been processed
          if (!cursor) {
            console.log(`Completely done. Processed ${batchCount} objects`);
            document.getElementById("dynamic").style.width = "100%";
            document.getElementById("myModalLabel").innerHTML =
              "Saving Complete!";
            setTimeout(() => {
              modal.hide();
            }, 1000);
            controller.close(); // Close the stream
          }
        },
      },
      { queuingStrategy }
    );
  }

  processData(receivedData) {
    this.lineBuffer += receivedData; // Append new data to the buffer
    let lines = this.lineBuffer.split("\n"); // Split buffer into lines
    this.lineBuffer = ""; // Clear buffer

    for (let line of lines) {
      if (line.trim() !== "") {
        // Parse line into an array of numbers
        const dataArray = line.split(",");
        const parsedData = dataArray.map(Number);
        const sensorValues = parsedData.slice(1); // Extract sensor values
        this.buffer.push(parsedData); // Add parsed data to the buffer

        // If buffer exceeds 250 items, process the data
        if (this.buffer.length > 250) {
          const secondaryBuffer = [...this.buffer];
          if (this.isRecording) {
            this.dbstuff(secondaryBuffer); // Save data to IndexedDB
          }
          this.buffer = []; // Clear the buffer
          this.bufferCounter += 1; // Increment the buffer counter
        }
        if (this.isStreaming) {
          // If streaming, update the chart
          const channels = parseInt(localStorage.getItem("channelsValue")) || 6;
          for (let i = 0; i < channels; i++) {
            const data = sensorValues[i];
            if (!isNaN(data)) {
              const data = parsedData[i + 1];
              if (!isNaN(data)) {
                this.timeSeries[i].append(Date.now(), data); // Update chart data
              }
            }
          }
        }
      }
    }
  }

  async dbstuff(data) {
    const request = indexedDB.open("adcReadings", 1); // Open IndexedDB

    request.onupgradeneeded = (event) => {
      // Create object store if it doesn't exist
      const db = event.target.result;
      if (!db.objectStoreNames.contains("adcReadings")) {
        db.createObjectStore("adcReadings", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    // Wait for the database to be ready
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Start a transaction to save data
    const tx = db.transaction(["adcReadings"], "readwrite");
    tx.onerror = (event) =>
      console.error("Error starting transaction:", event.target.error);
    const store = tx.objectStore("adcReadings");

    // Add data to the object store
    for (let i = 0; i < data.length; i++) {
      store.add({
        counter: data[i][0],
        channel_1: data[i][1],
        channel_2: data[i][2],
        channel_3: data[i][3],
        channel_4: data[i][4],
        channel_5: data[i][5],
        channel_6: data[i][6],
      });
    }

    // If fileBreak flag is set, add a special marker to the store
    if (this.fileBreak) {
      store.add({
        counter: -1,
        channel_1: -1,
        channel_2: -1,
        channel_3: -1,
        channel_4: -1,
        channel_5: -1,
        channel_6: -1,
      });
      this.fileBreak = false;
    }

    // Wait for the transaction to complete
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  checkBrowserCompatibility() {
    // Check if the browser supports Web Serial API
    if (!navigator.serial) {
      // Show compatibility message if not supported
      document.getElementById("compatibilityMessage").style.display = "block";
      document.querySelector("nav").style.display = "none";
      document.getElementById("exampleModal").style.display = "none";
      return;
    }

    // Load and save settings if supported
    this.loadSettings();
    this.saveSettings();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize the SmoothieChartManager once the DOM is fully loaded
  const chartsContainer = document.getElementById("chartsContainer");
  const smoothieChartManager = new SmoothieChartManager(chartsContainer);
  smoothieChartManager.init();
});
