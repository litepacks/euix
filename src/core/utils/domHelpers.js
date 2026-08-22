/**
 * src/core/utils/domHelpers.js
 * DOM node selection, query, and reporting utilities for EUIX Engine.
 */

import { isFn } from "./constants.js";

export function getChild(node, tagName) {
    if (!node || !tagName) return null;
    const tag = tagName.toLowerCase();
    const children = node.children || node.childNodes;
    if (!children) return null;
    const len = children.length;
    for (let i = 0; i < len; i++) {
        const c = children[i];
        if (
            c &&
            (c.nodeType === 1 || c.nodeType === undefined) &&
            (c.tagName ? c.tagName.toLowerCase() : "") === tag
        ) {
            return c;
        }
    }
    return null;
}

export function getChildren(node, tagName) {
    if (!node) return [];
    const children = node.children || node.childNodes;
    if (!children) return [];
    const len = children.length;
    const result = [];
    const tag = tagName ? tagName.toLowerCase() : null;

    for (let i = 0; i < len; i++) {
        const c = children[i];
        if (c && (c.nodeType === 1 || c.nodeType === undefined)) {
            if (!tag || (c.tagName ? c.tagName.toLowerCase() : "") === tag) {
                result.push(c);
            }
        }
    }
    return result;
}

export function reportError(engine, error, contextInfo = "") {
    const msg = error instanceof Error ? error.message : String(error);
    const EngineClass = engine ? engine.constructor : null;
    if (
        typeof console !== "undefined" &&
        !EngineClass?.silent &&
        (typeof process === "undefined" || !process.env || process.env.NODE_ENV !== "test")
    ) {
        console.warn(`[EUIXEngine Fallback] ${contextInfo ? `${contextInfo}: ` : ""}${msg}`);
    }
    if (engine && isFn(engine.onError)) {
        try {
            engine.onError(error, contextInfo);
        } catch (_) {}
    }
}
