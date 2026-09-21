/**
 * packages/core/src/prepare/parser/xmlToJson.js
 * Converts EUIX XML templates (<uid_spec>) into canonical EUIX Source JSON representation.
 */

import { parseXmlToAst } from "../../core/parser/AstParser.js";
import { DIAGNOSTIC_CODES, createDiagnostic } from "../validator/diagnostics.js";

/**
 * Parse an attribute value into a canonical JSON representation.
 * Handles {data.key}, {props.key}, {$route: ...}
 *
 * @param {string} val
 * @returns {any}
 */
function parseAttributeValue(val) {
    if (typeof val !== "string") return val;
    const trimmed = val.trim();

    // {data.path} or {path} -> { "$bind": path }
    const bindMatch = trimmed.match(/^\{(?:data\.)?([a-zA-Z0-9_$.]+)\}$/);
    if (bindMatch) {
        return { $bind: bindMatch[1] };
    }

    // {props.path} -> { "$prop": path }
    const propMatch = trimmed.match(/^\{props\.([a-zA-Z0-9_$.]+)\}$/);
    if (propMatch) {
        return { $prop: propMatch[1] };
    }

    // Boolean coercion
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // Numeric coercion if strictly numeric
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }

    return val;
}

/**
 * Parses state node text according to its type attribute.
 *
 * @param {Element} stateEl
 * @returns {any}
 */
function parseStateValue(stateEl) {
    const type = stateEl.getAttribute("type") || "string";
    const raw = (stateEl.textContent || "").trim();

    if (type === "number") {
        const num = Number(raw);
        return isNaN(num) ? 0 : num;
    }
    if (type === "boolean") {
        return raw === "true";
    }
    if (type === "array" || type === "object") {
        if (!raw || raw === "null") return type === "array" ? [] : null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return type === "array" ? [] : {};
        }
    }
    return raw;
}

/**
 * Recursively converts a DOM node from XML into a canonical JSON view node.
 *
 * @param {Element} el
 * @returns {object|string|null}
 */
function convertDomToViewNode(el) {
    if (!el) return null;

    // Text node
    if (el.nodeType === 3) {
        const text = el.textContent || "";
        if (!text.trim()) return null;
        const bindMatch = text.trim().match(/^\{(?:data\.)?([a-zA-Z0-9_$.]+)\}$/);
        if (bindMatch) return { $bind: bindMatch[1] };
        return text;
    }

    if (el.nodeType !== 1) return null;

    const tagName = el.tagName.toLowerCase();

    // Skip definition/config tags that belong to the top-level
    if (
        [
            "data_model",
            "component_def",
            "import",
            "route",
            "lifecycle",
            "on_mount",
            "on_unmount",
            "watch",
            "action_def",
            "api_config",
        ].includes(tagName)
    ) {
        return null;
    }

    // Component invocation tag (<component name="UserCard" ... /> or <UserCard ... />)
    const isComponentTag = tagName === "component";
    const componentName = isComponentTag
        ? el.getAttribute("name") || el.getAttribute("is")
        : /^[A-Z]/.test(el.tagName)
        ? el.tagName
        : null;

    const node = {};
    if (componentName) {
        node.component = componentName;
    } else {
        node.tag = tagName;
    }

    const props = {};
    const events = {};

    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const name = attr.name;
        const val = attr.value;

        if (isComponentTag && (name === "name" || name === "is")) continue;

        // Action shorthands: on_click:call="action", on_click:set="...", etc.
        if (name.startsWith("on_")) {
            const eventName = name.split(":")[0].replace(/^on_/, "");
            if (name.includes(":call") || name.includes(":set") || name.includes(":toggle")) {
                events[eventName] = { $action: val };
            } else {
                events[eventName] = val;
            }
            continue;
        }

        // Two-way state binding: bind="counter" or bind="{data.counter}"
        if (name === "bind") {
            const cleanPath = val.replace(/^\{(?:data\.)?|\}$/g, "").trim();
            props["bind"] = { $bind: cleanPath };
            continue;
        }

        props[name] = parseAttributeValue(val);
    }

    // Child elements and event listener tags (<on_click action="...">)
    const children = [];
    for (let i = 0; i < el.childNodes.length; i++) {
        const childEl = el.childNodes[i];
        if (childEl.nodeType === 1 && childEl.tagName.toLowerCase().startsWith("on_")) {
            const evtName = childEl.tagName.toLowerCase().replace(/^on_/, "");
            const actionAttr = childEl.getAttribute("action") || childEl.getAttribute("call");
            if (actionAttr) {
                events[evtName] = { $action: actionAttr };
            }
            continue;
        }

        const childNode = convertDomToViewNode(childEl);
        if (childNode !== null) {
            children.push(childNode);
        }
    }

    if (Object.keys(props).length > 0) node.props = props;
    if (Object.keys(events).length > 0) node.events = events;
    if (children.length > 0) node.children = children;

    return node;
}

/**
 * Convert an EUIX XML string (<uid_spec>) into a canonical EUIX Source JSON representation.
 *
 * @param {string} xmlString
 * @param {string} [fileName="source.euix"]
 * @returns {{ source: object|null, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }}
 */
