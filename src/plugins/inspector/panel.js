/**
 * src/plugins/inspector/panel.js
 * Interactive DevTools Drawer & Inspector Panel UI for EUIX Inspector.
 */

import { buildComponentTree, getElementMetadata } from "./metadata.js";
import { generateSelectors } from "./selectors.js";

export class InspectorPanel {
    constructor(inspector) {
        this.inspector = inspector;
        this.engine = inspector.engine;
        this.isOpen = false;
        this.activeTab = "state"; // 'state' | 'inspect' | 'tree' | 'logs' | 'search' | 'perf'
        this.selectedElement = null;
        this.searchQuery = "";
        this.stateFilterQuery = "";
        this.panelEl = null;
        this.hudEl = null;
        this.initDOM();
    }

    initDOM() {
        if (typeof document === "undefined") return;

        // 1. DevTools Bottom HUD Bar (Compact Floating Card)
        this.hudEl = document.createElement("div");
        this.hudEl.id = "euix-inspector-hud";
        this.hudEl.style.cssText = `
            position: fixed;
            bottom: 12px;
            right: 12px;
            z-index: 999999;
            width: max-content;
            max-width: calc(100vw - 24px);
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #f8fafc;
            padding: 5px 8px;
            border-radius: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.12);
            user-select: none;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-sizing: border-box;
        `;
        this.hudEl.innerHTML = `
            <!-- Top Row: Action Buttons -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    <button id="euix-dev-panel-btn" style="background:#1e293b;border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:2px 6px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;">📊 Panel</button>
                    <button id="euix-hud-boundaries-btn" style="background:#1e293b;border:1px solid rgba(236,72,153,0.3);color:#f472b6;padding:2px 6px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;">📐 Bounds</button>
                </div>
                <span id="euix-dev-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#64748b;flex-shrink:0;"></span>
            </div>
            <!-- Bottom Row: Toggle Title -->
            <div id="euix-dev-toggle" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:3px;">
                <span style="color:#e2e8f0;font-size:10px;">🛠️ EUIX Inspector</span>
                <span style="color:#64748b;font-size:9px;font-weight:normal;">Alt+Shift+X</span>
            </div>
        `;
        document.body.appendChild(this.hudEl);

        // 2. DevTools Panel Drawer
        this.panelEl = document.createElement("div");
        this.panelEl.id = "euix-devtools-panel";
        this.panelEl.style.cssText = `
            position: fixed;
            bottom: 64px;
            left: 16px;
            right: 16px;
            z-index: 999999;
            width: auto;
            max-width: 480px;
            margin-left: auto;
            height: 520px;
            max-height: calc(100vh - 90px);
            background: #0f172a;
            color: #f8fafc;
            border-radius: 16px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            box-sizing: border-box;
        `;
        document.body.appendChild(this.panelEl);

        this.bindHudEvents();
    }

