/**
 * EUIXAnimationPlugin
 * Declarative Animation System for EUIX Engine.
 * Powered by browser-native Web Animations API with zero layout thrashing,
 * 60fps GPU acceleration, Action Composer integration, cancellation signals,
 * enter/leave transitions, and prefers-reduced-motion support.
 */

import { EUIXStructuredError, EUIXExpressionParser } from "../core/EUIXEngineCore.js";

/**
 * Built-in Preset Animations
 */
export const EUIXAnimationPresets = {
    "fade-in": {
        duration: 300,
        easing: "ease-out",
        keyframes: [
            { opacity: 0 },
            { opacity: 1 }
        ]
    },
    "fade-out": {
        duration: 300,
        easing: "ease-in",
        keyframes: [
            { opacity: 1 },
            { opacity: 0 }
        ]
    },
    "slide-in-down": {
        duration: 350,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        keyframes: [
            { opacity: 0, transform: "translateY(-30px)" },
            { opacity: 1, transform: "translateY(0)" }
        ]
    },
    "slide-in-up": {
        duration: 350,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        keyframes: [
            { opacity: 0, transform: "translateY(30px)" },
            { opacity: 1, transform: "translateY(0)" }
        ]
    },
    "slide-in-left": {
        duration: 350,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        keyframes: [
            { opacity: 0, transform: "translateX(-30px)" },
            { opacity: 1, transform: "translateX(0)" }
        ]
    },
    "slide-in-right": {
        duration: 350,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        keyframes: [
            { opacity: 0, transform: "translateX(30px)" },
            { opacity: 1, transform: "translateX(0)" }
        ]
    },
    "scale-in": {
        duration: 300,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        keyframes: [
            { opacity: 0, transform: "scale(0.85)" },
            { opacity: 1, transform: "scale(1)" }
        ]
    },
    "scale-out": {
        duration: 250,
        easing: "ease-in",
        keyframes: [
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(0.85)" }
        ]
    },
    "shake": {
        duration: 400,
        easing: "ease-in-out",
        keyframes: [
            { transform: "translateX(0)" },
            { transform: "translateX(-8px)" },
            { transform: "translateX(8px)" },
            { transform: "translateX(-6px)" },
            { transform: "translateX(6px)" },
            { transform: "translateX(0)" }
        ]
    },
    "pulse": {
        duration: 400,
        easing: "ease-in-out",
        keyframes: [
            { transform: "scale(1)" },
            { transform: "scale(1.08)" },
            { transform: "scale(1)" }
        ]
    },
    "spin": {
        duration: 600,
        easing: "linear",
        keyframes: [
            { transform: "rotate(0deg)" },
            { transform: "rotate(360deg)" }
        ]
    },
    "bounce": {
        duration: 600,
        easing: "cubic-bezier(0.28, 0.84, 0.42, 1)",
        keyframes: [
            { transform: "translateY(0)" },
            { transform: "translateY(-20px)" },
            { transform: "translateY(0)" },
            { transform: "translateY(-10px)" },
            { transform: "translateY(0)" }
        ]
    },
    "collapse-down": {
        duration: 300,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        keyframes: [
            { opacity: 0, maxHeight: "0px" },
            { opacity: 1, maxHeight: "500px" }
        ]
    },
    "collapse-up": {
        duration: 300,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        keyframes: [
            { opacity: 1, maxHeight: "500px" },
            { opacity: 0, maxHeight: "0px" }
        ]
    }
};

/**
 * EUIXAnimationRegistry
 */
export class EUIXAnimationRegistry {
    constructor() {
        this.definitions = new Map();
        // Pre-populate built-in presets
        Object.entries(EUIXAnimationPresets).forEach(([name, def]) => {
            this.definitions.set(name, def);
        });
    }

    register(name, def) {
        if (!name || typeof name !== "string") return;
        const cleanName = name.trim();
        this.definitions.set(cleanName, def);
    }

    get(name) {
        if (!name) return null;
        return this.definitions.get(String(name).trim()) || null;
    }

    has(name) {
        if (!name) return false;
        return this.definitions.has(String(name).trim());
    }
}

/**
 * EUIXAnimationPlugin
 */
