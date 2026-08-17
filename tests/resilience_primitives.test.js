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
                                <timeout ms="500" action="SET_STATE">
                                    <path>data.status</path>
                                    <value>completed</value>
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

            await new Promise(r => setTimeout(r, 100));

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

            expect(mockEngineClass.EUIXCancellationController).toBe(EUIXCancellationController);
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

        it("should directly execute TIMEOUT, RETRY, WAIT, and SLEEP handlers registered by EUIXResiliencePlugin", async () => {
            const handlers = new Map();
            const mockEngineClass = {
                registerAction(name, handler) {
                    handlers.set(name, handler);
                }
            };
            EUIXResiliencePlugin.install(mockEngineClass);

            const mockEngine = {
                interpolate: (str) => str,
                reportError: vi.fn(),
                _handleActionInternal: vi.fn().mockResolvedValue("ActionSuccess"),
                getChild: () => null
            };

            // 1. SLEEP & WAIT
            const sleepNode = {
                getAttribute: (k) => k === "ms" ? "5" : null,
                children: []
            };
            const sleepRes = await handlers.get("SLEEP").call(mockEngine, sleepNode, {});
            expect(sleepRes).toBe("ActionSuccess");

            const waitNode = {
                getAttribute: (k) => k === "ms" ? "5" : null,
                children: []
            };
            const waitRes = await handlers.get("WAIT").call(mockEngine, waitNode, {});
            expect(waitRes).toBe("ActionSuccess");

            // 2. TIMEOUT handler success
            const timeoutNode = {
                getAttribute: (k) => k === "ms" ? "50" : (k === "action" ? "MY_ACTION" : null),
                children: []
            };
            const timeoutRes = await handlers.get("TIMEOUT").call(mockEngine, timeoutNode, { _componentName: "TestComp" });
            expect(timeoutRes).toBe("ActionSuccess");

            // 3. TIMEOUT invalid duration validation error
            const invalidTimeoutNode = {
                getAttribute: (k) => k === "ms" ? "-10" : null,
                children: []
            };
            await expect(handlers.get("TIMEOUT").call(mockEngine, invalidTimeoutNode, { _componentName: "TestComp" }))
                .rejects.toThrow(EUIXStructuredError);

            // 4. RETRY handler multi-attempt context tracking
            let attemptCounter = 0;
            let capturedRetryContext = null;
            mockEngine._handleActionInternal = vi.fn().mockImplementation((childNode, ctx) => {
                attemptCounter++;
                capturedRetryContext = ctx.retry;
                if (attemptCounter === 1) {
                    throw new Error("FirstAttemptFailed");
                }
                return "SecondAttemptSuccess";
            });

            const retryNode = {
                getAttribute: (k) => k === "attempts" ? "2" : (k === "delay" ? "5" : null),
                children: [{ tagName: "step" }]
            };
            const retryRes = await handlers.get("RETRY").call(mockEngine, retryNode, { _componentName: "TestComp" });
            expect(retryRes).toBe("SecondAttemptSuccess");
            expect(capturedRetryContext.attempt).toBe(2);
            expect(capturedRetryContext.is_last).toBe(true);
            expect(capturedRetryContext.prev_error).toBeDefined();

            // 5. RETRY invalid attempts validation error
            const invalidRetryNode = {
                getAttribute: (k) => k === "attempts" ? "0" : null,
                children: []
            };
            await expect(handlers.get("RETRY").call(mockEngine, invalidRetryNode, { _componentName: "TestComp" }))
                .rejects.toThrow(EUIXStructuredError);

            // 6. RETRY error filter mismatch immediately re-throws error
            mockEngine._handleActionInternal = vi.fn().mockRejectedValue(new EUIXStructuredError({
                message: "Database Fail",
                code: "DB_ERROR"
            }));
            const filterMismatchNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "NETWORK_ERROR" : null),
                children: [{ tagName: "step" }]
            };
            await expect(handlers.get("RETRY").call(mockEngine, filterMismatchNode, { _componentName: "TestComp" }))
                .rejects.toThrow("Database Fail");

            // 7. calculateBackoffDelay modes
            expect(calculateBackoffDelay("fixed", 100, 1, 1000)).toBe(100);
            expect(calculateBackoffDelay("linear", 100, 3, 1000)).toBe(300);
            expect(calculateBackoffDelay("exponential", 100, 2, 1000)).toBe(200);
            expect(calculateBackoffDelay("exp", 100, 2, 1000)).toBe(200);
            expect(calculateBackoffDelay("exponential", 100, 10, 500)).toBe(500); // capped at maxDelay
            expect(calculateBackoffDelay("jitter", 100, 2, 1000)).toBeGreaterThanOrEqual(100);
            expect(calculateBackoffDelay("fixed", 0, 1)).toBe(0);
            expect(calculateBackoffDelay("fixed", -10, 1)).toBe(0);
            expect(calculateBackoffDelay(null, 100, 1)).toBe(100);
            expect(calculateBackoffDelay("fixed", 100, 1, -5)).toBe(100);
            expect(calculateBackoffDelay("fixed", 100, 1, "invalid")).toBe(100);
        });

        it("8. should thoroughly test EUIXCancellationController signal listeners and abort controller", () => {
            const ctrl = new EUIXCancellationController();
            
            // onCancel with non-function
            const noopUnsub = ctrl.signal.onCancel(null);
            expect(typeof noopUnsub).toBe("function");
            noopUnsub();

            // abortSignal getter
            expect(ctrl.signal.abortSignal).toBeDefined();

            // throwIfCancelled when not cancelled
            expect(() => ctrl.signal.throwIfCancelled()).not.toThrow();

            // Listener with throw error swallowed during cancel
            ctrl.signal.onCancel(() => {
                throw new Error("Swallowed listener error");
            });

            const normalSpy = vi.fn();
            const unsubNormal = ctrl.signal.onCancel(normalSpy);
            unsubNormal(); // test unsubscribe

            ctrl.cancel();
            expect(ctrl.signal.isCancelled).toBe(true);

            // cancel again is idempotent
            ctrl.cancel();

            // onCancel after already cancelled with throwing callback
            ctrl.signal.onCancel(() => {
                throw new Error("Swallowed post-cancel callback");
            });

            // throwIfCancelled throws cancelled error
            expect(() => ctrl.signal.throwIfCancelled()).toThrow("Action execution was cancelled");
        });

        it("9. should thoroughly test retry filters by status and message substring and backoff validation", async () => {
            const handlers = new Map();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: vi.fn() },
                _handleActionInternal: vi.fn()
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. Retry with invalid backoff
            const invalidBackoffNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "backoff" ? "unsupported_strategy" : null),
                children: []
            };
            await expect(handlers.get("RETRY").call(mockEngine, invalidBackoffNode, {}))
                .rejects.toThrow('invalid backoff strategy "unsupported_strategy"');

            // 2. Retry with delay < 0
            const negativeDelayNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "delay" ? "-50" : null),
                children: []
            };
            await expect(handlers.get("RETRY").call(mockEngine, negativeDelayNode, {}))
                .rejects.toThrow("<retry> delay must be a non-negative number");

            // 3. Retry with max_delay < base_delay
            const badMaxDelayNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "delay" ? "100" : (k === "max_delay" ? "50" : null)),
                children: []
            };
            await expect(handlers.get("RETRY").call(mockEngine, badMaxDelayNode, {}))
                .rejects.toThrow("<retry> max_delay must be a number greater than or equal to initial delay");

            // 4. Retry with error filter matching HTTP status 503
            const err503 = new EUIXStructuredError({ message: "Service Unavailable", status: 503 });
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(err503)
                .mockResolvedValueOnce("Recovered503");

            const statusFilterNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "503, 500" : (k === "delay" ? "1" : null)),
                children: [{ tagName: "step" }]
            };
            const res503 = await handlers.get("RETRY").call(mockEngine, statusFilterNode, {});
            expect(res503).toBe("Recovered503");

            // 5. Retry with error filter matching message substring
            const errMsgErr = new Error("Gateway timeout occurred");
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(errMsgErr)
                .mockResolvedValueOnce("RecoveredMsg");

            const msgFilterNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "GATEWAY, TIMEOUT" : (k === "delay" ? "1" : null)),
                children: [{ tagName: "step" }]
            };
            const resMsg = await handlers.get("RETRY").call(mockEngine, msgFilterNode, {});
            expect(resMsg).toBe("RecoveredMsg");
        });

        it("10. should test TIMEOUT with parent cancellation signal and duration validations", async () => {
            const handlers = new Map();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: vi.fn() },
                _handleActionInternal: vi.fn()
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. Duration <= 0
            const badDurationNode = {
                getAttribute: (k) => k === "ms" ? "0" : null,
                children: []
            };
            await expect(handlers.get("TIMEOUT").call(mockEngine, badDurationNode, {}))
                .rejects.toThrow("<timeout> duration must be a positive number");

            // 2. Pre-cancelled parent signal
            const parentCtrl = new EUIXCancellationController();
            parentCtrl.cancel(new Error("Pre-cancelled by parent"));

            const validTimeoutNode = {
                getAttribute: (k) => k === "ms" ? "100" : null,
                children: []
            };
            await expect(handlers.get("TIMEOUT").call(mockEngine, validTimeoutNode, { _cancellationSignal: parentCtrl.signal }))
                .rejects.toThrow("Pre-cancelled by parent");
        });

        it("11. should verify retry attempt failure, nextDelay timing and exhaustion with devtools", async () => {
            const handlers = new Map();
            const logErrorScopeSpy = vi.fn();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: logErrorScopeSpy },
                _handleActionInternal: vi.fn()
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. Test retry with nextDelay > 0 (delay = 15ms)
            const t0 = Date.now();
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(new Error("Attempt 1 Fail"))
                .mockResolvedValueOnce("RecoveredAfterDelay");

            const retryWithDelayNode = {
                getAttribute: (k) => k === "attempts" ? "2" : (k === "delay" ? "15" : (k === "backoff" ? "fixed" : null)),
                children: [{ tagName: "step" }]
            };

            const delayRes = await handlers.get("RETRY").call(mockEngine, retryWithDelayNode, {});
            const elapsed = Date.now() - t0;
            expect(delayRes).toBe("RecoveredAfterDelay");
            expect(elapsed).toBeGreaterThanOrEqual(10); // Verifies handleDelayDirect was executed because nextDelay > 0

            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_START", expect.any(Object));
            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_ATTEMPT_FAILED", expect.objectContaining({ attempt: 1, nextDelay: 15 }));
            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_SUCCESS", expect.objectContaining({ attempt: 2, maxAttempts: 2 }));

            // 2. Test retry with nextDelay === 0 (delay = 0ms)
            logErrorScopeSpy.mockClear();
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(new Error("Attempt 1 Fail Zero Delay"))
                .mockResolvedValueOnce("RecoveredZeroDelay");

            const retryZeroDelayNode = {
                getAttribute: (k) => k === "attempts" ? "2" : (k === "delay" ? "0" : (k === "backoff" ? "fixed" : null)),
                children: [{ tagName: "step" }]
            };

            const zeroRes = await handlers.get("RETRY").call(mockEngine, retryZeroDelayNode, {});
            expect(zeroRes).toBe("RecoveredZeroDelay");
            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_ATTEMPT_FAILED", expect.objectContaining({ attempt: 1, nextDelay: 0 }));

            // 3. Test exhaustion
            logErrorScopeSpy.mockClear();
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(new Error("Attempt 1 Fail"))
                .mockRejectedValueOnce(new Error("Attempt 2 Final Fail"));

            const retryExhaustNode = {
                getAttribute: (k) => k === "attempts" ? "2" : (k === "delay" ? "5" : (k === "backoff" ? "fixed" : null)),
                children: [{ tagName: "step" }]
            };

            await expect(handlers.get("RETRY").call(mockEngine, retryExhaustNode, {}))
                .rejects.toThrow("Attempt 2 Final Fail");

            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_EXHAUSTED", expect.objectContaining({ attempt: 2 }));
        });

        it("12. should test strict error filter combinations (code, status, message, mismatch)", async () => {
            const handlers = new Map();
            const logErrorScopeSpy = vi.fn();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: logErrorScopeSpy },
                _handleActionInternal: vi.fn()
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. Code match
            const codeErr = new EUIXStructuredError({ message: "Network timeout", code: "TIMEOUT_ERROR" });
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(codeErr)
                .mockResolvedValueOnce("CodeMatched");

            const codeFilterNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "TIMEOUT_ERROR" : (k === "delay" ? "1" : null)),
                children: [{ tagName: "step" }]
            };
            const codeRes = await handlers.get("RETRY").call(mockEngine, codeFilterNode, {});
            expect(codeRes).toBe("CodeMatched");

            // 2. Filter mismatch throws immediately and logs RETRY_FILTER_MISMATCH
            logErrorScopeSpy.mockClear();
            const mismatchErr = new EUIXStructuredError({ message: "Forbidden Access", code: "AUTH_FORBIDDEN", status: 403 });
            mockEngine._handleActionInternal.mockRejectedValueOnce(mismatchErr);

            const mismatchFilterNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "NETWORK_ERROR, 500" : (k === "delay" ? "1" : null)),
                children: [{ tagName: "step" }]
            };

            await expect(handlers.get("RETRY").call(mockEngine, mismatchFilterNode, {}))
                .rejects.toThrow("Forbidden Access");

            expect(logErrorScopeSpy).toHaveBeenCalledWith("RETRY_FILTER_MISMATCH", expect.objectContaining({
                attempt: 1,
                error: expect.objectContaining({ code: "AUTH_FORBIDDEN" })
            }));

            // 3. Message substring match with multiple filter items (testing .some)
            const multiFilterErr = new Error("Gateway timeout occurred on socket 8080");
            mockEngine._handleActionInternal
                .mockRejectedValueOnce(multiFilterErr)
                .mockResolvedValueOnce("SomeMatchedSuccess");

            const multiFilterNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "on_error" ? "DB_ERROR, 500, TIMEOUT" : (k === "delay" ? "1" : null)),
                children: [{ tagName: "step" }]
            };
            const multiFilterRes = await handlers.get("RETRY").call(mockEngine, multiFilterNode, {});
            expect(multiFilterRes).toBe("SomeMatchedSuccess");
        });

        it("13. should test TIMEOUT with direct action attribute and no child actions", async () => {
            const handlers = new Map();
            const logErrorScopeSpy = vi.fn();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: logErrorScopeSpy },
                _handleActionInternal: vi.fn().mockResolvedValue("DirectActionRan")
            };

            EUIXResiliencePlugin.install(mockEngine);

            const directTimeoutNode = {
                getAttribute: (k) => k === "ms" ? "100" : (k === "action" ? "SET_STATE" : null),
                childNodes: []
            };

            const res = await handlers.get("TIMEOUT").call(mockEngine, directTimeoutNode, {});
            expect(res).toBe("DirectActionRan");
            expect(mockEngine._handleActionInternal).toHaveBeenCalledWith(directTimeoutNode, expect.objectContaining({
                _cancellationSignal: expect.any(Object)
            }));
            expect(logErrorScopeSpy).toHaveBeenCalledWith("TIMEOUT_COMPLETED", expect.any(Object));
        });

        it("14. should test WAIT and SLEEP action alias delegation to DELAY", async () => {
            const handlers = new Map();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _handleActionInternal: vi.fn().mockResolvedValue("DelayDelegated")
            };

            EUIXResiliencePlugin.install(mockEngine);

            const waitNode = {
                getAttribute: (k) => k === "action" ? "WAIT" : (k === "ms" ? "20" : null)
            };

            const waitRes = await handlers.get("WAIT").call(mockEngine, waitNode, {});
            expect(waitRes).toBe("DelayDelegated");
            expect(mockEngine._handleActionInternal).toHaveBeenCalledWith(expect.objectContaining({
                getAttribute: expect.any(Function)
            }), {});

            const sleepNode = {
                getAttribute: (k) => k === "action" ? "SLEEP" : (k === "ms" ? "30" : null)
            };
            const sleepRes = await handlers.get("SLEEP").call(mockEngine, sleepNode, {});
            expect(sleepRes).toBe("DelayDelegated");
        });

        it("15. should test custom originatingAction and calculateBackoffDelay nuances", async () => {
            const handlers = new Map();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _handleActionInternal: vi.fn()
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. Custom action attribute on RETRY
            mockEngine._handleActionInternal.mockRejectedValueOnce(new Error("Custom fail"));
            const customRetryNode = {
                getAttribute: (k) => k === "action" ? "CUSTOM_RETRY_ACTION" : (k === "attempts" ? "1" : null),
                children: [{ tagName: "step" }]
            };

            try {
                await handlers.get("RETRY").call(mockEngine, customRetryNode, {});
            } catch (err) {
                expect(err.originatingAction).toBe("CUSTOM_RETRY_ACTION");
            }

            // 2. Default RETRY originating action when no action attr
            mockEngine._handleActionInternal.mockRejectedValueOnce(new Error("Default fail"));
            const defaultRetryNode = {
                getAttribute: (k) => k === "attempts" ? "1" : null,
                children: [{ tagName: "step" }]
            };

            try {
                await handlers.get("RETRY").call(mockEngine, defaultRetryNode, {});
            } catch (err) {
                expect(err.originatingAction).toBe("RETRY");
            }

            // 3. Custom message on TIMEOUT
            const customMsgNode = {
                getAttribute: (k) => k === "ms" ? "5" : (k === "message" ? "Custom timeout message" : null),
                children: [{ tagName: "step" }]
            };
            mockEngine._handleActionInternal.mockImplementation(() => new Promise(r => setTimeout(r, 50)));

            try {
                await handlers.get("TIMEOUT").call(mockEngine, customMsgNode, {});
            } catch (err) {
                expect(err.message).toBe("Custom timeout message");
            }
        });

        it("16. should verify all retryContext metadata (is_last, isLast, next_delay, nextDelay, prev_error) across attempts", async () => {
            const handlers = new Map();
            const capturedContexts = [];
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _handleActionInternal: vi.fn().mockImplementation((node, ctx) => {
                    capturedContexts.push({ ...ctx.retry });
                    if (ctx.retry.attempt < 3) {
                        throw new Error(`Fail at attempt ${ctx.retry.attempt}`);
                    }
                    return "SuccessAtAttempt3";
                })
            };

            EUIXResiliencePlugin.install(mockEngine);

            const retryNode = {
                getAttribute: (k) => k === "attempts" ? "3" : (k === "delay" ? "2" : (k === "backoff" ? "linear" : null)),
                children: [{ tagName: "step" }]
            };

            const result = await handlers.get("RETRY").call(mockEngine, retryNode, {});
            expect(result).toBe("SuccessAtAttempt3");
            expect(capturedContexts).toHaveLength(3);

            // Attempt 1
            expect(capturedContexts[0].attempt).toBe(1);
            expect(capturedContexts[0].is_last).toBe(false);
            expect(capturedContexts[0].isLast).toBe(false);
            expect(capturedContexts[0].next_delay).toBe(2);
            expect(capturedContexts[0].nextDelay).toBe(2);
            expect(capturedContexts[0].prev_error).toBeNull();
            expect(capturedContexts[0].prevError).toBeNull();

            // Attempt 2
            expect(capturedContexts[1].attempt).toBe(2);
            expect(capturedContexts[1].is_last).toBe(false);
            expect(capturedContexts[1].isLast).toBe(false);
            expect(capturedContexts[1].next_delay).toBe(4);
            expect(capturedContexts[1].nextDelay).toBe(4);
            expect(capturedContexts[1].prev_error).toBeDefined();
            expect(capturedContexts[1].prevError).toBeDefined();

            // Attempt 3 (Final attempt)
            expect(capturedContexts[2].attempt).toBe(3);
            expect(capturedContexts[2].is_last).toBe(true);
            expect(capturedContexts[2].isLast).toBe(true);
            expect(capturedContexts[2].next_delay).toBe(0);
            expect(capturedContexts[2].nextDelay).toBe(0);
            expect(capturedContexts[2].prev_error).toBeDefined();
            expect(capturedContexts[2].prevError).toBeDefined();
        });

        it("17. should test RETRY pre-cancelled signal and child node filtering (delay, ms, attempts, filter)", async () => {
            const handlers = new Map();
            const logSpy = vi.fn();
            const mockEngine = {
                registerAction: (name, fn) => handlers.set(name, fn),
                interpolate: (str, ctx) => str,
                getChild: () => null,
                reportError: vi.fn(),
                _devtools: { logErrorScope: logSpy },
                _handleActionInternal: vi.fn().mockResolvedValue("FilteredSuccess")
            };

            EUIXResiliencePlugin.install(mockEngine);

            // 1. RETRY with pre-cancelled parent signal
            const parentCtrl = new EUIXCancellationController();
            parentCtrl.cancel(new Error("Cancelled before retry start"));

            const retryNode = {
                getAttribute: (k) => k === "attempts" ? "2" : null,
                childNodes: []
            };

            await expect(handlers.get("RETRY").call(mockEngine, retryNode, { _cancellationSignal: parentCtrl.signal }))
                .rejects.toThrow("Cancelled before retry start");

            // 2. RETRY ignoring metadata child tags
            const nodeWithMeta = {
                getAttribute: (k) => k === "attempts" ? "1" : null,
                childNodes: [
                    { nodeType: 1, tagName: "delay" },
                    { nodeType: 1, tagName: "ms" },
                    { nodeType: 1, tagName: "attempts" },
                    { nodeType: 1, tagName: "filter" },
                    { nodeType: 1, tagName: "step", getAttribute: () => "MY_STEP" }
                ]
            };

            const metaRes = await handlers.get("RETRY").call(mockEngine, nodeWithMeta, { _componentName: "Comp" });
            expect(metaRes).toBe("FilteredSuccess");
            expect(mockEngine._handleActionInternal).toHaveBeenCalledTimes(1);
            expect(mockEngine._handleActionInternal).toHaveBeenCalledWith(
                expect.objectContaining({ tagName: "step" }),
                expect.any(Object)
            );
            expect(logSpy).toHaveBeenCalledWith("RETRY_START", expect.objectContaining({
                maxAttempts: 1,
                baseDelay: 0,
                backoff: "fixed",
                component: "Comp"
            }));

            // 3. TIMEOUT ignoring metadata child tags (message, msg, ms, duration)
            const timeoutWithMeta = {
                getAttribute: (k) => k === "ms" ? "50" : null,
                childNodes: [
                    { nodeType: 1, tagName: "message" },
                    { nodeType: 1, tagName: "msg" },
                    { nodeType: 1, tagName: "ms" },
                    { nodeType: 1, tagName: "duration" },
                    { nodeType: 1, tagName: "step" }
                ]
            };

            mockEngine._handleActionInternal.mockClear();
            const timeoutRes = await handlers.get("TIMEOUT").call(mockEngine, timeoutWithMeta, {});
            expect(timeoutRes).toBe("FilteredSuccess");
            expect(mockEngine._handleActionInternal).toHaveBeenCalledTimes(1);
        });
    });
});



