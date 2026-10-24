/**
 * Rules metadata catalog for EUIX Doctor.
 * Provides in-depth explanations, severity levels, categories, runtime risk analyses,
 * and concrete actionable remediation guides.
 */

export interface RuleMetadata {
    rule: string;
    title: string;
    category:
        | "script"
        | "state"
        | "identity"
        | "reactivity"
        | "action"
        | "composition"
        | "api"
        | "router"
        | "webmcp"
        | "performance"
        | "a11y"
        | "general";
    summary: string;
    risk: string;
    solution: string;
    hint: string;
    autoFixable?: boolean;
}

export const RULE_CATALOG: Record<string, RuleMetadata> = {
    EUIX0001: {
        rule: "EUIX0001",
        title: "Unsafe Inline JavaScript in XML",
        category: "script",
        summary: "Inline JavaScript in <computed>, <step>, or RUN_SCRIPT contains unescaped XML characters or entities.",
        risk: "Operators like '<', '<=', '&&' break the XML specification parser or cause syntax errors during AST generation.",
        solution: "Wrap inline JavaScript in a <![CDATA[ ... ]]> block instead of escaping operators as XML entities (&lt;, &amp;).",
        hint: "Wrap inline JavaScript in <![CDATA[ ... ]]> inside <computed>, <step>, or RUN_SCRIPT — do not escape JS operators as XML entities.",
        autoFixable: true,
    },
    EUIX1001: {
        rule: "EUIX1001",
        title: "Write to Unknown State",
        category: "state",
        summary: "An action or event handler writes to a state path that does not exist in <data_model>.",
        risk: "The state write will be silently ignored or fail at runtime, leaving the UI state out of sync.",
        solution: "Define <state id=\"...\"> in the component's <data_model> or correct the target path in your SET_STATE / shorthand action.",
        hint: "Define <state id=\"...\"> in the component data_model or fix the action write target.",
    },
    EUIX1002: {
        rule: "EUIX1002",
        title: "Unused State Variable",
        category: "state",
        summary: "A state variable is declared in <data_model> but is never read, written, bound, or watched.",
        risk: "Unused state increases memory overhead and clutters component definitions.",
        solution: "Bind the state in markup ({data.name}), use it in actions/watchers, or remove the unused <state> tag.",
        hint: "Wire the state into bindings, props, computed deps, watchers, or actions — or remove it.",
    },
    EUIX1101: {
        rule: "EUIX1101",
        title: "Computed Dependency Cycle",
        category: "reactivity",
        summary: "Two or more computed values form a circular dependency loop (e.g., A → B → A).",
        risk: "Causes a call stack overflow or infinite reactive re-evaluation loop at runtime.",
        solution: "Break the cycle by removing one of the dependent references or inlining the calculation.",
        hint: "Break the cycle by removing a computed dependency or inlining one of the computed values.",
    },
    EUIX1102: {
        rule: "EUIX1102",
        title: "Missing Computed Dependency Reference",
        category: "reactivity",
        summary: "A computed block specifies a dependency in its deps attribute that does not exist.",
        risk: "The computed value may never re-calculate when inputs change or fail on evaluation.",
        solution: "Add the missing <state> / <computed> or fix the deps attribute on <computed>.",
        hint: "Add the missing state/computed or fix the deps attribute on the computed block.",
        autoFixable: true,
    },
    EUIX1103: {
        rule: "EUIX1103",
        title: "Invalid Computed Dependencies Attribute",
        category: "reactivity",
        summary: "The deps attribute on <computed> contains invalid or unresolvable identifier names.",
        risk: "Reactive dependency tracking cannot be established correctly.",
        solution: "Specify valid state or computed ids in deps=\"id1, id2\".",
        hint: "Fix the deps attribute on <computed> — use existing state/computed ids from this component.",
    },
    EUIX1110: {
        rule: "EUIX1110",
        title: "Unknown Variable Reference in Template",
        category: "reactivity",
        summary: "A template expression or script references an undeclared variable path ({data.unknown}).",
        risk: "Evaluates to undefined at runtime and may cause binding errors or blank views.",
        solution: "Define <state id=\"...\"> or <computed id=\"...\"> in this component, or fix the variable name.",
        hint: "Define <state id=\"...\"> or <computed id=\"...\"> in this component, or fix the template/script reference.",
        autoFixable: true,
    },
    EUIX1120: {
        rule: "EUIX1120",
        title: "Duplicate Identifier in Component",
        category: "identity",
        summary: "Multiple states, computed variables, or actions share the same id in the same component.",
        risk: "Name collisions cause unpredictable state overwrites or broken action dispatching.",
        solution: "Rename the conflicting state, computed, or action so that every identifier is unique within the component.",
        hint: "Rename or remove the duplicate state/computed/action id in the same component.",
    },
    EUIX1201: {
        rule: "EUIX1201",
        title: "Self-Triggering Watcher Loop",
        category: "reactivity",
        summary: "A <watch> observes a state path and its action writes back to the same state path.",
        risk: "Triggers an immediate infinite reactive loop that crashes or freezes the browser.",
        solution: "Avoid writing to the watched state directly inside its watcher. Use a separate derived state or guard flag.",
        hint: "Avoid writing the same state the watcher observes; use a derived flag or separate buffer state.",
    },
    "WATCH-CYCLE": {
        rule: "WATCH-CYCLE",
        title: "Watcher Chain Cycle",
        category: "reactivity",
        summary: "A chain of multiple watchers trigger each other in a loop (e.g. Watch A writes B, Watch B writes A).",
        risk: "Reactive cascade loop leading to stack overflow and frozen UI.",
        solution: "Consolidate state transitions into a single composed workflow or eliminate reciprocal writes.",
        hint: "Break the watcher chain cycle by separating source of truth from reactive effects.",
    },
    EUIX1301: {
        rule: "EUIX1301",
        title: "Missing Action Handler",
        category: "action",
        summary: "An event (<on_click>) or watcher references an action name that is not registered or defined.",
        risk: "User interactions or reactive events will silently fail to execute their intended logic.",
        solution: "Define <action_def name=\"...\"> in the component, register the action in JS, or use a built-in action.",
        hint: "Add <action_def name=\"...\">, import a shared actions module, or use a built-in engine action.",
    },
    EUIX1302: {
        rule: "EUIX1302",
        title: "Missing Required EUIX Plugin",
        category: "action",
        summary: "An action or markup pattern requires a modular EUIX plugin that is not registered.",
        risk: "The feature (API calls, storage, modal dialogs, animations) will not function.",
        solution: "Register the required plugin (e.g. .use(EUIXApiPlugin) or add <api_config> markup).",
        hint: "Add the plugin markup (e.g. <api_config>) or import the plugin JS module for this action.",
    },
    EUIX1401: {
        rule: "EUIX1401",
        title: "Unresolved Component",
        category: "composition",
        summary: "A child component tag or <component src=\"...\"> could not be resolved.",
        risk: "The component will fail to render, leaving an empty spot in the UI layout.",
        solution: "Create <component_def name=\"...\">, add a valid src path, or check for typos in the tag name.",
        hint: "Create <component_def name=\"...\">, add src=\"./File.xml\", or use a built-in HTML/EUIX tag.",
    },
    EUIX1402: {
        rule: "EUIX1402",
        title: "Missing Required Component Prop",
        category: "composition",
        summary: "A child component declares a required prop (<param required=\"true\">) that was not passed by the parent.",
        risk: "Child component logic expecting this parameter may crash or behave unpredictably.",
        solution: "Pass the required prop on the component tag: <Child propName=\"{data.value}\" />.",
        hint: "Pass the required prop on the component tag: <Child propName=\"{data.value}\" />.",
    },
    EUIX1403: {
        rule: "EUIX1403",
        title: "Prop Type or Enum Mismatch",
        category: "composition",
        summary: "The type or enum value passed to a child prop does not match the child component's <param> specification.",
        risk: "Causes runtime validation errors or unexpected data coercion.",
        solution: "Update the passed value to match the expected type/enum or adjust the child's <param type=\"...\"> definition.",
        hint: "Change the passed value or update the param type on the child component_def.",
    },
    EUIX1404: {
        rule: "EUIX1404",
        title: "Component Source File Not Found",
        category: "composition",
        summary: "The file specified in <component src=\"...\"> does not exist at the target relative path.",
        risk: "Async component loader will fail with HTTP 404 or file not found error.",
        solution: "Create the referenced XML/HTML file or fix the relative path in the src attribute.",
        hint: "Create the referenced XML/HTML file or fix the src path on the component tag.",
    },
    EUIX1501: {
        rule: "EUIX1501",
        title: "Unhandled API Error / Loading Risk",
        category: "api",
        summary: "An API endpoint has a loading state bound but lacks an error handler or error state binding.",
        risk: "If the network request fails, the loading state may remain stuck on true forever, blocking user interaction.",
        solution: "Add error=\"errorState\" on <api_endpoint> or watch api.<tag>.error to reset loading state.",
        hint: "Add error=\"errorState\" on the api_endpoint or watch api.<tag>.error to reset loading.",
    },
    EUIX1701: {
        rule: "EUIX1701",
        title: "Unknown API Tag in Watcher",
        category: "api",
        summary: "A <watch> path references api.<tag>.status or api.<tag>.data, but no <api_endpoint> with that tag exists.",
        risk: "The watcher will never fire because the reactive API status path does not exist.",
        solution: "Add <api_endpoint id=\"...\" tag=\"...\"> matching the watcher path or fix the watcher tag name.",
        hint: "Add <api_endpoint id=\"...\" tag=\"...\"> matching the watcher path api.<tag>.status.",
        autoFixable: true,
    },
    EUIX1702: {
        rule: "EUIX1702",
        title: "Unknown Endpoint in REVALIDATE_API",
        category: "api",
        summary: "A REVALIDATE_API action references an endpoint tag or id that has not been defined in <api_config>.",
        risk: "The revalidation call will fail silently or log an unhandled endpoint warning.",
        solution: "Check the tag attribute on your <api_endpoint> or update the action tag attribute to match.",
        hint: "Use an existing api_endpoint tag/id or define the endpoint before calling REVALIDATE_API.",
    },
    EUIX1703: {
        rule: "EUIX1703",
        title: "Duplicate API Endpoint Tag",
        category: "api",
        summary: "Multiple <api_endpoint> elements share the same tag or id.",
        risk: "Revalidation and reactive API bindings will clash, targeting the wrong endpoint.",
        solution: "Assign a unique tag and id to each <api_endpoint>.",
        hint: "Use a unique tag/id for each api_endpoint — watcher paths depend on api.<tag>.*.",
    },
    EUIX1901: {
        rule: "EUIX1901",
        title: "Invalid WebMCP Tool Definition",
        category: "webmcp",
        summary: "A WebMCP tool is missing its action handler or references an undefined action.",
        risk: "AI agents calling this MCP tool will receive an unhandled action execution error.",
        solution: "Define <action_def name=\"...\"> for the tool or point action at a valid engine handler.",
        hint: "Define <action_def name=\"...\"> for the tool action or point action at a built-in engine handler.",
    },
    EUIX2001: {
        rule: "EUIX2001",
        title: "Missing Router Outlet",
        category: "router",
        summary: "Routes or router links are declared, but no <outlet /> element exists in the layout.",
        risk: "Page navigation will update URL history but cannot render any routed component view.",
        solution: "Add an <outlet /> tag where page components should be mounted.",
        hint: "Add <outlet /> where routed page components should render.",
    },
    EUIX2002: {
        rule: "EUIX2002",
        title: "Unmatched Router Link",
        category: "router",
        summary: "A router link (e.g. to=\"/dashboard\") does not match any declared <route path=\"...\">.",
        risk: "Clicking the link results in a 404 / blank router outlet.",
        solution: "Add a matching <route path=\"...\"> in your router configuration or fix the link destination.",
        hint: "Add a matching <route path=\"...\"> or fix the link to path.",
    },
    "STATE-READONLY": {
        rule: "STATE-READONLY",
        title: "Uninitialized Read-Only State",
        category: "state",
        summary: "A state is read in templates or computed expressions but has no initial value and is never written.",
        risk: "State will remain undefined/empty forever, possibly rendering empty or broken UI widgets.",
        solution: "Initialize with a default value (<state id=\"...\" type=\"...\">value</state>) or add a SET_STATE action.",
        hint: "Initialize with a default value or add SET_STATE / API bind_target that writes this state.",
    },
    "COMPUTED-UNUSED": {
        rule: "COMPUTED-UNUSED",
        title: "Unused Computed Value",
        category: "reactivity",
        summary: "A computed block is defined and recalculated on changes, but its result is never displayed or used.",
        risk: "Consumes CPU cycles on state changes without contributing to the UI.",
        solution: "Bind the computed value in markup ({data.name}) or remove the dead computation.",
        hint: "Bind the computed in markup ({data.name}) or remove it if dead code.",
    },
    "API-UNUSED": {
        rule: "API-UNUSED",
        title: "Unused API Response",
        category: "api",
        summary: "An API endpoint is fetched but defines no bind_target, select, or consumer action.",
        risk: "Network bandwidth is consumed but the received data is discarded immediately.",
        solution: "Add bind_target=\"dataKey\" on <api_endpoint> to store the fetched data in state.",
        hint: "Set bind_target/select on the endpoint or consume the response in an action.",
    },
    EUIX0101: {
        rule: "EUIX0101",
        title: "Unresolved Island Component Source",
        category: "composition",
        summary: "An HTML island declares a data-euix source that does not exist.",
        risk: "The declarative island loader will fail to mount, displaying an error or blank element.",
        solution: "Ensure the referenced template (<template id=\"...\">) or XML file exists at the specified path.",
        hint: "Fix data-euix path or define the referenced <template id=\"...\"> element.",
    },
    EUIX0102: {
        rule: "EUIX0102",
        title: "Invalid Island JSON Attribute",
        category: "general",
        summary: "The data-props or data-state attribute on an island element contains malformed JSON.",
        risk: "Parsing will fail at runtime, preventing props or state initialization.",
        solution: "Provide valid JSON (e.g. data-props='{\"count\": 10}').",
        hint: "Ensure data-props and data-state contain valid JSON strings.",
    },
    EUIX0103: {
        rule: "EUIX0103",
        title: "Missing Required Island Prop",
        category: "composition",
        summary: "An island mounts a component that requires a prop not supplied via data-prop-* or data-props.",
        risk: "The component may fail or render incomplete data.",
        solution: "Add data-prop-<name>=\"...\" or pass the prop in data-props.",
        hint: "Provide the required prop via data-prop-<name> on the island element.",
    },
    EUIX1310: {
        rule: "EUIX1310",
        title: "Invalid Toggle Target State",
        category: "action",
        summary: "An on_*:toggle action targets a state that is not a boolean.",
        risk: "Toggling a non-boolean (string/number) creates unpredictable truthy/falsy mutations.",
        solution: "Specify type=\"boolean\" on the target state or use SET_STATE with an explicit value.",
        hint: "Change the state type to 'boolean' or use on_click:set instead of toggle.",
    },
    EUIX1311: {
        rule: "EUIX1311",
        title: "Arithmetic on String State in Shorthand",
        category: "action",
        summary: "An on_*:set action performs math arithmetic on a state with string type.",
        risk: "String concatenation results in '011' instead of numeric addition (2).",
        solution: "Declare type=\"number\" on the state in <data_model>.",
        hint: "Add type='number' to the state definition to ensure numeric addition.",
    },
    EUIX3001: {
        rule: "EUIX3001",
        title: "Missing Key on Loop Container",
        category: "performance",
        summary: "<for_each> is missing a 'key' attribute for keyed reconciliation.",
        risk: "Array mutations trigger full container DOM re-renders instead of minimal keyed node reuse.",
        solution: "Add key=\"id\" (or another unique property) to the <for_each> container.",
        hint: "Add key=\"id\" to <for_each items=\"...\"> to enable 60 FPS keyed reconciliation.",
        autoFixable: true,
    },
    EUIX3002: {
        rule: "EUIX3002",
        title: "Un-debounced Watcher on Rapid Input",
        category: "performance",
        summary: "A watcher observes an input-bound state and triggers API requests on every keystroke without debounce.",
        risk: "Floods the network with requests, degrades typing responsiveness, and risks rate limiting.",
        solution: "Add debounce=\"300\" or throttle=\"300\" to the <watch> tag.",
        hint: "Add debounce=\"300\" to the <watch> tag on input-bound state.",
    },
    EUIX3003: {
        rule: "EUIX3003",
        title: "Large Embedded State in Template",
        category: "performance",
        summary: "A <state> tag contains a large embedded static data payload (>2000 characters).",
        risk: "Bloats template size and increases initial parse latency.",
        solution: "Move large datasets to external JSON files via <state src=\"...\"> or <api_endpoint>.",
        hint: "Load large datasets via <state src=\"...\"> or <api_endpoint> instead of inlining.",
    },
    EUIX4001: {
        rule: "EUIX4001",
        title: "Button Missing Accessible Label",
        category: "a11y",
        summary: "A <button> has no text content, aria-label, aria-labelledby, or title.",
        risk: "Screen readers and assistive technologies announce an unlabeled button.",
        solution: "Add aria-label=\"...\" or textual label inside the button.",
        hint: "Add aria-label or visible text to <button>.",
    },
    EUIX4002: {
        rule: "EUIX4002",
        title: "Non-Interactive Element Click Handler",
        category: "a11y",
        summary: "A non-interactive element (div, span) has an on_click handler without role or tabindex.",
        risk: "Keyboard users and screen reader users cannot focus or activate the element.",
        solution: "Use a <button> instead, or add role=\"button\" tabindex=\"0\".",
        hint: "Prefer <button> or add role=\"button\" and tabindex=\"0\".",
    },
    EUIX4003: {
        rule: "EUIX4003",
        title: "Form Input Missing Accessible Name",
        category: "a11y",
        summary: "An <input> element lacks an accessible name (label, aria-label, or title).",
        risk: "Assistive technologies cannot announce the purpose of the input field.",
        solution: "Add a matching <label for=\"...\">, aria-label=\"...\", or placeholder.",
        hint: "Associate with a <label> or add aria-label to <input>.",
    },
};

export function getRuleMetadata(rule: string): RuleMetadata | undefined {
    return RULE_CATALOG[rule];
}

export function getRuleCategory(rule: string): string {
    return RULE_CATALOG[rule]?.category ?? "general";
}

export function getRuleExplanation(rule: string): string | undefined {
    const meta = RULE_CATALOG[rule];
    if (!meta) return undefined;
    return `${meta.summary} Risk: ${meta.risk} Solution: ${meta.solution}`;
}
