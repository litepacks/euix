#!/usr/bin/env node

/**
 * bin/euix.js
 * Command Line Interface (CLI) for EUIX Engine.
 * Supports XSD / JSON Schema generation, TypeScript type generation (.d.ts), and AST compilation.
 */

import fs from "fs";
import path from "path";

// Polyfill DOMParser and document for Node.js CLI execution on XML files
if (typeof globalThis.DOMParser === "undefined") {
    try {
        const { JSDOM } = await import("jsdom");
        const dom = new JSDOM("");
        globalThis.DOMParser = dom.window.DOMParser;
        globalThis.document = dom.window.document;
    } catch (_) {}
}

import { generateXSDSchema, generateJsonSchema, generateComponentTypes, compileXmlToJs } from "../src/compiler/index.js";
import {
    prepare,
    inspect,
    validateSource,
    generateLlmContext,
    convert,
    fixSource,
    generateSourceSchema,
    renderToString,
    updateSnapshotFile,
    verifySnapshotFile,
} from "../src/prepare/index.js";

const args = process.argv.slice(2);

function printHelp() {
    console.log(`
  🚀 EUIX Engine CLI

  Usage:
    euix <command> [options]

  Commands:
    check <path> [--fix]     Validate EUIX source files (use --fix to auto-resolve typos)
    fix <path> [--dry-run]   Auto-fix typos, invalid routes, and diagnostics in source files
    prepare <file> [opts]    Prepare EUIX source and emit normalized Runtime IR
    inspect <file>           Inspect resolved imports, states, actions, routes, components
    context <path> [opts]    Generate compact project context for LLM prompt injection
    convert <file> [opts]    Convert between EUIX XML (<uid_spec>) and Canonical JSON
    doctor [path] [opts]     Analyze EUIX project semantics, flows, and generated tests
    render <file> [opts]     Server-Side Render (SSR) template/IR to HTML string
    snapshot <file> [opts]   Verify or update Runtime IR regression snapshots (-u to update)
    schema [opts]            Generate IDE JSON Schema for EUIX Source JSON (use --vscode to configure IDE)
    schema:xsd               Generate official XML Schema Definition (uid_spec.xsd)
    schema:json              Generate JSON Schema validator (uid_spec.schema.json)
    typegen <file.xml>       Generate TypeScript declaration (.d.ts) from XML template
    compile <file.xml>       Pre-compile XML template to JavaScript module
    help                     Display help information

  Options:
    -o, --output <file>      Output file path (default: stdout)
    -h, --help               Display help information
    -v, --version            Display version number

  Examples:
    npx euix schema:xsd -o ./schema/uid_spec.xsd
    npx euix schema:json -o ./schema/uid_spec.schema.json
    npx euix typegen ./src/components/Dashboard.xml -o ./src/types/Dashboard.d.ts
    npx euix compile ./src/App.xml -o ./src/App.compiled.js
`);
}

function getArgValue(flagShort, flagLong) {
    const idxShort = args.indexOf(flagShort);
    if (idxShort !== -1 && args[idxShort + 1]) return args[idxShort + 1];
    const idxLong = args.indexOf(flagLong);
    if (idxLong !== -1 && args[idxLong + 1]) return args[idxLong + 1];
    return null;
}

