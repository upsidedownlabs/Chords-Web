import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface FFTGraphProps {
  data: string[] | string;
}

const FFTGraph: React.FC<FFTGraphProps> = ({ data }) => {
  const [fftData, setFftData] = useState<number[]>([]);
  const fftSize = 128;
  const samplingRate = 250;
  const fftBufferRef = useRef<number[]>([]);

  useEffect(() => {
    let animationFrameId: number;

    const processAndPlot = () => {
      if (data) {
        processData(data);
      }
      animationFrameId = requestAnimationFrame(processAndPlot);
    };

    processAndPlot();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [data]);

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

  const processData = (input: string[] | string | number[]) => {
    let values: number[];

    if (Array.isArray(input)) {
      values = input.map(Number);
    } else {
      return;
    }

    if (values && values.length >= 2) {
      let sensorValue = values[1];
      if (!isNaN(sensorValue)) {
        fftBufferRef.current.push(sensorValue);
        if (fftBufferRef.current.length >= fftSize) {
          let fftResult = fft(fftBufferRef.current);
          const newFftData = fftResult
            .slice(0, fftSize / 2)
            .map((c) => Math.sqrt(c.re * c.re + c.im * c.im));
          setFftData(newFftData);
          fftBufferRef.current = [];
        }
      }
    }
  };

  const chartData = {
    labels: Array.from(
      { length: fftSize / 2 },
      (_, i) => ((i * samplingRate) / fftSize).toFixed(0) // Correct frequency labels calculation
    ),
    datasets: [
      {
        label: "FFT Magnitude",
        data: fftData,
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Real-time FFT Graph",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Magnitude",
        },
      },
      x: {
        title: {
          display: true,
          text: "Frequency (Hz)",
        },
        // min: 0,
        // max: samplingRate / 2,
        // ticks: {
        //   stepSize: 10,
        //   callback: function (value) {
        //     const numValue = Number(value);
        //     return numValue % 10 === 0 ? numValue.toString() : "";
        //   },
        // },
      },
    },
  };

  return (
    <div style={{ width: "800px", height: "400px" }}>
      <Line key={fftData.join(",")} data={chartData} options={chartOptions} />
    </div>
  );
};

export default FFTGraph;
