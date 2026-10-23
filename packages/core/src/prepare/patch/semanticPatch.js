/**
 * packages/core/src/prepare/patch/semanticPatch.js
 * Semantic Patch Engine for EUIX.
 * Operates against parsed/normalized AST rather than performing naive string replacements.
 */

/**
 * Deep clones a JavaScript object or array.
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    const cloned = {};
    for (const [k, v] of Object.entries(obj)) {
        cloned[k] = deepClone(v);
    }
    return cloned;
}

/**
 * Traverses an AST to find a node by its string ID or JSON path.
 *
 * @param {object} root
 * @param {string} idOrPath
 * @returns {{ node: any, parent: any, keyOrIndex: string|number }|null}
 */
export function findNode(root, idOrPath) {
    if (!root || !idOrPath) return null;

    // 1. JSON Path syntax (e.g. "view.children[0]" or "state.counter")
    if (idOrPath.startsWith("view") || idOrPath.startsWith("state") || idOrPath.startsWith("actions")) {
        const parts = idOrPath.replace(/\[(\d+)\]/g, ".$1").split(".");
        let current = root;
        let parent = null;
        let keyOrIndex = null;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (current === null || current === undefined) return null;
            parent = current;
            keyOrIndex = isNaN(Number(part)) ? part : Number(part);
            current = current[keyOrIndex];
        }

        return current !== undefined ? { node: current, parent, keyOrIndex } : null;
    }

    // 2. Search by nodeId / props.id
    function search(current, parent = null, keyOrIndex = null) {
        if (!current) return null;

        if (typeof current === "object") {
            if (current.id === idOrPath || current.props?.id === idOrPath) {
                return { node: current, parent, keyOrIndex };
            }

            if (Array.isArray(current.children)) {
                for (let i = 0; i < current.children.length; i++) {
                    const found = search(current.children[i], current, i);
                    if (found) return found;
                }
            }

            if (current.view) {
                const found = search(current.view, current, "view");
                if (found) return found;
            }
        }
        return null;
    }

    return search(root);
}

/**
 * Applies a single semantic patch to a source AST.
 * Returns a new modified source object without mutating the original.
 *
 * @param {object} source
 * @param {object} patch
 * @returns {{ success: boolean, source?: object, error?: string }}
 */
