/**
 * packages/core/src/prepare/fixer/index.js
 * Intelligent Auto-Fixer for EUIX Sources (JSON & XML).
 * Automatically resolves known typos, component mismatches, action mismatches,
 * and syntax issues based on machine-readable diagnostics and Levenshtein suggestions.
 */

import { validateSource } from "../index.js";
import { DIAGNOSTIC_CODES } from "../validator/diagnostics.js";

/**
 * Deep clone utility.
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    const cloned = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = deepClone(obj[key]);
    }
    return cloned;
}

/**
 * Traverses a JSON object by path (e.g. "view.children[0].component") and updates the target.
 *
 * @param {object} obj
 * @param {string} path
 * @param {Function} updater
 * @returns {boolean} Whether the update succeeded
 */
function updateByPath(obj, path, updater) {
    if (!obj || !path) return false;
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    let curr = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (curr[p] === undefined || curr[p] === null) return false;
        curr = curr[p];
    }

    const lastKey = parts[parts.length - 1];
    if (curr && lastKey in curr) {
        curr[lastKey] = updater(curr[lastKey], lastKey, curr);
        return true;
    }
    return false;
}

/**
 * Applies fixes to a canonical EUIX JSON object.
 *
 * @param {object} jsonObj
 * @param {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics
 * @returns {{ fixedObj: object, fixesApplied: Array<object> }}
 */
function fixJsonObject(jsonObj, diagnostics) {
    const fixedObj = deepClone(jsonObj);
    const fixesApplied = [];

    for (const diag of diagnostics) {
        if (!diag.suggestion && diag.code !== DIAGNOSTIC_CODES.INVALID_ROUTE) continue;

        // 1. Unknown Component (EUIX201)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_COMPONENT && diag.suggestion) {
            const updated = updateByPath(fixedObj, diag.path, (oldVal) => {
                fixesApplied.push({
                    code: diag.code,
                    type: diag.type,
                    path: diag.path,
                    original: oldVal,
                    fixed: diag.suggestion,
                    message: `Replaced unknown component "${oldVal}" with "${diag.suggestion}"`,
                });
                return diag.suggestion;
            });
            if (updated) continue;
        }

        // 2. Unknown State (EUIX202)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_STATE && diag.suggestion) {
            const updated = updateByPath(fixedObj, diag.path, (targetNode) => {
                if (typeof targetNode === "object" && targetNode !== null) {
                    if (targetNode.$bind !== undefined) {
                        const original = targetNode.$bind;
                        fixesApplied.push({
                            code: diag.code,
                            type: diag.type,
                            path: `${diag.path}.$bind`,
                            original,
                            fixed: diag.suggestion,
                            message: `Replaced unknown state binding "${original}" with "${diag.suggestion}"`,
                        });
                        targetNode.$bind = diag.suggestion;
                        return targetNode;
                    }
                } else if (typeof targetNode === "string") {
                    const original = targetNode;
                    const fixed = targetNode.replace(/\{data\.([a-zA-Z0-9_]+)\}/g, (m, p1) => {
                        return `{data.${diag.suggestion}}`;
                    });
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed: fixed !== original ? fixed : diag.suggestion,
                        message: `Replaced unknown state "${original}" with "${diag.suggestion}"`,
                    });
                    return fixed !== original ? fixed : diag.suggestion;
                }
                return targetNode;
            });
            if (updated) continue;
        }

        // 3. Unknown Action (EUIX203)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_ACTION && diag.suggestion) {
            const updated = updateByPath(fixedObj, diag.path, (targetNode) => {
                if (typeof targetNode === "object" && targetNode !== null && targetNode.$action !== undefined) {
                    const original = targetNode.$action;
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: `${diag.path}.$action`,
                        original,
                        fixed: diag.suggestion,
                        message: `Replaced unknown action "${original}" with "${diag.suggestion}"`,
                    });
                    targetNode.$action = diag.suggestion;
                    return targetNode;
                } else if (typeof targetNode === "string") {
                    const original = targetNode;
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed: diag.suggestion,
                        message: `Replaced unknown action "${original}" with "${diag.suggestion}"`,
                    });
                    return diag.suggestion;
                }
                return targetNode;
            });
            if (updated) continue;
        }

        // 4. Invalid Route missing leading slash (EUIX205)
        if (diag.code === DIAGNOSTIC_CODES.INVALID_ROUTE && diag.message.includes('must start with a leading slash ("/")')) {
            const updated = updateByPath(fixedObj, diag.path, (oldVal) => {
                if (typeof oldVal === "string" && !oldVal.startsWith("/")) {
                    const fixed = "/" + oldVal;
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original: oldVal,
                        fixed,
                        message: `Added missing leading slash to route path: "${fixed}"`,
                    });
                    return fixed;
                }
                return oldVal;
            });
            if (updated) continue;
        }
    }

    return { fixedObj, fixesApplied };
}

