/**
 * src/core/utils/domHelpers.js
 * DOM node selection, query, and reporting utilities for EUIX Engine.
 */

import { getChildNodes, getChildrenList, getTagName, isElem, isFn } from "./constants.js";

export function getChild(node, tagName) {
    if (!node) return null;
    const tag = tagName.toLowerCase();
    const list = node.children && node.children.length > 0 ? getChildrenList(node) : getChildNodes(node).filter(isElem);
    return list.find((c) => getTagName(c) === tag) || null;
}

export function getChildren(node, tagName) {
    if (!node) return [];
    const list = node.children && node.children.length > 0 ? getChildrenList(node) : getChildNodes(node).filter(isElem);
    if (!tagName) return list;
    const tag = tagName.toLowerCase();
    return list.filter((c) => getTagName(c) === tag);
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
