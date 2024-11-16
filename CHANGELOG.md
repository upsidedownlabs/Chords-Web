# Changelog

All notable changes to this project will be documented in this file.

---

## [v2.1.0a]


### User Interface Improvements
- **#2ca3526**: Adjusted canvas size and button positioning.
- **#e93debb**: Enhanced the steps page layout.
- **#cf71501**: Improved the landing page user interface for a smoother experience.
- **#af3d170**: Updated the footer and buttons on the landing page for consistency.
- **#06012df**: Refined the tagline text for better clarity.
- **#66c923e**: Added channel count functionality and updated overall UI design.

### Feature Enhancements
- **#365b96b**: Introduced a new technology stack to improve performance and scalability.
- **#31e3ea5**: Disabled the zoom button when the application is in a paused state.
- **#032d43f**: Updated the FAQ section with the latest information.
- **#3606c32**: Enhanced IndexedDB logic for improved data handling.

### Data Plotting Improvements
- **#3baabdf**: Integrated a webgl plotting library for better chart rendering.
- **#27e95b3**: Optimized code to ensure charts update correctly based on channel count.

---

## [v2.0.0a] 

### Project Structure Setup
- **#2cf4517**: Set up the initial file structure for the project using next.js.

### Changed name of the project
- **#2cf4517**: Changed the name of the project from "Bio-Signal Visualizer" to "chords 2.0.0".

### Initial Release
- **#2cf4517**: Set up the file structure for the project.
- **#f6216a8**: Added detailed comments for better code readability.
- **#62de04c**: Enhanced data-saving logic for added channels and updated the README.
- **#3acc0f6**: Set FPS limit for better performance.
- **#3c7dccc**: Fixed chart initialization with autoscale and improved theme change functionality.
- **#76ae584**: Optimized data handling for smoother data plotting.
- **#29cd05b**: Added a button to display canvases based on the channel count.
- **#fd185ae**: Updated the code to sync with new Arduino configurations.
- **#e4b2a9c**: Implemented mobile detection for better responsiveness.

## [v1.0.0] 

---

**Note**: After this version, the project has switched to version 2.0.0 which uses next.js and webgl for plotting the data.

---

### Initial Release
- **#3856a06**: Project initialized with the base structure using smoothie chart.
- **#cc1b69f**: Implemented browser type detection functionality to ensure compatibility.
- **#768f9b4**: Added a browser compatibility check and displayed appropriate messages if unsupported.
- **#f23460f**: Replaced text-based buttons with icons and ensured data signals stop when displayed on-screen.
- **#a2213c6**: Added "Record" and "Save" buttons to enable data recording and storage.
- **#7b56261**: Clear the screen and show a "Browser Not Supported" message if the user's browser lacks required features.
