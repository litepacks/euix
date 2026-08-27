#!/usr/bin/env node

/**
 * bin/euix.js
 * Command Line Interface (CLI) for EUIX Engine.
 * Supports XSD / JSON Schema generation, TypeScript type generation (.d.ts), and AST compilation.
 */

import fs from "fs";
import path from "path";
import { generateXSDSchema, generateJsonSchema, generateComponentTypes, compileXmlToJs } from "../src/compiler/index.js";

const args = process.argv.slice(2);

function printHelp() {
    console.log(`
  🚀 EUIX Engine CLI

  Usage:
    euix <command> [options]

  Commands:
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
