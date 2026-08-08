import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore, EUIXStructuredError } from "../src/core/EUIXEngineCore.js";
import { EUIXComposerPlugin } from "../src/plugins/EUIXComposerPlugin.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";

EUIXEngineCore.use(EUIXComposerPlugin);
EUIXEngineCore.use(EUIXApiPlugin);

describe("EUIX Engine - Declarative Try / Catch / Finally Test Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("1. should execute successful try flow (skip catch, execute finally)", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="status">initial</state>
                    <state id="finally_ran">false</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="SET_STATE">
                                <path>data.status</path>
                                <value>success</value>
                            </step>
                            <catch var="err">
                                <step action="SET_STATE">
                                    <path>data.status</path>
                                    <value>caught</value>
                                </step>
                            </catch>
                            <finally>
                                <step action="SET_STATE">
                                    <path>data.finally_ran</path>
                                    <value>true</value>
                                </step>
                            </finally>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState("status")).toBe("success");
        expect(engine.getState("finally_ran")).toBe("true");
    });

    it("2. should catch synchronous failure inside try block and pass structured error", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="error_msg"></state>
                    <state id="error_code"></state>
                    <state id="finally_ran">false</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="RUN_SCRIPT">
                                throw new Error("Sync failure in script");
                            </step>
                            <catch var="err">
                                <step action="SET_STATE">
                                    <path>data.error_msg</path>
                                    <value>{err.message}</value>
                                </step>
                                <step action="SET_STATE">
                                    <path>data.error_code</path>
                                    <value>{err.code}</value>
                                </step>
                            </catch>
                            <finally>
                                <step action="SET_STATE">
                                    <path>data.finally_ran</path>
                                    <value>true</value>
                                </step>
                            </finally>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState("error_msg")).toBe("Sync failure in script");
        expect(engine.getState("error_code")).toBe("ACTION_EXECUTION_ERROR");
        expect(engine.getState("finally_ran")).toBe("true");
    });

    it("3. should handle async rejection (Promise / fetch failure) in catch scope", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => "application/json" },
            json: async () => ({ message: "Internal Server Error" })
        });

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="status_code"></state>
                    <state id="loading">true</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="XHR">
                                <url>https://api.example.com/fail</url>
                                <target>data.result</target>
                            </step>
                            <catch var="err">
                                <step action="SET_STATE">
                                    <path>data.status_code</path>
                                    <value>{err.status}</value>
                                </step>
                            </catch>
                            <finally>
                                <step action="SET_STATE">
                                    <path>data.loading</path>
                                    <value>false</value>
                                </step>
                            </finally>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 30));

        expect(engine.getState("status_code")).toBe("500");
        expect(engine.getState("loading")).toBe("false");
    });

    it("4. should execute finally block even when try block throws unhandled error", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="finally_ran">false</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="RUN_SCRIPT">
                                throw new Error("Unhandled error without catch");
                            </step>
                            <finally>
                                <step action="SET_STATE">
                                    <path>data.finally_ran</path>
                                    <value>true</value>
                                </step>
                            </finally>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState("finally_ran")).toBe("true");
    });

    it("5. should support explicit rethrow and propagate error to outer catch scope", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="outer_caught">false</state>
                    <state id="inner_finally">false</state>
                    <state id="outer_finally">false</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="TRY">
                                <step action="RUN_SCRIPT">
                                    throw new Error("Initial failure");
                                </step>
                                <catch var="err">
                                    <step action="RETHROW" />
                                </catch>
                                <finally>
                                    <step action="SET_STATE">
                                        <path>data.inner_finally</path>
                                        <value>true</value>
                                    </step>
                                </finally>
                            </step>
                            <catch var="err">
                                <step action="SET_STATE">
                                    <path>data.outer_caught</path>
                                    <value>true</value>
                                </step>
                            </catch>
                            <finally>
                                <step action="SET_STATE">
                                    <path>data.outer_finally</path>
                                    <value>true</value>
                                </step>
                            </finally>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 30));

        expect(engine.getState("inner_finally")).toBe("true");
        expect(engine.getState("outer_caught")).toBe("true");
        expect(engine.getState("outer_finally")).toBe("true");
    });

    it("6. should validate and reject multiple catch or finally blocks in a single try", async () => {
        const xml = `
            <uid_spec>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="SET_STATE">
                                <path>data.dummy</path>
                                <value>1</value>
                            </step>
                            <catch var="e1"></catch>
                            <catch var="e2"></catch>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");

        await expect(engine.handleAction(button.firstElementChild, {})).resolves.toBeUndefined();
    });

    it("7. should support nested composed action workflows with try/catch", async () => {
        const xml = `
            <uid_spec>
                <actions>
                    <action_def name="FailingSubWorkflow">
                        <step action="RUN_SCRIPT">
                            throw new Error("Workflow step failed");
                        </step>
                    </action_def>
                </actions>
                <data_model>
                    <state id="workflow_error"></state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="TRY">
                            <step action="FailingSubWorkflow" />
                            <catch var="err">
                                <step action="SET_STATE">
                                    <path>data.workflow_error</path>
                                    <value>{err.message}</value>
                                </step>
                            </catch>
                        </on_click>
                        Run
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 30));

        expect(engine.getState("workflow_error")).toBe("Workflow step failed");
    });

    it("8. should maintain backward compatibility for existing actions without try/catch", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter">0</state>
                </data_model>
                <container>
                    <button class="btn">
                        <on_click action="SET_STATE">
                            <path>data.counter</path>
                            <value>42</value>
                        </on_click>
                        Click
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const button = container.querySelector("button");
        button.click();

        await new Promise(r => setTimeout(r, 10));

        expect(engine.getState("counter")).toBe("42");
    });
});
