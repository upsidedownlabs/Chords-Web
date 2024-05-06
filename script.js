const smoothieCharts = [];
const deviceData = [];
let channels = parseInt(localStorage.getItem("channelsValue")) || 6;
let heights = [];
let isStreaming = false;
let isRecording = false;

const chartsContainer = document.getElementById("chartsContainer");
for (let i = 0; i < channels; i++) {
  const canvasDiv = document.createElement("div");
  canvasDiv.classList.add("canvas-container");
  const height = parseInt(localStorage.getItem(`heightValue-${i}`)) || 200;
  heights.push(height);
  canvasDiv.innerHTML = `
        <div class="mt-4 mb-4 bg-white text-white rounded position-relative">
            <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-light text-dark fs-6">CH${i + 1}</span>
            <canvas id="waveform${i}" width="1550" height="${height}" style="width: 100%;"></canvas>
        </div>`;
  chartsContainer.appendChild(canvasDiv);
}

var smoothie = [];
var timeSeries = [];
for (let i = 0; i < channels; i++) {
  smoothie[i] = new SmoothieChart({
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

  timeSeries[i] = new TimeSeries();
  smoothie[i].addTimeSeries(timeSeries[i], {
    strokeStyle: "rgb(255, 255, 255)",
    lineWidth: 1,
  });

  smoothieCharts.push(smoothie[i]);
  deviceData.push(timeSeries[i]);

  smoothie[i].streamTo(document.getElementById(`waveform${i}`));
}

document.getElementById("channelsRange").addEventListener("input", function () {
  channels = parseInt(this.value);
  const channelsValueSpan = document.getElementById("channelsValue");
  channelsValueSpan.textContent =
    this.value < 10 ? "0" + this.value : this.value;
  localStorage.setItem("channelsValue", channels);
  redrawCanvas();
});

function redrawCanvas() {
  // Clear charts container
  while (chartsContainer.firstChild) {
    chartsContainer.removeChild(chartsContainer.firstChild);
  }

  // Recreate canvas elements
  heights = [];
  for (let i = 0; i < channels; i++) {
    const canvasDiv = document.createElement("div");
    canvasDiv.classList.add("canvas-container");
    const height = parseInt(localStorage.getItem(`heightValue-${i}`)) || 200; // Retrieve height for each channel from local storage
    heights.push(height); // Store the height value
    canvasDiv.innerHTML = `
            <div class="mt-4 mb-4 bg-black text-white rounded position-relative">
                <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-light text-dark fs-6">CH${i + 1}</span>
                <canvas id="waveform${i}" width="1550" height="${height}" style="width: 100%;"></canvas>
            </div>
        `;
    chartsContainer.appendChild(canvasDiv);

    // Stream data to the new canvas
    smoothieCharts[i].streamTo(document.getElementById(`waveform${i}`));

    // Set canvas height to fixed value
    const canvas = canvasDiv.querySelector("canvas");
    canvas.height = height;

    // Redraw the chart to reflect the new canvas height
    smoothieCharts[i].resize();
  }
}

// Event listener for the height range input to adjust canvas height
document.getElementById("heightRange").addEventListener("input", function () {
  const initialHeight = 200;
  const increment = 40;
  const value = parseInt(this.value);

  const height = initialHeight + (value - 1) * increment;

  document.getElementById("heightValue").textContent = height;

  updateCanvasHeight(height);
});

// Update canvas height
async function updateCanvasHeight(height) {
  const canvasDivs = document.querySelectorAll(".canvas-container");

  canvasDivs.forEach((canvasDiv, index) => {
    // Set the height for all canvas containers
    canvasDiv.style.height = `${height}px`;
    const canvas = canvasDiv.querySelector("canvas");
    canvas.height = height;

    // Redraw the chart to reflect the new canvas height
    smoothieCharts[index].resize();

    // Store the updated height value in local storage for each channel
    localStorage.setItem(`heightValue-${index + 1}`, height);
  });

  // Additionally, update the height of the first canvas separately
  const firstCanvas = document.getElementById("waveform0");
  firstCanvas.height = height;
  smoothieCharts[0].resize();
  localStorage.setItem("heightValue-0", height);
}


let port;
let lineBuffer = "";
let isConnected = false;

// Function to start streaming
function startStreaming() {
  isStreaming = true;
}

// Function to stop streaming
function stopStreaming() {
  isStreaming = false;
}

let initialConnectionAttempt = false;

async function connectToDevice() {
  try {
    if (port && port.readable) {
      await port.close();
      console.log("Closed existing port.");
    }

    // Show loading indicator
    document.getElementById("connectButton").textContent = "Connecting...";
    document.getElementById("connectButton").disabled = true;

    port = await navigator.serial.requestPort({});
    await port.open({ baudRate: 115200 });

    // Set the color of the connect button to green
    document.getElementById("connectButton").classList.add("connected");

    const appendStream = new WritableStream({
      write(chunk) {
        lineBuffer += chunk;
        if (isStreaming) {
          processData();
        }
      },
    });
    port.readable.pipeThrough(new TextDecoderStream()).pipeTo(appendStream);

    console.log("Connected to device successfully.");

    // Update the initial connection attempt flag
    initialConnectionAttempt = true;
  } catch (error) {
    console.error("Error connecting to device:", error);

    // Show alert only if it's not the initial connection attempt
    if (initialConnectionAttempt && isConnected) {
      alert(
        "Error connecting to device: Please remove the device and insert it again."
      );
    }

    document.getElementById("connectButton").classList.add("failed");
  } finally {
    // Hide loading indicator and enable the button
    document.getElementById("connectButton").textContent = "Start";
    document.getElementById("connectButton").disabled = false;
  }
}

async function disconnectFromDevice() {
  try {
    if (port && port.readable) {
      // Check if the port is open before attempting to close it
      if (port.readable.locked) {
        console.warn("Port is already locked to a reader.");
        return;
      }
      const reader = port.readable.getReader();
      await reader.cancel(); // Cancel any ongoing read operation
      await port.close();
      document.getElementById("connectButton").classList.remove("connected");
      port = null;
      console.log("Disconnected from device successfully.");
    } else {
      console.warn("No port to disconnect.");
    }
  } catch (error) {
    console.error("Error disconnecting from device:", error);
  }
}

// Event listener for the "connect" button
connectButton.addEventListener("click", async () => {
  if (!isConnected) {
    await connectToDevice();
    isConnected = true;
    if (isConnected) {
      connectButton.textContent = "Disconnect"; // Change text to "Stop" when connected
      startButton.disabled = false;
    }
  } else {
    await disconnectFromDevice();
    isConnected = false;
    startButton.disabled = true;
    isRecording = false;
    isStreaming = false;
  }
});

document.getElementById("startButton").addEventListener("click", () => {
  if (!isStreaming) {
    startStreaming();
    document.getElementById("startButton").textContent = "Stop";
    document.getElementById("recordButton").disabled = false;
  } else {
    stopStreaming();
    document.getElementById("startButton").textContent = "Start";
    document.getElementById("recordButton").disabled = true;
    isRecording = false;
  }
});
document.getElementById("recordButton").addEventListener("click", () => {
  isRecording = !isRecording;
  document.getElementById("recordButton").textContent = isRecording
    ? "Pause"
    : "Record";
  document.getElementById("saveButton").disabled = isRecording;
});

document.getElementById("saveButton").addEventListener("click", async () => {
  await save_csv();
});

// Download CSV file return db;
async function save_csv() {
  const fileHandle = await getNewFileHandle();
  const writableStream = await fileHandle.createWritable();

  const db = await idb.openDB("adcReadings", 1);
  const readableStream = makeReadableStream(db, "adcReadings");
  await readableStream.pipeTo(writableStream);

  indexedDB.deleteDatabase("adcReadings");
  saveButton.disabled = true;
}

var buffer = [];
async function dbstuff(data) {
  const request = indexedDB.open("adcReadings", 1);

  // Handle the database creation or upgrade event
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    // Create an object store if it doesn't exist
    if (!db.objectStoreNames.contains("adcReadings")) {
      db.createObjectStore("adcReadings", {
        keyPath: "id",
        autoIncrement: true,
      });
    }
  };
  // Wait for the database to open
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Start a transaction to access the object store
  const tx = db.transaction(["adcReadings"], "readwrite");
  tx.onerror = (event) => {
    console.error("Error starting transaction:", event.target.error);
  };
  const store = tx.objectStore("adcReadings");

  // Add ADC data to the object store
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
  // Wait for the transaction to complete
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
var current_packet = 0;
const makeReadableStream = (db, store) => {
  $("#myModal").modal("show");

  let prevKey;
  return new ReadableStream(
    {
      async pull(controller) {
        const range =
          prevKey !== undefined
            ? IDBKeyRange.lowerBound(prevKey, true)
            : undefined;

        const MIN_BATCH_SIZE = 150;
        let batchCount = 0;

        let cursor = await db
          .transaction(store, "readonly")
          .objectStore(store)
          .openCursor(range);

        while (cursor) {
          const data = cursor.value;
          const csvRow = `${data.time},${data.channel_1},${data.channel_2},${data.channel_3},${data.channel_4},${data.channel_5},${data.channel_6}\n`;
          controller.enqueue(csvRow);
          prevKey = cursor.key;
          batchCount += 1;

          if (controller.desiredSize > 0 || batchCount < MIN_BATCH_SIZE) {
            cursor = await cursor.continue();
          } else {
            break;
          }
        }
        current_packet = current_packet + 1;
        var width = (current_packet / buffer_counter) * 100;
        console.log(width);
        $("#dynamic").css("width", width + "%");
        if (width == 100) {
          $("#myModalLabel").text("Saving Complete!");
          setTimeout(() => {
            $("#myModal").modal("hide");
          }, 1000);
        }

        if (!cursor) {
          // No more data
          console.log(`Completely done. Processed ${batchCount} objects`);
          controller.close();
        }
      },
    },
    {
      highWaterMark: 250,
    }
  );
};

const getNewFileHandle = async () => {
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
};
// Process incoming data from external device
var buffer_counter = 0;
function processData() {
  let lines = lineBuffer.split("\r\n");
  lineBuffer = lines.pop();

  for (let line of lines) {
    // array of integers
    let lineData = line;
    let dataArray = lineData.split(",");
    let parsedData = dataArray.map((str) => parseInt(str));

    // Append the parsed data to recordedData array if recording is enabled
    if (isRecording) {
      buffer.push(parsedData);

      if (buffer.length > 150) {
        var secondaryBuffer = buffer;
        dbstuff(secondaryBuffer);
        buffer = [];
        buffer_counter = buffer_counter + 1;
      }
    }

    // Append the parsed data to the chart
    for (let i = 2; i < parsedData.length && i < channels + 2; i++) {
      const data = parsedData[i];
      if (!isNaN(data)) {
        deviceData[i - 2].append(new Date().getTime(), data);
      }
    }
  }
}

// Define speed levels
const speedLevels = {
  1: "Slow",
  2: "Medium",
  3: "Fast",
};

// Event listener for the speed range input to adjust speed
document.getElementById("speedRange").addEventListener("input", function () {
  const speed = parseInt(this.value);
  const speedValueSpan = document.getElementById("speedValue");

  // Update the displayed speed value in the modal
  speedValueSpan.textContent = speedLevels[speed];

  updateSmoothieChartSpeed(speed);
});

function updateSmoothieChartSpeed(speed) {
  // Log the received speed level to confirm
  console.log("Received speed level:", speed);

  // Adjust the refresh rate of the SmoothieChart based on the speed level
  switch (speed) {
    case 1:
      // Set to slow refresh rate
      smoothieCharts.forEach((smoothie) => {
        smoothie.options.millisPerPixel = 10;
      });
      break;
    case 2:
      // Set to medium refresh rate
      smoothieCharts.forEach((smoothie) => {
        smoothie.options.millisPerPixel = 5;
      });
      break;
    case 3:
      // Set to fast refresh rate
      smoothieCharts.forEach((smoothie) => {
        smoothie.options.millisPerPixel = 2;
      });
      break;
    default:
      break;
  }

  // Log the updated options for verification
  smoothieCharts.forEach((smoothie, index) => {
    console.log(`SmoothieChart ${index + 1} options:`, smoothie.options);
  });
}

// Event listener for the save changes button
document.getElementById("saveChanges").addEventListener("click", function () {
  localStorage.setItem(
    "speedValue",
    document.getElementById("speedRange").value
  );
  localStorage.setItem(
    "heightValue",
    document.getElementById("heightRange").value
  );
});

// Event listeners for range inputs to update corresponding UI elements
document.getElementById("speedRange").addEventListener("input", function () {
  document.getElementById("speedValue").textContent = this.value;
});
document.getElementById("heightRange").addEventListener("input", function () {
  document.getElementById("heightValue").textContent = this.value;
});

// Retrieve values from local storage for settings
document.getElementById("speedRange").value =
  localStorage.getItem("speedValue") || 0;
document.getElementById("heightRange").value =
  localStorage.getItem("heightValue") || 0;

document.getElementById("speedValue").textContent =
  document.getElementById("speedRange").value;
document.getElementById("heightValue").textContent =
  document.getElementById("heightRange").value;

document.getElementById("channelsValue").textContent =
  channels < 10 ? "0" + channels : channels;
document.getElementById("channelsRange").value = channels;
