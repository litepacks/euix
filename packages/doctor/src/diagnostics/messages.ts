import type { ApiCallInfo, ComponentReference, PropTypeMismatch, StateInfo } from "../ir/types.js";
import { RULE_CATALOG, getRuleCategory, getRuleExplanation, getRuleMetadata } from "./catalog.js";

export { getRuleCategory, getRuleExplanation, getRuleMetadata, RULE_CATALOG };

export function ruleHint(rule: string): string | undefined {
    return RULE_CATALOG[rule]?.hint;
}

export function formatUnusedStateMessage(state: StateInfo): string {
    return (
        `State '${state.name}' appears unused in '${state.componentName}' ` +
        `(no reads, writes, bindings, prop passes, computed, or watcher refs).`
    );
}

export function formatReadonlyStateMessage(state: StateInfo): string {
    return (
        `State '${state.name}' is read (bindings/API/computed) but never written — ` +
        `it may stay empty unless initialized or updated at runtime.`
    );
}

export function formatUnresolvedComponentMessage(ref: ComponentReference): string {
    const target = ref.refName ?? ref.srcPath ?? "unknown";
    const via = ref.srcPath ? ` (src="${ref.srcPath}")` : "";
    return (
        `Component '${target}' used in '${ref.parentComponentName}' cannot be resolved${via}. ` +
        `Expected a sibling file, <component_def>, or import.`
    );
}

export function formatApiLoadingRiskMessage(api: ApiCallInfo, loadingState?: string): string {
    const loadingHint = loadingState ? ` (loading="${loadingState}")` : "";
    return (
        `API ${api.method} ${api.url} may leave loading active on failure${loadingHint}. ` +
        `Network errors won't trigger bind_target writes.`
    );
}

export function formatPropTypeMismatchMessage(ref: ComponentReference, mismatch: PropTypeMismatch): string {
    return (
        `Prop '${mismatch.prop}' on '${ref.resolvedComponentName}' expects ${mismatch.expected}, ` +
        `but '${ref.parentComponentName}' passes ${mismatch.inferred}.`
    );
}

export function formatComputedUnusedMessage(name: string, componentName: string): string {
    return `Computed '${name}' in '${componentName}' is never referenced in markup or bindings.`;
}

export function formatApiUnusedMessage(api: ApiCallInfo): string {
    return `API ${api.method} ${api.url} has no bind_target/select — response data may be discarded.`;
}
