<p align="center">
   <h1 align="center">BioAmp Visualizer</h1><hr/>
</p>

The <i>BioAmp Visualizer</i> is a web application designed for real-time signal visualization, particularly tailored for <i>bio-potential signals</i>. This tool serves as an advanced alternative to the standard Arduino serial plotter, offering enhanced functionality for researchers and enthusiasts working with BioAmp hardware. The application provides a user-friendly interface for displaying <i>time-series data streams</i>, with features including <i>adjustable graph speed</i>, and the <i>ability to pause, resume, and record data to CSV format</i>. By combining these capabilities, the BioAmp Visualizer aims to streamline the process of analyzing and interpreting bio-potential signals.<hr/>

<p align= "center">
  <img src="https://github.com/user-attachments/assets/f07fad1f-e19e-424e-b2f2-817d9c84fecf"/><br/>
  <h4 align="center">Default UI of BioAmp Visualizer</h4>
  <br/>
  <img src="https://github.com/user-attachments/assets/cb8580d1-bdc2-4974-8d1f-41208139648f"/>
  <h4 align="center">Selecting COM port</h4>
  <br/>
  <img src="https://github.com/user-attachments/assets/049c0849-cbaa-4c09-a4bc-aebfe48ad16a"/>
  <h4 align="center">Data Plotting</h4>
  <br/>
  <img src="https://github.com/user-attachments/assets/c2c92800-a1c5-46e0-bdc8-e60a61ab8391"/>
  <h4 align="center">Data Recording</h4>
  <br/>
  <img src="https://github.com/user-attachments/assets/ac74eba9-fd83-43e5-9a6d-cf9f97a30d64"/>
  <h4 align="center">Saving Modal</h4>
  <br/>
  <img src="https://github.com/user-attachments/assets/0e328aae-d5fc-47a1-8fb1-6c472e5bdef5"/>
  <h4 align="center">Saving Progress</h4>
</p>

## Features

- **Signal Visualization:** Real-time display of Arduino four channel time series data using SmoothieCharts library.
- **Speed Adjustment:** Users can adjust speed of graph, speed can be toggled by provided speed button.
- **Data Management:** Signals data can be recorded and exported as CSV file.
- **Visualization Control:** Pause/Resume functionality for stream analysis.

## Prerequisites

- Chromium based web browser
- Access to an Arduino and Arduino IDE for flashing firmware.

## How to Use

1. Connect the Arduino to your computer using a USB cable.
2. Open the Arduino IDE and flash the provided firmware onto the Arduino.
3. Open the [BioAmp Visualizer](https://docs.upsidedownlabs.tech/BioSignal-Recorder-Web/) in a web browser.
4. Click the Connect button to establish a connection with the port on which Arduino is connected.
5. Click the Record button to start recording data into a CSV file.
6. To save the recorded data, click the Download button.

## Libraries Used

- [Bootstrap](https://getbootstrap.com/): CSS framework for styling the UI.
- [SmoothieCharts](http://smoothiecharts.org/): JavaScript library for real-time charting.
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): Browser-based database for storing recorded data.
