/**
 * src/core/renderer/ForEachRenderer.js
 * Keyed reconciliation, longest increasing subsequence diffing, virtual scrolling, and <for_each> renderer for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import { _getNodeAtPath, _getStaticNodeResolver, EMPTY_ARR, getForEachItemHash } from "../utils/constants.js";

const _EXT_KEY_RE = /\{(?:data\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

export function _isVisualXmlChild(n) {
    if (n.nodeType === 3) return Boolean(n.textContent && n.textContent.trim() !== "");
    if (n.nodeType === 1) {
        const tag = (n.tagName || "").toLowerCase();
        return !(
            tag.startsWith("on_") ||
            tag === "confirm" ||
            tag === "step" ||
            tag === "param" ||
            tag === "where" ||
            tag === "when"
        );
    }
    return false;
}

export function _setItemIndex(item, idx) {
    if (item && typeof item === "object" && Object.isExtensible(item)) {
        if (item._index !== idx) {
            if ("_index" in item) {
                item._index = idx;
            } else {
                try {
                    Object.defineProperty(item, "_index", {
                        value: idx,
                        writable: true,
                        configurable: true,
                        enumerable: false,
                    });
                } catch {
                    item._index = idx;
                }
            }
        }
        if (item.index !== idx) {
            if ("index" in item) {
                item.index = idx;
            } else {
                try {
                    Object.defineProperty(item, "index", {
                        value: idx,
                        writable: true,
                        configurable: true,
                        enumerable: false,
                    });
                } catch {
                    item.index = idx;
                }
            }
        }
    }
}

export function _extractExternalKeysFromExpr(expr, varName, targetSet) {
    if (!expr?.includes("{")) return;
    _EXT_KEY_RE.lastIndex = 0;
    let m;
    while ((m = _EXT_KEY_RE.exec(expr)) !== null) {
        const key = m[1];
        if (key && key !== varName && key !== "_index" && key !== "index") {
            targetSet.add(key);
        }
    }
}

import { _getLongestIncreasingSubsequence, _reconcileKeyedDOM } from "./KeyedReconciler.js";
export { _getLongestIncreasingSubsequence, _reconcileKeyedDOM };


export function _isComplexForEachChild(engine, node) {
    if (node?.nodeType !== 1) return false;
    const tag = (node.tagName || "").toLowerCase();
    const EngineClass = engine.constructor;
    if (
        node.getAttribute?.("draggable") === "true" ||
        node.getAttribute?.("draggable") === "" ||
        node.getAttribute?.("bind") ||
        (tag === "component" &&
            (node.getAttribute("src") ||
                (node.getAttribute("name") &&
                    !["text", "title", "checkbox", "button", "badge", "input"].includes(node.getAttribute("type"))))) ||
        tag === "for_each" ||
        tag === "slot" ||
        tag === "children" ||
        tag === "if" ||
        tag === "else" ||
        tag === "collapse" ||
        tag === "dialog" ||
        engine._componentDefs?.[tag] ||
        engine._componentRegistry?.[tag] ||
        EngineClass._globalComponentSpecs?.has(tag)
    ) {
        return true;
    }
    const children = node.children || node.childNodes || EMPTY_ARR;
    const chLen = children.length;
    for (let i = 0; i < chLen; i++) {
        const c = children[i];
        if (c.nodeType === 1 && _isComplexForEachChild(engine, c)) return true;
    }
    return false;
}

export function _getCompiledForEachTemplate(engine, xmlNode, varName, baseChildContext, fallbackContext) {
    if (xmlNode._templatePrototype) {
        return xmlNode._templatePrototype;
    }

    const templateChildren = [];
    const rawChildren = xmlNode.children || xmlNode.childNodes || EMPTY_ARR;
    const rawLen = rawChildren.length;
    for (let i = 0; i < rawLen; i++) {
        const c = rawChildren[i];
        if (c.nodeType === 1) templateChildren.push(c);
    }

    let hasComplexChild = false;
    const tLen = templateChildren.length;
    for (let i = 0; i < tLen; i++) {
        if (_isComplexForEachChild(engine, templateChildren[i])) {
            hasComplexChild = true;
            break;
        }
    }
    if (hasComplexChild || tLen === 0) {
        xmlNode._templatePrototype = { canClone: false };
        return xmlNode._templatePrototype;
    }

    const sampleContext = Object.create(baseChildContext);
    sampleContext[varName] = {};
    sampleContext._index = 0;
    sampleContext.index = 0;

    const prototypes = [];
    const dynamicSlots = [];

    for (let cIdx = 0; cIdx < templateChildren.length; cIdx++) {
        const xmlChild = templateChildren[cIdx];
        const domChild = engine.createHTMLElement(xmlChild, sampleContext);
        if (!domChild) continue;
        engine.applyItemChildStyles(domChild, xmlChild, fallbackContext);

        const recordSlots = (xNode, dNode, path) => {
            if (!xNode || !dNode) return;

            if (xNode.nodeType === 3) {
                const txt = xNode.textContent;
                if (txt?.includes("{")) {
                    let getter = null;
                    const trimmed = txt.trim();
                    const match = trimmed.match(/^\{([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.([a-zA-Z0-9_$]+))?\}$/);
                    if (match) {
                        const [_, scope, prop] = match;
                        if (scope === varName) {
                            getter = prop ? (item) => String(item?.[prop] ?? "") : (item) => String(item ?? "");
                        }
                    } else if (trimmed.startsWith(`{${varName}.`) && trimmed.endsWith("}")) {
                        const innerPath = trimmed.slice(varName.length + 2, -1).trim();
                        if (/^[a-zA-Z0-9_.]+$/.test(innerPath)) {
                            const parts = innerPath.split(".");
                            getter = (item) => {
                                let curr = item;
                                for (let p = 0; p < parts.length && curr != null; p++) {
                                    curr = curr[parts[p]];
                                }
                                return String(curr ?? "");
                            };
                        }
                    }
                    if (!getter) {
                        const jitFn = EUIXExpressionParser.compileTemplateFunction(txt);
                        if (jitFn) {
                            getter = (item, ctx) => {
                                const dataScope = engine ? engine._rawState || engine.state : null;
                                return jitFn(dataScope, null, ctx, engine, (p) => engine.resolveValueFromPath(p, ctx));
                            };
                        } else {
                            getter = (_item, ctx) => engine.interpolate(txt, ctx);
                        }
                    }
                    dynamicSlots.push({
                        childIndex: cIdx,
                        path: [...path],
                        type: "text",
                        rawExpr: txt,
                        getter,
                        resolver: _getStaticNodeResolver(path),
                    });
                }
                return;
            }

            if (xNode.nodeType === 1) {
                const attrs = xNode.attributes;
                if (attrs) {
                    for (let aIdx = 0; aIdx < attrs.length; aIdx++) {
                        const attr = attrs[aIdx];
                        const attrName = attr.name;
                        const attrVal = attr.value;
                        if (attrVal?.includes("{") && !attrName.startsWith("on_")) {
                            let getter = null;
                            const trimmed = attrVal.trim();
                            const match = trimmed.match(/^\{([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.([a-zA-Z0-9_$]+))?\}$/);
                            if (match) {
                                const [_, scope, prop] = match;
                                if (scope === varName) {
                                    getter = prop ? (item) => String(item?.[prop] ?? "") : (item) => String(item ?? "");
                                }
                            } else if (trimmed.startsWith(`{${varName}.`) && trimmed.endsWith("}")) {
                                const innerPath = trimmed.slice(varName.length + 2, -1).trim();
                                if (/^[a-zA-Z0-9_.]+$/.test(innerPath)) {
                                    const parts = innerPath.split(".");
                                    getter = (item) => {
                                        let curr = item;
                                        for (let p = 0; p < parts.length && curr != null; p++) {
                                            curr = curr[parts[p]];
                                        }
                                        return String(curr ?? "");
                                    };
                                }
                            }
                            if (!getter) {
                                const jitFn = EUIXExpressionParser.compileTemplateFunction(attrVal);
                                if (jitFn) {
                                    getter = (item, ctx) => {
                                        const dataScope = engine ? engine._rawState || engine.state : null;
                                        return jitFn(dataScope, null, ctx, engine, (p) =>
                                            engine.resolveValueFromPath(p, ctx),
                                        );
                                    };
                                } else {
                                    getter = (_item, ctx) => engine.interpolate(attrVal, ctx);
                                }
                            }
                            dynamicSlots.push({
                                childIndex: cIdx,
                                path: [...path],
                                type: "attr",
                                name: attrName,
                                rawExpr: attrVal,
                                getter,
                                resolver: _getStaticNodeResolver(path),
                            });
                        }
                    }
                }

                const bindAttr = xNode.getAttribute("bind");
                if (bindAttr) {
                    dynamicSlots.push({
                        childIndex: cIdx,
                        path: [...path],
                        type: "bind",
                        bindPath: bindAttr,
                        resolver: _getStaticNodeResolver(path),
                    });
                }

                if (dNode._euixEventMap && dNode._euixEventMap.size > 0) {
                    const eventsObj = Object.create(null);
                    for (const [evType, handlers] of dNode._euixEventMap) {
                        eventsObj[evType] = handlers;
                    }
                    dynamicSlots.push({
                        childIndex: cIdx,
                        path: [...path],
                        type: "event",
                        eventMap: new Map(dNode._euixEventMap),
                        eventsObj,
                        resolver: _getStaticNodeResolver(path),
                    });
                }

                if (xNode.childNodes?.length === 1 && xNode.childNodes[0].nodeType === 3) {
                    const txt = xNode.childNodes[0].textContent;
                    if (txt?.includes("{")) {
                        let getter = null;
                        const trimmed = txt.trim();
                        const match = trimmed.match(/^\{([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.([a-zA-Z0-9_$]+))?\}$/);
                        if (match) {
                            const [_, scope, prop] = match;
                            if (scope === varName) {
                                getter = prop ? (item) => String(item?.[prop] ?? "") : (item) => String(item ?? "");
                            }
                        } else if (trimmed.startsWith(`{${varName}.`) && trimmed.endsWith("}")) {
                            const innerPath = trimmed.slice(varName.length + 2, -1).trim();
                            if (/^[a-zA-Z0-9_.]+$/.test(innerPath)) {
                                const parts = innerPath.split(".");
                                getter = (item) => {
                                    let curr = item;
                                    for (let p = 0; p < parts.length && curr != null; p++) {
                                        curr = curr[parts[p]];
                                    }
                                    return String(curr ?? "");
                                };
                            }
                        }
                        if (!getter) {
                            const jitFn = EUIXExpressionParser.compileTemplateFunction(txt);
                            if (jitFn) {
                                getter = (item, ctx) => {
                                    const dataScope = engine ? engine._rawState || engine.state : null;
                                    return jitFn(dataScope, null, ctx, engine, (p) =>
                                        engine.resolveValueFromPath(p, ctx),
                                    );
                                };
                            } else {
                                getter = (_item, ctx) => engine.interpolate(txt, ctx);
                            }
                        }
                        dynamicSlots.push({
                            childIndex: cIdx,
                            path: [...path],
                            type: "text",
                            rawExpr: txt,
                            getter,
                            resolver: _getStaticNodeResolver(path),
                        });
                    }
                    return;
                }

                const xChildNodes = xNode.childNodes;
                const xChildren = [];
                const xcLen = xChildNodes ? xChildNodes.length : 0;
                for (let i = 0; i < xcLen; i++) {
                    const c = xChildNodes[i];
                    if (_isVisualXmlChild(c)) xChildren.push(c);
                }
                const dChildren = dNode.childNodes;
                const len = Math.min(xChildren.length, dChildren ? dChildren.length : 0);
                for (let i = 0; i < len; i++) {
                    recordSlots(xChildren[i], dChildren[i], [...path, i]);
                }
            }
        };

        recordSlots(xmlChild, domChild, []);
        prototypes.push(domChild);
    }

    const externalKeys = new Set();
    for (let sIdx = 0; sIdx < dynamicSlots.length; sIdx++) {
        _extractExternalKeysFromExpr(dynamicSlots[sIdx].rawExpr, varName, externalKeys);
    }

    xmlNode._templatePrototype = {
        canClone: true,
        prototypes,
        dynamicSlots,
        getNodeAtPath: _getNodeAtPath,
        externalKeys,
    };

    return xmlNode._templatePrototype;
}

export function _applyForEachSlots(engine, nodes, compiled, item, childContext, varName) {
    if (!nodes || !compiled?.dynamicSlots) return;
    const slots = compiled.dynamicSlots;
    const slotLen = slots.length;
    for (let sIdx = 0; sIdx < slotLen; sIdx++) {
        const slot = slots[sIdx];
        const rootNode = nodes[slot.childIndex];
        if (!rootNode) continue;
        const targetNode = slot.resolver
            ? slot.resolver(rootNode)
            : slot.path.length === 0
              ? rootNode
              : compiled.getNodeAtPath(rootNode, slot.path);
        if (!targetNode) continue;

        if (slot.type === "text") {
            const txt = slot.getter ? slot.getter(item, childContext) : engine.interpolate(slot.rawExpr, childContext);
            if (targetNode.nodeType === 3) {
                if (targetNode.data !== txt) targetNode.data = txt;
            } else {
                if (targetNode._euixText !== txt) {
                    targetNode._euixText = txt;
                    targetNode.textContent = txt;
                }
            }
        } else if (slot.type === "attr") {
            const val = slot.getter ? slot.getter(item, childContext) : engine.interpolate(slot.rawExpr, childContext);
            if (slot.name === "class") {
                if (targetNode.className !== val) targetNode.className = val;
            } else {
                if (targetNode.getAttribute(slot.name) !== val) targetNode.setAttribute(slot.name, val);
            }
        } else if (slot.type === "bind") {
            const bp = slot.bindPath;
            let currentVal;
            if (bp.startsWith(`${varName}.`)) {
                const prop = bp.slice(varName.length + 1);
                currentVal = item ? item[prop] : undefined;
            } else {
                currentVal = engine.resolveValueFromPath(bp, childContext);
            }
            if (targetNode.type === "checkbox") {
                const isTrue = engine.isTruthy(currentVal);
                if (targetNode.checked !== isTrue) targetNode.checked = isTrue;
            } else {
                const sVal = currentVal ?? "";
                if (targetNode.value !== sVal) targetNode.value = sVal;
            }
            targetNode._euixBindPath = bp;
            targetNode._euixContext = { ...childContext };
        } else if (slot.type === "event") {
            targetNode._euixEventMap = slot.eventMap;
            targetNode.__euixEvents = slot.eventsObj;
            targetNode._euixContext = { ...childContext };
        }
    }
}

export function renderForEach(engine, xmlNode, context = {}) {
    const containerTag = xmlNode.getAttribute("as") || xmlNode.getAttribute("tag") || "div";
    const listContainer = document.createElement(containerTag);
    if (xmlNode.getAttribute("id")) listContainer.id = xmlNode.getAttribute("id");
    const customClass = xmlNode.getAttribute("class") || "";
    if (containerTag === "div") {
        listContainer.className = customClass ? `${customClass} euix-list-container` : "euix-list-container";
        listContainer.style.display = "contents";
    } else if (customClass) {
        listContainer.className = customClass;
    }

    engine._setupContainerEventDelegation(listContainer);

    const isVirtual = xmlNode.getAttribute("virtual") === "true" || xmlNode.getAttribute("virtual_scroll") === "true";
    const itemHeight = parseInt(xmlNode.getAttribute("item_height") || xmlNode.getAttribute("row_height") || "40", 10);
    const containerHeight = xmlNode.getAttribute("height") || xmlNode.getAttribute("max_height") || "400px";
    const buffer = parseInt(xmlNode.getAttribute("buffer") || "4", 10);

    let spacer = null;
    let contentWrapper = null;

    if (isVirtual) {
        listContainer.style.display = "block";
        listContainer.style.position = "relative";
        listContainer.style.overflowY = "auto";
        listContainer.style.height =
            containerHeight.includes("px") || containerHeight.includes("%") || containerHeight.includes("vh")
                ? containerHeight
                : `${containerHeight}px`;
        listContainer.className = [listContainer.className, "euix-virtual-list", xmlNode.getAttribute("class") || ""]
            .filter(Boolean)
            .join(" ");

        spacer = document.createElement("div");
        spacer.className = "euix-virtual-spacer";
        spacer.style.width = "100%";
        spacer.style.pointerEvents = "none";
        listContainer.appendChild(spacer);

        contentWrapper = document.createElement("div");
        contentWrapper.className = "euix-virtual-content";
        contentWrapper.style.position = "absolute";
        contentWrapper.style.top = "0";
        contentWrapper.style.left = "0";
        contentWrapper.style.right = "0";
        listContainer.appendChild(contentWrapper);
    }

    const itemsAttr = xmlNode.getAttribute("items") || "";
    const itemsKey = engine.parseBindPath(itemsAttr);
    const varName = xmlNode.getAttribute("var") || "item";
    const keyAttr =
        xmlNode.getAttribute("key") || xmlNode.getAttribute("key_field") || xmlNode.getAttribute("item_key") || "";

    let getItemKey;
    if (!keyAttr || keyAttr === "id") {
        getItemKey = (item, idx) =>
            item && item.id != null ? item.id : item && item._key != null ? item._key : `__idx_${idx}`;
    } else if (!keyAttr.includes("{")) {
        getItemKey = (item, idx) =>
            item && item[keyAttr] != null ? item[keyAttr] : item && item.id != null ? item.id : `__idx_${idx}`;
    } else {
        getItemKey = (item, idx) => {
            const childContext = {
                ...context,
                [varName]: item,
                _index: idx,
                index: idx,
                _parentStateKey: itemsKey,
                _insideForEach: true,
            };
            const res = engine.interpolate(keyAttr, childContext);
            return res !== undefined && res !== null && res !== ""
                ? String(res)
                : item && item.id !== undefined && item.id !== null
                  ? String(item.id)
                  : `__idx_${idx}`;
        };
    }

    const getItemHash = getForEachItemHash;

    const baseChildContext = Object.create(context);
    baseChildContext._parentStateKey = itemsKey;
    baseChildContext._insideForEach = true;

    const compiled = _getCompiledForEachTemplate(engine, xmlNode, varName, baseChildContext, context);
    const pooledItemContext = Object.create(baseChildContext);

    const rawTemplateChildren = xmlNode.children || xmlNode.childNodes || EMPTY_ARR;
    const templateChildren = [];
    for (let tcIdx = 0; tcIdx < rawTemplateChildren.length; tcIdx++) {
        const tc = rawTemplateChildren[tcIdx];
        if (tc.nodeType === 1) templateChildren.push(tc);
    }

    const createItemNodes = (item, idx) => {
        if (compiled?.canClone) {
            pooledItemContext[varName] = item;
            pooledItemContext.item = item;
            pooledItemContext._varName = varName;
            pooledItemContext._index = idx;
            pooledItemContext.index = idx;
            pooledItemContext.$index = idx;
            const protos = compiled.prototypes;
            const protoLen = protos.length;
            if (protoLen === 1) {
                const nodes = [protos[0].cloneNode(true)];
                _applyForEachSlots(engine, nodes, compiled, item, pooledItemContext, varName);
                return nodes;
            }
            const nodes = new Array(protoLen);
            for (let pIdx = 0; pIdx < protoLen; pIdx++) {
                nodes[pIdx] = protos[pIdx].cloneNode(true);
            }
            _applyForEachSlots(engine, nodes, compiled, item, pooledItemContext, varName);
            return nodes;
        }

        const childContext = Object.create(baseChildContext);
        childContext[varName] = item;
        childContext.item = item;
        childContext._varName = varName;
        childContext._index = idx;
        childContext.index = idx;
        childContext.$index = idx;

        const nodes = [];
        for (let cIdx = 0; cIdx < templateChildren.length; cIdx++) {
            const child = templateChildren[cIdx];
            const el = engine.createHTMLElement(child, childContext);
            if (el) {
                engine.applyItemChildStyles(el, child, context);
                nodes.push(el);
            }
        }
        return nodes;
    };

    const renderItems = () => {
        let list =
            engine._rawState?.[itemsKey] && Array.isArray(engine._rawState[itemsKey])
                ? engine._rawState[itemsKey]
                : null;
        if (!list) {
            const resolved = engine.resolveValueFromPath(itemsKey || itemsAttr.replace(/^\{|\}$/g, ""), context);
            if (Array.isArray(resolved)) {
                list = resolved;
            } else {
                list = [];
            }
        }

        if (isVirtual) {
            const totalItems = list.length;
            spacer.style.height = `${totalItems * itemHeight}px`;

            if (totalItems === 0) {
                contentWrapper.innerHTML = "";
                contentWrapper.style.transform = "translateY(0px)";
                contentWrapper._keyedNodesMap = new Map();
                return;
            }

            const renderSlice = () => {
                const scrollTop = listContainer.scrollTop || 0;
                const clientHeight = listContainer.clientHeight || parseInt(containerHeight, 10) || 400;
                const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
                const endIndex = Math.min(totalItems, Math.ceil((scrollTop + clientHeight) / itemHeight) + buffer);

                contentWrapper.style.transform = `translateY(${startIndex * itemHeight}px)`;

                contentWrapper._keyedNodesMap = contentWrapper._keyedNodesMap || new Map();
                const oldKeyedMap = contentWrapper._keyedNodesMap;
                const newKeyedMap = new Map();
                const activeKeys = new Set();
                const itemNodesSequence = [];

                for (let i = startIndex; i < endIndex; i++) {
                    const item = list[i];
                    if (!item) continue;
                    _setItemIndex(item, i);

                    const key = getItemKey(item, i);
                    const hash = getItemHash(item);
                    activeKeys.add(key);

                    const existing = oldKeyedMap.get(key);
                    let nodes;

                    if (existing?.nodes && existing.nodes.length > 0) {
                        if (existing.hash === hash) {
                            nodes = existing.nodes;
                        } else if (compiled?.canClone) {
                            pooledItemContext[varName] = item;
                            pooledItemContext._index = i;
                            pooledItemContext.index = i;
                            _applyForEachSlots(engine, existing.nodes, compiled, item, pooledItemContext, varName);
                            nodes = existing.nodes;
                        } else {
                            nodes = createItemNodes(item, i);
                            existing.nodes.forEach((oldNode) => {
                                if (oldNode && oldNode.parentNode === contentWrapper) {
                                    contentWrapper.removeChild(oldNode);
                                }
                            });
                        }
                    } else {
                        nodes = createItemNodes(item, i);
                    }
                    newKeyedMap.set(key, { nodes, hash, index: i });
                    itemNodesSequence.push(...nodes);
                }

                oldKeyedMap.forEach((existing, key) => {
                    if (!activeKeys.has(key) && existing.nodes) {
                        existing.nodes.forEach((oldNode) => {
                            if (oldNode && oldNode.parentNode === contentWrapper) {
                                contentWrapper.removeChild(oldNode);
                            }
                        });
                    }
                });

                const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
                for (let nIdx = 0; nIdx < itemNodesSequence.length; nIdx++) {
                    const node = itemNodesSequence[nIdx];
                    if (node) {
                        if (fragment) fragment.appendChild(node);
                        else contentWrapper.appendChild(node);
                    }
                }
                if (fragment) {
                    contentWrapper.appendChild(fragment);
                }
                contentWrapper._keyedNodesMap = newKeyedMap;
            };

            renderSlice();

            if (!listContainer._virtualScrollBound) {
                listContainer._virtualScrollBound = true;
                let ticking = false;
                listContainer.addEventListener(
                    "scroll",
                    () => {
                        if (!ticking) {
                            (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb) => cb())(
                                () => {
                                    renderSlice();
                                    ticking = false;
                                },
                            );
                            ticking = true;
                        }
                    },
                    { passive: true },
                );
            }
            return;
        }

        listContainer._keyedNodesMap = listContainer._keyedNodesMap || new Map();
        const oldKeyedMap = listContainer._keyedNodesMap;
        const oldKeys = listContainer._oldKeysSequence || [];
        const newKeyedMap = new Map();
        const newKeys = [];

        const oldLen = oldKeys.length;
        const listLen = list.length;

        // Fast-Path 1: Initial Mount / Empty Container
        if (oldLen === 0) {
            const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
            const seenKeys = new Set();
            for (let idx = 0; idx < listLen; idx++) {
                const item = list[idx];
                _setItemIndex(item, idx);

                const rawKey = getItemKey(item, idx);
                let key = rawKey;
                if (seenKeys.has(key)) {
                    key = `${rawKey}__dup_${idx}`;
                }
                seenKeys.add(key);

                const hash = (item && (item._hash ?? item.__v ?? item.id)) ?? getItemHash(item);
                const nodes = createItemNodes(item, idx);
                newKeys.push(key);
                newKeyedMap.set(key, { nodes, hash, index: idx });
                const nLen = nodes.length;
                if (fragment) {
                    for (let n = 0; n < nLen; n++) fragment.appendChild(nodes[n]);
                } else {
                    for (let n = 0; n < nLen; n++) listContainer.appendChild(nodes[n]);
                }
            }
            if (fragment) listContainer.appendChild(fragment);
            listContainer._keyedNodesMap = newKeyedMap;
            listContainer._oldKeysSequence = newKeys;
            return;
        }

        // Fast-Path 2: Pure Append to existing list
        if (listLen > oldLen) {
            let isPureAppend = true;
            for (let i = 0; i < oldLen; i++) {
                if (getItemKey(list[i], i) !== oldKeys[i]) {
                    isPureAppend = false;
                    break;
                }
            }
            if (isPureAppend) {
                const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
                const seenKeys = new Set(oldKeys);
                for (let idx = oldLen; idx < listLen; idx++) {
                    const item = list[idx];
                    _setItemIndex(item, idx);

                    const rawKey = getItemKey(item, idx);
                    let key = rawKey;
                    if (seenKeys.has(key)) {
                        key = `${rawKey}__dup_${idx}`;
                    }
                    seenKeys.add(key);

                    const hash = (item && (item._hash ?? item.__v ?? item.id)) ?? getItemHash(item);
                    const nodes = createItemNodes(item, idx);
                    oldKeys.push(key);
                    oldKeyedMap.set(key, { nodes, hash, index: idx });
                    const nLen = nodes.length;
                    if (fragment) {
                        for (let n = 0; n < nLen; n++) fragment.appendChild(nodes[n]);
                    } else {
                        for (let n = 0; n < nLen; n++) listContainer.appendChild(nodes[n]);
                    }
                }
                if (fragment) listContainer.appendChild(fragment);
                listContainer._oldKeysSequence = oldKeys;
                return;
            }
        }

        // Fast-Path 3: Identical Keys In-Place Patch (Zero DOM moves)
        if (listLen === oldLen && compiled?.canClone) {
            let isSameKeyOrder = true;
            for (let i = 0; i < oldLen; i++) {
                if (getItemKey(list[i], i) !== oldKeys[i]) {
                    isSameKeyOrder = false;
                    break;
                }
            }
            if (isSameKeyOrder) {
                const hasExtKeys = Boolean(compiled?.externalKeys && compiled.externalKeys.size > 0);
                for (let idx = 0; idx < oldLen; idx++) {
                    const item = list[idx];
                    _setItemIndex(item, idx);

                    const key = oldKeys[idx];
                    const existing = oldKeyedMap.get(key);
                    const hash = getItemHash(item);
                    if (existing) {
                        if (existing.hash !== hash || hasExtKeys) {
                            pooledItemContext[varName] = item;
                            pooledItemContext.item = item;
                            pooledItemContext._varName = varName;
                            pooledItemContext._index = idx;
                            pooledItemContext.index = idx;
                            _applyForEachSlots(engine, existing.nodes, compiled, item, pooledItemContext, varName);
                            existing.hash = hash;
                            existing.index = idx;
                        }
                    }
                }
                return;
            }
        }

        // Fast-Path 4 & Full Diffing
        const seenKeysInPass = new Set();
        for (let idx = 0; idx < listLen; idx++) {
            const item = list[idx];
            _setItemIndex(item, idx);

            const rawKey = getItemKey(item, idx);
            let key = rawKey;
            if (seenKeysInPass.has(key)) {
                key = `${rawKey}__dup_${idx}`;
            }
            seenKeysInPass.add(key);
            newKeys.push(key);

            const existing = oldKeyedMap.get(key);
            let nodes;

            if (existing?.nodes && existing.nodes.length > 0) {
                const hash = getItemHash(item);
                if (existing.hash === hash && (!compiled?.externalKeys || compiled.externalKeys.size === 0)) {
                    nodes = existing.nodes;
                    newKeyedMap.set(key, { nodes, hash, index: idx });
                    continue;
                }
                if (compiled?.canClone) {
                    pooledItemContext[varName] = item;
                    pooledItemContext.item = item;
                    pooledItemContext._varName = varName;
                    pooledItemContext._index = idx;
                    pooledItemContext.index = idx;
                    _applyForEachSlots(engine, existing.nodes, compiled, item, pooledItemContext, varName);
                    nodes = existing.nodes;
                    newKeyedMap.set(key, { nodes, hash, index: idx });
                    continue;
                }
            }

            const hash = getItemHash(item);
            nodes = createItemNodes(item, idx);
            if (existing?.nodes && existing.nodes.length > 0) {
                const firstOld = existing.nodes[0];
                if (firstOld && firstOld.parentNode === listContainer) {
                    for (let n = 0; n < nodes.length; n++) {
                        listContainer.insertBefore(nodes[n], firstOld);
                    }
                    existing.nodes.forEach((oldNode) => {
                        if (oldNode && oldNode.parentNode === listContainer) {
                            listContainer.removeChild(oldNode);
                        }
                    });
                }
            }

            newKeyedMap.set(key, { nodes, hash, index: idx });
        }

        // Reconcile DOM with minimal LIS mutations
        _reconcileKeyedDOM(listContainer, oldKeyedMap, newKeyedMap, oldKeys, newKeys);

        listContainer._keyedNodesMap = newKeyedMap;
        listContainer._oldKeysSequence = newKeys;
    };

    renderItems();

    if (itemsKey) {
        engine.registerBinding(itemsKey, listContainer, "for_each", () => {
            renderItems();
        });
        if (itemsKey.startsWith("props.") && context._propSources) {
            const propName = itemsKey.slice(6);
            const sourceKey = context._propSources[propName];
            if (sourceKey) {
                engine.registerBinding(sourceKey, listContainer, "for_each", () => {
                    const freshVal = engine.getState(sourceKey);
                    if (context.props) context.props[propName] = freshVal;
                    context[propName] = freshVal;
                    renderItems();
                });
            }
        }
        const dotIdx = itemsKey.indexOf(".");
        if (dotIdx !== -1) {
            const rootKey = itemsKey.slice(0, dotIdx);
            engine.registerBinding(rootKey, listContainer, "for_each", () => {
                renderItems();
            });
        }
        if (itemsKey.startsWith("$route") || itemsKey.startsWith("$router") || itemsKey.startsWith("$fetcher")) {
            const scope = itemsKey.startsWith("$route")
                ? "$route"
                : itemsKey.startsWith("$router")
                  ? "$router"
                  : "$fetcher";
            engine.registerBinding(scope, listContainer, "for_each", () => {
                renderItems();
            });
        }
    }

    if (compiled?.externalKeys) {
        compiled.externalKeys.forEach((extKey) => {
            engine.registerBinding(extKey, listContainer, "for_each", () => {
                renderItems();
            });
        });
    }

    return listContainer;
}
