'use client';
import React, {
    useEffect,
    useRef,
    useState,
    useImperativeHandle,
    forwardRef,
} from "react";
import { useTheme } from "next-themes";
import { Heart } from "lucide-react";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";
import { darkThemeColors, lightThemeColors } from "./Colors";

interface ECGProps {
    pauseRef: React.RefObject<boolean>;
    selectedChannel: number;
    currentSamplingRate: number;
    timeBase?: number;
    Zoom: number;
}

const DEFAULT_SAMPLING_RATE = 500;
const DEFAULT_TIME_BASE_SECONDS = 4;

// Same line color as the Chords visualizer (Canvas.tsx).
const getLineColor = (channelNumber: number, theme: string | undefined): ColorRGBA => {
    const colors = theme === "dark" ? darkThemeColors : lightThemeColors;
    const hex = colors[(channelNumber - 1) % colors.length];
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new ColorRGBA(r, g, b, theme === "dark" ? 1 : 0.8);
};

// Pan-Tompkins R-peak detector (Pan & Tompkins 1985), ported 1:1 from
// NPG-Lite-Cardio (js/pan-tompkins.js). Timing constants are scaled from the
// original 125 Hz reference rate. Feed it the ECG-filtered signal; process()
// returns the absolute sample time of an R-peak, or null.
class PanTompkinsDetector {
    readonly fs: number;
    private MWI_WIN: number; private REFRACT: number; private LEARN_N: number;
    private R_BACK: number; private R_FWD: number;
    private TW_MIN: number; private TW_MAX: number; private TW_SLOPE_RATIO = 0.5;
    private RECOVER_MIN_GAP: number; private NO_QRS_ABS: number;
    private MW_BASE_ALPHA = 0.01; private DECAY_SPKI = 0.5;
    private ECG_HIST_LEN: number;

    private ecgHist: Float64Array; private slopeHist: Float64Array; private ecgTime: Uint32Array;
    private ecgW = 0;
    private dBuf = new Float64Array(5); private dW = 0;
    private mwiBuf: Float64Array; private mwiW = 0; private mwiSum = 0;
    private m0 = 0; private t0 = 0; private m1 = 0; private t1 = 0; private m2 = 0; private t2 = 0;
    private SPKI = 0; private NPKI = 0; private TH1 = 0; private TH2 = 0;
    private lastQRS = 0; private lastQRSSlope = 0;
    private rrBuf = new Float64Array(8); private rrW = 0; private rrN = 0; private rrAvg: number;
    private sbPeakVal = 0; private sbPeakTime = 0;
    private learnCount = 0; private learnMax = 0; private learnSum = 0;
    private mwBaseInit = false; private mwBase = 0; private lastRecover = 0;
    private bpmHist = new Float64Array(8); private bpmHW = 0; private bpmHN = 0;
    bpm = 0;
    private lastRTime = 0;
    private n = 0;

    constructor(fs: number) {
        this.fs = fs;
        const s = fs / 125;
        this.MWI_WIN = Math.round(20 * s);
        this.REFRACT = Math.round(25 * s);
        this.LEARN_N = fs * 2;
        this.R_BACK = Math.round(22 * s);
        this.R_FWD = Math.round(3 * s);
        this.TW_MIN = Math.round(25 * s);
        this.TW_MAX = Math.round(45 * s);
        this.RECOVER_MIN_GAP = Math.round(fs / 2);
        this.NO_QRS_ABS = fs;
        this.ECG_HIST_LEN = Math.round(240 * s);
        this.ecgHist = new Float64Array(this.ECG_HIST_LEN);
        this.slopeHist = new Float64Array(this.ECG_HIST_LEN);
        this.ecgTime = new Uint32Array(this.ECG_HIST_LEN);
        this.mwiBuf = new Float64Array(this.MWI_WIN);
        this.rrAvg = fs;
    }

    private deriv5(x: number) {
        this.dBuf[this.dW] = x;
        this.dW = (this.dW + 1) % 5;
        const i = this.dW;
        const xn2 = this.dBuf[(i + 3) % 5];
        const xn1 = this.dBuf[(i + 4) % 5];
        const xp1 = this.dBuf[(i + 1) % 5];
        const xp2 = this.dBuf[(i + 2) % 5];
        return (-xn2 - 2 * xn1 + 2 * xp1 + xp2) / 8.0;
    }

