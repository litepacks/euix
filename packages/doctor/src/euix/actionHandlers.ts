import type { ActionInfo, EuixProject, EventInfo } from "../ir/types.js";
import type { EuixPluginId } from "./pluginContext.js";
import {
    buildAllowedEngineActions,
    CORE_ENGINE_ACTIONS,
    formatPluginRequiredMessage,
    inferProjectPlugins,
    pluginRequiredForAction,
} from "./pluginContext.js";

/**
 * Shorthand suffixes from ActionDispatcher._createShorthandActionNode.
 * Value `"custom"` → handler names a user `<action_def>`.
 */
const SHORTHAND_SUFFIX: Record<string, "custom" | string> = {
    set: "SET_STATE",
    set_state: "SET_STATE",
    toggle: "TOGGLE_STATE",
    toggle_state: "TOGGLE_STATE",
    mutate: "MUTATE_STATE",
    mutate_state: "MUTATE_STATE",
    revalidate: "REVALIDATE_API",
    revalidate_api: "REVALIDATE_API",
    rev: "REVALIDATE_API",
    run: "RUN_SCRIPT",
    script: "RUN_SCRIPT",
    eval: "RUN_SCRIPT",
    focus: "FOCUS",
    title: "SET_TITLE",
    set_title: "SET_TITLE",
    undo: "UNDO_STATE",
    redo: "REDO_STATE",
    snapshot: "TAKE_SNAPSHOT",
    emit: "EMIT",
    dispatch: "EMIT",
    retry: "RESET_ERROR_BOUNDARY",
    reset_boundary: "RESET_ERROR_BOUNDARY",
    reset_error_boundary: "RESET_ERROR_BOUNDARY",
    call: "custom",
    workflow: "custom",
    action: "custom",
    auto: "auto",
};

export type HandlerResolutionKind =
    | "builtin"
    | "shorthand-builtin"
    | "custom"
    | "missing"
    | "plugin-required"
    | "dynamic";

export interface ActionResolutionContext {
    actions: ActionInfo[];
    activePlugins: Set<EuixPluginId>;
    allowedEngineActions: Set<string>;
}

export interface HandlerResolution {
    resolved: boolean;
    kind: HandlerResolutionKind;
    actionName: string;
    requiredPlugin?: EuixPluginId;
}

const ALL_PLUGIN_IDS: EuixPluginId[] = [
    "core",
    "composer",
    "api",
    "router",
    "stream",
    "date",
    "validation",
    "chart",
    "map",
    "navigator",
    "animation",
    "resilience",
    "a11y",
    "storage",
    "webmcp",
    "inspector",
];
const ALL_PLUGINS = new Set<EuixPluginId>(ALL_PLUGIN_IDS);

export function createPermissiveActionContext(actions: ActionInfo[]): ActionResolutionContext {
    return {
        actions,
        activePlugins: ALL_PLUGINS,
        allowedEngineActions: buildAllowedEngineActions(ALL_PLUGINS),
    };
}

export function createProjectActionContext(project: EuixProject): ActionResolutionContext {
    const activePlugins = new Set(project.activePlugins ?? [...inferProjectPlugins(project)]);
    return {
        actions: [...project.actions.values()],
        activePlugins,
        allowedEngineActions: buildAllowedEngineActions(activePlugins),
    };
}

export function resolveEventHandler(
    project: EuixProject,
    event: EventInfo,
    ctx?: ActionResolutionContext,
): HandlerResolution {
    const context = ctx ?? createProjectActionContext(project);
    return resolveHandler(event, context);
}

export function resolveActionName(
    actions: ActionInfo[],
    name: string,
    ctx?: ActionResolutionContext,
): HandlerResolution {
    const context = ctx ?? createPermissiveActionContext(actions);
    context.actions = actions;
    return resolveHandler({ eventType: "action", handler: name, componentId: "" }, context);
}

