import type { EuixProject, EuixPluginId } from "../ir/types.js";

export type { EuixPluginId };

export interface PluginDefinition {
    tags: readonly string[];
    jsImportPatterns: readonly RegExp[];
    actions: readonly string[];
}

/** Markup / import signals → plugin-scoped engine actions. */
export const PLUGIN_REGISTRY: Record<EuixPluginId, PluginDefinition> = {
    core: {
        tags: [],
        jsImportPatterns: [/euixjs\/core/, /EUIXEngineCore/],
        actions: [],
    },
    composer: {
        tags: ["actions", "action_def", "step", "arg_def"],
        jsImportPatterns: [/euixjs\/composer/, /EUIXComposerPlugin/],
        actions: ["EXECUTE_ACTION", "CALL_ACTION", "RUN_WORKFLOW", "ACTION"],
    },
    api: {
        tags: ["api_config", "api_endpoint"],
        jsImportPatterns: [/euixjs\/api/, /EUIXApiPlugin/],
        actions: ["XHR", "REVALIDATE_API", "REVALIDATE"],
    },
    stream: {
        tags: ["api_stream"],
        jsImportPatterns: [/euixjs\/stream/, /EUIXStreamPlugin/],
        actions: ["STREAM_SEND", "STREAM_CONNECT", "STREAM_DISCONNECT"],
    },
    router: {
        tags: ["router", "route", "link", "outlet"],
        jsImportPatterns: [/euixjs\/router/, /EUIXRouterPlugin/],
        actions: ["NAVIGATE", "ROUTER_NAVIGATE", "ROUTER_BACK", "ROUTER_FORWARD", "ROUTER_REVALIDATE"],
    },
    date: {
        tags: ["date_config", "date", "time", "relative_time", "date_range"],
        jsImportPatterns: [/euixjs\/date/, /EUIXDatePlugin/],
        actions: ["SET_DATE_LOCALE", "SET_DATE_TIMEZONE", "FORMAT_DATE", "CALCULATE_DATE_DIFF"],
    },
    validation: {
        tags: ["validation_rules", "field"],
        jsImportPatterns: [/euixjs\/validation/, /EUIXValidationPlugin/],
        actions: ["VALIDATE_FORM", "VALIDATE_FIELD", "RESET_VALIDATION", "CLEAR_ERRORS"],
    },
    chart: {
        tags: ["chart", "chart_axis", "chart_series", "chart_tooltip", "chart_legend"],
        jsImportPatterns: [/euixjs\/chart/, /EUIXChartPlugin/],
        actions: [
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
        ],
    },
    map: {
        tags: ["map", "marker", "tile_layer", "popup", "circle"],
        jsImportPatterns: [/euixjs\/leaflet/, /euixjs\/map/, /EUIXLeafletPlugin/],
        actions: [
            "SET_VIEW",
            "FIT_BOUNDS",
            "FOCUS_LAYER",
            "MAP_FOCUS_LAYER",
            "FIT_LAYER",
            "SELECT_LAYER",
            "CLEAR_MAP",
            "CLEAR_LAYERS",
            "REMOVE_LAYER",
            "DELETE_LAYER",
            "INVALIDATE_MAP_SIZE",
            "RESIZE_MAP",
            "ADD_MARKER",
        ],
    },
    navigator: {
        tags: ["navigator", "nav_item"],
        jsImportPatterns: [/euixjs\/navigator/, /EUIXNavigatorPlugin/],
        actions: [
            "CLIPBOARD_COPY",
            "CLIPBOARD_WRITE",
            "WRITE_CLIPBOARD",
            "COPY_TO_CLIPBOARD",
            "CLIPBOARD_READ",
            "READ_CLIPBOARD",
            "WEB_SHARE",
            "SHARE",
            "VIBRATE",
            "WAKE_LOCK",
            "SET_APP_BADGE",
            "CLEAR_APP_BADGE",
            "GET_GEOLOCATION",
        ],
    },
    animation: {
        tags: ["animations", "animation_def", "keyframe"],
        jsImportPatterns: [/euixjs\/animation/, /EUIXAnimationPlugin/],
        actions: ["ANIMATE", "TRANSITION"],
    },
    resilience: {
        tags: ["retry", "timeout", "delay", "catch", "finally"],
        jsImportPatterns: [/euixjs\/resilience/, /EUIXResiliencePlugin/],
        actions: ["DELAY", "WAIT", "SLEEP", "TIMEOUT", "RETRY"],
    },
    a11y: {
        tags: ["live_region"],
        jsImportPatterns: [/euixjs\/a11y/, /EUIXA11yPlugin/],
        actions: ["ANNOUNCE"],
    },
    storage: {
        tags: ["persistence", "persist"],
        jsImportPatterns: [/euixjs\/storage/, /EUIXStoragePlugin/],
        actions: [],
    },
    webmcp: {
        tags: ["webmcp", "tool"],
        jsImportPatterns: [/euixjs\/webmcp/, /EUIXWebMCPPlugin/],
        actions: [],
    },
    inspector: {
        tags: [],
        jsImportPatterns: [/euixjs\/inspector/, /EUIXInspectorPlugin/],
        actions: ["UNDO_STATE", "HISTORY_UNDO", "REDO_STATE", "HISTORY_REDO", "TAKE_SNAPSHOT"],
    },
};

