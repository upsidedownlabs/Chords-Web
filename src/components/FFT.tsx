import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import { useTheme } from "next-themes";
import BandPowerGraph from "./BandPowerGraph";
import { fft } from "fft-js";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";

interface CanvasProps {
  canvasCount?: number;
  selectedChannels: number[];
  timeBase?: number;
  currentSamplingRate: number;
  Zoom: number;
}

const FFT = forwardRef(
  (
    {
      canvasCount = 6,
      timeBase = 4,
      currentSamplingRate,
      Zoom,

    }: CanvasProps,
    ref
  ) => {
    const fftBufferRef = useRef<number[][]>(Array.from({ length: 16 }, () => []));
    const [fftData, setFftData] = useState<number[][]>(Array.from({ length: 16 }, () => []));
    const fftSize = Math.pow(2, Math.round(Math.log2(currentSamplingRate / 2)));
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const maxFreq = 60; // Maximum frequency to display
    const channelColors = useMemo(() => ["red", "green", "blue", "purple", "orange", "yellow"], []);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const dataPointCountRef = useRef<number>(1000); // To track the calculated value
    const [canvasElements, setCanvasElements] = useState<HTMLCanvasElement[]>([]);
    const wglPlotsref = useRef<WebglPlot[]>([]);
    const linesRef = useRef<WebglLine[]>([]);
    const sweepPositions = useRef<number[]>(new Array(6).fill(0)); // Array for sweep positions
    let samplesReceived = 0;
    class SmoothingFilter {
      private bufferSize: number;
      private circularBuffers: number[][];
      private sums: number[];
      private dataIndex: number = 0;
    
      constructor(bufferSize: number = 5, initialLength: number = 0) {
        this.bufferSize = bufferSize;
        this.circularBuffers = Array.from({ length: initialLength }, () => 
          new Array(bufferSize).fill(0)
        );
        this.sums = new Array(initialLength).fill(0);
      }
    
      getSmoothedValues(newValues: number[]): number[] {
        // Initialize buffers if first run or size changed
        if (this.circularBuffers.length !== newValues.length) {
          this.circularBuffers = Array.from({ length: newValues.length }, () => 
            new Array(this.bufferSize).fill(0)
          );
          this.sums = new Array(newValues.length).fill(0);
        }
    
        const smoothed = new Array(newValues.length);
        
        for (let i = 0; i < newValues.length; i++) {
          this.sums[i] -= this.circularBuffers[i][this.dataIndex];
          this.sums[i] += newValues[i];
          this.circularBuffers[i][this.dataIndex] = newValues[i];
          smoothed[i] = this.sums[i] / this.bufferSize;
        }
    
        this.dataIndex = (this.dataIndex + 1) % this.bufferSize;
        return smoothed;
      }
    }
    const filter = new SmoothingFilter(32,fftSize/2); // 5-point moving average

    useImperativeHandle(
      ref,
      () => ({
        updateData(data: number[]) {
          for (let i = 0; i < 1; i++) {
            const sensorValue = data[i + 1];
            // Add new sample to the buffer
            fftBufferRef.current[i].push(sensorValue);
            // Update the plot with the new sensor value
            updatePlot(sensorValue, Zoom);
            // Ensure the buffer does not exceed fftSize
            if (fftBufferRef.current[i].length > fftSize) {
              fftBufferRef.current[i].shift(); // Remove the oldest sample
            }
            samplesReceived++;

            // Trigger FFT computation every 5 samples
            if (samplesReceived % 25 === 0 ) {
              const processedBuffer = fftBufferRef.current[i].slice(0, fftSize); // Ensure exact length
              const floatInput = new Float32Array(processedBuffer);

              // const dcRemovedBuffer = removeDCComponent(processedBuffer);
              // const filteredBuffer = applyHighPassFilter(dcRemovedBuffer, 0.5); // 0.5 Hz cutoff
              // const windowedBuffer = applyHannWindow(filteredBuffer);
              // const complexFFT = fft(windowedBuffer); // Perform FFT
              // const magnitude = complexFFT.map(([real, imaginary]) =>
              //   Math.sqrt(real ** 2 + imaginary ** 2)
              // ); 
              // Calculate frequencies for the FFT result
              const fftMags = fftProcessor.computeMagnitudes(floatInput);
              const magArray = Array.from(fftMags); // Convert Float32Array to regular array
              const smoothedMags = filter.getSmoothedValues(magArray);
              // Update the FFT data state
              setFftData((prevData) => {
                const newData = [...prevData];
                newData[i] = smoothedMags;
                return newData;
              });

              // Clear the buffer after processing (optional, depending on your use case)
              // fftBufferRef.current[i] = [];
            }
          }
        },
      }),
      [Zoom, timeBase, canvasCount, fftSize, currentSamplingRate]
    );
    
    ////
    class FFT {
      private size: number;
      private cosTable: Float32Array;
      private sinTable: Float32Array;

      constructor(size: number) {
        this.size = size;
        this.cosTable = new Float32Array(size / 2);
        this.sinTable = new Float32Array(size / 2);
        for (let i = 0; i < size / 2; i++) {
          this.cosTable[i] = Math.cos(-2 * Math.PI * i / size);
          this.sinTable[i] = Math.sin(-2 * Math.PI * i / size);
        }
      }

      computeMagnitudes(input: Float32Array): Float32Array {
        const real = new Float32Array(this.size);
        const imag = new Float32Array(this.size);
        for (let i = 0; i < input.length && i < this.size; i++) {
          real[i] = input[i];
        }
        this.fft(real, imag);
        const mags = new Float32Array(this.size / 2);
        for (let i = 0; i < this.size / 2; i++) {
          mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / (this.size / 2);
        }
        return mags;
      }

      private fft(real: Float32Array, imag: Float32Array): void {
        const n = this.size;
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
          if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
            [imag[i], imag[j]] = [imag[j], imag[i]];
          }
          let k = n / 2;
          while (k <= j) { j -= k; k /= 2; }
          j += k;
        }
        for (let l = 2; l <= n; l *= 2) {
          const le2 = l / 2;
          for (let k = 0; k < le2; k++) {
            const kth = k * (n / l);
            const c = this.cosTable[kth], s = this.sinTable[kth];
            for (let i = k; i < n; i += l) {
              const i2 = i + le2;
              const tr = c * real[i2] - s * imag[i2];
              const ti = c * imag[i2] + s * real[i2];
              real[i2] = real[i] - tr;
              imag[i2] = imag[i] - ti;
              real[i] += tr;
              imag[i] += ti;
            }
          }
        }
      }
    }


    const fftProcessor = new FFT(fftSize);

    ///
    const createCanvasElement = () => {

      const container = canvasContainerRef.current;
      if (!container) return;

      // Clear existing child elements
      while (container.firstChild) {
        const firstChild = container.firstChild;
        if (firstChild instanceof HTMLCanvasElement) {
          const gl = firstChild.getContext("webgl");
          if (gl) {
            const loseContext = gl.getExtension("WEBGL_lose_context");
            if (loseContext) {
              loseContext.loseContext();
            }
          }
        }
        container.removeChild(firstChild);
      }

      setCanvasElements([]);
      const newWglPlots: WebglPlot[] = [];

      linesRef.current = [];
      const canvasWrapper = document.createElement("div");
      canvasWrapper.className = "canvas-container relative flex-[1_1_0%]";
      // Create a single canvas element
      const canvas = document.createElement("canvas");
      canvas.id = `canvas${1}`;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.className = "w-full h-full block rounded-xl";

      const badge = document.createElement("div");
      badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";
      canvasWrapper.appendChild(canvas);

      canvasWrapper.appendChild(badge);
      container.appendChild(canvasWrapper);

      try {
        const wglp = new WebglPlot(canvas);
        console.log("WebglPlot created:", wglp);
        wglp.gScaleY = Zoom;
        const lineColor = theme === "dark" ? new ColorRGBA(1, 2, 2, 1) : new ColorRGBA(0, 0, 0, 1); // Adjust colors as needed

        const line = new WebglLine(lineColor, dataPointCountRef.current);
        line.offsetY = 0;
        line.lineSpaceX(-1, 2 / dataPointCountRef.current);
        wglp.addLine(line);
        newWglPlots.push(wglp);
        console.log(newWglPlots)
        linesRef.current = [line];
        wglPlotsref.current = [wglp];
        setCanvasElements([canvas]);
      } catch (error) {
        console.error("Error creating WebglPlot:", error);
      }
    };
    useEffect(() => {
      const handleResize = () => {
        createCanvasElement();

      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [createCanvasElement]);

    const updatePlot = useCallback((data: number, Zoom: number) => {
      // console.log("updatePlot called with data:", data);
      if (!wglPlotsref.current[0] || !linesRef.current[0]) {

        console.log(linesRef.current[0]);
        console.log(wglPlotsref.current[0]);
        // console.log("Skipping updatePlot due to missing WebGL elements.");
        return;
      }
      const line = linesRef.current[0];
      wglPlotsref.current[0].gScaleY = Zoom;

      const currentPos = (sweepPositions.current[0] || 0) % line.numPoints;
      line.setY(currentPos, data);

      // Clear next point
      const clearPosition = Math.ceil((currentPos + dataPointCountRef.current / 100) % line.numPoints);
      line.setY(clearPosition, NaN);

      sweepPositions.current[0] = (currentPos + 1) % line.numPoints;
    }, [linesRef, wglPlotsref.current[0], dataPointCountRef, sweepPositions]);

    useEffect(() => {
      createCanvasElement();
    }, [theme, timeBase]);

    const animate = useCallback(() => {

      // If not paused, continue with normal updates (e.g., real-time plotting)
      wglPlotsref.current[0].update();
      requestAnimationFrame(animate); // Continue the animation loop

    }, [wglPlotsref, Zoom]);

    useEffect(() => {
      requestAnimationFrame(animate);

    }, [animate]);

    const removeDCComponent = (buffer: number[]): number[] => {
      const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
      return buffer.map((val) => val - mean);
    };

    const applyHighPassFilter = (buffer: number[], cutoffFreq: number): number[] => {
      const rc = 1 / (2 * Math.PI * cutoffFreq);
      const dt = 1 / currentSamplingRate;
      const alpha = rc / (rc + dt);
      let filteredBuffer = new Array(buffer.length);
      filteredBuffer[0] = buffer[0];
      for (let i = 1; i < buffer.length; i++) {
        filteredBuffer[i] =
          alpha * (filteredBuffer[i - 1] + buffer[i] - buffer[i - 1]);
      }
      return filteredBuffer;
    };

    const applyHannWindow = (buffer: number[]): number[] => {
      return buffer.map(
        (value, index) =>
          value *
          (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (buffer.length - 1)))
      );
    };

    const plotData = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      const width = canvas.width - 20;
      const height = canvas.height;

      const leftMargin = 80;
      const bottomMargin = 50;

      ctx.clearRect(0, 0, canvas.width, height);

      const axisColor = theme === "dark" ? "white" : "black";

      ctx.beginPath();
      ctx.moveTo(leftMargin, 10);
      ctx.lineTo(leftMargin, height - bottomMargin);
      ctx.lineTo(width - 10, height - bottomMargin);
      ctx.strokeStyle = axisColor;
      ctx.stroke();

      const freqStep = currentSamplingRate / fftSize;
      const displayPoints = Math.min(Math.ceil(maxFreq / freqStep), fftSize / 2);

      const xScale = (width - leftMargin - 10) / displayPoints;

      let yMax = 0; // Default to prevent division by zero
      fftData.forEach((channelData) => {
        if (channelData.length > 0) {
          yMax = Math.max(yMax, ...channelData.slice(0, displayPoints));
        }
      });

      const yScale = (height - bottomMargin - 10) / yMax;

      fftData.forEach((channelData, index) => {
        ctx.beginPath();
        ctx.strokeStyle = channelColors[index];
        for (let i = 0; i < displayPoints; i++) {
          const x = leftMargin + i * xScale;
          const y = height - bottomMargin - channelData[i] * yScale;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      ctx.fillStyle = axisColor;
      ctx.font = "12px Arial";

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 5; i++) {
        const labelY =
          height - bottomMargin - (i / 5) * (height - bottomMargin - 10);
        ctx.fillText(((yMax * i) / 5).toFixed(1), leftMargin - 5, labelY);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const numLabels = Math.min(maxFreq / 10, Math.floor(currentSamplingRate / 2 / 10));
      for (let i = 0; i <= numLabels; i++) {
        const freq = i * 10;
        const labelX = leftMargin + (freq / freqStep) * xScale;
        ctx.fillText(freq.toString(), labelX, height - bottomMargin + 15);
      }

      ctx.font = "14px Arial";
      ctx.fillText("Frequency (Hz)", (width + leftMargin) / 2, height - 15);

      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Magnitude", -height / 2, 15);
      ctx.restore();
    }, [fftData, theme, maxFreq, currentSamplingRate, fftSize, channelColors]);
    useEffect(() => {
      // console.log('FFT Data:', fftData);  // Log fftData to check its values
      if (fftData.some((channel) => channel.length > 0)) {
        plotData();
      }
    }, [fftData, plotData]);


    useEffect(() => {
      const resizeObserver = new ResizeObserver(() => {
        plotData();
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => resizeObserver.disconnect();
    }, [plotData]);

    return (
      <div className="flex flex-col w-full h-screen overflow-hidden">
        {/* Plotting Data / Main content area */}
        <main
          ref={canvasContainerRef}
          className="flex-1 bg-highlight rounded-2xl m-2 overflow-hidden min-h-0"
        >
          {/* Main content goes here */}
        </main>

        {/* Responsive container for FFT (canvas) and BandPowerGraph */}
        <div className="flex-1 m-2 flex flex-col md:flex-row justify-center  overflow-hidden min-h-0 gap-12">

          {/* FFT Canvas container */}
          <div ref={containerRef} className="flex-1 overflow-hidden min-h-0 min-w-0 ml-12 ">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
          {/* BandPowerGraph container */}
          <div className="flex-1 overflow-hidden min-h-0 min-w-0 ml-4">
            <BandPowerGraph fftData={fftData} samplingRate={currentSamplingRate} />
          </div>
        </div>
      </div>
    );
  }
);

FFT.displayName = "FFT";
export default FFT;