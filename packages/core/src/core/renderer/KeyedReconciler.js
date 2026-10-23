/**
 * src/core/renderer/KeyedReconciler.js
 * High-performance keyed DOM reconciliation and Longest Increasing Subsequence (LIS) diffing algorithm.
 */

let _sharedP = null;
let _sharedResult = null;

function _getPBuffer(len) {
    if (!_sharedP || _sharedP.length < len) {
        _sharedP = new Int32Array(Math.max(len, 1024));
    }
    return _sharedP;
}

function _getResultBuffer(len) {
    if (!_sharedResult || _sharedResult.length < len) {
        _sharedResult = new Int32Array(Math.max(len, 1024));
    }
    return _sharedResult;
}

/**
 * Computes the Longest Increasing Subsequence of indices using binary search + shared buffer.
 * O(n log n) time complexity, zero GC allocation for arrays up to 1024 items.
 *
 * @param {Int32Array | number[]} arr
 * @returns {number[]}
 */
export function _getLongestIncreasingSubsequence(arr) {
    const len = arr.length;
    if (len === 0) return [0];

    const p = _getPBuffer(len);
    const result = _getResultBuffer(len);
    let resultLen = 0;

    let i, j, u, v, c;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== -1) {
            if (resultLen === 0) {
                result[0] = i;
                resultLen = 1;
                continue;
            }
            j = result[resultLen - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result[resultLen++] = i;
                continue;
            }
            u = 0;
            v = resultLen - 1;
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

    if (resultLen === 0) return [0];

    const res = new Array(resultLen);
    u = resultLen;
    v = result[resultLen - 1];
    while (u-- > 0) {
        res[u] = v;
        v = p[v];
    }
    return res;
}

/**
 * Reconciles keyed DOM nodes between old and new state.
 * Employs head-tail matching, 2-item swap fast path, sub-array reverse batching,
 * and minimal insertBefore moves powered by LIS.
 *
 * @param {HTMLElement} container
 * @param {Map<any, { nodes: Node[] }>} oldKeyedMap
 * @param {Map<any, { nodes: Node[] }>} newKeyedMap
 * @param {any[]} oldKeys
 * @param {any[]} newKeys
 */
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

    // 3. Remove deleted old nodes (Zero Set allocation: direct newKeyedMap.has)
    for (let i = start; i <= oldEnd; i++) {
        const oldKey = oldKeys[i];
        if (!newKeyedMap.has(oldKey)) {
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

    const count = newEnd - start + 1;
    const oldCount = oldEnd - start + 1;

    // 5.5 Fast Path: Full or Sub-array Reverse (DocumentFragment batch move)
    if (count === oldCount && count > 2) {
        let isReverse = true;
        for (let i = 0; i < count; i++) {
            if (oldKeys[start + i] !== newKeys[newEnd - i]) {
                isReverse = false;
                break;
            }
        }
        if (isReverse) {
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
    }

    // 6. Middle sub-array reordering (LIS / Minimal insertBefore)
    const oldKeyToIndex = new Map();
    for (let i = start; i <= oldEnd; i++) {
        oldKeyToIndex.set(oldKeys[i], i);
    }

    const sourceIndices = new Int32Array(count);
    sourceIndices.fill(-1);

    let moved = false;
    let maxNewIndexSoFar = 0;

    for (let i = 0; i < count; i++) {
        const newIndex = start + i;
        const newKey = newKeys[newIndex];
        const oldIdx = oldKeyToIndex.get(newKey);
        if (oldIdx !== undefined) {
            sourceIndices[i] = oldIdx;
            if (oldIdx < maxNewIndexSoFar) {
                moved = true;
            } else {
                maxNewIndexSoFar = oldIdx;
            }
        } else {
            moved = true;
        }
    }

    // Fast-path: If relative order didn't change and no moves needed, return immediately!
    if (!moved) {
        return;
    }

    const lis = _getLongestIncreasingSubsequence(sourceIndices);
    let lisIdx = lis.length - 1;

    let anchorKey = newEnd + 1 < newLen ? newKeys[newEnd + 1] : null;
    let anchorEntry = anchorKey ? newKeyedMap.get(anchorKey) : null;
    let anchorNode = anchorEntry?.nodes?.[0] || null;

    for (let i = count - 1; i >= 0; i--) {
        const newIndex = start + i;
        const newKey = newKeys[newIndex];
        const entry = newKeyedMap.get(newKey);

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

        // Propagate anchor: the node we just verified/moved is the anchor for preceding items
        if (entry?.nodes?.[0]) {
            anchorNode = entry.nodes[0];
        }
    }
}
