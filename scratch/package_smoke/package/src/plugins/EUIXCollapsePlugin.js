/**
 * EUIXCollapsePlugin.js
 * Accordion & Collapsible UI Component Plugin for EUIX Engine.
 * Renders declarative <collapse bind="..." title="..."> XML layout containers.
 */

export const EUIXCollapsePlugin = {
    name: "collapse",
    install(engineClass) {
        engineClass.prototype.renderCollapse = function(xmlNode, context = {}) {
            const rawBind = xmlNode.getAttribute("bind") || "";
            const interpolatedBind = this.interpolate(rawBind, context);
            const bindPath = this.parseBindPath(interpolatedBind);
            let open = bindPath ? (this.getState(bindPath) !== undefined ? this.isTruthy(this.getState(bindPath)) : true) : true;

            const summaryNode = this.getChild(xmlNode, "summary");
            const titleAttr = xmlNode.getAttribute("title") || "";
            const titleTemplate = summaryNode ? summaryNode.textContent.trim() : titleAttr;

            const root = document.createElement("div");
            const extraClass = xmlNode.getAttribute("class") || "";

            const header = document.createElement("button");
            header.type = "button";
            header.className = xmlNode.getAttribute("header_class") || "euix-collapse-header";

            const chevron = document.createElement("span");
            chevron.className = "euix-collapse-chevron";

            const label = document.createElement("span");
            label.className = "euix-collapse-title";

            const updateTitle = () => {
                label.textContent = this.interpolate(titleTemplate, context) || "Detay";
            };
            updateTitle();

            const titlePlaceholders = (titleTemplate.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1).trim());
            titlePlaceholders.forEach(expr => {
                const cleanKey = expr.replace(/^(?:parent\.)?data\./, "").split('.')[0];
                if (cleanKey) {
                    this.watch(cleanKey, updateTitle);
                }
            });

            header.appendChild(chevron);
            header.appendChild(label);

            const body = document.createElement("div");
            body.className = xmlNode.getAttribute("body_class") || "euix-collapse-body";

            const renderBodyChildren = () => {
                body.innerHTML = "";
                Array.from(xmlNode.childNodes).forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "summary") return;
                    const el = this.createHTMLElement(child, context);
                    if (el) body.appendChild(el);
                });
            };

            const updateCollapseState = (isOpen) => {
                open = isOpen;
                root.className = ["euix-collapse", open ? "is-open" : "is-closed", extraClass].filter(Boolean).join(" ");
                header.setAttribute("aria-expanded", open ? "true" : "false");
                chevron.textContent = open ? "▼" : "▶";
                if (open) {
                    if (!root.contains(body)) {
                        renderBodyChildren();
                        root.appendChild(body);
                    }
                } else {
                    if (root.contains(body)) root.removeChild(body);
                }
            };

            updateCollapseState(open);

            if (bindPath) {
                header.onclick = () => {
                    const next = this.isTruthy(this.getState(bindPath)) ? "false" : "true";
                    this.setState(bindPath, next);
                };
                this.registerBinding(bindPath, root, "collapse", (val) => {
                    updateCollapseState(this.isTruthy(val));
                });
            }

            root.appendChild(header);
            if (open) root.appendChild(body);

            return root;
        };
    }
};

export default EUIXCollapsePlugin;
