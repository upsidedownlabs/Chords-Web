// webWorker.ts
export const webWorker = {
    onmessage: function(e: any) {
      const { data, Zoom, wglPlots, linesRef, currentSweepPos, sweepPositions, numX } = e.data;
  
      const updatedPlots = wglPlots.map((wglp: any, index: any) => {
        if (wglp) {
          try {
            wglp.gScaleY = Zoom; // Adjust the zoom value
          } catch (error) {
            console.error(
              `Error setting gScaleY for WebglPlot instance at index ${index}:`,
              error
            );
          }
        } else {
          console.warn(`WebglPlot instance at index ${index} is undefined.`);
        }
        return wglp;
      });
  
      const updatedLines = linesRef.map((line: any, i: any) => {
        const updatedLine = { ...line };
        currentSweepPos[i] = sweepPositions[i];
        updatedLine.setY(currentSweepPos[i] % updatedLine.numPoints, data[i + 1]);
  
        const clearPosition = (currentSweepPos[i] + (numX / 100)) % updatedLine.numPoints;
        updatedLine.setY(clearPosition, NaN);
  
        sweepPositions[i] = (currentSweepPos[i] + 1) % updatedLine.numPoints;
  
        return updatedLine;
      });
  
      self.postMessage({ updatedPlots, updatedLines });
    }
  };
  