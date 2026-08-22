/**
 * EUIXChartPlugin.js
 * Declarative Chart.js (v4.x) Integration Plugin for EUIX Engine.
 *
 * Provides pure, reactive, buildless Chart.js integration:
 * - <chart id="..." config="{data.chart_config}" width="100%" height="320" update_mode="none" />
 * - Declarative Actions: CHART_UPDATE, CHART_RESIZE, CHART_DESTROY, CHART_SHOW_DATASET, CHART_HIDE_DATASET, CHART_TOGGLE_DATASET, CHART_TOGGLE_DATA, CHART_EXPORT_IMAGE
 * - Normalized Event Bridging: <on_chart_click>, <on_chart_hover>, <on_chart_resize>
 * - Fine-grained in-place updates with zero Virtual DOM overhead
 * - SSR and non-browser environment graceful fallback
 */

let _injectedChart = null;
const _chartElements = new WeakMap();

/**
 * Custom Structured Error for Chart Plugin
 */
export class EUIXChartError extends Error {
    constructor(message, code = "CHART_ERROR", context = {}) {
        super(message);
        this.name = "EUIXChartError";
        this.code = code;
        this.context = context;
    }
}

/**
 * Resolves the Chart.js constructor from injected reference or global window.Chart
 */
export function getChartConstructor() {
    if (_injectedChart) return _injectedChart;
    if (typeof window !== "undefined" && window.Chart) {
        return window.Chart;
    }
    if (typeof globalThis !== "undefined" && globalThis.Chart) {
        return globalThis.Chart;
    }
    return null;
}

/**
 * Safely resolves configuration object from state, context, or JSON string
 */
function resolveConfig(engine, rawConfig, context = {}) {
    if (!rawConfig) return null;
    if (typeof rawConfig === "object" && rawConfig !== null) return rawConfig;

    const clean = String(rawConfig).trim();
    if (clean.startsWith("{") && clean.endsWith("}")) {
        const inner = clean.slice(1, -1).trim();
        if (inner.startsWith("data.") || inner.startsWith("state.")) {
            const path = inner.replace(/^(data|state)\./, "");
            return engine.getState(path);
        }
        if (inner.startsWith("local.") || inner.startsWith("$local.")) {
            const path = inner.replace(/^(\$local|local)\./, "");
            return context && (context._localState?.[path] ?? context.local?.[path]);
        }
        if (inner.startsWith("props.")) {
            const path = inner.replace(/^props\./, "");
            return context && context.props?.[path];
        }
        if (context && context[inner] !== undefined) {
            return context[inner];
        }
        const stateVal = engine.getState(inner);
        if (stateVal !== undefined) return stateVal;
    }

    // Try getState direct
    const stateVal = engine.getState(clean);
    if (stateVal !== undefined) return stateVal;

    // Try parsing as JSON string
    try {
        return JSON.parse(clean);
    } catch (_) {
        return null;
    }
}

/**
 * Extracts bind key / state path from dynamic expression
 */
function extractStatePath(rawExpr) {
    if (!rawExpr || typeof rawExpr !== "string") return null;
    const trimmed = rawExpr.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const inner = trimmed.slice(1, -1).trim();
        return inner.replace(/^(data|state|local|\$local|global|\$global)\./, "");
    }
    return trimmed;
}