    private mwi(x: number) {
        this.mwiSum -= this.mwiBuf[this.mwiW];
        this.mwiBuf[this.mwiW] = x;
        this.mwiSum += x;
        this.mwiW = (this.mwiW + 1) % this.MWI_WIN;
        return this.mwiSum / this.MWI_WIN;
    }

    private rrUpdate(rr: number) {
        this.rrBuf[this.rrW] = rr;
        this.rrW = (this.rrW + 1) & 7;
        if (this.rrN < 8) this.rrN++;
        let s = 0;
        for (let i = 0; i < this.rrN; i++) s += this.rrBuf[i];
        this.rrAvg = s / this.rrN;
    }

    private bpmUpdate(rTime: number) {
        if (this.lastRTime === 0) { this.lastRTime = rTime; return; }
        const rr = rTime - this.lastRTime;
        this.lastRTime = rTime;
        if (rr < 10 || rr > this.fs * 3) return;
        this.bpmHist[this.bpmHW] = rr;
        this.bpmHW = (this.bpmHW + 1) & 7;
        if (this.bpmHN < 8) this.bpmHN++;
        let sum = 0;
        for (let i = 0; i < this.bpmHN; i++) sum += this.bpmHist[i];
        this.bpm = (60 * this.fs) / (sum / this.bpmHN);
    }

    // RR coefficient of variation — real ECG < 0.15, noise > 0.30; 1.0 until 4 intervals seen.
    rrCV() {
        if (this.bpmHN < 4) return 1.0;
        let sum = 0;
        for (let i = 0; i < this.bpmHN; i++) sum += this.bpmHist[i];
        const mean = sum / this.bpmHN;
        if (mean <= 0) return 1.0;
        let sumSq = 0;
        for (let i = 0; i < this.bpmHN; i++) {
            const d = this.bpmHist[i] - mean;
            sumSq += d * d;
        }
        return Math.sqrt(sumSq / this.bpmHN) / mean;
    }

    private slopeAround(timeCenter: number, halfWin: number) {
        let best = 0;
        for (let k = 0; k < this.ECG_HIST_LEN; k++) {
            const idx = (this.ecgW + this.ECG_HIST_LEN - 1 - k) % this.ECG_HIST_LEN;
            const dt = (this.ecgTime[idx] | 0) - (timeCenter | 0);
            if (dt > halfWin) continue;
            if (dt < -halfWin) break;
            if (this.slopeHist[idx] > best) best = this.slopeHist[idx];
        }
        return best;
    }

    // True R-peak: highest ECG sample near the MWI-detected QRS time.
    private findRpeak(qrsTime: number) {
        let bestVal = -Infinity, bestSlope = -1, bestTime = 0;
        for (let k = 0; k < this.ECG_HIST_LEN; k++) {
            const idx = (this.ecgW + this.ECG_HIST_LEN - 1 - k) % this.ECG_HIST_LEN;
            const dt = (this.ecgTime[idx] | 0) - (qrsTime | 0);
            if (dt > this.R_FWD) continue;
            if (dt < -this.R_BACK) break;
            const v = this.ecgHist[idx];
            const s = this.slopeHist[idx];
            if (v > bestVal || (v === bestVal && s > bestSlope)) {
                bestVal = v; bestSlope = s; bestTime = this.ecgTime[idx];
            }
        }
        return bestTime > 0 ? bestTime : null;
    }

    private updateTH() {
        this.TH1 = this.NPKI + 0.25 * (this.SPKI - this.NPKI);
        this.TH2 = 0.40 * this.TH1;
    }

    private acceptQRS(peakTime: number) {
        if (this.lastQRS !== 0) {
            const dt = peakTime - this.lastQRS;
            if (dt < this.REFRACT) return false;
            if (dt >= this.TW_MIN && dt <= this.TW_MAX) {
                const sNow = this.slopeAround(peakTime, 2);
                if (this.lastQRSSlope > 0 && sNow < this.TW_SLOPE_RATIO * this.lastQRSSlope) return false;
            }
            if (this.rrN >= 2 && (peakTime - this.lastQRS) < 0.30 * this.rrAvg) return false;
        }
        return true;
    }

