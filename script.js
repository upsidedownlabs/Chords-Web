const smoothieCharts = [];
const deviceData = [];
let channels = parseInt(localStorage.getItem('channelsValue')) || 6;
let heights = []; // Array to store heights for each channel

const chartsContainer = document.getElementById('chartsContainer');
for (let i = 1; i <= channels; i++) {
    const canvasDiv = document.createElement('div');
    canvasDiv.classList.add('canvas-container');
    const height = parseInt(localStorage.getItem(`heightValue-${i}`)) || 200;
    heights.push(height);
    canvasDiv.innerHTML = `
        <div class="mt-4 mb-4 bg-black text-white rounded position-relative">
            <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-light text-dark fs-6">CH${i}</span>
            <canvas id="waveform${i}" width="1550" height="${height}" style="width: 100%;"></canvas>
        </div>`;
    chartsContainer.appendChild(canvasDiv);
}

for (let i = 1; i <= channels; i++) {
    const smoothie = new SmoothieChart({
        millisPerPixel: 5,
        grid: { strokeStyle: 'rgba(0, 0, 0, 0.1)', lineWidth: 1, millisPerLine: 250, verticalSections: 6 },
        labels: { fillStyle: 'white', fontWeight: 'bold', showIntermediateLabels: true },
        tooltipLine: { strokeStyle: '#ffffff' }
    });

    const timeSeries = new TimeSeries();
    smoothie.addTimeSeries(timeSeries, { strokeStyle: 'rgb(255, 255, 255)', lineWidth: 1 });

    smoothieCharts.push(smoothie);
    deviceData.push(timeSeries);

    smoothie.streamTo(document.getElementById(`waveform${i}`));
}

document.getElementById('channelsRange').addEventListener('input', function () {
    channels = parseInt(this.value);
    const channelsValueSpan = document.getElementById('channelsValue');
    channelsValueSpan.textContent = this.value < 10 ? '0' + this.value : this.value;
    localStorage.setItem('channelsValue', channels);
    redrawCanvas();
});

function redrawCanvas() {
    // Clear charts container
    while (chartsContainer.firstChild) {
        chartsContainer.removeChild(chartsContainer.firstChild);
    }

    // Recreate canvas elements
    heights = [];
    for (let i = 1; i <= channels; i++) {
        const canvasDiv = document.createElement('div');
        canvasDiv.classList.add('canvas-container');
        const height = parseInt(localStorage.getItem(`heightValue-${i}`)) || 200; // Retrieve height for each channel from local storage
        heights.push(height); // Store the height value
        canvasDiv.innerHTML = `
            <div class="mt-4 mb-4 bg-black text-white rounded position-relative">
                <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-light text-dark fs-6">CH${i}</span>
                <canvas id="waveform${i}" width="1550" height="${height}" style="width: 100%;"></canvas>
            </div>
        `;
        chartsContainer.appendChild(canvasDiv);

        // Stream data to the new canvas
        smoothieCharts[i - 1].streamTo(document.getElementById(`waveform${i}`));

        // Set canvas height to fixed value
        const canvas = canvasDiv.querySelector('canvas');
        canvas.height = height;

        // Redraw the chart to reflect the new canvas height
        smoothieCharts[i - 1].resize();
    }
}

// Event listener for the height range input to adjust canvas height
document.getElementById('heightRange').addEventListener('input', function () {
    const initialHeight = 200;
    const increment = 40;
    const value = parseInt(this.value);

    const height = initialHeight + (value - 1) * increment;

    document.getElementById('heightValue').textContent = height;

    updateCanvasHeight(height);
});

// Update canvas height
async function updateCanvasHeight(height) {
    const canvasDivs = document.querySelectorAll('.canvas-container');

    canvasDivs.forEach((canvasDiv, index) => {
        canvasDiv.style.height = `${height}px`;
        const canvas = canvasDiv.querySelector('canvas');
        canvas.height = height;

        // Redraw the chart to reflect the new canvas height
        smoothieCharts[index].resize();

        // Store the updated height value in local storage for each channel
        localStorage.setItem(`heightValue-${index + 1}`, height);
    });
}

let port;
let lineBuffer = '';

// connect to the external device
async function connectToDevice() {
    try {
        // Check if there's an existing port and close it if there is
        if (port && port.readable) {
            await port.close();
            console.log('Closed existing port.');
        }

        port = await navigator.serial.requestPort({});
        await port.open({ baudRate: 9600 });

        // Set the color of the connect button to green
        document.getElementById('connectButton').classList.add('connected');

        //appending incoming data to the line buffer
        const appendStream = new WritableStream({
            write(chunk) {
                lineBuffer += chunk;
                processData();
            }
        });
        port.readable.pipeThrough(new TextDecoderStream()).pipeTo(appendStream);
    } catch (error) {
        console.error('Error connecting to device:', error.message);
        // Add error handling logic here
        alert('Failed to connect to the device. Disconnect your device and try to re-connect');
    }
}

document.getElementById('connectButton').addEventListener('click', async function () {
    await connectToDevice();
});

// process incoming data from external device
function processData() {
    let lines = lineBuffer.split('\r\n');
    lineBuffer = lines.pop();

    for (let line of lines) {
        console.log("Received line:", line);
        // array of integers
        let lineData = line;
        let dataArray = lineData.split(',');
        let parsedData = dataArray.map(str => parseInt(str));
        console.log(parsedData);

        // Append the parsed data
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
    1: 'Slow',
    2: 'Medium',
    3: 'Fast'
};

// Event listener for the speed range input to adjust speed
document.getElementById('speedRange').addEventListener('input', function () {
    const speed = parseInt(this.value);
    const speedValueSpan = document.getElementById('speedValue');

    // Update the displayed speed value in the modal
    speedValueSpan.textContent = speedLevels[speed];


    updateSmoothieChartSpeed(speed);
});

// Function to update SmoothieChart speed based on the selected level
function updateSmoothieChartSpeed(speed) {
    // Adjust the refresh rate of the SmoothieChart based on the speed level
    switch (speed) {
        case 1:
            // Set to slow refresh rate
            smoothieCharts.forEach(smoothie => {
                smoothie.options.millisPerPixel = 10;
            });
            break;
        case 2:
            // Set to medium refresh rate
            smoothieCharts.forEach(smoothie => {
                smoothie.options.millisPerPixel = 5;
            });
            break;
        case 3:
            // Set to fast refresh rate
            smoothieCharts.forEach(smoothie => {
                smoothie.options.millisPerPixel = 2;
            });
            break;
        default:
            break;
    }
}

// Event listener for the save changes button
document.getElementById('saveChanges').addEventListener('click', function () {
    localStorage.setItem('speedValue', document.getElementById('speedRange').value);
    localStorage.setItem('heightValue', document.getElementById('heightRange').value);
});

// Event listeners for range inputs to update corresponding UI elements
document.getElementById('speedRange').addEventListener('input', function () {
    document.getElementById('speedValue').textContent = this.value;
});
document.getElementById('heightRange').addEventListener('input', function () {
    document.getElementById('heightValue').textContent = this.value;
});

// Retrieve values from local storage for settings
document.getElementById('speedRange').value = localStorage.getItem('speedValue') || 0;
document.getElementById('heightRange').value = localStorage.getItem('heightValue') || 0;

document.getElementById('speedValue').textContent = document.getElementById('speedRange').value;
document.getElementById('heightValue').textContent = document.getElementById('heightRange').value;

document.getElementById('channelsValue').textContent = channels < 10 ? '0' + channels : channels;
document.getElementById('channelsRange').value = channels;
