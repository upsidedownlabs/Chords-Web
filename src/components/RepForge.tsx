'use client';
import { captureLines, restoreLines, type FrozenLines } from "./frozenPlot";
import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from "react";
import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";
import { useTheme } from "next-themes";

interface RepForgeProps {
    pauseRef: React.RefObject<boolean>;
    snapShotRef: React.MutableRefObject<boolean[]>;
    currentSnapshot: number;
    selectedChannels: number[];
    currentSamplingRate: number;
    timeBase?: number;
    Zoom: number;
}

// One WebGL canvas + its plot/lines for a single channel, kept alive across
// channel-selection changes so toggling a channel only creates/destroys the
// canvas for that one channel instead of tearing down every trace on screen.
type ChannelEntry = {
    wrapper: HTMLDivElement;
    canvas: HTMLCanvasElement;
    wglp: WebglPlot;
    lines: [WebglLine, WebglLine];
};

// One bar in the band-power chart. `scale` is always 1 for a currently
// selected channel; entries for deselected channels are dropped immediately
// rather than kept around, so drawGraph never sizes/positions bars around a
// leftover zero-width slot.
type BarEntry = {
    channelNumber: number;
    value: number;
    scale: number;
};

// Canvas' textBaseline "middle" centers on the font's full ascent/descent
// box, which reserves room for descenders (g, y, ...) that labels like
// "CH1" or "12.34" never use — so "middle"-baselined all-caps/digit text
// renders visibly above the true center of its box. This centers on the
// text's own actual rendered glyph bounds instead.
function fillTextVCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number) {
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || 0;
    const descent = metrics.actualBoundingBoxDescent || 0;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, cx, cy + (ascent - descent) / 2);
}

function disposeChannelEntry(entry: ChannelEntry) {
    const gl = entry.canvas.getContext("webgl");
    if (gl) {
        const loseContext = gl.getExtension("WEBGL_lose_context");
        if (loseContext) loseContext.loseContext();
    }
    entry.wrapper.remove();
}

class EnvelopeFilter {
    private circularBuffer: number[];
    private sum: number = 0;
    private dataIndex: number = 0;
    private readonly bufferSize: number;

    constructor(bufferSize: number) {
        this.bufferSize = bufferSize;
        this.circularBuffer = new Array(bufferSize).fill(0);
    }

    getEnvelope(absEmg: number): number {
        this.sum -= this.circularBuffer[this.dataIndex];
        this.sum += absEmg;
        this.circularBuffer[this.dataIndex] = absEmg;
        this.dataIndex = (this.dataIndex + 1) % this.bufferSize;
        return this.sum / this.bufferSize;
    }
}

// Default number of points per line (2s @ 500Hz) used until the real
// sampling rate / timeBase are known. Kept short rather than a long sweep
// window so the trace fills the full available width quickly instead of
// leaving a visible blank gap after connecting or changing channels.
const DEFAULT_NUM_POINTS = 1000;
const DEFAULT_TIME_BASE_SECONDS = 2;

const NUM_SNAPSHOT_BUFFERS = 6;

// RepForge only ever shows this many channels at once, regardless of how
// many the connected device actually supports (some boards have up to 16).
export const MAX_REPFORGE_CHANNELS = 6;