export function parseXmlToJson(xmlString, fileName = "source.euix") {
    const diagnostics = [];
    if (!xmlString || typeof xmlString !== "string") {
        diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "empty-xml",
                file: fileName,
                path: "",
                message: "XML source is empty.",
            }),
        );
        return { source: null, diagnostics };
    }

    const doc = parseXmlToAst(xmlString, { silent: true });
    if (!doc) {
        diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "xml-parse-error",
                file: fileName,
                path: "",
                message: "Failed to parse XML document.",
            }),
        );
        return { source: null, diagnostics };
    }

    const parserError = doc.querySelector ? doc.querySelector("parsererror") : null;
    if (parserError) {
        diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "xml-syntax-error",
                file: fileName,
                path: "",
                message: parserError.textContent.trim(),
            }),
        );
        return { source: null, diagnostics };
    }

    const root = doc.documentElement || doc;

    const source = {
        version: 1,
        imports: {},
        route: null,
        props: {},
        state: {},
        computed: {},
        watch: {},
        actions: {},
        lifecycle: { mount: [], unmount: [] },
        provide: {},
        inject: null,
        components: {},
        view: null,
    };

    // 1. Parse Imports
    const importEls = root.querySelectorAll ? Array.from(root.querySelectorAll("import")) : [];
    importEls.forEach((imp) => {
        const name = imp.getAttribute("name") || imp.getAttribute("as");
        const src = imp.getAttribute("src");
        if (name && src) {
            source.imports[name] = src;
        }
    });

    // 2. Parse Route
    const routeEl = root.querySelector ? root.querySelector("route") : null;
    if (routeEl) {
        source.route = {
            path: routeEl.getAttribute("path") || "/",
        };
    }

    // 3. Parse Data Model (state & computed)
    const stateEls = root.querySelectorAll ? Array.from(root.querySelectorAll("data_model > state, state")) : [];
    stateEls.forEach((st) => {
        const id = st.getAttribute("id") || st.getAttribute("name");
        if (id) {
            source.state[id] = parseStateValue(st);
        }
    });

    const computedEls = root.querySelectorAll ? Array.from(root.querySelectorAll("data_model > computed, computed")) : [];
    computedEls.forEach((cmp) => {
        const id = cmp.getAttribute("id") || cmp.getAttribute("name");
        if (id) {
            const depsAttr = cmp.getAttribute("deps");
            const deps = depsAttr ? depsAttr.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const expr = (cmp.textContent || "").trim();
            source.computed[id] = { deps, get: expr };
        }
    });

    // 4. Parse Watchers
    const watchEls = root.querySelectorAll ? Array.from(root.querySelectorAll("watch")) : [];
    watchEls.forEach((w) => {
        const path = w.getAttribute("path") || w.getAttribute("id");
        const action = w.getAttribute("action");
        if (path) {
            source.watch[path] = { action: action || null };
        }
    });

    // 5. Parse Actions
    const actionEls = root.querySelectorAll ? Array.from(root.querySelectorAll("action_def")) : [];
    actionEls.forEach((act) => {
        const name = act.getAttribute("name") || act.getAttribute("id");
        if (name) {
            const stepEl = act.querySelector ? act.querySelector("step") : null;
            if (stepEl) {
                source.actions[name] = {
                    call: stepEl.getAttribute("call") || stepEl.getAttribute("action") || "",
                    assign: stepEl.getAttribute("assign") || stepEl.getAttribute("target") || null,
                };
            } else {
                source.actions[name] = { call: name };
            }
        }
    });

    // 6. Parse Lifecycle (<lifecycle>, <on_mount>, <on_unmount>)
    const mountEls = root.querySelectorAll ? Array.from(root.querySelectorAll("lifecycle > on_mount, on_mount")) : [];
    mountEls.forEach((m) => {
        const act = m.getAttribute("action") || m.getAttribute("call");
        if (act) source.lifecycle.mount.push({ $action: act });
    });

    const unmountEls = root.querySelectorAll ? Array.from(root.querySelectorAll("lifecycle > on_unmount, on_unmount")) : [];
    unmountEls.forEach((u) => {
        const act = u.getAttribute("action") || u.getAttribute("call");
        if (act) source.lifecycle.unmount.push({ $action: act });
    });

    // 7. Parse Components (<component_def>)
    const compEls = root.querySelectorAll ? Array.from(root.querySelectorAll("component_def")) : [];
    compEls.forEach((cd) => {
        const name = cd.getAttribute("name") || cd.getAttribute("id");
        if (name) {
            // Find children to form the component view
            const childViews = [];
            for (let i = 0; i < cd.childNodes.length; i++) {
                const node = convertDomToViewNode(cd.childNodes[i]);
                if (node) childViews.push(node);
            }
            source.components[name] = {
                view: childViews.length === 1 ? childViews[0] : { tag: "div", children: childViews },
            };
        }
    });

    // 8. Parse Top-level View
    const topViews = [];
    for (let i = 0; i < root.childNodes.length; i++) {
        const node = convertDomToViewNode(root.childNodes[i]);
        if (node) topViews.push(node);
    }

    if (topViews.length === 1) {
        source.view = topViews[0];
    } else if (topViews.length > 1) {
        source.view = { tag: "div", children: topViews };
    }

    return { source, diagnostics };
}
