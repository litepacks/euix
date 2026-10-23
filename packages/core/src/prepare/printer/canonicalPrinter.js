/**
 * packages/core/src/prepare/printer/canonicalPrinter.js
 * Deterministic Canonical EUIX Printer and Formatter.
 * Ensures equivalent EUIX converges toward identical canonical representations.
 */

const ORDERED_ROOT_KEYS = [
    "version",
    "imports",
    "route",
    "props",
    "state",
    "computed",
    "watch",
    "actions",
    "lifecycle",
    "provide",
    "inject",
    "components",
    "view",
];

const PREFERRED_ATTR_ORDER = [
    "id",
    "name",
    "type",
    "class",
    "className",
    "style",
    "bind",
    "key",
    "var",
    "index",
    "items",
    "path",
    "url",
    "method",
];

/**
 * Serializes a canonical source object into deterministic canonical JSON.
 *
 * @param {object} source
 * @param {number} [indent=2]
 * @returns {string}
 */
export function printCanonicalJson(source, indent = 2) {
    if (!source || typeof source !== "object") return "";

    const ordered = {};
    for (const key of ORDERED_ROOT_KEYS) {
        if (source[key] !== undefined) {
            if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
                // Sort object keys alphabetically
                const subObj = {};
                const subKeys = Object.keys(source[key]).sort();
                for (const sk of subKeys) {
                    subObj[sk] = source[key][sk];
                }
                ordered[key] = subObj;
            } else {
                ordered[key] = source[key];
            }
        }
    }

    // Add any unexpected extra keys sorted
    for (const key of Object.keys(source).sort()) {
        if (ordered[key] === undefined) {
            ordered[key] = source[key];
        }
    }

    return JSON.stringify(ordered, null, indent);
}

/**
 * Formats a view node into canonical XML string.
 *
 * @param {object|string} node
 * @param {number} depth
 * @returns {string}
 */