    bindHudEvents() {
        const toggleBtn = document.getElementById("euix-dev-toggle") || document.getElementById("euix-hud-toggle");
        if (toggleBtn) {
            toggleBtn.onclick = () => this.inspector.toggle();
        }
        const panelBtn = document.getElementById("euix-dev-panel-btn") || document.getElementById("euix-hud-panel-btn");
        if (panelBtn) {
            panelBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggle();
            };
        }
        const boundsBtn = document.getElementById("euix-hud-boundaries-btn");
        if (boundsBtn) {
            boundsBtn.onclick = (e) => {
                e.stopPropagation();
                this.inspector.toggleBoundaries();
            };
        }
    }

    updateHudDot(enabled) {
        const dot = document.getElementById("euix-dev-dot") || document.getElementById("euix-hud-dot");
        if (dot) {
            dot.style.background = enabled ? "#22c55e" : "#64748b";
            dot.style.boxShadow = enabled ? "0 0 8px #22c55e" : "none";
        }
    }

    toggle(force) {
        this.isOpen = typeof force === "boolean" ? force : !this.isOpen;
        if (this.panelEl) {
            this.panelEl.style.display = this.isOpen ? "flex" : "none";
            if (this.isOpen) {
                if (!this.inspector.enabled) this.inspector.enable();
                this.render();
            }
        }
    }

    selectElement(el) {
        this.selectedElement = el;
        if (this.isOpen) {
            this.activeTab = "inspect";
            this.render();
        }
    }

    render() {
        if (!this.panelEl) return;

        const tabs = [
            { id: "inspect", label: "🔍 Inspect" },
            { id: "timeline", label: `⏱️ Timeline (${this.inspector.history?.snapshots?.length || 0})` },
            { id: "tree", label: "🌳 Tree" },
            { id: "logs", label: `⚡ Actions (${this.inspector.actionLogs.length})` },
            { id: "state", label: "📊 State" },
            { id: "webmcp", label: "🤖 WebMCP" },
            { id: "search", label: "🔎 Search" },
            { id: "perf", label: "⚡ Perf" },
        ];

        this.panelEl.innerHTML = `
            <div style="background:#1e293b;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);gap:6px;overflow-x:auto;">
                <div style="display:flex;gap:4px;align-items:center;">
                    ${tabs
                        .map(
                            (t) => `
                        <button id="euix-tab-${t.id}" style="background:${this.activeTab === t.id || (this.activeTab === "actions" && t.id === "logs") ? "#38bdf8" : "#334155"};color:${this.activeTab === t.id || (this.activeTab === "actions" && t.id === "logs") ? "#0f172a" : "#f8fafc"};border:none;padding:4px 8px;border-radius:6px;font-weight:700;font-size:10px;cursor:pointer;white-space:nowrap;">
                            ${t.label}
                        </button>
                    `,
                        )
                        .join("")}
                </div>
                <button id="euix-panel-close" style="background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;font-weight:bold;padding:2px 6px;">✕</button>
            </div>
            <div id="euix-panel-content" style="flex:1;overflow-y:auto;padding:12px;">
                ${this.renderTabContent()}
            </div>
        `;

        tabs.forEach((t) => {
            const btn = document.getElementById(`euix-tab-${t.id}`);
            if (btn) {
                btn.onclick = () => {
                    this.activeTab = t.id;
                    this.render();
                };
            }
        });

        const closeBtn = document.getElementById("euix-panel-close");
        if (closeBtn) {
            closeBtn.onclick = () => this.toggle(false);
        }

        this.bindTabEvents();
    }

    renderTabContent() {
        if (this.activeTab === "inspect") return this.renderInspectTab();
        if (this.activeTab === "timeline") return this.renderTimelineTab();
        if (this.activeTab === "tree") return this.renderTreeTab();
        if (this.activeTab === "actions" || this.activeTab === "logs") return this.renderActionsTab();
        if (this.activeTab === "state") return this.renderStateTab();
        if (this.activeTab === "webmcp") return this.renderWebMCPTab();
        if (this.activeTab === "search") return this.renderSearchTab();
        if (this.activeTab === "perf") return this.renderPerfTab();
        return "";
    }

    renderTimelineTab() {
        const history = this.inspector.history;
        const snapshots = history ? history.snapshots : [];
        const currentIndex = history ? history.currentIndex : -1;
        const canUndo = history ? history.canUndo() : false;
        const canRedo = history ? history.canRedo() : false;

        return `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <!-- Timeline Controls -->
                <div style="background:#1e293b;padding:8px 10px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                    <div style="display:flex;gap:4px;align-items:center;">
                        <button id="euix-history-undo" ${!canUndo ? "disabled" : ""} style="background:${canUndo ? "#334155" : "#1e293b"};color:${canUndo ? "#38bdf8" : "#475569"};border:1px solid rgba(56,189,248,${canUndo ? "0.4" : "0.1"});padding:4px 8px;border-radius:5px;font-size:10px;font-weight:bold;cursor:${canUndo ? "pointer" : "not-allowed"};">⏮ Undo</button>
                        <button id="euix-history-redo" ${!canRedo ? "disabled" : ""} style="background:${canRedo ? "#334155" : "#1e293b"};color:${canRedo ? "#38bdf8" : "#475569"};border:1px solid rgba(56,189,248,${canRedo ? "0.4" : "0.1"});padding:4px 8px;border-radius:5px;font-size:10px;font-weight:bold;cursor:${canRedo ? "pointer" : "not-allowed"};">⏭ Redo</button>
                    </div>
                    <div style="display:flex;gap:4px;align-items:center;">
                        <button id="euix-history-snapshot" style="background:#047857;color:#ecfdf5;border:none;padding:4px 8px;border-radius:5px;font-size:10px;font-weight:bold;cursor:pointer;">📸 Snapshot</button>
                        <button id="euix-history-clear" style="background:#334155;color:#94a3b8;border:none;padding:4px 8px;border-radius:5px;font-size:10px;cursor:pointer;">🧹 Clear</button>
                    </div>
                </div>

                <!-- Timeline Scrubber -->
                ${
                    snapshots.length > 1
                        ? `
                <div style="background:#1e293b;padding:8px 10px;border-radius:8px;display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:9px;">
                        <span>⏮ Initial</span>
                        <span style="color:#38bdf8;font-weight:bold;">Step ${currentIndex + 1} / ${snapshots.length}</span>
                        <span>Latest ⏭</span>
                    </div>
                    <input id="euix-history-scrubber" type="range" min="0" max="${snapshots.length - 1}" value="${currentIndex}" style="width:100%;cursor:pointer;accent-color:#38bdf8;" />
                </div>
                `
                        : ""
                }

                <!-- Snapshots List -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="color:#38bdf8;font-weight:bold;font-size:11px;">📜 Snapshot History (${snapshots.length})</div>
                    ${snapshots
                        .slice()
                        .reverse()
                        .map((snap) => {
                            const isCurrent = snap.index === currentIndex;
                            const diff = snap.diff || {};
                            const hasDiff = diff.hasChanges;

                            return `
                        <div class="euix-history-card" data-index="${snap.index}" style="background:#1e293b;border:1px solid ${isCurrent ? "#22c55e" : "rgba(255,255,255,0.08)"};border-radius:8px;padding:8px 10px;box-shadow:${isCurrent ? "0 0 10px rgba(34,197,94,0.2)" : "none"};">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span style="background:${isCurrent ? "#22c55e" : "#334155"};color:${isCurrent ? "#052e16" : "#f8fafc"};font-weight:bold;padding:1px 5px;border-radius:4px;font-size:9px;">#${snap.index + 1}</span>
                                    <span style="color:#f8fafc;font-weight:bold;font-size:11px;">${this.escape(snap.label)}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span style="color:#64748b;font-size:9px;">${snap.timestamp}</span>
                                    ${
                                        isCurrent
                                            ? `<span style="color:#22c55e;font-weight:bold;font-size:9px;">📍 ACTIVE</span>`
                                            : `<button class="euix-restore-btn" data-index="${snap.index}" style="background:#334155;border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">⏪ Restore</button>`
                                    }
                                </div>
                            </div>

                            <!-- Diff View -->
                            ${
                                hasDiff
                                    ? `
                            <div style="background:#0f172a;padding:6px;border-radius:5px;margin-top:6px;font-size:10px;display:flex;flex-direction:column;gap:2px;">
                                ${Object.entries(diff.changed || {})
                                    .map(
                                        ([k, v]) => `
                                    <div style="color:#facc15;"><span style="color:#64748b;">~</span> <strong>${this.escape(k)}</strong>: <span style="color:#f87171;">${this.escape(JSON.stringify(v.from))}</span> &rarr; <span style="color:#4ade80;">${this.escape(JSON.stringify(v.to))}</span></div>
                                `,
                                    )
                                    .join("")}
                                ${Object.entries(diff.added || {})
                                    .map(
                                        ([k, v]) => `
                                    <div style="color:#4ade80;"><span style="color:#22c55e;">+</span> <strong>${this.escape(k)}</strong>: ${this.escape(JSON.stringify(v))}</div>
                                `,
                                    )
                                    .join("")}
                                ${Object.entries(diff.removed || {})
                                    .map(
                                        ([k, v]) => `
                                    <div style="color:#f87171;"><span style="color:#ef4444;">-</span> <strong>${this.escape(k)}</strong>: ${this.escape(JSON.stringify(v))}</div>
                                `,
                                    )
                                    .join("")}
                            </div>
                            `
                                    : ""
                            }
                        </div>
                    `;
                        })
                        .join("")}
                </div>
            </div>
        `;
    }

    renderInspectTab() {
        const el = this.selectedElement || document.body;
        const meta = getElementMetadata(el, this.engine) || {};
        const selectors = generateSelectors(el, document);

        return `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <!-- Header Info -->
                <div style="background:#1e293b;padding:10px;border-radius:8px;border-left:3px solid #38bdf8;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#c084fc;font-weight:bold;font-size:12px;">🧩 &lt;${this.escape(meta.component)}&gt;</span>
                        <span style="color:#64748b;font-size:10px;">ID: ${this.escape(meta.instanceId)}</span>
                    </div>
                    <div style="color:#38bdf8;font-weight:bold;margin-top:2px;">
                        &lt;${this.escape(meta.tagName)}&gt; ${meta.ref ? `<span style="color:#f59e0b;">ref="${this.escape(meta.ref)}"</span>` : ""}
                    </div>
                    ${meta.source ? `<div style="color:#94a3b8;font-size:10px;margin-top:2px;">📍 ${this.escape(meta.source.file || "")}:${meta.source.line || ""}</div>` : ""}
                    ${meta.route ? `<div style="color:#34d399;font-size:10px;margin-top:2px;">🧭 Route: ${this.escape(meta.route)}</div>` : ""}
                </div>

                <!-- Stable E2E Selectors Section -->
                <div>
                    <div style="color:#38bdf8;font-weight:bold;margin-bottom:6px;font-size:11px;">🎯 Stable E2E Selectors</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${selectors
                            .map(
                                (s, idx) => `
                            <div style="background:#1e293b;border:1px solid ${s.isUnique ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"};border-radius:6px;padding:6px 8px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                    <span style="color:${s.isUnique ? "#34d399" : "#fbbf24"};font-weight:bold;font-size:10px;">
                                        ${s.isUnique ? "✓ Unique" : `⚠ Matches ${s.matchCount} elements`} &bull; ${s.label} (${s.score}%)
                                    </span>
                                    <div style="display:flex;gap:4px;">
                                        <button class="euix-copy-btn" data-copy="${this.escape(s.playwright)}" style="background:#334155;border:none;color:#38bdf8;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">Playwright</button>
                                        <button class="euix-copy-btn" data-copy="${this.escape(s.cypress)}" style="background:#334155;border:none;color:#34d399;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">Cypress</button>
                                        <button class="euix-copy-btn" data-copy="${this.escape(s.selector)}" style="background:#334155;border:none;color:#facc15;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">Selector</button>
                                    </div>
                                </div>
                                <code style="color:#f8fafc;font-size:10px;word-break:break-all;">${this.escape(s.selector)}</code>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                </div>

                <!-- Props & State -->
                ${
                    Object.keys(meta.props || {}).length > 0
                        ? `
                    <div>
                        <div style="color:#c084fc;font-weight:bold;margin-bottom:4px;">📦 Props</div>
                        <pre style="margin:0;background:#1e293b;padding:6px;border-radius:6px;color:#facc15;font-size:10px;overflow-x:auto;">${this.escape(JSON.stringify(meta.props, null, 2))}</pre>
                    </div>
                `
                        : ""
                }

                ${
                    meta.localState
                        ? `
                    <div>
                        <div style="color:#38bdf8;font-weight:bold;margin-bottom:4px;">🔒 Local State</div>
                        <pre style="margin:0;background:#1e293b;padding:6px;border-radius:6px;color:#facc15;font-size:10px;overflow-x:auto;">${this.escape(JSON.stringify(meta.localState, null, 2))}</pre>
                    </div>
                `
                        : ""
                }

                <!-- Bindings & Actions -->
                ${
                    meta.bindings && meta.bindings.length > 0
                        ? `
                    <div>
                        <div style="color:#60a5fa;font-weight:bold;margin-bottom:4px;">🔗 Reactive Bindings</div>
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            ${meta.bindings.map((b) => `<span style="background:#1e293b;padding:2px 6px;border-radius:4px;color:#93c5fd;font-size:10px;">${this.escape(b)}</span>`).join("")}
                        </div>
                    </div>
                `
                        : ""
                }

                ${
                    meta.actions && meta.actions.length > 0
                        ? `
                    <div>
                        <div style="color:#fbbf24;font-weight:bold;margin-bottom:4px;">⚡ Actions / Events</div>
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            ${meta.actions.map((a) => `<span style="background:#1e293b;padding:2px 6px;border-radius:4px;color:#fde047;font-size:10px;">${this.escape(a)}</span>`).join("")}
                        </div>
                    </div>
                `
                        : ""
                }
            </div>
        `;
    }

    renderTreeTab() {
        const tree = buildComponentTree(document.body);
        if (tree.length === 0) {
            return '<div style="color:#64748b;text-align:center;padding:20px;">No mounted EUIX components found.</div>';
        }

        const renderNode = (node, depth = 0) => {
            const isSelected = this.selectedElement === node.element;
            return `
                <div style="margin-left:${depth * 14}px;margin-bottom:4px;">
                    <div class="euix-tree-node" data-inst="${this.escape(node.instanceId)}" style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;border-radius:4px;background:${isSelected ? "#1e3a8a" : "#1e293b"};cursor:pointer;">
                        <span style="color:${isSelected ? "#93c5fd" : "#c084fc"};font-weight:bold;">
                            🧩 &lt;${this.escape(node.name)}&gt;
                        </span>
                        <span style="color:#64748b;font-size:9px;">${this.escape(node.instanceId)}</span>
                    </div>
                    ${node.children && node.children.length > 0 ? node.children.map((c) => renderNode(c, depth + 1)).join("") : ""}
                </div>
            `;
        };

        return `
            <div style="display:flex;flex-direction:column;gap:2px;">
                <div style="color:#94a3b8;font-size:10px;margin-bottom:6px;">Click component to highlight and inspect:</div>
                ${tree.map((n) => renderNode(n, 0)).join("")}
            </div>
        `;
    }

    renderActionsTab() {
        const logs = this.inspector.actionLogs;
        if (logs.length === 0) {
            return '<div style="color:#64748b;text-align:center;padding:20px;">No action logs recorded yet.</div>';
        }

        return `
            <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="color:#94a3b8;font-size:10px;">Recent actions (${logs.length}):</span>
                    <button id="euix-clear-logs" style="background:#334155;border:none;color:#f8fafc;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">🧹 Clear</button>
                </div>
                ${logs
                    .slice()
                    .reverse()
                    .map(
                        (l) => `
                    <div style="background:#1e293b;padding:6px 8px;border-radius:6px;border-left:3px solid ${l.status === "error" ? "#ef4444" : "#38bdf8"};">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#60a5fa;font-weight:bold;">⚡ ${this.escape(l.action)}</span>
                            <span style="color:#64748b;font-size:9px;">${l.time} (${(l.duration || 0).toFixed(1)}ms)</span>
                        </div>
                        ${l.info ? `<div style="color:#cbd5e1;font-size:10px;margin-top:2px;word-break:break-all;">${this.escape(l.info)}</div>` : ""}
                        ${l.error ? `<div style="color:#f87171;font-size:10px;margin-top:2px;">❌ ${this.escape(l.error.message || l.error)}</div>` : ""}
                    </div>
                `,
                    )
                    .join("")}
            </div>
        `;
    }

    renderStateTab() {
        const rawState = this.engine?._rawState || (typeof window !== "undefined" ? window.$state : {}) || {};
        let keys = Object.keys(rawState);
        if (this.stateFilterQuery) {
            const q = this.stateFilterQuery.toLowerCase();
            keys = keys.filter((k) => k.toLowerCase().includes(q));
        }

        return `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <input id="euix-state-filter" type="text" placeholder="🔍 Search state key..." value="${this.escape(this.stateFilterQuery)}" style="width:100%;background:#1e293b;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:6px 8px;border-radius:6px;font-size:11px;outline:none;box-sizing:border-box;" />
                ${
                    keys.length === 0
                        ? '<div style="color:#64748b;text-align:center;padding:20px;">No matching state variables</div>'
                        : `
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${keys
                            .map(
                                (k) => `
                            <div style="background:#1e293b;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
                                <div style="color:#38bdf8;font-weight:bold;font-size:10px;margin-bottom:2px;">🔑 ${this.escape(k)}</div>
                                <pre style="margin:0;color:#facc15;font-size:10px;white-space:pre-wrap;word-break:break-all;">${this.escape(typeof rawState[k] === "object" ? JSON.stringify(rawState[k], null, 2) : String(rawState[k]))}</pre>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                `
                }
            </div>
        `;
    }

    renderSearchTab() {
        const query = this.searchQuery.toLowerCase().trim();
        const results = [];

        if (query) {
            // 1. Search components
            const compElements = Array.from(document.querySelectorAll("[data-euix-component], [data-xui-component]"));
            compElements.forEach((el) => {
                const name = el.dataset.euixComponent || el.dataset.xuiComponent;
                if (name && name.toLowerCase().includes(query)) {
                    results.push({ type: "Component", label: `<${name}>`, element: el });
                }
            });

            // 2. Search actions
            const actionElements = Array.from(document.querySelectorAll("[data-euix-action], [action]"));
            actionElements.forEach((el) => {
                const act = el.getAttribute("data-euix-action") || el.getAttribute("action");
                if (act && act.toLowerCase().includes(query)) {
                    results.push({ type: "Action", label: `⚡ ${act} on <${el.tagName.toLowerCase()}>`, element: el });
                }
            });

            // 3. Search test-ids
            const testElements = Array.from(document.querySelectorAll("[data-euix-test], [test-id], [data-testid]"));
            testElements.forEach((el) => {
                const id =
                    el.getAttribute("data-euix-test") || el.getAttribute("test-id") || el.getAttribute("data-testid");
                if (id && id.toLowerCase().includes(query)) {
                    results.push({ type: "Test ID", label: `🏷️ ${id} on <${el.tagName.toLowerCase()}>`, element: el });
                }
            });
        }

        return `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <input id="euix-search-input" type="text" placeholder="🔍 Search component, action, test-id, binding..." value="${this.escape(this.searchQuery)}" style="width:100%;background:#1e293b;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:6px 8px;border-radius:6px;font-size:11px;outline:none;box-sizing:border-box;" />
                ${
                    !query
                        ? '<div style="color:#64748b;text-align:center;padding:20px;">Type a keyword to search components, actions, and test IDs.</div>'
                        : results.length === 0
                          ? '<div style="color:#64748b;text-align:center;padding:20px;">No matches found.</div>'
                          : `
                        <div style="display:flex;flex-direction:column;gap:6px;">
                            ${results
                                .map(
                                    (r, i) => `
                                <div class="euix-search-result" data-idx="${i}" style="background:#1e293b;padding:6px 8px;border-radius:6px;cursor:pointer;border-left:3px solid #38bdf8;">
                                    <div style="color:#38bdf8;font-size:9px;font-weight:bold;">${this.escape(r.type)}</div>
                                    <div style="color:#f8fafc;font-size:11px;font-weight:bold;margin-top:2px;">${this.escape(r.label)}</div>
                                </div>
                            `,
                                )
                                .join("")}
                        </div>
                    `
                }
            </div>
        `;
    }

    renderPerfTab() {
        const metrics =
            this.engine && typeof this.engine.getPerformanceMetrics === "function"
                ? this.engine.getPerformanceMetrics()
                : null;
        const mountMs = metrics ? metrics.mountDuration : this.engine?._mountDuration || 0;
        const bindingsCount = metrics ? metrics.activeBindingsCount : this.engine?._bindings?.size || 0;
        const astRatio = metrics ? (metrics.astCache.hitRatio * 100).toFixed(1) : "0.0";
        const memory = metrics?.memory?.usedJSHeapSize || "N/A";

        return `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #38bdf8;">
                    <div style="color:#94a3b8;font-size:10px;">🚀 Initial Mount Time</div>
                    <div style="color:#38bdf8;font-size:16px;font-weight:bold;">${mountMs} ms</div>
                </div>
                <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #10b981;">
                    <div style="color:#94a3b8;font-size:10px;">⚡ Reactive Bindings</div>
                    <div style="color:#34d399;font-size:16px;font-weight:bold;">${bindingsCount} bindings</div>
                </div>
                <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #8b5cf6;">
                    <div style="color:#94a3b8;font-size:10px;">🧠 AST Cache Efficiency</div>
                    <div style="color:#c084fc;font-size:16px;font-weight:bold;">${astRatio}%</div>
                </div>
                <div style="padding:8px;background:#1e293b;border-radius:8px;border-left:3px solid #f59e0b;">
                    <div style="color:#94a3b8;font-size:10px;">💾 JS Heap Memory</div>
                    <div style="color:#fbbf24;font-size:16px;font-weight:bold;">${memory}</div>
                </div>
            </div>
        `;
    }

    renderWebMCPTab() {
        const webmcp = this.engine?.webmcp;
        const isSupported = webmcp ? webmcp.isSupported() : false;
        const tools = webmcp ? webmcp.list() : [];
        const state = this.engine?.getState("$webmcp") || {};

        return `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <!-- Header Summary Card -->
                <div style="background:#1e293b;padding:10px 12px;border-radius:10px;border-left:3px solid #6366f1;display:flex;flex-direction:column;gap:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#818cf8;font-weight:bold;font-size:12px;display:flex;align-items:center;gap:6px;">
                            🤖 WebMCP Browser AI Agent Bridge
                        </span>
                        <span style="background:${isSupported ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"};color:${isSupported ? "#4ade80" : "#f87171"};border:1px solid ${isSupported ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"};padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;">
                            ${isSupported ? "✓ document.modelContext Supported" : "⚠ Fallback Mode"}
                        </span>
                    </div>
                    <div style="color:#94a3b8;font-size:10px;line-height:1.4;">
                        Exposes application actions and workflows as structured tools to browser AI agents without external dependencies.
                    </div>
                    <div style="display:flex;gap:12px;margin-top:4px;font-size:10px;color:#cbd5e1;">
                        <span>📦 <strong>${tools.length}</strong> Registered Tools</span>
                        <span>⚡ Status: <strong>${state.executing ? `<span style="color:#f59e0b;">Executing (${this.escape(state.currentTool || "")})</span>` : '<span style="color:#34d399;">Idle</span>'}</strong></span>
                    </div>
                </div>

                <!-- Tool List -->
                <div>
                    <div style="color:#818cf8;font-weight:bold;margin-bottom:6px;font-size:11px;display:flex;justify-content:space-between;align-items:center;">
                        <span>🛠️ Active Tools (${tools.length})</span>
                    </div>
                    ${
                        tools.length === 0
                            ? `
                        <div style="color:#64748b;font-style:italic;padding:12px;text-align:center;background:#1e293b;border-radius:8px;">
                            No WebMCP tools registered. Declare tools with &lt;webmcp&gt;&lt;tool .../&gt;&lt;/webmcp&gt; or engine.webmcp.register()
                        </div>
                    `
                            : `
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            ${tools
                                .map(
                                    (t) => `
                                <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <span style="color:#38bdf8;font-weight:bold;font-size:11px;">
                                            ⚡ ${this.escape(t.name)}${t.title && t.title !== t.name ? ` &bull; <span style="color:#e2e8f0;font-weight:normal;">${this.escape(t.title)}</span>` : ""}
                                        </span>
                                        <div style="display:flex;gap:4px;align-items:center;">
                                            ${t.annotations?.readOnlyHint ? `<span style="background:#0284c7;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;">readOnly</span>` : ""}
                                            ${t.exposedTo ? `<span style="background:#059669;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;">exposedTo</span>` : ""}
                                            <button class="euix-copy-btn" data-copy="${this.escape(JSON.stringify(t.inputSchema || {}, null, 2))}" style="background:#334155;border:none;color:#94a3b8;padding:2px 6px;border-radius:4px;font-size:9px;cursor:pointer;">Schema</button>
                                        </div>
                                    </div>
                                    ${t.description ? `<div style="color:#94a3b8;font-size:10px;">${this.escape(t.description)}</div>` : ""}
                                    <div style="margin-top:2px;">
                                        <details style="font-size:10px;color:#cbd5e1;">
                                            <summary style="cursor:pointer;color:#a5b4fc;font-weight:600;">View Schema</summary>
                                            <pre style="margin:4px 0 0 0;background:#0f172a;padding:6px;border-radius:4px;color:#facc15;font-size:9px;overflow-x:auto;">${this.escape(JSON.stringify(t.inputSchema || {}, null, 2))}</pre>
                                        </details>
                                    </div>
                                </div>
                            `,
                                )
                                .join("")}
                        </div>
                    `
                    }
                </div>

                <!-- Last Result / Execution Live Feed -->
                ${
                    (state.lastResult !== null && state.lastResult !== undefined) || state.lastError
                        ? `
                    <div style="background:#1e293b;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
                        <div style="color:#38bdf8;font-weight:bold;margin-bottom:4px;font-size:10px;">⚡ Last Execution Result</div>
                        ${
                            state.lastError
                                ? `
                            <div style="color:#f87171;font-size:10px;background:#450a0a;padding:6px;border-radius:4px;border:1px solid #7f1d1d;">
                                <strong>[${this.escape(state.lastError.code || "ERROR")}]:</strong> ${this.escape(state.lastError.message || String(state.lastError))}
                            </div>
                        `
                                : `
                            <pre style="margin:0;background:#0f172a;padding:6px;border-radius:4px;color:#34d399;font-size:9px;overflow-x:auto;">${this.escape(JSON.stringify(state.lastResult, null, 2))}</pre>
                        `
                        }
                    </div>
                `
                        : ""
                }
            </div>
        `;
    }

    bindTabEvents() {
        // Copy buttons
        const copyBtns = this.panelEl.querySelectorAll(".euix-copy-btn");
        copyBtns.forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const text = btn.getAttribute("data-copy");
                if (text && typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                    const original = btn.textContent;
                    btn.textContent = "Copied! ✓";
                    setTimeout(() => {
                        btn.textContent = original;
                    }, 1200);
                }
            };
        });

        // Tree nodes click
        const treeNodes = this.panelEl.querySelectorAll(".euix-tree-node");
        treeNodes.forEach((node) => {
            node.onclick = () => {
                const instId = node.getAttribute("data-inst");
                const targetEl =
                    document.querySelector(`[data-euix-instance="${instId}"]`) ||
                    document.querySelector(`[data-euix-component]`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                    this.inspector.select(targetEl);
                }
            };
        });

        // State filter
        const stateInput = document.getElementById("euix-state-filter");
        if (stateInput) {
            stateInput.oninput = (e) => {
                this.stateFilterQuery = e.target.value;
                const body =
                    document.getElementById("euix-panel-content") || document.getElementById("euix-panel-body");
                if (body) body.innerHTML = this.renderStateTab();
                this.bindTabEvents();
            };
        }

        // Search input
        const searchInput = document.getElementById("euix-search-input");
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value;
                const body =
                    document.getElementById("euix-panel-content") || document.getElementById("euix-panel-body");
                if (body) body.innerHTML = this.renderSearchTab();
                this.bindTabEvents();
            };
        }

        // Timeline Controls
        const undoBtn = document.getElementById("euix-history-undo");
        if (undoBtn) {
            undoBtn.onclick = () => {
                if (this.inspector.history) {
                    this.inspector.history.undo();
                    this.render();
                }
            };
        }
        const redoBtn = document.getElementById("euix-history-redo");
        if (redoBtn) {
            redoBtn.onclick = () => {
                if (this.inspector.history) {
                    this.inspector.history.redo();
                    this.render();
                }
            };
        }
        const snapshotBtn = document.getElementById("euix-history-snapshot");
        if (snapshotBtn) {
            snapshotBtn.onclick = () => {
                if (this.inspector.history) {
                    const label =
                        prompt("Snapshot label:", `Snapshot ${this.inspector.history.snapshots.length + 1}`) ||
                        "Manual Snapshot";
                    this.inspector.history.takeSnapshot(label);
                    this.render();
                }
            };
        }
        const clearHistoryBtn = document.getElementById("euix-history-clear");
        if (clearHistoryBtn) {
            clearHistoryBtn.onclick = () => {
                if (this.inspector.history) {
                    this.inspector.history.clearHistory();
                    this.render();
                }
            };
        }
        const scrubber = document.getElementById("euix-history-scrubber");
        if (scrubber) {
            scrubber.oninput = (e) => {
                if (this.inspector.history) {
                    this.inspector.history.timeTravelTo(Number(e.target.value));
                    this.render();
                }
            };
        }
        const restoreBtns = this.panelEl.querySelectorAll(".euix-restore-btn");
        restoreBtns.forEach((btn) => {
            btn.onclick = () => {
                const idx = Number(btn.getAttribute("data-index"));
                if (this.inspector.history) {
                    this.inspector.history.timeTravelTo(idx);
                    this.render();
                }
            };
        });

        // Clear actions
        const clearBtn = document.getElementById("euix-clear-logs") || document.getElementById("euix-clear-actions");
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.inspector.actionLogs = [];
                this.render();
            };
        }

        // Search results click
        const searchResults = this.panelEl.querySelectorAll(".euix-search-result");
        searchResults.forEach((res) => {
            res.onclick = () => {
                const query = this.searchQuery.toLowerCase().trim();
                const compElements = Array.from(
                    document.querySelectorAll("[data-euix-component], [data-xui-component]"),
                );
                const actionElements = Array.from(document.querySelectorAll("[data-euix-action], [action]"));
                const testElements = Array.from(
                    document.querySelectorAll("[data-euix-test], [test-id], [data-testid]"),
                );

                const all = [
                    ...compElements.filter((el) =>
                        (el.dataset.euixComponent || el.dataset.xuiComponent || "").toLowerCase().includes(query),
                    ),
                    ...actionElements.filter((el) =>
                        (el.getAttribute("data-euix-action") || el.getAttribute("action") || "")
                            .toLowerCase()
                            .includes(query),
                    ),
                    ...testElements.filter((el) =>
                        (
                            el.getAttribute("data-euix-test") ||
                            el.getAttribute("test-id") ||
                            el.getAttribute("data-testid") ||
                            ""
                        )
                            .toLowerCase()
                            .includes(query),
                    ),
                ];

                const idx = Number(res.getAttribute("data-idx"));
                const targetEl = all[idx];
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                    this.inspector.select(targetEl);
                }
            };
        });
    }

    destroy() {
        if (this.hudEl?.parentNode) this.hudEl.parentNode.removeChild(this.hudEl);
        if (this.panelEl?.parentNode) this.panelEl.parentNode.removeChild(this.panelEl);
    }

    escape(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}
