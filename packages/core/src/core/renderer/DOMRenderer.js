/**
 * src/core/renderer/DOMRenderer.js
 * High-performance DOM node instantiation, layout styling, dynamic attribute binding, and template interpolation for EUIX Engine.
 */

import {
    ALLOWED_HTML_TAGS,
    EVENT_TAGS,
    getChildNodes,
    getTagName,
    isElem,
    isFn,
    isTxtNode,
    METADATA_AND_EVENT_TAGS,
    SVG_NAMESPACE,
    SVG_TAGS,
    SVG_CANONICAL_TAGS,
    isStr,
    getAttr,
    queryAll,
    toInt,
    getChildrenList,
} from "../utils/constants.js";
import { renderForEach } from "./ForEachRenderer.js";
import { renderErrorBoundary } from "./ErrorBoundaryRenderer.js";
import { registerScopedBinding } from "../binding/BindingResolver.js";
import { renderSlotElement } from "./SlotRenderer.js";
import {
    renderFormControl,
    renderInputElement,
    renderSelectElement,
    renderOptionElement,
    renderTextareaElement,
    renderFormElement,
} from "./formControls.js";
import { applyLayoutStyles, applyItemChildStyles } from "./LayoutStyles.js";
import { scopeCSS, processStyleTag } from "./StyleProcessor.js";

export { applyLayoutStyles, applyItemChildStyles };

import {
    extractStateKeys,
    interpolate,
    evalCondition,
} from "./TemplateInterpolator.js";
import {
    appendChildren,
    renderConditional,
} from "./ConditionalRenderer.js";
import {
    resolveBindPath,
    applyNodeAttributes,
    updateAttributeBinding,
    applyRef,
} from "./AttributeBinder.js";

export {
    extractStateKeys,
    interpolate,
    evalCondition,
    appendChildren,
    renderConditional,
    resolveBindPath,
    applyNodeAttributes,
    updateAttributeBinding,
    applyRef,
};

export function isStaticSubtree(xmlNode, engine = null) {
    if (!xmlNode) return false;
    if (xmlNode.nodeType === 3) {
        const txt = xmlNode.textContent || xmlNode.nodeValue || "";
        return !txt.includes("{");
    }
    if (!isElem(xmlNode)) return false;

    if (xmlNode._isStaticSubtree !== undefined) {
        return xmlNode._isStaticSubtree;
    }

    const tagName = (xmlNode.tagName || "").toLowerCase();
    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();
    const srcAttr = getAttr(xmlNode, "src", "url");
    const nameAttr = (xmlNode.getAttribute("name") || "").toLowerCase();

    if (
        srcAttr ||
        tagName.startsWith("on_") ||
        tagName === "button" ||
        tagName === "input" ||
        tagName === "select" ||
        tagName === "textarea" ||
        tagName === "form" ||
        tagName === "for_each" ||
        tagName === "component" ||
        tagName === "error_boundary" ||
        tagName === "error-boundary" ||
        tagName === "boundary" ||
        tagName === "import" ||
        tagName === "lazy" ||
        tagName === "slot" ||
        tagName === "children" ||
        tagName === "outlet" ||
        tagName === "conditional" ||
        tagName === "if" ||
        tagName === "style" ||
        tagName === "use_style" ||
        tagName === "use_script" ||
        tagName === "data_model" ||
        tagName === "constants" ||
        tagName === "actions" ||
        tagName === "action_def" ||
        tagName === "webmcp" ||
        tagName === "webmcp_tool" ||
        tagName === "webmcp-tool" ||
        typeAttr === "lazy" ||
        typeAttr === "component" ||
        typeAttr === "outlet" ||
        typeAttr === "custom" ||
        nameAttr === "lazy" ||
        xmlNode._hasEventTags ||
        METADATA_AND_EVENT_TAGS.has(tagName)
    ) {
        xmlNode._isStaticSubtree = false;
        return false;
    }

    const EngineClass = engine ? engine.constructor : null;
    if (
        EngineClass?._lazyRegistry?.has(tagName) ||
        EngineClass?._lazyRegistry?.has(nameAttr) ||
        EngineClass?._lazyRegistry?.has(typeAttr)
    ) {
        xmlNode._isStaticSubtree = false;
        return false;
    }

    if (engine) {
        if (
            engine._customComponents?.has(tagName) ||
            engine._componentSpecs?.has(tagName) ||
            (typeAttr && engine._customComponents?.has(typeAttr)) ||
            (typeAttr && engine._componentSpecs?.has(typeAttr)) ||
            (nameAttr && engine._componentSpecs?.has(nameAttr)) ||
            engine.constructor._globalCustomComponents?.has(tagName) ||
            engine.constructor._globalComponentSpecs?.has(tagName) ||
            (typeAttr && engine.constructor._globalCustomComponents?.has(typeAttr)) ||
            (typeAttr && engine.constructor._globalComponentSpecs?.has(typeAttr)) ||
            (nameAttr && engine.constructor._globalComponentSpecs?.has(nameAttr))
        ) {
            xmlNode._isStaticSubtree = false;
            return false;
        }
    }

    const attrs = xmlNode.attributes;
    if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            const name = attr.name.toLowerCase();
            const val = attr.value || "";
            if (name.startsWith("on_") || name === "bind" || name === "ref" || name === "if" || name === "condition" || name === "show" || name === "unless" || val.includes("{")) {
                xmlNode._isStaticSubtree = false;
                return false;
            }
        }
    }

    const children = xmlNode.childNodes;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (isElem(child)) {
                const childTag = (child.tagName || "").toLowerCase();
                if (childTag.startsWith("on_") || EVENT_TAGS.has(childTag)) {
                    xmlNode._isStaticSubtree = false;
                    return false;
                }
            }
            if (!isStaticSubtree(child, engine)) {
                xmlNode._isStaticSubtree = false;
                return false;
            }
        }
    }

    xmlNode._isStaticSubtree = true;
    return true;
}

