/**
 * EUIXDialogPlugin.js
 * Modal Dialog Component Plugin for EUIX Engine with Automated WAI-ARIA Focus Trap and A11y.
 * Renders declarative <dialog bind="..." show="..." title="..."> XML modal overlay containers.
 */

import { createFocusTrap } from "./a11y/focusTrap.js";

let dialogUidCounter = 0;

export const EUIXDialogPlugin = {
    name: "dialog",
    install(engineClass) {
        engineClass.prototype.renderDialog = function (xmlNode, context = {}) {
            const rawBind =
                xmlNode.getAttribute("bind") ||
                xmlNode.getAttribute("show") ||
                xmlNode.getAttribute("open") ||
                xmlNode.getAttribute("is_open") ||
                "";
            const interpolatedBind = this.interpolate(rawBind, context);
            let bindPath = this.parseBindPath(interpolatedBind);
            if (!bindPath || bindPath === "true" || bindPath === "false" || !Number.isNaN(Number(bindPath))) {
                bindPath = this.parseBindPath(rawBind);
            }

            let open = bindPath ? this.isTruthy(this.getState(bindPath)) : false;

            const closeOnBackdrop = xmlNode.getAttribute("close_on_backdrop") !== "false";
            const lockScroll = xmlNode.getAttribute("lock_scroll") !== "false";
            const initialFocus = xmlNode.getAttribute("initial_focus") || "";
            const dialogRole = xmlNode.getAttribute("role") || "dialog";
            const summaryNode = this.getChild(xmlNode, "summary");
            const actionsNode = this.getChild(xmlNode, "actions");
            const descriptionNode = this.getChild(xmlNode, "description");
            const titleAttr = xmlNode.getAttribute("title") || "";
            const title = summaryNode
                ? this.interpolate(summaryNode.textContent.trim(), context)
                : this.interpolate(titleAttr, context) || "Dialog";

            const uid = ++dialogUidCounter;
            const titleId = `euix-dialog-title-${uid}`;
            const descId = `euix-dialog-desc-${uid}`;

            let previousActiveElement = null;
            let focusTrap = null;
            let originalBodyOverflow = "";

            const close = () => {
                if (bindPath) {
                    const currentVal = this.getState(bindPath);
                    if (typeof currentVal === "string") {
                        this.setState(bindPath, "false");
                    } else {
                        this.setState(bindPath, false);
                    }
                }
            };

            const containerNode = document.createElement("div");
            containerNode.className = "euix-dialog-container";
            containerNode.style.display = "contents";

            const backdrop = document.createElement("div");
            const extraClass = xmlNode.getAttribute("class") || "";
            backdrop.className =
                xmlNode.getAttribute("backdrop_class") ||
                [
                    "dialog-backdrop fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4",
                    extraClass,
                ]
                    .filter(Boolean)
                    .join(" ");
            backdrop.tabIndex = -1;
            backdrop.setAttribute("role", "presentation");

            backdrop.onclick = (e) => {
                if (closeOnBackdrop && e.target === backdrop) close();
            };
            backdrop.onkeydown = (e) => {
                if (e.key === "Escape") close();
            };

            const panel = document.createElement("div");
            panel.className =
                xmlNode.getAttribute("panel_class") ||
                "dialog-panel bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 max-w-md w-full overflow-hidden";
            panel.setAttribute("role", dialogRole);
            panel.setAttribute("aria-modal", "true");
            panel.setAttribute("aria-labelledby", titleId);
            panel.setAttribute("tabindex", "-1");

            const header = document.createElement("div");
            header.className =
                xmlNode.getAttribute("header_class") ||
                "dialog-header p-4 border-b border-slate-800 flex items-center justify-between";

            const titleEl = document.createElement("h3");
            titleEl.id = titleId;
            titleEl.className = "dialog-title text-base font-bold text-white";
            titleEl.textContent = title;

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className =
                "dialog-close text-slate-400 hover:text-white text-lg font-bold px-2 py-1 rounded-md cursor-pointer";
            closeBtn.setAttribute("aria-label", xmlNode.getAttribute("close_label") || "Close");
            closeBtn.textContent = "×";
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                close();
            };

            header.appendChild(titleEl);
            header.appendChild(closeBtn);

            const body = document.createElement("div");
            body.className = xmlNode.getAttribute("body_class") || "dialog-body p-5";

            if (descriptionNode) {
                body.id = descId;
                panel.setAttribute("aria-describedby", descId);
            }

            const bNodes = xmlNode.childNodes;
            const bLen = bNodes ? bNodes.length : 0;
            for (let i = 0; i < bLen; i++) {
                const child = bNodes[i];
                if (child.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)) {
                    const tag = child.tagName.toLowerCase();
                    if (tag === "summary" || tag === "actions") {
                        continue;
                    }
                }
                const el = this.createHTMLElement(child, context);
                if (el) body.appendChild(el);
            }

            panel.appendChild(header);
            panel.appendChild(body);

            if (actionsNode) {
                const footer = document.createElement("div");
                footer.className =
                    xmlNode.getAttribute("footer_class") ||
                    "dialog-actions p-4 border-t border-slate-800 flex items-center justify-end gap-2";
                const aNodes = actionsNode.childNodes;
                const aLen = aNodes ? aNodes.length : 0;
                for (let i = 0; i < aLen; i++) {
                    const el = this.createHTMLElement(aNodes[i], context);
                    if (el) footer.appendChild(el);
                }
                panel.appendChild(footer);
            }

            panel.onclick = (e) => e.stopPropagation();
            backdrop.appendChild(panel);

            // Focus Trap Instance
            focusTrap = createFocusTrap(panel, {
                initialFocus: initialFocus || closeBtn,
                onEscape: () => close(),
            });

            const updateDialogState = (isOpen) => {
                open = isOpen;
                if (open) {
                    previousActiveElement = document.activeElement;
                    if (!containerNode.contains(backdrop)) {
                        containerNode.appendChild(backdrop);
                    }

                    // Body scroll lock
                    if (lockScroll && typeof document !== "undefined" && document.body) {
                        originalBodyOverflow = document.body.style.overflow;
                        document.body.style.overflow = "hidden";
                    }

                    // Activate Focus Trap
                    focusTrap.activate();
                } else {
                    // Deactivate Focus Trap & restore focus
                    if (focusTrap.isActive()) {
                        focusTrap.deactivate();
                    }

                    // Restore body scroll
                    if (lockScroll && typeof document !== "undefined" && document.body) {
                        document.body.style.overflow = originalBodyOverflow;
                    }

                    if (containerNode.contains(backdrop)) {
                        containerNode.removeChild(backdrop);
                    }
                }
            };

            updateDialogState(open);

            if (bindPath) {
                this.registerBinding(bindPath, containerNode, "dialog", (val) => {
                    updateDialogState(this.isTruthy(val));
                });
            }

            return containerNode;
        };
    },
};

export default EUIXDialogPlugin;
