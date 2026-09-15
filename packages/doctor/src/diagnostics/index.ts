import {
    collectUnknownApiWatchPaths,
    collectUnknownRevalidateTags,
} from "../analysis/apiRefs.js";
import { detectComputedCycles, detectWatcherCycles, watcherSelfLoop } from "../analysis/dependencies.js";
import {
    collectLinkTargets,
    findMatchingRoute,
    hasRouterWithoutOutlet,
} from "../analysis/routerValidation.js";
import { applyDoctorConfig, loadDoctorConfig } from "../config/rules.js";
import {
    validateComponentSrcPaths,
    validateDuplicateApiTags,
    validateDuplicateIds,
} from "../analysis/identityValidation.js";
import { validateUnknownVariables } from "../analysis/variableRefs.js";
import { validateXmlScriptSafety } from "../analysis/xmlScriptValidation.js";
import { canonicalFilePath } from "../utils/paths.js";
import { attachFixesToDiagnostics } from "../fixes/attach.js";
import {
    createProjectActionContext,
    formatMissingHandlerMessage,
    getHandlerDiagnosticConfidence,
    resolveActionName,
    resolveEventHandler,
} from "../euix/actionHandlers.js";
import type { Diagnostic, EuixProject } from "../ir/types.js";
import {
    formatApiLoadingRiskMessage,
    formatApiUnusedMessage,
    formatComputedUnusedMessage,
    formatPropTypeMismatchMessage,
    formatReadonlyStateMessage,
    formatUnresolvedComponentMessage,
    formatUnusedStateMessage,
    getRuleCategory,
    getRuleExplanation,
    ruleHint,
} from "./messages.js";

