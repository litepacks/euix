import type { TestScenario } from "../ir/types.js";

export function createSeededRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

export function fuzzBoundaryValues(condition: string): (number | string)[] {
    const ge = condition.match(/(\w+)\s*>=\s*(\d+)/);
    if (ge) {
        const n = Number(ge[2]);
        return [n - 1, n, n + 1];
    }
    const gt = condition.match(/(\w+)\s*>\s*(\d+)/);
    if (gt) {
        const n = Number(gt[2]);
        return [n - 1, n, n + 1];
    }
    return [0, 1, -1, 17, 18, 19];
}

export function generateFuzzScenarios(
    baseScenarios: TestScenario[],
    seed = Date.now(),
): TestScenario[] {
    const rng = createSeededRng(seed);
    const fuzzed: TestScenario[] = [];

    for (const base of baseScenarios.filter((s) => s.kind === "flow")) {
        for (let i = 0; i < 3; i++) {
            fuzzed.push({
                ...base,
                id: `${base.id}:fuzz:${i}`,
                name: `${base.name} [fuzz ${i}]`,
                kind: "fuzz",
                seed,
                steps: [
                    ...base.steps,
                    { kind: "assert", payload: { fuzzIteration: i, rand: rng() } },
                ],
            });
        }
    }

    return fuzzed;
}

export function shrinkFailure(input: Record<string, unknown>): Record<string, unknown> {
    const keys = Object.keys(input);
    if (keys.length <= 1) return input;
    const minimal: Record<string, unknown> = {};
    for (const key of keys.slice(0, Math.min(2, keys.length))) {
        minimal[key] = input[key];
    }
    return minimal;
}
