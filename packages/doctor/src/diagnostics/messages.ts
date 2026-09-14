import type { ApiCallInfo, ComponentReference, PropTypeMismatch, StateInfo } from "../ir/types.js";

const RULE_HINTS: Record<string, string> = {
    EUIX0001:
        "Wrap inline JavaScript in <![CDATA[ ... ]]> inside <computed>, <step>, or RUN_SCRIPT — do not escape JS operators as XML entities.",
    EUIX1001: "Define <state id=\"...\"> in the component data_model or fix the action write target.",
    EUIX1002: "Wire the state into bindings, props, computed deps, watchers, or actions — or remove it.",
    EUIX1101: "Break the cycle by removing a computed dependency or inlining one of the computed values.",
    EUIX1102: "Add the missing state/computed or fix the deps attribute on the computed block.",
    EUIX1103: "Fix the deps attribute on <computed> — use existing state/computed ids from this component.",
    EUIX1120: "Rename or remove the duplicate state/computed/action id in the same component.",
    EUIX1404: "Create the referenced XML/HTML file or fix the src path on the component tag.",
    EUIX1703: "Use a unique tag/id for each api_endpoint — watcher paths depend on api.<tag>.*.",
    EUIX1110:
        "Define <state id=\"...\"> or <computed id=\"...\"> in this component, or fix the template/script reference.",
    EUIX1201: "Avoid writing the same state the watcher observes; use a derived flag or separate buffer state.",
    EUIX1301: "Add <action_def name=\"...\">, import a shared actions module, or use a built-in engine action.",
    EUIX1302: "Add the plugin markup (e.g. <api_config>) or import the plugin JS module for this action.",
    EUIX1401: "Create <component_def name=\"...\">, add src=\"./File.xml\", or use a built-in HTML/EUIX tag.",
    EUIX1402: "Pass the required prop on the component tag: <Child propName=\"{data.value}\" />.",
    EUIX1403: "Change the passed value or update the param type on the child component_def.",
    EUIX1501: "Add error=\"errorState\" on the api_endpoint or watch api.<tag>.error to reset loading.",
    EUIX1701: "Add <api_endpoint id=\"...\" tag=\"...\"> matching the watcher path api.<tag>.status.",
    EUIX1702: "Use an existing api_endpoint tag/id or define the endpoint before calling REVALIDATE_API.",
    EUIX1901: "Define <action_def name=\"...\"> for the tool action or point action at a built-in engine handler.",
    EUIX2001: "Add <outlet /> where routed page components should render.",
    EUIX2002: "Add a matching <route path=\"...\"> or fix the link to path.",
    "STATE-READONLY": "Initialize with a default value or add SET_STATE / API bind_target that writes this state.",
    "COMPUTED-UNUSED": "Bind the computed in markup ({data.name}) or remove it if dead code.",
    "API-UNUSED": "Set bind_target/select on the endpoint or consume the response in an action.",
};

export function ruleHint(rule: string): string | undefined {
    return RULE_HINTS[rule];
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
