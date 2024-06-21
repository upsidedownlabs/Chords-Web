const modal = new bootstrap.Modal(document.getElementById("myModal")); // Modal for Progress bar while saving data

class SmoothieChartManager {
  constructor(chartsContainer) {
    this.chartsContainer = chartsContainer;
    this.smoothieCharts = [];
    this.timeSeries = [];
    this.isConnected = false;
    this.isStreaming = false;
    this.isRecording = false;
    this.buffer = [];
    this.fileBreak = false;
    this.currentPacket = 0;
  }

  init() {
    this.initEventListeners();
    this.loadSettings();
    this.saveSettings();
  }

  initEventListeners() {
    const addInputListener = (rangeId, valueId) => {
      document.getElementById(rangeId).addEventListener("input", (e) => {
        document.getElementById(valueId).textContent = e.target.value;
      });
    };

    addInputListener("speedRange", "speedValue");
    addInputListener("heightRange", "heightValue");
    addInputListener("channelsRange", "channelsValue");

    const addButtonListener = (buttonId, action) => {
      document.getElementById(buttonId).addEventListener("click", action);
    };

    addButtonListener("saveChanges", () => this.saveSettings());
    addButtonListener("connectButton", () => this.toggleConnection());
    addButtonListener("startButton", () => this.toggleStreaming());
    addButtonListener("recordButton", () => this.toggleRecording());
    addButtonListener("saveButton", async () => {
      this.stopStreaming();
      await this.saveCsv();
    });
    addButtonListener("sendButton", () => this.sendData());

    window.addEventListener("load", () => this.checkBrowserCompatibility());
  }

  loadSettings() {
    const settings = this.getSettings();
    document.getElementById("speedRange").value = settings.speed;
    document.getElementById("heightRange").value = settings.height;
    document.getElementById("channelsRange").value = settings.channels;

    document.getElementById("speedValue").textContent = settings.speed;
    document.getElementById("heightValue").textContent = settings.height;
    document.getElementById("channelsValue").textContent = settings.channels;
  }

  getSettings() {
    const height = parseInt(localStorage.getItem("heightValue")) || 1;
    const channels = parseInt(localStorage.getItem("channelsValue")) || 1;
    const speed = parseInt(localStorage.getItem("speedValue")) || 2;

    return { height, channels, speed };
  }

  saveSettings() {
    localStorage.setItem(
      "speedValue",
      document.getElementById("speedRange").value
    );
    localStorage.setItem(
      "heightValue",
      document.getElementById("heightRange").value
    );
    localStorage.setItem(
      "channelsValue",
      document.getElementById("channelsRange").value
    );

    this.destroyCharts();
    const settings = this.getSettings();
    const height = 200 + (settings.height - 1) * 40;
    this.drawCharts(settings.channels, height, settings.speed);

    if (this.isConnected) {
      this.updateChartLabels();
    }
  }

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
      this.chartsContainer.appendChild(canvasDiv);
      document.getElementById(`parent-${i}`).style.height = `${height}px`;

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