async function main() {
    if (args.length === 0 || args.includes("--help") || args.includes("-h") || args[0] === "help") {
        printHelp();
        process.exit(0);
    }

    if (args.includes("--version") || args.includes("-v")) {
        const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        console.log(`v${pkg.version}`);
        process.exit(0);
    }

    const command = args[0];
    const outputFile = getArgValue("-o", "--output");

    switch (command) {
        case "fix":
        case "check": {
            const isFixMode = command === "fix" || args.includes("--fix");
            const isDryRun = args.includes("--dry-run");
            const targetPath = args.find((a, idx) => idx > 0 && !a.startsWith("-")) || "./";
            const absPath = path.resolve(targetPath);
            const files = [];

            if (fs.existsSync(absPath)) {
                const stat = fs.statSync(absPath);
                if (stat.isDirectory()) {
                    function scanDir(dir) {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
                            const full = path.join(dir, entry.name);
                            if (entry.isDirectory()) scanDir(full);
                            else if (/\.(euix|xml|euix\.json)$/i.test(entry.name)) files.push(full);
                        }
                    }
                    scanDir(absPath);
                } else {
                    files.push(absPath);
                }
            } else {
                console.error(`❌ Path does not exist: ${targetPath}`);
                process.exit(1);
            }

            let totalErrors = 0;
            let totalFixes = 0;

            for (const file of files) {
                let content = fs.readFileSync(file, "utf8");
                const relFile = path.relative(process.cwd(), file);

                if (isFixMode) {
                    const fixResult = await fixSource(content, { currentFile: relFile });
                    if (fixResult.modified && fixResult.fixesApplied.length > 0) {
                        totalFixes += fixResult.fixesApplied.length;
                        if (isDryRun) {
                            console.log(`\n🔍 [DRY-RUN] Would apply ${fixResult.fixesApplied.length} fix(es) in ${relFile}:`);
                        } else {
                            const formatted = typeof fixResult.fixedSource === "string"
                                ? fixResult.fixedSource
                                : JSON.stringify(fixResult.fixedSource, null, 2);
                            fs.writeFileSync(file, formatted, "utf8");
                            console.log(`\n🛠️  Applied ${fixResult.fixesApplied.length} fix(es) in ${relFile}:`);
                            content = fs.readFileSync(file, "utf8");
                        }
                        for (const fix of fixResult.fixesApplied) {
                            console.log(`  ✔ ${fix.message}`);
                        }
                    }
                }

                const diags = await validateSource(content, { currentFile: relFile });
                const errors = diags.filter((d) => d.severity === "error");
                if (errors.length > 0) {
                    totalErrors += errors.length;
                    console.error(`\n❌ Validation errors in ${relFile}:`);
                    for (const err of errors) {
                        console.error(`  [${err.code}] ${err.type}: ${err.message} (${err.path || "root"})`);
                        if (err.suggestion) {
                            console.error(`  💡 Suggestion: Did you mean "${err.suggestion}"?`);
                        }
                    }
                }
            }

            if (isFixMode && totalFixes > 0 && !isDryRun) {
                console.log(`\n🎉 Successfully fixed ${totalFixes} issue(s) across files.`);
            }

            if (isFixMode && isDryRun) {
                console.log(`\n🔍 [DRY-RUN] Preview complete: ${totalFixes} issue(s) would be fixed.`);
                process.exit(0);
            }

            if (totalErrors > 0) {
                console.error(`\n❌ Found ${totalErrors} error(s) across ${files.length} file(s).`);
                process.exit(1);
            } else {
                console.log(`✨ Checked ${files.length} file(s) - 0 errors found.`);
                process.exit(0);
            }
            break;
        }

        case "prepare": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input file required for prepare command.");
                console.error("Usage: euix prepare <file.euix|file.json> [--json] [-o output.json]");
                process.exit(1);
            }

            const absInput = path.resolve(inputFile);
            if (!fs.existsSync(absInput)) {
                console.error(`❌ Input file does not exist: ${inputFile}`);
                process.exit(1);
            }

            const content = fs.readFileSync(absInput, "utf8");
            const relFile = path.relative(process.cwd(), absInput);
            const isJsonOutput = args.includes("--json");

            const app = await prepare(content, { currentFile: relFile });
            const errors = app.diagnostics.filter((d) => d.severity === "error");
            if (errors.length > 0) {
                console.error(`❌ Prepare failed with ${errors.length} error(s):`);
                for (const err of errors) {
                    console.error(`  [${err.code}] ${err.type}: ${err.message} (${err.path || "root"})`);
                    if (err.suggestion) console.error(`  💡 Suggestion: Did you mean "${err.suggestion}"?`);
                }
                process.exit(1);
            }

            const irJson = JSON.stringify(app.toJSON(), null, 2);

            if (outputFile) {
                const outDir = path.dirname(path.resolve(outputFile));
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.resolve(outputFile), irJson, "utf8");
                console.log(`✨ Generated Runtime IR at: ${outputFile}`);
            } else if (isJsonOutput) {
                process.stdout.write(irJson + "\n");
            } else {
                console.log(`✨ Successfully prepared "${inputFile}" (IR v${app.ir.irVersion})`);
                console.log(`  - States: ${app.ir.states.length}`);
                console.log(`  - Actions: ${app.ir.actions.length}`);
                console.log(`  - Components: ${app.ir.components.length}`);
                console.log(`  - Route: ${app.ir.route ? app.ir.route.path : "none"}`);
            }
            break;
        }

        case "inspect": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input file required for inspect command.");
                console.error("Usage: euix inspect <file.euix|file.json>");
                process.exit(1);
            }

            const absInput = path.resolve(inputFile);
            if (!fs.existsSync(absInput)) {
                console.error(`❌ Input file does not exist: ${inputFile}`);
                process.exit(1);
            }

            const content = fs.readFileSync(absInput, "utf8");
            const relFile = path.relative(process.cwd(), absInput);
            const inspected = await inspect(content, { currentFile: relFile });

            console.log(`\n🔍 Inspection Report for: ${relFile}\n`);
            console.log(`  Route: ${inspected.route ? inspected.route.path : "None"}`);
            console.log(`  Imports (${Object.keys(inspected.imports).length}):`);
            for (const [k, v] of Object.entries(inspected.imports)) {
                console.log(`    - ${k} -> ${v}`);
            }
            console.log(`  States (${inspected.states.length}): ${inspected.states.join(", ") || "None"}`);
            console.log(`  Computed (${inspected.computed.length}): ${inspected.computed.join(", ") || "None"}`);
            console.log(`  Props (${inspected.props.length}): ${inspected.props.join(", ") || "None"}`);
            console.log(`  Actions (${inspected.actions.length}): ${inspected.actions.join(", ") || "None"}`);
            console.log(`  Components (${inspected.components.length}): ${inspected.components.join(", ") || "None"}`);
            console.log(`  Bindings (${inspected.bindings ? inspected.bindings.length : 0}):`);
            if (inspected.bindings && inspected.bindings.length > 0) {
                for (const b of inspected.bindings) {
                    console.log(`    - [${b.type}] ${b.path} -> ${b.target}`);
                }
            }
            if (inspected.diagnostics && inspected.diagnostics.length > 0) {
                console.log(`  Diagnostics (${inspected.diagnostics.length}):`);
                for (const d of inspected.diagnostics) {
                    console.log(`    [${d.code}] ${d.message}`);
                }
            }
            console.log("");
            break;
        }

        case "context": {
            const targetPath = args[1] && !args[1].startsWith("-") ? args[1] : ".";
            const asJson = args.includes("--json");
            const result = await generateLlmContext(targetPath, {
                baseDir: process.cwd(),
                format: asJson ? "json" : "markdown",
            });

            const outputContent = asJson ? JSON.stringify(result.data, null, 2) : result.text;
            if (outputFile) {
                const absOut = path.resolve(process.cwd(), outputFile);
                const outDir = path.dirname(absOut);
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }
                fs.writeFileSync(absOut, outputContent, "utf8");
                console.log(`✨ Generated LLM context written to: ${outputFile}`);
            } else {
                console.log(outputContent);
            }
            break;
        }

        case "convert": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input file required for convert command.");
                console.error("Usage: euix convert <file.euix|file.json> [-o output] [--format xml|json]");
                process.exit(1);
            }

            const absInput = path.resolve(process.cwd(), inputFile);
            if (!fs.existsSync(absInput)) {
                console.error(`❌ Error: Input file does not exist: ${inputFile}`);
                process.exit(1);
            }

            const content = fs.readFileSync(absInput, "utf8");
            const formatIdx = args.indexOf("--format");
            const explicitFormat = formatIdx !== -1 && args[formatIdx + 1] ? args[formatIdx + 1] : "auto";

            try {
                const converted = convert(content, {
                    fileName: path.basename(inputFile),
                    targetFormat: explicitFormat,
                });

                if (outputFile) {
                    const absOut = path.resolve(process.cwd(), outputFile);
                    const outDir = path.dirname(absOut);
                    if (!fs.existsSync(outDir)) {
                        fs.mkdirSync(outDir, { recursive: true });
                    }
                    fs.writeFileSync(absOut, converted, "utf8");
                    console.log(`✨ Converted output written to: ${outputFile}`);
                } else {
                    console.log(converted);
                }
            } catch (err) {
                console.error(`❌ Conversion failed: ${err.message}`);
                process.exit(1);
            }
            break;
        }

        case "schema": {
            const isVsCode = args.includes("--vscode");
            const schemaObj = generateSourceSchema();
            const json = JSON.stringify(schemaObj, null, 2);

            let outTarget = outputFile;
            if (isVsCode && !outTarget) {
                outTarget = ".vscode/euix.schema.json";
            }

            if (outTarget) {
                const absOut = path.resolve(process.cwd(), outTarget);
                const outDir = path.dirname(absOut);
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(absOut, json, "utf8");
                console.log(`✨ Generated EUIX JSON Schema at: ${outTarget}`);

                if (isVsCode) {
                    const vscodeDir = path.resolve(process.cwd(), ".vscode");
                    if (!fs.existsSync(vscodeDir)) fs.mkdirSync(vscodeDir, { recursive: true });
                    const settingsPath = path.join(vscodeDir, "settings.json");
                    let settings = {};
                    if (fs.existsSync(settingsPath)) {
                        try {
                            settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
                        } catch (_) {
                            settings = {};
                        }
                    }

                    if (!Array.isArray(settings["json.schemas"])) {
                        settings["json.schemas"] = [];
                    }

                    const relUrl = path.relative(vscodeDir, absOut).replace(/\\/g, "/");
                    const schemaEntry = {
                        fileMatch: ["*.euix.json", "*.euix"],
                        url: relUrl.startsWith(".") ? relUrl : `./${relUrl}`,
                    };

                    const existingIdx = settings["json.schemas"].findIndex(
                        (s) => Array.isArray(s.fileMatch) && s.fileMatch.includes("*.euix.json"),
                    );
                    if (existingIdx >= 0) {
                        settings["json.schemas"][existingIdx] = schemaEntry;
                    } else {
                        settings["json.schemas"].push(schemaEntry);
                    }

                    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
                    console.log(`✨ Configured VS Code / Cursor settings at: .vscode/settings.json`);
                }
            } else {
                process.stdout.write(json);
            }
            break;
        }

        case "render":
        case "ssr": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input file required for render/ssr command.");
                console.error("Usage: euix render <file.euix.json|file.xml> [--data '{\"key\":\"val\"}'] [-o output.html]");
                process.exit(1);
            }

            const absInput = path.resolve(inputFile);
            if (!fs.existsSync(absInput)) {
                console.error(`❌ Input file does not exist: ${inputFile}`);
                process.exit(1);
            }

            const content = fs.readFileSync(absInput, "utf8");
            let initialData = {};
            const dataArg = getArgValue("--data", "-d");
            if (dataArg) {
                try {
                    initialData = JSON.parse(dataArg);
                } catch (err) {
                    console.error(`❌ Invalid JSON data passed to --data: ${err.message}`);
                    process.exit(1);
                }
            }

            try {
                let html = "";
                if (inputFile.endsWith(".json")) {
                    const parsed = JSON.parse(content);
                    const preparedApp = await prepare(parsed, { currentFile: path.basename(inputFile) });
                    html = preparedApp.renderToString(initialData);
                } else {
                    html = renderToString(content, initialData);
                }

                if (outputFile) {
                    const absOut = path.resolve(process.cwd(), outputFile);
                    const outDir = path.dirname(absOut);
                    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                    fs.writeFileSync(absOut, html, "utf8");
                    console.log(`✨ Server-rendered HTML written to: ${outputFile}`);
                } else {
                    process.stdout.write(html);
                }
            } catch (err) {
                console.error(`❌ SSR render failed: ${err.message}`);
                process.exit(1);
            }
            break;
        }

        case "snapshot":
        case "snap": {
            const isUpdate = args.includes("--update") || args.includes("-u");
            const isJson = args.includes("--json");
            const customOut = getArgValue("-o", "--output");
            const targetPath = args.find((a, idx) => idx > 0 && !a.startsWith("-")) || null;

            if (!targetPath) {
                console.error("❌ Error: Target file or directory path required for snapshot command.");
                console.error("Usage: euix snapshot <file.xml|file.euix.json|dir> [--update] [--check] [-o output]");
                process.exit(1);
            }

            const absTarget = path.resolve(targetPath);
            if (!fs.existsSync(absTarget)) {
                console.error(`❌ Target does not exist: ${targetPath}`);
                process.exit(1);
            }

            const files = [];
            const stat = fs.statSync(absTarget);
            if (stat.isDirectory()) {
                function scan(dir) {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
                        const full = path.join(dir, entry.name);
                        if (entry.isDirectory()) scan(full);
                        else if (/\.(euix|xml|euix\.json)$/i.test(entry.name)) files.push(full);
                    }
                }
                scan(absTarget);
            } else {
                files.push(absTarget);
            }

            if (files.length === 0) {
                console.error(`⚠️ No EUIX source files found at: ${targetPath}`);
                process.exit(1);
            }

            let failures = 0;
            const results = [];

            for (const file of files) {
                const relFile = path.relative(process.cwd(), file).replace(/\\/g, "/");
                try {
                    if (isUpdate) {
                        const res = await updateSnapshotFile(file, { output: customOut });
                        const relSnap = path.relative(process.cwd(), res.snapshotPath).replace(/\\/g, "/");
                        results.push({ file: relFile, snapshotPath: relSnap, updated: true });
                        if (!isJson) {
                            console.log(`📸 Snapshot ${res.created ? "created" : "updated"} for ${relFile} -> ${relSnap}`);
                        }
                    } else {
                        const res = await verifySnapshotFile(file, { output: customOut });
                        const relSnap = path.relative(process.cwd(), res.snapshotPath).replace(/\\/g, "/");
                        results.push({ file: relFile, snapshotPath: relSnap, match: res.match, diffs: res.diffs });
                        if (!res.exists) {
                            failures++;
                            if (!isJson) {
                                console.error(`⚠️ Missing snapshot for ${relFile} (expected at ${relSnap}).`);
                                console.error(`   Run "euix snapshot ${relFile} --update" to generate it.`);
                            }
                        } else if (!res.match) {
                            failures++;
                            if (!isJson) {
                                console.error(`❌ Snapshot mismatch for ${relFile}: ${res.diffs.length} structural difference(s) detected:`);
                                for (const d of res.diffs) {
                                    console.error(`   - [${d.path}] ${d.message}`);
                                }
                            }
                        } else {
                            if (!isJson) {
                                console.log(`✔ Snapshot matches for ${relFile} (hash: ${res.actualHash})`);
                            }
                        }
                    }
                } catch (err) {
                    failures++;
                    results.push({ file: relFile, error: err.message });
                    if (!isJson) {
                        console.error(`❌ Failed processing ${relFile}: ${err.message}`);
                    }
                }
            }

            if (isJson) {
                console.log(JSON.stringify({ success: failures === 0, failures, results }, null, 2));
            }

            if (failures > 0) {
                process.exit(1);
            }
            break;
        }

        case "schema:xsd":
        case "xsd": {
            const xsd = generateXSDSchema();
            if (outputFile) {
                const outDir = path.dirname(path.resolve(outputFile));
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.resolve(outputFile), xsd, "utf8");
                console.log(`✨ Generated XSD schema at: ${outputFile}`);
            } else {
                process.stdout.write(xsd);
            }
            break;
        }

        case "schema:json":
        case "json-schema": {
            const json = JSON.stringify(generateJsonSchema(), null, 2);
            if (outputFile) {
                const outDir = path.dirname(path.resolve(outputFile));
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                fs.writeFileSync(path.resolve(outputFile), json, "utf8");
                console.log(`✨ Generated JSON schema at: ${outputFile}`);
            } else {
                process.stdout.write(json);
            }
            break;
        }

        case "typegen":
        case "types": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input XML file path required for typegen command.");
                console.error("Usage: euix typegen <file.xml> [-o output.d.ts]");
                process.exit(1);
            }

            const xmlContent = fs.readFileSync(path.resolve(inputFile), "utf8");
            const componentName = path.basename(inputFile, path.extname(inputFile));
            const tsTypes = generateComponentTypes(xmlContent, { componentName });

            const outPath = outputFile || inputFile.replace(/\.(xml|euix)$/, ".d.ts");
            const outDir = path.dirname(path.resolve(outPath));
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.resolve(outPath), tsTypes, "utf8");
            console.log(`✨ Generated TypeScript declaration at: ${outPath}`);
            break;
        }

        case "doctor": {
            const { runDoctorCli } = await import("@euix/doctor/cli");
            const code = await runDoctorCli(args.slice(1), process.cwd());
            process.exit(code);
        }

        case "compile": {
            const inputFile = args[1] && !args[1].startsWith("-") ? args[1] : null;
            if (!inputFile) {
                console.error("❌ Error: Input XML file path required for compile command.");
                console.error("Usage: euix compile <file.xml> [-o output.js]");
                process.exit(1);
            }

            const xmlContent = fs.readFileSync(path.resolve(inputFile), "utf8");
            const jsCode = compileXmlToJs(xmlContent);

            const outPath = outputFile || inputFile.replace(/\.(xml|euix)$/, ".compiled.js");
            const outDir = path.dirname(path.resolve(outPath));
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.resolve(outPath), jsCode, "utf8");
            console.log(`✨ Compiled XML to JS module at: ${outPath}`);
            break;
        }

        default:
            console.error(`❌ Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}

main().catch((err) => {
    console.error("❌ CLI Execution Failed:", err);
    process.exit(1);
});
