export type Confidence = "confirmed" | "inferred" | "unresolved";

export interface SourceLocation {
    file: string;
    start: number;
    end: number;
    line: number;
    column: number;
}

export interface EuixFile {
    path: string;
    kind: "xml" | "html" | "js" | "ts" | "jsx" | "tsx" | "mjs" | "cjs";
    bytes: number;
    lines: number;
    source: string;
}

export interface ComponentInfo {
    id: string;
    name: string;
    file: string;
    location: SourceLocation;
    props: string[];
    slots: SlotInfo[];
    stateIds: string[];
    computedIds: string[];
    watcherIds: string[];
    actionIds: string[];
    eventIds: string[];
    childComponentNames: string[];
    /** Resolved child component ids (populated by composition linking). */
    childComponentIds: string[];
    dependencies: string[];
}

export type ComponentReferenceKind = "component-tag" | "custom-tag" | "import-tag" | "route" | "nav-item";

export interface ComponentReference {
    id: string;
    parentComponentId: string;
    parentComponentName: string;
    kind: ComponentReferenceKind;
    refName: string | null;
    srcPath: string | null;
    resolvedComponentId: string | null;
    resolvedComponentName: string | null;
    resolvedFile: string | null;
    propsPassed: string[];
    propValues: Record<string, string>;
    missingRequiredProps: string[];
    propTypeMismatches: PropTypeMismatch[];
    file: string;
    location: SourceLocation;
}

export interface PropTypeMismatch {
    prop: string;
    expected: string;
    inferred: string;
}

export interface StateInfo {
    id: string;
    name: string;
    file: string;
    componentId: string;
    componentName: string;
    initialValue: string | null;
    type: string | null;
    location: SourceLocation;
    readers: string[];
    writers: string[];
    watcherDependents: string[];
    computedDependents: string[];
    bindingConsumers: string[];
}

export interface ComputedInfo {
    id: string;
    name: string;
    file: string;
    componentId: string;
    componentName: string;
    expression: string;
    dependencies: string[];
    /** Set when `<computed deps="...">` is explicit (not inferred from expression). */
    explicitDeps: string[] | null;
    dependents: string[];
    location: SourceLocation;
}

export interface WatchInfo {
    id: string;
    name: string;
    path: string;
    action: string | null;
    body: string;
    file: string;
    componentId: string;
    componentName: string;
    reads: string[];
    writes: string[];
    triggers: string[];
    location: SourceLocation;
}

export interface ActionInfo {
    id: string;
    name: string;
    file: string;
    componentId: string;
    componentName: string;
    body: string;
    parameters: string[];
    reads: string[];
    writes: string[];
    calls: string[];
    branches: number;
    loops: number;
    awaits: number;
    returns: boolean;
    throws: boolean;
    apiCallIds: string[];
    storageEffects: string[];
    runtimeEffectIds: string[];
    location: SourceLocation;
}

export interface EventInfo {
    id: string;
    name: string;
    eventType: string;
    file: string;
    componentId: string;
    componentName: string;
    target: string;
    handler: string;
    handlerKind: "action" | "expression" | "unknown";
    /** State names written by declarative SET_STATE / RUN_SCRIPT handlers. */
    stateWrites: string[];
    /** Target api_endpoint tag/id for REVALIDATE_API handlers. */
    revalidateTag: string | null;
    location: SourceLocation;
}

export interface BindingInfo {
    id: string;
    kind: "text" | "attribute" | "prop";
    expression: string;
    sourceId: string;
    target: string;
    file: string;
    componentId: string;
    componentName: string;
    dependencies: string[];
    location: SourceLocation;
}

export interface PropInfo {
    id: string;
    name: string;
    file: string;
    componentId: string;
    componentName: string;
    required: boolean;
    type: string | null;
    enumValues: string[] | null;
    defaultValue: string | null;
    consumers: string[];
    passedFrom: string[];
}

export interface SlotInfo {
    id: string;
    name: string;
    file: string;
    componentId: string;
    componentName: string;
    used: boolean;
}

export interface RouteInfo {
    id: string;
    path: string;
    componentName: string | null;
    file: string;
    navigations: string[];
    location: SourceLocation;
}

export interface WebMcpToolInfo {
    id: string;
    name: string;
    action: string | null;
    file: string;
    componentId: string;
    componentName: string;
    location: SourceLocation;
}

export interface ApiCallInfo {
    id: string;
    method: string;
    url: string;
    urlConfidence: Confidence;
    file: string;
    actionId: string;
    actionName: string;
    componentName: string;
    responseConsumed: boolean;
    errorHandled: boolean;
    statesWritten: string[];
    location: SourceLocation;
}

export interface StorageEffect {
    id: string;
    kind: "localStorage" | "sessionStorage" | "unknown";
    operation: "read" | "write" | "remove";
    key: string | null;
    confidence: Confidence;
    file: string;
    actionId: string | null;
    location: SourceLocation;
}

export interface RuntimeEffect {
    id: string;
    kind:
        | "setTimeout"
        | "setInterval"
        | "setImmediate"
        | "queueMicrotask"
        | "WebSocket"
        | "EventSource"
        | "Worker"
        | "fetch"
        | "global"
        | "other";
    detail: string;
    confidence: Confidence;
    file: string;
    actionId: string | null;
    location: SourceLocation;
}

