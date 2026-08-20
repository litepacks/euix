/**
 * src/plugins/inspector/metadata.js
 * WeakMap-based element metadata registry, sensitive data masking,
 * component tree extraction, and debug snapshot generation for EUIX Inspector.
 */

export const elementMetadata = new WeakMap();

const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /apikey/i,
    /api_key/i,
    /auth/i,
    /cookie/i,
    /credential/i,
    /jwt/i,
    /bearer/i,
    /private/i
];

/**
 * Checks whether a key is sensitive and should be masked.
 */
export function isSensitiveKey(key) {
    if (typeof key !== "string") return false;
    return SENSITIVE_KEY_PATTERNS.some(re => re.test(key));
}

/**
 * Deeply clones an object, masking sensitive keys.
 */
export function maskSensitive(obj, visited = new WeakSet()) {
    if (obj === null || typeof obj !== "object") return obj;
    if (visited.has(obj)) return "[Circular]";
    visited.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => maskSensitive(item, visited));
    }

    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            masked[key] = "********";
        } else if (typeof value === "object" && value !== null) {
            masked[key] = maskSensitive(value, visited);
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

/**
 * Registers metadata for a DOM element.
 */
export function registerElementMetadata(element, meta = {}) {
    if (!element || typeof element !== "object") return;
    const existing = elementMetadata.get(element) || {};
    const merged = {
        ...existing,
        ...meta,
        props: { ...(existing.props || {}), ...(meta.props || {}) },
        bindings: Array.from(new Set([...(existing.bindings || []), ...(meta.bindings || [])])),
        actions: Array.from(new Set([...(existing.actions || []), ...(meta.actions || [])]))
    };
    elementMetadata.set(element, merged);
}

/**
 * Retrieves metadata for a DOM element.
 * If direct metadata is absent, traverses up the DOM tree to find the nearest component or metadata.
 */
export function getElementMetadata(element, engine = null) {
    if (!element || element.nodeType !== 1) return null;

    let directMeta = elementMetadata.get(element) || null;

    // Extract attributes directly from element
    let compName = element.dataset?.euixComponent || element.dataset?.xuiComponent || directMeta?.component || "";
    let instanceId = element.dataset?.euixInstance || directMeta?.instanceId || "";
    let testId = element.getAttribute("data-euix-test") || element.getAttribute("test-id") || element.getAttribute("data-testid") || directMeta?.testId || "";
    let refName = element.dataset?.xuiRef || directMeta?.ref || "";
    let bindPath = element.dataset?.xuiBind || element.dataset?.xuiKey || element.getAttribute("bind") || "";
    let actions = [];

    if (element.getAttribute("data-euix-action")) {
        actions.push(...element.getAttribute("data-euix-action").split(",").map(s => s.trim()).filter(Boolean));
    }
    if (element.getAttribute("action")) {
        const act = element.getAttribute("action");
        if (!actions.includes(act)) actions.push(act);
    }
    if (element.__euixEvents) {
        Object.keys(element.__euixEvents).forEach(evt => {
            const handlers = element.__euixEvents[evt];
            if (Array.isArray(handlers)) {
                handlers.forEach(h => {
                    const act = h.getAttribute && (h.getAttribute("action") || h.getAttribute("name"));
                    if (act && !actions.includes(act)) actions.push(act);
                });
            }
        });
    }
    if (directMeta?.actions) {
        actions.push(...directMeta.actions);
    }
    actions = Array.from(new Set(actions));

    // If component name is still empty, walk up ancestors
    let current = element.parentElement;
    let parentCompName = "";
    let parentInstanceId = "";
    while (current && current !== document.body && current !== document.documentElement) {
        if (!compName && (current.dataset?.euixComponent || current.dataset?.xuiComponent)) {
            compName = current.dataset.euixComponent || current.dataset.xuiComponent;
            instanceId = current.dataset?.euixInstance || "";
        }
        if (!parentCompName && (current.dataset?.euixComponent || current.dataset?.xuiComponent)) {
            parentCompName = current.dataset.euixComponent || current.dataset.xuiComponent;
            parentInstanceId = current.dataset?.euixInstance || "";
        }
        const parentMeta = elementMetadata.get(current);
        if (parentMeta && !compName && parentMeta.component) {
            compName = parentMeta.component;
            instanceId = parentMeta.instanceId;
        }
        current = current.parentElement;
    }

    // Determine current route if router plugin is present
    let currentRoute = "";
    if (engine?._router?.currentRoute?.path) {
        currentRoute = engine._router.currentRoute.path;
    } else if (typeof window !== "undefined" && window.location) {
        currentRoute = window.location.pathname;
    }

    // Local / Global state
    let localState = directMeta?.localState || null;
    let props = directMeta?.props || {};

    const bindings = bindPath ? [bindPath] : (directMeta?.bindings || []);

    return {
        element,
        tagName: element.tagName.toLowerCase(),
        component: compName || "App",
        componentId: instanceId || "root",
        instanceId: instanceId || "root",
        parentComponent: parentCompName || null,
        parentInstanceId: parentInstanceId || null,
        route: currentRoute,
        testId,
        ref: refName,
        bindings,
        actions,
        props: maskSensitive(props),
        localState: localState ? maskSensitive(localState) : null,
        source: directMeta?.source || null,
        isBoundary: Boolean(element.dataset?.euixComponent || element.dataset?.xuiComponent)
    };
}

/**
 * Creates a JSON-serializable debug snapshot for an element / component.
 */
export function createDebugSnapshot(element, engine = null) {
    const meta = getElementMetadata(element, engine);
    if (!meta) return null;

    let globalState = {};
    if (engine && engine._rawState) {
        globalState = maskSensitive(engine._rawState);
    } else if (typeof window !== "undefined" && window.$state) {
        globalState = maskSensitive(window.$state);
    }

    return {
        component: meta.component,
        componentId: meta.componentId,
        tagName: meta.tagName,
        testId: meta.testId || undefined,
        route: meta.route || undefined,
        props: meta.props,
        localState: meta.localState,
        globalState: Object.keys(globalState).length > 0 ? globalState : undefined,
        bindings: meta.bindings,
        actions: meta.actions,
        source: meta.source || undefined
    };
}

/**
 * Builds a hierarchical tree of mounted components from the DOM.
 */
export function buildComponentTree(root = document.body) {
    if (!root) return [];

    const nodes = [];
    const elements = root.querySelectorAll ? Array.from(root.querySelectorAll("[data-euix-component], [data-xui-component]")) : [];

    // Include root if it is a component
    if (root.dataset?.euixComponent || root.dataset?.xuiComponent) {
        elements.unshift(root);
    }

    elements.forEach(el => {
        const comp = el.dataset.euixComponent || el.dataset.xuiComponent;
        const inst = el.dataset.euixInstance || "inst_" + Math.random().toString(36).slice(2, 7);

        // Find parent component element
        let parentEl = el.parentElement;
        let parentComp = null;
        while (parentEl && parentEl !== document.body && parentEl !== document.documentElement) {
            if (parentEl.dataset?.euixComponent || parentEl.dataset?.xuiComponent) {
                parentComp = parentEl.dataset.euixComponent || parentEl.dataset.xuiComponent;
                break;
            }
            parentEl = parentEl.parentElement;
        }

        nodes.push({
            name: comp,
            instanceId: inst,
            element: el,
            parent: parentComp,
            parentElement: parentEl || null
        });
    });

    // Build hierarchy tree
    const rootNodes = [];
    const nodeMap = new Map();

    nodes.forEach(n => {
        n.children = [];
        nodeMap.set(n.element, n);
    });

    nodes.forEach(n => {
        if (n.parentElement && nodeMap.has(n.parentElement)) {
            nodeMap.get(n.parentElement).children.push(n);
        } else {
            rootNodes.push(n);
        }
    });

    return rootNodes.length > 0 ? rootNodes : nodes;
}
