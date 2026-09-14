import type {
    ActionInfo,
    ApiCallInfo,
    BindingInfo,
    ComponentInfo,
    ComputedInfo,
    EventInfo,
    PropInfo,
    RouteInfo,
    SlotInfo,
    StateInfo,
    WatchInfo,
    WebMcpToolInfo,
} from "../ir/types.js";
import { classifyHandlerKind, EVENT_CALLBACK_ATTRS, resolveActionName } from "./actionHandlers.js";
import {
    analyzeActionBody,
    extractBindingsFromText,
    extractEngineSetStateWrites,
    extractExpressionRefs,
    isEventAttribute,
    normalizeEventName,
} from "../parser/expressions.js";
import {
    elementTextContent,
    findElements,
    makeLocation,
    type ParsedDocument,
    type ParsedElement,
    walkElements,
} from "../parser/xml.js";
import { id } from "../utils/location.js";

const COMPONENT_TAGS = new Set(["component", "component_def"]);
const STATE_TAGS = new Set(["state"]);
const COMPUTED_TAGS = new Set(["computed"]);
const WATCH_TAGS = new Set(["watch"]);
const ACTION_TAGS = new Set(["action", "action_def"]);
const ROUTE_TAGS = new Set(["route"]);
const SLOT_TAGS = new Set(["slot"]);
const EVENT_TAGS = new Set([
    "on_click",
    "on_change",
    "on_submit",
    "on_keyup",
    "on_keydown",
    "on_mount",
    "on_interval",
    "on_state_change",
    "on_visible",
    "on_update",
]);
const API_ENDPOINT_TAGS = new Set(["api_endpoint", "endpoint"]);
const API_STREAM_TAGS = new Set(["api_stream"]);

export interface CollectedEntities {
    components: ComponentInfo[];
    states: StateInfo[];
    computed: ComputedInfo[];
    watchers: WatchInfo[];
    actions: ActionInfo[];
    events: EventInfo[];
    bindings: BindingInfo[];
    props: PropInfo[];
    slots: SlotInfo[];
    routes: RouteInfo[];
    webMcpTools: WebMcpToolInfo[];
    apiCalls: ApiCallInfo[];
}

export function collectFromDocument(doc: ParsedDocument): CollectedEntities {
    const components: ComponentInfo[] = [];
    const states: StateInfo[] = [];
    const computed: ComputedInfo[] = [];
    const watchers: WatchInfo[] = [];
    const actions: ActionInfo[] = [];
    const events: EventInfo[] = [];
    const bindings: BindingInfo[] = [];
    const props: PropInfo[] = [];
    const slots: SlotInfo[] = [];
    const routes: RouteInfo[] = [];
    const webMcpTools: WebMcpToolInfo[] = [];
    const apiCalls: ApiCallInfo[] = [];

    const componentEls = findElements(doc.root, COMPONENT_TAGS);
    if (componentEls.length === 0) {
        collectLooseDocument(doc, {
            components,
            states,
            computed,
            watchers,
            actions,
            events,
            bindings,
            props,
            slots,
            routes,
            webMcpTools,
            apiCalls,
        });
        return {
            components,
            states,
            computed,
            watchers,
            actions,
            events,
            bindings,
            props,
            slots,
            routes,
            webMcpTools,
            apiCalls,
        };
    }

    for (const compEl of componentEls) {
        const componentName = compEl.attributes.name ?? compEl.attributes.id ?? inferNameFromFile(doc.file);
        const componentId = id("component", doc.file, componentName);
        const compLoc = makeLocation(doc.file, doc.source, compEl.start, compEl.end);

        const comp: ComponentInfo = {
            id: componentId,
            name: componentName,
            file: doc.file,
            location: compLoc,
            props: [],
            slots: [],
            stateIds: [],
            computedIds: [],
            watcherIds: [],
            actionIds: [],
            eventIds: [],
            childComponentNames: [],
            childComponentIds: [],
            dependencies: [],
        };

        collectStates(doc, compEl, comp, states);
        collectComputed(doc, compEl, comp, computed);
        collectWatchers(doc, compEl, comp, watchers);
        collectActions(doc, compEl, comp, actions, apiCalls);
        collectPropsAndSlots(doc, compEl, comp, props, slots);
        collectRoutes(doc, compEl, routes);
        collectWebMcpTools(doc, compEl, comp, webMcpTools);
        collectApiEndpoints(doc, compEl, comp, apiCalls, actions);
        collectApiStreams(doc, compEl, comp, apiCalls, actions);
        collectDeclarativeEvents(doc, compEl, comp, events, actions);
        collectEventsAndBindings(doc, compEl, comp, actions, events, bindings);
        collectChildComponents(doc, compEl, comp);

        components.push(comp);
    }

    return {
        components,
        states,
        computed,
        watchers,
        actions,
        events,
        bindings,
        props,
        slots,
        routes,
        webMcpTools,
        apiCalls,
    };
}

