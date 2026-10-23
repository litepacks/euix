/**
 * src/core/renderer/AttributeBinder.js
 * Dynamic XML node attribute resolution, two-way bindings, boolean attributes, refs, and style directives for EUIX Engine.
 */

import {
    BOOLEAN_ATTRS,
    SVG_NAMESPACE,
    isFn,
    isObj,
    isStr,
    safeParse,
} from "../utils/constants.js";
import {
    extractBindModifiers,
    registerScopedBinding,
} from "../binding/BindingResolver.js";

export function resolveBindPath(engine, xmlNode) {
    if (isStr(xmlNode)) {
        return engine.parseBindPath(xmlNode);
    }
    if (!xmlNode) return "";
    const { bindAttr } = extractBindModifiers(xmlNode);
    if (bindAttr) return engine.parseBindPath(bindAttr);

    const onChange = engine.getChild(xmlNode, "on_change");
    if (onChange && isFn(onChange.getAttribute) && onChange.getAttribute("action") === "SET_STATE") {
        const pathNode = engine.getChild(onChange, "path");
        if (pathNode) return engine.parseBindPath(pathNode.textContent);
    }

    const valNode = engine.getChild(xmlNode, "value");
    if (valNode) {
        const match = String(valNode.textContent || "")
            .trim()
            .match(/^\{data\.(\w+)\}$/);
        if (match) return match[1];
    }

    if (xmlNode.textContent) {
        const match = String(xmlNode.textContent || "")
            .trim()
            .match(/^\{data\.(\w+)\}$/);
        if (match) return match[1];
    }

    return "";
}