export const EUIXChartPlugin = {
    name: "chart",

    /**
     * Configure plugin dependencies (e.g. inject Chart constructor in ESM)
     */
    configure(options = {}) {
        if (options && "Chart" in options) {
            _injectedChart = options.Chart;
        }
    },

    /**
     * Installs plugin into EUIXEngineCore
     */
    install(engineClass) {
        const proto = engineClass.prototype;

        /**
         * Initialize chart map and helper namespace
         */
        const _originalInit =
            proto._initChartStore ||
            function () {
                if (!this._charts) this._charts = new Map();
            };

        // Expose public imperative API on engine instance: engine.chart.*
        Object.defineProperty(proto, "chart", {
            get() {
                if (!this._chartApi) {
                    const engine = this;
                    this._chartApi = {
                        get(id) {
                            return engine._charts ? engine._charts.get(id) : undefined;
                        },
                        has(id) {
                            return engine._charts ? engine._charts.has(id) : false;
                        },
                        update(id, mode) {
                            const chart = this.get(id);
                            if (chart) {
                                chart.update(mode === "default" ? undefined : mode);
                                return true;
                            }
                            return false;
                        },
                        resize(id) {
                            const chart = this.get(id);
                            if (chart) {
                                chart.resize();
                                return true;
                            }
                            return false;
                        },
                        destroy(id) {
                            const chart = this.get(id);
                            if (chart) {
                                try {
                                    chart.destroy();
                                } catch (_) {}
                                engine._charts.delete(id);
                                return true;
                            }
                            return false;
                        },
                        show(id, datasetIndex = 0) {
                            const chart = this.get(id);
                            if (chart) {
                                if (typeof chart.show === "function") {
                                    chart.show(Number(datasetIndex));
                                } else if (typeof chart.setDatasetVisibility === "function") {
                                    chart.setDatasetVisibility(Number(datasetIndex), true);
                                    chart.update();
                                }
                                return true;
                            }
                            return false;
                        },
                        hide(id, datasetIndex = 0) {
                            const chart = this.get(id);
                            if (chart) {
                                if (typeof chart.hide === "function") {
                                    chart.hide(Number(datasetIndex));
                                } else if (typeof chart.setDatasetVisibility === "function") {
                                    chart.setDatasetVisibility(Number(datasetIndex), false);
                                    chart.update();
                                }
                                return true;
                            }
                            return false;
                        },
                        toggleDataset(id, datasetIndex = 0) {
                            const chart = this.get(id);
                            if (chart) {
                                const idx = Number(datasetIndex);
                                const isVisible =
                                    typeof chart.isDatasetVisible === "function" ? chart.isDatasetVisible(idx) : true;
                                if (typeof chart.setDatasetVisibility === "function") {
                                    chart.setDatasetVisibility(idx, !isVisible);
                                    chart.update();
                                }
                                return true;
                            }
                            return false;
                        },
                        toggleData(id, index = 0) {
                            const chart = this.get(id);
                            if (chart) {
                                const idx = Number(index);
                                if (typeof chart.toggleDataVisibility === "function") {
                                    chart.toggleDataVisibility(idx);
                                    chart.update();
                                }
                                return true;
                            }
                            return false;
                        },
                        toBase64Image(id, type = "image/png", quality = 1) {
                            const chart = this.get(id);
                            if (chart && typeof chart.toBase64Image === "function") {
                                return chart.toBase64Image(type, quality);
                            }
                            return null;
                        },
                    };
                }
                return this._chartApi;
            },
            configurable: true,
        });

        const renderChartHandler = function (xmlNode, context = {}, engine = null) {
            const eng = engine || this;
            return eng.renderChart(xmlNode, context);
        };

        if (typeof engineClass.registerComponent === "function") {
            engineClass.registerComponent("chart", renderChartHandler);
            engineClass.registerComponent("euix_chart", renderChartHandler);
        }

        /**
         * Render Declarative Chart Element (<chart ... />)
         */
        proto.renderChart = function (xmlNode, context = {}) {
            if (!this._charts) this._charts = new Map();

            const chartId = xmlNode.getAttribute("id") || `chart_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            const rawConfigAttr =
                xmlNode.getAttribute("config") || xmlNode.getAttribute("bind") || xmlNode.getAttribute("data") || "";
            const rawWidth = xmlNode.getAttribute("width") || "100%";
            const rawHeight = xmlNode.getAttribute("height") || "320";
            const _updateModeAttr = xmlNode.getAttribute("update_mode") || "default";
            const extraClass = xmlNode.getAttribute("class") || "";
            const extraStyle = xmlNode.getAttribute("style") || "";
            const responsiveAttr = xmlNode.getAttribute("responsive");
            const maintainAspectAttr = xmlNode.getAttribute("maintain_aspect_ratio");

            const widthVal = this.interpolate(rawWidth, context).trim();
            const heightVal = this.interpolate(rawHeight, context).trim();
            const widthCss = Number.isNaN(Number(widthVal)) ? widthVal : `${widthVal}px`;
            const heightCss = Number.isNaN(Number(heightVal)) ? heightVal : `${heightVal}px`;

            // SSR / Non-DOM environment graceful fallback
            if (
                typeof window === "undefined" ||
                typeof document === "undefined" ||
                typeof HTMLCanvasElement === "undefined"
            ) {
                const ssrPlaceholder = document ? document.createElement("div") : { tagName: "DIV" };
                if (ssrPlaceholder.setAttribute) {
                    ssrPlaceholder.setAttribute("class", `euix-chart ${extraClass}`.trim());
                    ssrPlaceholder.setAttribute("data-euix-chart", chartId);
                }
                return ssrPlaceholder;
            }

            const ChartConstructor = getChartConstructor();
            if (!ChartConstructor) {
                const err = new EUIXChartError(
                    `Chart.js library is not available. Please load Chart.js via <script> or configure via EUIXChartPlugin.configure({ Chart }).`,
                    "CHARTJS_NOT_AVAILABLE",
                    { chartId },
                );
                if (typeof this.handleStructuredError === "function") {
                    this.handleStructuredError(err, xmlNode);
                }
                const errEl = document.createElement("div");
                errEl.className =
                    "euix-chart-error p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-mono";
                errEl.textContent = `[CHARTJS_NOT_AVAILABLE] ${err.message}`;
                return errEl;
            }

            // Create dedicated relative container to respect Chart.js responsive sizing
            const containerNode = document.createElement("div");
            containerNode.className = ["euix-chart-container", extraClass].filter(Boolean).join(" ");
            containerNode.style.position = "relative";
            containerNode.style.width = widthCss;
            containerNode.style.height = heightCss;
            if (extraStyle) {
                containerNode.style.cssText += `; ${extraStyle}`;
            }

            const canvasNode = document.createElement("canvas");
            canvasNode.className = "euix-chart-canvas";
            canvasNode.style.display = "block";
            canvasNode.style.width = "100%";
            canvasNode.style.height = "100%";
            containerNode.appendChild(canvasNode);

            const initialConfig = resolveConfig(this, rawConfigAttr, context) || {
                type: "line",
                data: { labels: [], datasets: [] },
                options: {},
            };

            // Clone top-level config to avoid mutating user-provided frozen objects
            let activeConfig = {
                type: initialConfig.type || "line",
                data: initialConfig.data || { labels: [], datasets: [] },
                options: {
                    responsive:
                        responsiveAttr !== null
                            ? responsiveAttr !== "false"
                            : (initialConfig.options?.responsive ?? true),
                    maintainAspectRatio:
                        maintainAspectAttr !== null
                            ? maintainAspectAttr === "true"
                            : (initialConfig.options?.maintainAspectRatio ?? false),
                    ...(initialConfig.options || {}),
                },
                plugins: initialConfig.plugins || [],
            };

            let currentChart = null;

            // Helper to dispatch normalized events
            const dispatchChartEvent = (eventName, nativeEvt, elements) => {
                if (!currentChart) return;
                let detail = {
                    chartId,
                    chart: currentChart,
                    nativeEvent: nativeEvt,
                    datasetIndex: null,
                    index: null,
                    label: null,
                    value: null,
                    dataset: null,
                    element: null,
                };

                if (elements && elements.length > 0) {
                    const first = elements[0];
                    const dIdx = first.datasetIndex;
                    const idx = first.index;
                    const ds = currentChart.data?.datasets?.[dIdx];
                    const lbl = currentChart.data?.labels?.[idx];
                    const val = ds ? ds.data?.[idx] : undefined;

                    detail = {
                        chartId,
                        chart: currentChart,
                        nativeEvent: nativeEvt,
                        datasetIndex: dIdx,
                        index: idx,
                        label: lbl,
                        value: val,
                        dataset: ds,
                        element: first,
                    };
                }

                const customEvt = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
                containerNode.dispatchEvent(customEvt);

                // Execute declarative action tags matching the event
                const childTags = Array.from(xmlNode.children || []).filter((c) => {
                    const tag = c.tagName ? c.tagName.toLowerCase() : "";
                    if (eventName === "chart_click" && (tag === "on_chart_click" || tag === "on_click")) return true;
                    if (eventName === "chart_hover" && (tag === "on_chart_hover" || tag === "on_hover")) return true;
                    if (eventName === "chart_resize" && (tag === "on_chart_resize" || tag === "on_resize")) return true;
                    return false;
                });

                childTags.forEach((actionTag) => {
                    const actionContext = {
                        ...context,
                        ...detail,
                        detail,
                        $evt: customEvt,
                        _evt: customEvt,
                        _targetEl: containerNode,
                    };
                    if (typeof this.handleAction === "function") {
                        this.handleAction(actionTag, actionContext);
                    } else if (typeof this.dispatchAction === "function") {
                        this.dispatchAction(actionTag, actionContext);
                    }
                });
            };

            // Attach canvas click listener for interaction
            const onCanvasClick = (e) => {
                if (!currentChart || typeof currentChart.getElementsAtEventForMode !== "function") return;
                try {
                    const elements = currentChart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
                    dispatchChartEvent("chart_click", e, elements);
                } catch (_) {}
            };

            const onCanvasMouseMove = (e) => {
                if (!currentChart || typeof currentChart.getElementsAtEventForMode !== "function") return;
                try {
                    const elements = currentChart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
                    if (elements && elements.length > 0) {
                        dispatchChartEvent("chart_hover", e, elements);
                    }
                } catch (_) {}
            };

            canvasNode.addEventListener("click", onCanvasClick);
            canvasNode.addEventListener("mousemove", onCanvasMouseMove);

            const initOrUpdateChart = (cfg) => {
                const conf = cfg || resolveConfig(this, rawConfigAttr, context);
                if (!conf || typeof conf !== "object") return;

                const cType = conf.type || "line";
                const cData = conf.data || { labels: [], datasets: [] };
                const cOptions = {
                    responsive:
                        responsiveAttr !== null ? responsiveAttr !== "false" : (conf.options?.responsive ?? true),
                    maintainAspectRatio:
                        maintainAspectAttr !== null
                            ? maintainAspectAttr === "true"
                            : (conf.options?.maintainAspectRatio ?? false),
                    ...(conf.options || {}),
                };
                const cPlugins = conf.plugins || [];

                if (!currentChart) {
                    try {
                        activeConfig = { type: cType, data: cData, options: cOptions, plugins: cPlugins };
                        currentChart = new ChartConstructor(canvasNode, activeConfig);
                        this._charts.set(chartId, currentChart);
                        _chartElements.set(containerNode, currentChart);
                    } catch (initErr) {
                        console.warn(`[EUIXChartPlugin] Deferred initialization for "${chartId}":`, initErr);
                    }
                } else {
                    if (currentChart.config && currentChart.config.type !== cType) {
                        try {
                            currentChart.destroy();
                        } catch (_) {}
                        activeConfig = { type: cType, data: cData, options: cOptions, plugins: cPlugins };
                        currentChart = new ChartConstructor(canvasNode, activeConfig);
                        this._charts.set(chartId, currentChart);
                        _chartElements.set(containerNode, currentChart);
                    } else {
                        currentChart.data = cData;
                        currentChart.options = { ...(currentChart.options || {}), ...cOptions };
                        try {
                            currentChart.update("none");
                        } catch (_) {}
                    }
                }
            };

            initOrUpdateChart(initialConfig);

            // Auto-resize and deterministic layout sync when container becomes visible in DOM
            let resizeObserver = null;
            if (typeof ResizeObserver !== "undefined") {
                resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                            if (currentChart) {
                                try {
                                    currentChart.resize();
                                } catch (_) {}
                            } else {
                                initOrUpdateChart();
                            }
                        }
                    }
                });
                resizeObserver.observe(containerNode);
            }

            if (typeof requestAnimationFrame !== "undefined") {
                requestAnimationFrame(() => {
                    initOrUpdateChart();
                    if (currentChart) {
                        try {
                            currentChart.resize();
                            currentChart.update();
                        } catch (_) {}
                    }
                });
            }

            // Fine-grained state change listener & updater
            const applyChartUpdate = (newRawConfig) => {
                initOrUpdateChart(resolveConfig(this, newRawConfig, context));
            };

            const boundKey = extractStatePath(rawConfigAttr);
            if (boundKey && typeof this.registerBinding === "function") {
                this.registerBinding(boundKey, containerNode, "chart", (newVal) => {
                    applyChartUpdate(newVal);
                });
            }

            // Cleanup on destroy / unmount
            const cleanupFn = () => {
                if (resizeObserver) {
                    try {
                        resizeObserver.disconnect();
                    } catch (_) {}
                    resizeObserver = null;
                }
                canvasNode.removeEventListener("click", onCanvasClick);
                canvasNode.removeEventListener("mousemove", onCanvasMouseMove);
                if (currentChart) {
                    try {
                        currentChart.destroy();
                    } catch (_) {}
                    currentChart = null;
                }
                if (this._charts) {
                    this._charts.delete(chartId);
                }
            };

            (this._destroyHooks = this._destroyHooks || []).push(cleanupFn);

            return containerNode;
        };

        /**
         * Declarative Action Dispatcher Handlers
         */
        proto.executeChartAction = function (actionName, actionNode, context = {}) {
            if (!this._charts) this._charts = new Map();

            const chartId =
                actionNode.getAttribute("chart") ||
                actionNode.getAttribute("chart_id") ||
                actionNode.getAttribute("id");

            let chart = chartId ? this._charts.get(chartId) : this._charts.values().next().value;

            if (!chart && chartId && typeof document !== "undefined") {
                const el =
                    document.getElementById(chartId) ||
                    document.querySelector(`[data-chart-id="${chartId}"]`) ||
                    document.querySelector(`[id="${chartId}"]`);
                if (el) {
                    chart =
                        _chartElements.get(el) ||
                        el._chartInstance ||
                        (el.querySelector && el.querySelector("canvas") && el.querySelector("canvas")._chartInstance);
                }
            }

            if (!chart && this._charts.size > 0) {
                chart = this._charts.values().next().value;
            }

            if (!chart && actionName !== "CHART_DESTROY") {
                console.warn(`[EUIXChartPlugin] Action "${actionName}" target chart "${chartId}" not found.`);
                return false;
            }

            const rawMode = actionNode.getAttribute("mode") || actionNode.getAttribute("update_mode") || "default";
            const mode = rawMode === "default" ? undefined : rawMode;

            const datasetIdxAttr =
                actionNode.getAttribute("dataset_index") ||
                actionNode.getAttribute("dataset") ||
                actionNode.getAttribute("index") ||
                "0";
            const datasetIndex = Number(this.interpolate(datasetIdxAttr, context)) || 0;

            const dataIdxAttr = actionNode.getAttribute("data_index") || actionNode.getAttribute("index") || "0";
            const dataIndex = Number(this.interpolate(dataIdxAttr, context)) || 0;

            switch (actionName) {
                case "CHART_UPDATE":
                    chart.update(mode);
                    return true;

                case "CHART_RESIZE":
                    chart.resize();
                    return true;

                case "CHART_DESTROY":
                    if (chart) {
                        try {
                            chart.destroy();
                        } catch (_) {}
                        if (chartId) this._charts.delete(chartId);
                    }
                    return true;

                case "CHART_SHOW_DATASET":
                    if (typeof chart.show === "function") {
                        chart.show(datasetIndex);
                    } else if (typeof chart.setDatasetVisibility === "function") {
                        chart.setDatasetVisibility(datasetIndex, true);
                        chart.update(mode);
                    }
                    return true;

                case "CHART_HIDE_DATASET":
                    if (typeof chart.hide === "function") {
                        chart.hide(datasetIndex);
                    } else if (typeof chart.setDatasetVisibility === "function") {
                        chart.setDatasetVisibility(datasetIndex, false);
                        chart.update(mode);
                    }
                    return true;

                case "CHART_TOGGLE_DATASET": {
                    const isVis =
                        typeof chart.isDatasetVisible === "function" ? chart.isDatasetVisible(datasetIndex) : true;
                    if (typeof chart.setDatasetVisibility === "function") {
                        chart.setDatasetVisibility(datasetIndex, !isVis);
                        chart.update(mode);
                    }
                    return true;
                }

                case "CHART_TOGGLE_DATA":
                    if (typeof chart.toggleDataVisibility === "function") {
                        chart.toggleDataVisibility(dataIndex);
                        chart.update(mode);
                    }
                    return true;

                case "CHART_EXPORT":
                case "EXPORT_CHART":
                case "CHART_EXPORT_PNG":
                case "CHART_EXPORT_IMAGE": {
                    const targetState =
                        actionNode.getAttribute("target") ||
                        actionNode.getAttribute("bind") ||
                        actionNode.getAttribute("to") ||
                        actionNode.getAttribute("target_state");
                    const imgType = actionNode.getAttribute("type") || "image/png";
                    const quality = Number(actionNode.getAttribute("quality")) || 1;
                    const download =
                        actionNode.getAttribute("download") === "true" || actionNode.getAttribute("save") === "true";
                    const filename = actionNode.getAttribute("filename") || (chartId ? `${chartId}.png` : "chart.png");

                    let base64 = null;
                    if (chart && typeof chart.toBase64Image === "function") {
                        base64 = chart.toBase64Image(imgType, quality);
                    } else if (chart && chart.canvas && typeof chart.canvas.toDataURL === "function") {
                        base64 = chart.canvas.toDataURL(imgType, quality);
                    }

                    if (base64) {
                        if (targetState && typeof this.setState === "function") {
                            const cleanPath = targetState.replace(/^(?:parent\.)?(?:data|state)\./, "");
                            this.setState(cleanPath, base64);
                        }
                        if (download && typeof document !== "undefined") {
                            const a = document.createElement("a");
                            a.href = base64;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        }
                        return base64;
                    }
                    return null;
                }

                default:
                    return false;
            }
        };

        // Register Chart Actions in EUIX Action Registry
        const chartActions = [
            "CHART_UPDATE",
            "CHART_RESIZE",
            "CHART_DESTROY",
            "CHART_SHOW_DATASET",
            "CHART_HIDE_DATASET",
            "CHART_TOGGLE_DATASET",
            "CHART_TOGGLE_DATA",
            "CHART_EXPORT",
            "EXPORT_CHART",
            "CHART_EXPORT_PNG",
            "CHART_EXPORT_IMAGE",
        ];

        chartActions.forEach((actionName) => {
            if (typeof engineClass.registerAction === "function") {
                engineClass.registerAction(actionName, function (actionNode, context) {
                    return this.executeChartAction(actionName, actionNode, context);
                });
            }
        });
    },
};

export default EUIXChartPlugin;
