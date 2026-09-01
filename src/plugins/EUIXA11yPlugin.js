/**
 * src/plugins/EUIXA11yPlugin.js
 * Accessibility (A11y) & Automated WAI-ARIA Focus Management Plugin for EUIX Engine.
 */

import { announce, getOrCreateAnnouncer, setupRovingTabIndex } from "./a11y/announcer.js";
import { createFocusTrap, FOCUSABLE_SELECTOR, getFocusableElements } from "./a11y/focusTrap.js";

export { announce, createFocusTrap, FOCUSABLE_SELECTOR, getFocusableElements, setupRovingTabIndex };

export const EUIXA11yPlugin = {
    name: "a11y",
    install(engineClass) {
        // Attach a11y helpers to engineClass prototype
        engineClass.prototype.announce = function (message, priority = "polite") {
            const doc = this.container?.ownerDocument || (typeof document !== "undefined" ? document : null);
            announce(message, priority, doc);
        };

        engineClass.prototype.createFocusTrap = (element, options = {}) => createFocusTrap(element, options);

        // Register declarative ANNOUNCE action
        if (typeof engineClass.registerAction === "function") {
            engineClass.registerAction("ANNOUNCE", function (actionNode, context = {}) {
                const messageAttr = actionNode.getAttribute ? actionNode.getAttribute("message") : null;
                const messageText = actionNode.textContent ? actionNode.textContent.trim() : "";
                const priority = (actionNode.getAttribute ? actionNode.getAttribute("priority") : null) || "polite";

                const message = this.interpolate(messageAttr || messageText, context);
                if (message) {
                    this.announce(message, priority);
                }
                return true;
            });
        }

        // Render <live_region> tag
        engineClass.prototype.renderLiveRegion = function (xmlNode, context = {}) {
            const doc = this.container?.ownerDocument || (typeof document !== "undefined" ? document : null);
            if (!doc) return null;

            const priority = xmlNode.getAttribute("priority") || xmlNode.getAttribute("aria-live") || "polite";
            const role = xmlNode.getAttribute("role") || (priority === "assertive" ? "alert" : "status");
            const rawBind = xmlNode.getAttribute("bind") || "";
            const bindPath = this.parseBindPath(this.interpolate(rawBind, context) || rawBind);

            const el = doc.createElement("div");
            el.setAttribute("aria-live", priority);
            el.setAttribute("aria-atomic", "true");
            el.setAttribute("role", role);

            const isHidden = xmlNode.getAttribute("hidden") !== "false";
            if (isHidden) {
                el.style.cssText =
                    "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;";
            } else {
                if (xmlNode.getAttribute("class"))
                    el.className = this.interpolate(xmlNode.getAttribute("class"), context);
            }

            const updateContent = (val) => {
                el.textContent = val !== undefined && val !== null ? String(val) : "";
            };

            if (bindPath) {
                const initialVal = this.getState(bindPath);
                updateContent(initialVal);
                this.registerBinding(bindPath, el, "live_region", updateContent);
            } else {
                const initialText = xmlNode.textContent ? xmlNode.textContent.trim() : "";
                updateContent(this.interpolate(initialText, context));
            }

            return el;
        };
    },
};

export default EUIXA11yPlugin;