export function classifyHandlerKind(
    event: Pick<EventInfo, "eventType" | "handler" | "componentId">,
    actions: ActionInfo[],
): EventInfo["handlerKind"] {
    return resolveHandler(event, createPermissiveActionContext(actions)).resolved ? "action" : "unknown";
}

export function isDynamicHandler(handler: string): boolean {
    const h = handler.trim();
    if (!h) return false;
    if (/^\{[\s\S]*\}$/.test(h)) return true;
    if (/^(data|props|local|args)\./.test(h)) return true;
    if (/\{[\s\S]+\}/.test(h)) return true;
    return false;
}

export function getHandlerDiagnosticConfidence(
    event: EventInfo,
    resolution: HandlerResolution,
): "confirmed" | "inferred" {
    if (resolution.kind === "dynamic") return "inferred";
    if (isDynamicHandler(event.handler)) return "inferred";
    if (resolution.kind === "plugin-required") return "confirmed";
    return "confirmed";
}

function resolveHandler(
    event: Pick<EventInfo, "eventType" | "handler" | "componentId">,
    ctx: ActionResolutionContext,
): HandlerResolution {
    const handler = event.handler.trim();
    if (!handler) return { resolved: false, kind: "missing", actionName: handler };

    if (isDynamicHandler(handler) && !extractEngineActionName(handler, ctx.allowedEngineActions)) {
        return { resolved: false, kind: "dynamic", actionName: handler };
    }

    const shorthandSuffix = extractShorthandSuffix(event.eventType);
    if (shorthandSuffix) {
        const mapped = SHORTHAND_SUFFIX[shorthandSuffix];
        if (mapped === "auto") return resolveAutoHandler(handler, ctx);
        if (mapped && mapped !== "custom") {
            return resolveEngineAction(mapped, ctx, "shorthand-builtin");
        }
        if (mapped === "custom") {
            if (hasCustomAction(ctx.actions, handler)) {
                return { resolved: true, kind: "custom", actionName: handler };
            }
            return { resolved: false, kind: "missing", actionName: handler };
        }
    }

    const engineAction = extractEngineActionName(handler, ctx.allowedEngineActions);
    if (engineAction) {
        return resolveEngineAction(engineAction, ctx, "builtin");
    }

    const knownEngineName = extractKnownEngineActionName(handler);
    if (knownEngineName) {
        return resolveEngineAction(knownEngineName, ctx, "builtin");
    }

    if (hasCustomAction(ctx.actions, handler)) {
        return { resolved: true, kind: "custom", actionName: handler };
    }

    return { resolved: false, kind: "missing", actionName: handler };
}

function resolveEngineAction(
    actionName: string,
    ctx: ActionResolutionContext,
    kind: "builtin" | "shorthand-builtin",
): HandlerResolution {
    const upper = actionName.toUpperCase();
    if (ctx.allowedEngineActions.has(upper)) {
        return { resolved: true, kind, actionName: upper };
    }
    const pluginId = pluginRequiredForAction(upper);
    if (pluginId) {
        return { resolved: false, kind: "plugin-required", actionName: upper, requiredPlugin: pluginId };
    }
    return { resolved: false, kind: "missing", actionName: upper };
}

function resolveAutoHandler(handler: string, ctx: ActionResolutionContext): HandlerResolution {
    const colonIdx = handler.indexOf(":");
    if (colonIdx !== -1) {
        const subDir = handler.slice(0, colonIdx).trim().toLowerCase();
        const subVal = handler.slice(colonIdx + 1).trim();
        const mapped = SHORTHAND_SUFFIX[subDir];
        if (mapped === "auto") return { resolved: false, kind: "missing", actionName: handler };
        if (mapped && mapped !== "custom") {
            return resolveEngineAction(mapped, ctx, "shorthand-builtin");
        }
        if (mapped === "custom") {
            if (hasCustomAction(ctx.actions, subVal)) {
                return { resolved: true, kind: "custom", actionName: subVal };
            }
            return { resolved: false, kind: "missing", actionName: subVal };
        }
    }

    if (/[=+\-]/.test(handler)) {
        return resolveEngineAction("SET_STATE", ctx, "shorthand-builtin");
    }
    if (handler.startsWith("$") || handler.includes("(") || handler.includes(";")) {
        return resolveEngineAction("RUN_SCRIPT", ctx, "shorthand-builtin");
    }

    return resolveActionName(ctx.actions, handler, ctx);
}

