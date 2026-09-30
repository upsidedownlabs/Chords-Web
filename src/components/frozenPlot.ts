import type { WebglLine } from "webgl-plot";

/**
 * Pausing freezes exactly what is on screen. The visualizers copy their line
 * data when paused (snapshot 0 = this frozen view), replay buffered windows
 * only when the user steps back, and put the frozen view back on resume so
 * the sweep carries on where it stopped instead of the plot being redrawn.
 */
export type FrozenLines = Float32Array[];

export function captureLines(lines: (WebglLine | undefined)[]): FrozenLines {
    return lines.map((line) => (line ? new Float32Array(line.xy) : new Float32Array()));
}

/** Copies the frozen data back; false if the lines were rebuilt with another size. */
export function restoreLines(lines: (WebglLine | undefined)[], frozen: FrozenLines): boolean {
    if (lines.length !== frozen.length) return false;
    if (lines.some((line, i) => !line || line.xy.length !== frozen[i].length)) return false;
    lines.forEach((line, i) => line!.xy.set(frozen[i]));
    return true;
}
