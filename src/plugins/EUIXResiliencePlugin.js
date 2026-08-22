import { EUIXStructuredError } from "../core/EUIXEngineCore.js";

const noop = () => {};
const genId = (p = "id_") => p + Math.random().toString(36).substring(2, 9);
const getNow = () =>
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const logScope = (engine, context, event, payload) => {
    const devtools = engine?._devtools || context?._engine?._devtools || context?.$engine?._devtools;
    if (devtools?.logErrorScope) devtools.logErrorScope(event, payload);
};

/**
 * EUIXCancellationController
 * Cancellation signal propagation and token management for EUIX Engine actions.
 */
export class EUIXCancellationController {
    constructor(parentSignal = null) {
        this.isCancelled = false;
        this.reason = null;
        this.listeners = new Set();
        this._abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
        this._parentUnsubscribe = null;

        if (parentSignal) {
            if (parentSignal.isCancelled) {
                this.cancel(parentSignal.reason);
            } else {
                this._parentUnsubscribe = parentSignal.onCancel((reason) => this.cancel(reason));
            }
        }
    }

    get signal() {
        const self = this;
        return {
            get isCancelled() {
                return self.isCancelled;
            },
            get reason() {
                return self.reason;
            },
            get abortSignal() {
                return self._abortController ? self._abortController.signal : null;
            },
            onCancel: (cb) => {
                if (typeof cb !== "function") return noop;
                if (this.isCancelled) {
                    try {
                        cb(this.reason);
                    } catch (_) {}
                    return noop;
                }
                this.listeners.add(cb);
                return () => this.listeners.delete(cb);
            },
            throwIfCancelled: () => {
                if (this.isCancelled) {
                    throw (
                        this.reason ||
                        new EUIXStructuredError({
                            message: "Action execution was cancelled",
                            code: "ACTION_CANCELLED",
                        })
                    );
                }
            },
        };
    }

    cancel(reason = null) {
        if (this.isCancelled) return;
        this.isCancelled = true;
        this.reason =
            reason ||
            new EUIXStructuredError({
                message: "Action execution was cancelled",
                code: "ACTION_CANCELLED",
            });

        if (this._abortController) {
            try {
                this._abortController.abort(this.reason);
            } catch (_) {}
        }

        const currentListeners = Array.from(this.listeners);
        this.listeners.clear();
        for (const cb of currentListeners) {
            try {
                cb(this.reason);
            } catch (_) {}
        }

        if (typeof this._parentUnsubscribe === "function") {
            this._parentUnsubscribe();
            this._parentUnsubscribe = null;
        }
    }
}

export function calculateBackoffDelay(strategy = "fixed", baseDelay = 0, attempt = 1, maxDelay = null) {
    if (baseDelay <= 0) return 0;
    let calculated = baseDelay;

    const cleanStrategy = String(strategy || "fixed")
        .toLowerCase()
        .trim();
    if (cleanStrategy === "linear") {
        calculated = baseDelay * attempt;
    } else if (cleanStrategy === "exponential" || cleanStrategy === "exp") {
        calculated = baseDelay * 2 ** (attempt - 1);
    } else if (cleanStrategy === "jitter") {
        const exp = baseDelay * 2 ** (attempt - 1);
        calculated = Math.round(exp * (0.5 + Math.random() * 0.5));
    }

    if (maxDelay !== null && maxDelay !== undefined && !Number.isNaN(parseFloat(maxDelay))) {
        const cap = parseFloat(maxDelay);
        if (cap >= 0) calculated = Math.min(calculated, cap);
    }

    return Math.max(0, Math.round(calculated));
}

