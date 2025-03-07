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
import { BitSelection } from "./DataPass";
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
    const fftSize = currentSamplingRate + 6 * (currentSamplingRate / 250);
    // console.log(fftSize);
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


    useImperativeHandle(
      ref,
      () => ({
        updateData(data: number[]) {
          for (let i = 0; i < 1; i++) {

            const sensorValue = data[i + 1];
            fftBufferRef.current[i].push(sensorValue);
            updatePlot(sensorValue, Zoom);

            if (fftBufferRef.current[i].length >= fftSize) {
              const processedBuffer = fftBufferRef.current[i].slice(0, fftSize); // Ensure exact length
              const dcRemovedBuffer = removeDCComponent(processedBuffer);
              const filteredBuffer = applyHighPassFilter(dcRemovedBuffer, 0.5); // 0.5 Hz cutoff
              const windowedBuffer = applyHannWindow(filteredBuffer);
              const complexFFT = fft(windowedBuffer); // Perform FFT
              const magnitude = complexFFT.map(([real, imaginary]) =>
                Math.sqrt(real ** 2 + imaginary ** 2)
              ); // Calculate the magnitude
              // console.log("magnitude", complexFFT);
              const freqs = Array.from({ length: fftSize / 2 }, (_, i) => (i * currentSamplingRate) / fftSize);
              // console.log(freqs);
              setFftData((prevData) => {
                const newData = [...prevData];
                newData[i] = magnitude.slice(0, fftSize / 2); // Assign to the corresponding channel
                return newData;
              });

              fftBufferRef.current[i] = []; // Clear buffer after processing
            }
          }
        },
      }),
      [Zoom, timeBase, canvasCount]
    );
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

      // Create a single canvas element
      const canvas = document.createElement("canvas");
      canvas.id = `canvas${1}`;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.className = "w-full h-full block rounded-xl";

      const badge = document.createElement("div");
      badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";

      container.appendChild(badge);
      container.appendChild(canvas);

      try {
        const wglp = new WebglPlot(canvas);
        console.log("WebglPlot created:", wglp);
        wglp.gScaleY = Zoom;

        const line = new WebglLine(new ColorRGBA(1, 2, 2, 1), dataPointCountRef.current);
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

      let yMax = 1; // Default to prevent division by zero
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
      <div className="flex flex-col  gap-2 w-full h-full">
        <main
          className="flex flex-col flex-[1_1_0%] min-h-70 bg-highlight rounded-2xl m-4 relative"
          ref={canvasContainerRef}
        ></main>

        {/* Flex container for side-by-side layout */}
        <div className="w-full flex flex-row justify-between items-center max-w-full gap-20">
          {/* Canvas container (left side) */}
          <div ref={containerRef} className="flex-1">
            <canvas ref={canvasRef} className="w-full" />
          </div>

          {/* BandPowerGraph (right side) */}
          <div className="flex-1">
            <BandPowerGraph fftData={fftData} samplingRate={currentSamplingRate} />
          </div>
        </div>
      </div>

    );
  }
);

FFT.displayName = "FFT";
export default FFT;
