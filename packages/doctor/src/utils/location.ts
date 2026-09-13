import type { SourceLocation } from "../ir/types.js";

export function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
    const slice = source.slice(0, Math.max(0, offset));
    const lines = slice.split("\n");
    return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function makeLocation(
    file: string,
    source: string,
    start: number,
    end: number,
): SourceLocation {
    const { line, column } = offsetToLineColumn(source, start);
    return { file, start, end, line, column };
}

export function id(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.filter(Boolean).join(":")}`;
}
