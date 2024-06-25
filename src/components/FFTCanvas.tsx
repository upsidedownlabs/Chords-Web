import React, { useEffect, useRef, useState } from "react";

interface FFTGraphProps {
  data: string[] | string;
}

const FFTGraph: React.FC<FFTGraphProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataArray, setDataArray] = useState<number[]>([]);
  const fftSize = 128;
  const samplingRate = 1000; // Adjust based on your actual sampling rate
  const fftBufferRef = useRef<number[]>([]);

  useEffect(() => {
    if (data) {
      processData(data);
    }
  }, [data]);

  useEffect(() => {
    if (dataArray.length > 0) {
      plotData();
    }
  }, [dataArray]);

  const fft = (signal: number[]): { re: number; im: number }[] => {
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
  };

  const processData = (input: string[] | string) => {
    let values: number[];

    if (Array.isArray(input)) {
      // If input is an array of strings
      values = input.map(Number);
    } else {
      // If input is a comma-separated string
      values = input.split(",").map(Number);
    }

    // Remove any NaN values (like '\r' at the end)
    values = values.filter((value) => !isNaN(value));

    if (values.length > 0) {
      // Use the last value in the array
      const sensorValue = values[values.length - 1];

      fftBufferRef.current.push(sensorValue);
      if (fftBufferRef.current.length > fftSize) {
        fftBufferRef.current.shift(); // Remove oldest value if buffer is full
      }

      if (fftBufferRef.current.length === fftSize) {
        const fftResult = fft(fftBufferRef.current);
        const newDataArray = fftResult
          .slice(0, fftSize / 2)
          .map((c) => Math.sqrt(c.re * c.re + c.im * c.im));
        setDataArray(newDataArray);
      }
    } else {
      console.warn("No valid values in input");
    }
  };

  const plotData = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Set up scales for x and y axes
    const xScale = (width - 30) / dataArray.length;
    const yMax = Math.max(...dataArray);
    const yScale = yMax > 0 ? (height - 40) / yMax : 1;

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(30, height - 30);
    ctx.lineTo(width, height - 30);
    ctx.stroke();

    // Plot the data
    ctx.beginPath();
    ctx.strokeStyle = "blue";
    dataArray.forEach((value, index) => {
      const x = 30 + index * xScale;
      const y = height - 30 - value * yScale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Add labels
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const labelY = height - 30 - (i / 5) * (height - 40);
      ctx.fillText(((yMax * i) / 5).toFixed(1), 0, labelY);
      ctx.beginPath();
      ctx.moveTo(25, labelY);
      ctx.lineTo(35, labelY);
      ctx.stroke();
    }

    // X-axis labels
    const freqStep = samplingRate / (2 * dataArray.length);
    for (
      let i = 0;
      i < dataArray.length;
      i += Math.floor(dataArray.length / 5)
    ) {
      const labelX = 30 + i * xScale;
      const freq = (i * freqStep).toFixed(0);
      ctx.fillText(freq, labelX, height - 10);
      ctx.beginPath();
      ctx.moveTo(labelX, height - 35);
      ctx.lineTo(labelX, height - 25);
      ctx.stroke();
    }

    // Add axis titles
    ctx.font = "14px Arial";
    ctx.fillText("Frequency (Hz)", width / 2, height - 5);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Magnitude", -height / 2, 15);
    ctx.restore();
  };

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={400} />
    </div>
  );
};

export default FFTGraph;
