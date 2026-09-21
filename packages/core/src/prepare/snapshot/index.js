/**
 * packages/core/src/prepare/snapshot/index.js
 * Deterministic Runtime IR Snapshot Testing Subsystem for EUIX.
 * Supports regression detection, structural diffing, and automated snapshot management.
 */

import fs from "node:fs";
import path from "node:path";
import { prepare, PreparedApp } from "../index.js";
import { hashString } from "../cache.js";

export const SNAPSHOT_VERSION = 1;

/**
 * Creates a deterministic snapshot of a component or application's Runtime IR.
 *
 * @param {PreparedApp|string|object} sourceOrApp - PreparedApp, XML string, or JSON source
 * @param {object} [options={}]
 * @param {string} [options.target] - Target filename or component name
 * @param {string} [options.fixedDate] - Optional fixed date string for deterministic testing
 * @returns {Promise<object>} Snapshot payload
 */
export async function createSnapshot(sourceOrApp, options = {}) {
    let ir = null;
    let target = options.target || options.currentFile || "source";

    if (sourceOrApp instanceof PreparedApp) {
        ir = sourceOrApp.ir;
        if (!options.target && sourceOrApp.options?.currentFile) {
            target = sourceOrApp.options.currentFile;
        }
    } else if (sourceOrApp && typeof sourceOrApp === "object" && sourceOrApp.irVersion) {
        ir = sourceOrApp;
    } else {
        const app = await prepare(sourceOrApp, options);
        ir = app.ir;
        if (!options.target && app.options?.currentFile) {
            target = app.options.currentFile;
        }
    }

    if (!ir) {
        throw new Error("Unable to create snapshot: invalid or unparseable EUIX source.");
    }

    const irJsonString = JSON.stringify(ir);
    const hash = hashString(irJsonString);
    const createdAt = options.fixedDate || new Date().toISOString();

    return {
        version: SNAPSHOT_VERSION,
        target,
        hash,
        createdAt,
        ir,
    };
}

/**
 * Recursively computes deep structural differences between expected and actual IR objects.
 *
 * @param {any} expected
 * @param {any} actual
 * @param {string} [propPath=""]
 * @param {Array<object>} [diffs=[]]
 * @returns {Array<object>} Array of diff records
 */
export function diffStructural(expected, actual, propPath = "", diffs = []) {
    if (expected === actual) return diffs;

    const currentPath = propPath || "<root>";

    // Type mismatch
    if (typeof expected !== typeof actual) {
        diffs.push({
            path: currentPath,
            expected: typeof expected,
            actual: typeof actual,
            message: `Type mismatch at "${currentPath}": expected ${typeof expected}, received ${typeof actual}`,
        });
        return diffs;
    }

    // Null or undefined check
    if (expected === null || actual === null || expected === undefined || actual === undefined) {
        diffs.push({
            path: currentPath,
            expected,
            actual,
            message: `Value mismatch at "${currentPath}": expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
        });
        return diffs;
    }

    // Primitives
    if (typeof expected !== "object") {
        if (expected !== actual) {
            diffs.push({
                path: currentPath,
                expected,
                actual,
                message: `Value mismatch at "${currentPath}": expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
            });
        }
        return diffs;
    }

    // Array comparison
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual)) {
            diffs.push({
                path: currentPath,
                expected: "Array",
                actual: typeof actual,
                message: `Expected array at "${currentPath}", received ${typeof actual}`,
            });
            return diffs;
        }

        if (expected.length !== actual.length) {
            diffs.push({
                path: `${currentPath}.length`,
                expected: expected.length,
                actual: actual.length,
                message: `Array length mismatch at "${currentPath}": expected ${expected.length}, received ${actual.length}`,
            });
        }

        const maxLen = Math.max(expected.length, actual.length);
        for (let i = 0; i < maxLen; i++) {
            const itemPath = `${propPath}[${i}]`;
            if (i >= expected.length) {
                diffs.push({
                    path: itemPath,
                    expected: undefined,
                    actual: actual[i],
                    message: `Unexpected extra element in actual array at "${itemPath}"`,
                });
            } else if (i >= actual.length) {
                diffs.push({
                    path: itemPath,
                    expected: expected[i],
                    actual: undefined,
                    message: `Missing element in actual array at "${itemPath}"`,
                });
            } else {
                diffStructural(expected[i], actual[i], itemPath, diffs);
            }
        }
        return diffs;
    }

    // Object comparison
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();

    // Check for missing keys
    for (const key of expectedKeys) {
        const childPath = propPath ? `${propPath}.${key}` : key;
        if (!(key in actual)) {
            diffs.push({
                path: childPath,
                expected: expected[key],
                actual: undefined,
                message: `Missing property at "${childPath}"`,
            });
        } else {
            diffStructural(expected[key], actual[key], childPath, diffs);
        }
    }

    // Check for unexpected extra keys
    for (const key of actualKeys) {
        if (!(key in expected)) {
            const childPath = propPath ? `${propPath}.${key}` : key;
            diffs.push({
                path: childPath,
                expected: undefined,
                actual: actual[key],
                message: `Unexpected extra property at "${childPath}"`,
            });
        }
    }

    return diffs;
}

/**
 * Verifies a source or PreparedApp against an expected snapshot payload or snapshot file.
 *
 * @param {PreparedApp|string|object} sourceOrApp - Current source or app to verify
 * @param {object|string} snapshotDataOrPath - Snapshot object, JSON string, or file path
 * @param {object} [options={}]
 * @returns {Promise<object>} Verification result
 */