export function runDiagnostics(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [...validateXmlScriptSafety(project)];
    const stateNames = new Set([...project.states.values()].map((s) => s.name));

    for (const state of project.states.values()) {
        if (
            state.writers.length === 0 &&
            state.readers.length === 0 &&
            state.bindingConsumers.length === 0 &&
            state.computedDependents.length === 0 &&
            state.watcherDependents.length === 0
        ) {
            diagnostics.push(
                diag(
                    "EUIX1002",
                    "warning",
                    formatUnusedStateMessage(state),
                    state.file,
                    state.location.line,
                    state.location.column,
                    "inferred",
                    ruleHint("EUIX1002"),
                ),
            );
        }
        if (state.readers.length > 0 && state.writers.length === 0 && !state.initialValue) {
            diagnostics.push(
                diag(
                    "STATE-READONLY",
                    "info",
                    formatReadonlyStateMessage(state),
                    state.file,
                    state.location.line,
                    state.location.column,
                    "inferred",
                    ruleHint("STATE-READONLY"),
                ),
            );
        }
    }

    diagnostics.push(...validateUnknownVariables(project));
    diagnostics.push(...validateDuplicateIds(project));
    diagnostics.push(...validateDuplicateApiTags(project));
    diagnostics.push(...validateComponentSrcPaths(project));

    for (const computed of project.computed.values()) {
        if (computed.dependents.length === 0) {
            diagnostics.push(
                diag(
                    "COMPUTED-UNUSED",
                    "warning",
                    formatComputedUnusedMessage(computed.name, computed.componentName),
                    computed.file,
                    computed.location.line,
                    computed.location.column,
                    "inferred",
                    ruleHint("COMPUTED-UNUSED"),
                ),
            );
        }
    }

    for (const cycle of detectComputedCycles(project)) {
        const names = cycle.map((id) => project.computed.get(id)?.name ?? id).join(" → ");
        const first = project.computed.get(cycle[0]!);
        diagnostics.push(
            diag(
                "EUIX1101",
                "error",
                `Computed dependency cycle: ${names}`,
                first?.file ?? project.root,
                first?.location.line ?? 1,
                first?.location.column ?? 1,
                "confirmed",
                ruleHint("EUIX1101"),
            ),
        );
    }

    for (const watch of project.watchers.values()) {
        if (!watcherSelfLoop(watch, project)) continue;
        const watched = watch.path.replace(/^data\./, "");
        diagnostics.push(
            diag(
                "EUIX1201",
                "warning",
                `Watcher on '${watched}' writes the same state (reactive loop risk).`,
                watch.file,
                watch.location.line,
                watch.location.column,
                "confirmed",
                ruleHint("EUIX1201"),
                [watch.id],
            ),
        );
    }

    for (const cycle of detectWatcherCycles(project)) {
        const names = cycle
            .map((id) => {
                const w = project.watchers.get(id);
                return w?.path || w?.name || id;
            })
            .join(" → ");
        const first = project.watchers.get(cycle[0]!);
        diagnostics.push(
            diag(
                "WATCH-CYCLE",
                "warning",
                `Watcher chain cycle between data states: ${names}`,
                first?.file ?? project.root,
                first?.location.line ?? 1,
                first?.location.column ?? 1,
                "inferred",
                ruleHint("EUIX1201"),
            ),
        );
    }

    for (const { watch, tag } of collectUnknownApiWatchPaths(project)) {
        diagnostics.push(
            diag(
                "EUIX1701",
                "error",
                `Watcher on '${watch.path}' references unknown API tag '${tag}'.`,
                watch.file,
                watch.location.line,
                watch.location.column,
                "confirmed",
                ruleHint("EUIX1701"),
                [watch.id],
            ),
        );
    }

    for (const tag of collectUnknownRevalidateTags(project)) {
        const sample = [...project.events.values()].find((e) => e.revalidateTag === tag);
        diagnostics.push(
            diag(
                "EUIX1702",
                "error",
                `REVALIDATE_API references unknown endpoint tag '${tag}'.`,
                sample?.file ?? project.root,
                sample?.location.line ?? 1,
                sample?.location.column ?? 1,
                "confirmed",
                ruleHint("EUIX1702"),
            ),
        );
    }

    const actionCtx = createProjectActionContext(project);

    for (const event of project.events.values()) {
        const resolution = resolveEventHandler(project, event, actionCtx);
        if (resolution.resolved) continue;

        const confidence = getHandlerDiagnosticConfidence(event, resolution);
        const rule = resolution.kind === "plugin-required" ? "EUIX1302" : "EUIX1301";
        const severity = resolution.kind === "dynamic" ? "info" : "error";

        diagnostics.push(
            diag(
                rule,
                severity,
                formatMissingHandlerMessage(event, resolution),
                event.file,
                event.location.line,
                event.location.column,
                confidence,
                ruleHint(rule),
                [event.id],
            ),
        );
    }

    for (const watch of project.watchers.values()) {
        if (!watch.action) continue;
        const resolution = resolveActionName(actionCtx.actions, watch.action, actionCtx);
        if (resolution.resolved) continue;

        const rule = resolution.kind === "plugin-required" ? "EUIX1302" : "EUIX1301";
        const severity = resolution.kind === "dynamic" ? "info" : "error";

        diagnostics.push(
            diag(
                rule,
                severity,
                resolution.kind === "plugin-required" && resolution.requiredPlugin
                    ? formatMissingHandlerMessage(
                          {
                              id: watch.id,
                              name: `watch@${watch.name}`,
                              eventType: "watch",
                              file: watch.file,
                              componentId: watch.componentId,
                              componentName: watch.componentName,
                              target: "watch",
                              handler: watch.action,
                              handlerKind: "unknown",
                              stateWrites: [],
                              revalidateTag: null,
                              location: watch.location,
                          },
                          resolution,
                      )
                    : `Watcher on '${watch.path || watch.name}' references unknown action '${watch.action}' in '${watch.componentName}'.`,
                watch.file,
                watch.location.line,
                watch.location.column,
                resolution.kind === "dynamic" ? "inferred" : "confirmed",
                ruleHint(rule),
                [watch.id],
            ),
        );
    }

    for (const api of project.apiCalls.values()) {
        if (!api.errorHandled) {
            const loadingState = api.statesWritten.find((s) => /loading/i.test(s));
            diagnostics.push(
                diag(
                    "EUIX1501",
                    "warning",
                    formatApiLoadingRiskMessage(api, loadingState),
                    api.file,
                    api.location.line,
                    api.location.column,
                    "inferred",
                    ruleHint("EUIX1501"),
                    [api.actionId],
                ),
            );
        }
        if (!api.responseConsumed) {
            diagnostics.push(
                diag(
                    "API-UNUSED",
                    "info",
                    formatApiUnusedMessage(api),
                    api.file,
                    api.location.line,
                    api.location.column,
                    "inferred",
                    ruleHint("API-UNUSED"),
                ),
            );
        }
    }

    for (const action of project.actions.values()) {
        for (const write of action.writes) {
            const name = write.replace(/^data\./, "");
            if (!stateNames.has(name)) {
                diagnostics.push(
                    diag(
                        "EUIX1001",
                        "error",
                        `Action '${action.name}' writes unknown state '${write}' in '${action.componentName}'.`,
                        action.file,
                        action.location.line,
                        action.location.column,
                        "confirmed",
                        ruleHint("EUIX1001"),
                    ),
                );
            }
        }
    }

    for (const ref of project.componentRefs.values()) {
        if (!ref.resolvedComponentId) {
            diagnostics.push(
                diag(
                    "EUIX1401",
                    "error",
                    formatUnresolvedComponentMessage(ref),
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    ref.srcPath ? "confirmed" : "inferred",
                    ruleHint("EUIX1401"),
                    [ref.id],
                ),
            );
            continue;
        }
        for (const missingProp of ref.missingRequiredProps) {
            diagnostics.push(
                diag(
                    "EUIX1402",
                    "error",
                    `Missing required prop '${missingProp}' on '${ref.resolvedComponentName}' (used in '${ref.parentComponentName}').`,
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    "confirmed",
                    ruleHint("EUIX1402"),
                    [ref.id],
                ),
            );
        }
        for (const mismatch of ref.propTypeMismatches) {
            diagnostics.push(
                diag(
                    "EUIX1403",
                    "error",
                    formatPropTypeMismatchMessage(ref, mismatch),
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    "inferred",
                    ruleHint("EUIX1403"),
                    [ref.id],
                ),
            );
        }
    }

    if (hasRouterWithoutOutlet(project)) {
        const sample = [...project.routes.values()][0];
        diagnostics.push(
            diag(
                "EUIX2001",
                "warning",
                "Router markup or routes are defined but no <outlet /> was found — routed views may not render.",
                sample?.file ?? project.root,
                sample?.location.line ?? 1,
                sample?.location.column ?? 1,
                "confirmed",
                ruleHint("EUIX2001"),
            ),
        );
    }

    for (const link of collectLinkTargets(project)) {
        if (findMatchingRoute(project, link.to)) continue;
        diagnostics.push(
            diag(
                "EUIX2002",
                "error",
                `Router link to '${link.to}' does not match any declared <route path="...">.`,
                link.file,
                link.line,
                link.column,
                "confirmed",
                ruleHint("EUIX2002"),
            ),
        );
    }

    for (const tool of project.webMcpTools.values()) {
        if (!tool.action) {
            diagnostics.push(
                diag(
                    "EUIX1901",
                    "error",
                    `WebMCP tool '${tool.name}' has no action attribute.`,
                    tool.file,
                    tool.location.line,
                    tool.location.column,
                    "confirmed",
                    ruleHint("EUIX1901"),
                    [tool.id],
                ),
            );
            continue;
        }
        const resolution = resolveActionName(actionCtx.actions, tool.action, actionCtx);
        if (resolution.resolved) continue;
        diagnostics.push(
            diag(
                "EUIX1901",
                "error",
                `WebMCP tool '${tool.name}' references unknown action '${tool.action}' in '${tool.componentName}'.`,
                tool.file,
                tool.location.line,
                tool.location.column,
                "confirmed",
                ruleHint("EUIX1901"),
                [tool.id],
            ),
        );
    }

    const config = loadDoctorConfig(project.root);
    const fileSources = new Map(project.files.map((f) => [canonicalFilePath(f.path), f.source]));
    const filtered = applyDoctorConfig(diagnostics, config, fileSources);

    project.diagnostics = filtered;
    attachFixesToDiagnostics(project);
    return filtered;
}

function diag(
    rule: string,
    severity: Diagnostic["severity"],
    message: string,
    file: string,
    line: number,
    column: number,
    confidence: Diagnostic["confidence"],
    hint?: string,
    relatedIds?: string[],
): Diagnostic {
    return {
        id: `${rule}:${file}:${line}:${column}`,
        rule,
        category: getRuleCategory(rule),
        severity,
        message,
        hint: hint ?? ruleHint(rule),
        explanation: getRuleExplanation(rule),
        file,
        line,
        column,
        confidence,
        relatedIds,
    };
}