function collectLooseDocument(
    doc: ParsedDocument,
    out: CollectedEntities,
): void {
    const componentName = inferNameFromFile(doc.file);
    const componentId = id("component", doc.file, componentName);
    const comp: ComponentInfo = {
        id: componentId,
        name: componentName,
        file: doc.file,
        location: makeLocation(doc.file, doc.source, 0, doc.source.length),
        props: [],
        slots: [],
        stateIds: [],
        computedIds: [],
        watcherIds: [],
        actionIds: [],
        eventIds: [],
        childComponentNames: [],
        childComponentIds: [],
        dependencies: [],
    };

    const virtualRoot: ParsedElement = {
        type: "element",
        tagName: "root",
        attributes: {},
        children: doc.root.filter((n): n is ParsedElement => n.type === "element"),
        selfClosing: false,
        start: 0,
        end: doc.source.length,
    };

    collectStates(doc, virtualRoot, comp, out.states);
    collectComputed(doc, virtualRoot, comp, out.computed);
    collectWatchers(doc, virtualRoot, comp, out.watchers);
    collectActions(doc, virtualRoot, comp, out.actions, out.apiCalls);
    collectRoutes(doc, virtualRoot, out.routes);
    collectWebMcpTools(doc, virtualRoot, comp, out.webMcpTools);
    collectApiEndpoints(doc, virtualRoot, comp, out.apiCalls, out.actions);
    collectApiStreams(doc, virtualRoot, comp, out.apiCalls, out.actions);
    collectDeclarativeEvents(doc, virtualRoot, comp, out.events, out.actions);
    collectEventsAndBindings(doc, virtualRoot, comp, out.actions, out.events, out.bindings);
    out.components.push(comp);
}

function inferNameFromFile(file: string): string {
    const base = file.split(/[/\\]/).pop() ?? "App";
    return base.replace(/\.(xml|html|htm)$/i, "");
}

function collectStates(doc: ParsedDocument, scope: ParsedElement, comp: ComponentInfo, states: StateInfo[]): void {
    for (const el of findElements(scope, STATE_TAGS)) {
        const name = el.attributes.name ?? el.attributes.id;
        if (!name) continue;
        const stateId = id("state", comp.id, name);
        const initial = el.attributes.value ?? el.attributes.default ?? (elementTextContent(el) || null);
        states.push({
            id: stateId,
            name,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            initialValue: initial,
            type: el.attributes.type ?? null,
            location: makeLocation(doc.file, doc.source, el.start, el.end),
            readers: [],
            writers: [],
            watcherDependents: [],
            computedDependents: [],
            bindingConsumers: [],
        });
        comp.stateIds.push(stateId);
    }
}

function collectComputed(doc: ParsedDocument, scope: ParsedElement, comp: ComponentInfo, computed: ComputedInfo[]): void {
    for (const el of findElements(scope, COMPUTED_TAGS)) {
        const name = el.attributes.name ?? el.attributes.id;
        if (!name) continue;
        const expression = elementTextContent(el) || el.attributes.deps || "";
        const explicitDeps = el.attributes.deps?.split(/[, ]+/).filter(Boolean) ?? null;
        const deps = explicitDeps ?? extractExpressionRefs(expression);
        const computedId = id("computed", comp.id, name);
        computed.push({
            id: computedId,
            name,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            expression,
            dependencies: deps,
            explicitDeps,
            dependents: [],
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        });
        comp.computedIds.push(computedId);
    }
}