export function applySemanticPatch(source, patch) {
    if (!source || typeof source !== "object") {
        return { success: false, error: "Invalid source object provided to patch engine" };
    }
    if (!patch || typeof patch !== "object" || !patch.op) {
        return { success: false, error: "Invalid patch format: 'op' field is required" };
    }

    const modified = deepClone(source);
    if (!modified.state) modified.state = {};
    if (!modified.actions) modified.actions = {};
    if (!modified.computed) modified.computed = {};

    switch (patch.op) {
        // --- State Operations ---
        case "add-state": {
            const { name, initial, defaultValue, value } = patch;
            if (!name) return { success: false, error: "add-state requires 'name'" };
            const val = initial !== undefined ? initial : (defaultValue !== undefined ? defaultValue : (value !== undefined ? value : ""));
            modified.state[name] = val;
            return { success: true, source: modified };
        }

        case "update-state": {
            const { name, initial, value } = patch;
            if (!name) return { success: false, error: "update-state requires 'name'" };
            if (modified.state[name] === undefined) {
                return { success: false, error: `State "${name}" not found for update-state` };
            }
            modified.state[name] = initial !== undefined ? initial : value;
            return { success: true, source: modified };
        }

        case "remove-state": {
            const { name } = patch;
            if (!name) return { success: false, error: "remove-state requires 'name'" };
            delete modified.state[name];
            return { success: true, source: modified };
        }

        // --- Action Operations ---
        case "add-action": {
            const { name, def, body, writes, reads, set, call } = patch;
            if (!name) return { success: false, error: "add-action requires 'name'" };
            const actionDef = def || (set ? { set } : (call ? { call } : (body ? { run: body } : { call: name })));
            if (writes && Array.isArray(writes)) actionDef.writes = writes;
            if (reads && Array.isArray(reads)) actionDef.reads = reads;
            modified.actions[name] = actionDef;
            return { success: true, source: modified };
        }

        case "update-action": {
            const { name, def, body, set, call } = patch;
            if (!name) return { success: false, error: "update-action requires 'name'" };
            if (!modified.actions[name]) {
                return { success: false, error: `Action "${name}" not found for update-action` };
            }
            const updated = def || (set ? { set } : (call ? { call } : (body ? { run: body } : modified.actions[name])));
            modified.actions[name] = updated;
            return { success: true, source: modified };
        }

        case "remove-action": {
            const { name } = patch;
            if (!name) return { success: false, error: "remove-action requires 'name'" };
            delete modified.actions[name];
            return { success: true, source: modified };
        }

        // --- Computed Operations ---
        case "add-computed": {
            const { name, deps = [], expr, get } = patch;
            if (!name) return { success: false, error: "add-computed requires 'name'" };
            modified.computed[name] = { deps, get: expr || get || "" };
            return { success: true, source: modified };
        }

        case "update-computed": {
            const { name, deps, expr, get } = patch;
            if (!name) return { success: false, error: "update-computed requires 'name'" };
            if (!modified.computed[name]) {
                return { success: false, error: `Computed "${name}" not found for update-computed` };
            }
            const existing = modified.computed[name];
            modified.computed[name] = {
                deps: deps || existing.deps || [],
                get: expr || get || existing.get || "",
            };
            return { success: true, source: modified };
        }

        case "remove-computed": {
            const { name } = patch;
            if (!name) return { success: false, error: "remove-computed requires 'name'" };
            delete modified.computed[name];
            return { success: true, source: modified };
        }

        // --- Binding Operations ---
        case "add-binding":
        case "update-binding": {
            const { nodeId, path, property, target, action } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) {
                return { success: false, error: `Target node "${targetId}" not found for ${patch.op}` };
            }
            const node = found.node;
            if (typeof node !== "object") {
                return { success: false, error: `Cannot bind property on primitive node: ${targetId}` };
            }

            const prop = property || "bind";
            const val = action || target;

            if (prop === "bind") {
                node.$bind = val;
            } else if (prop === "click" || prop === "onclick" || prop === "change" || prop === "onchange" || prop === "submit") {
                if (!node.events) node.events = {};
                const eventName = prop.replace(/^on/, "");
                node.events[eventName] = { $action: val };
            } else {
                if (!node.props) node.props = {};
                node.props[prop] = { $bind: val };
            }

            return { success: true, source: modified };
        }

        case "remove-binding": {
            const { nodeId, path, property } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Target node "${targetId}" not found for remove-binding` };

            const node = found.node;
            const prop = property || "bind";
            if (prop === "bind") {
                delete node.$bind;
            } else if (node.events && (prop.startsWith("on") || node.events[prop])) {
                const eventName = prop.replace(/^on/, "");
                delete node.events[eventName];
            } else if (node.props) {
                delete node.props[prop];
            }
            return { success: true, source: modified };
        }

        // --- Expression Replacement ---
        case "replace-expression": {
            const { nodeId, path, expression } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Target node "${targetId}" not found for replace-expression` };

            if (typeof found.node === "string") {
                found.parent[found.keyOrIndex] = `{${expression.replace(/^\{|\}$/g, "")}}`;
            } else if (typeof found.node === "object") {
                if (found.node.children && typeof found.node.children[0] === "string") {
                    found.node.children[0] = `{${expression.replace(/^\{|\}$/g, "")}}`;
                } else {
                    found.node.$bind = expression.replace(/^\{|\}$/g, "");
                }
            }
            return { success: true, source: modified };
        }

        // --- DOM / Node Tree Operations ---
        case "insert-node": {
            const { parentId, path, index, node } = patch;
            const targetId = parentId || path || "view";
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Parent node "${targetId}" not found for insert-node` };

            const parentNode = found.node;
            if (!Array.isArray(parentNode.children)) {
                parentNode.children = [];
            }

            const insertIdx = index !== undefined ? Math.min(index, parentNode.children.length) : parentNode.children.length;
            parentNode.children.splice(insertIdx, 0, node);
            return { success: true, source: modified };
        }

        case "update-node": {
            const { nodeId, path, patch: nodePatch, props, events, tag } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Node "${targetId}" not found for update-node` };

            const node = found.node;
            if (tag) node.tag = tag;
            if (props) node.props = { ...(node.props || {}), ...props };
            if (events) node.events = { ...(node.events || {}), ...events };
            if (nodePatch && typeof nodePatch === "object") {
                Object.assign(node, nodePatch);
            }
            return { success: true, source: modified };
        }

        case "remove-node": {
            const { nodeId, path } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Node "${targetId}" not found for remove-node` };

            if (found.parent && Array.isArray(found.parent.children) && typeof found.keyOrIndex === "number") {
                found.parent.children.splice(found.keyOrIndex, 1);
                return { success: true, source: modified };
            }
            if (found.parent && found.keyOrIndex !== null) {
                delete found.parent[found.keyOrIndex];
                return { success: true, source: modified };
            }
            return { success: false, error: `Cannot remove root node "${targetId}"` };
        }

        case "move-node": {
            const { nodeId, path, newParentId, newIndex } = patch;
            const targetId = nodeId || path;
            const found = findNode(modified, targetId);
            if (!found) return { success: false, error: `Node "${targetId}" not found for move-node` };

            const targetParentFound = findNode(modified, newParentId);
            if (!targetParentFound) return { success: false, error: `New parent "${newParentId}" not found for move-node` };

            // Detach node
            const extracted = deepClone(found.node);
            if (found.parent && Array.isArray(found.parent.children) && typeof found.keyOrIndex === "number") {
                found.parent.children.splice(found.keyOrIndex, 1);
            }

            // Attach to new parent
            const newParent = targetParentFound.node;
            if (!Array.isArray(newParent.children)) newParent.children = [];
            const idx = newIndex !== undefined ? Math.min(newIndex, newParent.children.length) : newParent.children.length;
            newParent.children.splice(idx, 0, extracted);

            return { success: true, source: modified };
        }

        default:
            return { success: false, error: `Unknown semantic patch operation: "${patch.op}"` };
    }
}

/**
 * Applies a list of semantic patches sequentially to a source.
 * If any patch fails, aborts and returns the error without applying partial changes.
 *
 * @param {object} source
 * @param {Array<object>} patches
 * @returns {{ success: boolean, source?: object, error?: string, appliedCount: number }}
 */
export function applySemanticPatches(source, patches = []) {
    let currentSource = deepClone(source);
    let appliedCount = 0;

    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];
        const res = applySemanticPatch(currentSource, patch);
        if (!res.success) {
            return {
                success: false,
                error: `Patch #${i + 1} (${patch.op}) failed: ${res.error}`,
                appliedCount,
            };
        }
        currentSource = res.source;
        appliedCount++;
    }

    return {
        success: true,
        source: currentSource,
        appliedCount,
    };
}
