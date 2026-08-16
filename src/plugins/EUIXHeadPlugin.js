/**
 * EUIXHeadPlugin.js
 * Document Head & HTML Metadata / Helmet Plugin for EUIX Engine.
 * Declaratively manage document title, meta tags, link tags, and OpenGraph metadata
 * with dynamic reactive state bindings (like React Helmet).
 */

export const EUIXHeadPlugin = {
    name: "head",
    install(engineClass) {
        // Track managed head elements for cleanup on engine unmount
        engineClass.prototype._headManagedElements = engineClass.prototype._headManagedElements || new Set();

        /**
         * Render <head> or <helmet> XML specifications
         */
        engineClass.prototype.renderHead = function(xmlNode, context = {}) {
            if (typeof document === "undefined") return null;

            const children = Array.from(xmlNode.children || []);
            children.forEach(child => {
                const tag = (child.tagName || "").toLowerCase();
                if (tag === "title") {
                    this.renderHeadTitle(child, context);
                } else if (tag === "meta") {
                    this.renderHeadMeta(child, context);
                } else if (tag === "link") {
                    this.renderHeadLink(child, context);
                }
            });

            // Return a lightweight comment marker so layout flow is unaffected
            return document.createComment("euix:head");
        };

        /**
         * Render & bind <title> tags reactively
         */
        engineClass.prototype.renderHeadTitle = function(titleNode, context = {}) {
            if (typeof document === "undefined") return null;

            const rawText = titleNode.getAttribute("title") || titleNode.textContent.trim() || "";
            if (!rawText) return document.createComment("euix:title");

            const updateTitle = () => {
                const newTitle = this.interpolate(rawText, context);
                if (newTitle !== undefined && newTitle !== null) {
                    document.title = newTitle;
                }
            };

            updateTitle();

            // Track dynamic reactive placeholders
            const matches = Array.from(rawText.matchAll(/(?:parent\.)?(?:data|local|\$local)\.([a-zA-Z0-9_.[\]]+)/g));
            if (matches.length > 0) {
                const uniqueKeys = new Set(matches.map(m => m[1].split('.')[0]));
                uniqueKeys.forEach(key => {
                    const isLocal = context._localState && (context._localState[key] !== undefined || rawText.includes(`local.${key}`));
                    const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + key) : key;
                    this.registerBinding(bindKey, document, "head_title", updateTitle);
                });
            }

            return document.createComment("euix:title");
        };

        /**
         * Render & bind <meta> tags reactively
         */
        engineClass.prototype.renderHeadMeta = function(metaNode, context = {}) {
            if (typeof document === "undefined") return null;

            const name = metaNode.getAttribute("name");
            const property = metaNode.getAttribute("property");
            const httpEquiv = metaNode.getAttribute("http-equiv");
            const charset = metaNode.getAttribute("charset");
            const rawContent = metaNode.getAttribute("content") || metaNode.textContent.trim() || "";

            let metaEl = null;
            const head = document.head || document.getElementsByTagName("head")[0];
            if (!head) return null;

            // Find existing or create new meta element
            if (name) {
                metaEl = head.querySelector(`meta[name="${name}"][data-euix-head="true"]`);
            } else if (property) {
                metaEl = head.querySelector(`meta[property="${property}"][data-euix-head="true"]`);
            } else if (httpEquiv) {
                metaEl = head.querySelector(`meta[http-equiv="${httpEquiv}"][data-euix-head="true"]`);
            } else if (charset) {
                metaEl = head.querySelector(`meta[charset][data-euix-head="true"]`);
            }

            if (!metaEl) {
                metaEl = document.createElement("meta");
                metaEl.setAttribute("data-euix-head", "true");
                if (name) metaEl.setAttribute("name", name);
                if (property) metaEl.setAttribute("property", property);
                if (httpEquiv) metaEl.setAttribute("http-equiv", httpEquiv);
                if (charset) metaEl.setAttribute("charset", charset);
                head.appendChild(metaEl);
                if (this._headManagedElements) this._headManagedElements.add(metaEl);
            }

            const updateMeta = () => {
                if (rawContent) {
                    const newContent = this.interpolate(rawContent, context);
                    metaEl.setAttribute("content", newContent);
                }
            };

            updateMeta();

            // Track dynamic placeholders
            if (rawContent && rawContent.includes("{")) {
                const matches = Array.from(rawContent.matchAll(/(?:parent\.)?(?:data|local|\$local)\.([a-zA-Z0-9_.[\]]+)/g));
                if (matches.length > 0) {
                    const uniqueKeys = new Set(matches.map(m => m[1].split('.')[0]));
                    uniqueKeys.forEach(key => {
                        const isLocal = context._localState && (context._localState[key] !== undefined || rawContent.includes(`local.${key}`));
                        const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + key) : key;
                        this.registerBinding(bindKey, metaEl, "head_meta", updateMeta);
                    });
                }
            }

            return document.createComment("euix:meta");
        };

        /**
         * Render & bind <link> tags reactively
         */
        engineClass.prototype.renderHeadLink = function(linkNode, context = {}) {
            if (typeof document === "undefined") return null;

            const rel = linkNode.getAttribute("rel") || "canonical";
            const rawHref = linkNode.getAttribute("href") || "";
            const head = document.head || document.getElementsByTagName("head")[0];
            if (!head || !rawHref) return null;

            let linkEl = head.querySelector(`link[rel="${rel}"][data-euix-head="true"]`);
            if (!linkEl) {
                linkEl = document.createElement("link");
                linkEl.setAttribute("data-euix-head", "true");
                linkEl.setAttribute("rel", rel);
                head.appendChild(linkEl);
                if (this._headManagedElements) this._headManagedElements.add(linkEl);
            }

            const updateLink = () => {
                const newHref = this.interpolate(rawHref, context);
                linkEl.setAttribute("href", newHref);
            };

            updateLink();

            if (rawHref.includes("{")) {
                const matches = Array.from(rawHref.matchAll(/(?:parent\.)?(?:data|local|\$local)\.([a-zA-Z0-9_.[\]]+)/g));
                if (matches.length > 0) {
                    const uniqueKeys = new Set(matches.map(m => m[1].split('.')[0]));
                    uniqueKeys.forEach(key => {
                        const isLocal = context._localState && (context._localState[key] !== undefined || rawHref.includes(`local.${key}`));
                        const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + key) : key;
                        this.registerBinding(bindKey, linkEl, "head_link", updateLink);
                    });
                }
            }

            return document.createComment("euix:link");
        };

        /**
         * Programmatic helper to set document title
         */
        engineClass.prototype.setTitle = function(title) {
            if (typeof document !== "undefined") {
                document.title = title;
            }
        };

        /**
         * Parse top-level <head>, <helmet>, or <title> in root spec if present
         */
        engineClass.prototype.parseHeadMetadata = function(rootSpecNode) {
            if (!rootSpecNode || !rootSpecNode.children) return;
            Array.from(rootSpecNode.children).forEach(child => {
                const tag = (child.tagName || "").toLowerCase();
                if (tag === "head" || tag === "helmet") {
                    this.renderHead(child);
                } else if (tag === "title") {
                    this.renderHeadTitle(child);
                }
            });
        };
    }
};

export const EUIXHelmetPlugin = EUIXHeadPlugin;
