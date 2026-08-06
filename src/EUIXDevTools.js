/**
 * EUIXDevTools
 * Floating Inspector, State Viewer & Action Console Log Panel for Vanilla .EUIX Engine.
 */
export class EUIXDevTools {
    constructor(engine) {
        this.engine = engine;
        this.enabled = false;
        this.panelOpen = false;
        this.activeTab = "state"; // 'state' | 'logs'
        this.logs = [];

        this.highlightEl = null;
        this.tooltipEl = null;
        this.hudEl = null;
        this.panelEl = null;

        this.initDOM();
        this.bindEvents();
    }

    static init(engine) {
        if (!engine) {
            if (typeof window !== "undefined" && window.EUIXEngine && window.EUIXEngine.instance) {
                engine = window.EUIXEngine.instance;
            } else {
                return null;
            }
        }
        if (!engine._devtools) {
            engine._devtools = new EUIXDevTools(engine);
        }
        return engine._devtools;
    }

    initDOM() {
        if (typeof document === "undefined") return;

        // 1. Highlight Overlay
        this.highlightEl = document.createElement("div");
        this.highlightEl.id = "euix-devtools-highlight";
        this.highlightEl.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 999998;
            border: 2px dashed #3b82f6;
            background: rgba(59, 130, 246, 0.12);
            border-radius: 4px;
            transition: all 0.05s ease-out;
            display: none;
        `;
        document.body.appendChild(this.highlightEl);

        // 2. Floating Tooltip Badge
        this.tooltipEl = document.createElement("div");
        this.tooltipEl.id = "euix-devtools-tooltip";
        this.tooltipEl.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 999999;
            background: #0f172a;
            color: #f8fafc;
            padding: 6px 10px;
            border-radius: 8px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.15);
            display: none;
            max-width: 320px;
            word-break: break-all;
        `;
        document.body.appendChild(this.tooltipEl);

        // 3. DevTools Panel (State & Action Drawer)
        this.panelEl = document.createElement("div");
        this.panelEl.id = "euix-devtools-panel";
        this.panelEl.style.cssText = `
            position: fixed;
            bottom: 64px;
            right: 16px;
            z-index: 999999;
            width: 380px;
            max-height: 420px;
            background: #0f172a;
            color: #f8fafc;
            border-radius: 16px;
            box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.15);
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
        `;
        document.body.appendChild(this.panelEl);

        // 4. DevTools HUD Toggle Bar
        this.hudEl = document.createElement("div");
        this.hudEl.id = "euix-devtools-hud";
        this.hudEl.style.cssText = `
            position: fixed;
            bottom: 16px;
            right: 16px;
            z-index: 999999;
            background: #1e293b;
            color: #f8fafc;
            padding: 6px 12px;
            border-radius: 12px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 700;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            user-select: none;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        this.hudEl.innerHTML = `
            <div id="euix-dev-toggle" style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;" id="euix-dev-dot"></span>
                <span>🛠️ EUIX Inspector</span>
            </div>
            <span style="color:rgba(255,255,255,0.2);">|</span>
            <button id="euix-dev-panel-btn" style="background:#334155;border:none;color:#38bdf8;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">📊 State & Logs</button>
        `;
        document.body.appendChild(this.hudEl);

        document.getElementById("euix-dev-toggle").onclick = () => this.toggle();
        document.getElementById("euix-dev-panel-btn").onclick = (e) => {
            e.stopPropagation();
            this.togglePanel();
        };
    }

    toggle(forceState) {
        this.enabled = typeof forceState === "boolean" ? forceState : !this.enabled;

        const dot = document.getElementById("euix-dev-dot");
        if (dot) {
            dot.style.background = this.enabled ? "#22c55e" : "#64748b";
            dot.style.boxShadow = this.enabled ? "0 0 8px #22c55e" : "none";
        }

        if (typeof window !== "undefined") {
            if (this.enabled) {
                window.$state = this.engine ? this.engine._rawState : null;
                window.$engine = this.engine;
            }
        }

        if (!this.enabled) {
            this.hideHighlight();
            if (this.panelOpen) this.togglePanel(false);
        }
    }

    togglePanel(forceState) {
        this.panelOpen = typeof forceState === "boolean" ? forceState : !this.panelOpen;
        this.panelEl.style.display = this.panelOpen ? "flex" : "none";
        if (this.panelOpen) {
            if (!this.enabled) this.toggle(true);
            this.renderPanel();
        }
    }

    renderPanel() {
        if (!this.panelEl) return;

        const stateData = this.engine ? this.engine._rawState || {} : {};
        const stateKeys = Object.keys(stateData);

        const contentEl = document.getElementById("euix-panel-content");
        const prevScrollTop = contentEl ? contentEl.scrollTop : 0;

        this.panelEl.innerHTML = `
            <div style="background:#1e293b;padding:8px 12px;display:flex;align-items:center;justify-content:between;border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex;gap:8px;align-items:center;">
                    <button id="euix-tab-state" style="background:${this.activeTab === 'state' ? '#3b82f6' : '#334155'};color:#fff;border:none;padding:3px 8px;border-radius:6px;font-weight:bold;cursor:pointer;">📊 State (${stateKeys.length})</button>
                    <button id="euix-tab-logs" style="background:${this.activeTab === 'logs' ? '#3b82f6' : '#334155'};color:#fff;border:none;padding:3px 8px;border-radius:6px;font-weight:bold;cursor:pointer;">📜 Logs (${this.logs.length})</button>
                    <button id="euix-tab-perf" style="background:${this.activeTab === 'perf' ? '#3b82f6' : '#334155'};color:#fff;border:none;padding:3px 8px;border-radius:6px;font-weight:bold;cursor:pointer;">⚡ Perf</button>
                    ${this.activeTab === 'logs' ? `<button id="euix-clear-logs" style="background:#475569;color:#f8fafc;border:none;padding:3px 6px;border-radius:6px;font-size:10px;font-weight:bold;cursor:pointer;">🧹 Clear</button>` : ""}
                </div>
                <button id="euix-panel-close" style="background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;font-weight:bold;">✕</button>
            </div>
            ${this.activeTab === 'state' ? `
            <div style="padding:6px 10px;background:#0f172a;border-bottom:1px solid rgba(255,255,255,0.05);">
                <input id="euix-state-filter" type="text" placeholder="🔍 Search state key..." value="${this.stateFilterQuery || ''}" style="width:100%;background:#1e293b;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;outline:none;" />
            </div>
            ` : ""}
            <div style="flex:1;overflow-y:auto;padding:10px;" id="euix-panel-content">
                ${this.renderTabContent(stateData)}
            </div>
        `;

        document.getElementById("euix-tab-state").onclick = () => {
            this.activeTab = "state";
            this.renderPanel();
        };
        document.getElementById("euix-tab-logs").onclick = () => {
            this.activeTab = "logs";
            this.renderPanel();
        };
        document.getElementById("euix-tab-perf").onclick = () => {
            this.activeTab = "perf";
            this.renderPanel();
        };
        const clearBtn = document.getElementById("euix-clear-logs");
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.logs = [];
                this.renderPanel();
            };
        }

        const filterInput = document.getElementById("euix-state-filter");
        if (filterInput) {
            filterInput.oninput = (e) => {
                this.stateFilterQuery = e.target.value;
                const newContent = this.renderTabContent(stateData);
                const updatedContentEl = document.getElementById("euix-panel-content");
                if (updatedContentEl) updatedContentEl.innerHTML = newContent;
            };
        }

        document.getElementById("euix-panel-close").onclick = () => this.togglePanel(false);

        // Restore scroll position to prevent jumping
        const newContentEl = document.getElementById("euix-panel-content");
        if (newContentEl && prevScrollTop > 0) {
            newContentEl.scrollTop = prevScrollTop;
        }
    }

    renderTabContent(stateData) {
        if (this.activeTab === "perf") {
            const bindingsCount = this.engine && this.engine._bindings ? this.engine._bindings.size : 0;
            const watchersCount = this.engine && this.engine._stateWatchers ? this.engine._stateWatchers.size : 0;
            const heapMb = (typeof performance !== "undefined" && performance.memory && performance.memory.usedJSHeapSize)
                ? `${(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`
                : "N/A (Browser Restricted)";
            const measuresCount = (typeof performance !== "undefined" && performance.getEntriesByType)
                ? performance.getEntriesByType("measure").length
                : 0;

            return `
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #10b981;">
                        <div style="color:#94a3b8;font-size:10px;">⚡ Reactive DOM Bindings</div>
                        <div style="color:#34d399;font-size:16px;font-weight:bold;">${bindingsCount} active nodes</div>
                    </div>
                    <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #3b82f6;">
                        <div style="color:#94a3b8;font-size:10px;">👁️ Active State Watchers</div>
                        <div style="color:#60a5fa;font-size:16px;font-weight:bold;">${watchersCount} watchers</div>
                    </div>
                    <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #8b5cf6;">
                        <div style="color:#94a3b8;font-size:10px;">⏱️ User Timing MeasuresRecorded</div>
                        <div style="color:#c084fc;font-size:16px;font-weight:bold;">${measuresCount} measures</div>
                    </div>
                    <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #f59e0b;">
                        <div style="color:#94a3b8;font-size:10px;">💾 JS Heap Memory Usage</div>
                        <div style="color:#fbbf24;font-size:16px;font-weight:bold;">${heapMb}</div>
                    </div>
                </div>
            `;
        }
        if (this.activeTab === "state") {
            let keys = Object.keys(stateData);
            if (this.stateFilterQuery) {
                const q = this.stateFilterQuery.toLowerCase();
                keys = keys.filter(k => k.toLowerCase().includes(q));
            }
            if (keys.length === 0) return '<div style="color:#64748b;text-align:center;padding:20px;">No matching state variables</div>';

            return keys.map(key => {
                const val = stateData[key];
                const strVal = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
                return `
                    <div style="margin-bottom:8px;padding:6px 8px;background:#1e293b;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:#38bdf8;font-weight:bold;margin-bottom:2px;">🔑 ${key}</div>
                        <pre style="margin:0;color:#facc15;white-space:pre-wrap;word-break:break-all;font-size:10px;">${this.escapeHtml(strVal)}</pre>
                    </div>
                `;
            }).join("");
        } else {
            if (this.logs.length === 0) return '<div style="color:#64748b;text-align:center;padding:20px;">No action logs recorded yet</div>';

            return this.logs.slice().reverse().map(log => `
                <div style="margin-bottom:6px;padding:6px;background:#1e293b;border-radius:6px;border-left:3px solid #3b82f6;">
                    <div style="display:flex;justify-content:between;color:#94a3b8;font-size:10px;">
                        <span style="color:#60a5fa;font-weight:bold;">⚡ ${log.type}</span>
                        <span>${log.time}</span>
                    </div>
                    <div style="color:#cbd5e1;margin-top:2px;font-size:10px;word-break:break-all;">${this.escapeHtml(log.info)}</div>
                </div>
            `).join("");
        }
    }

    logAction(type, details = {}) {
        const time = new Date().toLocaleTimeString();
        let info = "";

        if (type === "setState") {
            info = `${details.path} = ${typeof details.value === 'object' ? JSON.stringify(details.value) : details.value}`;
        } else if (type === "MUTATE_STATE") {
            info = `${details.operation || 'MUTATE'} on ${details.path || 'state'}`;
        } else {
            info = details.path ? `${type} -> ${details.path}` : `${type}`;
        }

        const entry = { time, type, info };
        this.logs.push(entry);
        if (this.logs.length > 30) this.logs.shift();

        // Print nice console message in DevTools
        if (typeof console !== "undefined" && console.log) {
            console.log(`%c[EUIX DevTools]%c ⚡ ${type}: ${info}`, "color:#3b82f6;font-weight:bold;", "color:inherit;");
        }

        if (this.panelOpen) {
            this.renderPanel();
        }
    }

    bindEvents() {
        if (typeof document === "undefined") return;

        document.addEventListener("mousemove", (e) => {
            if (!this.enabled) return;

            let target = e.target;
            if (!target || target === document.body || target === document.documentElement) {
                this.hideHighlight();
                return;
            }

            if (target.closest("#euix-devtools-hud") || target.closest("#euix-devtools-panel") || target.closest("#euix-devtools-tooltip") || target.id === "euix-devtools-highlight") {
                return;
            }

            let boxEl = target;
            while (boxEl && boxEl !== document.body) {
                const style = window.getComputedStyle(boxEl);
                const rect = boxEl.getBoundingClientRect();
                if (style.display !== "contents" && (rect.width > 0 || rect.height > 0)) {
                    break;
                }
                boxEl = boxEl.parentElement;
            }

            if (!boxEl || boxEl === document.body) {
                this.hideHighlight();
                return;
            }

            let stateKey = "";
            let bindKind = "";
            let refName = "";
            let compName = "";

            let metaEl = target;
            while (metaEl && metaEl !== document.body) {
                if (metaEl.dataset) {
                    if (!compName && metaEl.dataset.xuiComponent) {
                        compName = metaEl.dataset.xuiComponent;
                    }
                    if (!stateKey && (metaEl.dataset.xuiKey || metaEl.dataset.xuiBind)) {
                        stateKey = metaEl.dataset.xuiKey || metaEl.dataset.xuiBind;
                        bindKind = metaEl.dataset.xuiBind ? "state" : "key";
                    }
                    if (!refName && metaEl.dataset.xuiRef) {
                        refName = metaEl.dataset.xuiRef;
                    }
                }
                metaEl = metaEl.parentElement;
            }

            this.inspectElement(boxEl, target, stateKey, bindKind, refName, compName);
        });

        document.addEventListener("keydown", (e) => {
            if (e.altKey && e.shiftKey && e.key.toLowerCase() === "i") {
                e.preventDefault();
                this.toggle();
            } else if (e.key === "Escape" && (this.enabled || this.panelOpen)) {
                if (this.panelOpen) this.togglePanel(false);
                else this.toggle(false);
            }
        });
    }

    inspectElement(boxEl, targetEl, stateKey, bindKind, refName, compName = "") {
        if (!boxEl) return;

        const rect = boxEl.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        this.highlightEl.style.width = `${rect.width}px`;
        this.highlightEl.style.height = `${rect.height}px`;
        this.highlightEl.style.top = `${rect.top + scrollY}px`;
        this.highlightEl.style.left = `${rect.left + scrollX}px`;
        this.highlightEl.style.display = "block";

        const tagName = (targetEl || boxEl).tagName.toLowerCase();

        let parsedKey = stateKey;
        if (stateKey && this.engine && typeof this.engine.parseBindPath === "function") {
            parsedKey = this.engine.parseBindPath(stateKey);
        }

        let stateVal = "";
        if (parsedKey && this.engine) {
            const val = this.engine.getState(parsedKey);
            if (val !== undefined && val !== null) {
                stateVal = typeof val === "object" ? JSON.stringify(val) : String(val);
            }
        }

        this.tooltipEl.innerHTML = `
            ${compName ? `<div style="font-weight:bold;color:#c084fc;margin-bottom:2px;">🧩 Component: &lt;${this.escapeHtml(compName)}&gt;</div>` : ""}
            <div style="font-weight:bold;color:#60a5fa;margin-bottom:2px;">&lt;${this.escapeHtml(tagName)}&gt; ${refName ? `ref="${this.escapeHtml(refName)}"` : ""}</div>
            ${parsedKey ? `<div style="color:#94a3b8;">🔑 Key: <strong style="color:#38bdf8;">${this.escapeHtml(parsedKey)}</strong> (${bindKind || 'state'})</div>` : ""}
            ${stateVal !== "" ? `<div style="color:#cbd5e1;margin-top:2px;">📦 Value: <span style="color:#facc15;">${this.escapeHtml(stateVal.slice(0, 100))}</span></div>` : ""}
        `;

        let tooltipTop = rect.top + scrollY - 55;
        if (tooltipTop < scrollY + 10) tooltipTop = rect.bottom + scrollY + 10;

        let tooltipLeft = rect.left + scrollX;
        if (tooltipLeft + 280 > window.innerWidth + scrollX) {
            tooltipLeft = Math.max(10, window.innerWidth + scrollX - 290);
        }

        this.tooltipEl.style.top = `${tooltipTop}px`;
        this.tooltipEl.style.left = `${tooltipLeft}px`;
        this.tooltipEl.style.display = "block";
    }

    hideHighlight() {
        if (this.highlightEl) this.highlightEl.style.display = "none";
        if (this.tooltipEl) this.tooltipEl.style.display = "none";
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
}

// Auto-enable DevTools if data-euix-devtools script attribute is present
if (typeof document !== "undefined") {
    const autoInitDevTools = () => {
        const script = document.querySelector("script[data-euix-devtools]");
        if (script && window.EUIXEngine && window.EUIXEngine.instance) {
            const devtools = EUIXDevTools.init(window.EUIXEngine.instance);
            if (devtools) devtools.toggle(true);
        }
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(autoInitDevTools, 50);
    } else {
        document.addEventListener("DOMContentLoaded", autoInitDevTools);
    }
}
