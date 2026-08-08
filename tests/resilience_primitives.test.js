import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore, EUIXStructuredError } from "../src/core/EUIXEngineCore.js";
import { EUIXResiliencePlugin, EUIXCancellationController } from "../src/plugins/EUIXResiliencePlugin.js";
import { EUIXComposerPlugin } from "../src/plugins/EUIXComposerPlugin.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";

EUIXEngineCore.use(EUIXResiliencePlugin);
EUIXEngineCore.use(EUIXComposerPlugin);
EUIXEngineCore.use(EUIXApiPlugin);

describe("EUIX Engine - Resilience Primitives (Retry, Timeout, Delay) Test Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    describe("1. Delay Primitive", () => {
        it("should execute normal delay inside action sequence", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="step1">false</state>
                        <state id="step2">false</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click>
                                <step action="SET_STATE">
                                    <path>data.step1</path>
                                    <value>true</value>
                                </step>
                                <delay ms="50" />
                                <step action="SET_STATE">
                                    <path>data.step2</path>
                                    <value>true</value>
                                </step>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            expect(engine.getState("step1")).toBe("true");
            expect(engine.getState("step2")).toBe("false");

            await new Promise(r => setTimeout(r, 70));

            expect(engine.getState("step2")).toBe("true");
        });

        it("should validate and reject negative delay duration", async () => {
            const xml = `
                <uid_spec>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <delay ms="-100" />
                                <catch var="err">
                                    <step action="SET_STATE">
                                        <path>data.err_code</path>
                                        <value>{err.code}</value>
                                    </step>
                                </catch>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 20));

            expect(engine.getState("err_code")).toBe("VALIDATION_ERROR");
        });
    });

    describe("2. Timeout Primitive", () => {
        it("should execute successful action before timeout expires", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">pending</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click>
                                <timeout ms="500">
                                    <step action="SET_STATE">
                                        <path>data.status</path>
                                        <value>completed</value>
                                    </step>
                                </timeout>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 20));

            expect(engine.getState("status")).toBe("completed");
        });

        it("should fail predictably when execution exceeds timeout limit", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="err_code"></state>
                        <state id="err_msg"></state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <timeout ms="30">
                                    <delay ms="100" />
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE">
                                        <path>data.err_code</path>
                                        <value>{err.code}</value>
                                    </step>
                                    <step action="SET_STATE">
                                        <path>data.err_msg</path>
                                        <value>{err.message}</value>
                                    </step>
                                </catch>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 60));

            expect(engine.getState("err_code")).toBe("TIMEOUT_ERROR");
            expect(engine.getState("err_msg")).toContain("timed out");
        });

        it("should prevent late state mutation after scope cancellation", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="late_state">initial</state>
                        <state id="status">start</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <timeout ms="30">
                                    <delay ms="80" />
                                    <step action="SET_STATE">
                                        <path>data.late_state</path>
                                        <value>polluted</value>
                                    </step>
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE">
                                        <path>data.status</path>
                                        <value>caught_timeout</value>
                                    </step>
                                </catch>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 120));

            expect(engine.getState("status")).toBe("caught_timeout");
            expect(engine.getState("late_state")).toBe("initial");
        });
    });

    describe("3. Retry Primitive", () => {
        it("should succeed on first attempt without retrying", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="count">0</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click>
                                <retry attempts="3">
                                    <step action="SET_STATE">
                                        <path>data.count</path>
                                        <value>10</value>
                                    </step>
                                </retry>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 20));

            expect(engine.getState("count")).toBe("10");
        });

        it("should retry failed attempt and succeed on subsequent attempt", async () => {
            let attemptCounter = 0;
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">pending</state>
                        <state id="attempt_val">0</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click>
                                <retry attempts="3" delay="10">
                                    <step action="RUN_SCRIPT">
                                        $data.attempt_val = $retry.attempt;
                                        if ($retry.attempt &lt; 2) {
                                            throw new Error("Temporary failure");
                                        }
                                        $data.status = "recovered";
                                    </step>
                                </retry>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 50));

            expect(engine.getState("status")).toBe("recovered");
            expect(engine.getState("attempt_val")).toBe(2);
        });

        it("should exhaust all attempts and propagate final error", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="err_msg"></state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <retry attempts="3" delay="5">
                                    <step action="RUN_SCRIPT">
                                        throw new Error("Persistent error");
                                    </step>
                                </retry>
                                <catch var="err">
                                    <step action="SET_STATE">
                                        <path>data.err_msg</path>
                                        <value>{err.message}</value>
                                    </step>
                                </catch>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 60));

            expect(engine.getState("err_msg")).toBe("Persistent error");
        });

        it("should support backoff calculation (exponential, linear, jitter)", () => {
            const { calculateBackoffDelay } = require("../src/plugins/EUIXResiliencePlugin.js");
            expect(calculateBackoffDelay("fixed", 100, 1)).toBe(100);
            expect(calculateBackoffDelay("fixed", 100, 3)).toBe(100);
            expect(calculateBackoffDelay("linear", 100, 3)).toBe(300);
            expect(calculateBackoffDelay("exponential", 100, 1)).toBe(100);
            expect(calculateBackoffDelay("exponential", 100, 2)).toBe(200);
            expect(calculateBackoffDelay("exponential", 100, 3)).toBe(400);
            expect(calculateBackoffDelay("exponential", 100, 5, 500)).toBe(500);
        });
    });

    describe("4. Composition & Cancellation", () => {
        it("should cancel delay when enclosing timeout expires (Timeout containing Delay)", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="timeout_fired">false</state>
                        <state id="delay_finished">false</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <timeout ms="30">
                                    <delay ms="150" />
                                    <step action="SET_STATE">
                                        <path>data.delay_finished</path>
                                        <value>true</value>
                                    </step>
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE">
                                        <path>data.timeout_fired</path>
                                        <value>true</value>
                                    </step>
                                </catch>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 180));

            expect(engine.getState("timeout_fired")).toBe("true");
            expect(engine.getState("delay_finished")).toBe("false");
        });

        it("should retry each attempt within a fresh timeout window (Retry containing Timeout)", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">pending</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="TRY">
                                <retry attempts="2" delay="10">
                                    <timeout ms="20">
                                        <step action="RUN_SCRIPT">
                                            if ($retry.attempt === 1) {
                                                await new Promise(r => setTimeout(r, 50));
                                            } else {
                                                $data.status = "success_on_retry";
                                            }
                                        </step>
                                    </timeout>
                                </retry>
                            </on_click>
                            Start
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const button = container.querySelector("button");
            button.click();

            await new Promise(r => setTimeout(r, 100));

            expect(engine.getState("status")).toBe("success_on_retry");
        });

        it("should handle EUIXCancellationController parent-child propagation", () => {
            const parent = new EUIXCancellationController();
            const child = new EUIXCancellationController(parent.signal);

            expect(child.signal.isCancelled).toBe(false);

            parent.cancel(new EUIXStructuredError({ message: "Parent cancelled", code: "ACTION_CANCELLED" }));

            expect(child.signal.isCancelled).toBe(true);
            expect(child.signal.reason.message).toBe("Parent cancelled");
        });

        it("should maintain backward compatibility for actions without resilience tags", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="counter">0</state>
                    </data_model>
                    <container>
                        <button class="btn">
                            <on_click action="SET_STATE">
                                <path>data.counter</path>
                                <value>100</value>
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

            expect(engine.getState("counter")).toBe("100");
        });
    });
});