/** Always-available core engine actions (ACTION_DISPATCH_TABLE). */
export const CORE_ENGINE_ACTIONS = new Set([
    "SET_STATE",
    "TOGGLE_STATE",
    "TOGGLE",
    "MUTATE_STATE",
    "FOCUS",
    "RUN_SCRIPT",
    "EVAL_JS",
    "EXEC_JS",
    "SCRIPT",
    "TRY",
    "RETHROW",
    "THROW",
    "SET_TITLE",
    "UNDO_STATE",
    "REDO_STATE",
    "RESET_ERROR_BOUNDARY",
    "RETRY_ERROR_BOUNDARY",
    "RESET_BOUNDARY",
    "RETRY_BOUNDARY",
    "EMIT",
]);

const ACTION_TO_PLUGIN = buildActionPluginIndex();

function buildActionPluginIndex(): Map<string, EuixPluginId> {
    const map = new Map<string, EuixPluginId>();
    for (const [pluginId, def] of Object.entries(PLUGIN_REGISTRY) as [EuixPluginId, PluginDefinition][]) {
        for (const action of def.actions) {
            map.set(action.toUpperCase(), pluginId);
        }
    }
    return map;
}

export function inferProjectPlugins(project: EuixProject): Set<EuixPluginId> {
    const active = new Set<EuixPluginId>(["core", "composer"]);

    for (const file of project.files) {
        detectPluginsInSource(file.source, active);
    }

    if (project.actions.size > 0) active.add("composer");
    if (project.routes.size > 0) active.add("router");
    if (project.apiCalls.size > 0) active.add("api");
    if (project.webMcpTools.size > 0) active.add("webmcp");
    if ([...project.apiCalls.values()].some((a) => a.method === "WEBSOCKET" || a.method === "SSE")) {
        active.add("stream");
    }

    return active;
}

function detectPluginsInSource(source: string, active: Set<EuixPluginId>): void {
    const tagHits = new Set<string>();
    for (const match of source.matchAll(/<\/?([a-zA-Z][\w.-]*)/g)) {
        if (match[1]) tagHits.add(match[1].toLowerCase().replace(/-/g, "_"));
    }

    for (const [pluginId, def] of Object.entries(PLUGIN_REGISTRY) as [EuixPluginId, PluginDefinition][]) {
        if (pluginId === "core") continue;
        if (def.tags.some((tag) => tagHits.has(tag))) {
            active.add(pluginId);
        }
        if (def.jsImportPatterns.some((re) => re.test(source))) {
            active.add(pluginId);
        }
    }
}

export function buildAllowedEngineActions(activePlugins: Set<EuixPluginId>): Set<string> {
    const allowed = new Set(CORE_ENGINE_ACTIONS);
    for (const pluginId of activePlugins) {
        const def = PLUGIN_REGISTRY[pluginId];
        if (!def) continue;
        for (const action of def.actions) allowed.add(action.toUpperCase());
    }
    return allowed;
}

export function pluginRequiredForAction(actionName: string): EuixPluginId | null {
    return ACTION_TO_PLUGIN.get(actionName.toUpperCase()) ?? null;
}

export function isEngineActionAllowed(actionName: string, activePlugins: Set<EuixPluginId>): boolean {
    const upper = actionName.toUpperCase();
    if (CORE_ENGINE_ACTIONS.has(upper)) return true;
    const pluginId = pluginRequiredForAction(upper);
    if (!pluginId) return false;
    return activePlugins.has(pluginId);
}

export function formatPluginRequiredMessage(actionName: string, pluginId: EuixPluginId): string {
    const def = PLUGIN_REGISTRY[pluginId];
    return (
        `Engine action '${actionName}' requires the '${pluginId}' plugin ` +
        `(add markup such as <${def?.tags[0] ?? "plugin"}> or import 'euixjs/${pluginId}').`
    );
}
