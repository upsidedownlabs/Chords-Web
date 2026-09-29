'use client';
import { captureLines, restoreLines, type FrozenLines } from "./frozenPlot";
import React, {
    useEffect,
    useRef,
    useState,
    useImperativeHandle,
    forwardRef,
    useMemo,
    useCallback,
} from "react";
import { Expand, Shrink } from "lucide-react";
import { useTheme } from "next-themes";
import BandPowerGraph from "./BandPowerGraph";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";
import BrightCandleView from "./CandleLit";

interface CanvasProps {
    pauseRef: React.RefObject<boolean>;
    snapShotRef: React.MutableRefObject<boolean[]>;
    currentSnapshot: number;
    selectedChannel: number;
    canvasCount?: number;
    selectedChannels: number[];
    timeBase?: number;
    currentSamplingRate: number;
    Zoom: number;
}

const FFT = forwardRef(
    (
        {
            pauseRef,
            snapShotRef,
            currentSnapshot,
            selectedChannel,
            canvasCount = 6,
            timeBase = 4,
            currentSamplingRate,
            Zoom,
        }: CanvasProps,
        ref
    ) => {
        const fftBufferRef = useRef<number[][]>(Array.from({ length: 16 }, () => []));
        const [fftData, setFftData] = useState<number[][]>(
            Array.from({ length: 16 }, () => [])
        );
        const fftSize = 256;
        const sampleupdateref = useRef<number>(50);
        sampleupdateref.current = currentSamplingRate / 10;
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        // Use resolvedTheme, not theme: see the comment in Canvas.tsx.
        const { resolvedTheme: theme } = useTheme();
        const maxFreq = 60;
        const [betaPower, setBetaPower] = useState<number>(0);
        const betaPowerRef = useRef<number>(0);
        const channelColors = useMemo(
            () => ["red", "green", "blue", "purple", "orange", "yellow"],
            []
        );
        const canvasContainerRef = useRef<HTMLDivElement>(null);
        const dataPointCountRef = useRef<number>(2000);
        const wglPlotsref = useRef<WebglPlot[]>([]);
        const linesRef = useRef<WebglLine[]>([]);
        const sweepPositions = useRef<number[]>(new Array(6).fill(0));

        // Buffers used to remember the last few windows of data so that
        // pausing can step back through recently seen snapshots.
        const NUM_SNAPSHOT_BUFFERS = 6;
        const rawBufferRef = useRef<number[][]>(
            Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => [])
        );
        const fftSnapshotBufferRef = useRef<number[][]>(
            Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => [])
        );
        const activeBufferIndexRef = useRef<number>(0);
        const dataIndicesRef = useRef<number[]>([]);

        // Extend views to include 'fullcandle'
        const [activeBandPowerView, setActiveBandPowerView] = useState<
            'bandpower' | 'brightcandle' | 'fullcandle'
        >('bandpower');

        const buttonStyles = (view: string) => `
        px-2 py-1 text-sm font-medium transition-all duration-300 rounded-lg
        ${activeBandPowerView === view
                ? 'bg-primary text-primary-foreground border rounded-lg '
                : 'border rounded-lg bg-gray-600 text-primary-foreground'
            }
      `;

        const samplesReceivedRef = useRef<number>(0);
        class SmoothingFilter {
            private bufferSize: number;
            private circularBuffers: number[][];
            private sums: number[];
            private dataIndex: number = 0;


            constructor(bufferSize: number = 5, initialLength: number = 0) {
                this.bufferSize = Math.max(1, Math.floor(bufferSize)); // Prevent negative or NaN
                this.circularBuffers = Array.from({ length: initialLength }, () =>
                    Array(this.bufferSize).fill(0)
                );
                this.sums = new Array(initialLength).fill(0);
            }


            getSmoothedValues(newValues: number[]): number[] {
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

        useEffect(() => {
            if (fftData.length > 0 && fftData[0].length > 0) {
                const channelData = fftData[0];
                const beta = calculateBandPower(channelData, [13, 32]);
                const total = calculateBandPower(channelData, [0.5, 100]);
                const normalizedBeta = (beta / total) * 100;
                setBetaPower(normalizedBeta);
                betaPowerRef.current = normalizedBeta;
            }
        }, [fftData]);

        const calculateBandPower = useCallback(
            (magnitudes: number[], range: [number, number]) => {
                const [startFreq, endFreq] = range;
                const freqStep = currentSamplingRate / fftSize;
                const startIndex = Math.max(1, Math.floor(startFreq / freqStep));
                const endIndex = Math.min(
                    Math.floor(endFreq / freqStep),
                    magnitudes.length - 1
                );
                let power = 0;
                for (let i = startIndex; i <= endIndex; i++) {
                    power += magnitudes[i] * magnitudes[i];
                }
                return power;
            },
            [currentSamplingRate, fftSize]
        );

        const renderBandPowerView = () => {
            switch (activeBandPowerView) {
                case 'bandpower':
                    return (
                        <BandPowerGraph
                            fftData={fftData}
                            onBetaUpdate={(beta) => {
                                betaPowerRef.current = beta;
                                setBetaPower(beta);
                            }}
                            samplingRate={currentSamplingRate}
                        />
                    );
                case 'brightcandle':
                    return (
                        <BrightCandleView
                            betaPower={betaPower}
                            fftData={fftData}
                            isFullPage={false} // Pass false to avoid full page view
                        />
                    );
                case 'fullcandle':
                    return (
                        <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black z-50 flex flex-col items-center justify-center p-4">
                            <button onClick={() => setActiveBandPowerView('brightcandle')} className="absolute top-4 right-4 p-2 bg-transparent text-white hover:text-gray-300 transition-all duration-300">
                                <Shrink />
                            </button>
                            <div className="w-full max-w-4xl h-full flex justify-center">
                                <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl"> {/* Constrain max width */}
                                    <BrightCandleView betaPower={betaPower} fftData={fftData} isFullPage={true} />
                                </div>
                            </div>
                        </div>
                    );
                default:
                    return (
                        <BandPowerGraph
                            fftData={fftData}
                            onBetaUpdate={(beta) => {
                                betaPowerRef.current = beta;
                                setBetaPower(beta);
                            }}
                            samplingRate={currentSamplingRate}
                        />
                    );
            }
        };
        const rawBufferSize = (currentSamplingRate / sampleupdateref.current) * 2;
        const safeBufferSize = Math.max(1, Math.floor(rawBufferSize) || 1);
        const filter = new SmoothingFilter(safeBufferSize, 1);

        // Reset the pause/snapshot buffers whenever the analyzed channel changes,
        // since previously buffered data no longer corresponds to the new channel.
        useEffect(() => {
            rawBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => []);
            fftSnapshotBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => []);
            activeBufferIndexRef.current = 0;
            dataIndicesRef.current = [];
            snapShotRef.current = Array(NUM_SNAPSHOT_BUFFERS).fill(false);
        }, [selectedChannel]);

        // Buffers the raw sample into the currently active snapshot slot, flipping
        // to the next slot once it's full (mirrors the Canvas component's approach).
        const processBufferedData = useCallback((value: number) => {
            const currentBuffer = rawBufferRef.current[activeBufferIndexRef.current];
            currentBuffer.push(value);

            if (currentBuffer.length >= dataPointCountRef.current) {
                snapShotRef.current[activeBufferIndexRef.current] = true;
                activeBufferIndexRef.current = (activeBufferIndexRef.current + 1) % NUM_SNAPSHOT_BUFFERS;
                snapShotRef.current[activeBufferIndexRef.current] = false;
                rawBufferRef.current[activeBufferIndexRef.current] = [];
            }

            // Indices of the 5 *complete* previous windows, oldest excluded and
            // the still-filling active slot excluded — index 0 is the most
            // recently completed window, not the one currently being written.
            dataIndicesRef.current = Array.from(
                { length: 5 },
                (_, i) => (activeBufferIndexRef.current - i - 1 + NUM_SNAPSHOT_BUFFERS) % NUM_SNAPSHOT_BUFFERS
            );
        }, [snapShotRef]);

        useImperativeHandle(
            ref,
            () => ({
                updateData(data: number[]) {
                    // While paused, ignore incoming live data entirely; the display
                    // is instead driven by whichever buffered snapshot is selected.
                    if (!pauseRef.current) return;

                    for (let i = 0; i < 1; i++) {
                        const sensorValue = data[selectedChannel];
                        fftBufferRef.current[i].push(sensorValue);
                        updatePlot(sensorValue, Zoom);
                        processBufferedData(sensorValue);

                        if (fftBufferRef.current[i].length > fftSize) {
                            fftBufferRef.current[i].shift();
                        }
                        samplesReceivedRef.current++;
                        if (samplesReceivedRef.current % sampleupdateref.current === 0) {
                            const processedBuffer = fftBufferRef.current[i].slice(0, fftSize);
                            const floatInput = new Float32Array(processedBuffer);
                            const fftMags = fftProcessor.computeMagnitudes(floatInput);
                            const magArray = Array.from(fftMags);
                            const smoothedMags = filter.getSmoothedValues(magArray);

                            setFftData((prevData) => {
                                const newData = [...prevData];
                                newData[i] = smoothedMags;
                                return newData;
                            });
                            fftSnapshotBufferRef.current[activeBufferIndexRef.current] = smoothedMags;
                            // prevent overflow
                            if (samplesReceivedRef.current > 1e9) samplesReceivedRef.current = 0;
                        }
                    }
                },
            }),
            [Zoom, timeBase, canvasCount, fftSize, currentSamplingRate, selectedChannel, processBufferedData, pauseRef]
        );

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
                wglp.gScaleY = Zoom;
                const lineColor = theme === "dark" ? new ColorRGBA(1, 2, 2, 1) : new ColorRGBA(0, 0, 0, 1); // Adjust colors as needed

                const line = new WebglLine(lineColor, dataPointCountRef.current);
                line.offsetY = 0;
                line.lineSpaceX(-1, 2 / dataPointCountRef.current);
                wglp.addLine(line);
                newWglPlots.push(wglp);
                linesRef.current = [line];
                wglPlotsref.current = [wglp];
            } catch (error) {
                console.warn("Error creating WebglPlot:", error);
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
            if (!wglPlotsref.current[0] || !linesRef.current[0]) {
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
            // The waveform shows `timeBase` seconds, like the main Canvas
            // (it used to be a fixed 2000 points = 8 s at 250 Hz).
            dataPointCountRef.current = Math.max(1, Math.round(currentSamplingRate * timeBase));
            sweepPositions.current[0] = 0;

            // Buffered snapshots were sized for the old window length.
            rawBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => []);
            fftSnapshotBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => []);
            activeBufferIndexRef.current = 0;
            dataIndicesRef.current = [];
            snapShotRef.current = Array(NUM_SNAPSHOT_BUFFERS).fill(false);
        }, [timeBase, currentSamplingRate]);

        // Redraws the selected snapshot; set once updateSnapshot exists (below).
        const redrawPausedRef = useRef<() => void>(() => { });

        useEffect(() => {
            // Rebuilt plot restarts its sweep from the left (same as the
            // Chords visualizer on a theme / channel change).
            sweepPositions.current[0] = 0;
            createCanvasElement();
            // The new line is empty; while paused nothing refills it, so
            // redraw the snapshot being viewed (e.g. after a theme change).
            if (!pauseRef.current) redrawPausedRef.current();
        }, [theme, timeBase, currentSamplingRate, selectedChannel]);

        // Renders whichever buffered snapshot is selected while paused, replaying
        // both the raw waveform and its matching FFT magnitudes (mirrors Canvas).
        const updateSnapshot = useCallback((snapshotIndex: number) => {
            const bufferIndex = dataIndicesRef.current[snapshotIndex];
            if (bufferIndex === undefined) return;

            const bufferedRaw = rawBufferRef.current[bufferIndex];
            const line = linesRef.current[0];
            if (bufferedRaw && bufferedRaw.length && line) {
                try {
                    // Write every point directly (NaN past the end of the buffer)
                    // rather than shiftAdd, so the paused view always shows exactly
                    // the selected snapshot instead of blending in stale live data.
                    for (let p = 0; p < line.numPoints; p++) {
                        line.setY(p, p < bufferedRaw.length ? bufferedRaw[p] : NaN);
                    }
                } catch (error) {
                    console.warn("Error replaying buffered snapshot:", error);
                }
            }

            const bufferedFft = fftSnapshotBufferRef.current[bufferIndex];
            if (bufferedFft && bufferedFft.length) {
                setFftData((prevData) => {
                    const newData = [...prevData];
                    newData[0] = bufferedFft;
                    return newData;
                });
            }

            wglPlotsref.current[0]?.update();
        }, []);

        // Screen at the moment of pausing: waveform line + spectrum.
        const frozenRef = useRef<{ lines: FrozenLines; fft: number[][] } | null>(null);
        const fftDataRef = useRef(fftData);
        useEffect(() => {
            fftDataRef.current = fftData;
        }, [fftData]);

        const restoreFrozen = useCallback(() => {
            const frozen = frozenRef.current;
            if (!frozen) return;
            restoreLines(linesRef.current, frozen.lines);
            setFftData(frozen.fft);
            const wglp = wglPlotsref.current[0];
            if (wglp) {
                wglp.gScaleY = Zoom;
                wglp.update();
            }
        }, [Zoom]);

        // Snapshot 0 is the frozen screen; 1+ step back through complete windows.
        const drawPaused = useCallback((snapshot: number) => {
            if (!frozenRef.current) {
                frozenRef.current = { lines: captureLines(linesRef.current), fft: fftDataRef.current };
            }
            if (snapshot === 0) restoreFrozen();
            else updateSnapshot(snapshot - 1);
        }, [restoreFrozen, updateSnapshot]);

        useEffect(() => {
            redrawPausedRef.current = () => drawPaused(currentSnapshot);
        }, [drawPaused, currentSnapshot]);

        const animate = useCallback(() => {
            if (!pauseRef.current) {
                drawPaused(currentSnapshot);
            } else {
                // Resumed: put the paused screen back so the sweep continues
                // from where it stopped.
                if (frozenRef.current) {
                    restoreFrozen();
                    frozenRef.current = null;
                }
                wglPlotsref.current[0]?.update();
                requestAnimationFrame(animate);
            }
        }, [wglPlotsref, Zoom, pauseRef.current, currentSnapshot, drawPaused, restoreFrozen]);

        useEffect(() => {
            requestAnimationFrame(animate);
        }, [animate]);

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

            const leftMargin = 90;
            const bottomMargin = 50;
            const topMargin = 30; // added top margin

            ctx.clearRect(0, 0, canvas.width, height);

            const axisColor = theme === "dark" ? "white" : "black";

            ctx.beginPath();
            ctx.moveTo(leftMargin, topMargin); // use topMargin
            ctx.lineTo(leftMargin, height - bottomMargin);
            ctx.lineTo(width - 10, height - bottomMargin);
            ctx.strokeStyle = axisColor;
            ctx.stroke();

            const freqStep = currentSamplingRate / fftSize;
            const displayPoints = Math.min(Math.ceil(maxFreq / freqStep), fftSize / 2);

            const xScale = (width - leftMargin - 10) / displayPoints;

            let yMax = 1; // Default to prevent division by zero
            yMax = Math.max(...fftData.flat());

            const yScale = (height - bottomMargin - topMargin) / yMax;

            fftData.forEach((channelData, index) => {
                ctx.beginPath();
                ctx.strokeStyle = channelColors[index];
                for (let i = 0; i < displayPoints; i++) {
                    const x = leftMargin + i * xScale;
                    const y = height - bottomMargin - channelData[i] * yScale;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            });

            ctx.fillStyle = axisColor;
            ctx.font = "12px Arial";

            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            for (let i = 0; i <= 5; i++) {
                const labelY = height - bottomMargin - (i / 5) * (height - bottomMargin - topMargin);
                ctx.fillText(((yMax * i) / 5).toFixed(3), leftMargin - 10, labelY);
            }

            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const numLabels = Math.min(maxFreq / 10, Math.floor(currentSamplingRate / 2 / 10));
            let lastLabelX = -Infinity;
            const labelSpacing = 50; // Increased spacing

            for (let i = 0; i <= numLabels; i++) {
                const freq = i * 10;
                const labelX = leftMargin + (freq / freqStep) * xScale;

                // Only draw label if it is far enough from the last one
                if (labelX - lastLabelX >= labelSpacing) {
                    ctx.fillText(freq.toString(), labelX, height - bottomMargin + 10); // Moved label further up
                    lastLabelX = labelX;
                }
            }

            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("Frequency (Hz)", (width + leftMargin) / 2, height - 10);

            ctx.save();
            ctx.rotate(-Math.PI / 2);
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText("Magnitude", -height / 2, topMargin - 5);
            ctx.restore();
        }, [fftData, theme, maxFreq, currentSamplingRate, fftSize, channelColors]);


        useEffect(() => {
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
                {/* Main plotting area with minimum height */}
                <main
                    ref={canvasContainerRef}
                    className="flex-1 bg-highlight rounded-2xl m-2 overflow-hidden min-h-0 "
                >

                </main>
                <div className="flex-1 m-2 flex flex-col md:flex-row justify-center  overflow-hidden min-h-0  "
                >
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-hidden min-h-0 min-w-0 rounded-2xl bg-highlight  "
                    >
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full"
                        />
                    </div>
                    <div
                        className="
      relative        
      flex-1 flex flex-col 
     ml-3 overflow-hidden min-h-0 min-w-0 
     bg-highlight rounded-2xl
    "
                    >
                         {/* Tabs centred, fullscreen button in its own column on the
                            right: both side columns reserve room for the button, so
                            the tabs stay centred and the two can never overlap.
                            z-10: the candle view overflows upward and must never cover these. */}
                        <div className="relative z-10 grid grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center gap-2 px-2 pt-2 rounded-t-xl">
                            <div className="col-start-2 flex justify-center space-x-2">
                                <button
                                    onClick={() => setActiveBandPowerView('bandpower')}
                                    className={buttonStyles('bandpower')}
                                >
                                    Band Power
                                </button>
                                <button
                                    onClick={() => setActiveBandPowerView('brightcandle')}
                                    className={buttonStyles('brightcandle')}
                                >
                                    Beta Candle
                                </button>
                            </div>
                            {/* only show when we’re on the Beta Candle view */}
                            {activeBandPowerView === 'brightcandle' && (
                                <button
                                    onClick={() => setActiveBandPowerView('fullcandle')}
                                    className="col-start-3 justify-self-end p-2 bg-transparent text-gray-500 hover:text-gray-700 transition-all duration-300"
                                    aria-label="Fullscreen"
                                >
                                    <Expand />
                                </button>
                            )}
                        </div>

                        {renderBandPowerView()}
                    </div>

                </div>
            </div>
        );
    }
);

FFT.displayName = "FFT";
export default FFT;



