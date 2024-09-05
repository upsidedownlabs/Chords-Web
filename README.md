<p align="center">
  <img src="https://github.com/Ritika8081/BioSignal-Recorder-Web/blob/main/public/steps/Chords.png"><br>
   <h1 align="center">Chords</h1><hr>
</p>

Chords is an application based on Web Serial connection, you can connect boards like Arduino Uno, Arduino Nano after uploading the ArduinoFirmware.ino code to it, you'll recieve data signals from the board which can be visualized on web using Chords. Users can visualize ECG and EMG signals.

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

1.  Connect the Arduino to your computer using a USB cable.
2.  Open the Arduino IDE and flash the provided firmware onto the Arduino.
3.  Open Chords in a web browser.
4.  Click the "Connect" button to establish a connection with the Arduino and stream.
5.  Click the "Grid/List" button to chnage the view.
6.  Click the "Play/Pause" button to stop and start data on screen.
7.  Click "Autoscale" button to zoomin data visualization.
8.  Click the "Record" button to record data.
9.  To download the recorded data, click the "download" button.
10. Click the "Delete" button to delete recorded data.

## Technologies Used

- [Next js](https://nextjs.org/): A framework build on top of React.js.
- [TypeScript](https://www.typescriptlang.org/): Statically typed superset of JavaScript.
- [Tailwind CSS](https://tailwindcss.com/): Utility-first CSS framework.
- [Shadcn UI](https://tailwindcss.com/): Provides Reusable and customizable components, built with radix UI.
- [Lodash](https://lodash.com/): Utility library for data manipulation, used for data throttling.
- [Smoothie Js](http://smoothiecharts.org/): Real time charting library.
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) Browser-based database for storing recorded data.

## Resources

- [Vendors](https://github.com/akadeepesh/biosignal-recorder-web-private/blob/master/src/components/vendors.ts) list for board name and there vendor id are taken from [Stackblitz](https://stackblitz.com/edit/typescript-web-serial?file=vendors.ts) created by [William Grasel](https://github.com/willgm)

## Contributors

We are thankful to our awesome contributors, the list below is alphabetically sorted.

- [Aman Maheswari](https://github.com/Amanmahe)
- [Deepak Khatri](https://github.com/lorforlinux)
- [Deepesh Kumar](https://github.com/akadeepesh)
- [Mahesh Tupe](https://github.com/Asc91)
- [Ritika Mishra](https://github.com/ritika8081)
