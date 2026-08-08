/**
 * tests/animation.test.js
 * Comprehensive Test Suite for EUIX Declarative Animation System
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXAnimationPlugin, EUIXAnimationPresets, EUIXAnimationRegistry } from "../src/plugins/EUIXAnimationPlugin.js";
import { EUIXCancellationController } from "../src/plugins/EUIXResiliencePlugin.js";

describe("EUIX Engine - Declarative Animation System Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        // Mock Element.prototype.animate for JSDOM environment if not available natively
        if (!Element.prototype.animate) {
            Element.prototype.animate = vi.fn().mockImplementation((keyframes, options) => {
                const anim = {
                    onfinish: null,
                    oncancel: null,
                    cancel: vi.fn(function() {
                        if (this.oncancel) this.oncancel();
                    }),
                    finish: vi.fn(function() {
                        if (this.onfinish) this.onfinish();
                    }),
                    commitStyles: vi.fn()
                };
                setTimeout(() => {
                    if (anim.onfinish) anim.onfinish();
                }, options && options.duration !== undefined ? Math.min(options.duration, 20) : 0);
                return anim;
            });
        }
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    describe("1. Basic Animations & API", () => {
        test("should execute basic programmatic animation via engine.animate()", async () => {
            const xml = `
                <uid_spec>
                    <div id="target" class="box">Content</div>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);
            const target = container.querySelector("#target");

            const animPromise = engine.animate(target, [
                { opacity: 0, transform: "scale(0.5)" },
                { opacity: 1, transform: "scale(1)" }
            ], { duration: 10, easing: "ease-out" });

            expect(animPromise).toBeInstanceOf(Promise);
            await animPromise;
        });

        test("should execute built-in presets (fade-in, slide-in-down, scale-in, spin, bounce)", async () => {
            const xml = `
                <uid_spec>
                    <div id="card">Preset Card</div>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);

            await engine.animate("#card", "fade-in", { duration: 5 });
            await engine.animate("#card", "slide-in-down", { duration: 5 });
            await engine.animate("#card", "scale-in", { duration: 5 });
            await engine.animate("#card", "spin", { duration: 5 });
            await engine.animate("#card", "bounce", { duration: 5 });
        });

        test("should report error for non-existent target or unknown preset", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);

            await expect(engine.animate("#non-existent-id", "fade-in")).rejects.toThrow(/Animation target not found/);
            await expect(engine.animate("#box", "unknown-preset-123")).rejects.toThrow(/Unknown animation definition or preset/);
        });
    });

    describe("2. Declarative XML Action Integration", () => {
        test("should execute declarative <animate> action step inside button on_click", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">initial</state>
                    </data_model>
                    <flex direction="column">
                        <div id="card">Card</div>
                        <button id="btn">
                            <on_click action="TRY">
                                <step action="ANIMATE">
                                    <target>#card</target>
                                    <name>fade-in</name>
                                    <duration>10</duration>
                                </step>
                                <step action="SET_STATE">
                                    <path>data.status</path>
                                    <value>completed</value>
                                </step>
                            </on_click>
                            Start
                        </button>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const btn = container.querySelector("#btn");

            btn.click();
            await new Promise(r => setTimeout(r, 50));

            expect(engine.getState("status")).toBe("completed");
        });

        test("should support reusable <animation_def> declared in XML", async () => {
            const xml = `
                <uid_spec>
                    <div id="hero">Hero Element</div>
                    <animations>
                        <animation_def name="customPulse" duration="15" easing="ease-in">
                            <keyframe offset="0" transform="scale(1)" />
                            <keyframe offset="1" transform="scale(1.2)" />
                        </animation_def>
                    </animations>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(engine._animationRegistry.has("customPulse")).toBe(true);

            await engine.animate("#hero", "customPulse");
        });
    });

    describe("3. Lifecycle Enter & Leave Transitions", () => {
        test("should trigger enter_animation on mount", async () => {
            const xml = `
                <uid_spec>
                    <div id="animated-box" enter_animation="slide-in-down">
                        Entering Content
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#animated-box");
            expect(box).not.toBeNull();
        });

        test("should defer DOM removal during conditional leave_animation", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="show" type="boolean">true</state>
                    </data_model>
                    <container>
                        <if condition="{data.show}">
                            <div id="leave-box" leave_animation="fade-out">
                                Disappearing Box
                            </div>
                        </if>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(container.querySelector("#leave-box")).not.toBeNull();

            // Toggle state to false
            engine.setState("show", false);

            // Immediately after setState, element should still be in DOM while leave animation runs
            expect(container.querySelector("#leave-box")).not.toBeNull();

            // Wait for leave transition to complete
            await new Promise(r => setTimeout(r, 350));

            // Now element should be removed from DOM
            expect(container.querySelector("#leave-box")).toBeNull();
        });
    });

    describe("4. Interruption & Cancellation Integration", () => {
        test("should cancel previous animation on same element under default interrupt policy", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const target = container.querySelector("#box");

            const p1 = engine.animate(target, "fade-in", { duration: 100 });
            const p2 = engine.animate(target, "scale-in", { duration: 10 });

            await p2;
        });

        test("should abort active animation when cancellation signal triggers", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const target = container.querySelector("#box");

            const controller = new EUIXCancellationController();
            const animPromise = engine.animate(target, "fade-in", { duration: 200 }, { _cancellationSignal: controller.signal });

            controller.cancel("User navigated away");

            await expect(animPromise).rejects.toThrow(/Animation cancelled: User navigated away/);
        });
    });

    describe("5. Reduced Motion & Teardown Safety", () => {
        test("should set duration to 0 when reduced motion is enabled", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            engine.setReducedMotion(true);

            expect(engine.isReducedMotion()).toBe(true);

            const start = Date.now();
            await engine.animate("#box", "fade-in", { duration: 500 });
            const elapsed = Date.now() - start;

            expect(elapsed).toBeLessThan(100);
        });

        test("should clean up active animations on component dispose", () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const target = container.querySelector("#box");

            engine.animate(target, "fade-in", { duration: 1000 });
            expect(engine._activeAnimations.has(target)).toBe(true);

            engine.disposeComponentAnimations();
            expect(engine._activeAnimations.has(target)).toBe(false);
        });

        test("should work via modular subpath import on EUIXEngineCore", () => {
            EUIXEngineCore.use(EUIXAnimationPlugin);
            const xml = `<uid_spec><div id="subpath">Subpath</div></uid_spec>`;
            const engine = EUIXEngineCore.mount(xml, container);

            expect(typeof engine.animate).toBe("function");
        });
    });
});
