import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "next-themes";
import BandPowerGraph from "./BandPowerGraph";

interface FFTGraphProps {
  data: string;
  maxFreq?: number;
}

const FFTGraph: React.FC<FFTGraphProps> = ({ data, maxFreq = 100 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fftData, setFftData] = useState<number[][]>([[], [], [], []]);
  const fftSize = 128;
  const samplingRate = 250;
  const fftBufferRef = useRef<number[][]>([[], [], [], []]);
  const { theme } = useTheme();

  const channelColors = useMemo(() => ["red", "green", "blue", "purple"], []);

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

    const width = canvas.width - 20;
    const height = canvas.height;

    const leftMargin = 80;
    const bottomMargin = 50;

    ctx.clearRect(0, 0, canvas.width, height);

    const axisColor = theme === "dark" ? "white" : "black";

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(leftMargin, 10);
    ctx.lineTo(leftMargin, height - bottomMargin);
    ctx.lineTo(width - 10, height - bottomMargin);
    ctx.strokeStyle = axisColor;
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";

    // Y-axis labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const labelY =
        height - bottomMargin - (i / 5) * (height - bottomMargin - 10);
      ctx.fillText((i * 20).toString(), leftMargin - 5, labelY);
    }

    // X-axis labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let freq = 0; freq <= 100; freq += 20) {
      const labelX = leftMargin + (freq / 100) * (width - leftMargin - 10);
      ctx.fillText(freq.toString(), labelX, height - bottomMargin + 15);
    }

    ctx.font = "14px Arial";
    ctx.fillText("Frequency (Hz)", (width + leftMargin) / 2, height - 15);

    // Y-axis title
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Amplitude", -height / 2, 15);
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
    (input: string) => {
      const lines = String(input).split("\n");
      lines.forEach((line) => {
        if (line.trim() !== "") {
          const values = line.split(",").map(Number);
          if (values.length >= 5) {
            // Ensure we have at least 4 channels plus the counter
            for (let i = 0; i < 4; i++) {
              let sensorValue = values[i + 1];
              if (!isNaN(sensorValue)) {
                fftBufferRef.current[i].push(sensorValue);
                if (fftBufferRef.current[i].length >= fftSize) {
                  const windowedBuffer = applyHannWindow(
                    fftBufferRef.current[i]
                  );
                  let fftResult = fft(windowedBuffer);
                  const newFftData = fftResult
                    .slice(0, fftSize / 2)
                    .map((c) => Math.sqrt(c.re * c.re + c.im * c.im));
                  setFftData((prevData) => {
                    const newData = [...prevData];
                    newData[i] = newFftData;
                    return newData;
                  });
                  fftBufferRef.current[i] = [];
                }
              }
            }
          }
        }
      });
    },
    [fftSize, fft]
  );

  const plotData = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const width = canvas.width - 10;
    const height = canvas.height;

    const leftMargin = 70;
    const bottomMargin = 50;

    ctx.clearRect(0, 0, canvas.width, height);

    const freqStep = samplingRate / fftSize;
    const displayPoints = Math.min(Math.ceil(maxFreq / freqStep), fftSize / 2);

    const xScale = (width - leftMargin - 10) / displayPoints;
    const yMax = Math.max(
      ...fftData.flatMap((channel) => channel.slice(0, displayPoints))
    );
    const yScale = yMax > 0 ? (height - bottomMargin - 10) / yMax : 1;

    const axisColor = theme === "dark" ? "white" : "black";

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(leftMargin, 10);
    ctx.lineTo(leftMargin, height - bottomMargin);
    ctx.lineTo(width - 10, height - bottomMargin);
    ctx.strokeStyle = axisColor;
    ctx.stroke();

    // Plot the data for each channel
    fftData.forEach((channelData, index) => {
      ctx.beginPath();
      ctx.strokeStyle = channelColors[index];
      for (let i = 0; i < displayPoints; i++) {
        const x = leftMargin + i * xScale;
        const y = height - bottomMargin - (channelData[i] || 0) * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // Draw labels and axes
    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";

    // Y-axis labels
    const yLabelCount = 5;
    for (let i = 0; i <= yLabelCount; i++) {
      const value = (yMax * i) / yLabelCount;
      const labelY =
        height -
        bottomMargin -
        (i / yLabelCount) * (height - bottomMargin - 10);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(value.toFixed(1), leftMargin - 5, labelY);
    }

    // X-axis labels
    const numLabels = Math.min(maxFreq / 10, Math.floor(samplingRate / 2 / 10));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= numLabels; i++) {
      const freq = i * 10;
      const labelX = leftMargin + (freq / freqStep) * xScale;
      ctx.fillText(freq.toString(), labelX, height - bottomMargin + 15);
    }

    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", (width + leftMargin) / 2, height - 15);

    // Y-axis title
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Amplitude", -height / 2, 15);
    ctx.restore();
  }, [fftData, theme, maxFreq, samplingRate, fftSize, channelColors]);

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
      plotData();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [plotData]);

  return (
    <div className="flex flex-col gap-2 w-full h-full">
      <div
        ref={containerRef}
        className="w-full flex flex-col  h-[300px] max-w-[700px]"
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <BandPowerGraph fftData={fftData} samplingRate={samplingRate} />
    </div>
  );
};

export default FFTGraph;
