import fs from "node:fs";
import path from "node:path";
import type { Diagnostic, DiagnosticSeverity } from "../ir/types.js";

export type RuleLevel = DiagnosticSeverity | "off";

export interface DoctorConfig {
    rules?: Record<string, RuleLevel>;
    ignore?: string[];
}

const CONFIG_NAMES = ["euix.doctor.json", ".euix-doctor.json"];

export function loadDoctorConfig(root: string): DoctorConfig {
    for (const name of CONFIG_NAMES) {
        const file = path.join(root, name);
        if (!fs.existsSync(file)) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DoctorConfig;
            return parsed ?? {};
        } catch {
            return {};
        }
    }
    return {};
}

/** Inline suppressions: <!-- euix-ignore: EUIX1701 --> or <!-- euix-ignore-next-line EUIX1701 --> */
export function collectFileSuppressions(source: string): Map<number, Set<string>> {
    const byLine = new Map<number, Set<string>>();
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const match = line.match(/<!--\s*euix-ignore(?:-next-line)?(?::|\s+)([^-]+)-->/i);
        if (!match) continue;

        const rules = match[1]!
            .split(/[,;\s]+/)
            .map((r) => r.trim())
            .filter(Boolean);

        const targetLine = /euix-ignore-next-line/i.test(line) ? i + 2 : i + 1;
        const set = byLine.get(targetLine) ?? new Set<string>();
        for (const rule of rules) set.add(rule);
        byLine.set(targetLine, set);
    }

    return byLine;
}

export function applyDoctorConfig(
    diagnostics: Diagnostic[],
    config: DoctorConfig,
    fileSources: Map<string, string>,
): Diagnostic[] {
    let filtered = diagnostics;

    if (config.ignore?.length) {
        const patterns = config.ignore.map(globToRegExp);
        filtered = filtered.filter((d) => !patterns.some((re) => re.test(d.file)));
    }

    if (config.rules && Object.keys(config.rules).length > 0) {
        filtered = filtered
            .map((d) => applyRuleLevel(d, config.rules![d.rule]))
            .filter((d): d is Diagnostic => d !== null);
    }

    filtered = filtered.filter((d) => {
        const suppressions = collectFileSuppressions(fileSources.get(d.file) ?? "");
        const lineRules = suppressions.get(d.line);
        if (!lineRules) return true;
        if (lineRules.has(d.rule) || lineRules.has("*")) return false;
        return true;
    });

    return filtered;
}

function applyRuleLevel(diagnostic: Diagnostic, level: RuleLevel | undefined): Diagnostic | null {
    if (!level) return diagnostic;
    if (level === "off") return null;
    if (level === diagnostic.severity) return diagnostic;
    return { ...diagnostic, severity: level };
}

function globToRegExp(glob: string): RegExp {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "§§").replace(/\*/g, "[^/]*").replace(/§§/g, ".*");
    return new RegExp(`^${escaped}$|/${escaped}$`);
}