export function formatMissingHandlerMessage(event: EventInfo, resolution: HandlerResolution): string {
    const trigger = `${event.target}@${event.eventType}`;
    const name = resolution.actionName;

    if (resolution.kind === "plugin-required" && resolution.requiredPlugin) {
        return formatPluginRequiredMessage(name, resolution.requiredPlugin) + ` Trigger: ${trigger}.`;
    }

    if (resolution.kind === "dynamic") {
        return (
            `Dynamic action expression '${name}' on ${trigger} cannot be validated statically. ` +
            `Ensure the runtime handler exists when this expression resolves.`
        );
    }

    if (event.eventType.includes(":callback:")) {
        return (
            `Callback action '${name}' referenced by ${trigger} is not defined. ` +
            `Add <action_def name="${name}"> or import a module that exports it via <import src="...">.`
        );
    }

    if (event.eventType.includes(":call") || event.eventType.includes(":workflow") || event.eventType.endsWith(":action")) {
        return (
            `Custom action '${name}' referenced by ${trigger} is not defined. ` +
            `Add <action_def name="${name}"> or import it — engine actions do not need <action_def>.`
        );
    }

    return (
        `Action '${name}' referenced by ${trigger} is not defined in '${event.componentName}'. ` +
        `Add <action_def name="${name}"> or <import src="..."> from a shared actions module.`
    );
}

export function extractShorthandSuffix(eventType: string): string | null {
    const idx = eventType.indexOf(":");
    if (idx === -1) return null;
    return eventType.slice(idx + 1).toLowerCase();
}

/** Match against currently allowed engine/plugin actions. */
function extractEngineActionName(handler: string, allowed: Set<string>): string | null {
    const upper = handler.toUpperCase();
    if (allowed.has(upper)) return upper;

    const colonIdx = handler.indexOf(":");
    if (colonIdx > 0) {
        const prefix = handler.slice(0, colonIdx).toUpperCase();
        if (allowed.has(prefix)) return prefix;
    }

    return null;
}

/** Match against full known engine action namespace (for plugin-required detection). */
function extractKnownEngineActionName(handler: string): string | null {
    const upper = handler.toUpperCase();
    if (CORE_ENGINE_ACTIONS.has(upper) || pluginRequiredForAction(upper)) return upper;

    const colonIdx = handler.indexOf(":");
    if (colonIdx > 0) {
        const prefix = handler.slice(0, colonIdx).toUpperCase();
        if (CORE_ENGINE_ACTIONS.has(prefix) || pluginRequiredForAction(prefix)) return prefix;
    }

    return null;
}

function hasCustomAction(actions: ActionInfo[], name: string): boolean {
    return actions.some((a) => a.name === name || a.name === `__api__${name}`);
}

/** @deprecated Use createProjectActionContext().allowedEngineActions */
export const BUILTIN_ACTIONS = buildAllowedEngineActions(ALL_PLUGINS);

export const EVENT_CALLBACK_ATTRS = new Set([
    "on_success",
    "on_error",
    "on_fail",
    "on_complete",
    "on_cancel",
    "on_finish",
    "on_reject",
    "on_settled",
]);

export const NON_HANDLER_ATTRS = new Set([
    "confirm",
    "prevent",
    "prevent_default",
    "stop",
    "stop_propagation",
    "debounce",
    "throttle",
    "once",
    "passive",
    "capture",
    "tag",
    "stream",
    "locale",
    "target",
    "duration",
    "name",
    "role",
    "readonly",
    "lock_scroll",
    "bind",
]);