export async function verifySnapshot(sourceOrApp, snapshotDataOrPath, options = {}) {
    let snapshot = null;

    if (typeof snapshotDataOrPath === "string") {
        const trimmed = snapshotDataOrPath.trim();
        if (trimmed.startsWith("{")) {
            try {
                snapshot = JSON.parse(trimmed);
            } catch (err) {
                throw new Error(`Failed to parse snapshot JSON string: ${err.message}`);
            }
        } else {
            // Assume file path
            const absPath = path.resolve(snapshotDataOrPath);
            if (!fs.existsSync(absPath)) {
                return {
                    match: false,
                    diffs: [
                        {
                            path: "<snapshot_file>",
                            expected: "File exists",
                            actual: "File not found",
                            message: `Snapshot file does not exist at "${absPath}"`,
                        },
                    ],
                    expectedHash: null,
                    actualHash: null,
                    target: null,
                };
            }
            try {
                snapshot = JSON.parse(fs.readFileSync(absPath, "utf8"));
            } catch (err) {
                throw new Error(`Failed to read snapshot file "${absPath}": ${err.message}`);
            }
        }
    } else if (snapshotDataOrPath && typeof snapshotDataOrPath === "object") {
        snapshot = snapshotDataOrPath;
    }

    if (!snapshot || !snapshot.ir) {
        throw new Error("Invalid snapshot payload: missing 'ir' object.");
    }

    let currentIr = null;
    if (sourceOrApp instanceof PreparedApp) {
        currentIr = sourceOrApp.ir;
    } else if (sourceOrApp && typeof sourceOrApp === "object" && sourceOrApp.irVersion) {
        currentIr = sourceOrApp;
    } else {
        const currentApp = await prepare(sourceOrApp, options);
        currentIr = currentApp.ir;
    }

    const currentJson = JSON.stringify(currentIr);
    const actualHash = hashString(currentJson);
    const expectedHash = snapshot.hash || hashString(JSON.stringify(snapshot.ir));

    // Fast-path: hashes match completely
    if (expectedHash === actualHash) {
        return {
            match: true,
            diffs: [],
            expectedHash,
            actualHash,
            target: snapshot.target || null,
        };
    }

    // Structural diffing to pinpoint exact regressions
    const diffs = diffStructural(snapshot.ir, currentIr);

    return {
        match: diffs.length === 0,
        diffs,
        expectedHash,
        actualHash,
        target: snapshot.target || null,
    };
}

/**
 * Resolves standard snapshot file path for a given source file.
 *
 * @param {string} sourceFilePath
 * @param {string} [customOutput]
 * @returns {string} Absolute snapshot file path
 */
export function resolveSnapshotPath(sourceFilePath, customOutput = null) {
    const rawBase = path.basename(sourceFilePath);
    const baseName = rawBase.replace(/\.(euix\.json|xml|euix|json)$/i, "");

    if (customOutput) {
        const absCustom = path.resolve(customOutput);
        if (customOutput.endsWith(".json")) {
            return absCustom;
        }
        return path.join(absCustom, `${baseName}.snap.json`);
    }

    const absSource = path.resolve(sourceFilePath);
    const dir = path.dirname(absSource);
    return path.join(dir, ".snapshots", `${baseName}.snap.json`);
}

/**
 * Updates or creates a snapshot file on disk for a given source file.
 *
 * @param {string} sourceFilePath
 * @param {object} [options={}]
 * @returns {Promise<object>}
 */
export async function updateSnapshotFile(sourceFilePath, options = {}) {
    const absSource = path.resolve(sourceFilePath);
    if (!fs.existsSync(absSource)) {
        throw new Error(`Source file does not exist: "${sourceFilePath}"`);
    }

    const snapshotPath = resolveSnapshotPath(absSource, options.output);
    const snapDir = path.dirname(snapshotPath);
    if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
    }

    const isNew = !fs.existsSync(snapshotPath);
    const content = fs.readFileSync(absSource, "utf8");
    const target = path.relative(process.cwd(), absSource).replace(/\\/g, "/");

    let sourceParsed = content;
    if (absSource.endsWith(".json")) {
        try {
            sourceParsed = JSON.parse(content);
        } catch (_) {}
    }

    const snapshot = await createSnapshot(sourceParsed, {
        ...options,
        target: options.target || target,
        currentFile: path.basename(absSource),
    });

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

    return {
        snapshotPath,
        created: isNew,
        updated: !isNew,
        snapshot,
    };
}

/**
 * Verifies a source file against its saved snapshot file.
 *
 * @param {string} sourceFilePath
 * @param {object} [options={}]
 * @returns {Promise<object>}
 */
export async function verifySnapshotFile(sourceFilePath, options = {}) {
    const absSource = path.resolve(sourceFilePath);
    if (!fs.existsSync(absSource)) {
        throw new Error(`Source file does not exist: "${sourceFilePath}"`);
    }

    const snapshotPath = resolveSnapshotPath(absSource, options.output);
    if (!fs.existsSync(snapshotPath)) {
        return {
            exists: false,
            match: false,
            diffs: [
                {
                    path: "<file>",
                    expected: snapshotPath,
                    actual: "missing",
                    message: `Snapshot file does not exist: "${snapshotPath}"`,
                },
            ],
            snapshotPath,
            expectedHash: null,
            actualHash: null,
            target: path.basename(absSource),
        };
    }

    const content = fs.readFileSync(absSource, "utf8");
    let sourceParsed = content;
    if (absSource.endsWith(".json")) {
        try {
            sourceParsed = JSON.parse(content);
        } catch (_) {}
    }

    const snapshotRaw = fs.readFileSync(snapshotPath, "utf8");
    const snapshot = JSON.parse(snapshotRaw);

    const result = await verifySnapshot(sourceParsed, snapshot, {
        ...options,
        currentFile: path.basename(absSource),
    });

    return {
        exists: true,
        snapshotPath,
        ...result,
    };
}
