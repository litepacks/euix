/**
 * EUIXReactivePlugin
 * Declarative Computed State (derived state) and Reactive Watchers for EUIX Engine.
 */

import { EUIXStructuredError, EUIXExpressionParser } from "../core/EUIXEngineCore.js";

/**
 * EUIXDependencyGraph
 * Fine-grained reactive path dependency mapping for computed properties and watchers.
 */
export class EUIXDependencyGraph {
    constructor() {
        this.pathToComputed = new Map(); // cleanPath -> Set<computedId>
        this.pathToWatchers = new Map(); // cleanPath -> Set<watcherId>
    }

    addComputedDep(path, computedId) {
        const clean = String(path || "").replace(/^(data|state|computed)\./, "").trim();
        if (!clean) return;
        if (!this.pathToComputed.has(clean)) {
            this.pathToComputed.set(clean, new Set());
        }
        this.pathToComputed.get(clean).add(computedId);
    }

    addWatcherDep(path, watcherId) {
        const clean = String(path || "").replace(/^(data|state|computed)\./, "").trim();
        if (!clean) return;
        if (!this.pathToWatchers.has(clean)) {
            this.pathToWatchers.set(clean, new Set());
        }
        this.pathToWatchers.get(clean).add(watcherId);
    }

    getAffectedComputed(changedPath) {
        const affected = new Set();
        const cleanChanged = String(changedPath || "").replace(/^(data|state|computed)\./, "").trim();

        for (const [depPath, compSet] of this.pathToComputed.entries()) {
            if (
                depPath === cleanChanged ||
                cleanChanged.startsWith(depPath + ".") ||
                depPath.startsWith(cleanChanged + ".")
            ) {
                compSet.forEach(id => affected.add(id));
            }
        }
        return affected;
    }

    getAffectedWatchers(changedPath) {
        const affected = new Set();
        const cleanChanged = String(changedPath || "").replace(/^(data|state|computed)\./, "").trim();

        for (const [depPath, watchSet] of this.pathToWatchers.entries()) {
            if (
                depPath === cleanChanged ||
                cleanChanged.startsWith(depPath + ".") ||
                depPath.startsWith(cleanChanged + ".")
            ) {
                watchSet.forEach(id => affected.add(id));
            }
        }

        const affectedComputed = this.getAffectedComputed(cleanChanged);
        affectedComputed.forEach(compKey => {
            if (this.pathToWatchers.has(compKey)) {
                this.pathToWatchers.get(compKey).forEach(id => affected.add(id));
            }
        });

        return affected;
    }

    removeComponentDeps(componentName) {
        if (!componentName) return;
        for (const set of this.pathToComputed.values()) {
            Array.from(set).forEach(id => {
                if (id.startsWith(componentName + ":")) set.delete(id);
            });
        }
        for (const set of this.pathToWatchers.values()) {
            Array.from(set).forEach(id => {
                if (id.startsWith(componentName + ":")) set.delete(id);
            });
        }
    }
}

/**
 * EUIXComputedNode
 * Represents a cached, side-effect-free, lazy derived state property.
 */
export class EUIXComputedNode {
    constructor({ id, getter, deps = [], engine = null, component = null }) {
        this.id = id;
        this.getter = getter;
        this.deps = Array.isArray(deps) ? [...deps] : (typeof deps === "string" ? deps.split(",").map(s => s.trim()).filter(Boolean) : []);
        this.engine = engine;
        this.component = component;

        this.cachedValue = undefined;
        this.isDirty = true;
        this.evaluating = false;

        // Auto-extract dependencies if deps array is empty and getter is a string expression
        if (this.deps.length === 0 && typeof getter === "string") {
            const matches = getter.match(/\{(?:data|state|computed)\.([a-zA-Z0-9_\.]+)\}/g) || [];
            matches.forEach(m => {
                const p = m.slice(1, -1).replace(/^(data|state|computed)\./, "");
                if (p && !this.deps.includes(p)) this.deps.push(p);
            });
            const scriptMatches = getter.match(/\$data\.([a-zA-Z0-9_\.]+)/g) || [];
            scriptMatches.forEach(sm => {
                const p = sm.replace(/^\$data\./, "");
                if (p && !this.deps.includes(p)) this.deps.push(p);
            });
        }
    }

