/**
 * src/core/renderer/SlotRenderer.js
 * Component slot, default projection, named slots, and scoped-slot variable binding renderer.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import { getChildNodes, getTagName, isElem, isStr, getAttr } from "../utils/constants.js";

/**
 * Renders a <slot> or <children> element, projecting named or default children from context._projectedSlots.
 * Supports scoped slot properties passed via attributes (e.g. item="{item}", index="{$index}")
 * and consumed via let="..." or let:prop="..." in parent projection templates.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLElement}
 */
export function renderSlotElement(engine, xmlNode, context = {}) {
    const frag = document.createElement("div");
    frag.style.display = "contents";
    frag.className = "euix-slot-wrapper";

    const slotName = xmlNode.getAttribute("name");
    const slots = context._projectedSlots;
    let projectedNodes = [];

    if (slotName && slots?.named?.has(slotName)) {
        projectedNodes = slots.named.get(slotName);
    } else if (!slotName && slots?.default?.length > 0) {
        projectedNodes = slots.default;
    }

    // 1. Extract scoped slot properties from <slot ...> attributes (e.g. item="{item}", index="{$index}")
    const slotScopeProps = {};
    if (xmlNode.attributes && xmlNode.attributes.length > 0) {
        const aLen = xmlNode.attributes.length;
        for (let i = 0; i < aLen; i++) {
            const a = xmlNode.attributes[i];
            if (a.name !== "name" && a.name !== "type" && a.name !== "class" && a.name !== "style") {
                const val = a.value;
                let resolvedVal;
                if (
                    isStr(val) &&
                    val.startsWith("{") &&
                    val.endsWith("}") &&
                    !val.slice(1, -1).includes("{")
                ) {
                    const rawExpr = val.slice(1, -1).trim();
                    resolvedVal = engine.resolveValueFromPath(rawExpr, context);
                    if (resolvedVal === undefined) {
                        try {
                            resolvedVal = EUIXExpressionParser.eval(rawExpr, (k) =>
                                engine.resolveValueFromPath(k, context),
                            );
                        } catch (_) {
                            resolvedVal = engine.interpolate(val, context);
                        }
                    }
                } else {
                    resolvedVal = engine.interpolate(val, context);
                }
                slotScopeProps[a.name] = resolvedVal;
            }
        }
    }

    if (projectedNodes.length > 0) {
        const baseContext = slots?.parentContext || context;
        projectedNodes.forEach((pNode) => {
            const pTag = getTagName(pNode);

            // Build scoped context with variables
            const scopedContext = {
                ...baseContext,
                ...slotScopeProps,
                $slot: slotScopeProps,
                slotProps: slotScopeProps,
            };

            if (isElem(pNode)) {
                const scopeVarName =
                    getAttr(pNode, "let", "var", "as", "slot_scope", "scope");

                if (scopeVarName) {
                    scopedContext[scopeVarName] = slotScopeProps;
                }

                if (pNode.attributes) {
                    const pAttrs = pNode.attributes;
                    const paLen = pAttrs.length;
                    for (let i = 0; i < paLen; i++) {
                        const a = pAttrs[i];
                        if (a.name.startsWith("let:") || a.name.startsWith("var:")) {
                            const targetVar = a.name.slice(4);
                            const sourceProp = a.value ? a.value.trim() : targetVar;
                            scopedContext[targetVar] =
                                slotScopeProps[sourceProp] !== undefined
                                    ? slotScopeProps[sourceProp]
                                    : slotScopeProps;
                        }
                    }
                }
            }

            if (pTag === "slot" || pTag === "template") {
                getChildNodes(pNode).forEach((c) => {
                    const el = engine.createHTMLElement(c, scopedContext);
                    if (el) frag.appendChild(el);
                });
            } else {
                const el = engine.createHTMLElement(pNode, scopedContext);
                if (el) frag.appendChild(el);
            }
        });
    } else {
        const fallbackContext = {
            ...context,
            ...slotScopeProps,
            $slot: slotScopeProps,
            slotProps: slotScopeProps,
        };
        getChildNodes(xmlNode).forEach((c) => {
            const el = engine.createHTMLElement(c, fallbackContext);
            if (el) frag.appendChild(el);
        });
    }
    return frag;
}
