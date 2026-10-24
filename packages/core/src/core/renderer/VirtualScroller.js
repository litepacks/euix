/**
 * src/core/renderer/VirtualScroller.js
 * Virtual scrolling container initialization and windowed slice rendering for <for_each virtual="true">.
 */

import { toInt } from "../utils/constants.js";
import { _setItemIndex, _applyForEachSlots } from "./ForEachRenderer.js";

/**
 * Initializes virtual list container styles, DOM spacer and content wrapper.
 * @param {HTMLElement} listContainer
 * @param {Element} xmlNode
 * @param {string} containerHeight
 * @returns {{ spacer: HTMLElement, contentWrapper: HTMLElement }}
 */
export function initVirtualContainer(listContainer, xmlNode, containerHeight) {
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

    const spacer = document.createElement("div");
    spacer.className = "euix-virtual-spacer";
    spacer.style.width = "100%";
    spacer.style.pointerEvents = "none";
    listContainer.appendChild(spacer);

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "euix-virtual-content";
    contentWrapper.style.position = "absolute";
    contentWrapper.style.top = "0";
    contentWrapper.style.left = "0";
    contentWrapper.style.right = "0";
    listContainer.appendChild(contentWrapper);

    return { spacer, contentWrapper };
}

/**
 * Renders a windowed slice of items and sets up virtual scroll listener.
 */
export function renderVirtualSlice({
    listContainer,
    contentWrapper,
    spacer,
    list,
    itemHeight,
    containerHeight,
    buffer,
    getItemKey,
    getItemHash,
    compiled,
    pooledItemContext,
    varName,
    createItemNodes,
    engine,
}) {
    const totalItems = list.length;
    spacer.style.height = `${totalItems * itemHeight}px`;

    if (totalItems === 0) {
        contentWrapper.innerHTML = "";
        contentWrapper.style.transform = "translateY(0px)";
        contentWrapper._keyedNodesMap = new Map();
        return;
    }

    const render = () => {
        const scrollTop = listContainer.scrollTop || 0;
        const clientHeight = listContainer.clientHeight || toInt(containerHeight, 0) || 400;
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

    render();

    if (!listContainer._virtualScrollBound) {
        listContainer._virtualScrollBound = true;
        let ticking = false;
        listContainer.addEventListener(
            "scroll",
            () => {
                if (!ticking) {
                    (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb) => cb())(
                        () => {
                            if (engine._isMounted === false) return;
                            render();
                            ticking = false;
                        },
                    );
                    ticking = true;
                }
            },
            { passive: true },
        );
    }
}
