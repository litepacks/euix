/**
 * src/EUIXDevTools.js
 * Comprehensive DevTools & Runtime Inspector Suite for EUIX Engine.
 */

import { EUIXInspector, EUIXInspectorPlugin, inspector } from "./plugins/EUIXInspectorPlugin.js";
import {
    buildComponentTree,
    createDebugSnapshot,
    getElementMetadata,
    maskSensitive,
    registerElementMetadata,
} from "./plugins/inspector/metadata.js";
import { OverlayManager } from "./plugins/inspector/overlay.js";
import { InspectorPanel } from "./plugins/inspector/panel.js";
import { euix, getByAction, getByComponent, getByTestId } from "./plugins/inspector/playwright.js";
import { checkUniqueness, generateSelectors } from "./plugins/inspector/selectors.js";

export class EUIXDevTools extends EUIXInspector {
    constructor(engine, options = {}) {
        super(engine, { enabled: true, maxEvents: options.maxEvents || 30, ...options });
        this.enabled = Boolean(options.autoOpen);
    }

    static init(engine, options = {}) {
        if (!engine) {
            if (typeof window !== "undefined" && window.EUIXEngine && window.EUIXEngine.instance) {
                engine = window.EUIXEngine.instance;
            } else {
                return null;
            }
        }
        if (!engine._devtools) {
            engine._devtools = new EUIXDevTools(engine, options);
        }
        return engine._devtools;
    }

    static open() {
        if (typeof window !== "undefined" && window.EUIX_INSPECTOR) {
            window.EUIX_INSPECTOR.enable();
            if (window.EUIX_INSPECTOR.panel) window.EUIX_INSPECTOR.panel.toggle(true);
        }
    }

    static close() {
        if (typeof window !== "undefined" && window.EUIX_INSPECTOR) {
            window.EUIX_INSPECTOR.disable();
        }
    }

    static toggle() {
        if (typeof window !== "undefined" && window.EUIX_INSPECTOR) {
            window.EUIX_INSPECTOR.toggle();
        }
    }

    // Direct property accessors for backward compatibility
    get highlightEl() {
        return this.overlay ? this.overlay.highlightEl : null;
    }

    get tooltipEl() {
        return this.overlay ? this.overlay.tooltipEl : null;
    }

    get hudEl() {
        return this.panel ? this.panel.hudEl : null;
    }

    get panelEl() {
        return this.panel ? this.panel.panelEl : null;
    }

    get panelOpen() {
        return this.panel ? this.panel.isOpen : false;
    }

    set panelOpen(val) {
        if (this.panel) this.panel.isOpen = val;
    }

    get activeTab() {
        return this.panel ? this.panel.activeTab : "state";
    }

    set activeTab(val) {
        if (this.panel) this.panel.activeTab = val;
    }

    get logs() {
        return this.actionLogs.map((l) => ({
            time: l.time,
            type: l.action,
            info: l.info || l.action,
        }));
    }

    set logs(val) {
        this.actionLogs = val.map((l) => ({
            time: l.time,
            action: l.type || l.action,
            type: l.type || l.action,
            info: l.info || "",
            status: "success",
        }));
    }

    get stateFilterQuery() {
        return this.panel ? this.panel.stateFilterQuery : "";
    }

    set stateFilterQuery(val) {
        if (this.panel) this.panel.stateFilterQuery = val;
    }

    get flashUpdates() {
        return this.highlightUpdates;
    }

    set flashUpdates(val) {
        this.highlightUpdates = val;
    }

    renderPanel() {
        if (this.panel) this.panel.render();
    }

    inspectElement(boxEl, targetEl, stateKey, bindKind, refName, compName) {
        const el = targetEl || boxEl;
        if (!el) return;
        this.select(el);
    }

    hideHighlight() {
        if (this.overlay) this.overlay.hide();
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

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

        const entry = {
            time,
            action: type,
            info,
            duration: details.duration || 0,
            status: details.status || "success",
        };
        this.actionLogs.push(entry);
        if (this.actionLogs.length > (this.options.maxEvents || 30)) {
            this.actionLogs.shift();
        }

        if (this.panel && this.panel.isOpen) {
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
            info = `Action error in try scope: [${details.error?.code}] ${details.error?.message}`;
        else if (eventType === "CATCH_ENTER") info = `Entering catch block (var: ${details.varName})`;
        else if (eventType === "CATCH_SUCCESS") info = `Error caught and handled successfully`;
        else if (eventType === "FINALLY_ENTER") info = `Entering finally block`;
        else if (eventType === "FINALLY_COMPLETE") info = `Finally block completed`;
        else if (eventType === "ERROR_PROPAGATED")
            info = `Error propagated: [${details.error?.code}] ${details.error?.message}`;
        else info = `${eventType}`;

        const entry = {
            time,
            action: `TRY_CATCH:${eventType}`,
            type: `TRY_CATCH:${eventType}`,
            info,
            duration: details.duration || 0,
            status: "error",
        };
        this.actionLogs.push(entry);
        if (this.actionLogs.length > (this.options.maxEvents || 30)) {
            this.actionLogs.shift();
        }

        if (this.panel && this.panel.isOpen) {
            this.panel.render();
        }
    }
}

// Auto-enable DevTools if data-euix-devtools script attribute is present
if (typeof document !== "undefined") {
    const autoInitDevTools = () => {
        const script = document.querySelector("script[data-euix-devtools]");
        if (script && window.EUIXEngine && window.EUIXEngine.instance) {
            const devAttr = script.getAttribute("data-euix-devtools");
            const autoOpen = devAttr === "open" || devAttr === "true";
            const flashAttr =
                script.getAttribute("data-euix-highlight-updates") === "true" ||
                script.getAttribute("data-euix-flash") === "true";
            const devtools = EUIXDevTools.init(window.EUIXEngine.instance, {
                highlightUpdates: flashAttr,
            });
            if (devtools && autoOpen) devtools.toggle(true);
        }
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(autoInitDevTools, 50);
    } else {
        document.addEventListener("DOMContentLoaded", autoInitDevTools);
    }
}

import { computeStateDiff, EUIXStateHistoryManager } from "./plugins/inspector/history.js";

export {
    buildComponentTree,
    checkUniqueness,
    computeStateDiff,
    createDebugSnapshot,
    EUIXInspector,
    EUIXInspectorPlugin,
    EUIXStateHistoryManager,
    euix,
    generateSelectors,
    getByAction,
    getByComponent,
    getByTestId,
    getElementMetadata,
    InspectorPanel,
    inspector,
    maskSensitive,
    OverlayManager,
    registerElementMetadata,
};

export default EUIXDevTools;
