#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const dryRun = args.includes("--dry-run");
const target = args.find((arg) => !arg.startsWith("--")) ?? "all";

function run(command, cwd = root) {
    console.log(`\n▶ ${command}`);
    execSync(command, { cwd, stdio: "inherit" });
}

function readPackage(relativeDir) {
    const file = path.join(root, relativeDir, "package.json");
    return JSON.parse(readFileSync(file, "utf8"));
}

function printBanner(title) {
    console.log(`
=====================================================
  ${title}
=====================================================
`);
}

function publishDoctor() {
    printBanner("Publish @euix/doctor");
    const pkg = readPackage("packages/doctor");
    console.log(`Package: ${pkg.name}@${pkg.version}`);

    run("npm run doctor:test");
    run("npm run doctor:build");

    const publishCmd = dryRun
        ? "npm publish -w @euix/doctor --access public --dry-run"
        : "npm publish -w @euix/doctor --access public";
    run(publishCmd);
}

function publishVscode() {
    printBanner("Publish euix-doctor (VS Code extension)");
    const doctor = readPackage("packages/doctor");
    const vscode = readPackage("packages/vscode-euix-doctor");
    console.log(`Extension: ${vscode.publisher}.${vscode.name}@${vscode.version}`);
    console.log(`Doctor dependency: @euix/doctor@${doctor.version}`);

    run("npm run doctor:test");
    run("node scripts/prepare-vscode-publish.js");

    if (dryRun) {
        run("npm run package:vsix -w euix-doctor");
        console.log("\nDry-run: .vsix packaged locally (Marketplace publish skipped).");
        return;
    }

    run("npm run publish:marketplace -w euix-doctor");
}

function publishCore() {
    printBanner("Publish euixjs (core)");
    const doctor = readPackage("packages/doctor");
    const core = readPackage("packages/core");
    console.log(`Package: ${core.name}@${core.version}`);
    console.log(`Doctor dependency: @euix/doctor@${doctor.version}`);

    run("node scripts/verify-release.js");

    const publishCmd = dryRun
        ? "npm publish -w euixjs --access public --dry-run"
        : "npm publish -w euixjs --access public";
    run(publishCmd);
}

function usage() {
    console.error(`
Usage:
  node scripts/publish-package.js [doctor|vscode|core|all] [--dry-run]

Publish order (all): doctor → vscode → core

Examples:
  npm run publish:doctor
  npm run publish:vscode
  npm run publish:core
  npm run publish:packages
  npm run publish:vscode -- --dry-run
`);
}

try {
    switch (target) {
        case "doctor":
            publishDoctor();
            break;
        case "vscode":
            publishVscode();
            break;
        case "core":
            publishCore();
            break;
        case "all":
            publishDoctor();
            publishVscode();
            publishCore();
            break;
        default:
            usage();
            process.exit(1);
    }

    console.log(`
-----------------------------------------------------
Publish ${dryRun ? "dry-run " : ""}complete: ${target}
-----------------------------------------------------
`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Publish failed: ${message}`);
    process.exit(1);
}
