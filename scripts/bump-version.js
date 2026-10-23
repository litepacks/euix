#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const dryRun = args.includes("--dry-run");

// Parse target option (e.g. --target=doctor or -t core)
let target = "all";
const targetArg = args.find((a) => a.startsWith("--target="));
if (targetArg) {
    target = targetArg.split("=")[1].trim();
} else {
    const tIdx = args.indexOf("-t");
    if (tIdx !== -1 && args[tIdx + 1]) {
        target = args[tIdx + 1].trim();
    }
}

// Parse release type: patch | minor | major | explicit semver
const releaseType = args.find((a) => !a.startsWith("-")) ?? "patch";

/**
 * Increment semver version or return explicit version
 */
function bumpSemver(currentVersion, type) {
    const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
    if (!match) {
        throw new Error(`Invalid semver: ${currentVersion}`);
    }

    let [, major, minor, patch, prerelease] = match;
    major = parseInt(major, 10);
    minor = parseInt(minor, 10);
    patch = parseInt(patch, 10);

    if (type === "major") {
        return `${major + 1}.0.0`;
    }
    if (type === "minor") {
        return `${major}.${minor + 1}.0`;
    }
    if (type === "patch") {
        return `${major}.${minor}.${patch + 1}`;
    }

    // Explicit version supplied (e.g. "0.4.0")
    if (/^\d+\.\d+\.\d+/.test(type)) {
        return type;
    }

    throw new Error(`Unknown bump type: '${type}'. Expected 'patch', 'minor', 'major', or a valid version (e.g. '0.4.0').`);
}

function updateJsonFile(filePath, updater) {
    const fullPath = path.join(root, filePath);
    if (!existsSync(fullPath)) return null;
    const content = readFileSync(fullPath, "utf8");
    const json = JSON.parse(content);
    const updated = updater(json);
    if (!dryRun) {
        writeFileSync(fullPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    }
    return { oldVal: json.version, newVal: updated.version };
}

function updateTextFile(filePath, regex, replacement) {
    const fullPath = path.join(root, filePath);
    if (!existsSync(fullPath)) return;
    const content = readFileSync(fullPath, "utf8");
    const updated = content.replace(regex, replacement);
    if (!dryRun && updated !== content) {
        writeFileSync(fullPath, updated, "utf8");
    }
}

console.log(`
=====================================================
          EUIX Monorepo Version Bumper
=====================================================
Release Type: ${releaseType}
Target:       ${target}
Dry Run:      ${dryRun ? "YES" : "NO"}
`);

const results = [];

// 1. Doctor Package (@euix/doctor)
if (target === "all" || target === "doctor") {
    const current = JSON.parse(readFileSync(path.join(root, "packages/doctor/package.json"), "utf8")).version;
    const next = bumpSemver(current, releaseType);
    updateJsonFile("packages/doctor/package.json", (pkg) => {
        pkg.version = next;
        return pkg;
    });

    // Update SARIF reporter DOCTOR_VERSION constant
    updateTextFile(
        "packages/doctor/src/reporters/sarif.ts",
        /const DOCTOR_VERSION = "[^"]+";/,
        `const DOCTOR_VERSION = "${next}";`
    );

    results.push({ package: "@euix/doctor", dir: "packages/doctor", oldVer: current, newVer: next });
}

// 2. VS Code Extension (euix-doctor)
if (target === "all" || target === "vscode") {
    const current = JSON.parse(readFileSync(path.join(root, "packages/vscode-euix-doctor/package.json"), "utf8")).version;
    const next = bumpSemver(current, releaseType);
    updateJsonFile("packages/vscode-euix-doctor/package.json", (pkg) => {
        pkg.version = next;
        return pkg;
    });

    results.push({ package: "euix-doctor (vscode)", dir: "packages/vscode-euix-doctor", oldVer: current, newVer: next });
}

// 3. Core Engine (euixjs)
if (target === "all" || target === "core") {
    const current = JSON.parse(readFileSync(path.join(root, "packages/core/package.json"), "utf8")).version;
    const next = bumpSemver(current, releaseType);
    updateJsonFile("packages/core/package.json", (pkg) => {
        pkg.version = next;
        return pkg;
    });

    // Sync in-code version references in EUIXEngine and DeclarativeLoader
    updateTextFile(
        "packages/core/src/EUIXEngine.js",
        /version:\s*"[^"]+",/,
        `version: "${next}",`
    );
    updateTextFile(
        "packages/core/src/core/lifecycle/DeclarativeLoader.js",
        /version:\s*"[^"]+",/,
        `version: "${next}",`
    );
    updateTextFile(
        "apps/deepseek-studio/index.html",
        /Engine v[\d.]+/,
        `Engine v${next}`
    );

    results.push({ package: "euixjs (core)", dir: "packages/core", oldVer: current, newVer: next });
}

// 4. Spatial Worker (euix-spatial-worker)
if (target === "all" || target === "spatial") {
    const current = JSON.parse(readFileSync(path.join(root, "packages/spatial-api/package.json"), "utf8")).version;
    const next = bumpSemver(current, releaseType);
    updateJsonFile("packages/spatial-api/package.json", (pkg) => {
        pkg.version = next;
        return pkg;
    });

    results.push({ package: "euix-spatial-worker", dir: "packages/spatial-api", oldVer: current, newVer: next });
}

// Print Results Table
console.log("-----------------------------------------------------");
console.log("Package".padEnd(25) + "Old Version".padEnd(15) + "New Version");
console.log("-----------------------------------------------------");
for (const r of results) {
    console.log(`${r.package.padEnd(25)}${r.oldVer.padEnd(15)}👉  ${r.newVer}`);
}
console.log("-----------------------------------------------------");

if (dryRun) {
    console.log("\n[DRY-RUN] No files were modified.");
} else {
    console.log("\n✅ All versions successfully bumped!");
    console.log("Next steps:");
    console.log("  1. Rebuild packages:  npm run build");
    console.log("  2. Run verification:  node scripts/verify-release.js");
    console.log("  3. Publish packages:  npm run publish:packages\n");
}
