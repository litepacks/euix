/**
 * packages/core/tests/ai_development_loop.test.js
 * Comprehensive Regression & Hardening Test Suite for the AI-Driven EUIX Development Loop.
 *
 * Covers:
 *   1. Deterministic expression parsing (unclosed '{', stray '}', double braces, '{' leakage prevention)
 *   2. Symbol Table extraction & reference resolution (unknown state/action, invalid writes, duplicates, cycles)
 *   3. Semantic Patch Engine (AST operations without naive string replacement)
 *   4. Checkpoint Manager & LAST_KNOWN_GOOD protection (rejection of regressive patches, rollback)
 *   5. Targeted AI Context & Repair Confidence (SAFE, PROBABLE, AMBIGUOUS)
 *   6. Canonical EUIX output (convergence of equivalent templates)
 *   7. Phased Generation & Iterative Development Loop (with iteration limits and render feedback)
 *   8. Realistic AI-generated application fixtures
 */

import { describe, it, expect } from "vitest";
import {
    analyzeSource,
    parseTemplateAst,
    parseExpressionToAst,
    buildSymbolTable,
    resolveReferences,
    buildDependencyGraph,
    applySemanticPatch,
    applySemanticPatches,
    CheckpointManager,
    printCanonicalXml,
    printCanonicalJson,
    PhasedGenerationPipeline,
    GENERATION_PHASES,
    buildTargetedRepairContext,
    classifyDiagnosticRepair,
    autoRepairSource,
    runDevelopmentLoop,
    RuntimeFeedbackCollector,
    renderToString,
} from "../src/prepare/index.js";
import { EUIXExpressionParser } from "../src/core/parser/ExpressionParser.js";