    private watchdog() {
        if (this.n < this.LEARN_N || this.lastQRS === 0) return;
        let blindLimit = Math.floor(1.5 * this.rrAvg);
        if (blindLimit < this.NO_QRS_ABS) blindLimit = this.NO_QRS_ABS;
        if ((this.n - this.lastQRS) <= blindLimit) return;
        if ((this.n - this.lastRecover) < this.RECOVER_MIN_GAP) return;
        this.lastRecover = this.n;
        this.SPKI *= this.DECAY_SPKI;
        this.NPKI = 0.90 * this.NPKI + 0.10 * this.mwBase;
        if (this.NPKI < 1e-12) this.NPKI = 1e-12;
        if (this.SPKI < this.NPKI) this.SPKI = this.NPKI;
        this.updateTH();
        this.sbPeakVal = 0; this.sbPeakTime = 0;
    }

    private handleMWIPeak(peakVal: number, peakTime: number): number | null {
        if (this.n < this.LEARN_N) {
            this.learnCount++;
            this.learnSum += peakVal;
            if (peakVal > this.learnMax) this.learnMax = peakVal;
            if (this.n === this.LEARN_N - 1) {
                this.SPKI = this.learnMax;
                this.NPKI = this.learnCount > 0 ? this.learnSum / this.learnCount : 0.1 * this.learnMax;
                this.updateTH();
            }
            return null;
        }

        const isQRS = peakVal >= this.TH1 && this.acceptQRS(peakTime);
        if (!isQRS) {
            this.NPKI = 0.125 * peakVal + 0.875 * this.NPKI;
            this.updateTH();
            if (peakVal > this.TH2 && peakVal > this.sbPeakVal) {
                this.sbPeakVal = peakVal;
                this.sbPeakTime = peakTime;
            }
            return null;
        }

        const rr = this.lastQRS === 0 ? this.rrAvg : (peakTime - this.lastQRS);
        this.lastQRS = peakTime;
        this.rrUpdate(rr);
        this.lastQRSSlope = this.slopeAround(peakTime, 2);
        this.SPKI = 0.125 * peakVal + 0.875 * this.SPKI;
        this.updateTH();
        this.sbPeakVal = 0; this.sbPeakTime = 0;

        const rT = this.findRpeak(peakTime);
        const rTime = rT !== null ? rT : peakTime;
        this.bpmUpdate(rTime);
        return rTime;
    }

    private searchback(): number | null {
        if (this.n < this.LEARN_N || this.lastQRS === 0) return null;
        if ((this.n - this.lastQRS) <= 1.66 * this.rrAvg) return null;
        if (this.sbPeakTime !== 0 && this.sbPeakVal >= this.TH2 && this.acceptQRS(this.sbPeakTime)) {
            const rr = this.sbPeakTime - this.lastQRS;
            this.lastQRS = this.sbPeakTime;
            this.rrUpdate(rr);
            this.lastQRSSlope = this.slopeAround(this.sbPeakTime, 2);
            this.SPKI = 0.125 * this.sbPeakVal + 0.875 * this.SPKI;
            this.updateTH();
            const rT = this.findRpeak(this.sbPeakTime);
            const rTime = rT !== null ? rT : this.sbPeakTime;
            this.sbPeakVal = 0; this.sbPeakTime = 0;
            this.bpmUpdate(rTime);
            return rTime;
        }
        this.sbPeakVal = 0; this.sbPeakTime = 0;
        this.NPKI *= 0.95;
        this.updateTH();
        return null;
    }

    process(ecgSample: number): number | null {
        const n = this.n;
        const d = this.deriv5(ecgSample);
        const slope = Math.abs(d);
        const mw = this.mwi(d * d);

        this.ecgHist[this.ecgW] = ecgSample;
        this.slopeHist[this.ecgW] = slope;
        this.ecgTime[this.ecgW] = n;
        this.ecgW = (this.ecgW + 1) % this.ECG_HIST_LEN;

        this.m0 = this.m1; this.t0 = this.t1;
        this.m1 = this.m2; this.t1 = this.t2;
        this.m2 = mw; this.t2 = n;

        if (n >= this.LEARN_N) {
            if (!this.mwBaseInit) { this.mwBase = mw; this.mwBaseInit = true; }
            if (mw < this.TH1) this.mwBase = (1 - this.MW_BASE_ALPHA) * this.mwBase + this.MW_BASE_ALPHA * mw;
            this.watchdog();
        }

        let rPeak: number | null = null;
        if (n >= 2 && this.m1 > this.m0 && this.m1 >= this.m2) rPeak = this.handleMWIPeak(this.m1, this.t1);

        const sb = this.searchback();
        if (sb !== null) rPeak = sb;

        this.n++;
        return rPeak;
    }
}