function collectWatchers(doc: ParsedDocument, scope: ParsedElement, comp: ComponentInfo, watchers: WatchInfo[]): void {
    for (const el of findElements(scope, WATCH_TAGS)) {
        const path = el.attributes.path ?? el.attributes.key ?? el.attributes.name ?? el.attributes.id ?? "";
        const name = path || `watch_${watchers.length}`;
        const steps = findElements(el, new Set(["step"]));
        const body = steps.length
            ? steps.map((step) => elementTextContent(step)).join("\n")
            : elementTextContent(el);
        const analysis = analyzeActionBody(body);
        const watchId = id("watch", comp.id, name);
        watchers.push({
            id: watchId,
            name,
            path,
            action: el.attributes.action ?? steps[0]?.attributes.action ?? null,
            body,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            reads: analysis.reads,
            writes: analysis.writes,
            triggers: analysis.calls,
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        });
        comp.watcherIds.push(watchId);
    }
}

function collectActions(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    actions: ActionInfo[],
    apiCalls: ApiCallInfo[],
): void {
    for (const el of findElements(scope, ACTION_TAGS)) {
        const name = el.attributes.name ?? el.attributes.id;
        if (!name) continue;
        const stepBodies = findElements(el, new Set(["step"]))
            .map((step) => `${step.attributes.action ?? "STEP"} ${elementTextContent(step)}`)
            .join("\n");
        const body = stepBodies || elementTextContent(el);
        const parameters = findElements(el, new Set(["param"]))
            .map((p) => p.attributes.name)
            .filter((n): n is string => !!n);
        const analysis = analyzeActionBody(body);
        const actionId = id("action", comp.id, name);
        const action: ActionInfo = {
            id: actionId,
            name,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            body,
            parameters,
            reads: analysis.reads,
            writes: analysis.writes,
            calls: analysis.calls,
            branches: analysis.branches + (stepBodies ? findElements(el, new Set(["step"])).length : 0),
            loops: analysis.loops,
            awaits: analysis.awaits,
            returns: analysis.returns || !!findElements(el, new Set(["return"])).length,
            throws: analysis.throws,
            apiCallIds: [],
            storageEffects: analysis.storageEffects,
            runtimeEffectIds: analysis.runtimeEffects,
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        };
        actions.push(action);
        comp.actionIds.push(actionId);

        for (const [idx, fetch] of analysis.fetchUrls.entries()) {
            const apiId = id("api", actionId, String(idx));
            apiCalls.push({
                id: apiId,
                method: "GET",
                url: fetch.url,
                urlConfidence: fetch.confidence,
                file: doc.file,
                actionId,
                actionName: name,
                componentName: comp.name,
                responseConsumed: /response\.json|await\s+\w+\.json/.test(body),
                errorHandled: /\bcatch\b|\.catch\(/.test(body) || /\bif\s*\(.*status/.test(body),
                statesWritten: analysis.writes,
                location: makeLocation(doc.file, doc.source, el.start, el.end),
            });
            action.apiCallIds.push(apiId);
        }
    }
}

function collectPropsAndSlots(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    props: PropInfo[],
    slots: SlotInfo[],
): void {
    for (const el of findElements(scope, new Set(["param", "prop"]))) {
        const name = el.attributes.name ?? el.attributes.id;
        if (!name) continue;
        const propId = id("prop", comp.id, name);
        const enumRaw = el.attributes.enum;
        props.push({
            id: propId,
            name,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            required: el.attributes.required === "true",
            type: el.attributes.type ?? null,
            enumValues: enumRaw ? enumRaw.split(",").map((v) => v.trim()).filter(Boolean) : null,
            defaultValue: el.attributes.default ?? null,
            consumers: [],
            passedFrom: [],
        });
        comp.props.push(name);
    }

    for (const el of findElements(scope, SLOT_TAGS)) {
        const name = el.attributes.name ?? "default";
        const slotId = id("slot", comp.id, name);
        const slot: SlotInfo = {
            id: slotId,
            name,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            used: false,
        };
        slots.push(slot);
        comp.slots.push(slot);
    }
}

function collectApiEndpoints(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    apiCalls: ApiCallInfo[],
    actions: ActionInfo[],
): void {
    for (const el of findElements(scope, API_ENDPOINT_TAGS)) {
        const endpointId = el.attributes.id ?? el.attributes.tag ?? el.attributes.name ?? `api_${apiCalls.length}`;
        const url = el.attributes.url ?? el.attributes.src ?? "";
        const method = (el.attributes.method ?? "GET").toUpperCase();
        const urlConfidence = url.includes("{") ? "inferred" : url ? "confirmed" : "unresolved";
        const syntheticActionId = id("action", comp.id, `__api__${endpointId}`);
        if (!actions.some((a) => a.id === syntheticActionId)) {
            actions.push({
                id: syntheticActionId,
                name: `__api__${endpointId}`,
                file: doc.file,
                componentId: comp.id,
                componentName: comp.name,
                body: `REVALIDATE_API ${endpointId}`,
                parameters: [],
                reads: extractBindingRefs(url),
                writes: [el.attributes.bind_target, el.attributes.target, el.attributes.loading, el.attributes.error].filter(Boolean) as string[],
                calls: ["REVALIDATE_API"],
                branches: 0,
                loops: 0,
                awaits: 1,
                returns: false,
                throws: false,
                apiCallIds: [],
                storageEffects: el.attributes.persist ? ["localStorage"] : [],
                runtimeEffectIds: ["fetch"],
                location: makeLocation(doc.file, doc.source, el.start, el.end),
            });
            comp.actionIds.push(syntheticActionId);
        }
        const apiId = id("api", comp.id, endpointId);
        apiCalls.push({
            id: apiId,
            method,
            url,
            urlConfidence,
            file: doc.file,
            actionId: syntheticActionId,
            actionName: endpointId,
            componentName: comp.name,
            responseConsumed: !!(el.attributes.bind_target || el.attributes.target || el.attributes.select),
            errorHandled: !!el.attributes.error,
            statesWritten: [el.attributes.bind_target, el.attributes.target, el.attributes.loading].filter(Boolean) as string[],
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        });
    }
}

function collectApiStreams(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    apiCalls: ApiCallInfo[],
    actions: ActionInfo[],
): void {
    for (const el of findElements(scope, API_STREAM_TAGS)) {
        const streamId = el.attributes.id ?? el.attributes.name ?? `stream_${apiCalls.length}`;
        const streamType = (el.attributes.type ?? "websocket").toLowerCase();
        const url = el.attributes.url ?? el.attributes.src ?? "";
        const method = streamType === "sse" ? "SSE" : "WEBSOCKET";
        const runtimeKind = streamType === "sse" ? "EventSource" : "WebSocket";
        const syntheticActionId = id("action", comp.id, `__stream__${streamId}`);
        if (!actions.some((a) => a.id === syntheticActionId)) {
            actions.push({
                id: syntheticActionId,
                name: `__stream__${streamId}`,
                file: doc.file,
                componentId: comp.id,
                componentName: comp.name,
                body: `STREAM_${method} ${streamId}`,
                parameters: [],
                reads: [],
                writes: [el.attributes.target, el.attributes.status].filter(Boolean) as string[],
                calls: streamType === "sse" ? ["EventSource"] : ["WebSocket", "STREAM_SEND", "STREAM_DISCONNECT"],
                branches: 0,
                loops: 0,
                awaits: 0,
                returns: false,
                throws: false,
                apiCallIds: [],
                storageEffects: [],
                runtimeEffectIds: [runtimeKind],
                location: makeLocation(doc.file, doc.source, el.start, el.end),
            });
            comp.actionIds.push(syntheticActionId);
        }
        const apiId = id("api", comp.id, streamId);
        apiCalls.push({
            id: apiId,
            method,
            url,
            urlConfidence: url ? "confirmed" : "unresolved",
            file: doc.file,
            actionId: syntheticActionId,
            actionName: streamId,
            componentName: comp.name,
            responseConsumed: !!el.attributes.target,
            errorHandled: el.attributes.reconnect === "true",
            statesWritten: [el.attributes.target].filter(Boolean) as string[],
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        });
    }
}

function extractBindingRefs(url: string): string[] {
    const refs: string[] = [];
    for (const m of url.matchAll(/\{data\.(\w+)\}/g)) if (m[1]) refs.push(m[1]!);
    return refs;
}

function extractRevalidateTag(el: ParsedElement, handler: string): string | null {
    if (handler.toUpperCase() !== "REVALIDATE_API") return null;
    const tagEl = findElements(el, new Set(["tag"]))[0];
    if (tagEl) {
        const text = elementTextContent(tagEl).trim();
        if (text) return text;
    }
    return el.attributes.tag ?? null;
}

function extractDeclarativeStateWrites(el: ParsedElement, handler: string): string[] {
    const upper = handler.toUpperCase();
    if (upper === "SET_STATE" || upper.startsWith("SET_STATE:")) {
        const pathEl = findElements(el, new Set(["path"]))[0];
        if (pathEl) {
            const stateName = elementTextContent(pathEl).trim().replace(/^data\./, "");
            return stateName ? [stateName] : [];
        }
        const inline = handler.includes(":") ? handler.split(":")[1] : el.attributes.set;
        if (inline) return [inline.replace(/^data\./, "")];
        return [];
    }
    if (upper === "RUN_SCRIPT" || handler.startsWith("$") || handler.includes(";")) {
        return extractEngineSetStateWrites(elementTextContent(el));
    }
    return [];
}

function collectDeclarativeEvents(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    events: EventInfo[],
    actions: ActionInfo[],
): void {
    walkElements(scope, (el, parent) => {
        if (!EVENT_TAGS.has(el.tagName)) return;
        const eventType = el.tagName.replace(/^on_/, "").replace(/_/g, ":");
        const handler =
            el.attributes.action ??
            el.attributes.call ??
            el.attributes.tag ??
            (el.attributes.set ? `SET_STATE:${el.attributes.set}` : elementTextContent(el));
        if (!handler) return;
        const target = parent?.tagName ?? "unknown";
        const eventId = id("event", comp.id, target, eventType, handler);
        const eventDraft: EventInfo = {
            id: eventId,
            name: `${target}@${eventType}`,
            eventType,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            target,
            handler,
            handlerKind: "unknown",
            stateWrites: extractDeclarativeStateWrites(el, handler),
            revalidateTag: extractRevalidateTag(el, handler),
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        };
        eventDraft.handlerKind = classifyHandlerKind(eventDraft, actions);
        events.push(eventDraft);
        comp.eventIds.push(eventId);

        collectEventCallbackRefs(doc, el, comp, eventType, target, actions, events);
    });
}

function collectEventCallbackRefs(
    doc: ParsedDocument,
    el: ParsedElement,
    comp: ComponentInfo,
    eventType: string,
    target: string,
    actions: ActionInfo[],
    events: EventInfo[],
): void {
    for (const [attr, value] of Object.entries(el.attributes)) {
        if (!EVENT_CALLBACK_ATTRS.has(attr.toLowerCase()) || !value.trim()) continue;
        const cbType = attr.toLowerCase().replace(/^on_/, "");
        const handler = value.trim();
        const cbEvent: EventInfo = {
            id: id("event", comp.id, target, `${eventType}:callback:${cbType}`, handler),
            name: `${target}@${eventType}:callback:${cbType}`,
            eventType: `${eventType}:callback:${cbType}`,
            file: doc.file,
            componentId: comp.id,
            componentName: comp.name,
            target,
            handler,
            handlerKind: resolveActionName(actions, handler).resolved ? "action" : "unknown",
            stateWrites: [],
            revalidateTag: null,
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        };
        events.push(cbEvent);
        comp.eventIds.push(cbEvent.id);
    }
}

function collectRoutes(doc: ParsedDocument, scope: ParsedElement, routes: RouteInfo[]): void {
    for (const el of findElements(scope, ROUTE_TAGS)) {
        const pathValue = el.attributes.path ?? el.attributes.to ?? "/";
        const routeId = id("route", doc.file, pathValue);
        routes.push({
            id: routeId,
            path: pathValue,
            componentName: el.attributes.component ?? el.attributes.name ?? null,
            file: doc.file,
            navigations: [],
            location: makeLocation(doc.file, doc.source, el.start, el.end),
        });
    }
}

function collectWebMcpTools(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    tools: WebMcpToolInfo[],
): void {
    for (const container of findElements(scope, new Set(["webmcp"]))) {
        for (const el of findElements(container, new Set(["tool"]))) {
            const name = el.attributes.name ?? el.attributes.id;
            if (!name) continue;
            tools.push({
                id: id("webmcp", comp.id, name),
                name,
                action: el.attributes.action ?? null,
                file: doc.file,
                componentId: comp.id,
                componentName: comp.name,
                location: makeLocation(doc.file, doc.source, el.start, el.end),
            });
        }
    }
}

function collectEventsAndBindings(
    doc: ParsedDocument,
    scope: ParsedElement,
    comp: ComponentInfo,
    actions: ActionInfo[],
    events: EventInfo[],
    bindings: BindingInfo[],
): void {
    walkElements(scope, (el) => {
        const target = el.tagName;

        for (const [attr, value] of Object.entries(el.attributes)) {
            if (isEventAttribute(attr, el.tagName)) {
                const eventType = normalizeEventName(attr);
                const eventId = id("event", comp.id, target, eventType, value);
                const attrEvent: EventInfo = {
                    id: eventId,
                    name: `${target}@${eventType}`,
                    eventType,
                    file: doc.file,
                    componentId: comp.id,
                    componentName: comp.name,
                    target,
                    handler: value,
                    handlerKind: "unknown",
                    stateWrites: extractDeclarativeStateWrites(el, value),
                    revalidateTag: extractRevalidateTag(el, value),
                    location: makeLocation(doc.file, doc.source, el.start, el.end),
                };
                attrEvent.handlerKind = classifyHandlerKind(attrEvent, actions);
                events.push(attrEvent);
                comp.eventIds.push(eventId);
            }

            if (attr === "bind" || attr.startsWith("bind.")) {
                const bindingId = id("binding", comp.id, target, attr);
                bindings.push({
                    id: bindingId,
                    kind: "attribute",
                    expression: value,
                    sourceId: value,
                    target: `${target}[${attr}]`,
                    file: doc.file,
                    componentId: comp.id,
                    componentName: comp.name,
                    dependencies: extractExpressionRefs(value),
                    location: makeLocation(doc.file, doc.source, el.start, el.end),
                });
            }

            if (attr === "if" || attr === "show" || attr === "unless" || attr === "each") {
                const bindingId = id("binding", comp.id, target, attr);
                bindings.push({
                    id: bindingId,
                    kind: "attribute",
                    expression: value,
                    sourceId: value,
                    target: `${target}[${attr}]`,
                    file: doc.file,
                    componentId: comp.id,
                    componentName: comp.name,
                    dependencies: extractExpressionRefs(value),
                    location: makeLocation(doc.file, doc.source, el.start, el.end),
                });
            }

            if (attr === "condition" && (target === "if" || target === "show" || target === "unless")) {
                const bindingId = id("binding", comp.id, target, "condition");
                bindings.push({
                    id: bindingId,
                    kind: "attribute",
                    expression: value,
                    sourceId: value,
                    target: `${target}[condition]`,
                    file: doc.file,
                    componentId: comp.id,
                    componentName: comp.name,
                    dependencies: extractExpressionRefs(value),
                    location: makeLocation(doc.file, doc.source, el.start, el.end),
                });
            }
        }

        for (const child of el.children) {
            if (child.type !== "text") continue;
            for (const expr of extractBindingsFromText(child.data)) {
                const bindingId = id("binding", comp.id, target, "text", expr);
                bindings.push({
                    id: bindingId,
                    kind: "text",
                    expression: expr,
                    sourceId: expr,
                    target: `${target}:text`,
                    file: doc.file,
                    componentId: comp.id,
                    componentName: comp.name,
                    dependencies: extractExpressionRefs(expr),
                    location: makeLocation(doc.file, doc.source, child.start, child.end),
                });
            }
        }
    });
}

function collectChildComponents(_doc: ParsedDocument, scope: ParsedElement, comp: ComponentInfo): void {
    walkElements(scope, (el) => {
        if (COMPONENT_TAGS.has(el.tagName)) return;
        if (el.attributes.name && el.tagName === "component") {
            comp.childComponentNames.push(el.attributes.name);
        }
    });
}
