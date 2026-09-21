/**
 * packages/core/src/prepare/normalizer/index.js
 * Normalizes resolved source specifications into a deterministic, low-complexity Runtime IR.
 */

export const IR_VERSION = 1;

/**
 * Normalizes view node expressions and directives into canonical runtime descriptors.
 *
 * @param {any} node
 * @param {Map<string, number>} stateMap - stateName -> stateId
 * @param {Map<string, number>} componentMap - compName -> componentId
 * @param {Map<string, number>} actionMap - actionName -> actionId
 * @returns {any}
 */
function normalizeViewNode(node, stateMap, componentMap, actionMap) {
    if (node === null || node === undefined) return null;

    // State binding: { "$bind": "user" } or { "$bind": "user.name" }
    if (typeof node === "object" && node.$bind !== undefined) {
        const path = String(node.$bind);
        const root = path.split(".")[0].split("[")[0];
        return {
            type: "state",
            stateId: stateMap.has(root) ? stateMap.get(root) : null,
            path,
        };
    }

    // Prop binding: { "$prop": "title" }
    if (typeof node === "object" && node.$prop !== undefined) {
        return {
            type: "prop",
            propName: String(node.$prop),
        };
    }

    // Route binding: { "$route": "params.id" }
    if (typeof node === "object" && node.$route !== undefined) {
        return {
            type: "route",
            param: String(node.$route),
        };
    }

    // Action reference: { "$action": "loadUser" }
    if (typeof node === "object" && node.$action !== undefined) {
        const name = String(node.$action);
        return {
            type: "action",
            actionId: actionMap.has(name) ? actionMap.get(name) : null,
            actionName: name,
        };
    }

    if (Array.isArray(node)) {
        return node.map((child) => normalizeViewNode(child, stateMap, componentMap, actionMap));
    }

    if (typeof node !== "object") {
        return node;
    }

    const normalized = {};

    // Component or Tag identification
    if (node.component) {
        const compName = String(node.component);
        normalized.componentId = componentMap.has(compName) ? componentMap.get(compName) : null;
        normalized.componentName = compName;
    } else if (node.tag) {
        normalized.tag = String(node.tag);
    }

    // Directives
    if (node.for_each || node.items) {
        normalized.items = normalizeViewNode(node.items || node.for_each, stateMap, componentMap, actionMap);
        normalized.var = node.var || "item";
        if (node.key) normalized.key = node.key;
    }
    if (node.if || node.condition) {
        normalized.condition = normalizeViewNode(node.condition || node.if, stateMap, componentMap, actionMap);
    }

    // Normalized Props
    if (node.props && typeof node.props === "object") {
        normalized.props = {};
        const sortedPropKeys = Object.keys(node.props).sort();
        for (const k of sortedPropKeys) {
            normalized.props[k] = normalizeViewNode(node.props[k], stateMap, componentMap, actionMap);
        }
    }

    // Normalized Events
    if (node.events && typeof node.events === "object") {
        normalized.events = {};
        const sortedEventKeys = Object.keys(node.events).sort();
        for (const evt of sortedEventKeys) {
            const handler = node.events[evt];
            const actionName = typeof handler === "object" ? handler?.$action || handler?.action : handler;
            if (actionName && typeof actionName === "string") {
                normalized.events[evt] = {
                    type: "action",
                    actionId: actionMap.has(actionName) ? actionMap.get(actionName) : null,
                    actionName,
                };
            } else {
                normalized.events[evt] = handler;
            }
        }
    }

    // Normalized Children
    if (Array.isArray(node.children)) {
        normalized.children = node.children
            .map((c) => normalizeViewNode(c, stateMap, componentMap, actionMap))
            .filter((c) => c !== null);
    }

    return normalized;
}

/**
 * Normalizes a validated EUIX source into a deterministic Runtime Intermediate Representation (IR).
 *
 * @param {object} source
 * @param {import('../resolver/scopeResolver.js').ResolvedScope} scope
 * @param {object|null} route
 * @returns {object} Runtime IR
 */
export function normalizeToRuntimeIR(source, scope, route) {
    // 1. Deterministic Indexed States
    const stateKeys = Object.keys(source.state || {}).sort();
    const stateMap = new Map();
    const states = stateKeys.map((name, idx) => {
        stateMap.set(name, idx);
        const val = source.state[name];
        let type = "string";
        if (typeof val === "number") type = "number";
        else if (typeof val === "boolean") type = "boolean";
        else if (Array.isArray(val)) type = "array";
        else if (typeof val === "object" && val !== null) type = "object";

        return {
            id: idx,
            name,
            initial: val !== undefined ? val : null,
            type,
        };
    });

    // 2. Deterministic Indexed Computed
    const computedKeys = Object.keys(source.computed || {}).sort();
    const computed = computedKeys.map((name, idx) => {
        const def = source.computed[name];
        const deps = Array.isArray(def?.deps) ? [...def.deps].sort() : [];
        const get = typeof def === "string" ? def : def?.get || "";
        return {
            id: idx,
            name,
            deps,
            get,
        };
    });

    // 3. Deterministic Indexed Actions
    const actionKeys = Object.keys(source.actions || {}).sort();
    const actionMap = new Map();
    const actions = actionKeys.map((name, idx) => {
        actionMap.set(name, idx);
        const def = source.actions[name];
        return {
            id: idx,
            name,
            call: typeof def === "string" ? def : def?.call || name,
            args: Array.isArray(def?.args)
                ? def.args.map((a) => normalizeViewNode(a, stateMap, new Map(), actionMap))
                : [],
            assign: def?.assign || null,
            set: def?.set || null,
            mutate: def?.mutate || null,
        };
    });

    // 4. Deterministic Indexed Components (local + imported)
    const componentNames = Array.from(scope.components).sort();
    const componentMap = new Map();
    const components = componentNames.map((name, idx) => {
        componentMap.set(name, idx);
        return {
            id: idx,
            name,
            src: scope.importMap.get(name) || null,
            inline: Boolean(source.components?.[name]),
            view: source.components?.[name]?.view || null,
        };
    });

    // 5. Watchers
    const watchers = [];
    if (source.watch && typeof source.watch === "object") {
        for (const [watchedPath, watchDef] of Object.entries(source.watch)) {
            const actionName = typeof watchDef === "string" ? watchDef : watchDef?.action;
            watchers.push({
                path: watchedPath,
                actionId: actionName && actionMap.has(actionName) ? actionMap.get(actionName) : null,
                actionName: actionName || null,
            });
        }
        watchers.sort((a, b) => a.path.localeCompare(b.path));
    }

    // 6. Lifecycle
    const lifecycle = { mount: [], unmount: [] };
    if (source.lifecycle?.mount) {
        lifecycle.mount = source.lifecycle.mount.map((step) => {
            const actionName = typeof step === "string" ? step : step?.$action || step?.call;
            return {
                actionId: actionName && actionMap.has(actionName) ? actionMap.get(actionName) : null,
                actionName,
            };
        });
    }
    if (source.lifecycle?.unmount) {
        lifecycle.unmount = source.lifecycle.unmount.map((step) => {
            const actionName = typeof step === "string" ? step : step?.$action || step?.call;
            return {
                actionId: actionName && actionMap.has(actionName) ? actionMap.get(actionName) : null,
                actionName,
            };
        });
    }

    // 7. View Normalization
    const view = normalizeViewNode(source.view, stateMap, componentMap, actionMap);

    return {
        irVersion: IR_VERSION,
        route,
        states,
        computed,
        actions,
        components,
        watchers,
        lifecycle,
        provide: source.provide || {},
        inject: source.inject || null,
        view,
    };
}
