/**
 * packages/core/src/prepare/runtime/adapter.js
 * Runtime adapter translating normalized Runtime IR into executable EUIX Engine specifications.
 */

import { EUIXEngineCore } from "../../core/EUIXEngineCore.js";
import { parseXmlToAst } from "../../core/parser/AstParser.js";

/**
 * Converts a normalized IR view node into an XML string representation.
 *
 * @param {any} node
 * @returns {string}
 */
function irViewNodeToXml(node) {
    if (node === null || node === undefined) return "";
    if (typeof node === "string") return node;
    if (typeof node === "number" || typeof node === "boolean") return String(node);

    if (Array.isArray(node)) {
        return node.map(irViewNodeToXml).join("\n");
    }

    // State binding: { type: "state", path: "user" }
    if (node.type === "state" && node.path) {
        return `{data.${node.path}}`;
    }

    // Prop binding: { type: "prop", propName: "title" }
    if (node.type === "prop" && node.propName) {
        return `{props.${node.propName}}`;
    }

    const tagName = node.componentName || node.tag || "div";
    const attrs = [];

    // Props
    if (node.props && typeof node.props === "object") {
        for (const [k, v] of Object.entries(node.props)) {
            if (v && typeof v === "object" && v.type === "state") {
                attrs.push(`${k}="{data.${v.path}}"`);
            } else if (v && typeof v === "object" && v.type === "prop") {
                attrs.push(`${k}="{props.${v.propName}}"`);
            } else if (v && typeof v === "object" && v.type === "action") {
                attrs.push(`${k}="{${v.actionName}}"`);
            } else if (typeof v === "string") {
                attrs.push(`${k}="${v.replace(/"/g, "&quot;")}"`);
            } else if (typeof v === "number" || typeof v === "boolean") {
                attrs.push(`${k}="${v}"`);
            }
        }
    }

    // Events
    if (node.events && typeof node.events === "object") {
        for (const [evt, handler] of Object.entries(node.events)) {
            const actionName = typeof handler === "object" ? handler.actionName : handler;
            if (actionName) {
                attrs.push(`on_${evt}:call="${actionName}"`);
            }
        }
    }

    // Directives
    if (node.items) {
        const itemsVal = node.items.path ? `{data.${node.items.path}}` : node.items;
        attrs.push(`items="${itemsVal}"`);
        if (node.var) attrs.push(`var="${node.var}"`);
        if (node.key) attrs.push(`key="${node.key}"`);
    }

    const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
    const childrenStr = Array.isArray(node.children) ? node.children.map(irViewNodeToXml).join("\n") : "";

    if (!childrenStr.trim()) {
        return `<${tagName}${attrStr} />`;
    }

    return `<${tagName}${attrStr}>${childrenStr}</${tagName}>`;
}

/**
 * Converts a normalized Runtime IR object into an in-memory EUIX XML specification.
 *
 * @param {object} ir
 * @returns {string} Complete XML <uid_spec> string
 */