/**
 * Escapes regex special characters.
 */
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies fixes directly to an XML string.
 *
 * @param {string} xmlString
 * @param {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics
 * @returns {{ fixedXml: string, fixesApplied: Array<object> }}
 */
function fixXmlString(xmlString, diagnostics) {
    let fixedXml = xmlString;
    const fixesApplied = [];

    for (const diag of diagnostics) {
        // 1. Unknown Component (EUIX201)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_COMPONENT && diag.suggestion) {
            const match = diag.message.match(/Unknown component "([^"]+)"/);
            const original = match ? match[1] : null;
            if (original) {
                const openTagRegex = new RegExp(`<${escapeRegex(original)}(\\s|>)`, "g");
                const closeTagRegex = new RegExp(`</${escapeRegex(original)}>`, "g");
                const compAttrRegex = new RegExp(`component="${escapeRegex(original)}"`, "g");
                const nameAttrRegex = new RegExp(`name="${escapeRegex(original)}"`, "g");

                let replaced = false;
                if (openTagRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(new RegExp(`<${escapeRegex(original)}(\\s|>)`, "g"), `<${diag.suggestion}$1`);
                    fixedXml = fixedXml.replace(closeTagRegex, `</${diag.suggestion}>`);
                    replaced = true;
                }
                if (compAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(compAttrRegex, `component="${diag.suggestion}"`);
                    replaced = true;
                }
                if (nameAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(nameAttrRegex, `name="${diag.suggestion}"`);
                    replaced = true;
                }

                if (replaced) {
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed: diag.suggestion,
                        message: `Replaced unknown component tag/attribute "${original}" with "${diag.suggestion}"`,
                    });
                }
            }
        }

        // 2. Unknown State (EUIX202)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_STATE && diag.suggestion) {
            const match = diag.message.match(/Unknown state "([^"]+)"/);
            const original = match ? match[1] : null;
            if (original) {
                const bindAttrRegex = new RegExp(`bind="${escapeRegex(original)}"`, "g");
                const exprRegex = new RegExp(`\\{data\\.${escapeRegex(original)}\\}`, "g");
                const shorthandSetRegex = new RegExp(`on_click:set="${escapeRegex(original)}=`, "g");
                const pathTagRegex = new RegExp(`<path>\\s*data\\.${escapeRegex(original)}\\s*</path>`, "g");

                let replaced = false;
                if (bindAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(bindAttrRegex, `bind="${diag.suggestion}"`);
                    replaced = true;
                }
                if (exprRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(exprRegex, `{data.${diag.suggestion}}`);
                    replaced = true;
                }
                if (shorthandSetRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(shorthandSetRegex, `on_click:set="${diag.suggestion}=`);
                    replaced = true;
                }
                if (pathTagRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(pathTagRegex, `<path>data.${diag.suggestion}</path>`);
                    replaced = true;
                }

                if (replaced) {
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed: diag.suggestion,
                        message: `Replaced unknown state "${original}" with "${diag.suggestion}"`,
                    });
                }
            }
        }

        // 3. Unknown Action (EUIX203)
        if (diag.code === DIAGNOSTIC_CODES.UNKNOWN_ACTION && diag.suggestion) {
            const match = diag.message.match(/Unknown action "([^"]+)"/);
            const original = match ? match[1] : null;
            if (original) {
                const actionAttrRegex = new RegExp(`action="${escapeRegex(original)}"`, "g");
                const callAttrRegex = new RegExp(`on_click:call="${escapeRegex(original)}"`, "g");
                const stepActionRegex = new RegExp(`<on_click\\s+call="${escapeRegex(original)}"`, "g");

                let replaced = false;
                if (actionAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(actionAttrRegex, `action="${diag.suggestion}"`);
                    replaced = true;
                }
                if (callAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(callAttrRegex, `on_click:call="${diag.suggestion}"`);
                    replaced = true;
                }
                if (stepActionRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(stepActionRegex, `<on_click call="${diag.suggestion}"`);
                    replaced = true;
                }

                if (replaced) {
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed: diag.suggestion,
                        message: `Replaced unknown action "${original}" with "${diag.suggestion}"`,
                    });
                }
            }
        }

        // 4. Invalid Route missing leading slash (EUIX205)
        if (diag.code === DIAGNOSTIC_CODES.INVALID_ROUTE && diag.message.includes('must start with a leading slash ("/")')) {
            const match = diag.message.match(/Route path "([^"]+)"/);
            const original = match ? match[1] : null;
            if (original && !original.startsWith("/")) {
                const fixed = "/" + original;
                const pathAttrRegex = new RegExp(`path="${escapeRegex(original)}"`, "g");
                if (pathAttrRegex.test(fixedXml)) {
                    fixedXml = fixedXml.replace(pathAttrRegex, `path="${fixed}"`);
                    fixesApplied.push({
                        code: diag.code,
                        type: diag.type,
                        path: diag.path,
                        original,
                        fixed,
                        message: `Added missing leading slash to route path: "${fixed}"`,
                    });
                }
            }
        }

        // 5. Script missing CDATA (EUIX0001)
        if (diag.code === "EUIX0001" || diag.type === "xml-script-cdata") {
            fixedXml = fixedXml.replace(/<(computed|step)([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, body) => {
                if (body.includes("<![CDATA[")) return match;
                if (/[<>&]/.test(body)) {
                    fixesApplied.push({
                        code: "EUIX0001",
                        type: "xml-script-cdata",
                        path: tag,
                        original: body.trim(),
                        fixed: `<![CDATA[${body.trim()}]]>`,
                        message: `Wrapped script body in <![CDATA[ ... ]]> in <${tag}>`,
                    });
                    return `<${tag}${attrs}><![CDATA[${body.trim()}]]></${tag}>`;
                }
                return match;
            });
        }
    }

    return { fixedXml, fixesApplied };
}

