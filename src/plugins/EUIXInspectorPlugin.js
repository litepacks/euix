/**
 * src/plugins/EUIXInspectorPlugin.js
 * EUIX Inspector & DevTools Plugin (@euix/inspector / @euix/devtools).
 * High-performance runtime introspection, element debugging, and stable E2E selector generator.
 */

import {
    buildComponentTree,
    createDebugSnapshot,
    getElementMetadata,
    registerElementMetadata,
} from "./inspector/metadata.js";
import { OverlayManager } from "./inspector/overlay.js";
import { InspectorPanel } from "./inspector/panel.js";
import { generateSelectors } from "./inspector/selectors.js";

export class EUIXInspector {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.options = {
            enabled: options.enabled !== false,
            shortcut: options.shortcut || "Alt+Shift+X",
            maxEvents: options.maxEvents || 100,
            testAttributes: options.testAttributes !== false,
            ...options,
        };

        this.enabled = false;
        this.overlay = null;
        this.panel = null;
        this.actionLogs = [];
        this.boundariesVisible = false;
        this._listeners = [];

        if (this.options.enabled) {
            this.init();
        }
    }

    init() {
        if (typeof document === "undefined") return;

        this.enabled = true;
        this.overlay = new OverlayManager();
        this.panel = new InspectorPanel(this);

        this.bindRuntimeHooks();
        this.bindEvents();
        this.exposeConsoleApi();

        if (this.engine) {
            this.engine.inspector = this;
            this.engine._devtools = this;
        }

        if (typeof window !== "undefined") {
            window.EUIX_INSPECTOR = this;
        }
    }

    bindRuntimeHooks() {
        if (!this.engine || !this.engine.hooks) return;

        // 1. Component Mount Hook
        this.engine.hooks.on("component:mount", (payload) => {
            if (payload.element) {
                registerElementMetadata(payload.element, {
                    component: payload.component,
                    instanceId: payload.instanceId,
                    props: payload.props,
                    localState: payload.localState,
                });
            }
        });

        // 2. Action Lifecycle Hooks
        this.engine.hooks.on("action:end", (payload) => {
            const time = new Date().toLocaleTimeString();
            const entry = {
                time,
                action: payload.action,
                duration: payload.duration || 0,
                status: payload.status,
                error: payload.error,
                info: payload.action,
            };
            this.actionLogs.push(entry);
            if (this.actionLogs.length > this.options.maxEvents) {
                this.actionLogs.shift();
            }
            if (this.panel && this.panel.isOpen && this.panel.activeTab === "actions") {
                this.panel.render();
            }
        });
    }

    bindEvents() {
        if (typeof document === "undefined") return;

        const isDevToolsElement = (target) => {
            if (!target || target === document.body || target === document.documentElement) return true;
            return Boolean(
                target.closest("#euix-inspector-hud") ||
                    target.closest("#euix-devtools-hud") ||
                    target.closest("#euix-inspector-panel") ||
                    target.closest("#euix-devtools-panel") ||
                    target.closest("#euix-inspector-tooltip") ||
                    target.closest("#euix-devtools-tooltip") ||
                    target.closest("#euix-inspector-boundaries") ||
                    target.closest("#euix-devtools-highlight") ||
                    target.id === "euix-inspector-highlight" ||
                    target.id === "euix-devtools-highlight",
            );
        };

        // 1. Mousemove Hover Highlight
        const onMouseMove = (e) => {
            if (!this.enabled) return;

            const target = e.target;
            if (isDevToolsElement(target)) {
                if (target === document.body || target === document.documentElement) {
                    this.overlay.hide();
                }
                return;
            }

            const meta = getElementMetadata(target, this.engine);
            this.overlay.highlight(target, meta);
        };

        // 2. Click to Select & Inspect
        const onClick = (e) => {
            if (!this.enabled) return;
            const target = e.target;
            if (isDevToolsElement(target)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            this.select(target);
        };

        // 3. Keyboard Shortcut Toggle (Alt+Shift+X or Alt+Shift+I or Escape)
        const onKeyDown = (e) => {
            const isAltShiftX = e.altKey && e.shiftKey && (e.key.toLowerCase() === "x" || e.key.toLowerCase() === "i");
            if (isAltShiftX) {
                e.preventDefault();
                this.toggle();
            } else if (e.key === "Escape" && (this.enabled || this.panel?.isOpen)) {
                if (this.panel?.isOpen) this.panel.toggle(false);
                else this.disable();
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKeyDown);

        this._listeners.push(
            () => document.removeEventListener("mousemove", onMouseMove),
            () => document.removeEventListener("click", onClick, true),
            () => document.removeEventListener("keydown", onKeyDown),
        );
    }

    exposeConsoleApi() {
        if (typeof window === "undefined") return;

        window.$state = this.engine ? this.engine._rawState : null;
        window.$engine = this.engine;

        const api = {
            inspect: (elOrSelector) => {
                const el = typeof elOrSelector === "string" ? document.querySelector(elOrSelector) : elOrSelector;
                if (!el) return null;
                const meta = getElementMetadata(el, this.engine);
                const selectors = generateSelectors(el, document);
                const snapshot = createDebugSnapshot(el, this.engine);
                this.select(el);
                return {
                    element: el,
                    ...meta,
                    selectors,
                    snapshot,
                };
            },
            componentOf: (elOrSelector) => {
                const el = typeof elOrSelector === "string" ? document.querySelector(elOrSelector) : elOrSelector;
                if (!el) return null;
                return getElementMetadata(el, this.engine)?.component || null;
            },
            snapshot: (elOrSelector) => {
                const el =
                    typeof elOrSelector === "string"
                        ? document.querySelector(elOrSelector)
                        : elOrSelector || document.body;
                return createDebugSnapshot(el, this.engine);
            },
            components: () => buildComponentTree(document.body),
            component: (name) => {
                const elements = Array.from(
                    document.querySelectorAll(`[data-euix-component="${name}"], [data-xui-component="${name}"]`),
                );
                return elements.map((el) => getElementMetadata(el, this.engine));
            },
            actions: () => [...this.actionLogs],
            routes: () => (this.engine?._router ? this.engine._router.inspect() : null),
            tree: () => buildComponentTree(document.body),
            enable: () => this.enable(),
            disable: () => this.disable(),
            toggle: () => this.toggle(),
            showBoundaries: () => this.showBoundaries(),
            hideBoundaries: () => this.hideBoundaries(),
        };

        window.$euix = api;
        window.EUIXDevTools = this;
    }

    enable() {
        this.enabled = true;
        if (this.panel) this.panel.updateHudDot(true);
        if (typeof window !== "undefined") {
            window.$state = this.engine ? this.engine._rawState : null;
            window.$engine = this.engine;
        }
    }

    disable() {
        this.enabled = false;
        if (this.overlay) this.overlay.hide();
        if (this.panel) {
            this.panel.updateHudDot(false);
            if (this.panel.isOpen) this.panel.toggle(false);
        }
    }

    toggle(force) {
        const next = typeof force === "boolean" ? force : !this.enabled;
        if (next) this.enable();
        else this.disable();
    }

    select(element) {
        if (!element) return;
        const meta = getElementMetadata(element, this.engine);
        if (this.overlay) {
            this.overlay.highlight(element, meta);
        }
        if (this.panel) {
            this.panel.selectElement(element);
            if (!this.panel.isOpen) {
                this.panel.toggle(true);
            }
        }
    }

    showBoundaries() {
        this.boundariesVisible = true;
        const components = [];
        const elements = Array.from(document.querySelectorAll("[data-euix-component], [data-xui-component]"));
        elements.forEach((el) => {
            const name = el.dataset.euixComponent || el.dataset.xuiComponent;
            components.push({ name, element: el });
        });
        if (this.overlay) {
            this.overlay.showBoundaries(components);
        }
    }

    hideBoundaries() {
        this.boundariesVisible = false;
        if (this.overlay) {
            this.overlay.hideBoundaries();
        }
    }

    toggleBoundaries() {
        if (this.boundariesVisible) this.hideBoundaries();
        else this.showBoundaries();
    }

    // DevTools backward compatibility methods
    logAction(type, details = {}) {
        const time = new Date().toLocaleTimeString();
        let info = "";
        if (type === "setState") {
            info = `${details.path} = ${typeof details.value === "object" ? JSON.stringify(details.value) : details.value}`;
        } else if (type === "MUTATE_STATE") {
            info = `${details.operation || "MUTATE"} on ${details.path || "state"}`;
        } else {
            info = details.path ? `${type} -> ${details.path}` : `${type}`;
        }
        const entry = { time, action: type, info, duration: 0, status: "success" };
        this.actionLogs.push(entry);
        if (this.actionLogs.length > this.options.maxEvents) this.actionLogs.shift();
        if (this.panel && this.panel.isOpen && this.panel.activeTab === "actions") {
            this.panel.render();
        }
    }

    logErrorScope(eventType, details = {}) {
        const time = new Date().toLocaleTimeString();
        let info = "";
        if (eventType === "TRY_ENTER") info = `Try scope entered [${details.scopeId}]`;
        else if (eventType === "TRY_SUCCESS")
            info = `Try scope completed (${details.duration ? details.duration.toFixed(1) : 0}ms)`;
        else if (eventType === "ACTION_ERROR")
            info = `Action error: [${details.error?.code}] ${details.error?.message}`;
        else if (eventType === "CATCH_ENTER") info = `Catch block entered (var: ${details.varName})`;
        else if (eventType === "ERROR_PROPAGATED")
            info = `Error propagated: [${details.error?.code}] ${details.error?.message}`;
        else info = `${eventType}`;

        const entry = {
            time,
            action: `TRY_CATCH:${eventType}`,
            info,
            duration: details.duration || 0,
            status: "error",
        };
        this.actionLogs.push(entry);
        if (this.actionLogs.length > this.options.maxEvents) this.actionLogs.shift();
        if (this.panel && this.panel.isOpen && this.panel.activeTab === "actions") {
            this.panel.render();
        }
    }

    togglePanel(force) {
        if (this.panel) this.panel.toggle(force);
    }

    destroy() {
        this.disable();
        this._listeners.forEach((fn) => fn());
        this._listeners = [];
        if (this.overlay) this.overlay.destroy();
        if (this.panel) this.panel.destroy();
    }
}

/**
 * Plugin definition and factory.
 */
export function inspector(options = {}) {
    return {
        name: "inspector",
        install(engineClass) {
            // Attach static inspector accessors
            engineClass.inspector = {
                enable: () => {
                    if (engineClass.instance?._devtools) engineClass.instance._devtools.enable();
                },
                disable: () => {
                    if (engineClass.instance?._devtools) engineClass.instance._devtools.disable();
                },
                toggle: () => {
                    if (engineClass.instance?._devtools) engineClass.instance._devtools.toggle();
                },
                showBoundaries: () => {
                    if (engineClass.instance?._devtools) engineClass.instance._devtools.showBoundaries();
                },
                hideBoundaries: () => {
                    if (engineClass.instance?._devtools) engineClass.instance._devtools.hideBoundaries();
                },
            };

            // Hook on instance mount
            const origMount = engineClass.mount;
            engineClass.mount = function (xml, container, mountOptions = {}) {
                const engine = origMount.call(this, xml, container, mountOptions);
                if (options.enabled !== false) {
                    engine._devtools = new EUIXInspector(engine, options);
                }
                return engine;
            };
        },
    };
}

export const EUIXInspectorPlugin = inspector();

export default inspector;
