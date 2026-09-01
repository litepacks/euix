/**
 * src/core/binding/BindingResolver.js
 * Two-way data binding resolvers, path parsers, and mapping utilities for EUIX Engine.
 */

export function parseBindPath(expr) {
    if (!expr) return "";
    return String(expr)
        .trim()
        .replace(/^\{\s*(?:data|global|\$global|local|\$local|state)\.([a-zA-Z0-9_.[\]]+)\s*\}$/, "$1")
        .replace(/^(?:data|global|\$global|state)\./, "")
        .replace(/^\{\s*|\s*\}$/g, "");
}

export function isTruthy(value) {
    return value === true || value === "true" || value === 1 || value === "1";
}

export function resolveBinding(engine, xmlNode, context = {}) {
    const bindAttr = xmlNode.getAttribute("bind");
    if (bindAttr) {
        const raw = String(bindAttr)
            .trim()
            .replace(/^\{\s*|\s*\}$/g, "");
        if (raw.startsWith("data.")) {
            return { type: "state", path: raw.slice(5) };
        }
        const ctxMatch = raw.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.(.+)$/);
        if (ctxMatch && context[ctxMatch[1]] && typeof context[ctxMatch[1]] === "object") {
            return { type: "context", scope: ctxMatch[1], prop: ctxMatch[2] };
        }
        return { type: "state", path: parseBindPath(raw) };
    }

    const path = engine.resolveBindPath(xmlNode);
    return path ? { type: "state", path } : null;
}

export function getBindingValue(engine, binding, context = {}) {
    if (!binding) return undefined;
    if (binding.type === "state") return engine.getState(binding.path);
    if (!context[binding.scope]) return undefined;
    if (binding.prop.includes(".")) {
        const parts = binding.prop.split(".");
        let curr = context[binding.scope];
        for (let i = 0; i < parts.length && curr != null; i++) {
            curr = curr[parts[i]];
        }
        return curr;
    }
    return context[binding.scope][binding.prop];
}

export function setBindingValue(engine, binding, value, context = {}, options = {}) {
    if (!binding) return;
    if (binding.type === "state") {
        engine.setState(binding.path, value, options);
        return;
    }
    if (context[binding.scope] && typeof context[binding.scope] === "object") {
        if (binding.prop.includes(".")) {
            const parts = binding.prop.split(".");
            let curr = context[binding.scope];
            for (let i = 0; i < parts.length - 1; i++) {
                if (!curr[parts[i]] || typeof curr[parts[i]] !== "object") {
                    curr[parts[i]] = {};
                }
                curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = value;
        } else {
            context[binding.scope][binding.prop] = value;
        }
        if (!options.silent && !engine._isBatching && !engine._batching) {
            engine.syncBindings(binding.scope, context[binding.scope]);
            if (context._parentStateKey) {
                engine.syncBindings(context._parentStateKey, engine.getState(context._parentStateKey));
            }
        }
    }
}

export function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escapeRegExp(str) {
    if (!str) return "";
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getKeyMask(engine, key) {
    if (!key) return 0;
    const strKey = typeof key === "string" ? key : String(key);
    let cleanKey = strKey;
    if (strKey.charCodeAt(0) === 100 && strKey.startsWith("data.")) {
        cleanKey = strKey.slice(5);
    } else if (strKey.charCodeAt(0) === 108 && strKey.startsWith("local.")) {
        cleanKey = strKey.slice(6);
    }
    let bitIndex = engine._stateKeyBits.get(cleanKey);
    if (bitIndex === undefined) {
        bitIndex = engine._nextStateBitIndex++;
        engine._stateKeyBits.set(cleanKey, bitIndex);
    }
    if (typeof bitIndex === "number" && bitIndex < 31) {
        return 1 << bitIndex;
    }
    return 1n << BigInt(bitIndex);
}

export function getJsonPath(obj, path) {
    if (!path) return obj;
    return String(path)
        .split(".")
        .reduce((acc, key) => {
            if (acc == null) return acc;
            return acc[key];
        }, obj);
}

export function mapResponseItems(engine, items, itemMapNode) {
    if (!itemMapNode || !Array.isArray(items)) return items;

    const fieldNodes = engine.getChildren(itemMapNode, "field");
    return items.map((raw) => {
        const mapped = {};
        const templates = [];

        fieldNodes.forEach((field) => {
            const as = field.getAttribute("as");
            if (!as) return;

            const template = field.getAttribute("template");
            if (template) {
                templates.push({ as, template });
                return;
            }

            const from = field.getAttribute("from") || as;
            let value = raw[from];
            const matchStr = field.getAttribute("match");
            if (matchStr && value != null) {
                let pattern = matchStr;
                let flags = "";
                const regexLiteralMatch = matchStr.match(/^\/(.+)\/([a-z]*)$/i);
                if (regexLiteralMatch) {
                    pattern = regexLiteralMatch[1];
                    flags = regexLiteralMatch[2];
                }
                try {
                    const m = String(value).match(new RegExp(pattern, flags));
                    value = m ? (m[1] ?? m[0]) : value;
                } catch (e) {
                    console.warn("[EUIXEngine] Regex Match Error:", e);
                }
            }
            mapped[as] = value == null ? "" : String(value);
        });

        templates.forEach(({ as, template }) => {
            mapped[as] = template.replace(/\{(\w+)\}/g, (_, key) => mapped[key] ?? "");
        });

        return mapped;
    });
}
