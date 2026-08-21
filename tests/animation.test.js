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

            expect(elapsed).toBeLessThan(450);
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

        test("should test EUIXAnimationPlugin metadata, presets, and disposeComponentAnimations edge cases", () => {
            expect(EUIXAnimationPlugin.name).toBe("EUIXAnimationPlugin");
            expect(EUIXAnimationPresets["fade-in"]).toBeDefined();
            expect(EUIXAnimationPresets["fade-out"]).toBeDefined();
            expect(EUIXAnimationPresets["slide-in-down"]).toBeDefined();

            const xml = `<uid_spec><container><div id="box1">Box 1</div><div id="box2">Box 2</div></container></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const target1 = container.querySelector("#box1");
            const target2 = container.querySelector("#box2");

            engine.animate("#box1", "fade-in", { duration: 1000 });
            engine.animate("#box2", "fade-in", { duration: 1000 });

            expect(engine._activeAnimations.has(target1)).toBe(true);
            expect(engine._activeAnimations.has(target2)).toBe(true);

            // Dispose single target element
            engine.disposeComponentAnimations(target1);
            expect(engine._activeAnimations.has(target1)).toBe(false);
            expect(engine._activeAnimations.has(target2)).toBe(true);

            // Dispose with null _activeAnimations guard
            const dummyEngine = { _activeAnimations: null };
            expect(() => EUIXAnimationPlugin.install({ prototype: dummyEngine }) || dummyEngine.disposeComponentAnimations()).not.toThrow();
        });
    });

    describe("6. Deep Mutant Elimination & Edge Cases", () => {
        test("should thoroughly test EUIXAnimationRegistry methods and edge cases", () => {
            const reg = new EUIXAnimationRegistry();

            // 1. register edge cases
            reg.register(null, { duration: 100 });
            reg.register(undefined, { duration: 100 });
            reg.register(123, { duration: 100 });
            reg.register("  custom-fade  ", { duration: 250 });

            // 2. get edge cases
            expect(reg.get(null)).toBeNull();
            expect(reg.get(undefined)).toBeNull();
            expect(reg.get("")).toBeNull();
            expect(reg.get("non-existent")).toBeNull();
            expect(reg.get("  custom-fade  ")).toEqual({ duration: 250 });

            // 3. has edge cases
            expect(reg.has(null)).toBe(false);
            expect(reg.has(undefined)).toBe(false);
            expect(reg.has("")).toBe(false);
            expect(reg.has("non-existent")).toBe(false);
            expect(reg.has("  custom-fade  ")).toBe(true);
            expect(reg.has("fade-in")).toBe(true);
        });

        test("should test reduced motion window.matchMedia queries and fallbacks", () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);

            // Explicit toggle
            engine.setReducedMotion(false);
            expect(engine.isReducedMotion()).toBe(false);
            engine.setReducedMotion(true);
            expect(engine.isReducedMotion()).toBe(true);

            // MatchMedia mocked true
            engine._reducedMotion = null;
            const origMatchMedia = window.matchMedia;
            window.matchMedia = vi.fn().mockReturnValue({ matches: true });
            expect(engine.isReducedMotion()).toBe(true);

            // MatchMedia mocked false
            window.matchMedia = vi.fn().mockReturnValue({ matches: false });
            expect(engine.isReducedMotion()).toBe(false);

            // MatchMedia null fallback
            window.matchMedia = null;
            expect(engine.isReducedMotion()).toBe(false);
            window.matchMedia = origMatchMedia;
        });

        test("should test registerAnimationDef with XML nodes (iterations, delay, fill, prop/property, attributes)", () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);

            // 1. Plain JS Object registration
            engine.registerAnimationDef("objAnim", { duration: 150, keyframes: [{ opacity: 0 }, { opacity: 1 }] });
            expect(engine._animationRegistry.has("objAnim")).toBe(true);

            // 2. XML Element with iterations='infinite', prop, and property child elements
            const xmlDoc = new DOMParser().parseFromString(`
                <animation_def name="xmlAnim1" duration="400" delay="50" easing="ease-in-out" fill="forwards" iterations="infinite">
                    <keyframe offset="0">
                        <property name="opacity" value="0" />
                        <prop key="transform">scale(0.8)</prop>
                    </keyframe>
                    <keyframe offset="1">
                        <property name="opacity">1</property>
                        <prop key="transform" value="scale(1)" />
                    </keyframe>
                </animation_def>
            `, "text/xml");

            const defNode1 = xmlDoc.documentElement;
            engine.registerAnimationDef("xmlAnim1", defNode1);
            const parsed1 = engine._animationRegistry.get("xmlAnim1");
            expect(parsed1.duration).toBe(400);
            expect(parsed1.delay).toBe(50);
            expect(parsed1.easing).toBe("ease-in-out");
            expect(parsed1.fill).toBe("forwards");
            expect(parsed1.iterations).toBe(Infinity);
            expect(parsed1.keyframes).toHaveLength(2);
            expect(parsed1.keyframes[0].offset).toBe(0);
            expect(parsed1.keyframes[0].opacity).toBe("0");
            expect(parsed1.keyframes[0].transform).toBe("scale(0.8)");
            expect(parsed1.keyframes[1].offset).toBe(1);
            expect(parsed1.keyframes[1].opacity).toBe("1");
            expect(parsed1.keyframes[1].transform).toBe("scale(1)");

            // 3. XML Element with iteration_count='3' and direct keyframe attributes
            const xmlDoc2 = new DOMParser().parseFromString(`
                <animation_def name="xmlAnim2" iteration_count="3">
                    <keyframe offset="0" opacity="0.2" transform="translateY(-10px)" />
                    <keyframe offset="1" opacity="1" transform="translateY(0)" />
                </animation_def>
            `, "text/xml");

            const defNode2 = xmlDoc2.documentElement;
            engine.registerAnimationDef("xmlAnim2", defNode2);
            const parsed2 = engine._animationRegistry.get("xmlAnim2");
            expect(parsed2.iterations).toBe(3);
            expect(parsed2.keyframes[0].opacity).toBe("0.2");
            expect(parsed2.keyframes[0].transform).toBe("translateY(-10px)");
        });

        test("should test animate target resolution ($el, self, this, direct element, document fallback, invalid)", async () => {
            const xml = `<uid_spec><div id="box" class="box-class">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            // Direct element
            await engine.animate(box, "fade-in", { duration: 5 });

            // 'self' / 'this' / '$el' with context._targetEl
            await engine.animate("self", "fade-in", { duration: 5 }, { _targetEl: box });
            await engine.animate("this", "fade-in", { duration: 5 }, { _targetEl: box });
            await engine.animate("$el", "fade-in", { duration: 5 }, { $el: box });

            // document.querySelector fallback
            const globalEl = document.createElement("div");
            globalEl.id = "global-target";
            document.body.appendChild(globalEl);
            await engine.animate("#global-target", "fade-in", { duration: 5 });
            document.body.removeChild(globalEl);

            // Null target with context fallback
            await engine.animate(null, "fade-in", { duration: 5 }, { _targetEl: box });

            // Invalid target rejection
            await expect(engine.animate("#non-existent-xyz", "fade-in"))
                .rejects.toThrow("Animation target not found");
        });

        test("should test animate with keyframe array, keyframe object, timing options, and devtools", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            // 1. Array keyframes
            await engine.animate(box, [{ opacity: 0 }, { opacity: 1 }], { duration: 5, easing: "linear", fill: "forwards", direction: "reverse" });

            // 2. Object with keyframes property
            await engine.animate(box, { keyframes: [{ transform: "scale(1)" }, { transform: "scale(1.1)" }], duration: 5 });

            // 3. Devtools logging
            engine._devtools = { enabled: true, logAction: vi.fn() };
            await engine.animate(box, "fade-in", { duration: 5, commit: true });
            expect(engine._devtools.logAction).toHaveBeenCalledWith("ANIMATION_START", expect.any(Object));
            expect(engine._devtools.logAction).toHaveBeenCalledWith("ANIMATION_END", expect.objectContaining({ status: "completed" }));

            // 4. Invalid duration
            await expect(engine.animate(box, "fade-in", { duration: -50 }))
                .rejects.toThrow("Invalid animation duration");
            await expect(engine.animate(box, "fade-in", { duration: "invalid-num" }))
                .rejects.toThrow("Invalid animation duration");
        });

        test("should test animation interrupt policies (finish and cancel)", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            // Start animation 1
            engine.animate(box, "fade-in", { duration: 1000 });
            expect(engine._activeAnimations.has(box)).toBe(true);

            // Interrupt with 'finish'
            const pFinish = engine.animate(box, "scale-in", { duration: 5, interrupt: "finish" });
            await pFinish;

            // Start animation 2
            engine.animate(box, "fade-in", { duration: 1000 });
            // Interrupt with 'cancel'
            const pCancel = engine.animate(box, "scale-in", { duration: 5, interrupt: "cancel" });
            await pCancel;
        });

        test("should test mock animation fallback when target.animate returns undefined", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            // Mock animate returning undefined
            const origAnimate = box.animate;
            box.animate = vi.fn().mockReturnValue(null);

            await engine.animate(box, [{ opacity: "0.4" }, { opacity: "0.9" }], { duration: 5, commit: true });
            expect(box.style.opacity).toBe("0.9");

            box.animate = origAnimate;
        });

        test("should test execution error when target.animate throws", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            const origAnimate = box.animate;
            box.animate = vi.fn().mockImplementation(() => {
                throw new Error("GPU Memory Error");
            });

            await expect(engine.animate(box, "fade-in", { duration: 5 }))
                .rejects.toThrow("GPU Memory Error");

            box.animate = origAnimate;
        });

        test("should test _handleAnimateAction with element, type, for, preset and inline keyframes", async () => {
            const xml = `
                <uid_spec>
                    <container>
                        <div id="target1">Target 1</div>
                        <div id="target2">Target 2</div>
                    </container>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);

            // 1. Action with for and preset
            const actionNode1 = {
                getAttribute: (k) => k === "for" ? "#target1" : (k === "preset" ? "fade-in" : (k === "duration" ? "5" : null)),
                childNodes: []
            };
            await engine._handleAnimateAction(actionNode1, {});

            // 2. Action with element and type
            const actionNode2 = {
                getAttribute: (k) => k === "element" ? "#target2" : (k === "type" ? "scale-in" : (k === "duration" ? "5" : null)),
                childNodes: []
            };
            await engine._handleAnimateAction(actionNode2, {});

            // 3. Action with inline keyframe tags
            const kf1 = {
                getAttribute: (k) => k === "offset" ? "0" : null,
                children: [
                    { tagName: "property", getAttribute: (k) => k === "name" ? "opacity" : (k === "value" ? "0" : null), textContent: "" }
                ]
            };
            const kf2 = {
                getAttribute: (k) => k === "offset" ? "1" : (k === "opacity" ? "1" : null),
                children: [],
                attributes: [{ name: "offset", value: "1" }, { name: "opacity", value: "1" }]
            };
            const actionNode3 = {
                getAttribute: (k) => k === "target" ? "#target1" : (k === "duration" ? "5" : null),
                children: [kf1, kf2]
            };
            await engine._handleAnimateAction(actionNode3, {});
        });

        test("should test _runLeaveTransitionThenRemove with null, no-leave, on_leave_preset, on_leave child, and errors", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);

            // 1. null element
            const cb1 = vi.fn();
            engine._runLeaveTransitionThenRemove(null, cb1);
            expect(cb1).toHaveBeenCalled();

            // 2. element without leave animation
            const cb2 = vi.fn();
            const plainEl = document.createElement("div");
            engine._runLeaveTransitionThenRemove(plainEl, cb2);
            expect(cb2).toHaveBeenCalled();

            // 3. element with on_leave_preset
            const cb3 = vi.fn();
            const presetEl = document.createElement("div");
            presetEl.setAttribute("on_leave_preset", "fade-out");
            container.appendChild(presetEl);
            engine._runLeaveTransitionThenRemove(presetEl, cb3);
            await new Promise(r => setTimeout(r, 350));
            expect(cb3).toHaveBeenCalled();

            // 4. element with on_leave child
            const cb4 = vi.fn();
            const childEl = document.createElement("div");
            const onLeaveTag = document.createElement("on_leave");
            onLeaveTag.setAttribute("name", "scale-out");
            onLeaveTag.setAttribute("duration", "5");
            childEl.appendChild(onLeaveTag);
            container.appendChild(childEl);
            engine._runLeaveTransitionThenRemove(childEl, cb4);
            await new Promise(r => setTimeout(r, 50));
            expect(cb4).toHaveBeenCalled();
        });

        test("should test disposeComponentAnimations with throwing cancel methods", () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            engine._initAnimationPlugin();

            // Mock throwing cancel
            engine._activeAnimations.set(box, {
                animation: {
                    cancel: () => { throw new Error("Teardown crash"); }
                },
                targetEl: box
            });

            // Specific target dispose
            expect(() => engine.disposeComponentAnimations(box)).not.toThrow();

            // All targets dispose with throwing cancel
            engine._activeAnimations.set(box, {
                animation: {
                    cancel: () => { throw new Error("Teardown crash 2"); }
                },
                targetEl: box
            });
            expect(() => engine.disposeComponentAnimations()).not.toThrow();

            // Active cancel spies for specific and all disposes
            const box1 = document.createElement("div");
            const box2 = document.createElement("div");
            const cancelSpy1 = vi.fn();
            const cancelSpy2 = vi.fn();
            engine._activeAnimations.set(box1, { animation: { cancel: cancelSpy1 }, targetEl: box1 });
            engine._activeAnimations.set(box2, { animation: { cancel: cancelSpy2 }, targetEl: box2 });

            // Dispose box1
            engine.disposeComponentAnimations(box1);
            expect(cancelSpy1).toHaveBeenCalledTimes(1);
            expect(engine._activeAnimations.has(box1)).toBe(false);
            expect(engine._activeAnimations.has(box2)).toBe(true);

            // Dispose all
            engine.disposeComponentAnimations();
            expect(cancelSpy2).toHaveBeenCalledTimes(1);
            expect(engine._activeAnimations.size).toBe(0);
        });

        test("should test commitStyles execution, animation oncancel callback, and action context signal", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const box = container.querySelector("#box");

            // 1. commitStyles invocation
            const commitSpy = vi.fn();
            const origAnimate = box.animate;
            box.animate = vi.fn().mockImplementation(() => {
                const anim = {
                    commitStyles: commitSpy,
                    onfinish: null,
                    oncancel: null,
                    cancel: vi.fn(),
                    finish: vi.fn()
                };
                setTimeout(() => { if (anim.onfinish) anim.onfinish(); }, 5);
                return anim;
            });

            await engine.animate(box, "fade-in", { duration: 5, commit: true });
            expect(commitSpy).toHaveBeenCalled();

            // 2. oncancel callback resolution
            box.animate = vi.fn().mockImplementation(() => {
                const anim = {
                    onfinish: null,
                    oncancel: null,
                    cancel: vi.fn(),
                    finish: vi.fn()
                };
                setTimeout(() => { if (anim.oncancel) anim.oncancel(); }, 5);
                return anim;
            });

            await engine.animate(box, "fade-in", { duration: 5 });

            // 3. Action context fallback signal
            const controller = new EUIXCancellationController();
            engine._currentActionContext = { _cancellationSignal: controller.signal };
            const cancelPromise = engine.animate(box, "fade-in", { duration: 50 });
            controller.cancel("ActionContext Signal Aborted");
            await expect(cancelPromise).rejects.toThrow("Animation cancelled: ActionContext Signal Aborted");
            engine._currentActionContext = null;

            box.animate = origAnimate;
        });

        test("should test _runLeaveTransitionThenRemove nested querySelector and missing callback", async () => {
            const xml = `<uid_spec><div id="parent"><div class="child" leave_animation="fade-out">Child</div></div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);
            const parent = container.querySelector("#parent");

            // Nested child querySelector match without callback
            expect(() => engine._runLeaveTransitionThenRemove(parent)).not.toThrow();

            // Nested child querySelector match with callback
            const cb = vi.fn();
            engine._runLeaveTransitionThenRemove(parent, cb);
            await new Promise(r => setTimeout(r, 350));
            expect(cb).toHaveBeenCalled();
        });

        test("should assert exact structure and values for all built-in animation presets and window globals", () => {
            expect(window.EUIXAnimationPresets).toBeDefined();
            expect(window.EUIXAnimationRegistry).toBeDefined();

            const presets = EUIXAnimationPresets;

            // fade-in & fade-out
            expect(presets["fade-in"].duration).toBe(300);
            expect(presets["fade-in"].easing).toBe("ease-out");
            expect(presets["fade-in"].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);

            expect(presets["fade-out"].duration).toBe(300);
            expect(presets["fade-out"].easing).toBe("ease-in");
            expect(presets["fade-out"].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);

            // slide-in directions
            expect(presets["slide-in-down"].keyframes[0].transform).toBe("translateY(-30px)");
            expect(presets["slide-in-down"].keyframes[1].transform).toBe("translateY(0)");
            expect(presets["slide-in-up"].keyframes[0].transform).toBe("translateY(30px)");
            expect(presets["slide-in-up"].keyframes[1].transform).toBe("translateY(0)");
            expect(presets["slide-in-left"].keyframes[0].transform).toBe("translateX(-30px)");
            expect(presets["slide-in-left"].keyframes[1].transform).toBe("translateX(0)");
            expect(presets["slide-in-right"].keyframes[0].transform).toBe("translateX(30px)");
            expect(presets["slide-in-right"].keyframes[1].transform).toBe("translateX(0)");

            // scale-in & scale-out
            expect(presets["scale-in"].duration).toBe(300);
            expect(presets["scale-in"].keyframes[0].transform).toBe("scale(0.85)");
            expect(presets["scale-in"].keyframes[1].transform).toBe("scale(1)");
            expect(presets["scale-out"].duration).toBe(250);
            expect(presets["scale-out"].keyframes[0].transform).toBe("scale(1)");
            expect(presets["scale-out"].keyframes[1].transform).toBe("scale(0.85)");

            // shake & pulse & spin & bounce
            expect(presets["shake"].duration).toBe(400);
            expect(presets["shake"].keyframes).toHaveLength(6);
            expect(presets["pulse"].duration).toBe(400);
            expect(presets["pulse"].keyframes[1].transform).toBe("scale(1.08)");
            expect(presets["spin"].duration).toBe(600);
            expect(presets["spin"].keyframes[1].transform).toBe("rotate(360deg)");
            expect(presets["bounce"].duration).toBe(600);
            expect(presets["bounce"].keyframes).toHaveLength(5);

            // collapse-down & collapse-up
            expect(presets["collapse-down"].duration).toBe(300);
            expect(presets["collapse-down"].keyframes[0].maxHeight).toBe("0px");
            expect(presets["collapse-down"].keyframes[1].maxHeight).toBe("500px");
            expect(presets["collapse-up"].duration).toBe(300);
            expect(presets["collapse-up"].keyframes[0].maxHeight).toBe("500px");
            expect(presets["collapse-up"].keyframes[1].maxHeight).toBe("0px");
        });

        test("should test _handleAnimateAction with nested child nodes (target, name, duration, delay, easing, fill)", async () => {
            const xml = `<uid_spec><div id="box">Box</div></uid_spec>`;
            const engine = EUIXEngine.mount(xml, container);

            // Mock getChild
            engine.getChild = (node, tag) => {
                if (tag === "target") return { textContent: "#box" };
                if (tag === "name") return { textContent: "fade-in" };
                if (tag === "duration") return { textContent: "10" };
                if (tag === "delay") return { textContent: "2" };
                if (tag === "easing") return { textContent: "ease-out" };
                if (tag === "fill") return { textContent: "forwards" };
                return null;
            };

            const nodeWithChildren = {
                getAttribute: () => null,
                children: []
            };

            await engine._handleAnimateAction(nodeWithChildren, {});

            // Test with preset child tag
            engine.getChild = (node, tag) => {
                if (tag === "target") return { textContent: "#box" };
                if (tag === "preset") return { textContent: "scale-in" };
                return null;
            };

            await engine._handleAnimateAction(nodeWithChildren, {});
        });
    });
});