export function irToXmlSpec(ir) {
    if (!ir) return "<uid_spec></uid_spec>";

    const dataModelParts = [];

    // 1. States
    if (Array.isArray(ir.states)) {
        for (const st of ir.states) {
            const typeAttr = st.type ? ` type="${st.type}"` : "";
            let initialVal = "";
            if (st.initial !== null && st.initial !== undefined) {
                initialVal = typeof st.initial === "object" ? JSON.stringify(st.initial) : String(st.initial);
            }
            dataModelParts.push(`    <state id="${st.name}"${typeAttr}>${initialVal}</state>`);
        }
    }

    // 2. Computed
    if (Array.isArray(ir.computed)) {
        for (const cmp of ir.computed) {
            const depsAttr = cmp.deps && cmp.deps.length > 0 ? ` deps="${cmp.deps.join(",")}"` : "";
            dataModelParts.push(`    <computed id="${cmp.name}"${depsAttr}>${cmp.get}</computed>`);
        }
    }

    const dataModelStr =
        dataModelParts.length > 0
            ? `  <data_model>\n${dataModelParts.join("\n")}\n  </data_model>`
            : "";

    // 3. Actions
    const actionParts = [];
    if (Array.isArray(ir.actions)) {
        for (const act of ir.actions) {
            if (act.steps && act.steps.length > 0) {
                actionParts.push(`  <action_def name="${act.name}">`);
                for (const st of act.steps) {
                    actionParts.push(`    <step action="${st.action || "SET_STATE"}" />`);
                }
                actionParts.push(`  </action_def>`);
            } else if (act.set) {
                actionParts.push(`  <action_def name="${act.name}">`);
                for (const [k, v] of Object.entries(act.set)) {
                    actionParts.push(`    <step action="SET_STATE"><path>${k}</path><value>${v}</value></step>`);
                }
                actionParts.push(`  </action_def>`);
            } else if (act.mutate) {
                actionParts.push(`  <action_def name="${act.name}">`);
                actionParts.push(`    <step action="MUTATE_STATE" path="${act.mutate.path}" operation="${act.mutate.op}" />`);
                actionParts.push(`  </action_def>`);
            }
        }
    }
    const actionsStr =
        actionParts.length > 0
            ? `  <actions>\n${actionParts.join("\n")}\n  </actions>`
            : "";

    // 4. Lifecycle
    const lifecycleParts = [];
    if (ir.lifecycle?.mount && Array.isArray(ir.lifecycle.mount)) {
        for (const m of ir.lifecycle.mount) {
            if (m.actionName) lifecycleParts.push(`    <on_mount action="${m.actionName}" />`);
        }
    }
    if (ir.lifecycle?.unmount && Array.isArray(ir.lifecycle.unmount)) {
        for (const u of ir.lifecycle.unmount) {
            if (u.actionName) lifecycleParts.push(`    <on_unmount action="${u.actionName}" />`);
        }
    }
    const lifecycleStr =
        lifecycleParts.length > 0
            ? `  <lifecycle>\n${lifecycleParts.join("\n")}\n  </lifecycle>`
            : "";

    // 5. Watchers
    const watchParts = [];
    if (Array.isArray(ir.watchers)) {
        for (const w of ir.watchers) {
            if (w.path && w.actionName) {
                watchParts.push(`  <watch path="${w.path}" action="${w.actionName}" />`);
            }
        }
    }
    const watchStr = watchParts.join("\n");

    // 6. View
    const viewStr = ir.view ? irViewNodeToXml(ir.view) : "";

    return [
        "<uid_spec>",
        dataModelStr,
        actionsStr,
        lifecycleStr,
        watchStr,
        viewStr,
        "</uid_spec>",
    ]
        .filter(Boolean)
        .join("\n");
}

/**
 * Mount a PreparedApp or Runtime IR into a DOM container.
 *
 * @param {object} preparedOrIr - PreparedApp instance or Runtime IR
 * @param {string|Element} [containerSelector="#app"]
 * @param {object} [options={}]
 * @returns {EUIXEngineCore}
 */
export function mountPrepared(preparedOrIr, containerSelector = "#app", options = {}) {
    const ir = preparedOrIr?.ir || preparedOrIr;
    const xml = irToXmlSpec(ir);

    const EngineClass = options.engineClass || EUIXEngineCore;
    const engine = new EngineClass(containerSelector);

    // Create a reactive $data proxy over engine state
    const dataProxy = new Proxy({}, {
        get(_, prop) {
            return engine.getState(prop);
        },
        set(_, prop, val) {
            engine.setState(prop, val);
            return true;
        },
    });

    // Register any custom actions defined in options with friendly context injection ($data, engine, $el)
    if (options.actions && typeof options.actions === "object") {
        for (const [name, fn] of Object.entries(options.actions)) {
            if (typeof fn === "function") {
                engine.action(name, (actionNode, context, eng, args) => {
                    const helperCtx = {
                        $data: dataProxy,
                        engine,
                        $el: context?._targetEl,
                        $evt: context?._evt,
                        ...context,
                    };
                    return fn(args, helperCtx);
                });
            }
        }
    }

    engine.mount(xml, options);
    return engine;
}