export const EUIXAnimationPlugin = {
    name: "EUIXAnimationPlugin",
    install(engineClass) {
        engineClass.EUIXAnimationPresets = EUIXAnimationPresets;
        engineClass.EUIXAnimationRegistry = EUIXAnimationRegistry;

        if (typeof window !== "undefined") {
            window.EUIXAnimationPresets = EUIXAnimationPresets;
            window.EUIXAnimationRegistry = EUIXAnimationRegistry;
        }

        if (typeof engineClass.registerAction === "function") {
            engineClass.registerAction("ANIMATE", function(actionNode, context) {
                return this._handleAnimateAction(actionNode, context);
            });
            engineClass.registerAction("TRANSITION", function(actionNode, context) {
                return this._handleAnimateAction(actionNode, context);
            });
        }

        const proto = engineClass.prototype;

        proto._initAnimationPlugin = function() {
            if (!this._animationRegistry) {
                this._animationRegistry = new EUIXAnimationRegistry();
            }
            if (!this._activeAnimations) {
                this._activeAnimations = new Map();
            }
            if (this._reducedMotion === undefined) {
                this._reducedMotion = null;
            }
        };

        proto.setReducedMotion = function(enabled) {
            this._reducedMotion = Boolean(enabled);
            return this;
        };

        proto.isReducedMotion = function() {
            if (this._reducedMotion !== null) return this._reducedMotion;
            if (typeof window !== "undefined" && window.matchMedia) {
                return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            }
            return false;
        };

        proto.registerAnimationDef = function(name, xmlNodeOrObj) {
            this._initAnimationPlugin();

            if (typeof name === "string" && xmlNodeOrObj) {
                let parsedDef = xmlNodeOrObj;

                if (xmlNodeOrObj.nodeType === 1) { // XML Element Node
                    const durationAttr = xmlNodeOrObj.getAttribute("duration");
                    const delayAttr = xmlNodeOrObj.getAttribute("delay");
                    const easingAttr = xmlNodeOrObj.getAttribute("easing");
                    const fillAttr = xmlNodeOrObj.getAttribute("fill");
                    const iterationsAttr = xmlNodeOrObj.getAttribute("iterations") || xmlNodeOrObj.getAttribute("iteration_count");

                    const keyframeNodes = Array.from(xmlNodeOrObj.childNodes || []).filter(c => c.nodeType === 1 && (c.nodeName.toLowerCase() === "keyframe" || c.tagName?.toLowerCase() === "keyframe"));
                    const keyframes = keyframeNodes.map(kf => {
                        const kfObj = {};
                        const offsetAttr = kf.getAttribute("offset");
                        if (offsetAttr !== null) kfObj.offset = parseFloat(offsetAttr);

                        const propNodes = Array.from(kf.childNodes || []).filter(c => c.nodeType === 1 && (c.nodeName.toLowerCase() === "property" || c.nodeName.toLowerCase() === "prop" || c.tagName?.toLowerCase() === "property" || c.tagName?.toLowerCase() === "prop"));
                        if (propNodes.length > 0) {
                            propNodes.forEach(p => {
                                const propName = p.getAttribute("name") || p.getAttribute("key");
                                const propVal = p.textContent.trim() || p.getAttribute("value");
                                if (propName) kfObj[propName] = propVal;
                            });
                        } else {
                            Array.from(kf.attributes || []).forEach(attr => {
                                if (attr.name !== "offset") kfObj[attr.name] = attr.value;
                            });
                        }
                        return kfObj;
                    });

                    parsedDef = {
                        duration: durationAttr ? parseInt(durationAttr, 10) : undefined,
                        delay: delayAttr ? parseInt(delayAttr, 10) : undefined,
                        easing: easingAttr || undefined,
                        fill: fillAttr || undefined,
                        iterations: iterationsAttr ? (iterationsAttr === "infinite" ? Infinity : parseFloat(iterationsAttr)) : undefined,
                        keyframes
                    };
                }

                this._animationRegistry.register(name, parsedDef);
            }
        };

        proto.animate = function(target, keyframesOrName, options = {}, context = {}) {
            this._initAnimationPlugin();

            // 1. Target Resolution
            let targetEl = null;
            if (target && target.nodeType === 1) {
                targetEl = target;
            } else if (typeof target === "string" && target) {
                const interpolatedTarget = this.interpolate(target, context);
                if (interpolatedTarget === "self" || interpolatedTarget === "this" || interpolatedTarget === "$el") {
                    targetEl = context._targetEl || context.$el || null;
                } else {
                    if (this.container && typeof this.container.querySelector === "function") {
                        targetEl = this.container.querySelector(interpolatedTarget);
                    }
                    if (!targetEl && typeof document !== "undefined" && typeof document.querySelector === "function") {
                        targetEl = document.querySelector(interpolatedTarget);
                    }
                    if (!targetEl && context && context._targetEl) {
                        targetEl = context._targetEl;
                    }
                }
            } else if (target && target.nodeType === 1) {
                targetEl = target;
            } else if (!target) {
                targetEl = context._targetEl || context.$el || null;
            }

            if (!targetEl) {
                const err = new EUIXStructuredError({
                    message: `Animation target not found: '${target}'`,
                    code: "ANIMATION_TARGET_NOT_FOUND",
                    originatingAction: "ANIMATE",
                    component: context._componentName
                });
                this.reportError(err, "Animation Execution");
                return Promise.reject(err);
            }

            // 2. Resolve Keyframes & Named Animation
            let keyframes = [];
            let animOptions = { ...options };

            if (typeof keyframesOrName === "string") {
                const namedDef = this._animationRegistry.get(keyframesOrName);
                if (!namedDef) {
                    const err = new EUIXStructuredError({
                        message: `Unknown animation definition or preset: '${keyframesOrName}'`,
                        code: "ANIMATION_CONFIG_ERROR",
                        originatingAction: "ANIMATE",
                        component: context._componentName
                    });
                    this.reportError(err, "Animation Configuration");
                    return Promise.reject(err);
                }
                keyframes = namedDef.keyframes || [];
                animOptions = {
                    duration: namedDef.duration,
                    easing: namedDef.easing,
                    fill: namedDef.fill,
                    iterations: namedDef.iterations,
                    ...options
                };
            } else if (Array.isArray(keyframesOrName)) {
                keyframes = keyframesOrName;
            } else if (keyframesOrName && typeof keyframesOrName === "object") {
                keyframes = keyframesOrName.keyframes || [];
                animOptions = { ...keyframesOrName, ...options };
            }

            // Parse & validate numeric timing options
            let duration = animOptions.duration !== undefined ? parseInt(animOptions.duration, 10) : 300;
            let delay = animOptions.delay !== undefined ? parseInt(animOptions.delay, 10) : 0;
            const easing = animOptions.easing || "ease";
            const fill = animOptions.fill || "both";
            const iterations = animOptions.iterations || animOptions.iteration_count || 1;
            const direction = animOptions.direction || "normal";
            const commit = animOptions.commit === true || animOptions.commit === "true";
            const interruptPolicy = animOptions.interrupt || animOptions.on_interrupt || "cancel";

            if (isNaN(duration) || duration < 0) {
                const err = new EUIXStructuredError({
                    message: `Invalid animation duration: '${animOptions.duration}'`,
                    code: "ANIMATION_CONFIG_ERROR"
                });
                this.reportError(err, "Animation Configuration");
                return Promise.reject(err);
            }

            // Handle Reduced Motion Policy
            if (this.isReducedMotion()) {
                duration = 0;
                delay = 0;
            }

            // 3. Interruption Handling
            if (this._activeAnimations.has(targetEl)) {
                const active = this._activeAnimations.get(targetEl);
                if (interruptPolicy === "finish" && active.animation && typeof active.animation.finish === "function") {
                    try { active.animation.finish(); } catch (_) {}
                } else if (interruptPolicy === "cancel" && active.animation && typeof active.animation.cancel === "function") {
                    try { active.animation.cancel(); } catch (_) {}
                }
                this._activeAnimations.delete(targetEl);
            }

            return new Promise((resolve, reject) => {
                const webAnimOptions = {
                    duration,
                    delay,
                    easing,
                    fill,
                    iterations: iterations === "infinite" ? Infinity : parseFloat(iterations),
                    direction
                };

                let animation;
                if (typeof targetEl.animate === "function") {
                    try {
                        animation = targetEl.animate(keyframes, webAnimOptions);
                    } catch (err) {
                        const structured = EUIXStructuredError.from(err, {
                            code: "ANIMATION_EXECUTION_ERROR",
                            originatingAction: "ANIMATE"
                        });
                        this.reportError(structured, "Web Animations API Call");
                        return reject(structured);
                    }
                }

                // Fallback Mock Animation Object if targetEl.animate returned undefined/null
                if (!animation) {
                    animation = {
                        onfinish: null,
                        oncancel: null,
                        cancel: function() { if (this.oncancel) this.oncancel(); },
                        finish: function() { if (this.onfinish) this.onfinish(); },
                        commitStyles: function() {}
                    };
                    setTimeout(() => {
                        if (commit && keyframes.length > 0) {
                            const finalKf = keyframes[keyframes.length - 1];
                            Object.assign(targetEl.style, finalKf);
                        }
                        if (animation.onfinish) animation.onfinish();
                    }, Math.max(0, duration));
                } else {
                    const isJSDOM = typeof window !== "undefined" && window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes("jsdom");
                    if (isJSDOM) {
                        let timerId = setTimeout(() => {
                            if (animation && typeof animation.onfinish === "function") {
                                try { animation.onfinish(); } catch (_) {}
                            }
                        }, Math.max(10, duration + delay));
                        const origCancel = animation.cancel;
                        animation.cancel = function() {
                            clearTimeout(timerId);
                            if (typeof origCancel === "function") origCancel.call(animation);
                            if (this.oncancel) this.oncancel();
                        };
                    }
                }

                const activeRecord = { animation, targetEl, options: animOptions };
                this._activeAnimations.set(targetEl, activeRecord);

                if (this._devtools && this._devtools.enabled) {
                    this._devtools.logAction("ANIMATION_START", {
                        target: targetEl.tagName,
                        duration,
                        easing,
                        keyframesCount: keyframes.length
                    });
                }

                // Cancellation Controller Signal Tracking
                let isCancelledBySignal = false;
                const signal = context._cancellationSignal || (this._currentActionContext && this._currentActionContext._cancellationSignal);
                let unbindSignal = null;
                if (signal) {
                    unbindSignal = signal.onCancel((reason) => {
                        isCancelledBySignal = true;
                        try { animation.cancel(); } catch (_) {}
                        this._activeAnimations.delete(targetEl);
                        const cancelErr = new EUIXStructuredError({
                            message: `Animation cancelled: ${reason || 'Signal aborted'}`,
                            code: "ANIMATION_CANCELLED",
                            originatingAction: "ANIMATE"
                        });
                        reject(cancelErr);
                    });
                }

                animation.onfinish = () => {
                    if (isCancelledBySignal) return;
                    if (unbindSignal) unbindSignal();
                    this._activeAnimations.delete(targetEl);

                    if (commit && typeof animation.commitStyles === "function") {
                        try { animation.commitStyles(); } catch (_) {}
                    }

                    if (this._devtools && this._devtools.enabled) {
                        this._devtools.logAction("ANIMATION_END", { target: targetEl.tagName, status: "completed" });
                    }
                    resolve();
                };

                animation.oncancel = () => {
                    if (isCancelledBySignal) return;
                    if (unbindSignal) unbindSignal();
                    this._activeAnimations.delete(targetEl);
                    resolve();
                };
            });
        };

        // Declarative Action Handler for <animate> / <transition> tags
        proto._handleAnimateAction = function(actionNode, context = {}) {
            const targetAttr = actionNode.getAttribute("target") || actionNode.getAttribute("for") || actionNode.getAttribute("element");
            const targetNode = this.getChild(actionNode, "target");
            const target = targetNode ? targetNode.textContent.trim() : (targetAttr || context._targetEl);

            const nameAttr = actionNode.getAttribute("name") || actionNode.getAttribute("preset") || actionNode.getAttribute("type");
            const nameNode = this.getChild(actionNode, "name") || this.getChild(actionNode, "preset");
            const name = nameNode ? nameNode.textContent.trim() : nameAttr;

            const durationAttr = actionNode.getAttribute("duration") || this.getChild(actionNode, "duration")?.textContent.trim();
            const delayAttr = actionNode.getAttribute("delay") || this.getChild(actionNode, "delay")?.textContent.trim();
            const easingAttr = actionNode.getAttribute("easing") || this.getChild(actionNode, "easing")?.textContent.trim();
            const fillAttr = actionNode.getAttribute("fill") || this.getChild(actionNode, "fill")?.textContent.trim();

            const keyframeNodes = Array.from(actionNode.children || []).filter(c => c.tagName && c.tagName.toLowerCase() === "keyframe");
            let keyframes = null;

            if (keyframeNodes.length > 0) {
                keyframes = keyframeNodes.map(kf => {
                    const kfObj = {};
                    const offsetAttr = kf.getAttribute("offset");
                    if (offsetAttr !== null) kfObj.offset = parseFloat(offsetAttr);

                    const propNodes = Array.from(kf.children || []).filter(c => c.tagName && (c.tagName.toLowerCase() === "property" || c.tagName.toLowerCase() === "prop"));
                    if (propNodes.length > 0) {
                        propNodes.forEach(p => {
                            const propName = p.getAttribute("name") || p.getAttribute("key");
                            const propVal = p.textContent.trim() || p.getAttribute("value");
                            if (propName) kfObj[propName] = this.interpolate(propVal, context);
                        });
                    } else {
                        Array.from(kf.attributes || []).forEach(attr => {
                            if (attr.name !== "offset") kfObj[attr.name] = this.interpolate(attr.value, context);
                        });
                    }
                    return kfObj;
                });
            }

            const options = {
                duration: durationAttr ? this.interpolate(durationAttr, context) : undefined,
                delay: delayAttr ? this.interpolate(delayAttr, context) : undefined,
                easing: easingAttr ? this.interpolate(easingAttr, context) : undefined,
                fill: fillAttr ? this.interpolate(fillAttr, context) : undefined
            };

            return this.animate(target, keyframes || name, options, context);
        };

        // Lifecycle Leave Transition Hook for Deferred Removal
        proto._runLeaveTransitionThenRemove = function(element, callback) {
            if (!element || element.nodeType !== 1) {
                callback?.();
                return;
            }

            const findTargetWithLeave = (node) => {
                if (!node || node.nodeType !== 1) return null;
                if (node.getAttribute && (node.getAttribute("leave_animation") || node.getAttribute("on_leave_preset") || node.getAttribute("on_leave"))) {
                    return node;
                }
                if (node.querySelector) {
                    const child = node.querySelector("[leave_animation], [on_leave_preset], [on_leave], on_leave");
                    if (child) return child;
                }
                return null;
            };

            const targetEl = findTargetWithLeave(element);

            if (!targetEl) {
                callback?.();
                return;
            }

            const leaveAnimName = targetEl.getAttribute ? (targetEl.getAttribute("leave_animation") || targetEl.getAttribute("on_leave_preset") || targetEl.getAttribute("on_leave")) : null;
            const onLeaveChild = (targetEl.tagName && targetEl.tagName.toLowerCase() === "on_leave") ? targetEl : (targetEl.querySelector ? targetEl.querySelector("on_leave") : null);

            let animPromise;
            if (onLeaveChild) {
                animPromise = this._handleAnimateAction(onLeaveChild, { _targetEl: targetEl });
            } else if (leaveAnimName) {
                animPromise = this.animate(targetEl, leaveAnimName, {}, { _targetEl: targetEl });
            }

            if (animPromise?.then) {
                animPromise.finally(() => {
                    callback?.();
                });
            } else {
                callback?.();
            }
        };

function safeCancelAnimation(record) {
    try {
        record?.animation?.cancel?.();
    } catch (_) {}
}

        proto.disposeComponentAnimations = function(componentNameOrEl) {
            if (!this._activeAnimations) return;
            if (componentNameOrEl && componentNameOrEl.nodeType === 1) {
                if (this._activeAnimations.has(componentNameOrEl)) {
                    safeCancelAnimation(this._activeAnimations.get(componentNameOrEl));
                    this._activeAnimations.delete(componentNameOrEl);
                }
                return;
            }
            for (const [el, record] of this._activeAnimations.entries()) {
                safeCancelAnimation(record);
                this._activeAnimations.delete(el);
            }
        };
    }
};

export default EUIXAnimationPlugin;
