/**
 * packages/core/src/prepare/converter/jsonToXml.js
 * Converts canonical EUIX Source JSON into cleanly formatted, idiomatic EUIX XML (<uid_spec>).
 */

/**
 * Escapes XML text content.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeXmlText(str) {
    if (typeof str !== "string") return String(str);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Escapes XML attribute values.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeXmlAttr(str) {
    if (typeof str !== "string") return String(str);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Formats a prop/state value into an XML attribute string.
 *
 * @param {any} val
 * @returns {string}
 */
function formatAttrValue(val) {
    if (val && typeof val === "object") {
        if (val.$bind !== undefined) return `{data.${val.$bind}}`;
        if (val.$prop !== undefined) return `{props.${val.$prop}}`;
        if (val.$route !== undefined) return `{route.${val.$route}}`;
        return escapeXmlAttr(JSON.stringify(val));
    }
    return escapeXmlAttr(String(val));
}

/**
 * Recursively converts a view node into formatted XML lines.
 *
 * @param {any} node
 * @param {number} depth
 * @returns {string[]}
 */
function viewNodeToXmlLines(node, depth = 1) {
    const indent = "  ".repeat(depth);
    const lines = [];

    if (node === null || node === undefined) return lines;

    // Direct string or primitive text
    if (typeof node !== "object") {
        lines.push(`${indent}${escapeXmlText(String(node))}`);
        return lines;
    }

    // Direct binding object
    if (node.$bind !== undefined) {
        lines.push(`${indent}{data.${node.$bind}}`);
        return lines;
    }
    if (node.$prop !== undefined) {
        lines.push(`${indent}{props.${node.$prop}}`);
        return lines;
    }
    if (node.$route !== undefined) {
        lines.push(`${indent}{route.${node.$route}}`);
        return lines;
    }

    // Array of nodes
    if (Array.isArray(node)) {
        for (const item of node) {
            lines.push(...viewNodeToXmlLines(item, depth));
        }
        return lines;
    }

    // Tag or Component
    const tagName = node.component || node.tag || "div";
    const attrs = [];

    // Props
    if (node.props && typeof node.props === "object") {
        for (const [k, v] of Object.entries(node.props)) {
            attrs.push(`${k}="${formatAttrValue(v)}"`);
        }
    }

    // Loop attributes
    if (tagName === "for_each" || node.for_each) {
        if (node.var) attrs.push(`var="${escapeXmlAttr(node.var)}"`);
        if (node.index) attrs.push(`index="${escapeXmlAttr(node.index)}"`);
        if (node.key) attrs.push(`key="${escapeXmlAttr(node.key)}"`);
    }

    // Events (serialized as on_event:call="action")
    if (node.events && typeof node.events === "object") {
        for (const [evtName, handler] of Object.entries(node.events)) {
            const action = typeof handler === "object" ? handler.$action || handler.action : handler;
            if (action) {
                attrs.push(`on_${evtName}:call="${escapeXmlAttr(action)}"`);
            }
        }
    }

    const attrsStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    const children = Array.isArray(node.children) ? node.children : [];

    if (children.length === 0) {
        lines.push(`${indent}<${tagName}${attrsStr} />`);
    } else if (children.length === 1 && typeof children[0] !== "object") {
        // Single inline text child
        lines.push(`${indent}<${tagName}${attrsStr}>${escapeXmlText(String(children[0]))}</${tagName}>`);
    } else {
        lines.push(`${indent}<${tagName}${attrsStr}>`);
        for (const child of children) {
            lines.push(...viewNodeToXmlLines(child, depth + 1));
        }
        lines.push(`${indent}</${tagName}>`);
    }

    return lines;
}

/**
 * Converts a canonical EUIX Source JSON into cleanly formatted XML.
 *
 * @param {object|string} sourceJson
 * @param {object} [options={}]
 * @returns {string} XML string (<uid_spec>...)
 */
