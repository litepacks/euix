/**
 * packages/core/src/prepare/converter/jsonToXml.js
 * Converts canonical EUIX Source JSON into cleanly formatted, idiomatic EUIX XML (<uid_spec>).
 */
import { jsonToToon } from "./toon.js";
/**
 * Wraps JavaScript expression or script in CDATA if it contains operators or unsafe XML characters.
 *
 * @param {string} str
 * @returns {string}
 */
function wrapCdataIfNeeded(str) {
    if (typeof str !== "string") return String(str);
    const trimmed = str.trim();
    if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
        return trimmed;
    }
    if (/[<>&]|<=|>=|&&|\|\|/.test(str)) {
        return `<![CDATA[${str}]]>`;
    }
    return str;
}

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
    if (node.$bind !== undefined && !node.tag && !node.component) {
        lines.push(`${indent}{data.${node.$bind}}`);
        return lines;
    }
    if (node.$prop !== undefined && !node.tag && !node.component) {
        lines.push(`${indent}{props.${node.$prop}}`);
        return lines;
    }
    if (node.$route !== undefined && !node.tag && !node.component) {
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
    const tagName = node.component || node.tag || (node.items || node.for_each ? "for_each" : "div");
    const attrs = [];

    // Props & attributes normalization
    const mergedProps = {};

    // 1. Gather any top-level node attributes (e.g. node.class, node.className, node.id, node.style, layout attrs)
    for (const [k, v] of Object.entries(node)) {
        if ([
            "tag", "component", "props", "children", "events", 
            "items", "for_each", "var", "index", "key", 
            "condition", "if", "$bind", "$prop", "$route", "slot"
        ].includes(k)) continue;
        mergedProps[k] = v;
    }

    // 2. Explicit props object overrides/merges with top-level attributes
    if (node.props && typeof node.props === "object") {
        Object.assign(mergedProps, node.props);
    }

    // 3. Normalize className to class
    if (mergedProps.className !== undefined) {
        if (!mergedProps.class) {
            mergedProps.class = mergedProps.className;
        }
        delete mergedProps.className;
    }

    for (const [k, v] of Object.entries(mergedProps)) {
        attrs.push(`${k}="${formatAttrValue(v)}"`);
    }

    // Directives: condition & if
    const rawCond = node.condition !== undefined ? node.condition : node.if !== undefined ? node.if : mergedProps.condition || mergedProps.if;
    if (rawCond !== undefined) {
        let condVal = rawCond;
        if (typeof condVal === "object" && condVal !== null && condVal.$bind) {
            condVal = `{data.${condVal.$bind}}`;
        } else if (typeof condVal === "string" && !condVal.startsWith("{") && !condVal.includes(" ") && !condVal.includes("(") && !condVal.includes(".")) {
            condVal = `{data.${condVal}}`;
        }
        const condAttr = tagName === "if" ? "condition" : "if";
        if (!attrs.some((a) => a.startsWith(`${condAttr}=`))) {
            attrs.push(`${condAttr}="${formatAttrValue(condVal)}"`);
        }
    }

    // Node direct bind shorthand (e.g. { tag: "input", $bind: "counter" })
    if (node.$bind !== undefined && !mergedProps.bind) {
        attrs.push(`bind="${escapeXmlAttr(node.$bind)}"`);
    }

    // Loop attributes
    if (tagName === "for_each" || node.for_each || node.items) {
        let itemsVal = null;
        if (node.items) {
            itemsVal = typeof node.items === "object" && node.items.$bind
                ? `{data.${node.items.$bind}}`
                : String(node.items).startsWith("{")
                ? node.items
                : `{data.${node.items}}`;
        } else if (node.for_each && !node.props?.items) {
            itemsVal = typeof node.for_each === "object" && node.for_each.$bind
                ? `{data.${node.for_each.$bind}}`
                : String(node.for_each).startsWith("{")
                ? node.for_each
                : `{data.${node.for_each}}`;
        }
        if (itemsVal && !attrs.some((a) => a.startsWith("items="))) {
            attrs.push(`items="${escapeXmlAttr(itemsVal)}"`);
        }
        if (node.var && !attrs.some((a) => a.startsWith("var="))) attrs.push(`var="${escapeXmlAttr(node.var)}"`);
        if (node.index && !attrs.some((a) => a.startsWith("index="))) attrs.push(`index="${escapeXmlAttr(node.index)}"`);
        if (node.key && !attrs.some((a) => a.startsWith("key="))) attrs.push(`key="${escapeXmlAttr(node.key)}"`);
    }

    // Events normalization & extraction
    const eventsMap = { ...(node.events || {}) };
    for (const [k, v] of Object.entries(node)) {
        if (/^on[A-Z_]/i.test(k) && !k.includes(":")) {
            const evtName = k.replace(/^on_?/i, "").toLowerCase();
            if (eventsMap[evtName] === undefined) eventsMap[evtName] = v;
        }
    }
    if (node.props && typeof node.props === "object") {
        for (const [k, v] of Object.entries(node.props)) {
            if (/^on[A-Z_]/i.test(k) && !k.includes(":")) {
                const evtName = k.replace(/^on_?/i, "").toLowerCase();
                if (eventsMap[evtName] === undefined) eventsMap[evtName] = v;
            }
        }
    }

    const childEventTags = [];

    // Events serialization
    for (const [evtName, handler] of Object.entries(eventsMap)) {
        if (Array.isArray(handler)) {
            for (const h of handler) {
                if (typeof h === "string") {
                    const trimmed = h.trim();
                    if (trimmed.startsWith("set:") || trimmed.startsWith("toggle:") || trimmed.startsWith("mutate:") || trimmed.startsWith("call:") || trimmed.startsWith("run:")) {
                        const parts = trimmed.split(":");
                        childEventTags.push(`<on_${evtName} action="${parts[0].toUpperCase()}" ${parts[0]}="${escapeXmlAttr(parts.slice(1).join(":"))}" />`);
                    } else if (trimmed.includes("=") || trimmed.includes("+") || trimmed.includes("-")) {
                        childEventTags.push(`<on_${evtName} action="SET_STATE" set="${escapeXmlAttr(trimmed)}" />`);
                    } else {
                        childEventTags.push(`<on_${evtName} action="CALL" name="${escapeXmlAttr(trimmed)}" />`);
                    }
                } else if (h && typeof h === "object") {
                    const action = (h.action || h.$action || h.call || "").trim();
                    const upperAction = action.toUpperCase();
                    if (h.set || upperAction === "SET_STATE") {
                        const rawP = String(h.path || h.set || "").replace(/^data\./, "").trim();
                        const val = h.value !== undefined ? h.value : h.val;
                        const valStr = typeof val === "object" ? JSON.stringify(val) : val !== undefined ? String(val) : "";
                        childEventTags.push(`<on_${evtName} action="SET_STATE" path="${escapeXmlAttr(rawP)}" value="${escapeXmlAttr(valStr)}" />`);
                    } else if (h.toggle || upperAction === "TOGGLE_STATE" || upperAction === "TOGGLE") {
                        const rawP = String(h.path || h.toggle || "").replace(/^data\./, "").trim();
                        childEventTags.push(`<on_${evtName} action="TOGGLE_STATE" path="${escapeXmlAttr(rawP)}" />`);
                    } else if (h.mutate || upperAction === "MUTATE_STATE" || upperAction === "MUTATE") {
                        const rawP = String(h.path || "").replace(/^data\./, "").trim();
                        const op = String(h.operation || h.op || "").toUpperCase();
                        let mutateExpr = `${rawP}.${op}`;
                        if (h.where && (h.where.field || h.where.prop || typeof h.where === "object")) {
                            const f = h.where.field || h.where.prop || Object.keys(h.where)[0];
                            const eq = h.where.equals !== undefined ? h.where.equals : h.where.val !== undefined ? h.where.val : h.where[f];
                            mutateExpr += ` where ${f}=${eq}`;
                        } else {
                            const payload = h.item !== undefined ? h.item : h.value !== undefined ? h.value : h.val;
                            if (payload !== undefined) {
                                const is = typeof payload === "object" ? JSON.stringify(payload) : String(payload);
                                mutateExpr += `(${is})`;
                            }
                        }
                        childEventTags.push(`<on_${evtName} action="MUTATE_STATE" mutate="${escapeXmlAttr(mutateExpr)}" />`);
                    } else if (action) {
                        childEventTags.push(`<on_${evtName} action="${escapeXmlAttr(action)}" />`);
                    }
                }
            }
        } else if (typeof handler === "string") {
            const trimmed = handler.trim();
            if (trimmed.startsWith("set:") || trimmed.startsWith("toggle:") || trimmed.startsWith("mutate:") || trimmed.startsWith("call:") || trimmed.startsWith("run:")) {
                const parts = trimmed.split(":");
                attrs.push(`on_${evtName}:${parts[0]}="${escapeXmlAttr(parts.slice(1).join(":"))}"`);
            } else if (trimmed.includes("=") || trimmed.includes("+") || trimmed.includes("-")) {
                attrs.push(`on_${evtName}:set="${escapeXmlAttr(trimmed)}"`);
            } else {
                attrs.push(`on_${evtName}:call="${escapeXmlAttr(trimmed)}"`);
            }
        } else if (handler && typeof handler === "object") {
            if (handler.set) {
                attrs.push(`on_${evtName}:set="${escapeXmlAttr(handler.set)}"`);
            } else if (handler.toggle) {
                attrs.push(`on_${evtName}:toggle="${escapeXmlAttr(handler.toggle)}"`);
            } else if (handler.mutate) {
                attrs.push(`on_${evtName}:mutate="${escapeXmlAttr(handler.mutate)}"`);
            } else if (handler.revalidate) {
                attrs.push(`on_${evtName}:revalidate="${escapeXmlAttr(handler.revalidate)}"`);
            } else if (handler.run || handler.script) {
                attrs.push(`on_${evtName}:run="${escapeXmlAttr(handler.run || handler.script)}"`);
            } else if (handler.emit) {
                attrs.push(`on_${evtName}:emit="${escapeXmlAttr(handler.emit)}"`);
            } else if (handler.focus) {
                attrs.push(`on_${evtName}:focus="${escapeXmlAttr(handler.focus)}"`);
            } else {
                const action = (handler.action || handler.$action || handler.call || "").trim();
                const upperAction = action.toUpperCase();

                if (upperAction === "SET_STATE") {
                    const rawP = String(handler.path || handler.set || "").replace(/^data\./, "").trim();
                    let valStr = "";
                    if (handler.value !== undefined) {
                        valStr = typeof handler.value === "object" ? JSON.stringify(handler.value) : String(handler.value);
                    } else if (handler.val !== undefined) {
                        valStr = typeof handler.val === "object" ? JSON.stringify(handler.val) : String(handler.val);
                    }
                    if (rawP && valStr !== "") {
                        attrs.push(`on_${evtName}:set="${escapeXmlAttr(`${rawP}=${valStr}`)}"`);
                    } else if (rawP) {
                        attrs.push(`on_${evtName}:set="${escapeXmlAttr(rawP)}"`);
                    }
                } else if (upperAction === "TOGGLE_STATE" || upperAction === "TOGGLE") {
                    const rawP = String(handler.path || handler.toggle || "").replace(/^data\./, "").trim();
                    if (rawP) {
                        attrs.push(`on_${evtName}:toggle="${escapeXmlAttr(rawP)}"`);
                    }
                } else if (upperAction === "MUTATE_STATE" || upperAction === "MUTATE") {
                    const rawP = String(handler.path || "").replace(/^data\./, "").trim();
                    const op = String(handler.operation || handler.op || "").toUpperCase();
                    if (handler.mutate) {
                        attrs.push(`on_${evtName}:mutate="${escapeXmlAttr(handler.mutate)}"`);
                    } else if (rawP && op) {
                        let mutateExpr = `${rawP}.${op}`;
                        if (handler.where && (handler.where.field || handler.where.prop || typeof handler.where === "object")) {
                            const f = handler.where.field || handler.where.prop || Object.keys(handler.where)[0];
                            const eq = handler.where.equals !== undefined ? handler.where.equals : handler.where.val !== undefined ? handler.where.val : handler.where[f];
                            mutateExpr += ` where ${f}=${eq}`;
                        } else {
                            const payload = handler.item !== undefined ? handler.item : handler.value !== undefined ? handler.value : handler.val;
                            if (payload !== undefined) {
                                const is = typeof payload === "object" ? JSON.stringify(payload) : String(payload);
                                mutateExpr += `(${is})`;
                            }
                        }
                        attrs.push(`on_${evtName}:mutate="${escapeXmlAttr(mutateExpr)}"`);
                    }
                } else if (upperAction === "REVALIDATE_API" || upperAction === "REVALIDATE") {
                    const tag = handler.tag || handler.endpoint || handler.id || "";
                    attrs.push(`on_${evtName}:revalidate="${escapeXmlAttr(tag)}"`);
                } else if (upperAction === "RUN_SCRIPT") {
                    const code = handler.code || handler.script || handler.run || "";
                    attrs.push(`on_${evtName}:run="${escapeXmlAttr(code)}"`);
                } else if (action) {
                    attrs.push(`on_${evtName}:call="${escapeXmlAttr(action)}"`);
                }
            }
        }
    }

    const attrsStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    const children = Array.isArray(node.children) ? node.children : [];

    if (children.length === 0 && childEventTags.length === 0) {
        lines.push(`${indent}<${tagName}${attrsStr} />`);
    } else if (children.length === 1 && typeof children[0] !== "object" && childEventTags.length === 0) {
        // Single inline text child
        lines.push(`${indent}<${tagName}${attrsStr}>${escapeXmlText(String(children[0]))}</${tagName}>`);
    } else {
        lines.push(`${indent}<${tagName}${attrsStr}>`);
        for (const evtTag of childEventTags) {
            lines.push(`${indent}  ${evtTag}`);
        }
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
                    if (options.useToonForArrays || options.format === "toon") {
                        const toonBody = jsonToToon(val, { rootName: key, indent: 6 });
                        lines.push(`    <state id="${escapeXmlAttr(key)}" type="array" format="toon">\n${toonBody}\n    </state>`);
                        continue;
                    }
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
                const rawExpr = typeof compDef === "string" ? compDef : compDef?.get || "";
                const expr = wrapCdataIfNeeded(rawExpr);
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
            if (typeof actDef === "string") {
                lines.push(`    <step call="${escapeXmlAttr(actDef)}" />`);
            } else if (typeof actDef === "object" && actDef !== null) {
                if (Array.isArray(actDef.steps)) {
                    for (const step of actDef.steps) {
                        if (typeof step === "string") {
                            lines.push(`    <step call="${escapeXmlAttr(step)}" />`);
                        } else if (typeof step === "object" && step !== null) {
                            if (step.run) {
                                lines.push(`    <step action="RUN_SCRIPT">${wrapCdataIfNeeded(step.run)}</step>`);
                            } else if (step.set) {
                                for (const [k, v] of Object.entries(step.set)) {
                                    lines.push(`    <step action="SET_STATE" path="${escapeXmlAttr(k)}" value="${escapeXmlAttr(String(v))}" />`);
                                }
                            } else if (step.mutate) {
                                lines.push(`    <step action="MUTATE_STATE" path="${escapeXmlAttr(step.mutate.path || step.mutate.target)}" operation="${escapeXmlAttr(step.mutate.op || step.mutate.operation)}" />`);
                            } else {
                                const call = step.call || step.action || "";
                                const assignAttr = step.assign ? ` assign="${escapeXmlAttr(step.assign)}"` : "";
                                lines.push(`    <step call="${escapeXmlAttr(call)}"${assignAttr} />`);
                            }
                        }
                    }
                } else if (actDef.run) {
                    lines.push(`    <step action="RUN_SCRIPT">${wrapCdataIfNeeded(actDef.run)}</step>`);
                } else if (actDef.set) {
                    for (const [k, v] of Object.entries(actDef.set)) {
                        lines.push(`    <step action="SET_STATE" path="${escapeXmlAttr(k)}" value="${escapeXmlAttr(String(v))}" />`);
                    }
                } else if (actDef.mutate) {
                    lines.push(`    <step action="MUTATE_STATE" path="${escapeXmlAttr(actDef.mutate.path || actDef.mutate.target)}" operation="${escapeXmlAttr(actDef.mutate.op || actDef.mutate.operation)}" />`);
                } else {
                    const call = actDef.call || actDef.action || "";
                    const assignAttr = actDef.assign ? ` assign="${escapeXmlAttr(actDef.assign)}"` : "";
                    lines.push(`    <step call="${escapeXmlAttr(call)}"${assignAttr} />`);
                }
            }
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