export function createHTMLElement(engine, xmlNode, context = {}) {
    if (!xmlNode) return null;
    try {
        const el = engine._createHTMLElementInternal(xmlNode, context);
        if (el && isElem(el)) {
            engine.processLifecycleHooks(xmlNode, el, context);
        }
        return el;
    } catch (err) {
        engine.reportError(err, `Error rendering <${xmlNode.tagName || "element"}>`);
        if (typeof document === "undefined") return null;
        const fallback = document.createElement("div");
        fallback.className = "euix-error-fallback";
        fallback.style.cssText =
            "padding:4px 8px;margin:2px 0;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;color:#e11d48;font-size:11px;font-family:sans-serif;";
        fallback.textContent = `⚠️ Component Error: <${xmlNode.tagName || "unknown"}>`;
        return fallback;
    }
}

export function _createHTMLElementInternal(engine, xmlNode, context = {}) {
    if (!context._skipStaticClone && isElem(xmlNode)) {
        if (xmlNode._staticPrototype) {
            return xmlNode._staticPrototype.cloneNode(true);
        }
        if (xmlNode._isStaticSubtree === undefined) {
            if (isStaticSubtree(xmlNode, engine)) {
                const proto = _createHTMLElementInternal(engine, xmlNode, { ...context, _skipStaticClone: true });
                if (proto) {
                    xmlNode._staticPrototype = proto;
                    return proto.cloneNode(true);
                }
            } else {
                xmlNode._isStaticSubtree = false;
            }
        }
    }

    if (isTxtNode(xmlNode)) {
        const txt = xmlNode.textContent;
        if (!txt || txt.trim() === "") return null;

        // Fast-path: Static text without dynamic expressions
        if (txt.indexOf("{") === -1) {
            return document.createTextNode(txt);
        }

        let parent = xmlNode.parentNode;
        let isCodeBlock = false;
        while (parent) {
            if (parent.tagName) {
                const tag = getTagName(parent);
                if (tag === "code" || tag === "pre") {
                    isCodeBlock = true;
                    break;
                }
            }
            parent = parent.parentNode;
        }
        if (isCodeBlock && (!txt.includes("{") || !txt.includes("}"))) {
            return document.createTextNode(txt);
        }
        const textNode = document.createTextNode(engine.interpolate(txt, context));

        registerScopedBinding(
            engine,
            txt,
            textNode,
            "text_node",
            () => {
                textNode.textContent = engine.interpolate(txt, context);
            },
            context,
        );

        return textNode;
    }

    if (!isElem(xmlNode)) return null;

    const tagName = getTagName(xmlNode);
    if (METADATA_AND_EVENT_TAGS.has(tagName) || tagName.startsWith("on_")) {
        if (["use_script", "script_loader", "load_script"].includes(tagName)) {
            const src = getAttr(xmlNode, "src", "url");
            if (src) engine.loadScript(src, { async: xmlNode.getAttribute("async") !== "false" });
        } else if (["use_style", "style_loader", "load_style"].includes(tagName)) {
            const href = getAttr(xmlNode, "src", "href", "url");
            if (href) engine.loadStyle(href);
        } else if (tagName === "style") {
            processStyleTag(engine, xmlNode, context);
        }
        return null;
    }

    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();

    if (tagName === "slot" || tagName === "children") {
        return renderSlotElement(engine, xmlNode, context);
    }

    if (
        !context._evaluatingCondition &&
        tagName !== "if" &&
        tagName !== "else" &&
        tagName !== "else_if" &&
        (xmlNode.hasAttribute("if") || xmlNode.hasAttribute("condition"))
    ) {
        const condExpr = getAttr(xmlNode, "if", "condition");
        const containerNode = document.createElement("div");
        containerNode.className = "euix-conditional-wrapper";
        containerNode.style.display = "contents";

        const childCtx = { ...context, _evaluatingCondition: true };
        let currentEl = null;

        const renderBranch = () => {
            const isMatch = engine.evalCondition(condExpr, context);
            if (isMatch) {
                if (!currentEl) {
                    currentEl = engine.createHTMLElement(xmlNode, childCtx);
                    if (currentEl) containerNode.appendChild(currentEl);
                }
            } else {
                if (currentEl) {
                    if (currentEl.parentNode === containerNode) {
                        containerNode.removeChild(currentEl);
                    }
                    currentEl = null;
                }
            }
        };

        renderBranch();

        const stateKeys = engine.extractStateKeys(condExpr);
        for (const k of stateKeys) {
            engine.registerBinding(k, containerNode, "conditional", renderBranch);
        }

        return containerNode;
    }

    if (engine._customComponents.has(tagName) || engine.constructor._globalCustomComponents?.has(tagName)) {
        const handler =
            engine._customComponents.get(tagName) || engine.constructor._globalCustomComponents.get(tagName);
        const customEl = handler.call(engine, xmlNode, context, engine);
        if (customEl) return engine.applyRef(customEl, xmlNode, context);
    }

    if (
        typeAttr &&
        (engine._customComponents.has(typeAttr) || engine.constructor._globalCustomComponents?.has(typeAttr))
    ) {
        const handler =
            engine._customComponents.get(typeAttr) || engine.constructor._globalCustomComponents.get(typeAttr);
        const customEl = handler.call(engine, xmlNode, context, engine);
        if (customEl) return engine.applyRef(customEl, xmlNode, context);
    }

    if (engine._componentSpecs.has(tagName) || engine.constructor._globalComponentSpecs?.has(tagName)) {
        const specNode = engine._componentSpecs.get(tagName) || engine.constructor._globalComponentSpecs.get(tagName);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    const nameAttr = (xmlNode.getAttribute("name") || "").toLowerCase();
    if (nameAttr && (engine._componentSpecs.has(nameAttr) || engine.constructor._globalComponentSpecs?.has(nameAttr))) {
        const specNode = engine._componentSpecs.get(nameAttr) || engine.constructor._globalComponentSpecs.get(nameAttr);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    if (typeAttr && (engine._componentSpecs.has(typeAttr) || engine.constructor._globalComponentSpecs?.has(typeAttr))) {
        const specNode = engine._componentSpecs.get(typeAttr) || engine.constructor._globalComponentSpecs.get(typeAttr);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    const isFlex = tagName === "flex" || typeAttr === "flex";
    const isGrid = tagName === "grid" || typeAttr === "grid";

    if (isFlex || isGrid) {
        const el = document.createElement("div");
        el.style.display = isFlex ? "flex" : "grid";
        el.className = [
            isFlex ? "euix-flex" : "euix-grid",
            engine.interpolate(xmlNode.getAttribute("class") || xmlNode.getAttribute("className") || "", context),
        ]
            .filter(Boolean)
            .join(" ");
        engine.applyLayoutStyles(el, xmlNode, context);
        engine.bindEvents(xmlNode, el, context);

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const child = chNodes[i];
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) {
                engine.applyItemChildStyles(childEl, child, context);
                el.appendChild(childEl);
            }
        }

        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "error_boundary" || tagName === "error-boundary" || tagName === "boundary") {
        return renderErrorBoundary(engine, xmlNode, context);
    }

    if (tagName === "for_each") {
        return renderForEach(engine, xmlNode, context);
    }

    if (tagName === "if") {
        return engine.renderConditional(xmlNode, context);
    }

    if (tagName === "else" || tagName === "else_if") {
        return null;
    }

    const formEl = renderFormControl(engine, tagName, xmlNode, context);
    if (formEl) return formEl;

    if (tagName === "img" || tagName === "image") {
        const el = document.createElement("img");
        const imgClass = getAttr(xmlNode, "class", "className");
        if (imgClass) el.className = engine.interpolate(imgClass, context);
        const rawSrc = xmlNode.getAttribute("src") || "";
        const alt = xmlNode.getAttribute("alt") || "";
        const resolvedSrc = engine.interpolate(rawSrc, context);
        const fallbackSrc = xmlNode.getAttribute("fallback") || "";

        el.src = resolvedSrc || fallbackSrc;
        el.alt = engine.interpolate(alt, context);
        if (fallbackSrc) {
            el.onerror = () => {
                el.src = fallbackSrc;
            };
        }

        if (xmlNode.getAttribute("width")) el.width = toInt(xmlNode.getAttribute("width")) || undefined;
        if (xmlNode.getAttribute("height")) el.height = toInt(xmlNode.getAttribute("height")) || undefined;
        engine.bindEvents(xmlNode, el, context);
        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "button") {
        const el = document.createElement("button");
        const btnClass = getAttr(xmlNode, "class", "className");
        if (btnClass) el.className = engine.interpolate(btnClass, context);
        const btnType = xmlNode.getAttribute("type");
        if (btnType) el.type = btnType;
        engine.bindEvents(xmlNode, el, context);

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const child = chNodes[i];
            if (
                isElem(child) &&
                [
                    "on_click",
                    "on_change",
                    "on_submit",
                    "on_keyup",
                    "on_keydown",
                    "on_mouseenter",
                    "on_mouseleave",
                    "event",
                    "on",
                    "label",
                ].includes(getTagName(child))
            ) {
                if (getTagName(child) === "label") {
                    const lblText = engine.interpolate(child.textContent.trim(), context);
                    el.appendChild(document.createTextNode(lblText));
                }
                continue;
            }
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) el.appendChild(childEl);
        }

        return engine.applyRef(el, xmlNode, context);
    }

    // Dynamic Custom Tag Renderer (Plugins)
    const customRenderer =
        (engine._customTagRenderers && engine._customTagRenderers.get(tagName)) ||
        (engine.constructor._customTagRenderers && engine.constructor._customTagRenderers.get(tagName));
    if (customRenderer) {
        return customRenderer.call(engine, xmlNode, context);
    }

    const pluginRenderer =
        (tagName === "collapse" && engine.renderCollapse) ||
        (tagName === "dialog" && engine.renderDialog) ||
        ((tagName === "live_region" || tagName === "live-region") && engine.renderLiveRegion) ||
        ((tagName === "head" || tagName === "helmet") && engine.renderHead) ||
        (tagName === "title" && engine.renderHeadTitle);
    if (isFn(pluginRenderer)) {
        return pluginRenderer.call(engine, xmlNode, context);
    }

    if (tagName === "component") {
        const type = xmlNode.getAttribute("type");
        const bindPath = engine.resolveBindPath(xmlNode);
        let el;

        if (type === "title") el = document.createElement("h2");
        else if (type === "text") el = document.createElement("span");
        else if (type === "button") el = document.createElement("button");
        else if (type === "image") {
            el = document.createElement("img");
            const src = xmlNode.getAttribute("src") || "";
            const alt = xmlNode.getAttribute("alt") || "";
            el.src = engine.interpolate(src, context);
            el.alt = engine.interpolate(alt, context);
            if (xmlNode.getAttribute("width")) el.width = toInt(xmlNode.getAttribute("width")) || undefined;
            if (xmlNode.getAttribute("height")) el.height = toInt(xmlNode.getAttribute("height")) || undefined;
        } else if (type === "text_input") {
            el = document.createElement("input");
            el.type = "text";
            el.placeholder = xmlNode.getAttribute("placeholder") || "";

            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");

                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, {
                        sourceEl: e.target,
                    });
                };
            } else {
                const valNode = engine.getChild(xmlNode, "value");
                if (valNode) el.value = engine.interpolate(valNode.textContent, context);
            }

            if (xmlNode.getAttribute("autofocus") === "true") {
                el.dataset.xuiAutofocus = "true";
            }
        } else if (type === "checkbox") {
            el = document.createElement("input");
            el.type = "checkbox";
            const binding = engine.resolveBinding(xmlNode, context);
            if (binding) {
                el.checked = engine.isTruthy(engine.getBindingValue(binding, context));
                if (binding.type === "state") {
                    engine.registerBinding(binding.path, el, "checkbox");
                }
                el.onchange = (e) => {
                    const next = e.target.checked ? "true" : "false";
                    engine.setBindingValue(binding, next, context);
                };
            }
        } else if (type === "radio") {
            el = document.createElement("input");
            el.type = "radio";
            const radioName = xmlNode.getAttribute("name") || "xui_radio";
            el.name = engine.interpolate(radioName, context);
            const radioVal = xmlNode.getAttribute("value") || "";
            el.value = engine.interpolate(radioVal, context);

            const binding = engine.resolveBinding(xmlNode, context);
            if (binding) {
                const current = String(engine.getBindingValue(binding, context) ?? "");
                el.checked = current === el.value;
                if (binding.type === "state") {
                    engine.registerBinding(binding.path, el, "radio");
                }
                el.onchange = (e) => {
                    if (e.target.checked) {
                        engine.setBindingValue(binding, el.value, context);
                    }
                };
            }
        } else if (type === "textarea") {
            el = document.createElement("textarea");
            if (xmlNode.getAttribute("placeholder"))
                el.placeholder = engine.interpolate(xmlNode.getAttribute("placeholder"), context);
            if (xmlNode.getAttribute("rows")) el.rows = toInt(xmlNode.getAttribute("rows"));
            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");
                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, { sourceEl: e.target });
                };
            }
        } else if (["number_input", "range_input", "date_input", "color_input", "file_input"].includes(type)) {
            el = document.createElement("input");
            el.type = type.replace("_input", "");
            if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
            if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
            if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
            if (xmlNode.getAttribute("placeholder")) el.placeholder = xmlNode.getAttribute("placeholder");

            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");
                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, { sourceEl: e.target });
                };
            }
        } else {
            try {
                el = document.createElement(tagName);
                if (tagName === "form") {
                    el.onsubmit = (e) => {
                        e.preventDefault();
                    };
                }
            } catch (_) {
                el = document.createElement("div");
            }
        }

        const elClass = engine.interpolate(xmlNode.getAttribute("class") || xmlNode.getAttribute("className") || "", context);
        if (elClass && el) el.className = elClass;

        if (type === "text" && bindPath) {
            const templateNode = engine.getChild(xmlNode, "template");
            let inlineTemplate = "";
            const chNodes = xmlNode.childNodes;
            const chLen = chNodes ? chNodes.length : 0;
            for (let i = 0; i < chLen; i++) {
                const n = chNodes[i];
                if (isTxtNode(n)) inlineTemplate += n.textContent || "";
            }
            inlineTemplate = inlineTemplate.trim();

            if (templateNode) {
                const html = templateNode.innerHTML.trim();
                if (html.includes("<")) el.dataset.xuiHtmlTemplate = html;
                else el.dataset.xuiTextTemplate = templateNode.textContent.trim();
            } else if (inlineTemplate.includes("{value}")) {
                el.dataset.xuiTextTemplate = inlineTemplate;
            }

            engine.registerBinding(bindPath, el, "text");
            engine.syncBindings(bindPath, engine.getState(bindPath));
        }

        engine.bindEvents(xmlNode, el, context);

        const compChNodes = xmlNode.childNodes;
        const compChLen = compChNodes ? compChNodes.length : 0;
        for (let i = 0; i < compChLen; i++) {
            const child = compChNodes[i];
            if (
                isElem(child) &&
                [
                    "on_click",
                    "on_change",
                    "on_submit",
                    "on_keyup",
                    "on_keydown",
                    "on_mouseenter",
                    "on_mouseleave",
                    "event",
                    "on",
                    "value",
                    "template",
                ].includes(getTagName(child))
            ) {
                continue;
            }
            if (type === "text" && bindPath && isTxtNode(child)) {
                continue;
            }
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) {
                engine.applyItemChildStyles(childEl, child, context);
                el.appendChild(childEl);
            }
        }

        return engine.applyRef(el, xmlNode, context);
    }

    const isSvg = tagName === "svg" || context.isSvg || SVG_TAGS.has(tagName);
    const elementTagName = isSvg || ALLOWED_HTML_TAGS.has(tagName) ? tagName : "div";
    const canonicalTagName = isSvg
        ? (SVG_CANONICAL_TAGS[tagName.toLowerCase()] || xmlNode.tagName || tagName)
        : elementTagName;
    const div = isSvg
        ? document.createElementNS(SVG_NAMESPACE, canonicalTagName)
        : document.createElement(canonicalTagName);
    const xmlClass = engine.interpolate(xmlNode.getAttribute("class") || xmlNode.getAttribute("className") || "", context);
    if (xmlClass) {
        if (isSvg) div.setAttribute("class", xmlClass);
        else div.className = xmlClass;
    }

    if (tagName === "layout") {
        const layoutType = xmlNode.getAttribute("type") || "";
        div.className = [layoutType, xmlClass].filter(Boolean).join(" ");
        engine.applyLayoutStyles(div, xmlNode, context);
    }

    engine.bindEvents(xmlNode, div, context);

    const isCodeOrPreTag = tagName === "code" || tagName === "pre";
    const isInsideCodeOrPre = context._isInsideCodeOrPre || isCodeOrPreTag;
    const childContext = isSvg
        ? isInsideCodeOrPre
            ? { ...context, isSvg: true, _isInsideCodeOrPre: true }
            : { ...context, isSvg: true }
        : isInsideCodeOrPre && !context._isInsideCodeOrPre
          ? { ...context, _isInsideCodeOrPre: true }
          : context;

    const gChNodes = xmlNode.childNodes;
    const gChLen = gChNodes ? gChNodes.length : 0;
    for (let i = 0; i < gChLen; i++) {
        const child = gChNodes[i];
        if (isElem(child) && (EVENT_TAGS.has(getTagName(child)) || METADATA_AND_EVENT_TAGS.has(getTagName(child)))) {
            continue;
        }
        const childEl = engine.createHTMLElement(child, childContext);
        if (childEl) {
            engine.applyItemChildStyles(childEl, child, childContext);
            div.appendChild(childEl);
        }
    }

    const childElementNodes = getChildNodes(xmlNode).filter((n) => isElem(n) && !EVENT_TAGS.has(getTagName(n)));

    let hasCodeOrPreDescendant = xmlNode._hasCodeOrPre;
    if (hasCodeOrPreDescendant === undefined) {
        hasCodeOrPreDescendant = xmlNode.querySelector
            ? !!(xmlNode.querySelector("code") || xmlNode.querySelector("pre"))
            : false;
        xmlNode._hasCodeOrPre = hasCodeOrPreDescendant;
    }

    if (
        !isInsideCodeOrPre &&
        !hasCodeOrPreDescendant &&
        childElementNodes.length === 0 &&
        !["input", "select", "textarea", "form", "code", "pre"].includes(tagName) &&
        ![
            "text_input",
            "checkbox",
            "radio",
            "textarea",
            "number_input",
            "range_input",
            "date_input",
            "color_input",
            "file_input",
        ].includes(typeAttr)
    ) {
        const bindAttr = xmlNode.getAttribute("bind");
        if (bindAttr) {
            const genericBindPath = engine.resolveBindPath(xmlNode);
            if (genericBindPath) {
                const isLocal =
                    context._localState &&
                    (context._localState[genericBindPath] !== undefined || genericBindPath.startsWith("local."));
                const cleanPath = genericBindPath.replace(/^local\./, "");
                const bindKey = context._instanceId && isLocal ? `${context._instanceId}:${cleanPath}` : cleanPath;
                const trimmed = xmlNode.textContent ? xmlNode.textContent.trim() : "";
                if (trimmed.includes("{value}")) {
                    div.dataset.euixTextTemplate = trimmed;
                }
                engine.registerBinding(bindKey, div, "text");
                engine.syncBindings(bindKey, isLocal ? context._localState[cleanPath] : engine.getState(cleanPath));
            }
        }
    }

    const isContentEditable =
        xmlNode.getAttribute("contenteditable") === "true" || xmlNode.getAttribute("contenteditable") === "";
    if (isContentEditable) {
        const binding = engine.resolveBinding(xmlNode, context);
        if (binding) {
            const initialVal = engine.getBindingValue(binding, context);
            if (initialVal !== undefined && initialVal !== null) {
                div.innerHTML = String(initialVal);
            }
            const updateFn = (val) => {
                if (typeof document !== "undefined" && document.activeElement !== div) {
                    div.innerHTML = val !== undefined && val !== null ? String(val) : "";
                }
            };
            if (binding.type === "state") {
                engine.registerBinding(binding.path, div, "contenteditable", updateFn);
            }
            div.addEventListener("input", () => {
                engine.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
            });
            div.addEventListener("blur", () => {
                engine.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
            });
        }
    }

    return engine.applyRef(div, xmlNode, context);
}