function printViewNodeToXml(node, depth = 1) {
    const pad = "  ".repeat(depth);

    if (node === null || node === undefined) return "";
    if (typeof node === "string") {
        return `${pad}${node}\n`;
    }
    if (typeof node !== "object") {
        return `${pad}${String(node)}\n`;
    }

    if (Array.isArray(node)) {
        return node.map((c) => printViewNodeToXml(c, depth)).join("");
    }

    const tagName = node.component || node.tag || "div";

    // Collect and order attributes
    const attrs = [];

    // Combine node props and events
    const allProps = { ...(node.props || {}) };
    if (node.id) allProps.id = node.id;
    if (node.$bind) allProps.bind = `{data.${node.$bind}}`;

    if (node.events && typeof node.events === "object") {
        for (const [evt, h] of Object.entries(node.events)) {
            const action = typeof h === "object" ? h.$action || h.action : h;
            allProps[`on_${evt}`] = action;
        }
    }

    // Sort attributes by PREFERRED_ATTR_ORDER, then alphabetically
    const attrKeys = Object.keys(allProps).sort((a, b) => {
        const idxA = PREFERRED_ATTR_ORDER.indexOf(a);
        const idxB = PREFERRED_ATTR_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const k of attrKeys) {
        let val = allProps[k];
        if (val && typeof val === "object" && val.$bind) {
            val = `{data.${val.$bind}}`;
        } else if (val && typeof val === "object" && val.$prop) {
            val = `{props.${val.$prop}}`;
        } else if (typeof val === "object") {
            val = JSON.stringify(val);
        }
        attrs.push(`${k}="${String(val).replace(/"/g, '&quot;')}"`);
    }

    const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    const children = Array.isArray(node.children) ? node.children : [];

    if (children.length === 0) {
        return `${pad}<${tagName}${attrStr} />\n`;
    }

    const childrenStr = children.map((c) => printViewNodeToXml(c, depth + 1)).join("");
    return `${pad}<${tagName}${attrStr}>\n${childrenStr}${pad}</${tagName}>\n`;
}

/**
 * Serializes a canonical source object into deterministic canonical XML (<uid_spec>).
 *
 * @param {object} source
 * @returns {string}
 */
export function printCanonicalXml(source) {
    if (!source || typeof source !== "object") return "";

    const lines = ["<uid_spec>"];

    // 1. Imports
    if (source.imports && typeof source.imports === "object" && Object.keys(source.imports).length > 0) {
        for (const impName of Object.keys(source.imports).sort()) {
            lines.push(`  <import name="${impName}" src="${source.imports[impName]}" />`);
        }
    }

    // 2. Route
    if (source.route) {
        const routePath = typeof source.route === "string" ? source.route : source.route.path;
        if (routePath) lines.push(`  <route path="${routePath}" />`);
    }

    // 3. Data Model (<data_model>)
    const hasStates = source.state && Object.keys(source.state).length > 0;
    const hasComputed = source.computed && Object.keys(source.computed).length > 0;

    if (hasStates || hasComputed) {
        lines.push("  <data_model>");

        // States sorted alphabetically
        if (hasStates) {
            for (const stKey of Object.keys(source.state).sort()) {
                const val = source.state[stKey];
                let type = typeof val;
                let formattedVal = "";

                if (Array.isArray(val)) {
                    type = "array";
                    formattedVal = JSON.stringify(val);
                } else if (val === null) {
                    type = "object";
                    formattedVal = "null";
                } else if (typeof val === "object") {
                    type = "object";
                    formattedVal = JSON.stringify(val);
                } else if (typeof val === "boolean") {
                    formattedVal = val ? "true" : "false";
                } else {
                    formattedVal = String(val);
                }

                lines.push(`    <state id="${stKey}" type="${type}">${formattedVal}</state>`);
            }
        }

        // Computed properties sorted alphabetically
        if (hasComputed) {
            for (const cKey of Object.keys(source.computed).sort()) {
                const cVal = source.computed[cKey];
                const deps = Array.isArray(cVal?.deps) ? cVal.deps.join(", ") : "";
                const expr = typeof cVal === "string" ? cVal : cVal?.get || "";
                const depsAttr = deps ? ` deps="${deps}"` : "";

                // Wrap in CDATA if containing script operators (<, >, &, <=, >=)
                const needsCdata = /[<>&]/.test(expr);
                const body = needsCdata ? `<![CDATA[ ${expr} ]]>` : expr;
                lines.push(`    <computed id="${cKey}"${depsAttr}>${body}</computed>`);
            }
        }

        lines.push("  </data_model>");
    }

    // 4. Watchers
    if (source.watch && typeof source.watch === "object" && Object.keys(source.watch).length > 0) {
        for (const wPath of Object.keys(source.watch).sort()) {
            const wDef = source.watch[wPath];
            const action = typeof wDef === "string" ? wDef : wDef?.action || "";
            lines.push(`  <watch path="${wPath}" action="${action}" />`);
        }
    }

    // 5. Actions (<action_def>)
    if (source.actions && typeof source.actions === "object" && Object.keys(source.actions).length > 0) {
        for (const actName of Object.keys(source.actions).sort()) {
            const actDef = source.actions[actName];
            lines.push(`  <action_def name="${actName}">`);

            if (typeof actDef === "object" && actDef !== null) {
                if (actDef.set) {
                    for (const [k, v] of Object.entries(actDef.set)) {
                        lines.push(`    <step set="${k}" value="${v}" />`);
                    }
                } else if (actDef.run || actDef.script) {
                    const script = actDef.run || actDef.script;
                    const needsCdata = /[<>&]/.test(script);
                    const body = needsCdata ? `<![CDATA[\n      ${script.trim()}\n    ]]>` : `      ${script.trim()}`;
                    lines.push(`    <step action="RUN_SCRIPT">\n${body}\n    </step>`);
                } else if (actDef.call) {
                    lines.push(`    <step call="${actDef.call}" />`);
                } else {
                    lines.push(`    <step action="${actName}" />`);
                }
            } else {
                lines.push(`    <step action="${actName}" />`);
            }

            lines.push("  </action_def>");
        }
    }

    // 6. Components (<component_def>)
    if (source.components && typeof source.components === "object" && Object.keys(source.components).length > 0) {
        for (const compName of Object.keys(source.components).sort()) {
            const compDef = source.components[compName];
            lines.push(`  <component_def name="${compName}">`);
            if (compDef.view) {
                lines.push(printViewNodeToXml(compDef.view, 2).trimEnd());
            }
            lines.push("  </component_def>");
        }
    }

    // 7. Top-Level View
    if (source.view) {
        lines.push(printViewNodeToXml(source.view, 1).trimEnd());
    }

    lines.push("</uid_spec>\n");
    return lines.join("\n");
}