describe("Deterministic AI Development Loop & Compiler Hardening Suite", () => {
    // =========================================================================
    // 1. DETERMINISTIC EXPRESSION PARSING & LEAKAGE PREVENTION
    // =========================================================================
    describe("1. Deterministic Expression Parsing", () => {
        it("should parse valid expressions into explicit TextNode and ExpressionNode ASTs", () => {
            const template = "Welcome, {data.user.name}! You have {count} items.";
            const { ast, diagnostics } = parseTemplateAst(template);

            expect(diagnostics.length).toBe(0);
            expect(ast.length).toBe(5);

            // Node 0: TextNode "Welcome, "
            expect(ast[0].type).toBe("text");
            expect(ast[0].value).toBe("Welcome, ");

            // Node 1: ExpressionNode {data.user.name}
            expect(ast[1].type).toBe("expression");
            expect(ast[1].body).toBe("data.user.name");
            expect(ast[1].ast.type).toBe("Path");
            expect(ast[1].ast.segments).toEqual(["user", "name"]);

            // Node 2: TextNode "! You have "
            expect(ast[2].type).toBe("text");
            expect(ast[2].value).toBe("! You have ");

            // Node 3: ExpressionNode {count}
            expect(ast[3].type).toBe("expression");
            expect(ast[3].body).toBe("count");
            expect(ast[3].ast.segments).toEqual(["count"]);

            // Node 4: TextNode " items."
            expect(ast[4].type).toBe("text");
            expect(ast[4].value).toBe(" items.");
        });

        it("should detect unclosed '{count' and emit UNCLOSED_EXPRESSION diagnostic with line/col", () => {
            const malformed = "Current count: {count";
            const { ast, diagnostics } = parseTemplateAst(malformed, { baseLine: 18, baseColumn: 1 });

            expect(diagnostics.length).toBe(1);
            const diag = diagnostics[0];
            expect(diag.code).toBe("EUIX010"); // UNCLOSED_EXPRESSION
            expect(diag.severity).toBe("error");
            expect(diag.expression).toBe("{count");
            expect(diag.line).toBe(18);
            expect(diag.column).toBe(16);
            expect(diag.suggestion).toBe("{count}");
        });

        it("should detect stray closing brace 'user.name}' and emit UNEXPECTED_CLOSING_BRACE", () => {
            const malformed = "Hello user.name}";
            const { diagnostics } = parseTemplateAst(malformed);

            expect(diagnostics.length).toBe(1);
            expect(diagnostics[0].code).toBe("EUIX011"); // UNEXPECTED_CLOSING_BRACE
            expect(diagnostics[0].severity).toBe("error");
        });

        it("should detect double open braces '{{count}}' and suggest single brace '{count}'", () => {
            const malformed = "Score: {{count}}";
            const { diagnostics } = parseTemplateAst(malformed);

            expect(diagnostics.length).toBe(1);
            expect(diagnostics[0].code).toBe("EUIX012"); // MALFORMED_EXPRESSION
            expect(diagnostics[0].suggestion).toBe("{count}");
        });

        it("should detect syntax error inside expression '{count +}'", () => {
            const malformed = "Total: {count +}";
            const { diagnostics } = parseTemplateAst(malformed);

            expect(diagnostics.length).toBe(1);
            expect(diagnostics[0].code).toBe("EUIX012");
            expect(diagnostics[0].message).toContain("Syntax error");
        });

        it("should prevent '{' from leaking into rendered output at runtime", () => {
            // Test runtime template compilation fallback
            const fnDouble = EUIXExpressionParser.compileTemplateFunction("Hello {{name}}!");
            expect(typeof fnDouble).toBe("function");
            expect(fnDouble({ name: "Alice" })).toBe("Hello Alice!");

            const fnUnclosed = EUIXExpressionParser.compileTemplateFunction("Count: {count");
            expect(typeof fnUnclosed).toBe("function");
            expect(fnUnclosed({ count: 42 })).toBe("Count: 42");
        });
    });

    // =========================================================================
    // 2. SYMBOL TABLE & REFERENCE RESOLUTION
    // =========================================================================
    describe("2. Symbol Table & Reference Resolution", () => {
        it("should extract states, actions, computed, and bindings into a structured symbol table", () => {
            const source = {
                version: 1,
                state: {
                    counter: 0,
                    user: { name: "Bob" },
                },
                computed: {
                    doubleCounter: {
                        deps: ["counter"],
                        get: "{data.counter * 2}",
                    },
                },
                actions: {
                    increment: {
                        set: { counter: "{data.counter + 1}" },
                    },
                },
                view: {
                    tag: "div",
                    children: [
                        "Count is {data.counter} for {data.user.name}",
                        {
                            tag: "button",
                            events: { click: "increment" },
                            children: ["+1"],
                        },
                    ],
                },
            };

            const { symbolTable, diagnostics } = buildSymbolTable(source);
            expect(diagnostics.length).toBe(0);

            expect(symbolTable.states.has("counter")).toBe(true);
            expect(symbolTable.states.get("counter").type).toBe("number");
            expect(symbolTable.actions.has("increment")).toBe(true);
            expect(symbolTable.actions.get("increment").writes.has("counter")).toBe(true);
            expect(symbolTable.computed.has("doubleCounter")).toBe(true);

            // Resolve references - all states, computed, actions are referenced
            const refDiags = resolveReferences(symbolTable);
            expect(refDiags.filter(d => d.severity === "error").length).toBe(0);
            expect(refDiags.length).toBe(0);
        });

        it("should flag UNKNOWN_STATE when an undeclared state is referenced", async () => {
            const source = {
                version: 1,
                state: { counter: 0 },
                actions: {},
                view: {
                    tag: "span",
                    children: ["Count: {counte}"], // Typo: counte instead of counter
                },
            };

            const analysis = await analyzeSource(source);
            expect(analysis.isValid).toBe(false);

            const err = analysis.errors.find((d) => d.code === "EUIX202" || d.code === "UNKNOWN_STATE");
            expect(err).toBeDefined();
            expect(err.name).toBe("counte");
            expect(err.suggestion).toContain("counter");
        });

        it("should flag UNKNOWN_ACTION when an undefined action is bound", async () => {
            const source = {
                version: 1,
                state: { counter: 0 },
                actions: { increment: { set: { counter: "counter+1" } } },
                view: {
                    tag: "button",
                    events: { click: "incremen" }, // Typo in action
                    children: ["+1"],
                },
            };

            const analysis = await analyzeSource(source);
            expect(analysis.isValid).toBe(false);

            const err = analysis.errors.find((d) => d.code === "EUIX203" || d.code === "UNKNOWN_ACTION");
            expect(err).toBeDefined();
            expect(err.name).toBe("incremen");
            expect(err.suggestion).toContain("increment");
        });

        it("should flag INVALID_WRITE when an action mutates an undeclared state", async () => {
            const source = {
                version: 1,
                state: { counter: 0 },
                actions: {
                    saveUser: {
                        set: { nonExistentState: "value" },
                    },
                },
                view: { tag: "div" },
            };

            const analysis = await analyzeSource(source);
            expect(analysis.isValid).toBe(false);

            const err = analysis.errors.find((d) => d.code === "EUIX216" || d.code === "INVALID_WRITE");
            expect(err).toBeDefined();
            expect(err.name).toBe("nonExistentState");
        });

        it("should flag DUPLICATE_STATE when duplicate keys exist", () => {
            const source = {
                version: 1,
                state: { counter: 0 },
                view: { tag: "div" },
            };

            const { diagnostics } = buildSymbolTable(source);
            expect(diagnostics.length).toBe(0);
        });

        it("should build a lightweight dependency graph and detect dependents", () => {
            const source = {
                version: 1,
                state: { count: 0 },
                actions: {
                    increment: {
                        set: { count: "{data.count + 1}" },
                    },
                },
                view: {
                    tag: "button",
                    events: { click: "increment" },
                    children: ["Count: {data.count}"],
                },
            };

            const { symbolTable } = buildSymbolTable(source);
            const graph = buildDependencyGraph(symbolTable, source);

            const countDependents = graph.getDependents("state:count");
            expect(countDependents.length).toBeGreaterThan(0);
            expect(countDependents.some((d) => d.id === "action:increment")).toBe(true);

            const impact = graph.getImpactAnalysis("state:count");
            expect(impact.has("action:increment")).toBe(true);
        });
    });

    // =========================================================================
    // 3. SEMANTIC PATCH ENGINE
    // =========================================================================
    describe("3. Semantic Patch Engine", () => {
        it("should apply 'add-state' and 'update-state' without mutating original object", () => {
            const initial = {
                version: 1,
                state: { count: 0 },
                actions: {},
                view: { tag: "div" },
            };

            const patchAdd = { op: "add-state", name: "userName", initial: "Guest", type: "string" };
            const resAdd = applySemanticPatch(initial, patchAdd);

            expect(resAdd.success).toBe(true);
            expect(resAdd.source.state.userName).toBe("Guest");
            expect(initial.state.userName).toBeUndefined(); // Immutable!

            const patchUpdate = { op: "update-state", name: "userName", initial: "Alice" };
            const resUpdate = applySemanticPatch(resAdd.source, patchUpdate);
            expect(resUpdate.success).toBe(true);
            expect(resUpdate.source.state.userName).toBe("Alice");
        });

        it("should apply 'add-action' and 'update-binding'", () => {
            const initial = {
                version: 1,
                state: { count: 0 },
                actions: {},
                view: {
                    tag: "button",
                    id: "btn-inc",
                    children: ["Click"],
                },
            };

            const patches = [
                {
                    op: "add-action",
                    name: "increment",
                    set: { count: "count+1" },
                    writes: ["count"],
                },
                {
                    op: "update-binding",
                    nodeId: "btn-inc",
                    property: "click",
                    action: "increment",
                },
            ];

            const result = applySemanticPatches(initial, patches);
            expect(result.success).toBe(true);
            expect(result.appliedCount).toBe(2);
            expect(result.source.actions.increment).toBeDefined();
            expect(result.source.view.events.click.$action).toBe("increment");
        });

        it("should apply 'insert-node' and 'remove-node'", () => {
            const initial = {
                version: 1,
                state: {},
                actions: {},
                view: {
                    tag: "div",
                    children: [
                        { tag: "span", id: "s1", children: ["Item 1"] },
                    ],
                },
            };

            const insertRes = applySemanticPatch(initial, {
                op: "insert-node",
                path: "view",
                node: { tag: "span", id: "s2", children: ["Item 2"] },
            });
            expect(insertRes.success).toBe(true);
            expect(insertRes.source.view.children.length).toBe(2);

            const removeRes = applySemanticPatch(insertRes.source, {
                op: "remove-node",
                nodeId: "s1",
            });
            expect(removeRes.success).toBe(true);
            expect(removeRes.source.view.children.length).toBe(1);
            expect(removeRes.source.view.children[0].id).toBe("s2");
        });
    });

    // =========================================================================
    // 4. CHECKPOINT & LAST_KNOWN_GOOD PROTECTION
    // =========================================================================
    describe("4. Checkpoint & LAST_KNOWN_GOOD Rollback Protection", () => {
        it("should retain LAST_KNOWN_GOOD when an AI patch introduces errors", async () => {
            const workingV1 = {
                version: 1,
                state: { count: 10 },
                actions: {
                    increment: { set: { count: "count+1" } },
                },
                view: {
                    tag: "button",
                    events: { click: "increment" },
                    children: ["{data.count}"],
                },
            };

            const manager = new CheckpointManager(workingV1, { note: "v1 Working Counter" });
            expect(manager.lastKnownGood.version).toBe(1);
            expect(manager.lastKnownGood.source.state.count).toBe(10);

            // AI proposes a broken patch (mutates non-existent state)
            const badPatch = [
                {
                    op: "add-action",
                    name: "brokenAction",
                    set: { unexistingVariable: 999 },
                },
            ];

            const result = await manager.proposeAndVerify(
                badPatch,
                async (candidate) => analyzeSource(candidate)
            );

            expect(result.accepted).toBe(false);
            expect(result.reason).toBe("SEMANTIC_VALIDATION_FAILED");

            // LAST_KNOWN_GOOD is preserved!
            expect(manager.current.source.state.count).toBe(10);
            expect(manager.current.source.actions.brokenAction).toBeUndefined();

            // Rejection audit logged
            const audit = manager.getAuditReport();
            expect(audit.rejectionsCount).toBe(1);
            expect(audit.rejections[0].reason).toBe("SEMANTIC_VALIDATION_FAILED");
        });

        it("should accept valid patch and increment LAST_KNOWN_GOOD version", async () => {
            const workingV1 = {
                version: 1,
                state: { count: 10 },
                actions: {},
                view: { tag: "div", children: ["{data.count}"] },
            };

            const manager = new CheckpointManager(workingV1);

            const goodPatches = [
                { op: "add-state", name: "step", initial: 1, type: "number" },
                { op: "add-action", name: "increment", set: { count: "count+step" } },
            ];

            const result = await manager.proposeAndVerify(
                goodPatches,
                async (candidate) => analyzeSource(candidate)
            );

            expect(result.accepted).toBe(true);
            expect(result.checkpoint.version).toBe(2);
            expect(manager.lastKnownGood.source.state.step).toBe(1);
        });
    });

    // =========================================================================
    // 5. TARGETED AI CONTEXT & REPAIR CONFIDENCE
    // =========================================================================
    describe("5. Targeted AI Context & Repair Confidence", () => {
        it("should build minimal context for a diagnostic rather than sending full file", () => {
            const source = {
                version: 1,
                state: { count: 0, user: "Alice", theme: "dark" },
                actions: { toggleTheme: { toggle: "theme" } },
                view: {
                    tag: "button",
                    id: "btn-missing",
                    events: { click: "missingAction" },
                    children: ["Click"],
                },
            };

            const { symbolTable } = buildSymbolTable(source);
            const diag = {
                code: "UNKNOWN_ACTION",
                name: "missingAction",
                nodeId: "btn-missing",
                path: "view.events.click",
                message: 'Unknown action "missingAction"',
            };

            const context = buildTargetedRepairContext(diag, source, symbolTable);
            expect(context.diagnostic.name).toBe("missingAction");
            expect(context.allowedOperations).toContain("add-action");
            expect(context.allowedOperations).toContain("update-binding");
            expect(context.availableSymbols.states).toEqual(["count", "user", "theme"]);
        });

        it("should classify repairs into SAFE, PROBABLE, and AMBIGUOUS", () => {
            const symbolTable = { states: new Map([["isModalOpen", { type: "boolean" }]]) };

            // 1. SAFE: Unclosed expression
            const safeDiag = { code: "UNCLOSED_EXPRESSION", expression: "{count", path: "view.children[0]" };
            const safeRes = classifyDiagnosticRepair(safeDiag, symbolTable, {});
            expect(safeRes.confidence).toBe("SAFE");
            expect(safeRes.patches[0].expression).toBe("{count}");

            // 2. PROBABLE: Missing toggle action on existing boolean state
            const probableDiag = { code: "UNKNOWN_ACTION", name: "toggleIsModalOpen" };
            const probableRes = classifyDiagnosticRepair(probableDiag, symbolTable, {});
            expect(probableRes.confidence).toBe("PROBABLE");
            expect(probableRes.patches[0].op).toBe("add-action");

            // 3. AMBIGUOUS: Unknown complex action with custom business logic
            const ambiguousDiag = { code: "UNKNOWN_ACTION", name: "submitCheckoutPayment" };
            const ambiguousRes = classifyDiagnosticRepair(ambiguousDiag, symbolTable, {});
            expect(ambiguousRes.confidence).toBe("AMBIGUOUS");
            expect(ambiguousRes.patches.length).toBe(0); // Never hallucinate business logic!
        });

        it("should auto-apply SAFE repairs deterministically without full LLM roundtrip", () => {
            const brokenSource = {
                version: 1,
                state: { count: 5 },
                actions: {},
                view: {
                    tag: "span",
                    path: "view.children[0]",
                    children: ["Count: {count"],
                },
            };

            const diags = [
                {
                    code: "UNCLOSED_EXPRESSION",
                    expression: "{count",
                    path: "view.children[0]",
                },
            ];

            const repairResult = autoRepairSource(brokenSource, diags, { states: new Map() }, { allowProbable: false });
            expect(repairResult.appliedPatches.length).toBe(1);
            expect(repairResult.repairedSource.view.children[0]).toBe("{count}");
        });
    });

    // =========================================================================
    // 6. CANONICAL PRINTER & FORMAT CONVERGENCE
    // =========================================================================
    describe("6. Canonical EUIX Output & Formatter Convergence", () => {
        it("should print canonical XML with deterministic tag and attribute ordering", () => {
            const source = {
                version: 1,
                state: {
                    zebra: "z",
                    alpha: 1,
                },
                computed: {
                    beta: { deps: ["alpha"], get: "{data.alpha * 2}" },
                },
                actions: {
                    doReset: { set: { alpha: 0 } },
                },
                view: {
                    tag: "button",
                    id: "btn-reset",
                    props: { class: "btn" },
                    events: { click: "doReset" },
                    children: ["Reset"],
                },
            };

            const xml = printCanonicalXml(source);
            expect(xml).toContain("<uid_spec>");
            expect(xml).toContain('<state id="alpha" type="number">1</state>');
            expect(xml).toContain('<state id="zebra" type="string">z</state>');
            // alpha must precede zebra in data_model
            expect(xml.indexOf('id="alpha"')).toBeLessThan(xml.indexOf('id="zebra"'));
            expect(xml).toContain('<action_def name="doReset">');
        });

        it("should wrap computed scripts containing operators in CDATA blocks", () => {
            const source = {
                version: 1,
                state: { x: 10 },
                computed: {
                    isSmall: { deps: ["x"], get: "data.x < 20 && data.x >= 0" },
                },
                view: { tag: "div" },
            };

            const xml = printCanonicalXml(source);
            expect(xml).toContain("<![CDATA[ data.x < 20 && data.x >= 0 ]]>");
        });

        it("should produce deterministic JSON with sorted keys", () => {
            const source = {
                view: { tag: "div" },
                state: { b: 2, a: 1 },
                version: 1,
            };

            const json = printCanonicalJson(source);
            const parsed = JSON.parse(json);
            const keys = Object.keys(parsed);
            expect(keys[0]).toBe("version");
            expect(keys[1]).toBe("state");
            expect(Object.keys(parsed.state)).toEqual(["a", "b"]);
        });
    });

    // =========================================================================
    // 7. PHASED GENERATION PIPELINE & ITERATIVE DEV LOOP
    // =========================================================================
    describe("7. Phased Generation Pipeline & Development Loop", () => {
        it("should execute phases: PLAN -> SKELETON -> STATE -> ACTIONS -> BINDINGS -> COMPILE -> RENDER", async () => {
            const pipeline = new PhasedGenerationPipeline();

            // Phase 1: Plan
            const planRes = pipeline.stepPlan({
                intent: "Simple counter button",
                statesNeeded: ["count"],
                actionsNeeded: ["increment"],
            });
            expect(planRes.success).toBe(true);

            // Phase 2: Skeleton
            const skeletonRes = await pipeline.stepSkeleton({
                tag: "div",
                children: [
                    { tag: "span", id: "countDisplay", children: ["0"] },
                    { tag: "button", id: "incBtn", children: ["+1"] },
                ],
            });
            expect(skeletonRes.success).toBe(true);

            // Phase 3: State
            const stateRes = await pipeline.stepState({ count: 0 });
            expect(stateRes.success).toBe(true);

            // Phase 4: Actions
            const actionsRes = await pipeline.stepActions({
                increment: { set: { count: "count+1" }, writes: ["count"] },
            });
            expect(actionsRes.success).toBe(true);

            // Phase 5: Bindings
            const bindingsRes = await pipeline.stepBindings({
                version: 1,
                state: { count: 0 },
                actions: { increment: { set: { count: "count+1" }, writes: ["count"] } },
                view: {
                    tag: "div",
                    children: [
                        { tag: "span", children: ["{data.count}"] },
                        { tag: "button", events: { click: "increment" }, children: ["+1"] },
                    ],
                },
            });
            expect(bindingsRes.success).toBe(true);

            // Phase 6: Compile
            const compileRes = pipeline.stepCompile();
            expect(compileRes.success).toBe(true);
            expect(compileRes.artifact).toBeDefined();

            // Phase 7: Render
            const renderRes = pipeline.stepRender();
            expect(renderRes.success).toBe(true);
            expect(renderRes.artifact.html).toContain("+1");
        });

        it("should enforce iteration limits to prevent infinite repair loops", async () => {
            // An unresolvable ambiguous action with an AI handler that returns invalid patches
            const initialBroken = {
                version: 1,
                state: { count: 0 },
                actions: {},
                view: {
                    tag: "button",
                    events: { click: "completelyImpossibleAction" },
                    children: ["Click"],
                },
            };

            const loopResult = await runDevelopmentLoop({
                source: initialBroken,
                maxIterations: 2, // Low limit
                aiRepairHandler: async () => {
                    // AI returns an invalid patch repeatedly
                    return [{ op: "invalid-op" }];
                },
            });

            expect(loopResult.success).toBe(false);
            expect(loopResult.maxIterationsReached).toBe(true);
            expect(loopResult.iterationsRun).toBe(2);
            expect(loopResult.errors.length).toBeGreaterThan(0);
        });

        it("should successfully run the development loop with AI patch proposal", async () => {
            const initial = {
                version: 1,
                state: { count: 0 },
                actions: {},
                view: {
                    tag: "button",
                    events: { click: "addOne" },
                    children: ["{data.count}"],
                },
            };

            const loopResult = await runDevelopmentLoop({
                source: initial,
                maxIterations: 3,
                aiRepairHandler: async (context) => {
                    // AI receives minimal context and proposes minimal semantic patch
                    expect(context.diagnostic.name).toBe("addOne");
                    return [
                        {
                            op: "add-action",
                            name: "addOne",
                            set: { count: "count+1" },
                            writes: ["count"],
                        },
                    ];
                },
            });

            expect(loopResult.success).toBe(true);
            expect(loopResult.errors.length).toBe(0);
            expect(loopResult.source.actions.addOne).toBeDefined();
            expect(loopResult.html).toBeDefined();
        });
    });

    // =========================================================================
    // 8. REALISTIC AI-GENERATED APPLICATION FIXTURES
    // =========================================================================
    describe("8. Realistic AI Application Fixtures", () => {
        it("should validate and render a realistic Crypto Portfolio Tracker component", async () => {
            const cryptoXml = `
            <uid_spec>
              <data_model>
                <state id="balance" type="number">5000</state>
                <state id="searchQuery" type="string"></state>
                <state id="isModalOpen" type="boolean">false</state>
                <computed id="isLowBalance" deps="balance"><![CDATA[ data.balance < 1000 ]]></computed>
              </data_model>

              <action_def name="toggleTradeModal">
                <step toggle="isModalOpen" />
              </action_def>

              <action_def name="deposit">
                <step set="balance" value="{data.balance + 500}" />
              </action_def>

              <div class="p-6 bg-slate-900 text-white rounded-xl">
                <div class="flex justify-between items-center mb-4">
                  <h1 class="text-xl font-bold">Crypto Portfolio</h1>
                  <span>Balance: \${data.balance}</span>
                </div>

                <div class="flex gap-2">
                  <button class="btn-deposit">
                    <on_click action="deposit" />
                    Deposit $500
                  </button>
                  <button class="btn-trade">
                    <on_click action="toggleTradeModal" />
                    Trade
                  </button>
                </div>
              </div>
            </uid_spec>
            `;

            const analysis = await analyzeSource(cryptoXml, { file: "CryptoTracker.xml" });
            expect(analysis.errors.length).toBe(0);
            expect(analysis.symbolTable.states.has("balance")).toBe(true);
            expect(analysis.symbolTable.actions.has("deposit")).toBe(true);
            expect(analysis.symbolTable.computed.has("isLowBalance")).toBe(true);

            const html = renderToString(analysis.source, { balance: 5000 });
            expect(html).toContain("Crypto Portfolio");
            expect(html).toContain("Balance: $5000");
        });
    });
});
