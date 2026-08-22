/**
 * src/core/renderer/ForEachRenderer.js
 * Keyed reconciliation, longest increasing subsequence diffing, virtual scrolling, and <for_each> renderer for EUIX Engine.
 */

import {
    _getNodeAtPath,
    _getStaticNodeResolver,
    getChildNodes,
    getForEachItemHash,
    isElem,
} from "../utils/constants.js";

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

export function _getLongestIncreasingSubsequence(arr) {
    const p = Array.from(arr);
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== -1) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

export function _reconcileKeyedDOM(container, oldKeyedMap, newKeyedMap, oldKeys, newKeys) {
    if (!oldKeys || oldKeys.length === 0) {
        const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
        for (let i = 0; i < newKeys.length; i++) {
            const entry = newKeyedMap.get(newKeys[i]);
            if (entry?.nodes) {
                const nodes = entry.nodes;
                for (let n = 0; n < nodes.length; n++) {
                    if (fragment) fragment.appendChild(nodes[n]);
                    else container.appendChild(nodes[n]);
                }
            }
        }
        if (fragment) container.appendChild(fragment);
        return;
    }

    if (!newKeys || newKeys.length === 0) {
        for (const entry of oldKeyedMap.values()) {
            if (entry?.nodes) {
                const nodes = entry.nodes;
                for (let n = 0; n < nodes.length; n++) {
                    const node = nodes[n];
                    if (node && node.parentNode === container) container.removeChild(node);
                }
            }
        }
        return;
    }

    // 1. Head matching
    let start = 0;
    const oldLen = oldKeys.length;
    const newLen = newKeys.length;
    while (start < oldLen && start < newLen && oldKeys[start] === newKeys[start]) {
        start++;
    }

    // 2. Tail matching
    let oldEnd = oldLen - 1;
    let newEnd = newLen - 1;
    while (oldEnd >= start && newEnd >= start && oldKeys[oldEnd] === newKeys[newEnd]) {
        oldEnd--;
        newEnd--;
    }

    // 2.5 Swap 2 Items Fast-Path
    if (oldLen === newLen && oldEnd >= start) {
        let firstDiff = -1;
        let secondDiff = -1;
        let diffCount = 0;
        for (let i = start; i <= oldEnd; i++) {
            if (oldKeys[i] !== newKeys[i]) {
                diffCount++;
                if (firstDiff === -1) firstDiff = i;
                else if (secondDiff === -1) secondDiff = i;
                else break;
            }
        }
        if (diffCount === 2 && firstDiff !== -1 && secondDiff !== -1) {
            const keyA = oldKeys[firstDiff];
            const keyB = oldKeys[secondDiff];
            if (newKeys[firstDiff] === keyB && newKeys[secondDiff] === keyA) {
                const entryA = newKeyedMap.get(keyA);
                const entryB = newKeyedMap.get(keyB);
                if (entryA?.nodes && entryB?.nodes) {
                    const nodeA = entryA.nodes[0];
                    const nodeB = entryB.nodes[0];
                    if (nodeA && nodeB && nodeA.parentNode === container && nodeB.parentNode === container) {
                        const nextA = nodeA.nextSibling;
                        const nextB = nodeB.nextSibling;
                        if (nextA === nodeB) {
                            container.insertBefore(nodeB, nodeA);
                        } else if (nextB === nodeA) {
                            container.insertBefore(nodeA, nodeB);
                        } else {
                            container.insertBefore(nodeA, nextB);
                            container.insertBefore(nodeB, nextA);
                        }
                        return;
                    }
                }
            }
        }
    }

    // 3. Remove deleted old nodes
    const activeNewKeys = new Set(newKeys);
    for (let i = start; i <= oldEnd; i++) {
        const oldKey = oldKeys[i];
        if (!activeNewKeys.has(oldKey)) {
            const oldEntry = oldKeyedMap.get(oldKey);
            if (oldEntry?.nodes) {
                const nodes = oldEntry.nodes;
                for (let n = 0; n < nodes.length; n++) {
                    const node = nodes[n];
                    if (node && node.parentNode === container) container.removeChild(node);
                }
            }
        }
    }

    // 4. Fast Path: Pure Append / Insert
    if (start > oldEnd) {
        const anchorKey = newEnd + 1 < newLen ? newKeys[newEnd + 1] : null;
        const anchorEntry = anchorKey ? newKeyedMap.get(anchorKey) : null;
        const anchorNode = anchorEntry?.nodes?.[0] || null;
        const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
        for (let i = start; i <= newEnd; i++) {
            const entry = newKeyedMap.get(newKeys[i]);
            if (entry?.nodes) {
                for (let n = 0; n < entry.nodes.length; n++) {
                    if (fragment) fragment.appendChild(entry.nodes[n]);
                    else container.appendChild(entry.nodes[n]);
                }
            }
        }
        if (fragment) {
            if (anchorNode && anchorNode.parentNode === container) {
                container.insertBefore(fragment, anchorNode);
            } else {
                container.appendChild(fragment);
            }
        }
        return;
    }

    // 5. Fast Path: Pure Removal
    if (start > newEnd) {
        return;
    }

    // 6. Middle sub-array reordering (LIS / Minimal insertBefore)
    const oldKeyToIndex = new Map();
    for (let i = start; i <= oldEnd; i++) {
        oldKeyToIndex.set(oldKeys[i], i);
    }

    const count = newEnd - start + 1;
    const sourceIndices = new Int32Array(count);
    sourceIndices.fill(-1);

    for (let i = 0; i < count; i++) {
        const newIndex = start + i;
        const newKey = newKeys[newIndex];
        if (oldKeyToIndex.has(newKey)) {
            sourceIndices[i] = oldKeyToIndex.get(newKey);
        }
    }

    const lis = _getLongestIncreasingSubsequence(sourceIndices);
    let lisIdx = lis.length - 1;

    for (let i = count - 1; i >= 0; i--) {
        const newIndex = start + i;
        const newKey = newKeys[newIndex];
        const entry = newKeyedMap.get(newKey);
        const anchorKey = newIndex + 1 < newLen ? newKeys[newIndex + 1] : null;
        const anchorEntry = anchorKey ? newKeyedMap.get(anchorKey) : null;
        const anchorNode = anchorEntry?.nodes?.[0] || null;

        if (sourceIndices[i] === -1 || lisIdx < 0 || i !== lis[lisIdx]) {
            if (entry?.nodes) {
                for (let n = 0; n < entry.nodes.length; n++) {
                    if (anchorNode && anchorNode.parentNode === container) {
                        container.insertBefore(entry.nodes[n], anchorNode);
                    } else {
                        container.appendChild(entry.nodes[n]);
                    }
                }
            }
        } else {
            lisIdx--;
        }
    }
}

