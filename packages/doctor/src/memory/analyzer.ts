import type { ActionInfo, MemoryReport } from "../ir/types.js";

const ALLOCATION_SIGNALS = [
    "Array.from",
    ".map(",
    ".filter(",
    "structuredClone",
    "JSON.parse",
    "JSON.stringify",
    "Buffer",
    "TypedArray",
];

export function staticMemorySignals(action: ActionInfo): number {
    let score = 0;
    for (const signal of ALLOCATION_SIGNALS) {
        if (action.body.includes(signal)) score++;
    }
    return score;
}

export function sampleMemory(): NodeJS.MemoryUsage {
    return process.memoryUsage();
}

export function buildMemoryReport(
    highPressurePaths: number,
    repeat = 1,
): MemoryReport {
    const before = sampleMemory();
    const arr: number[] = [];
    for (let i = 0; i < repeat * 1000; i++) arr.push(i);
    void arr.length;
    const gc = (globalThis as { gc?: () => void }).gc;
    if (gc) gc();
    const after = sampleMemory();
    const peakDelta = Math.max(0, after.heapUsed - before.heapUsed);
    const postGcDelta = gc ? after.heapUsed - before.heapUsed : null;

    return {
        peakDeltaBytes: peakDelta,
        postGcDeltaBytes: postGcDelta,
        classification:
            peakDelta > 10_000_000
                ? "high temporary memory pressure"
                : peakDelta > 1_000_000
                  ? "moderate memory pressure"
                  : "low memory pressure",
        highPressurePaths,
        retentionCandidates: postGcDelta != null && postGcDelta > 500_000 ? 1 : 0,
    };
}
