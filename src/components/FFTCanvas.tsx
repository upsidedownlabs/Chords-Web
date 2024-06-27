import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";

interface FFTGraphProps {
  data: string[] | string | number[];
  maxFreq?: number;
}
const FFTGraph: React.FC<FFTGraphProps> = ({ data, maxFreq = 100 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fftData, setFftData] = useState<number[]>([]);
  const fftSize = 128;
  const samplingRate = 250;
  const fftBufferRef = useRef<number[]>([]);
  const { theme } = useTheme();

  const fft = useCallback((signal: number[]): { re: number; im: number }[] => {
    const n = signal.length;
    if (n <= 1) return signal.map((x) => ({ re: x, im: 0 }));

    const half = Math.floor(n / 2);
    const even = fft(signal.filter((_, i) => i % 2 === 0));
    const odd = fft(signal.filter((_, i) => i % 2 === 1));

    const a = new Array(n);
    for (let k = 0; k < half; k++) {
      const kth = (-2 * Math.PI * k) / n;
      const wk = { re: Math.cos(kth), im: Math.sin(kth) };
      const oddK = odd[k];
      const t = {
        re: wk.re * oddK.re - wk.im * oddK.im,
        im: wk.re * oddK.im + wk.im * oddK.re,
      };
      a[k] = {
        re: even[k].re + t.re,
        im: even[k].im + t.im,
      };
      a[k + half] = {
        re: even[k].re - t.re,
        im: even[k].im - t.im,
      };
    }
    return a;
  }, []);

  const drawPlaceholderGraph = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const axisColor = theme === "dark" ? "white" : "black";

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, height - 50);
    ctx.lineTo(width - 20, height - 50);
    ctx.strokeStyle = axisColor;
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const labelY = height - 50 - (i / 5) * (height - 60);
      ctx.fillText((i * 20).toString(), 5, labelY);
    }

    // X-axis labels
    for (let freq = 0; freq <= 100; freq += 20) {
      const labelX = 50 + (freq / 100) * (width - 70);
      ctx.fillText(freq.toString(), labelX, height - 30);
    }

    ctx.font = "14px Arial";
    ctx.fillText("Frequency (Hz)", width / 2, height - 10);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.restore();
  }, [theme]);

  const applyHannWindow = (buffer: number[]): number[] => {
    return buffer.map(
      (value, index) =>
        value *
        (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (buffer.length - 1)))
    );
  };

  const processData = useCallback(
    (input: string[] | string | number[]) => {
      let values: number[];

      if (typeof input === "string") {
        values = input.trim().split(",").map(Number);
      } else if (Array.isArray(input)) {
        values = input.map(Number);
      } else {
        return;
      }

      if (values && values.length >= 2) {
        let sensorValue = values[1];
        if (!isNaN(sensorValue)) {
          fftBufferRef.current.push(sensorValue);
          if (fftBufferRef.current.length >= fftSize) {
            const windowedBuffer = applyHannWindow(fftBufferRef.current);
            let fftResult = fft(windowedBuffer);
            const newFftData = fftResult
              .slice(0, fftSize / 2)
              .map((c) => Math.sqrt(c.re * c.re + c.im * c.im));
            setFftData(newFftData);
            fftBufferRef.current = [];
          }
        }
      }
    },
    [fftSize, fft, setFftData, fftBufferRef]
  );

  const plotData = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Calculate the number of data points to display based on maxFreq
    const freqStep = samplingRate / (2 * fftData.length);
    const displayPoints = Math.min(
      Math.ceil(maxFreq / freqStep),
      fftData.length
    );

    const xScale = (width - 90) / displayPoints;
    const yMax = Math.max(...fftData.slice(0, displayPoints));
    const yScale = yMax > 0 ? (height - 60) / yMax : 1;

    // Set colors based on theme
    const axisColor = theme === "dark" ? "white" : "black";
    const graphColor = "green";

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, height - 50);
    ctx.lineTo(width - 20, height - 50);
    ctx.strokeStyle = axisColor;
    ctx.stroke();

    // Plot the data
    ctx.beginPath();
    ctx.strokeStyle = graphColor;
    for (let i = 0; i < displayPoints; i++) {
      const x = 50 + i * xScale;
      const y = height - 50 - fftData[i] * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const labelY = height - 50 - (i / 5) * (height - 60);
      ctx.fillText(((yMax * i) / 5).toFixed(1), 5, labelY);
      ctx.beginPath();
      ctx.moveTo(45, labelY);
      ctx.lineTo(55, labelY);
      ctx.stroke();
    }

    // X-axis labels
    const numLabels = Math.min(maxFreq / 10, Math.floor(samplingRate / 2 / 10));
    for (let i = 0; i <= numLabels; i++) {
      const freq = i * 10;
      const labelX = 50 + (freq / freqStep) * xScale;
      ctx.fillText(freq.toString(), labelX, height - 30);
      ctx.beginPath();
      ctx.moveTo(labelX, height - 55);
      ctx.lineTo(labelX, height - 45);
      ctx.stroke();
    }

    ctx.font = "14px Arial";
    ctx.fillText("Frequency (Hz)", width / 2, height - 10);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.restore();
  }, [fftData, theme, maxFreq, samplingRate]);

  useEffect(() => {
    drawPlaceholderGraph();
  }, [drawPlaceholderGraph]);

  useEffect(() => {
    if (data) {
      processData(data);
    }
  }, [data, plotData, processData]);

  useEffect(() => {
    if (fftData.length > 0) {
      plotData();
    }
  }, [fftData, theme, plotData]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fftData.length > 0) {
        plotData();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [fftData.length, plotData]);

  return (
    <div ref={containerRef} className="w-full  h-[400px] max-w-[700px]">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default FFTGraph;
