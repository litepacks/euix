/**
 * src/core/profiler/Profiler.js
 * Performance metrics, DevTools connector, and diagnostic profiling helpers for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import { isFn } from "../utils/constants.js";

export function updateDevToolsStatus(_engine, key, deltaOrValue) {
    if (typeof window === "undefined") return;
    if (!window.__EUIX_DEVTOOLS__) {
        window.__EUIX_DEVTOOLS__ = {
            pendingActions: 0,
            pendingLoaders: 0,
            pendingRevalidations: 0,
            routeTransition: false,
            ready: true,
        };
    }
    const dev = window.__EUIX_DEVTOOLS__;
    if (typeof deltaOrValue === "number") {
        dev[key] = Math.max(0, (dev[key] || 0) + deltaOrValue);
    } else if (typeof deltaOrValue === "boolean") {
        dev[key] = deltaOrValue;
    }
    dev.ready =
        dev.pendingActions === 0 && dev.pendingLoaders === 0 && dev.pendingRevalidations === 0 && !dev.routeTransition;
}

export function getBindingsStats(engine) {
    let totalBindings = 0;
    const uniqueElements = new Set();
    if (engine._bindings) {
        for (const list of engine._bindings.values()) {
            if (Array.isArray(list)) {
                totalBindings += list.length;
                list.forEach((item) => {
                    if (item.el) uniqueElements.add(item.el);
                });
            }
        }
    }
    return {
        totalBindings,
        uniqueElements: uniqueElements.size,
        registeredKeys: engine._bindings ? engine._bindings.size : 0,
    };
}

export function _getTestStats(engine) {
    return {
        activeIntervals: engine._activeIntervals ? engine._activeIntervals.length : 0,
        activeWatchers:
            (engine._stateWatchers ? engine._stateWatchers.size : 0) +
            (engine._watchRegistry ? engine._watchRegistry.size : 0),
        activeSubscriptions: engine._bindings ? engine._bindings.size : 0,
        activeXhrs: engine._registeredXhrs ? engine._registeredXhrs.size : 0,
        mountedComponents: engine._componentSpecs ? engine._componentSpecs.size : 0,
        activeAnimations: engine._activeAnimations ? engine._activeAnimations.size : 0,
        activeControllers: engine._activeControllers ? engine._activeControllers.size : 0,
        activeResources: engine._externalResources ? engine._externalResources.size : 0,
    };
}

export function getPerformanceMetrics(engine, EngineClass) {
    const bindingsStats = getBindingsStats(engine);
    return {
        mountDuration: engine._mountDuration || 0,
        activeBindingsCount: bindingsStats.totalBindings,
        boundElementsCount: bindingsStats.uniqueElements,
        astCache: EngineClass.getAstCacheStats(),
        componentCache: {
            astCount: EngineClass._componentAstCache ? EngineClass._componentAstCache.size : 0,
            urlCount: EngineClass._componentUrlCache ? EngineClass._componentUrlCache.size : 0,
        },
        expressionCacheSize: EUIXExpressionParser._cache ? EUIXExpressionParser._cache.size : 0,
        componentsCount: engine._componentSpecs ? engine._componentSpecs.size : 0,
        rawStateKeysCount: engine._rawState ? Object.keys(engine._rawState).length : 0,
        activeWatchersCount:
            (engine._stateWatchers ? engine._stateWatchers.size : 0) +
            (engine._watchRegistry ? engine._watchRegistry.size : 0),
        computedPropertiesCount: engine._computedRegistry ? engine._computedRegistry.size : 0,
        memory:
            typeof performance !== "undefined" && performance.memory && performance.memory.usedJSHeapSize
                ? {
                      usedJSHeapSize: `${(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`,
                      totalJSHeapSize: `${(performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB`,
                  }
                : null,
    };
}

export function enableDevTools(engine, autoOpen = false) {
    if (typeof window !== "undefined") {
        const devToolsClass = window.EUIXDevTools || (typeof EUIXDevTools !== "undefined" ? EUIXDevTools : null);
        if (devToolsClass && isFn(devToolsClass.init)) {
            const devtools = devToolsClass.init(engine);
            if (devtools && autoOpen) devtools.toggle(true);
        }
    }
    return engine;
}