export function render(engine) {
    if (!engine.container || !engine.xmlDoc) return;

    engine._bindings = new Map();
    engine.refs = {};
    const root = engine.getChild(engine.xmlDoc, "uid_spec") || engine.xmlDoc.querySelector("uid_spec") || engine.xmlDoc;
    const metadataTags = [
        "data_model",
        "imports",
        "import",
        "constants",
        "vars",
        "variables",
        "component_def",
        "actions",
        "action_def",
        "workflow_def",
        "api_config",
        "api_endpoint",
        "endpoint",
        "api",
        "persistence",
        "navigator_config",
        "device_config",
        "date_config",
        "date-config",
        "date_settings",
        "date-settings",
        "on_mount",
        "on_unmount",
        "on_interval",
        "on_state_change",
        "use_script",
        "use_style",
        "style",
        "animations",
        "animation_def",
        "watch",
        "computed",
        "head",
        "helmet",
        "title",
        "webmcp",
        "webmcp_tool",
        "webmcp-tool",
    ];

    if (isFn(engine.parseHeadMetadata)) {
        engine.parseHeadMetadata(root);
    }
    if (isFn(engine.parseWebMCPMetadata)) {
        engine.parseWebMCPMetadata(root);
    }

    const rootStyles = queryAll(root, "style, use_style, style_loader, load_style");
    rootStyles.forEach((st) => {
        if (st.closest && st.closest("component_def")) return;
        const sTag = (st.tagName || "").toLowerCase();
        if (sTag === "style") {
            processStyleTag(engine, st, {});
        } else {
            const href = getAttr(st, "src", "href", "url");
            if (href) engine.loadStyle(href);
        }
    });

    let uiChildren = Array.from(root.children || []).filter(
        (c) => c.tagName && !metadataTags.includes(getTagName(c)),
    );
    if (uiChildren.length === 0) {
        const fallback = queryAll(root, "*").find(
            (c) => c.tagName && !metadataTags.includes(getTagName(c)) && !c.closest("component_def"),
        );
        if (fallback) {
            uiChildren = [fallback];
        } else if (root.tagName && !metadataTags.includes(getTagName(root))) {
            uiChildren = [root];
        }
    }

    if (uiChildren.length > 0 && engine.container) {
        engine.container.innerHTML = "";
        const fragment = document.createDocumentFragment();
        for (const childNode of uiChildren) {
            const dom = engine.createHTMLElement(childNode);
            if (dom) {
                fragment.appendChild(dom);
            }
        }
        engine.container.appendChild(fragment);
    }

    const autofocusEl = engine.container.querySelector("[data-euix-autofocus='true']");
    if (autofocusEl && isFn(autofocusEl.focus)) {
        autofocusEl.focus();
    }
}

export { scopeCSS, processStyleTag };

export {
    renderErrorBoundary,
    renderSlotElement,
    renderFormControl,
    renderInputElement,
    renderSelectElement,
    renderOptionElement,
    renderTextareaElement,
    renderFormElement,
};
