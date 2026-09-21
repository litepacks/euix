/**
 * packages/core/src/prepare/index.js
 * Main entry point for the EUIX Prepare Subsystem.
 * Orchestrates parsing, resolution, validation, and IR normalization.
 */

import { parseSource } from "./parser/index.js";
import { resolveSource } from "./resolver/index.js";
import { validateSource as runSemanticValidation } from "./validator/index.js";
import { normalizeToRuntimeIR } from "./normalizer/index.js";
import { globalPrepareCache } from "./cache.js";
import { mountPrepared, irToXmlSpec } from "./runtime/adapter.js";
import { renderToString } from "./runtime/ssr.js";
import {
    createSnapshot,
    verifySnapshot,
    updateSnapshotFile,
    verifySnapshotFile,
    resolveSnapshotPath,
    diffStructural,
    SNAPSHOT_VERSION,
} from "./snapshot/index.js";
import { DIAGNOSTIC_CODES } from "./validator/diagnostics.js";

/**
 * Custom error thrown when prepare validation fails in strict mode.
 */
export class EUIXPrepareError extends Error {
    /**
     * @param {string} message
     * @param {Array<import('./validator/diagnostics.js').Diagnostic>} diagnostics
     */
    constructor(message, diagnostics = []) {
        super(message);
        this.name = "EUIXPrepareError";
        this.diagnostics = diagnostics;
    }
}

/**
 * Represents a prepared EUIX application ready for mounting or IR serialization.
 */
export class PreparedApp {
    /**
     * @param {object} ir - Normalized Runtime IR
     * @param {object} source - Canonical EUIX Source representation
     * @param {Array<import('./validator/diagnostics.js').Diagnostic>} diagnostics
     * @param {object} options
     */
    constructor(ir, source, diagnostics, options = {}) {
        this.ir = ir;
        this.source = source;
        this.diagnostics = diagnostics;
        this.options = options;
    }

    /**
     * Mounts the prepared application into a DOM container.
     *
     * @param {string|Element} [containerSelector="#app"]
     * @param {object} [mountOptions={}]
     * @returns {any} Engine instance
     */
    mount(containerSelector = "#app", mountOptions = {}) {
        return mountPrepared(this, containerSelector, { ...this.options, ...mountOptions });
    }

    /**
     * Serializes the prepared application to Runtime IR JSON.
     *
     * @returns {object}
     */
    toJSON() {
        return this.ir;
    }

    /**
     * Converts to executable XML template specification string.
     *
     * @returns {string}
     */
    toXml() {
        return irToXmlSpec(this.ir);
    }

    /**
     * Renders the prepared application to a static HTML string without requiring DOM/JSDOM.
     *
     * @param {object} [initialData={}]
     * @param {object} [renderOptions={}]
     * @returns {string}
     */
    renderToString(initialData = {}, renderOptions = {}) {
        return renderToString(this, initialData, { ...this.options, ...renderOptions });
    }

    /**
     * Creates a deterministic snapshot of this prepared application's Runtime IR.
     *
     * @param {object} [options={}]
     * @returns {Promise<object>}
     */
    createSnapshot(options = {}) {
        return createSnapshot(this, { ...this.options, ...options });
    }

    /**
     * Verifies this prepared application's Runtime IR against an expected snapshot payload or file.
     *
     * @param {object|string} snapshotDataOrPath
     * @param {object} [options={}]
     * @returns {Promise<object>}
     */
    verifySnapshot(snapshotDataOrPath, options = {}) {
        return verifySnapshot(this, snapshotDataOrPath, { ...this.options, ...options });
    }
}

/**
 * Prepares an EUIX source (JSON object, JSON string, or XML string) for runtime execution.
 * Resolves imports, validates semantics, and normalizes into a deterministic Runtime IR.
 *
 * @param {string|object} source - EUIX XML string, JSON string, or JSON source object
 * @param {object} [options={}]
 * @param {string} [options.currentFile="source.euix"]
 * @param {boolean} [options.bypassCache=false]
 * @param {boolean} [options.strict=false] - Whether to throw EUIXPrepareError on validation error
 * @param {Function} [options.resolveImport] - Custom async/sync import loader
 * @returns {Promise<PreparedApp>}
 */
export async function prepare(source, options = {}) {
    const bypassCache = options.bypassCache === true;

    // 1. Check Memory Cache
    if (!bypassCache) {
        const cached = globalPrepareCache.get(source, options);
        if (cached) return cached;
    }

    const currentFile = options.currentFile || "source.euix";
    const allDiagnostics = [];

    // 2. Parse Source
    const { source: canonicalSource, diagnostics: parseDiagnostics } = parseSource(source, currentFile);
    allDiagnostics.push(...parseDiagnostics);

    if (!canonicalSource) {
        if (options.strict && allDiagnostics.length > 0) {
            throw new EUIXPrepareError(`Failed to parse EUIX source in "${currentFile}": ${allDiagnostics[0].message}`, allDiagnostics);
        }
        return new PreparedApp(null, null, allDiagnostics, options);
    }

    // 3. Resolve Scopes, Routes, and Imports
    const { scope, route, diagnostics: resolveDiagnostics } = await resolveSource(canonicalSource, options);
    allDiagnostics.push(...resolveDiagnostics);

    // 4. Validate Semantics & Collect Machine-Readable Diagnostics
    const validationDiagnostics = runSemanticValidation(canonicalSource, scope, currentFile);
    allDiagnostics.push(...validationDiagnostics);

    const hasErrors = allDiagnostics.some((d) => d.severity === "error");
    if (hasErrors && options.strict) {
        const firstErr = allDiagnostics.find((d) => d.severity === "error");
        throw new EUIXPrepareError(
            `[${firstErr.code}] Validation error in "${currentFile}": ${firstErr.message}`,
            allDiagnostics,
        );
    }

    // 5. Normalize into Deterministic Runtime IR
    const ir = normalizeToRuntimeIR(canonicalSource, scope, route);

    const app = new PreparedApp(ir, canonicalSource, allDiagnostics, options);

    // 6. Save in Cache
    if (!bypassCache) {
        globalPrepareCache.set(source, options, app);
    }

    return app;
}

