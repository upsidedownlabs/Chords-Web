<p align="center">
  <img src="https://github.com/akadeepesh/biosignal-recorder-web-private/assets/100466756/95cad4a8-8fbb-4662-afb6-414be104f69d"><br>
   <h1 align="center">BioSignal Web Recorder</h1><hr>
</p>

BioSignal Web Recorder is an application based on Web Serial connection, you can connect boards like Arduino Uno, Arduino Nano after uploading the ArduinoFirmware.ino code to it, you'll recieve data signals from the board which can be visualized on web using BioSignal Web Recorder. Users can visualize ECG and EMG signals.

## Features

- **Connection**: Experience a smooth connection/disconnection with board in single click.
- **Real-time Visualization**: Visualize incoming data without any jitter from the board in real-time on SmoothieCharts.
- **Recording**: Record the signals data in csv files, multiple instances can be recorded and downloaded as zip of csv's.
- **Bi Directional Communication**: We can also write data in the board, the table below shows what we recieve if sent data is:
<div>


| Sent Data | Data Received | Value                 |
| :-------: | ------------- | --------------------- |
|    'c'    | Channel Count | 6                     |
|    'n'    | Board Name    | "Arduino"             |
|    's'    | Sampling Rate | {125, 250, 500, 1000} |
|    'r'    | Resolution    | 10                    |

</div>

## Compatible Browsers

| Feature | Chrome | Edge | Firefox | Opera | Safari | Chrome Android | Firefox for Android | Safari iOS | Samsung Internet | WebView Android |
| ------- | ------ | ---- | ------- | ----- | ------ | -------------- | ------------------- | ---------- | ---------------- | --------------- |
| ✅      | ✅     | ✅   | ❌      | ✅    | ❌     | ❌             | ❌                  | ❌         | ❌               | ❌              |

## How to use

1. Connect the Arduino to your computer using a USB cable.
2. Open the Arduino IDE and flash the provided firmware onto the Arduino.
3. Open the BioSignal-Recorder-Web in a web browser.
4. Click the "Connect" button to establish a connection with the Arduino and stream.
5. Click the "Record" button to record data. Record multiple data and download as zip, or single recording as csv.
6. To download the recorded data, click the "download" button.

## Technologies Used

- [Next js](https://nextjs.org/): A framework build on top of React.js.
- [TypeScript](https://www.typescriptlang.org/): Statically typed superset of JavaScript.
- [Tailwind CSS](https://tailwindcss.com/): Utility-first CSS framework.
- [Shadcn UI](https://tailwindcss.com/): Provides Reusable and customizable components, built with radix UI.
- [Lodash](https://lodash.com/): Utility library for data manipulation, used for data throttling.
- [JSZip](https://stuk.github.io/jszip/): Library for creating and manipulating ZIP files, used for save recordings as ZIP.
- [Smoothie Js](http://smoothiecharts.org/): Real time charting library.

## Resources

- [Vendors](https://github.com/akadeepesh/biosignal-recorder-web-private/blob/master/src/components/vendors.ts) list for board name and there vendor id are taken from [Stackblitz](https://stackblitz.com/edit/typescript-web-serial?file=vendors.ts) created by [William Grasel](https://github.com/willgm)