/**
 * Automatically applies fixes to a source (JSON object, JSON string, or XML string).
 *
 * @param {string|object} source
 * @param {Array<import('../validator/diagnostics.js').Diagnostic>} [diagnostics=null]
 * @param {object} [options={}]
 * @param {string} [options.currentFile="source.euix"]
 * @param {number} [options.maxPasses=3]
 * @returns {Promise<{ fixedSource: string|object, fixesApplied: Array<object>, remainingDiagnostics: Array<object>, modified: boolean }>}
 */
export async function applyFixes(source, diagnostics = null, options = {}) {
    const currentFile = options.currentFile || "source.euix";
    const maxPasses = options.maxPasses || 3;

    let currentSource = source;
    const allFixes = [];
    let pass = 0;

    while (pass < maxPasses) {
        pass++;
        const currentDiags = diagnostics && pass === 1
            ? diagnostics
            : await validateSource(currentSource, { currentFile });

        const fixableDiags = currentDiags.filter((d) => d.suggestion || d.code === DIAGNOSTIC_CODES.INVALID_ROUTE || d.code === "EUIX0001");
        if (fixableDiags.length === 0) break;

        let passFixes = [];

        if (typeof currentSource === "object" && currentSource !== null) {
            const { fixedObj, fixesApplied } = fixJsonObject(currentSource, fixableDiags);
            currentSource = fixedObj;
            passFixes = fixesApplied;
        } else if (typeof currentSource === "string") {
            const trimmed = currentSource.trim();
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(currentSource);
                    const { fixedObj, fixesApplied } = fixJsonObject(parsed, fixableDiags);
                    currentSource = JSON.stringify(fixedObj, null, 2);
                    passFixes = fixesApplied;
                } catch {
                    break;
                }
            } else {
                const { fixedXml, fixesApplied } = fixXmlString(currentSource, fixableDiags);
                currentSource = fixedXml;
                passFixes = fixesApplied;
            }
        }

        if (passFixes.length === 0) break;
        allFixes.push(...passFixes);
    }

    const remainingDiagnostics = await validateSource(currentSource, { currentFile });

    return {
        fixedSource: currentSource,
        fixesApplied: allFixes,
        remainingDiagnostics,
        modified: allFixes.length > 0,
    };
}

/**
 * Convenience helper to fix a source and return the fixed string/object.
 *
 * @param {string|object} source
 * @param {object} [options={}]
 * @returns {Promise<{ fixedSource: string|object, fixesApplied: Array<object>, remainingDiagnostics: Array<object>, modified: boolean }>}
 */
export async function fixSource(source, options = {}) {
    return applyFixes(source, null, options);
}
