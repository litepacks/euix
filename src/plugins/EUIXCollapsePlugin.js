/**
 * EUIXCollapsePlugin.js
 * Accordion & Collapsible UI Component Plugin for EUIX Engine with full WAI-ARIA Accessibility.
 * Renders declarative <collapse bind="..." title="..."> XML layout containers.
 */

let collapseUidCounter = 0;

export const EUIXCollapsePlugin = {
    name: "collapse",
    install(engineClass) {
        engineClass.prototype.renderCollapse = function (xmlNode, context = {}) {
            const rawBind = xmlNode.getAttribute("bind") || "";
            const interpolatedBind = this.interpolate(rawBind, context);
            const bindPath = this.parseBindPath(interpolatedBind);
            let open = bindPath
                ? this.getState(bindPath) !== undefined
                    ? this.isTruthy(this.getState(bindPath))
                    : true
                : true;

            const group = xmlNode.getAttribute("group") || xmlNode.getAttribute("name") || "";
            const summaryNode = this.getChild(xmlNode, "summary");
            const titleAttr = xmlNode.getAttribute("title") || "";
            const titleTemplate = summaryNode ? summaryNode.textContent.trim() : titleAttr;

            const uid = ++collapseUidCounter;
            const headerId = `euix-collapse-header-${uid}`;
            const bodyId = `euix-collapse-body-${uid}`;

            const root = document.createElement("div");
            const extraClass = xmlNode.getAttribute("class") || "";
            if (group) root.setAttribute("data-euix-collapse-group", group);

            const header = document.createElement("button");
            header.type = "button";
            header.id = headerId;
            header.className = xmlNode.getAttribute("header_class") || "euix-collapse-header";
            header.setAttribute("aria-expanded", open ? "true" : "false");
            header.setAttribute("aria-controls", bodyId);

            const chevron = document.createElement("span");
            chevron.className = "euix-collapse-chevron";
            chevron.setAttribute("aria-hidden", "true");

            const label = document.createElement("span");
            label.className = "euix-collapse-title";

            const updateTitle = () => {
                label.textContent = this.interpolate(titleTemplate, context) || "Detay";
            };
            updateTitle();

            const titlePlaceholders = (titleTemplate.match(/\{([^}]+)\}/g) || []).map((m) => m.slice(1, -1).trim());
            titlePlaceholders.forEach((expr) => {
                const cleanKey = expr.replace(/^(?:parent\.)?data\./, "").split(".")[0];
                if (cleanKey) {
                    this.watch(cleanKey, updateTitle);
                }
            });

            header.appendChild(chevron);
            header.appendChild(label);

            const body = document.createElement("div");
            body.id = bodyId;
            body.className = xmlNode.getAttribute("body_class") || "euix-collapse-body";
            body.setAttribute("role", "region");
            body.setAttribute("aria-labelledby", headerId);

            const renderBodyChildren = () => {
                body.innerHTML = "";
                const chNodes = xmlNode.childNodes;
                const chLen = chNodes ? chNodes.length : 0;
                for (let i = 0; i < chLen; i++) {
                    const child = chNodes[i];
                    if (
                        child.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1) &&
                        child.tagName.toLowerCase() === "summary"
                    )
                        continue;
                    const el = this.createHTMLElement(child, context);
                    if (el) body.appendChild(el);
                }
            };

            const updateCollapseState = (isOpen) => {
                open = isOpen;
                root.className = ["euix-collapse", open ? "is-open" : "is-closed", extraClass]
                    .filter(Boolean)
                    .join(" ");
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

            const toggle = () => {
                const next = open ? "false" : "true";
                if (bindPath) {
                    this.setState(bindPath, next);
                } else {
                    updateCollapseState(!open);
                }
            };

            header.onclick = toggle;

            // Keyboard Arrow navigation for accordion headers within same parent / group
            header.addEventListener("keydown", (e) => {
                let siblingHeaders = [];
                if (group) {
                    const groupItems = document.querySelectorAll(`[data-euix-collapse-group="${group}"] .euix-collapse-header`);
                    siblingHeaders = Array.from(groupItems);
                } else if (root.parentElement) {
                    siblingHeaders = Array.from(root.parentElement.querySelectorAll(".euix-collapse-header"));
                }

                if (siblingHeaders.length <= 1) return;
                const currentIndex = siblingHeaders.indexOf(header);

                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = siblingHeaders[(currentIndex + 1) % siblingHeaders.length];
                    if (next) next.focus();
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = siblingHeaders[(currentIndex - 1 + siblingHeaders.length) % siblingHeaders.length];
                    if (prev) prev.focus();
                } else if (e.key === "Home") {
                    e.preventDefault();
                    if (siblingHeaders[0]) siblingHeaders[0].focus();
                } else if (e.key === "End") {
                    e.preventDefault();
                    if (siblingHeaders[siblingHeaders.length - 1]) siblingHeaders[siblingHeaders.length - 1].focus();
                }
            });

            if (bindPath) {
                this.registerBinding(bindPath, root, "collapse", (val) => {
                    updateCollapseState(this.isTruthy(val));
                });
            }

            root.appendChild(header);
            if (open) root.appendChild(body);

            return root;
        };
    },
};

export default EUIXCollapsePlugin;