export function applyNodeAttributes(engine, el, xmlNode, context = {}) {
    if (!el || !xmlNode || xmlNode.nodeType !== 1 || !xmlNode.attributes) return;

    const validationAttrs = ["pattern", "minlength", "maxlength", "min", "max", "step", "title", "autocomplete"];
    const attrs = xmlNode.attributes;
    const aLen = attrs.length;

    for (let aIdx = 0; aIdx < aLen; aIdx++) {
        const attr = attrs[aIdx];
        const attrName = attr.name;
        const attrValue = attr.value;
        if (attrValue === undefined || attrValue === null) continue;

        const lowerAttrName = attrName.toLowerCase();

        if (attrName === "id") {
            const idVal = engine.interpolate(attrValue, context);
            el.id = idVal;
            el.setAttribute("id", idVal);
        } else if (
            lowerAttrName === "test-id" ||
            lowerAttrName === "test_id" ||
            lowerAttrName === "testid" ||
            lowerAttrName === "data-testid" ||
            lowerAttrName === "data-euix-test"
        ) {
            const testVal = engine.interpolate(attrValue, context);
            el.setAttribute("data-euix-test", testVal);
            el.setAttribute(attrName, testVal);
        } else if (lowerAttrName === "action" || lowerAttrName === "data-euix-action") {
            const actionVal = engine.interpolate(attrValue, context);
            el.setAttribute("data-euix-action", actionVal);
            el.setAttribute(attrName, actionVal);
        } else if (attrName.startsWith("on") && attrName.length > 2 && !attrName.startsWith("on_")) {
            const eventName = attrName.toLowerCase();
            const handlerCode = engine.interpolate(attrValue, context);
            try {
                const isAsync = handlerCode.includes("await ");
                const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
                el[eventName] = isAsync
                    ? new AsyncFn("event", "$evt", handlerCode)
                    : new Function("event", "$evt", handlerCode);
            } catch (_) {
                el.setAttribute(attrName, handlerCode);
            }
        } else if (BOOLEAN_ATTRS.has(lowerAttrName)) {
            const interpolated = engine.interpolate(attrValue, context);
            const lower = String(interpolated).trim().toLowerCase();
            const isExplicitFalse = lower === "false" || lower === "0" || lower === "null" || lower === "undefined";
            const isBoolTrue =
                !isExplicitFalse &&
                (lower === "true" ||
                    lower === "1" ||
                    lower === lowerAttrName ||
                    (attrValue === "" && !String(attrValue).includes("{")));

            if (isBoolTrue) {
                el.setAttribute(attrName, "");
                try {
                    el[attrName] = true;
                } catch (_) {}
            } else {
                el.removeAttribute(attrName);
                try {
                    el[attrName] = false;
                } catch (_) {}
            }
        } else if (validationAttrs.includes(lowerAttrName)) {
            if (!attrValue.includes("data.") && !attrValue.includes("local.")) {
                el.setAttribute(attrName, engine.interpolate(attrValue, context));
            }
        } else if (attrName === "class" || attrName === "className") {
            const interpolatedVal = engine.interpolate(attrValue, context);
            if (el.namespaceURI === SVG_NAMESPACE) {
                el.setAttribute("class", interpolatedVal);
            } else {
                if (
                    el.className &&
                    el.className !== interpolatedVal &&
                    !el.className.split(" ").includes(interpolatedVal)
                ) {
                    el.className = [el.className, interpolatedVal].filter(Boolean).join(" ");
                } else if (!el.className) {
                    el.className = interpolatedVal;
                }
            }
        } else if (attrName === "style") {
            let interpolatedVal = engine.interpolate(attrValue, context);
            if (
                isStr(interpolatedVal) &&
                interpolatedVal.trim().startsWith("{") &&
                interpolatedVal.trim().endsWith("}")
            ) {
                const parsed = safeParse(interpolatedVal);
                if (isObj(parsed)) {
                    interpolatedVal = Object.entries(parsed)
                        .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                        .map(
                            ([k, v]) =>
                                `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
                        )
                        .join(" ");
                }
            } else if (isObj(interpolatedVal)) {
                interpolatedVal = Object.entries(interpolatedVal)
                    .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                    .join(" ");
            }
            el.setAttribute("style", interpolatedVal);
        } else if (attrName === "type") {
            el.setAttribute("type", engine.interpolate(attrValue, context));
        } else {
            const interpolatedVal = engine.interpolate(attrValue, context);
            el.setAttribute(attrName, interpolatedVal);
            if (attrName === "draggable") {
                try {
                    const isDraggable = interpolatedVal === "true";
                    if (isFn(engine.enableDraggable)) {
                        engine.enableDraggable(el, isDraggable, context);
                    } else {
                        el.draggable = isDraggable;
                    }
                } catch (_) {}
            }
        }

        if (attrValue && isStr(attrValue) && attrValue.includes("{")) {
            const hasBinding = registerScopedBinding(
                engine,
                attrValue,
                el,
                "attribute",
                () => {
                    engine.updateAttributeBinding(el, attrName, attrValue, context);
                },
                context,
            );
            if (hasBinding) {
                engine.updateAttributeBinding(el, attrName, attrValue, context);
            }
        }
    }
}

export function updateAttributeBinding(engine, el, attrName, template, context = {}) {
    if (!el || !attrName || !template) return;
    const newAttrVal = engine.interpolate(template, context);
    const lowerAttrName = attrName.toLowerCase();

    if (BOOLEAN_ATTRS.has(lowerAttrName)) {
        const lower = String(newAttrVal).trim().toLowerCase();
        const isExplicitFalse =
            lower === "false" || lower === "0" || lower === "null" || lower === "undefined" || lower === "";
        const isBoolTrue =
            !isExplicitFalse &&
            (lower === "true" || lower === "1" || lower === lowerAttrName || engine.isTruthy(newAttrVal));

        if (isBoolTrue) {
            el.setAttribute(attrName, "");
            try {
                el[attrName] = true;
            } catch (_) {}
        } else {
            el.removeAttribute(attrName);
            try {
                el[attrName] = false;
            } catch (_) {}
        }
        return;
    }

    if (attrName === "value" && "value" in el && el.namespaceURI !== SVG_NAMESPACE) {
        if (el.value !== newAttrVal) el.value = newAttrVal;
    } else if (attrName === "class" && el.namespaceURI !== SVG_NAMESPACE) {
        let finalVal = newAttrVal;
        if (el.classList && el.classList.contains("euix-flex") && !finalVal.includes("euix-flex")) {
            finalVal = `euix-flex ${finalVal}`.trim();
        } else if (el.classList && el.classList.contains("euix-grid") && !finalVal.includes("euix-grid")) {
            finalVal = `euix-grid ${finalVal}`.trim();
        }
        if (el.className !== finalVal) el.className = finalVal;
    } else if (attrName === "style") {
        let styleVal = newAttrVal;
        if (isStr(styleVal) && styleVal.trim().startsWith("{") && styleVal.trim().endsWith("}")) {
            const parsed = safeParse(styleVal);
            if (isObj(parsed)) {
                styleVal = Object.entries(parsed)
                    .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                    .map(
                        ([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
                    )
                    .join(" ");
            }
        } else if (isObj(styleVal)) {
            styleVal = Object.entries(styleVal)
                .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                .join(" ");
        }
        if (el.getAttribute("style") !== styleVal) el.setAttribute("style", styleVal);
    } else {
        if (el.getAttribute(attrName) !== newAttrVal) el.setAttribute(attrName, newAttrVal);
    }
}

export function applyRef(engine, el, xmlNode, context = {}) {
    if (!el || !xmlNode || xmlNode.nodeType !== 1) return el;
    engine.applyNodeAttributes(el, xmlNode, context);

    const showAttr = xmlNode.getAttribute("show");
    if (showAttr) {
        const updateShow = () => {
            const isVisible = engine.evalCondition(showAttr, context);
            el.style.display = isVisible ? "" : "none";
        };
        updateShow();
        const keys = engine.extractStateKeys(showAttr);
        for (const k of keys) {
            engine.registerBinding(k, el, "attribute", updateShow);
        }
    }

    const unlessAttr = xmlNode.getAttribute("unless");
    if (unlessAttr) {
        const updateUnless = () => {
            const isMatch = engine.evalCondition(unlessAttr, context);
            el.style.display = !isMatch ? "" : "none";
        };
        updateUnless();
        const keys = engine.extractStateKeys(unlessAttr);
        for (const k of keys) {
            engine.registerBinding(k, el, "attribute", updateUnless);
        }
    }

    const refAttr = xmlNode.getAttribute("ref");
    if (refAttr) {
        const resolvedRef = engine.interpolate(refAttr, context);
        if (resolvedRef) {
            engine.refs[resolvedRef] = el;
            el.dataset.euixRef = resolvedRef;
            el.dataset.xuiRef = resolvedRef;
            if (isFn(el.setAttribute)) {
                el.setAttribute("data-euix-ref", resolvedRef);
                el.setAttribute("data-xui-ref", resolvedRef);
            }
        }
    }
    return el;
}