// RR CV above this = noise (same gate as NPG-Lite-Cardio).
const RR_CV_THRESHOLD = 0.25;

const makeState = (N: number, fs: number) => ({
    N,
    raw: new Float32Array(N),
    peaks: new Uint8Array(N),
    n: 0,
    detector: new PanTompkinsDetector(fs),
    lastBeat: -Infinity,
});

const ECG = forwardRef(
    (
        { pauseRef, selectedChannel, currentSamplingRate, timeBase = DEFAULT_TIME_BASE_SECONDS, Zoom }: ECGProps,
        ref
    ) => {
        // Use resolvedTheme, not theme: see the comment in Canvas.tsx.
        const { resolvedTheme: theme } = useTheme();
        const containerRef = useRef<HTMLDivElement>(null);
        const plotCanvasRef = useRef<HTMLCanvasElement>(null);
        const markerCanvasRef = useRef<HTMLCanvasElement>(null);
        const heartRef = useRef<SVGSVGElement>(null);
        const wglpRef = useRef<WebglPlot | null>(null);
        const lineRef = useRef<WebglLine | null>(null);
        const [bpm, setBpm] = useState<number | null>(null);

        const fs = currentSamplingRate > 0 ? currentSamplingRate : DEFAULT_SAMPLING_RATE;
        const zoomRef = useRef(Zoom);
        zoomRef.current = Zoom;

        // Detector state + R-peak flags, indexed by sweep position (sample % N).
        const stateRef = useRef(makeState(Math.round(fs * timeBase), fs));

        // Build the WebGL plot exactly like the Chords visualizer, and reset
        // detection whenever channel, sampling rate, time base or theme change.
        // The plot canvas is keyed on the same values, so this always gets a
        // fresh canvas / WebGL context.
        const plotKey = `${selectedChannel}-${fs}-${timeBase}-${theme}`;
        useEffect(() => {
            const plotCanvas = plotCanvasRef.current;
            const container = containerRef.current;
            if (!plotCanvas || !container) return;
            const N = Math.round(fs * timeBase);
            stateRef.current = makeState(N, fs);
            setBpm(null);

            plotCanvas.width = container.clientWidth;
            plotCanvas.height = container.clientHeight;
            const wglp = new WebglPlot(plotCanvas);
            wglp.gScaleY = zoomRef.current;
            wglp.gOffsetY = 0;
            const line = new WebglLine(getLineColor(selectedChannel, theme), N);
            line.offsetY = 0;
            line.lineSpaceX(-1, 2 / N);
            wglp.addLine(line);
            wglpRef.current = wglp;
            lineRef.current = line;

            return () => {
                wglpRef.current = null;
                lineRef.current = null;
                wglp.removeAllLines();
            };
        }, [plotKey, selectedChannel, fs, timeBase, theme]);

        useEffect(() => {
            if (wglpRef.current) wglpRef.current.gScaleY = Zoom;
        }, [Zoom]);

        useImperativeHandle(
            ref,
            () => ({
                updateData(data: number[]) {
                    // pauseRef.current === false means paused.
                    if (!pauseRef.current) return;
                    const s = stateRef.current;
                    const line = lineRef.current;
                    const value = data[selectedChannel];
                    if (!line || value === undefined || isNaN(value)) return;

                    const pos = s.n % s.N;
                    s.raw[pos] = value;
                    s.peaks[pos] = 0;

                    // Same sweep as the Chords visualizer.
                    line.setY(pos, value);
                    const clearPosition = Math.ceil((pos + s.N / 100) % s.N);
                    if (clearPosition < s.N) {
                        line.setY(clearPosition, NaN);
                        s.peaks[clearPosition] = 0;
                    }

                    // R-peak detection on the (ECG-filtered) displayed signal.
                    // Detector time == s.n, so its R time maps straight onto the sweep.
                    const rTime = s.detector.process(value);
                    const regular = s.detector.rrCV() < RR_CV_THRESHOLD;
                    if (rTime !== null && regular && s.n - rTime < s.N) {
                        s.peaks[rTime % s.N] = 1;
                        s.lastBeat = rTime;
                        const b = s.detector.bpm;
                        setBpm(b >= 30 && b <= 220 ? Math.round(b) : null);

                        const heart = heartRef.current;
                        if (heart) {
                            heart.style.transform = "scale(1.35)";
                            setTimeout(() => { heart.style.transform = "scale(1)"; }, 120);
                        }
                    }

                    s.n++;
                },
            }),
            [pauseRef, selectedChannel, fs]
        );

        // Render loop: WebGL trace + peak markers on a transparent overlay that
        // uses the plot's own mapping (x = i / N, y = value * Zoom).
        useEffect(() => {
            let frameId: number;
            const draw = () => {
                frameId = requestAnimationFrame(draw);
                const container = containerRef.current;
                const plotCanvas = plotCanvasRef.current;
                const markerCanvas = markerCanvasRef.current;
                const wglp = wglpRef.current;
                if (!container || !plotCanvas || !markerCanvas || !wglp) return;

                const W = container.clientWidth;
                const H = container.clientHeight;
                if (plotCanvas.width !== W || plotCanvas.height !== H) {
                    plotCanvas.width = W;
                    plotCanvas.height = H;
                    wglp.viewport(0, 0, W, H);
                }
                wglp.update();

                const dpr = window.devicePixelRatio || 1;
                if (markerCanvas.width !== Math.floor(W * dpr) || markerCanvas.height !== Math.floor(H * dpr)) {
                    markerCanvas.width = Math.floor(W * dpr);
                    markerCanvas.height = Math.floor(H * dpr);
                }
                const ctx = markerCanvas.getContext("2d");
                if (!ctx) return;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, W, H);

                const s = stateRef.current;
                const zoom = zoomRef.current;
                ctx.fillStyle = "#ef4444";
                for (let i = 0; i < s.N; i++) {
                    if (!s.peaks[i]) continue;
                    const x = (i / s.N) * W;
                    const y = (H / 2) * (1 - s.raw[i] * zoom);
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(x - 6, y - 16);
                    ctx.lineTo(x + 6, y - 16);
                    ctx.lineTo(x, y - 8);
                    ctx.closePath();
                    ctx.fill();
                }

                // Drop BPM if no beat for 3 s.
                if (isFinite(s.lastBeat) && (s.n - s.lastBeat) / fs > 3) {
                    s.lastBeat = -Infinity;
                    setBpm(null);
                }
            };
            frameId = requestAnimationFrame(draw);
            return () => cancelAnimationFrame(frameId);
        }, [fs]);

        // Same grid as the Chords visualizer.
        const isDark = theme === "dark";
        const gridOpacity = (major: boolean) =>
            major ? (isDark ? 0.2 : 0.4) : (isDark ? 0.05 : 0.1);

        return (
            <main className="flex flex-col flex-[1_1_0%] min-h-80 bg-highlight rounded-2xl m-4 relative">
                <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: 99 }, (_, k) => k + 1).map((j) => (
                        <div key={`x${j}`} className="absolute bg-[rgb(128,128,128)]"
                            style={{ width: 1, height: "100%", left: `${j}%`, opacity: gridOpacity(j % 5 === 0) }} />
                    ))}
                    {Array.from({ length: 49 }, (_, k) => k + 1).map((j) => (
                        <div key={`y${j}`} className="absolute bg-[rgb(128,128,128)]"
                            style={{ height: 1, width: "100%", top: `${(j / 50) * 100}%`, opacity: gridOpacity(j % 5 === 0) }} />
                    ))}
                </div>
                <div ref={containerRef} className="absolute inset-0">
                    <canvas key={plotKey} ref={plotCanvasRef} className="absolute inset-0 w-full h-full block rounded-xl" />
                    <canvas ref={markerCanvasRef} className="absolute inset-0 w-full h-full block pointer-events-none" />
                </div>
                <div className="absolute text-gray-500 text-sm rounded-full p-2 m-2">CH{selectedChannel}</div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1 rounded-full bg-background/80 border pointer-events-none">
                    <Heart ref={heartRef} size={22} className="text-red-500 fill-red-500 transition-transform duration-100" />
                    <span className="text-2xl font-bold tabular-nums min-w-[3ch] text-center">{bpm ?? "--"}</span>
                    <span className="text-sm font-semibold text-gray-500">BPM</span>
                </div>
            </main>
        );
    }
);

ECG.displayName = "ECG";
export default ECG;