    evaluate() {
        if (this.engine) {
            if (!this.engine._evalStack) this.engine._evalStack = new Set();
            if (this.engine._evalStack.has(this.id)) {
                const chain = Array.from(this.engine._evalStack).concat(this.id).join(" -> ");
                const err = new EUIXStructuredError({
                    message: `Circular computed dependency detected: ${chain}`,
                    code: "COMPUTED_CYCLE_ERROR",
                    originatingAction: "COMPUTED",
                    component: this.component
                });
                this.engine.reportError(err, "Computed Cycle Guard");
                throw err;
            }
        }

        if (!this.isDirty) {
            return this.cachedValue;
        }

        if (this.engine) this.engine._evalStack.add(this.id);
        this.evaluating = true;

        const prevEvaluating = this.engine ? this.engine._isEvaluatingComputed : false;
        if (this.engine) this.engine._isEvaluatingComputed = true;

        try {
            let val;
            if (typeof this.getter === "function") {
                val = this.getter.call(this.engine, this.engine.state || this.engine._proxyState, this.engine);
            } else if (typeof this.getter === "string") {
                const getterStr = this.getter.trim();
                if (getterStr.startsWith("return ") || getterStr.includes(";")) {
                    const fn = new Function("$data", "$engine", getterStr);
                    val = fn.call(this.engine, this.engine.state || this.engine._proxyState, this.engine);
                } else if (/[\+\-\*\/]/.test(getterStr) || getterStr.includes("?") || getterStr.includes("{")) {
                    const cleanExpr = getterStr.replace(/\{\s*(data\.\w+|state\.\w+|computed\.\w+|\w+)\s*\}/g, "$1").replace(/^\{\s*|\s*\}$/g, "").trim();
                    val = EUIXExpressionParser.eval(cleanExpr, (key) => this.engine.getState(key));
                    if (val === undefined) {
                        val = this.engine.interpolate(getterStr, {});
                    }
                } else {
                    val = this.engine.getState(getterStr.replace(/^(data|state|computed)\./, ""));
                }
            }

            this.cachedValue = val;
            this.isDirty = false;
            return val;
        } catch (err) {
            const structured = EUIXStructuredError.from(err, {
                originatingAction: "COMPUTED",
                component: this.component
            });
            if (this.engine) this.engine.reportError(structured, `Computed Property Evaluation (${this.id})`);
            throw structured;
        } finally {
            this.evaluating = false;
            if (this.engine && this.engine._evalStack) this.engine._evalStack.delete(this.id);
            if (this.engine) this.engine._isEvaluatingComputed = prevEvaluating;
        }
    }
}

/**
 * EUIXWatchNode
 * Represents a reactive state/computed watcher and side-effect action trigger.
 */
export class EUIXWatchNode {
    constructor({ id, path, handler, engine = null, component = null, options = {} }) {
        this.id = id || "watch_" + Math.random().toString(36).substring(2, 9);
        this.path = path;
        this.handler = handler;
        this.engine = engine;
        this.component = component;
        this.options = options;
    }

