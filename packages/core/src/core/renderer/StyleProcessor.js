/**
 * src/core/renderer/StyleProcessor.js
 * Scoped CSS transformer and reactive <style> tag processor for EUIX Engine.
 */

import { isElem } from "../utils/constants.js";

/**
 * Scopes a block of CSS by prepending or nesting with scopeSelector.
 * Handles @media, @keyframes, :host, :root, and standard CSS selectors.
 *
 * @param {string} cssText
 * @param {string} scopeSelector
 * @returns {string}
 */
export function scopeCSS(cssText, scopeSelector) {
    if (!cssText || !scopeSelector) return cssText;
    const scopeAttr = scopeSelector.startsWith("[") ? scopeSelector : `[${scopeSelector}]`;

    // Strip comments
    const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, "");

    // Regex to match at-rules like @media (...) { ... } or regular rules selector { ... }
    return cleanCss
        .replace(/(@[^{]+)\{([\s\S]+?)\}\s*\}/gi, (match, atRule, innerRules) => {
            if (atRule.trim().startsWith("@keyframes") || atRule.trim().startsWith("@-webkit-keyframes")) {
                return match;
            }
            const scopedInner = scopeCSS(innerRules, scopeAttr);
            return `${atRule} {\n${scopedInner}\n}`;
        })
        .replace(/([^{}]+)\{([^}]+)\}/g, (match, selectorList, declarations) => {
            const trimmed = selectorList.trim();
            if (trimmed.startsWith("@")) return match;

            const scopedSelectors = selectorList
                .split(",")
                .map((sel) => {
                    const s = sel.trim();
                    if (!s) return s;
                    if (s === ":host") return scopeAttr;
                    if (s.startsWith(":host(")) return s.replace(/:host\((.*?)\)/, `${scopeAttr}$1`);
                    if (s.startsWith(":root") || s.startsWith("html") || s.startsWith("body")) {
                        return s;
                    }
                    return `${scopeAttr} ${s}, ${scopeAttr}${s}`;
                })
                .join(", ");

            return `${scopedSelectors} {${declarations}}`;
        });
}

/**
 * Processes <style> tags (scoped or global) with dynamic reactive state interpolation and head injection.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @param {HTMLElement | null} targetEl
 * @returns {HTMLStyleElement | null}
 */
export function processStyleTag(engine, xmlNode, context = {}, targetEl = null) {
    if (!xmlNode || !engine) return null;
    const href = xmlNode.getAttribute("src") || xmlNode.getAttribute("href") || xmlNode.getAttribute("url");
    if (href) {
        engine.loadStyle(href);
        return null;
    }

    const rawCss = xmlNode.textContent || "";
    if (!rawCss.trim()) return null;

    const isScoped =
        xmlNode.getAttribute("scoped") === "true" ||
        xmlNode.getAttribute("scoped") === "" ||
        (typeof xmlNode.hasAttribute === "function" && xmlNode.hasAttribute("scoped"));

    let scopeId = null;
    if (isScoped) {
        scopeId = context._instanceId || context._scopeId || `euix-s-${Math.random().toString(36).substring(2, 8)}`;
        if (targetEl && isElem(targetEl)) {
            targetEl.setAttribute("data-euix-scope", scopeId);
        } else if (context._rootEl && isElem(context._rootEl)) {
            context._rootEl.setAttribute("data-euix-scope", scopeId);
        } else if (engine.container && isElem(engine.container)) {
            engine.container.setAttribute("data-euix-scope", scopeId);
        }
    }

    const styleEl = typeof document !== "undefined" ? document.createElement("style") : null;
    if (!styleEl) return null;

    if (xmlNode.getAttribute("id")) {
        styleEl.id = xmlNode.getAttribute("id");
    }
    if (xmlNode.getAttribute("media")) {
        styleEl.media = xmlNode.getAttribute("media");
    }
    if (xmlNode.getAttribute("type")) {
        styleEl.type = xmlNode.getAttribute("type");
    }
    if (isScoped && scopeId) {
        styleEl.setAttribute("data-euix-scoped-for", scopeId);
    }
    let cleanCss = rawCss.replace(/\/\*<!\[CDATA\[\*\//g, "").replace(/\/\*\]\]>\*\//g, "");
    if (isScoped && scopeId) {
        cleanCss = scopeCSS(cleanCss, `[data-euix-scope="${scopeId}"]`);
    }
    const scopedTemplate = cleanCss;

    const cssSegments = [];
    const cssExtractors = [];
    let lastIndex = 0;
    const cssRegex = /\{(\s*(?:data|local|\$local|props|\$props|const|\$data|\$state|state)\.[^}]+)\}/g;
    let m;
    while ((m = cssRegex.exec(scopedTemplate)) !== null) {
        cssSegments.push(scopedTemplate.slice(lastIndex, m.index));
        cssExtractors.push(`{${m[1]}}`);
        lastIndex = cssRegex.lastIndex;
    }
    cssSegments.push(scopedTemplate.slice(lastIndex));

    const hasDyn = cssExtractors.length > 0;
    const numExtr = cssExtractors.length;

    const renderCss = () => {
        let css;
        if (!hasDyn) {
            css = scopedTemplate;
        } else if (numExtr === 1) {
            css = cssSegments[0] + engine.interpolate(cssExtractors[0], context) + cssSegments[1];
        } else {
            let out = cssSegments[0];
            for (let i = 0; i < numExtr; i++) {
                out += engine.interpolate(cssExtractors[i], context) + cssSegments[i + 1];
            }
            css = out;
        }
        if (styleEl.textContent !== css) {
            styleEl.textContent = css;
        }
    };

    renderCss();

    if (!engine._injectedStyles) {
        engine._injectedStyles = new Set();
    }
    engine._injectedStyles.add(styleEl);

    // Dynamic state expressions in CSS (deduplicated per bindKey)
    const exprMatches =
        rawCss.match(/\{(\s*(?:data|local|\$local|props|\$props|const|\$data|\$state|state)\.[^}]+)\}/g) || [];
    if (exprMatches.length > 0) {
        const registeredKeys = new Set();
        exprMatches.forEach((match) => {
            const rawExpr = match.slice(1, -1).trim();
            const keys = rawExpr.match(/(?:data\.|local\.|computed\.)?[a-zA-Z0-9_.]+/g) || [];
            keys.forEach((key) => {
                const cleanKey = engine.parseBindPath(key);
                if (cleanKey) {
                    const bindKey =
                        key.startsWith("local.") && context._instanceId
                            ? `${context._instanceId}:${cleanKey}`
                            : cleanKey;
                    if (!registeredKeys.has(bindKey)) {
                        registeredKeys.add(bindKey);
                        engine.registerBinding(bindKey, styleEl, "style_tag", () => {
                            renderCss();
                        });
                    }
                }
            });
        });
    }

    const docHead = typeof document !== "undefined" ? document.head || document.documentElement : null;
    if (docHead) {
        docHead.appendChild(styleEl);
    }

    if (context._instanceId && typeof engine.onUnmount === "function") {
        engine.onUnmount(() => {
            if (styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
            engine._injectedStyles?.delete(styleEl);
        });
    }

    return styleEl;
}