const RepForge = forwardRef(
    (
        { pauseRef, snapShotRef, currentSnapshot, selectedChannels, currentSamplingRate, timeBase = DEFAULT_TIME_BASE_SECONDS, Zoom }: RepForgeProps,
        ref
    ) => {
        // Use resolvedTheme, not theme: see the comment in Canvas.tsx.
        const { resolvedTheme: theme } = useTheme();
        const canvasContainerRef = useRef<HTMLDivElement>(null);
        // Window size in samples, kept in sync with timeBase/currentSamplingRate
        // (see the reset effect below) so the Time-Base control in the toolbar
        // actually changes how much data Rep-Forge shows, same as Chords Visualizer.
        const dataPointCountRef = useRef<number>(DEFAULT_NUM_POINTS);
        const sweepPositions = useRef<number[]>([]);
        const wglpRefs = useRef<WebglPlot[]>([]);
        const linesRefs = useRef<WebglLine[][]>([]); // [channelIndex] -> [rawLine, envelopeLine]
        const envelopeFilters = useRef<EnvelopeFilter[]>([]);
        const selectedChannelsRef = useRef<number[]>(selectedChannels);
        const previousCounterRef = useRef<number | null>(null);
        // Latest Zoom value for use inside callbacks that shouldn't be
        // recreated (and shouldn't trigger a full rebuild) on every zoom tick —
        // the effect below keeps existing plots' gScaleY in sync separately.
        const zoomRef = useRef(Zoom);
        zoomRef.current = Zoom;
        // Canvas/WebGL objects, keyed by channel number, that persist across
        // channel-selection changes (see reconcileChannels below).
        const channelEntriesRef = useRef<Map<number, ChannelEntry>>(new Map());
        const prevSelectedChannelsRef = useRef<number[]>([]);

        // Buffers used to remember the last few windows of raw samples per
        // channel so that pausing can step back through recent snapshots.
        // envBufferRef stores the envelope value computed live alongside each
        // raw sample, so replaying a window shows the exact same envelope
        // trace that was displayed live — not one recomputed from a filter
        // that resets to zero at the start of every window.
        const rawBufferRef = useRef<number[][][]>(
            Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => [])
        );
        const envBufferRef = useRef<number[][][]>(
            Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => [])
        );
        const activeBufferIndexRef = useRef<number>(0);
        const dataIndicesRef = useRef<number[]>([]);

        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const latestDataRef = useRef<number[] | null>(null);
        const prevBandPowerData = useRef<number[]>([]);
        const [bandPowerData, setBandPowerData] = useState<number[]>([]);
        const powerBuffer = useRef<number[][]>([]);
        // Animated bar state for the band-power chart — see BarEntry above.
        const barEntriesRef = useRef<BarEntry[]>([]);
        // Eases toward selectedChannels.length so the chart's decorative
        // sizing (padding/fonts/gaps) transitions smoothly alongside the
        // bars themselves, instead of snapping the instant a bar is added
        // or fully removed.
        const decorativeCountRef = useRef<number>(Math.max(selectedChannels.length, 1));

        useEffect(() => {
            // Carry state over for channels that stay selected (matched by
            // channel number, not array index) instead of wiping everything —
            // an unrelated channel's envelope/band-power shouldn't jump or
            // reset just because another channel was toggled.
            const prevChannels = selectedChannelsRef.current;
            const prevEnvelopeFilters = envelopeFilters.current;
            const prevPowerBuffer = powerBuffer.current;
            const prevBandData = prevBandPowerData.current;

            const remapByChannel = <T,>(arr: T[], fallback: () => T): T[] =>
                selectedChannels.map((channelNumber) => {
                    const prevIndex = prevChannels.indexOf(channelNumber);
                    return prevIndex !== -1 && arr[prevIndex] !== undefined ? arr[prevIndex] : fallback();
                });

            envelopeFilters.current = remapByChannel(prevEnvelopeFilters, () => new EnvelopeFilter(64));
            powerBuffer.current = remapByChannel(prevPowerBuffer, () => []);
            // Every trace restarts from the left on a channel change, same as
            // the Chords visualizer (reconcileChannels clears the kept lines).
            sweepPositions.current = selectedChannels.map(() => 0);
            const remappedBandData = remapByChannel(prevBandData, () => 0);

            selectedChannelsRef.current = selectedChannels;
            setBandPowerData(remappedBandData);
            prevBandPowerData.current = remappedBandData;

            // Keep the window size in sync with the Time-Base control (same
            // as Chords Visualizer) — falls back to the default until the
            // device's real sampling rate is known.
            dataPointCountRef.current = currentSamplingRate > 0
                ? Math.round(currentSamplingRate * timeBase)
                : DEFAULT_NUM_POINTS;

            // Changing which channels are selected, or the window size
            // (timeBase / sampling rate), invalidates every buffered
            // snapshot — a slot may hold data for a channel that's no longer
            // shown, or be sized for a different window length than buffers
            // filled afterward. Reset the pause/snapshot buffers so
            // pause/rewind never mixes stale or mismatched-length data in.
            rawBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => selectedChannels.map(() => []));
            envBufferRef.current = Array.from({ length: NUM_SNAPSHOT_BUFFERS }, () => selectedChannels.map(() => []));
            activeBufferIndexRef.current = 0;
            dataIndicesRef.current = [];
            snapShotRef.current = Array(NUM_SNAPSHOT_BUFFERS).fill(false);
        }, [selectedChannels, timeBase, currentSamplingRate, snapShotRef]);

        // Builds one channel's canvas/plot/lines. Used both for a full
        // rebuild and to add a single newly-selected channel.
        const buildChannelEntry = useCallback((channelNumber: number, container: HTMLDivElement, channelCount: number): ChannelEntry => {
            const canvasWrapper = document.createElement("div");
            canvasWrapper.className = "canvas-container relative flex-[1_1_0%]";

            const canvas = document.createElement("canvas");
            canvas.id = `repforge-canvas${channelNumber}`;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight / channelCount;
            canvas.className = "w-full h-full block rounded-xl";

            const badge = document.createElement("div");
            badge.className = "absolute text-gray-500 text-sm rounded-full p-2 m-2";
            badge.innerText = `CH${channelNumber}`;

            canvasWrapper.appendChild(badge);
            canvasWrapper.appendChild(canvas);

            const wglp = new WebglPlot(canvas);
            wglp.gScaleY = zoomRef.current;

            const color1 = new ColorRGBA(1, 0, 0, 1); // Raw EMG
            const color2 = new ColorRGBA(0, 1, 1, 1); // Envelope

            const line1 = new WebglLine(color1, dataPointCountRef.current);
            line1.lineSpaceX(-1, 2 / dataPointCountRef.current);
            wglp.addLine(line1);

            const line2 = new WebglLine(color2, dataPointCountRef.current);
            line2.lineSpaceX(-1, 2 / dataPointCountRef.current);
            wglp.addLine(line2);

            return { wrapper: canvasWrapper, canvas, wglp, lines: [line1, line2] };
        }, []);

        // Full teardown + rebuild of the grid and every channel's canvas.
        // Only needed when the theme (grid colors) or the window size
        // (timeBase / sampling rate, which changes how many points each line
        // needs) changes — NOT on every channel toggle, which is handled
        // incrementally by reconcileChannels below to avoid the flash/jitter
        // a full WebGL context teardown causes on every trace.
        const rebuildAll = useCallback(() => {
            const container = canvasContainerRef.current;
            if (!container) return;

            channelEntriesRef.current.forEach(disposeChannelEntry);
            channelEntriesRef.current.clear();

            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            const gridWrapper = document.createElement("div");
            gridWrapper.className = "absolute inset-0";
            const opacityDarkMajor = "0.2";
            const opacityDarkMinor = "0.05";
            const opacityLightMajor = "0.4";
            const opacityLightMinor = "0.1";
            const distanceminor = 500 * 0.04;
            const numGridLines = (500 * 4) / distanceminor;

            for (let j = 1; j < numGridLines; j++) {
                const gridLineX = document.createElement("div");
                gridLineX.className = "absolute bg-[rgb(128,128,128)]";
                gridLineX.style.width = "1px";
                gridLineX.style.height = "100%";
                gridLineX.style.left = `${((j / numGridLines) * 100).toFixed(3)}%`;
                gridLineX.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
                gridWrapper.appendChild(gridLineX);
            }

            const horizontalline = 50;
            for (let j = 1; j < horizontalline; j++) {
                const gridLineY = document.createElement("div");
                gridLineY.className = "absolute bg-[rgb(128,128,128)]";
                gridLineY.style.height = "1px";
                gridLineY.style.width = "100%";
                gridLineY.style.top = `${((j / horizontalline) * 100).toFixed(3)}%`;
                gridLineY.style.opacity = j % 5 === 0 ? (theme === "dark" ? opacityDarkMajor : opacityLightMajor) : (theme === "dark" ? opacityDarkMinor : opacityLightMinor);
                gridWrapper.appendChild(gridLineY);
            }
            container.appendChild(gridWrapper);

            const channels = selectedChannelsRef.current;
            wglpRefs.current = [];
            linesRefs.current = [];

            channels.forEach((channelNumber, index) => {
                const entry = buildChannelEntry(channelNumber, container, channels.length);
                container.appendChild(entry.wrapper);
                channelEntriesRef.current.set(channelNumber, entry);
                wglpRefs.current[index] = entry.wglp;
                linesRefs.current[index] = entry.lines;
            });

            prevSelectedChannelsRef.current = channels;
            sweepPositions.current = channels.map(() => 0);
        }, [theme, buildChannelEntry]);

        // Redraws the selected snapshot; set once updateSnapshot exists (below).
        const redrawPausedRef = useRef<() => void>(() => { });

        useEffect(() => {
            rebuildAll();
            // timeBase/currentSamplingRate aren't read directly in rebuildAll,
            // but they change dataPointCountRef.current (via the reset effect
            // above, which runs first) — a full rebuild is required whenever
            // that changes since WebglLine's point count can't be resized in
            // place.

            // The rebuilt lines are empty; while paused nothing refills them,
            // so redraw the snapshot being viewed (e.g. after a theme change).
            if (!pauseRef.current) redrawPausedRef.current();
        }, [rebuildAll, timeBase, currentSamplingRate]);

        // Resizes existing canvases in place (canvas width/height + GL
        // viewport) without touching their WebGL context or line data.
        const resizeCanvases = useCallback(() => {
            const container = canvasContainerRef.current;
            if (!container) return;
            const entries = channelEntriesRef.current;
            const channelCount = entries.size;
            if (channelCount === 0) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight / channelCount;
            entries.forEach((entry) => {
                if (entry.canvas.width !== newWidth || entry.canvas.height !== newHeight) {
                    entry.canvas.width = newWidth;
                    entry.canvas.height = newHeight;
                    entry.wglp.viewport(0, 0, newWidth, newHeight);
                }
            });
        }, []);

        // Adds/removes only the canvases for channels that were actually
        // toggled, keeping every other channel's WebGL context (avoids the
        // flash of a full teardown); all traces then restart from the left.
        const reconcileChannels = useCallback(() => {
            const container = canvasContainerRef.current;
            if (!container) return;

            const prevChannels = prevSelectedChannelsRef.current;
            const nextChannels = selectedChannels;
            const nextSet = new Set(nextChannels);
            const entries = channelEntriesRef.current;

            prevChannels.forEach((channelNumber) => {
                if (!nextSet.has(channelNumber)) {
                    const entry = entries.get(channelNumber);
                    if (entry) {
                        disposeChannelEntry(entry);
                        entries.delete(channelNumber);
                    }
                }
            });

            nextChannels.forEach((channelNumber) => {
                if (!entries.has(channelNumber)) {
                    entries.set(channelNumber, buildChannelEntry(channelNumber, container, nextChannels.length));
                }
            });

            wglpRefs.current = [];
            linesRefs.current = [];
            nextChannels.forEach((channelNumber, index) => {
                const entry = entries.get(channelNumber);
                if (!entry) return;
                // Re-appending an existing node moves it rather than
                // duplicating it, so this also reorders canvases to match
                // the current selection order.
                container.appendChild(entry.wrapper);
                wglpRefs.current[index] = entry.wglp;
                linesRefs.current[index] = entry.lines;
            });

            // Restart the kept channels' traces too (new canvases are already
            // empty), without tearing down their WebGL contexts.
            linesRefs.current.forEach((lines) =>
                lines?.forEach((line) => {
                    for (let p = 0; p < line.numPoints; p++) line.setY(p, 0);
                })
            );
            wglpRefs.current.forEach((wglp) => wglp?.update());

            resizeCanvases();
            prevSelectedChannelsRef.current = nextChannels;
        }, [selectedChannels, buildChannelEntry, resizeCanvases]);

        useEffect(() => {
            reconcileChannels();
        }, [reconcileChannels]);

        useEffect(() => {
            const container = canvasContainerRef.current;
            if (!container) return;
            const ro = new ResizeObserver(() => {
                resizeCanvases();
            });
            ro.observe(container);
            return () => ro.disconnect();
        }, [resizeCanvases]);

        useEffect(() => {
            wglpRefs.current.forEach((wglp) => {
                if (wglp) wglp.gScaleY = Zoom;
            });
        }, [Zoom]);

        // Renders whichever buffered snapshot is selected while paused, replaying
        // the raw waveform and its matching envelope + band power (mirrors Canvas).
        const updateSnapshot = useCallback((snapshotIndex: number) => {
            const bufferIndex = dataIndicesRef.current[snapshotIndex];
            if (bufferIndex === undefined) return;

            const bufferedChannels = rawBufferRef.current[bufferIndex];
            const bufferedEnvChannels = envBufferRef.current[bufferIndex];
            if (!bufferedChannels) return;

            const envValues: number[] = [];

            selectedChannelsRef.current.forEach((_channelNumber, index) => {
                const raw = bufferedChannels[index];
                // Use the envelope values captured live for this exact window,
                // rather than recomputing from a filter that would reset to
                // zero at the start of the window (a visible "ramp-up" that
                // never actually happened when this window was live).
                const envArray = bufferedEnvChannels?.[index];
                const lines = linesRefs.current[index];
                if (!raw || !raw.length || !envArray || !lines) return;
                const [line1, line2] = lines;
                if (!line1 || !line2) return;

                try {
                    // Write every point directly (NaN past the end of the buffer)
                    // rather than shiftAdd, so the paused view always shows exactly
                    // the selected snapshot instead of blending in stale live data.
                    for (let p = 0; p < line1.numPoints; p++) {
                        line1.setY(p, p < raw.length ? raw[p] : NaN);
                        line2.setY(p, p < envArray.length ? envArray[p] : NaN);
                    }
                } catch (error) {
                    console.warn(`Error replaying buffered snapshot for channel ${index}:`, error);
                }

                envValues[index] = envArray[envArray.length - 1] ?? 0;
            });

            setBandPowerData(envValues);
            wglpRefs.current.forEach((wglp) => {
                if (!wglp) return;
                wglp.gScaleY = Zoom;
                wglp.update();
            });
        }, [Zoom]);

        // Screen at the moment of pausing: raw + envelope lines and bar values.
        const frozenRef = useRef<{ lines: FrozenLines; bands: number[] } | null>(null);
        const bandPowerDataRef = useRef(bandPowerData);
        useEffect(() => {
            bandPowerDataRef.current = bandPowerData;
        }, [bandPowerData]);

        const restoreFrozen = useCallback(() => {
            const frozen = frozenRef.current;
            if (!frozen) return;
            restoreLines(linesRefs.current.flat(), frozen.lines);
            setBandPowerData(frozen.bands);
            wglpRefs.current.forEach((wglp) => {
                if (!wglp) return;
                wglp.gScaleY = Zoom;
                wglp.update();
            });
        }, [Zoom]);

        // Snapshot 0 is the frozen screen; 1+ step back through complete windows.
        const drawPaused = useCallback((snapshot: number) => {
            if (!frozenRef.current) {
                frozenRef.current = {
                    lines: captureLines(linesRefs.current.flat()),
                    bands: bandPowerDataRef.current,
                };
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
                wglpRefs.current.forEach((wglp) => wglp && wglp.update());
                requestAnimationFrame(animate);
            }
        }, [pauseRef.current, currentSnapshot, drawPaused, restoreFrozen]);

        useEffect(() => {
            const frame = requestAnimationFrame(animate);
            return () => cancelAnimationFrame(frame);
        }, [animate]);

        const drawGraph = useCallback(
            (entries: BarEntry[], decorativeCount: number) => {
                const canvas = canvasRef.current;
                const container = containerRef.current;
                if (!canvas || !container) return;
                if (entries.length === 0 || entries.some((e) => isNaN(e.value))) return;

                container.style.display = 'block';
                const { width: cssW, height: cssH } = container.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;

                if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
                    canvas.width = Math.floor(cssW * dpr);
                    canvas.height = Math.floor(cssH * dpr);
                    canvas.style.width = `${cssW}px`;
                    canvas.style.height = `${cssH}px`;
                }

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, cssW, cssH);

                const W = cssW;
                const H = cssH;

                // The number of bar "slots" (including ones currently
                // animating out) drives gap count as before; each slot's
                // actual on-screen width is its own animated share of the
                // total, computed below, so a bar grows in / shrinks out
                // smoothly instead of every bar snapping straight to a new
                // evenly-divided width.
                const slotCount = entries.length;
                const totalScale = entries.reduce((sum, e) => sum + e.scale, 0) || 1;

                // Scale padding/gap/radius/font against the panel's width at
                // MAX_REPFORGE_CHANNELS, not its actual current width — the
                // panel itself shrinks as fewer channels are selected (so
                // each bar keeps a fixed width), but that shouldn't also
                // shrink the gap between bars or the padding around them;
                // everything should look exactly like the 6-channel case.
                // Based on the eased `decorativeCount` (not the raw,
                // possibly near-zero `totalScale`) so padding/fonts/gaps
                // transition smoothly too, instead of momentarily blowing up
                // while a bar is still mostly grown-in.
                const equivalentWidthAtMaxChannels = W * (MAX_REPFORGE_CHANNELS / decorativeCount);
                const scale = equivalentWidthAtMaxChannels / 800;
                // Since W itself scales linearly with channel count (see
                // rightPanelWidthPercent below), padding must be exactly
                // half of the multi-bar gap for unitBarWidth's derivation
                // to be perfectly independent of N — any other ratio leaves
                // a leftover term that shrinks/grows with N, which shows up
                // as every existing bar's edge visibly drifting by a couple
                // px whenever a channel is added/removed.
                const padding = 4 * scale;

                const availableWidth = W - (padding * 2);
                // Bars always divide up the full available width evenly: one
                // selected channel gets the whole width, two split it evenly, etc.
                // The gap between bars is a fixed pixel amount (not a fraction of
                // the per-bar width), so the bar group always occupies the same
                // total width — whether there's 1 channel or MAX_REPFORGE_CHANNELS.
                const barGap = slotCount > 1 ? 8 * scale : 0;
                const barSpace = barGap;
                // Width one full (scale === 1) bar gets; each entry's actual
                // width is this times its own animated scale.
                const unitBarWidth = (availableWidth - barGap * (slotCount - 1)) / totalScale;

                const axisGap = Math.max(1 * scale, 1);
                let labelBoxH = 40 * scale;

                const barAreaH = H - padding * 2 - labelBoxH - axisGap;

                if (H < 600) {
                    labelBoxH *= 0.8;
                }

                // The channel pill overlaid near the top of the bar (the bar
                // keeps drawing behind it) is sized off the label box height,
                // and the bottom value label is capped against each bar's
                // width so neither ever grows past the box or overlaps its
                // neighbors when there are many bars.
                const pillHeight = Math.max(Math.min(barAreaH * 0.09, 28 * scale), 16);
                const pillFontLabel = Math.max(Math.min(pillHeight * 0.45, unitBarWidth * 0.2), 10);
                const baseFontLabel = Math.max(Math.min(labelBoxH * 0.35, unitBarWidth * 0.18), 10);
                // With only one bar there's plenty of spare room, so size the
                // value up a bit rather than leaving it at the multi-bar size.
                const fontLabel = slotCount === 1 ? baseFontLabel * 1.25 : baseFontLabel;

                const axisColor = theme === "dark" ? "#fff" : "#000";
                const bgColor = theme === "dark" ? "#020817" : "#fff";
                const radius = 15 * scale;

                entries.forEach((entry, i) => {
                    if (!powerBuffer.current[i]) powerBuffer.current[i] = [];
                    if (powerBuffer.current[i].length >= 500) powerBuffer.current[i].shift();
                    powerBuffer.current[i].push(entry.value);
                });

                const totalBarsWidth = entries.reduce((sum, e) => sum + unitBarWidth * e.scale, 0) + (slotCount - 1) * barSpace;
                const barsLeftMargin = Math.max(0, (W - totalBarsWidth) / 2);

                // Running left edge — each bar's width is its own animated
                // share, so bars sliding to make room for a growing/shrinking
                // neighbor falls out of this cumulative layout naturally.
                let cursorX = barsLeftMargin;
                const layout = entries.map((entry) => {
                    const barActW = Math.max(unitBarWidth * entry.scale, 0.01);
                    const x0 = cursorX;
                    cursorX += barActW + barSpace;
                    // Snap each bar's edges to whole device pixels,
                    // independently from its own (unrounded) x0/x1 rather
                    // than by accumulating already-rounded widths — so a
                    // persisting bar's edge lands on the same device pixel
                    // every time, instead of anti-aliasing a hair
                    // differently frame to frame off a sub-pixel boundary.
                    const snappedX0 = Math.round(x0 * dpr) / dpr;
                    const snappedX1 = Math.round((x0 + barActW) * dpr) / dpr;
                    return { entry, x0: snappedX0, barActW: snappedX1 - snappedX0 };
                });

                layout.forEach(({ entry, x0, barActW }, i) => {
                    const v = entry.value;
                    const barY = padding;
                    const alpha = entry.scale;

                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = bgColor;
                    ctx.strokeStyle = axisColor;
                    ctx.lineWidth = 1;

                    // Frame: filled here, outlined after the bar so a full
                    // bar can't paint over its border.
                    const framePath = new Path2D();
                    framePath.roundRect(x0, barY, barActW, barAreaH, [radius, radius, 0, 0]);
                    ctx.fill(framePath);

                    const max = Math.max(...(powerBuffer.current[i] || [1]), 1);
                    const bh = (v / max) * barAreaH;
                    const barTopY = barY + (barAreaH - bh);

                    const grad = ctx.createLinearGradient(x0, barY + barAreaH, x0, barY + barAreaH - bh);
                    const one3 = barAreaH / 3;

                    if (bh <= one3) {
                        grad.addColorStop(0, "green");
                        grad.addColorStop(1, "green");
                    } else if (bh <= one3 * 2) {
                        grad.addColorStop(0, "green");
                        grad.addColorStop(one3 / bh, "green");
                        grad.addColorStop(1, "yellow");
                    } else {
                        grad.addColorStop(0, "green");
                        grad.addColorStop(one3 / bh, "green");
                        grad.addColorStop((one3 * 2) / bh, "yellow");
                        grad.addColorStop(1, "red");
                    }

                    // Clip the bar to the frame's rounded shape so a full bar
                    // follows the rounded top corners instead of squaring them off.
                    ctx.save();
                    ctx.clip(framePath);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x0, barTopY, barActW, bh);
                    ctx.restore();

                    ctx.strokeStyle = axisColor;
                    ctx.lineWidth = 1;
                    ctx.stroke(framePath);
                    ctx.globalAlpha = 1;
                });

                // Channel pill, overlaid near the top of each bar rather than
                // reserved in a separate box — the bar keeps rendering in
                // full behind it, this just floats on top (same idea as the
                // "CH1"/"CH2" badges on the raw waveform panel).
                layout.forEach(({ entry, x0, barActW }) => {
                    const barY = padding;
                    const labelText = `CH${entry.channelNumber}`;

                    ctx.globalAlpha = entry.scale;
                    ctx.font = `bold ${pillFontLabel}px Arial`;
                    const textWidth = ctx.measureText(labelText).width;
                    const pillPaddingX = 8 * scale;
                    const pillWidth = Math.min(textWidth + pillPaddingX * 2, barActW - 4 * scale);
                    const pillMarginTop = 14 * scale;
                    const pillX = x0 + barActW / 2 - pillWidth / 2;
                    const pillY = barY + pillMarginTop;

                    ctx.fillStyle = bgColor;
                    ctx.strokeStyle = axisColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = axisColor;
                    ctx.textAlign = "center";
                    fillTextVCentered(ctx, labelText, pillX + pillWidth / 2, pillY + pillHeight / 2);
                    ctx.globalAlpha = 1;
                });

                // Current-value box below each bar — channel identity now
                // lives in the pill above, so this only shows the number.
                layout.forEach(({ entry, x0, barActW }) => {
                    const labelX = x0 + barActW / 2;
                    const labelY = padding + barAreaH + axisGap;

                    ctx.globalAlpha = entry.scale;
                    ctx.fillStyle = bgColor;
                    ctx.strokeStyle = axisColor;

                    ctx.beginPath();
                    ctx.roundRect(labelX - barActW / 2, labelY, barActW, labelBoxH, [0, 0, radius / 2, radius / 2]);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = axisColor;
                    ctx.font = `bold ${fontLabel}px Arial`;
                    ctx.textAlign = "center";
                    fillTextVCentered(ctx, entry.value.toFixed(2), labelX, labelY + labelBoxH / 2);
                    ctx.globalAlpha = 1;
                });
            },
            [theme]
        );

        const animateGraph = useCallback(() => {
            const valueByChannel = new Map<number, number>(
                selectedChannels.map((channelNumber, i) => [channelNumber, bandPowerData[i] ?? 0])
            );

            // Reconcile the bar list against the current selection: a
            // deselected channel's entry is dropped immediately (no
            // animation to wait for), so drawGraph never lays bars out
            // around a leftover zero-width slot that shifts everything
            // after it for a frame.
            const prevEntries = barEntriesRef.current;
            const nextEntries: BarEntry[] = selectedChannels.map((channelNumber) => {
                const existing = prevEntries.find((e) => e.channelNumber === channelNumber);
                return existing ?? { channelNumber, value: 0, scale: 1 };
            });

            nextEntries.forEach((entry) => {
                entry.scale = 1;
                entry.value = valueByChannel.get(entry.channelNumber) ?? 0;
            });

            barEntriesRef.current = nextEntries;
            decorativeCountRef.current = Math.max(selectedChannels.length, 1);

            drawGraph(nextEntries, decorativeCountRef.current);
            latestDataRef.current = nextEntries.map((e) => e.value);
        }, [bandPowerData, selectedChannels, drawGraph]);

        // Kept up to date every render so the loop below always calls the
        // freshest animateGraph. Without this indirection, restarting the
        // rAF chain via a `[animateGraph]`-dependent effect races the old
        // closure's own self-scheduled frame (it keeps firing — with stale
        // selectedChannels/bandPowerData but the already-resized live DOM
        // width — until the effect's cleanup wins the race), which is what
        // made the last bar's edge visibly jump for a frame when a channel
        // was toggled. Starting the loop once and never restarting it
        // removes that race entirely; a resize is already picked up next
        // frame since the loop redraws continuously, so no separate
        // ResizeObserver-driven restart is needed either.
        const animateGraphRef = useRef(animateGraph);
        animateGraphRef.current = animateGraph;

        useEffect(() => {
            let frameId: number;
            const loop = () => {
                animateGraphRef.current();
                frameId = requestAnimationFrame(loop);
            };
            frameId = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(frameId);
        }, []);

        // Buffers the raw samples (and their live-computed envelope) into the
        // currently active snapshot slot, flipping to the next slot once it's
        // full (mirrors the Canvas component's approach).
        const processBufferedData = useCallback((data: number[], envValues: number[]) => {
            const currentSelectedChannels = selectedChannelsRef.current;
            const currentBuffer = rawBufferRef.current[activeBufferIndexRef.current];
            const currentEnvBuffer = envBufferRef.current[activeBufferIndexRef.current];

            currentSelectedChannels.forEach((channelNumber, i) => {
                if (!currentBuffer[i]) currentBuffer[i] = [];
                if (!currentEnvBuffer[i]) currentEnvBuffer[i] = [];
                currentBuffer[i].push(data[channelNumber]);
                currentEnvBuffer[i].push(envValues[i]);
            });

            if (currentBuffer[0] && currentBuffer[0].length >= dataPointCountRef.current) {
                snapShotRef.current[activeBufferIndexRef.current] = true;
                activeBufferIndexRef.current = (activeBufferIndexRef.current + 1) % NUM_SNAPSHOT_BUFFERS;
                snapShotRef.current[activeBufferIndexRef.current] = false;
                rawBufferRef.current[activeBufferIndexRef.current] = currentSelectedChannels.map(() => []);
                envBufferRef.current[activeBufferIndexRef.current] = currentSelectedChannels.map(() => []);
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

                    const currentSelectedChannels = selectedChannelsRef.current;
                    const envValues: number[] = [];

                    currentSelectedChannels.forEach((channelNumber, index) => {
                        const lines = linesRefs.current[index];
                        if (!lines) return;
                        const [line1, line2] = lines;
                        if (!line1 || !line2) return;

                        const rawValue = data[channelNumber];

                        if (sweepPositions.current[index] === undefined) {
                            sweepPositions.current[index] = 0;
                        }
                        const currentPos = sweepPositions.current[index] % line1.numPoints;

                        if (!envelopeFilters.current[index]) {
                            envelopeFilters.current[index] = new EnvelopeFilter(64);
                        }
                        const envValue = envelopeFilters.current[index].getEnvelope(Math.abs(rawValue));
                        envValues[index] = envValue;

                        try {
                            line1.setY(currentPos, rawValue);
                            line2.setY(currentPos, envValue);
                        } catch (error) {
                            console.warn(`Error plotting data for line ${index} at position ${currentPos}:`, error);
                        }

                        const clearPosition = Math.ceil((currentPos + dataPointCountRef.current / 100) % line1.numPoints);
                        try {
                            line1.setY(clearPosition, NaN);
                            line2.setY(clearPosition, NaN);
                        } catch (error) {
                            console.warn(`Error clearing data at position ${clearPosition} for line ${index}:`, error);
                        }

                        sweepPositions.current[index] = (currentPos + 1) % line1.numPoints;
                    });

                    setBandPowerData(envValues);
                    processBufferedData(data, envValues);

                    if (previousCounterRef.current !== null) {
                        const expectedCounter = (previousCounterRef.current + 1) % 256;
                        if (data[0] !== expectedCounter) {
                            console.warn(
                                `Data loss detected in RepForge! Previous counter: ${previousCounterRef.current}, Current counter: ${data[0]}`
                            );
                        }
                    }
                    previousCounterRef.current = data[0];
                },
            }),
            [processBufferedData, pauseRef]
        );

        // The right panel's width scales with how many channels are selected,
        // so every bar keeps the same fixed ("universal") width no matter the
        // count — that width is whatever a single bar gets when all
        // MAX_REPFORGE_CHANNELS are selected (the panel's original 1/3 share,
        // split 6 ways). The left (raw waveform) panel takes up whatever
        // width that leaves, so with 1 channel it's nearly the full width and
        // it shrinks back down as more channels are added.
        const rightPanelWidthPercent = (Math.min(selectedChannels.length, MAX_REPFORGE_CHANNELS) / MAX_REPFORGE_CHANNELS) * (100 / 3);
        const leftPanelWidthPercent = 100 - rightPanelWidthPercent;

        return (
            <div className="flex flex-row flex-1 overflow-auto relative">
                {/* Left Panel: raw EMG + envelope */}
                <main
                    style={{ width: `${leftPanelWidthPercent}%` }}
                    className="m-3 relative flex bg-highlight rounded-2xl"
                >
                    <div
                        ref={canvasContainerRef}
                        className="absolute inset-0 rounded-2xl"
                    />
                </main>

                {/* Right Panel: band power bar chart */}
                <main
                    style={{ width: `${rightPanelWidthPercent}%` }}
                    className="m-3 relative flex overflow-hidden"
                >
                    <div
                        ref={containerRef}
                        className="absolute inset-0 rounded-2xl"
                    >
                        <canvas ref={canvasRef} className="w-full h-full" />
                    </div>
                </main>
            </div>
        );
    }
);

RepForge.displayName = "RepForge";
export default RepForge;
