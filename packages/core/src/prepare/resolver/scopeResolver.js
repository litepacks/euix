/**
 * packages/core/src/prepare/resolver/scopeResolver.js
 * Collects and resolves available scopes, state symbols, computed symbols, and actions.
 */

/**
 * @typedef {Object} ResolvedScope
 * @property {Set<string>} states - Defined state property names
 * @property {Set<string>} computed - Defined computed property names
 * @property {Set<string>} props - Declared component props
 * @property {Set<string>} actions - Defined action names
 * @property {Set<string>} components - Available component names (local + imported)
 * @property {Set<string>} services - Available service names from imports
 * @property {Map<string, string>} importMap - Alias -> specifier mapping
 */

/**
 * Collect all declared symbols and scopes from a canonical EUIX Source JSON.
 *
 * @param {object} source
 * @returns {ResolvedScope}
 */
export function collectScopes(source) {
    const states = new Set();
    const computed = new Set();
    const props = new Set();
    const actions = new Set();
    const components = new Set();
    const services = new Set();
    const importMap = new Map();

    if (!source || typeof source !== "object") {
        return { states, computed, props, actions, components, services, importMap };
    }

    // 1. Collect States
    if (source.state && typeof source.state === "object") {
        for (const key of Object.keys(source.state)) {
            states.add(key);
        }
    }

    // 2. Collect Computed
    if (source.computed && typeof source.computed === "object") {
        for (const key of Object.keys(source.computed)) {
            computed.add(key);
        }
    }

    // 3. Collect Props
    if (source.props && typeof source.props === "object") {
        for (const key of Object.keys(source.props)) {
            props.add(key);
        }
    }

    // 4. Collect Actions
    if (source.actions && typeof source.actions === "object") {
        for (const key of Object.keys(source.actions)) {
            actions.add(key);
        }
    }

    // 5. Collect Local Components
    const componentsMap = new Map();
    if (source.components && typeof source.components === "object") {
        for (const [key, compDef] of Object.entries(source.components)) {
            components.add(key);
            componentsMap.set(key, compDef);
        }
    }

    // 6. Collect Imports
    if (source.imports && typeof source.imports === "object") {
        for (const [alias, spec] of Object.entries(source.imports)) {
            const pathStr = typeof spec === "string" ? spec : spec?.src || "";
            importMap.set(alias, pathStr);

            // If alias starts with uppercase or ends with .euix / .xml / .euix.json, treat as component
            if (/^[A-Z]/.test(alias) || /\.(euix|xml|json)$/i.test(pathStr)) {
                components.add(alias);
            } else {
                services.add(alias);
            }
        }
    }

    // 7. Collect Injected keys
    const injected = new Set();
    if (Array.isArray(source.inject)) {
        for (const key of source.inject) {
            if (typeof key === "string") injected.add(key);
        }
    } else if (source.inject && typeof source.inject === "object") {
        for (const key of Object.keys(source.inject)) {
            injected.add(key);
        }
    }

    return { states, computed, props, actions, components, services, importMap, injected, componentsMap };
}

/**
 * Checks if a state or computed path is valid in the given scope.
 *
 * @param {string} path - e.g. "user", "user.name", "loading"
 * @param {ResolvedScope} scope
 * @param {Set<string>} [localVars] - Optional local variables from loops ($item, u, idx)
 * @returns {boolean}
 */
export function isStateAccessible(path, scope, localVars = null) {
    if (!path || typeof path !== "string") return false;
    const rootIdent = path.split(".")[0].split("[")[0].trim();

    if (localVars && localVars.has(rootIdent)) return true;
    if (scope.states.has(rootIdent)) return true;
    if (scope.computed.has(rootIdent)) return true;
    if (scope.props.has(rootIdent)) return true;
    if (scope.injected && scope.injected.has(rootIdent)) return true;

    // Special built-in keywords
    if (rootIdent === "$index" || rootIdent === "$item" || rootIdent === "$route" || rootIdent === "data") {
        return true;
    }

    return false;
}