export interface DependencyEdge {
    from: string;
    to: string;
    kind:
        | "read"
        | "write"
        | "depends"
        | "triggers"
        | "binds"
        | "calls"
        | "navigates"
        | "composes"
        | "api"
        | "event";
    confidence: Confidence;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface TextEdit {
    start: number;
    end: number;
    replacement: string;
}

export interface DiagnosticFix {
    rule: string;
    description: string;
    edits: TextEdit[];
}

export interface Diagnostic {
    id: string;
    rule: string;
    severity: DiagnosticSeverity;
    message: string;
    /** Actionable fix suggestion shown below the message in CLI output. */
    hint?: string;
    /** Auto-fix edits when the rule supports deterministic repair. */
    fix?: DiagnosticFix;
    file: string;
    line: number;
    column: number;
    confidence: Confidence;
    relatedIds?: string[];
}

export interface FileFix {
    file: string;
    rule: string;
    description: string;
    start: number;
    end: number;
    replacement: string;
}

export interface ApplyFixesResult {
    filesChanged: number;
    fixesApplied: number;
    fixes: FileFix[];
}

export interface BehaviorPath {
    id: string;
    name: string;
    nodes: string[];
    edges: string[];
    componentName: string;
    source: "generated" | "discovered";
}

export interface TestScenario {
    id: string;
    name: string;
    componentName: string;
    pathId: string;
    kind: "smoke" | "flow" | "api" | "fuzz";
    steps: ScenarioStep[];
    seed?: number;
}

export interface ScenarioStep {
    kind: "init" | "event" | "action" | "api" | "assert" | "wait";
    target?: string;
    payload?: Record<string, unknown>;
    expected?: Record<string, unknown>;
}

export interface TestResult {
    scenarioId: string;
    name: string;
    passed: boolean;
    message?: string;
    durationMs: number;
    generated: boolean;
}

export interface BehaviorCoverage {
    pathsDiscovered: number;
    pathsExecuted: number;
    pathsPassed: number;
    pathsFailed: number;
    pathsUnresolved: number;
    percentage: number;
    heuristic: true;
}

export interface GraphNode {
    id: string;
    label: string;
    type: string;
}

export interface GraphEdge {
    from: string;
    to: string;
    label?: string;
}

export interface BehaviorGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface ComplexityMetrics {
    targetId: string;
    targetKind: "file" | "component" | "action";
    lines: number;
    bytes: number;
    states: number;
    computed: number;
    watchers: number;
    actions: number;
    branches: number;
    loops: number;
    awaits: number;
    externalEffects: number;
    dependencyDepth: number;
    behaviorPaths: number;
    risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface MemoryReport {
    peakDeltaBytes: number;
    postGcDeltaBytes: number | null;
    classification: string;
    highPressurePaths: number;
    retentionCandidates: number;
}

export interface HealthScore {
    score: number;
    contributors: { label: string; impact: number }[];
}

export interface DoctorResult {
    project: EuixProject;
    behaviorGraph: BehaviorGraph;
    behaviorPaths: BehaviorPath[];
    scenarios: TestScenario[];
    testResults: TestResult[];
    coverage: BehaviorCoverage;
    complexity: ComplexityMetrics[];
    health: HealthScore;
    memory: MemoryReport | null;
    durationMs: number;
}

export type EuixPluginId =
    | "core"
    | "composer"
    | "api"
    | "router"
    | "stream"
    | "date"
    | "validation"
    | "chart"
    | "map"
    | "navigator"
    | "animation"
    | "resilience"
    | "a11y"
    | "storage"
    | "webmcp"
    | "inspector";

export interface EuixProject {
    root: string;
    files: EuixFile[];
    activePlugins?: EuixPluginId[];
    components: Map<string, ComponentInfo>;
    states: Map<string, StateInfo>;
    computed: Map<string, ComputedInfo>;
    actions: Map<string, ActionInfo>;
    watchers: Map<string, WatchInfo>;
    props: Map<string, PropInfo>;
    slots: Map<string, SlotInfo>;
    events: Map<string, EventInfo>;
    bindings: Map<string, BindingInfo>;
    routes: Map<string, RouteInfo>;
    webMcpTools: Map<string, WebMcpToolInfo>;
    apiCalls: Map<string, ApiCallInfo>;
    componentRefs: Map<string, ComponentReference>;
    storageEffects: StorageEffect[];
    runtimeEffects: RuntimeEffect[];
    dependencies: DependencyEdge[];
    diagnostics: Diagnostic[];
}

export interface DoctorOptions {
    root: string;
    target?: string;
    json?: boolean;
    sarif?: boolean;
    test?: boolean;
    flows?: boolean;
    graph?: boolean;
    memory?: boolean;
    fuzz?: boolean;
    inspect?: string;
    seed?: number;
    repeat?: number;
    /** Suppress diagnostics matching entries in this baseline file. */
    baseline?: string;
    /** Write current diagnostics to the baseline file (use with --baseline). */
    updateBaseline?: boolean;
    /** Apply auto-fixes for supported rules (true = all, string = single rule id). */
    fix?: boolean | string;
    /** Preview fixes without writing files (use with --fix). */
    dryRun?: boolean;
    /** Re-run analysis when files change. */
    watch?: boolean;
    /** Print baseline diff summary (requires --baseline). */
    baselineDiff?: boolean;
}
