import fs from "node:fs";
import path from "node:path";
import { runDoctor } from "../doctor.js";
import type { DoctorOptions } from "../ir/types.js";
import { buildProject } from "../ir/project.js";
import { buildDependencyEdges } from "../analysis/dependencies.js";
import { runDiagnostics } from "../diagnostics/index.js";
import { applyFixes } from "../fixes/index.js";
import { applyBaseline, loadBaseline, saveBaseline } from "../reporters/baseline.js";
import { diffAgainstBaseline, printBaselineDiff } from "../reporters/baselineDiff.js";
import { doctorResultToJson } from "../reporters/json.js";
import { doctorResultToSarif } from "../reporters/sarif.js";
import { printDoctorReport, printInspectReport } from "../reporters/terminal.js";

function printHelp(): void {
    console.log(`
EUIX Doctor

Usage:
  euix doctor [path] [options]
  euix doctor inspect <file>

Options:
  --test           Run generated safe test scenarios
  --flows          Show behavior flows
  --graph          Show behavior graph
  --memory         Collect memory signals during tests
  --fuzz           Enable semantic fuzzing (requires --test)
  --json           JSON output
  --sarif          SARIF 2.1.0 output (CI / GitHub Code Scanning)
  --baseline=FILE  Suppress known diagnostics listed in baseline file
  --update-baseline  Write current diagnostics to baseline file (with --baseline)
  --fix            Apply auto-fixes (EUIX0001, EUIX1110/EUIX1102, EUIX1701)
  --fix=RULE       Apply auto-fixes for a single rule (e.g. --fix=EUIX1701)
  --dry-run        Preview --fix edits without writing files
  --watch          Re-run analysis when files change (no test scenarios)
  --baseline-diff  Show fixed/new diagnostics vs --baseline file
  --seed=<n>       Fuzz seed
  --repeat=<n>     Memory repeat count
  -h, --help       Show help

Examples:
  euix doctor
  euix doctor apps/playground/components
  euix doctor --test --graph
  euix doctor inspect fixtures/simple-component.xml
`);
}

export function parseDoctorArgs(argv: string[], cwd = process.cwd()): DoctorOptions | { inspect?: string; help?: boolean } {
    const args = [...argv];
    if (args.includes("-h") || args.includes("--help")) return { help: true };

    const inspectIdx = args.indexOf("inspect");
    if (inspectIdx !== -1) {
        const target = args[inspectIdx + 1];
        if (!target) throw new Error("inspect requires a file path");
        return { inspect: target, root: cwd } as DoctorOptions & { inspect: string };
    }

    const positional = args.filter((a) => !a.startsWith("-") && a !== "doctor");
    const target = positional[0] && positional[0] !== "." ? positional[0] : undefined;

    const seedArg = args.find((a) => a.startsWith("--seed="));
    const repeatArg = args.find((a) => a.startsWith("--repeat="));
    const baselineArg = args.find((a) => a.startsWith("--baseline="));
    const fixArg = args.find((a) => a.startsWith("--fix="));
    const fixEnabled = args.includes("--fix") || Boolean(fixArg);

    return {
        root: cwd,
        target,
        json: args.includes("--json"),
        sarif: args.includes("--sarif"),
        test: args.includes("--test"),
        flows: args.includes("--flows"),
        graph: args.includes("--graph"),
        memory: args.includes("--memory"),
        fuzz: args.includes("--fuzz"),
        seed: seedArg ? Number(seedArg.split("=")[1]) : undefined,
        repeat: repeatArg ? Number(repeatArg.split("=")[1]) : undefined,
        baseline: baselineArg ? baselineArg.split("=")[1] : undefined,
        updateBaseline: args.includes("--update-baseline"),
        fix: fixEnabled ? (fixArg ? fixArg.split("=")[1] : true) : undefined,
        dryRun: args.includes("--dry-run"),
        watch: args.includes("--watch"),
        baselineDiff: args.includes("--baseline-diff"),
    };
}