      this.smoothieCharts.push(smoothieChart);
      this.timeSeries.push(timeSeries);
    }

    this.updateSpeed(speed);
  }

  updateSpeed(speed) {
    switch (speed) {
      case 1:
        this.smoothieCharts.forEach((smoothie) => {
          smoothie.options.millisPerPixel = 8;
        });
        break;
      case 2:
        this.smoothieCharts.forEach((smoothie) => {
          smoothie.options.millisPerPixel = 4;
        });
        break;
      case 3:
        this.smoothieCharts.forEach((smoothie) => {
          smoothie.options.millisPerPixel = 2;
        });
        break;
      default:
        break;
    }
  }

  destroyCharts() {
    this.smoothieCharts.forEach((smoothie) => smoothie.stop());
    while (this.chartsContainer.firstChild) {
      this.chartsContainer.removeChild(this.chartsContainer.firstChild);
    }
    this.timeSeries = [];
    this.smoothieCharts = [];
  }

  async toggleConnection() {
    if (this.isConnected) {
      this.disconnectDevice();
    } else {
      this.connectToDevice();
    }
  }

  async sendData() {
    if (this.isConnected) {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(
        this.port.writable
      );

      const writer = textEncoder.writable.getWriter();

      await writer.write("n\n");
      writer.close();
      console.log("Data sent");
    } else {
      alert("No device connected!");
    }
  }

  async connectToDevice() {
    try {
      this.port = await navigator.serial.requestPort({});
      await this.port.open({ baudRate: 115200 });

      document.getElementById("connectButton").classList.add("connected");
      document.getElementById("startButton").disabled = false;

      this.isConnected = true;
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
      alert(
        "Error connecting to device: Please remove the device and insert it again."
      );
      console.error("Error connecting to device:", error);
      this.disconnectDevice();
    }
  }

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
    document.getElementById("connectButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-usb-symbol" viewBox="0 0 16 16">
      <path d="m7.792.312-1.533 2.3A.25.25 0 0 0 6.467 3H7.5v7.319a2.5 2.5 0 0 0-.515-.298L5.909 9.56A1.5 1.5 0 0 1 5 8.18v-.266a1.5 1.5 0 1 0-1 0v.266a2.5 2.5 0 0 0 1.515 2.298l1.076.461a1.5 1.5 0 0 1 .888 1.129 2.001 2.001 0 1 0 1.021-.006v-.902a1.5 1.5 0 0 1 .756-1.303l1.484-.848A2.5 2.5 0 0 0 11.995 7h.755a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h.741a1.5 1.5 0 0 1-.747 1.142L8.76 8.99a3 3 0 0 0-.26.17V3h1.033a.25.25 0 0 0 .208-.389L8.208.312a.25.25 0 0 0-.416 0"/>
    </svg>
    `;
    document.getElementById("connectButton").classList.remove("connected");
    document.getElementById("startButton").disabled = true;
    document.getElementById("recordButton").disabled = true;
    document.getElementById("recordButton").innerHTML = `<svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="red"
                  class="bi bi-record"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
                </svg>`;
    this.updateChartLabels("No device connected!");
  }

  updateChartLabels(status = null) {
    const channels = parseInt(localStorage.getItem("channelsValue")) || 1;
    for (let i = 0; i < channels; i++) {
      const badge = document.querySelector(`#parent-${i} .badge`);
      if (badge) {
        badge.textContent = status || `CH${i + 1}`;
      }
    }
  }

  toggleStreaming() {
    if (!this.isStreaming) {
      this.startStreaming();
    } else {
      this.stopStreaming();
    }
  }

  startStreaming() {
    this.isStreaming = true;
    document.getElementById("startButton").innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause" viewBox="0 0 16 16">
  <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5"/>
</svg>
`;
    document.getElementById("recordButton").disabled = false;
    for (var i = 0; i < smoothieCharts.length; i++) {
      smoothieCharts[i].start();
    }
  }

  stopStreaming() {
    this.isStreaming = false;
    document.getElementById("startButton").innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right-fill" viewBox="0 0 16 16">
  <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"/>
</svg>
`;
    document.getElementById("recordButton").disabled = true;

    for (var i = 0; i < smoothieCharts.length; i++) {
      smoothieCharts[i].stop();
    }
  }

  toggleRecording() {
    if (!this.isRecording) {
      this.isRecording = true;
      document.getElementById("recordButton").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-stop-circle" viewBox="0 0 16 16">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
    <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h3A1.5 1.5 0 0 1 11 6.5v3A1.5 1.5 0 0 1 9.5 11h-3A1.5 1.5 0 0 1 5 9.5z"/>
  </svg>
    `;
      document.getElementById("startButton").disabled = true;
      document.getElementById("saveButton").disabled = true;
    } else {
      this.isRecording = false;
      document.getElementById("recordButton").innerHTML = `<svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="red"
                  class="bi bi-record"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
                </svg>`;
      document.getElementById("startButton").disabled = false;
      document.getElementById("saveButton").disabled = false;
      this.fileBreak = true;
    }
  }

  async saveCsv() {
    const fileHandle = await this.getNewFileHandle();
    const writableStream = await fileHandle.createWritable();
    const columnNames = [
      "Counter",
      "Time",
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
    const opts = {
      suggestedName: "readings.csv",
      types: [
        {
          description: "Text Files",
          accept: {
            "text/csv": [".csv"],
          },
        },
      ],
    };
    return await window.showSaveFilePicker(opts);
  }

  makeReadableStream(db, store) {
    modal.show();
    let prevKey;
    const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 250 });
    return new ReadableStream(
      {
        async pull(controller) {
          const range =
            prevKey !== undefined
              ? IDBKeyRange.lowerBound(prevKey, true)
              : undefined;
          const MIN_BATCH_SIZE = 1000;
          let batchCount = 0;

          let cursor = await db
            .transaction(store, "readonly")
            .objectStore(store)
            .openCursor(range);

          while (cursor) {
            const data = cursor.value;
            const csvRow = `${data.counter},${data.time},${data.channel_1},${data.channel_2},${data.channel_3},${data.channel_4},${data.channel_5},${data.channel_6}\n`;
            controller.enqueue(csvRow);
            prevKey = cursor.key;
            batchCount += 1;

            if (controller.desiredSize > 0 || batchCount < MIN_BATCH_SIZE) {
              cursor = await cursor.continue();
            } else {
              break;
            }
          }

          this.currentPacket += 1;
          const width = ((this.currentPacket * 4) / this.bufferCounter) * 100;
          document.getElementById("dynamic").style.width = width + "%";

          if (!cursor) {
            console.log(`Completely done. Processed ${batchCount} objects`);
            document.getElementById("dynamic").style.width = "100%";
            document.getElementById("myModalLabel").innerHTML =
              "Saving Complete!";
            setTimeout(() => {
              modal.hide();
            }, 1000);
            controller.close();
          }
        },
      },
      { queuingStrategy }
    );
  }

  processData(receivedData) {
    this.lineBuffer += receivedData;
    let lines = this.lineBuffer.split("\n");
    this.lineBuffer = "";

    for (let line of lines) {
      if (line.trim() !== "") {
        const dataArray = line.split(",");
        const parsedData = dataArray.map(Number);
        const sensorValues = parsedData.slice(1);
        this.buffer.push(parsedData);

        if (this.buffer.length > 250) {
          const secondaryBuffer = [...this.buffer];
          if (this.isRecording) {
            this.dbstuff(secondaryBuffer);
          }
          this.buffer = [];
          this.bufferCounter += 1;
        }
        if (this.isStreaming) {
          const channels = parseInt(localStorage.getItem("channelsValue")) || 6;
          for (let i = 0; i < channels; i++) {
            const data = sensorValues[i];
            if (!isNaN(data)) {
              const data = parsedData[i + 1];
              if (!isNaN(data)) {
                this.timeSeries[i].append(Date.now(), data);
              }
            }
          }
        }
      }
    }
  }

  async dbstuff(data) {
    const request = indexedDB.open("adcReadings", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("adcReadings")) {
        db.createObjectStore("adcReadings", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction(["adcReadings"], "readwrite");
    tx.onerror = (event) =>
      console.error("Error starting transaction:", event.target.error);
    const store = tx.objectStore("adcReadings");

    for (let i = 0; i < data.length; i++) {
      store.add({
        counter: data[i][0],
        time: data[i][1],
        channel_1: data[i][2],
        channel_2: data[i][3],
        channel_3: data[i][4],
        channel_4: data[i][5],
        channel_5: data[i][6],
        channel_6: data[i][7],
      });
    }

    if (this.fileBreak) {
      store.add({
        counter: -1,
        time: -1,
        channel_1: -1,
        channel_2: -1,
        channel_3: -1,
        channel_4: -1,
        channel_5: -1,
        channel_6: -1,
      });
      this.fileBreak = false;
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  checkBrowserCompatibility() {
    if (!navigator.serial) {
      document.getElementById("compatibilityMessage").style.display = "block";
      document.querySelector("nav").style.display = "none";
      return;
    }

    this.loadSettings();
    this.saveSettings();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const chartsContainer = document.getElementById("chartsContainer");
  const smoothieChartManager = new SmoothieChartManager(chartsContainer);
  smoothieChartManager.init();
});