export function handleDelayDirect(engine, ms, context = {}) {
    const duration = parseFloat(ms);
    if (Number.isNaN(duration) || duration < 0) {
        const err = new EUIXStructuredError({
            message: `<delay> duration must be a non-negative number (received: ${ms})`,
            code: "VALIDATION_ERROR",
            originatingAction: "DELAY",
            component: context._componentName,
        });
        if (engine && typeof engine.reportError === "function") engine.reportError(err, "Delay Validation");
        throw err;
    }

    const signal = context._cancellationSignal;
    if (signal && signal.isCancelled) {
        signal.throwIfCancelled();
    }

    const scopeId = genId("delay_");
    logScope(engine, context, "DELAY_START", { scopeId, durationMs: duration, component: context._componentName });

    return new Promise((resolve, reject) => {
        let timerId = null;
        let unsubscribe = null;

        const cleanup = () => {
            if (timerId) clearTimeout(timerId);
            if (unsubscribe) unsubscribe();
        };

        if (signal) {
            unsubscribe = signal.onCancel((reason) => {
                cleanup();
                logScope(engine, context, "DELAY_CANCELLED", { scopeId, reason });
                reject(reason || new EUIXStructuredError({ message: "Delay was cancelled", code: "ACTION_CANCELLED" }));
            });
        }

        timerId = setTimeout(() => {
            cleanup();
            logScope(engine, context, "DELAY_COMPLETED", { scopeId, durationMs: duration });
            resolve(true);
        }, duration);
    });
}

