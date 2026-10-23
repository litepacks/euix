/**
 * src/plugins/EUIXProfilerPlugin.js
 * Modular Performance Profiler & DevTools Connector Plugin for EUIX Engine.
 */

import {
    _getTestStats,
    enableDevTools,
    getBindingsStats,
    getPerformanceMetrics,
    updateDevToolsStatus,
} from "../core/profiler/Profiler.js";

export const EUIXProfilerPlugin = {
    name: "profiler",

    install(EngineClass) {
        if (EngineClass.hooks && typeof EngineClass.hooks.on === "function") {
            // Register hook listeners for DevTools status updates and mount metrics
            EngineClass.hooks.on("engine:init", (engine) => {
                engine._mountStartTime =
                    typeof performance !== "undefined" && typeof performance.now === "function"
                        ? performance.now()
                        : Date.now();

                // Initialize DevTools status on engine initialization
                updateDevToolsStatus(engine);

                if (engine.hooks) {
                    engine.hooks.on("devtools:status", ({ key, deltaOrValue }) => {
                        updateDevToolsStatus(engine, key, deltaOrValue);
                    });
                }
            });

            EngineClass.hooks.on("engine:mount", (engine) => {
                if (engine._mountStartTime) {
                    const now =
                        typeof performance !== "undefined" && typeof performance.now === "function"
                            ? performance.now()
                            : Date.now();
                    engine._mountDuration = Number((now - engine._mountStartTime).toFixed(2));
                }
            });
        }
    },

    getPerformanceMetrics(engine, EngineClass) {
        return getPerformanceMetrics(engine, EngineClass);
    },

    getBindingsStats(engine) {
        return getBindingsStats(engine);
    },

    _getTestStats(engine) {
        return _getTestStats(engine);
    },

    updateDevToolsStatus(engine, key, deltaOrValue) {
        return updateDevToolsStatus(engine, key, deltaOrValue);
    },

    enableDevTools(engine, autoOpen = false) {
        return enableDevTools(engine, autoOpen);
    },
};

export {
    _getTestStats,
    enableDevTools,
    getBindingsStats,
    getPerformanceMetrics,
    updateDevToolsStatus,
};

export default EUIXProfilerPlugin;