export async function runDoctorCli(argv: string[], cwd = process.cwd()): Promise<number> {
    try {
        const parsed = parseDoctorArgs(argv, cwd);
        if ("help" in parsed && parsed.help) {
            printHelp();
            return 0;
        }

        if ("inspect" in parsed && parsed.inspect) {
            const abs = path.resolve(cwd, parsed.inspect);
            const project = await buildProject(cwd, abs);
            buildDependencyEdges(project);
            runDiagnostics(project);
            const name = path.basename(abs, path.extname(abs));
            printInspectReport(project, [...project.components.values()][0]?.name ?? name);
            return 0;
        }

        const options = parsed as DoctorOptions;

        if (options.watch) {
            await runWatchLoop(options, cwd);
            return 0;
        }

        const defaultAnalyze = !options.test && !options.graph && !options.flows && !options.fuzz && !options.fix;
        if (defaultAnalyze) {
            options.flows = true;
        }

        if (options.fix) {
            const project = await buildProject(options.root, options.target);
            buildDependencyEdges(project);
            runDiagnostics(project);

            const rules = typeof options.fix === "string" ? [options.fix] : undefined;
            const fixResult = applyFixes(project, { rules, dryRun: options.dryRun });

            if (options.dryRun) {
                console.log(`Dry run: ${fixResult.fixesApplied} fix(es) in ${fixResult.filesChanged} file(s)\n`);
                for (const fix of fixResult.fixes) {
                    console.log(`  ${fix.rule}  ${path.relative(options.root, fix.file)}  ${fix.description}`);
                }
                return 0;
            }

            if (fixResult.fixesApplied > 0) {
                console.log(`Applied ${fixResult.fixesApplied} fix(es) in ${fixResult.filesChanged} file(s)\n`);
                for (const fix of fixResult.fixes) {
                    console.log(`  ${fix.rule}  ${path.relative(options.root, fix.file)}  ${fix.description}`);
                }
                console.log("");
            } else {
                console.log("No auto-fixes available.\n");
            }
        }

        const result = await runDoctor({
            ...options,
            test: options.test || defaultAnalyze,
        });

        const baselinePath = options.baseline ? path.resolve(cwd, options.baseline) : undefined;
        if (options.updateBaseline && baselinePath) {
            saveBaseline(baselinePath, result.project.diagnostics, cwd);
            console.log(`Baseline updated: ${baselinePath} (${result.project.diagnostics.length} entries)`);
            return 0;
        }

        let suppressed = 0;
        const baselineEntries = baselinePath && fs.existsSync(baselinePath) ? loadBaseline(baselinePath) : [];
        if (options.baselineDiff && baselineEntries.length > 0) {
            printBaselineDiff(diffAgainstBaseline(result.project.diagnostics, baselineEntries, cwd), cwd);
        }

        if (baselinePath && baselineEntries.length > 0) {
            const filtered = applyBaseline(result.project.diagnostics, baselineEntries, cwd);
            result.project.diagnostics = filtered.visible;
            suppressed = filtered.suppressed;
        }

        if (options.sarif) {
            console.log(doctorResultToSarif(result));
        } else if (options.json) {
            console.log(doctorResultToJson(result));
        } else {
            printDoctorReport(result, options, suppressed);
        }

        const errors = result.project.diagnostics.filter((d) => d.severity === "error").length;
        const failed = result.testResults.filter((r) => !r.passed).length;
        return errors > 0 || failed > 0 ? 1 : 0;
    } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        return 1;
    }
}

async function runWatchLoop(options: DoctorOptions, cwd: string): Promise<void> {
    const watchTarget = options.target ? path.resolve(cwd, options.target) : cwd;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    const analyzeOnce = async () => {
        if (running) return;
        running = true;
        try {
            const project = await buildProject(options.root, options.target);
            buildDependencyEdges(project);
            runDiagnostics(project);
            const errors = project.diagnostics.filter((d) => d.severity === "error").length;
            const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;
            const stamp = new Date().toLocaleTimeString();
            console.log(`[${stamp}] EUIX Doctor — ${errors} error(s), ${warnings} warning(s)`);
            for (const diagnostic of project.diagnostics.filter((d) => d.severity === "error").slice(0, 10)) {
                console.log(
                    `  ${path.relative(cwd, diagnostic.file)}:${diagnostic.line} ${diagnostic.rule} ${diagnostic.message}`,
                );
            }
        } finally {
            running = false;
        }
    };

    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void analyzeOnce(), 300);
    };

    console.log(`Watching ${watchTarget} …`);
    await analyzeOnce();
    fs.watch(watchTarget, { recursive: true }, schedule);

    await new Promise<void>(() => {
        process.on("SIGINT", () => process.exit(0));
    });
}