export const EUIXResiliencePlugin = {
    name: "EUIXResiliencePlugin",
    install(engineClass) {
        engineClass.EUIXCancellationController = EUIXCancellationController;

        // Register DELAY / WAIT / SLEEP Action Handler
        engineClass.registerAction("DELAY", async function (actionNode, context) {
            const msAttr =
                actionNode.getAttribute("ms") ||
                actionNode.getAttribute("delay") ||
                actionNode.getAttribute("for") ||
                this.getChild(actionNode, "ms")?.textContent.trim() ||
                this.getChild(actionNode, "delay")?.textContent.trim();
            const interpolatedMs = this.interpolate(msAttr || "0", context);
            return handleDelayDirect(this, interpolatedMs, context);
        });
        engineClass.registerAction("WAIT", async function (actionNode, context) {
            return this._handleActionInternal(
                {
                    ...actionNode,
                    getAttribute: (attr) => (attr === "action" ? "DELAY" : actionNode.getAttribute(attr)),
                },
                context,
            );
        });
        engineClass.registerAction("SLEEP", async function (actionNode, context) {
            return this._handleActionInternal(
                {
                    ...actionNode,
                    getAttribute: (attr) => (attr === "action" ? "DELAY" : actionNode.getAttribute(attr)),
                },
                context,
            );
        });

        // Register TIMEOUT Action Handler
        engineClass.registerAction("TIMEOUT", async function (actionNode, context) {
            const msAttr =
                actionNode.getAttribute("ms") ||
                actionNode.getAttribute("timeout") ||
                actionNode.getAttribute("duration") ||
                this.getChild(actionNode, "ms")?.textContent.trim() ||
                this.getChild(actionNode, "timeout")?.textContent.trim();
            const interpolatedMs = this.interpolate(msAttr || "0", context);
            const duration = parseFloat(interpolatedMs);

            if (Number.isNaN(duration) || duration <= 0) {
                const err = new EUIXStructuredError({
                    message: `<timeout> duration must be a positive number (received: ${msAttr})`,
                    code: "VALIDATION_ERROR",
                    originatingAction: "TIMEOUT",
                    component: context._componentName,
                });
                this.reportError(err, "Timeout Validation");
                throw err;
            }

            const parentSignal = context._cancellationSignal || null;
            if (parentSignal && parentSignal.isCancelled) {
                parentSignal.throwIfCancelled();
            }

            const controller = new EUIXCancellationController(parentSignal);
            const timeoutContext = {
                ...context,
                _cancellationSignal: controller.signal,
            };

            const customMsg =
                actionNode.getAttribute("message") ||
                actionNode.getAttribute("msg") ||
                this.getChild(actionNode, "message")?.textContent.trim();
            const interpolatedMsg = customMsg
                ? this.interpolate(customMsg, context)
                : `Execution timed out after ${duration}ms`;

            const scopeId = genId("timeout_");
            const startTime = getNow();
            logScope(this, context, "TIMEOUT_START", {
                scopeId,
                timeoutMs: duration,
                component: context._componentName,
            });

            const timeoutError = new EUIXStructuredError({
                message: interpolatedMsg,
                code: "TIMEOUT_ERROR",
                originatingAction: actionNode.getAttribute("action") || "TIMEOUT",
                component: context._componentName,
            });
            timeoutError.timeoutMs = duration;
            timeoutError.cancelled = true;

            const childActions = Array.from(actionNode.childNodes || actionNode.children || []).filter((c) => {
                const tag =
                    c.nodeType === 1 && c.tagName ? c.tagName.toLowerCase() : c.tagName ? c.tagName.toLowerCase() : "";
                return tag && !["message", "msg", "ms", "duration"].includes(tag);
            });

            let timerId = null;
            const timerPromise = new Promise((_, reject) => {
                timerId = setTimeout(() => {
                    const elapsedMs = getNow() - startTime;
                    timeoutError.elapsedMs = Math.round(elapsedMs);
                    controller.cancel(timeoutError);
                    logScope(this, context, "TIMEOUT_EXCEEDED", {
                        scopeId,
                        timeoutMs: duration,
                        elapsedMs: timeoutError.elapsedMs,
                    });
                    reject(timeoutError);
                }, duration);
            });

            const actionPromise = (async () => {
                let result;
                if (childActions.length === 0) {
                    const actAttr = actionNode.getAttribute("action");
                    if (actAttr && actAttr !== "TIMEOUT") {
                        result = await this._handleActionInternal(actionNode, timeoutContext);
                    }
                } else {
                    for (const childNode of childActions) {
                        result = await this._handleActionInternal(childNode, timeoutContext);
                    }
                }
                return result;
            })();

            try {
                const result = await Promise.race([actionPromise, timerPromise]);
                clearTimeout(timerId);
                logScope(this, context, "TIMEOUT_COMPLETED", {
                    scopeId,
                    durationMs: getNow() - startTime,
                });
                return result;
            } catch (err) {
                clearTimeout(timerId);
                throw err;
            }
        });

        // Register RETRY Action Handler
        engineClass.registerAction("RETRY", async function (actionNode, context) {
            const attemptsAttr =
                actionNode.getAttribute("attempts") ||
                actionNode.getAttribute("max_attempts") ||
                actionNode.getAttribute("count") ||
                this.getChild(actionNode, "attempts")?.textContent.trim();
            const attemptsStr = this.interpolate(attemptsAttr || "3", context);
            const maxAttempts = parseInt(attemptsStr, 10);

            if (Number.isNaN(maxAttempts) || maxAttempts <= 0) {
                const err = new EUIXStructuredError({
                    message: `<retry> attempts must be a positive integer (received: ${attemptsAttr})`,
                    code: "VALIDATION_ERROR",
                    originatingAction: "RETRY",
                    component: context._componentName,
                });
                this.reportError(err, "Retry Validation");
                throw err;
            }

            const delayAttr =
                actionNode.getAttribute("delay") ||
                actionNode.getAttribute("delay_ms") ||
                actionNode.getAttribute("ms") ||
                this.getChild(actionNode, "delay")?.textContent.trim();
            const baseDelay = parseFloat(this.interpolate(delayAttr || "0", context));
            if (Number.isNaN(baseDelay) || baseDelay < 0) {
                const err = new EUIXStructuredError({
                    message: `<retry> delay must be a non-negative number (received: ${delayAttr})`,
                    code: "VALIDATION_ERROR",
                    originatingAction: "RETRY",
                    component: context._componentName,
                });
                this.reportError(err, "Retry Validation");
                throw err;
            }

            const backoff = actionNode.getAttribute("backoff") || actionNode.getAttribute("strategy") || "fixed";
            const validBackoff = ["fixed", "linear", "exponential", "exp", "jitter"].includes(
                String(backoff).toLowerCase(),
            );
            if (!validBackoff) {
                const err = new EUIXStructuredError({
                    message: `<retry> invalid backoff strategy "${backoff}". Supported strategies: fixed, linear, exponential, jitter`,
                    code: "VALIDATION_ERROR",
                    originatingAction: "RETRY",
                    component: context._componentName,
                });
                this.reportError(err, "Retry Validation");
                throw err;
            }

            const maxDelayAttr = actionNode.getAttribute("max_delay") || actionNode.getAttribute("max_delay_ms");
            const maxDelay = maxDelayAttr ? parseFloat(this.interpolate(maxDelayAttr, context)) : null;
            if (maxDelay !== null && (Number.isNaN(maxDelay) || maxDelay < baseDelay)) {
                const err = new EUIXStructuredError({
                    message: `<retry> max_delay must be a number greater than or equal to initial delay (received: ${maxDelayAttr})`,
                    code: "VALIDATION_ERROR",
                    originatingAction: "RETRY",
                    component: context._componentName,
                });
                this.reportError(err, "Retry Validation");
                throw err;
            }

            const onErrorAttr =
                actionNode.getAttribute("on_error") ||
                actionNode.getAttribute("when") ||
                actionNode.getAttribute("filter");
            const errorFilters = onErrorAttr
                ? onErrorAttr
                      .split(",")
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean)
                : null;

            const childActions = Array.from(actionNode.childNodes || actionNode.children || []).filter((c) => {
                const tag =
                    c.nodeType === 1 && c.tagName ? c.tagName.toLowerCase() : c.tagName ? c.tagName.toLowerCase() : "";
                return tag && !["delay", "ms", "attempts", "filter"].includes(tag);
            });

            const scopeId = genId("retry_");
            logScope(this, context, "RETRY_START", {
                scopeId,
                maxAttempts,
                baseDelay,
                backoff,
                component: context._componentName,
            });

            let lastError = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const parentSignal = context._cancellationSignal;
                if (parentSignal && parentSignal.isCancelled) {
                    parentSignal.throwIfCancelled();
                }

                const nextDelay =
                    attempt < maxAttempts ? calculateBackoffDelay(backoff, baseDelay, attempt, maxDelay) : 0;
                const isLast = attempt === maxAttempts;
                const retryInfo = {
                    attempt,
                    max_attempts: maxAttempts,
                    maxAttempts,
                    is_last: isLast,
                    isLast,
                    prev_error: lastError,
                    prevError: lastError,
                    next_delay: nextDelay,
                    nextDelay,
                };

                const retryContext = {
                    ...context,
                    retry: retryInfo,
                    $retry: retryInfo,
                };

                try {
                    let result;
                    for (const childNode of childActions) {
                        result = await this._handleActionInternal(childNode, retryContext);
                    }

                    logScope(this, context, "RETRY_SUCCESS", { scopeId, attempt, maxAttempts });
                    return result;
                } catch (rawErr) {
                    lastError = EUIXStructuredError.from(rawErr, {
                        originatingAction: actionNode.getAttribute("action") || "RETRY",
                        component: context._componentName,
                    });
                    lastError.attempt = attempt;
                    lastError.maxAttempts = maxAttempts;

                    if (attempt === maxAttempts) {
                        logScope(this, context, "RETRY_EXHAUSTED", { scopeId, attempt, error: lastError.toJSON() });
                        throw lastError;
                    }

                    if (errorFilters?.length) {
                        const codeMatch = errorFilters.includes(lastError.code.toUpperCase());
                        const statusMatch = lastError.status && errorFilters.includes(String(lastError.status));
                        const messageMatch = errorFilters.some((f) => lastError.message.toUpperCase().includes(f));
                        if (!codeMatch && !statusMatch && !messageMatch) {
                            logScope(this, context, "RETRY_FILTER_MISMATCH", {
                                scopeId,
                                attempt,
                                error: lastError.toJSON(),
                            });
                            throw lastError;
                        }
                    }

                    logScope(this, context, "RETRY_ATTEMPT_FAILED", {
                        scopeId,
                        attempt,
                        nextDelay,
                        error: lastError.toJSON(),
                    });

                    if (nextDelay) {
                        await handleDelayDirect(this, nextDelay, retryContext);
                    }
                }
            }

            throw lastError;
        });
    },
};

export default EUIXResiliencePlugin;
