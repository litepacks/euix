import path from "node:path";
import { runDoctor } from "../doctor.js";
import type { DoctorOptions } from "../ir/types.js";
import { buildProject } from "../ir/project.js";
import { buildDependencyEdges } from "../analysis/dependencies.js";
import { runDiagnostics } from "../diagnostics/index.js";
import { doctorResultToJson } from "../reporters/json.js";
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

    return {
        root: cwd,
        target,
        json: args.includes("--json"),
        test: args.includes("--test"),
        flows: args.includes("--flows"),
        graph: args.includes("--graph"),
        memory: args.includes("--memory"),
        fuzz: args.includes("--fuzz"),
        seed: seedArg ? Number(seedArg.split("=")[1]) : undefined,
        repeat: repeatArg ? Number(repeatArg.split("=")[1]) : undefined,
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
        const defaultAnalyze = !options.test && !options.graph && !options.flows && !options.fuzz;
        if (defaultAnalyze) {
            options.flows = true;
        }

        const result = await runDoctor({
            ...options,
            test: options.test || defaultAnalyze,
        });

        if (options.json) {
            console.log(doctorResultToJson(result));
        } else {
            printDoctorReport(result, options);
            if (options.graph) {
                /* graph already in report when flows/graph */
            }
        }

        const errors = result.project.diagnostics.filter((d) => d.severity === "error").length;
        const failed = result.testResults.filter((r) => !r.passed).length;
        return errors > 0 || failed > 0 ? 1 : 0;
    } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        return 1;
    }
}