/**
 * Universal mount function accepting a PreparedApp, Runtime IR, XML string, or source object.
 *
 * @param {any} appOrSource
 * @param {string|Element} [containerSelector="#app"]
 * @param {object} [options={}]
 * @returns {any} Engine instance
 */
export function mount(appOrSource, containerSelector = "#app", options = {}) {
    // If it's already a PreparedApp instance
    if (appOrSource && typeof appOrSource.mount === "function") {
        return appOrSource.mount(containerSelector, options);
    }

    // If it's a normalized IR object
    if (appOrSource && typeof appOrSource === "object" && appOrSource.irVersion) {
        return mountPrepared(appOrSource, containerSelector, options);
    }

    // Direct mounting fallback
    return mountPrepared(appOrSource, containerSelector, options);
}

/**
 * Helper to extract all bindings from a view tree.
 */
function collectViewBindings(node, path = "view", result = []) {
    if (!node || typeof node !== "object") return result;

    if (node.$bind !== undefined) {
        result.push({ path, type: "state", target: node.$bind });
    }
    if (node.$prop !== undefined) {
        result.push({ path, type: "prop", target: node.$prop });
    }
    if (node.$route !== undefined) {
        result.push({ path, type: "route", target: node.$route });
    }
    if (node.$action !== undefined) {
        result.push({ path, type: "action", target: node.$action });
    }

    if (node.props && typeof node.props === "object") {
        for (const [k, v] of Object.entries(node.props)) {
            collectViewBindings(v, `${path}.props.${k}`, result);
        }
    }
    if (node.events && typeof node.events === "object") {
        for (const [k, v] of Object.entries(node.events)) {
            collectViewBindings(v, `${path}.events.${k}`, result);
        }
    }
    if (Array.isArray(node.children)) {
        node.children.forEach((c, idx) => {
            collectViewBindings(c, `${path}.children[${idx}]`, result);
        });
    }

    return result;
}

/**
 * Inspects a source and returns resolved symbol breakdown and bindings.
 *
 * @param {string|object} source
 * @param {object} [options={}]
 * @returns {Promise<object>}
 */
export async function inspect(source, options = {}) {
    const currentFile = options.currentFile || "source.euix";
    const { source: canonicalSource, diagnostics: parseDiagnostics } = parseSource(source, currentFile);
    if (!canonicalSource) {
        return { diagnostics: parseDiagnostics, error: "Unable to parse source" };
    }

    const { scope, route, diagnostics: resolveDiagnostics } = await resolveSource(canonicalSource, options);
    const validationDiagnostics = runSemanticValidation(canonicalSource, scope, currentFile);
    const diagnostics = [...parseDiagnostics, ...resolveDiagnostics, ...validationDiagnostics];
    const bindings = collectViewBindings(canonicalSource.view);

    return {
        file: currentFile,
        route,
        imports: Object.fromEntries(scope.importMap),
        states: Array.from(scope.states),
        computed: Array.from(scope.computed),
        props: Array.from(scope.props),
        actions: Array.from(scope.actions),
        components: Array.from(scope.components),
        bindings,
        diagnostics,
    };
}

/**
 * Validates a source and returns all machine-readable diagnostics without throwing.
 *
 * @param {string|object} source
 * @param {object} [options={}]
 * @returns {Promise<Array<import('./validator/diagnostics.js').Diagnostic>>}
 */
export async function validateSource(source, options = {}) {
    const inspected = await inspect(source, options);
    return inspected.diagnostics || [];
}

/**
 * Clears the global prepare memory cache.
 */
export function clearPrepareCache() {
    globalPrepareCache.clear();
}

export { generateLlmContext } from "./context/index.js";
export { convert, jsonToXml, xmlToJson } from "./converter/index.js";
export { applyFixes, fixSource } from "./fixer/index.js";
export { generateSourceSchema } from "./schema/index.js";
export { renderToString } from "./runtime/ssr.js";
export {
    createSnapshot,
    verifySnapshot,
    updateSnapshotFile,
    verifySnapshotFile,
    resolveSnapshotPath,
    diffStructural,
    SNAPSHOT_VERSION,
} from "./snapshot/index.js";
export { DIAGNOSTIC_CODES, globalPrepareCache, mountPrepared, irToXmlSpec };