export function _isComplexForEachChild(engine, node) {
    if (node?.nodeType !== 1) return false;
    const tag = (node.tagName || "").toLowerCase();
    const EngineClass = engine.constructor;
    if (
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
                    }
                    if (!getter) {
                        getter = (_item, ctx) => engine.interpolate(txt, ctx);
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
                            }
                            if (!getter) {
                                getter = (_item, ctx) => engine.interpolate(attrVal, ctx);
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
                if (targetNode.textContent !== txt) targetNode.textContent = txt;
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
            item && item.id !== undefined && item.id !== null
                ? String(item.id)
                : item && item._key !== undefined
                  ? String(item._key)
                  : `__idx_${idx}`;
    } else if (!keyAttr.includes("{")) {
        getItemKey = (item, idx) =>
            item && item[keyAttr] !== undefined && item[keyAttr] !== null
                ? String(item[keyAttr])
                : item && item.id !== undefined && item.id !== null
                  ? String(item.id)
                  : `__idx_${idx}`;
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

    const templateChildren = xmlNode.children ? Array.from(xmlNode.children) : getChildNodes(xmlNode).filter(isElem);
    const createItemNodes = (item, idx) => {
        if (compiled?.canClone) {
            pooledItemContext[varName] = item;
            pooledItemContext._index = idx;
            pooledItemContext.index = idx;
            const protoLen = compiled.prototypes.length;
            const nodes = new Array(protoLen);
            for (let pIdx = 0; pIdx < protoLen; pIdx++) {
                nodes[pIdx] = compiled.prototypes[pIdx].cloneNode(true);
            }
            _applyForEachSlots(engine, nodes, compiled, item, pooledItemContext, varName);
            return nodes;
        }

        const childContext = Object.create(baseChildContext);
        childContext[varName] = item;
        childContext._index = idx;
        childContext.index = idx;

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
                    if (typeof item === "object" && item !== null) {
                        try {
                            item._index = i;
                            item.index = i;
                        } catch (_) {}
                    }
                    const key = getItemKey(item, i);
                    const hash = getItemHash(item);
                    activeKeys.add(key);

                    const existing = oldKeyedMap.get(key);
                    let nodes;

                    if (existing?.nodes && existing.nodes.length > 0) {
                        if (existing.hash === hash) {
                            nodes = existing.nodes;
                        } else if (compiled?.canClone) {
                            const childContext = Object.create(baseChildContext);
                            childContext[varName] = item;
                            childContext._index = i;
                            childContext.index = i;
                            _applyForEachSlots(engine, existing.nodes, compiled, item, childContext, varName);
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

        // Fast-Path 1: Initial Mount / Empty Container
        const oldLen = oldKeys.length;
        if (oldLen === 0) {
            const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
            for (let idx = 0; idx < list.length; idx++) {
                const item = list[idx];
                if (typeof item === "object" && item !== null) {
                    try {
                        item._index = idx;
                        item.index = idx;
                    } catch (_) {}
                }
                const key = getItemKey(item, idx);
                const hash = getItemHash(item);
                const nodes = createItemNodes(item, idx);
                newKeys.push(key);
                newKeyedMap.set(key, { nodes, hash, index: idx });
                if (fragment) {
                    for (let n = 0; n < nodes.length; n++) fragment.appendChild(nodes[n]);
                } else {
                    for (let n = 0; n < nodes.length; n++) listContainer.appendChild(nodes[n]);
                }
            }
            if (fragment) listContainer.appendChild(fragment);
            listContainer._keyedNodesMap = newKeyedMap;
            listContainer._oldKeysSequence = newKeys;
            return;
        }

        // Fast-Path 2: Pure Append to existing list
        if (list.length > oldLen) {
            let isPureAppend = true;
            for (let i = 0; i < oldLen; i++) {
                if (getItemKey(list[i], i) !== oldKeys[i]) {
                    isPureAppend = false;
                    break;
                }
            }
            if (isPureAppend) {
                const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
                for (let idx = oldLen; idx < list.length; idx++) {
                    const item = list[idx];
                    if (typeof item === "object" && item !== null) {
                        try {
                            item._index = idx;
                            item.index = idx;
                        } catch (_) {}
                    }
                    const key = getItemKey(item, idx);
                    const hash = getItemHash(item);
                    const nodes = createItemNodes(item, idx);
                    oldKeys.push(key);
                    oldKeyedMap.set(key, { nodes, hash, index: idx });
                    if (fragment) {
                        for (let n = 0; n < nodes.length; n++) fragment.appendChild(nodes[n]);
                    } else {
                        for (let n = 0; n < nodes.length; n++) listContainer.appendChild(nodes[n]);
                    }
                }
                if (fragment) listContainer.appendChild(fragment);
                listContainer._oldKeysSequence = oldKeys;
                return;
            }
        }

        for (let idx = 0; idx < list.length; idx++) {
            const item = list[idx];
            if (typeof item === "object" && item !== null) {
                try {
                    item._index = idx;
                    item.index = idx;
                } catch (_) {}
            }

            const key = getItemKey(item, idx);
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
