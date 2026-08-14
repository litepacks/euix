import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore, EUIXStructuredError } from "../src/core/EUIXEngineCore.js";
import {
    EUIXResiliencePlugin,
    EUIXCancellationController,
    calculateBackoffDelay,
    handleDelayDirect
} from "../src/plugins/EUIXResiliencePlugin.js";
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

        it("should support backoff calculation (exponential, exp, linear, jitter, max_delay)", () => {
            expect(calculateBackoffDelay("fixed", 0, 1)).toBe(0);
            expect(calculateBackoffDelay("fixed", -50, 1)).toBe(0);
            expect(calculateBackoffDelay("fixed", 100, 1)).toBe(100);
            expect(calculateBackoffDelay("fixed", 100, 3)).toBe(100);
            expect(calculateBackoffDelay("linear", 100, 3)).toBe(300);
            expect(calculateBackoffDelay("exponential", 100, 1)).toBe(100);
            expect(calculateBackoffDelay("exponential", 100, 2)).toBe(200);
            expect(calculateBackoffDelay("exp", 100, 3)).toBe(400);
            expect(calculateBackoffDelay("exponential", 100, 5, 500)).toBe(500);

            const jitterVal = calculateBackoffDelay("jitter", 100, 2);
            expect(jitterVal).toBeGreaterThanOrEqual(50);
            expect(jitterVal).toBeLessThanOrEqual(300);
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

    describe("5. Comprehensive Edge Cases, Validation Guards & Unit API Tests", () => {
        it("should test EUIXCancellationController lifecycle, idempotency, listener cleanup & throwIfCancelled", () => {
            const controller = new EUIXCancellationController();
            const signal = controller.signal;

            expect(signal.isCancelled).toBe(false);
            expect(signal.reason).toBeNull();
            expect(signal.abortSignal).not.toBeNull();
            expect(() => signal.throwIfCancelled()).not.toThrow();

            const listenerSpy = vi.fn();
            const unsubscribe = signal.onCancel(listenerSpy);
            expect(typeof unsubscribe).toBe("function");

            // Non-function listener callback should return no-op function
            const invalidUnsub = signal.onCancel(null);
            expect(typeof invalidUnsub).toBe("function");

            const customReason = new EUIXStructuredError({ message: "Custom cancel", code: "CUSTOM_CANCEL" });
            controller.cancel(customReason);

            expect(signal.isCancelled).toBe(true);
            expect(signal.reason).toBe(customReason);
            expect(listenerSpy).toHaveBeenCalledWith(customReason);
            expect(() => signal.throwIfCancelled()).toThrow("Custom cancel");

            // Registering listener on already-cancelled controller invokes callback immediately
            const lateSpy = vi.fn();
            signal.onCancel(lateSpy);
            expect(lateSpy).toHaveBeenCalledWith(customReason);

            // Idempotency: second cancel call is no-op
            controller.cancel(new Error("Another cancel"));
            expect(signal.reason).toBe(customReason);
        });

        it("should test EUIXCancellationController pre-cancelled parent signal initialization", () => {
            const parent = new EUIXCancellationController();
            parent.cancel(new Error("Parent pre-cancelled"));

            const child = new EUIXCancellationController(parent.signal);
            expect(child.isCancelled).toBe(true);
            expect(child.reason.message).toBe("Parent pre-cancelled");
        });

        it("should validate handleDelayDirect inputs and cancellation behavior", async () => {
            expect(() => handleDelayDirect(null, "-50")).toThrow(EUIXStructuredError);
            expect(() => handleDelayDirect(null, "invalid-num")).toThrow(EUIXStructuredError);

            const cancelledController = new EUIXCancellationController();
            cancelledController.cancel(new Error("Already cancelled delay"));
            expect(() => handleDelayDirect(null, 100, { _cancellationSignal: cancelledController.signal })).toThrow("Already cancelled delay");

            const activeController = new EUIXCancellationController();
            const delayPromise = handleDelayDirect(null, 200, { _cancellationSignal: activeController.signal });

            setTimeout(() => activeController.cancel(new Error("Cancelled mid-delay")), 20);

            await expect(delayPromise).rejects.toThrow("Cancelled mid-delay");
        });

        it("should log DevTools error scope events during handleDelayDirect execution", async () => {
            const logSpy = vi.fn();
            const fakeEngine = { _devtools: { logErrorScope: logSpy } };

            await handleDelayDirect(fakeEngine, 10);

            expect(logSpy).toHaveBeenCalledWith("DELAY_START", expect.objectContaining({ durationMs: 10 }));
            expect(logSpy).toHaveBeenCalledWith("DELAY_COMPLETED", expect.objectContaining({ durationMs: 10 }));
        });

        it("should support WAIT and SLEEP action tag aliases and child element duration specification", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="step_wait">false</state>
                        <state id="step_sleep">false</state>
                    </data_model>
                    <container>
                        <button id="btn-wait">
                            <on_click>
                                <wait delay="20" />
                                <step action="SET_STATE">
                                    <path>data.step_wait</path>
                                    <value>true</value>
                                </step>
                            </on_click>
                        </button>
                        <button id="btn-sleep">
                            <on_click>
                                <sleep>
                                    <ms>20</ms>
                                </sleep>
                                <step action="SET_STATE">
                                    <path>data.step_sleep</path>
                                    <value>true</value>
                                </step>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            
            container.querySelector("#btn-wait").click();
            await new Promise(r => setTimeout(r, 40));
            expect(engine.getState("step_wait")).toBe("true");

            container.querySelector("#btn-sleep").click();
            await new Promise(r => setTimeout(r, 40));
            expect(engine.getState("step_sleep")).toBe("true");
        });

        it("should validate TIMEOUT duration and support custom message attributes and child nodes", async () => {
            const xmlInvalid = `
                <uid_spec>
                    <container>
                        <button id="btn-invalid">
                            <on_click action="TRY">
                                <timeout ms="-10">
                                    <step action="SET_STATE"><path>data.x</path><value>1</value></step>
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.code</path><value>{err.code}</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineInvalid = EUIXEngineCore.mount(xmlInvalid, container);
            container.querySelector("#btn-invalid").click();
            await new Promise(r => setTimeout(r, 20));
            expect(engineInvalid.getState("code")).toBe("VALIDATION_ERROR");

            const xmlCustomMsg = `
                <uid_spec>
                    <container>
                        <button id="btn-msg">
                            <on_click action="TRY">
                                <timeout ms="20" message="Operation custom timeout expired">
                                    <delay ms="100" />
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.msg</path><value>{err.message}</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineMsg = EUIXEngineCore.mount(xmlCustomMsg, container);
            container.querySelector("#btn-msg").click();
            await new Promise(r => setTimeout(r, 50));
            expect(engineMsg.getState("msg")).toBe("Operation custom timeout expired");
        });

        it("should validate RETRY attributes (attempts, delay, backoff, max_delay) strictly", async () => {
            const testValidation = async (retryTag) => {
                const xml = `
                    <uid_spec>
                        <container>
                            <button class="btn">
                                <on_click action="TRY">
                                    ${retryTag}
                                        <step action="SET_STATE"><path>data.x</path><value>1</value></step>
                                    </retry>
                                    <catch var="err">
                                        <step action="SET_STATE"><path>data.err_code</path><value>{err.code}</value></step>
                                    </catch>
                                </on_click>
                            </button>
                        </container>
                    </uid_spec>
                `;
                const engine = EUIXEngineCore.mount(xml, container);
                container.querySelector("button").click();
                await new Promise(r => setTimeout(r, 20));
                return engine.getState("err_code");
            };

            expect(await testValidation('<retry attempts="0">')).toBe("VALIDATION_ERROR");
            expect(await testValidation('<retry attempts="2" delay="-5">')).toBe("VALIDATION_ERROR");
            expect(await testValidation('<retry attempts="2" backoff="unknown_strategy">')).toBe("VALIDATION_ERROR");
            expect(await testValidation('<retry attempts="2" delay="100" max_delay="50">')).toBe("VALIDATION_ERROR");
        });

        it("should filter retry errors via on_error attribute matching code, status, or message", async () => {
            const xmlCodeMatch = `
                <uid_spec>
                    <data_model>
                        <state id="status">initial</state>
                        <state id="attempts">0</state>
                        <state id="caught">none</state>
                    </data_model>
                    <container>
                        <button id="btn-match">
                            <on_click action="TRY">
                                <retry attempts="3" delay="5" on_error="CUSTOM_CODE_ERR">
                                    <step action="RUN_SCRIPT">
                                        if (!$retry || $retry.attempt === 1) {
                                            throw new $engine.constructor.EUIXStructuredError({ message: "Fail 1", code: "CUSTOM_CODE_ERR" });
                                        }
                                    </step>
                                    <step action="SET_STATE">
                                        <path>data.status</path>
                                        <value>recovered</value>
                                    </step>
                                </retry>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.caught</path><value>{err.code}</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineMatch = EUIXEngineCore.mount(xmlCodeMatch, container);
            container.querySelector("#btn-match").click();
            await new Promise(r => setTimeout(r, 120));
            expect(engineMatch.getState("status")).toBe("recovered");

            const xmlMismatch = `
                <uid_spec>
                    <data_model>
                        <state id="status">initial</state>
                        <state id="attempts">0</state>
                        <state id="caught">none</state>
                    </data_model>
                    <container>
                        <button id="btn-mismatch">
                            <on_click action="TRY">
                                <retry attempts="3" delay="5" on_error="MATCH_ONLY_THIS_CODE">
                                    <step action="RUN_SCRIPT">
                                        throw new $engine.constructor.EUIXStructuredError({ message: "Unmatched failure", code: "OTHER_ERROR" });
                                    </step>
                                </retry>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.caught</path><value>{err.code}</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineMismatch = EUIXEngineCore.mount(xmlMismatch, container);
            container.querySelector("#btn-mismatch").click();
            await new Promise(r => setTimeout(r, 120));
            expect(engineMismatch.getState("caught")).toBe("OTHER_ERROR");
        });
    });

    describe("6. DevTools Inspector Logging & Scope Trace Interception", () => {
        it("should log RETRY_ATTEMPT and RETRY_EXHAUSTED to DevTools logErrorScope spy", async () => {
            const xml = `
                <uid_spec>
                    <container>
                        <button id="btn-retry-log">
                            <on_click action="TRY">
                                <retry attempts="2" delay="0">
                                    <step action="RUN_SCRIPT">
                                        throw new $engine.constructor.EUIXStructuredError({ message: "Flaky Error", code: "FLAKY_ERR" });
                                    </step>
                                </retry>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.caught</path><value>true</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const logSpy = vi.fn();
            engine._devtools = { logErrorScope: logSpy, logAction: vi.fn(), enabled: true };

            const onClickNode = engine.xmlDoc.querySelector("#btn-retry-log on_click") || engine.xmlDoc.querySelector("on_click");
            await engine.handleAction(onClickNode);

            expect(logSpy).toHaveBeenCalledWith("RETRY_START", expect.objectContaining({ maxAttempts: 2 }));
            expect(logSpy).toHaveBeenCalledWith("RETRY_ATTEMPT_FAILED", expect.objectContaining({ attempt: 1 }));
            expect(logSpy).toHaveBeenCalledWith("RETRY_EXHAUSTED", expect.objectContaining({ attempt: 2 }));
        });

        it("should log TIMEOUT_EXCEEDED to DevTools logErrorScope spy", async () => {
            const xml = `
                <uid_spec>
                    <container>
                        <button id="btn-timeout-log">
                            <on_click action="TRY">
                                <timeout ms="15">
                                    <delay ms="100" />
                                </timeout>
                                <catch var="err">
                                    <step action="SET_STATE"><path>data.caught</path><value>true</value></step>
                                </catch>
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const logSpy = vi.fn();
            engine._devtools = { logErrorScope: logSpy, logAction: vi.fn(), enabled: true };

            const node = engine.xmlDoc.querySelector("#btn-timeout-log on_click") || engine.xmlDoc.querySelector("on_click");
            await engine.handleAction(node);

            expect(logSpy).toHaveBeenCalledWith("TIMEOUT_EXCEEDED", expect.objectContaining({ timeoutMs: 15 }));
        });

        it("should log DELAY_START, DELAY_COMPLETED, and DELAY_CANCELLED to DevTools logErrorScope spy", async () => {
            const xmlNormal = `
                <uid_spec>
                    <container>
                        <button id="btn-delay-normal">
                            <on_click action="DELAY" ms="10" />
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineNormal = EUIXEngineCore.mount(xmlNormal, container);
            const logSpyNormal = vi.fn();
            engineNormal._devtools = { logErrorScope: logSpyNormal, logAction: vi.fn(), enabled: true };

            const nodeNormal = engineNormal.xmlDoc.querySelector("#btn-delay-normal on_click") || engineNormal.xmlDoc.querySelector("on_click");
            await engineNormal.handleAction(nodeNormal);

            expect(logSpyNormal).toHaveBeenCalledWith("DELAY_START", expect.objectContaining({ durationMs: 10 }));
            expect(logSpyNormal).toHaveBeenCalledWith("DELAY_COMPLETED", expect.objectContaining({ durationMs: 10 }));

            const xmlCancelled = `
                <uid_spec>
                    <container>
                        <button id="btn-delay-cancel">
                            <on_click action="TRY">
                                <timeout ms="10">
                                    <delay ms="100" />
                                </timeout>
                                <catch var="err" />
                            </on_click>
                        </button>
                    </container>
                </uid_spec>
            `;

            const engineCancel = EUIXEngineCore.mount(xmlCancelled, container);
            const logSpyCancel = vi.fn();
            engineCancel._devtools = { logErrorScope: logSpyCancel, logAction: vi.fn(), enabled: true };

            const nodeCancel = engineCancel.xmlDoc.querySelector("#btn-delay-cancel on_click") || engineCancel.xmlDoc.querySelector("on_click");
            await engineCancel.handleAction(nodeCancel);

            expect(logSpyCancel).toHaveBeenCalledWith("DELAY_CANCELLED", expect.anything());
        });
    });

    describe("7. Plugin Metadata, Installation & Deep Mutant Elimination", () => {
        it("should expose correct plugin metadata and install method", () => {
            expect(EUIXResiliencePlugin.name).toBe("EUIXResiliencePlugin");
            expect(typeof EUIXResiliencePlugin.install).toBe("function");

            const registeredActions = new Map();
            const mockEngineClass = {
                registerAction(name, handler) {
                    registeredActions.set(name, handler);
                }
            };

            EUIXResiliencePlugin.install(mockEngineClass);

            expect(mockEngineClass.EUIXCancellationController).toBeDefined();
            expect(window.EUIXCancellationController).toBeDefined();
            expect(registeredActions.has("DELAY")).toBe(true);
            expect(registeredActions.has("WAIT")).toBe(true);
            expect(registeredActions.has("SLEEP")).toBe(true);
            expect(registeredActions.has("TIMEOUT")).toBe(true);
            expect(registeredActions.has("RETRY")).toBe(true);
        });

        it("should execute handleDelayDirect and resolve true upon completion", async () => {
            const mockEngine = {
                _devtools: null
            };
            const resultPromise = handleDelayDirect(mockEngine, 10, {});
            await expect(resultPromise).resolves.toBe(true);
        });

        it("should execute handleDelayDirect with cancellation signal and reject with reason", async () => {
            const controller = new EUIXCancellationController();
            const mockEngine = {
                _devtools: null
            };
            const context = {
                _cancellationSignal: controller.signal
            };

            const delayPromise = handleDelayDirect(mockEngine, 200, context);
            const cancelErr = new EUIXStructuredError({ message: "Manual Cancel", code: "ACTION_CANCELLED" });
            controller.cancel(cancelErr);

            await expect(delayPromise).rejects.toBe(cancelErr);
        });

        it("should handle handleDelayDirect with default cancellation error when no reason provided", async () => {
            const controller = new EUIXCancellationController();
            const mockEngine = {
                _devtools: null
            };
            const context = {
                _cancellationSignal: controller.signal
            };

            const delayPromise = handleDelayDirect(mockEngine, 200, context);
            controller.cancel();

            await expect(delayPromise).rejects.toThrow("Action execution was cancelled");
        });
    });
});


