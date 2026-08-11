/**
 * EUIXDialogPlugin.js
 * Modal Dialog Component Plugin for EUIX Engine.
 * Renders declarative <dialog bind="..." show="..." title="..."> XML modal overlay containers.
 */

export const EUIXDialogPlugin = {
    name: "dialog",
    install(engineClass) {
        engineClass.prototype.renderDialog = function(xmlNode, context = {}) {
            const rawBind = xmlNode.getAttribute("bind") || xmlNode.getAttribute("show") || xmlNode.getAttribute("open") || xmlNode.getAttribute("is_open") || "";
            const bindPath = this.parseBindPath(rawBind);
            let open = bindPath ? this.isTruthy(this.getState(bindPath)) : false;

            const closeOnBackdrop = xmlNode.getAttribute("close_on_backdrop") !== "false";
            const summaryNode = this.getChild(xmlNode, "summary");
            const actionsNode = this.getChild(xmlNode, "actions");
            const titleAttr = xmlNode.getAttribute("title") || "";
            const title = summaryNode
                ? this.interpolate(summaryNode.textContent.trim(), context)
                : this.interpolate(titleAttr, context) || "Dialog";

            const close = () => {
                if (bindPath) this.setState(bindPath, false);
            };

            const containerNode = document.createElement("div");
            containerNode.className = "euix-dialog-container";
            containerNode.style.display = "contents";

            const backdrop = document.createElement("div");
            const extraClass = xmlNode.getAttribute("class") || "";
            backdrop.className = xmlNode.getAttribute("backdrop_class") || ["dialog-backdrop fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4", extraClass].filter(Boolean).join(" ");
            backdrop.tabIndex = -1;
            backdrop.setAttribute("role", "presentation");

            backdrop.onclick = (e) => {
                if (closeOnBackdrop && e.target === backdrop) close();
            };
            backdrop.onkeydown = (e) => {
                if (e.key === "Escape") close();
            };

            const panel = document.createElement("div");
            panel.className = xmlNode.getAttribute("panel_class") || "dialog-panel bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 max-w-md w-full overflow-hidden";
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-modal", "true");
            panel.setAttribute("aria-label", title);

            const header = document.createElement("div");
            header.className = xmlNode.getAttribute("header_class") || "dialog-header p-4 border-b border-slate-800 flex items-center justify-between";

            const titleEl = document.createElement("h3");
            titleEl.className = "dialog-title text-base font-bold text-white";
            titleEl.textContent = title;

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "dialog-close text-slate-400 hover:text-white text-lg font-bold px-2 py-1 rounded-md cursor-pointer";
            closeBtn.setAttribute("aria-label", "Kapat");
            closeBtn.textContent = "×";
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                close();
            };

            header.appendChild(titleEl);
            header.appendChild(closeBtn);

            const body = document.createElement("div");
            body.className = xmlNode.getAttribute("body_class") || "dialog-body p-5";
            Array.from(xmlNode.childNodes).forEach(child => {
                if (child.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1) &&
                    ["summary", "actions"].includes(child.tagName.toLowerCase())) {
                    return;
                }
                const el = this.createHTMLElement(child, context);
                if (el) body.appendChild(el);
            });

            panel.appendChild(header);
            panel.appendChild(body);

            if (actionsNode) {
                const footer = document.createElement("div");
                footer.className = xmlNode.getAttribute("footer_class") || "dialog-actions p-4 border-t border-slate-800 flex items-center justify-end gap-2";
                Array.from(actionsNode.childNodes).forEach(child => {
                    const el = this.createHTMLElement(child, context);
                    if (el) footer.appendChild(el);
                });
                panel.appendChild(footer);
            }

            panel.onclick = (e) => e.stopPropagation();
            backdrop.appendChild(panel);

            const updateDialogState = (isOpen) => {
                open = isOpen;
                if (open) {
                    if (!containerNode.contains(backdrop)) {
                        containerNode.appendChild(backdrop);
                        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
                            window.requestAnimationFrame(() => backdrop.focus());
                        } else {
                            setTimeout(() => backdrop.focus(), 0);
                        }
                    }
                } else {
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
    }
};

export default EUIXDialogPlugin;