    run(rawNewValue, rawOldValue, triggerPath, context = {}) {
        if (!this.engine) return;

        const cleanPath = String(this.path || "").replace(/^(data|state|computed)\./, "").trim();
        const cleanTrigger = String(triggerPath || "").replace(/^(data|state|computed)\./, "").trim();

        let val = rawNewValue;
        let prevVal = rawOldValue;

        if (cleanPath !== cleanTrigger) {
            val = typeof this.engine.getState === "function" ? this.engine.getState(cleanPath) : rawNewValue;
            prevVal = this._lastValue !== undefined ? this._lastValue : rawOldValue;
            if (val === prevVal) return;
            this._lastValue = val;
        } else {
            this._lastValue = val;
        }

        const watchContext = {
            ...(context || {}),
            newValue: val,
            $newValue: val,
            prevValue: prevVal,
            $prevValue: prevVal,
            oldValue: prevVal,
            $oldValue: prevVal,
            path: this.path,
            $path: this.path,
            $timestamp: (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(),
            $source: "WATCHER",
            _componentName: this.component || (context ? context._componentName : null)
        };

        if (typeof this.handler === "function") {
            return this.handler.call(this.engine, val, prevVal, this.path, watchContext);
        } else if (this.handler && typeof this.handler === "object") {
            return this.engine.handleAction(this.handler, watchContext);
        }
    }
}

export const EUIXReactivePlugin = {
    name: "EUIXReactivePlugin",
    install(engineClass) {
        engineClass.EUIXDependencyGraph = EUIXDependencyGraph;
        engineClass.EUIXComputedNode = EUIXComputedNode;
        engineClass.EUIXWatchNode = EUIXWatchNode;

        if (typeof window !== "undefined") {
            window.EUIXDependencyGraph = EUIXDependencyGraph;
            window.EUIXComputedNode = EUIXComputedNode;
            window.EUIXWatchNode = EUIXWatchNode;
        }

        const proto = engineClass.prototype;

        proto.computed = function(id, getter, deps = [], component = null) {
            if (!id || typeof id !== "string") {
                const err = new EUIXStructuredError({
                    message: "Computed definition must specify a non-empty string 'id'",
                    code: "VALIDATION_ERROR",
                    originatingAction: "COMPUTED"
                });
                this.reportError(err, "Computed Registration");
                throw err;
            }

            if (!this._depGraph) this._depGraph = new EUIXDependencyGraph();
            if (!this._computedRegistry) this._computedRegistry = new Map();

            const cleanId = id.replace(/^computed\./, "").trim();

            if (this._computedRegistry.has(cleanId)) {
                const existing = this._computedRegistry.get(cleanId);
                if (existing.component !== component) {
                    const err = new EUIXStructuredError({
                        message: `Duplicate computed property declaration '${cleanId}'`,
                        code: "VALIDATION_ERROR",
                        originatingAction: "COMPUTED"
                    });
                    this.reportError(err, "Computed Registration");
                    throw err;
                }
            }

            const node = new EUIXComputedNode({ id: cleanId, getter, deps, engine: this, component });
            this._computedRegistry.set(cleanId, node);

            node.deps.forEach(dep => {
                const cleanDep = dep.replace(/^(data|state|computed)\./, "");
                this._depGraph.addComputedDep(cleanDep, cleanId);
            });

            return () => {
                if (this._computedRegistry) this._computedRegistry.delete(cleanId);
            };
        };

        proto.getComputed = function(id) {
            if (!id) return undefined;
            const cleanId = String(id).replace(/^computed\./, "").trim();
            const node = this._computedRegistry ? this._computedRegistry.get(cleanId) : null;
            if (!node) return undefined;
            return node.evaluate();
        };

        proto.watch = function(path, handlerOrFn, component = null, options = {}) {
            if (!path) return () => {};

            if (typeof handlerOrFn === "function") {
                const parsedKey = this.parseBindPath ? this.parseBindPath(typeof path === "string" ? path : (path[0] || "")) : path;
                if (!this._stateWatchers) this._stateWatchers = new Map();
                if (!this._stateWatchers.has(parsedKey)) this._stateWatchers.set(parsedKey, []);
                this._stateWatchers.get(parsedKey).push(handlerOrFn);
                return () => {
                    const list = this._stateWatchers ? (this._stateWatchers.get(parsedKey) || []) : [];
                    if (this._stateWatchers) this._stateWatchers.set(parsedKey, list.filter(cb => cb !== handlerOrFn));
                };
            }

            if (!this._depGraph) this._depGraph = new EUIXDependencyGraph();
            if (!this._watchRegistry) this._watchRegistry = new Map();

            const watchId = (component ? component + ":" : "") + "watch_" + Math.random().toString(36).substring(2, 9);
            const paths = Array.isArray(path) ? path : (typeof path === "string" ? path.split(",").map(s => s.trim()).filter(Boolean) : []);

            const node = new EUIXWatchNode({
                id: watchId,
                path: paths[0] || path,
                handler: handlerOrFn,
                engine: this,
                component,
                options
            });

            this._watchRegistry.set(watchId, node);

            paths.forEach(p => {
                const cleanP = p.replace(/^(data|state|computed)\./, "");
                this._depGraph.addWatcherDep(cleanP, watchId);
            });

            return () => {
                if (this._watchRegistry) this._watchRegistry.delete(watchId);
            };
        };

        proto._triggerReactiveWatchers = function(changedPath, newValue, oldValue, context = {}) {
            if (!this._reactiveDepth) this._reactiveDepth = 0;
            this._reactiveDepth++;

            if (this._reactiveDepth > 25) {
                this._reactiveDepth = 0;
                const err = new EUIXStructuredError({
                    message: `Maximum watcher reaction depth (25) exceeded for path "${changedPath}". Possible circular watcher cascade loop.`,
                    code: "WATCHER_CYCLE_ERROR"
                });
                this.reportError(err, "Watcher Cycle Guard");
                throw err;
            }

            try {
                const affectedWatchers = this._depGraph ? this._depGraph.getAffectedWatchers(changedPath) : new Set();
                affectedWatchers.forEach(wId => {
                    const wNode = this._watchRegistry ? this._watchRegistry.get(wId) : null;
                    if (wNode) {
                        if (this._devtools && this._devtools.enabled) {
                            this._devtools.logAction("WATCHER_TRIGGERED", { path: changedPath, watcherId: wId });
                        }
                        wNode.run(newValue, oldValue, changedPath, context);
                    }
                });
            } finally {
                this._reactiveDepth = Math.max(0, this._reactiveDepth - 1);
            }
        };

        proto.disposeComponentReactive = function(componentName) {
            if (!componentName) return;
            if (this._depGraph) this._depGraph.removeComponentDeps(componentName);

            if (this._computedRegistry) {
                for (const [id, node] of this._computedRegistry.entries()) {
                    if (node.component === componentName || id.startsWith(componentName + ":")) {
                        this._computedRegistry.delete(id);
                    }
                }
            }

            if (this._watchRegistry) {
                for (const [id, node] of this._watchRegistry.entries()) {
                    if (node.component === componentName || id.startsWith(componentName + ":")) {
                        this._watchRegistry.delete(id);
                    }
                }
            }
        };
    }
};

export default EUIXReactivePlugin;
