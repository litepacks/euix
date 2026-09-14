#!/usr/bin/env node
/**
 * Format EUIX XML/HTML for editors and CLI.
 * Usage:
 *   node euix-doctor-format.js [--indent=N] [--stdin] <file>
 *   echo "<uid_spec/>" | node euix-doctor-format.js --stdin document.xml
 */
import fs from "node:fs";
import { formatEuixXml } from "../dist/format/xmlFormat.js";

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}

const args = process.argv.slice(2);
const useStdin = args.includes("--stdin");
const indentArg = args.find((a) => a.startsWith("--indent="));
const indentSize = indentArg ? Number(indentArg.split("=")[1]) : 2;
const fileArg = args.find((a) => !a.startsWith("--"));

try {
    const source = useStdin ? await readStdin() : fs.readFileSync(fileArg ?? "-", "utf8");
    process.stdout.write(formatEuixXml(source, { indentSize: Number.isFinite(indentSize) ? indentSize : 2 }));
} catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message);
    process.exit(1);
}