export function jsonToXml(sourceJson, options = {}) {
    const source = typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
    if (!source || typeof source !== "object") {
        throw new Error("Invalid source JSON: Root must be an object.");
    }

    const lines = ["<uid_spec>"];

    // 1. Imports
    if (source.imports && typeof source.imports === "object" && Object.keys(source.imports).length > 0) {
        for (const [name, spec] of Object.entries(source.imports)) {
            const src = typeof spec === "string" ? spec : spec?.src || "";
            lines.push(`  <import name="${escapeXmlAttr(name)}" src="${escapeXmlAttr(src)}" />`);
        }
    }

    // 2. Route
    if (source.route && source.route.path) {
        lines.push(`  <route path="${escapeXmlAttr(source.route.path)}" />`);
    }

    // 3. Data Model (state & computed)
    const hasState = source.state && Object.keys(source.state).length > 0;
    const hasComputed = source.computed && Object.keys(source.computed).length > 0;
    if (hasState || hasComputed) {
        lines.push("  <data_model>");
        if (hasState) {
            for (const [key, val] of Object.entries(source.state)) {
                let type = "string";
                let textVal = String(val ?? "");
                if (typeof val === "number") {
                    type = "number";
                } else if (typeof val === "boolean") {
                    type = "boolean";
                } else if (Array.isArray(val)) {
                    type = "array";
                    textVal = JSON.stringify(val);
                } else if (typeof val === "object" && val !== null) {
                    type = "object";
                    textVal = JSON.stringify(val);
                }
                lines.push(`    <state id="${escapeXmlAttr(key)}" type="${type}">${escapeXmlText(textVal)}</state>`);
            }
        }
        if (hasComputed) {
            for (const [key, compDef] of Object.entries(source.computed)) {
                const deps = Array.isArray(compDef?.deps) ? compDef.deps.join(", ") : "";
                const depsAttr = deps ? ` deps="${escapeXmlAttr(deps)}"` : "";
                const expr = typeof compDef === "string" ? compDef : compDef?.get || "";
                lines.push(`    <computed id="${escapeXmlAttr(key)}"${depsAttr}>${expr}</computed>`);
            }
        }
        lines.push("  </data_model>");
    }

    // 4. Watchers
    if (source.watch && typeof source.watch === "object" && Object.keys(source.watch).length > 0) {
        for (const [p, wDef] of Object.entries(source.watch)) {
            const action = typeof wDef === "string" ? wDef : wDef?.action || "";
            lines.push(`  <watch path="${escapeXmlAttr(p)}" action="${escapeXmlAttr(action)}" />`);
        }
    }

    // 5. Actions
    if (source.actions && typeof source.actions === "object" && Object.keys(source.actions).length > 0) {
        for (const [name, actDef] of Object.entries(source.actions)) {
            lines.push(`  <action_def name="${escapeXmlAttr(name)}">`);
            const call = typeof actDef === "object" ? actDef.call || "" : String(actDef);
            const assignAttr = actDef?.assign ? ` assign="${escapeXmlAttr(actDef.assign)}"` : "";
            lines.push(`    <step call="${escapeXmlAttr(call)}"${assignAttr} />`);
            lines.push("  </action_def>");
        }
    }

    // 6. Lifecycle
    const hasMount = source.lifecycle?.mount && source.lifecycle.mount.length > 0;
    const hasUnmount = source.lifecycle?.unmount && source.lifecycle.unmount.length > 0;
    if (hasMount || hasUnmount) {
        lines.push("  <lifecycle>");
        if (hasMount) {
            for (const step of source.lifecycle.mount) {
                const act = step.$action || step.action || step;
                lines.push(`    <on_mount action="${escapeXmlAttr(act)}" />`);
            }
        }
        if (hasUnmount) {
            for (const step of source.lifecycle.unmount) {
                const act = step.$action || step.action || step;
                lines.push(`    <on_unmount action="${escapeXmlAttr(act)}" />`);
            }
        }
        lines.push("  </lifecycle>");
    }

    // 7. Component Definitions
    if (source.components && typeof source.components === "object" && Object.keys(source.components).length > 0) {
        for (const [compName, compDef] of Object.entries(source.components)) {
            lines.push(`  <component_def name="${escapeXmlAttr(compName)}">`);
            if (compDef.view) {
                lines.push(...viewNodeToXmlLines(compDef.view, 2));
            }
            lines.push("  </component_def>");
        }
    }

    // 8. View
    if (source.view) {
        lines.push(...viewNodeToXmlLines(source.view, 1));
    }

    lines.push("</uid_spec>\n");
    return lines.join("\n");
}
