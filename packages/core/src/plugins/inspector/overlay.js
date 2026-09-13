/**
 * src/plugins/inspector/overlay.js
 * Non-intrusive fixed highlight overlay, floating badge tooltip,
 * and component boundary visualizer for EUIX Inspector.
 */

export class OverlayManager {
    constructor() {
        this.highlightEl = null;
        this.tooltipEl = null;
        this.boundaryContainer = null;
        this.rafId = null;
        this.initDOM();
    }

    initDOM() {
        if (typeof document === "undefined") return;

        // 1. Element Highlight Overlay
        this.highlightEl = document.createElement("div");
        this.highlightEl.id = "euix-inspector-highlight";
        this.highlightEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 999998;
            border: 2px dashed #38bdf8;
            background: rgba(56, 189, 248, 0.12);
            border-radius: 4px;
            transition: all 0.05s ease-out;
            display: none;
            box-sizing: border-box;
        `;
        document.body.appendChild(this.highlightEl);

        // 2. Floating Tooltip Badge
        this.tooltipEl = document.createElement("div");
        this.tooltipEl.id = "euix-inspector-tooltip";
        this.tooltipEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 999999;
            background: #0f172a;
            color: #f8fafc;
            padding: 8px 12px;
            border-radius: 8px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.18);
            display: none;
            max-width: 340px;
            word-break: break-all;
            line-height: 1.4;
        `;
        document.body.appendChild(this.tooltipEl);

        // 3. Boundary Overlays Container
        this.boundaryContainer = document.createElement("div");
        this.boundaryContainer.id = "euix-inspector-boundaries";
        this.boundaryContainer.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 999997;
            display: none;
        `;
        document.body.appendChild(this.boundaryContainer);
    }

    /**
     * Highlights the target element and positions tooltip.
     */
    highlight(element, meta = {}) {
        if (!element || !this.highlightEl || !this.tooltipEl) return;

        const rect =
            typeof element.getBoundingClientRect === "function"
                ? element.getBoundingClientRect()
                : { top: 0, left: 0, width: 100, height: 30, bottom: 30, right: 100 };

        this.highlightEl.style.width = `${rect.width}px`;
        this.highlightEl.style.height = `${rect.height}px`;
        this.highlightEl.style.top = `${rect.top}px`;
        this.highlightEl.style.left = `${rect.left}px`;
        this.highlightEl.style.display = "block";

        const compName = meta.component || "";
        const tagName = meta.tagName || (element.tagName ? element.tagName.toLowerCase() : "element");
        const testId = meta.testId || "";
        const action = meta.actions && meta.actions.length > 0 ? meta.actions.join(", ") : "";
        const route = meta.route || "";
        const binding = meta.bindings && meta.bindings.length > 0 ? meta.bindings.join(", ") : "";

        let html = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <span style="font-weight:700;color:#c084fc;">🧩 &lt;${this.escape(compName)}&gt;</span>
            <span style="color:#64748b;font-size:10px;">${this.escape(meta.instanceId || "")}</span>
        </div>`;

        html += `<div style="color:#38bdf8;font-weight:600;">&lt;${this.escape(tagName)}&gt;${meta.ref ? ` ref="${this.escape(meta.ref)}"` : ""}</div>`;

        if (testId) {
            html += `<div style="color:#34d399;margin-top:2px;">🏷️ test-id: <strong>${this.escape(testId)}</strong></div>`;
        }
        if (action) {
            html += `<div style="color:#fbbf24;margin-top:2px;">⚡ action: <strong>${this.escape(action)}</strong></div>`;
        }
        if (binding) {
            html += `<div style="color:#60a5fa;margin-top:2px;">🔗 bind: ${this.escape(binding)}</div>`;
        }
        if (route) {
            html += `<div style="color:#94a3b8;margin-top:2px;font-size:10px;">🧭 route: ${this.escape(route)}</div>`;
        }

        this.tooltipEl.innerHTML = html;

        let tooltipTop = rect.top - 50;
        if (tooltipTop < 8) tooltipTop = rect.bottom + 8;

        let tooltipLeft = rect.left;
        if (typeof window !== "undefined" && window.innerWidth && tooltipLeft + 320 > window.innerWidth) {
            tooltipLeft = Math.max(8, window.innerWidth - 330);
        }

        this.tooltipEl.style.top = `${Math.max(8, tooltipTop)}px`;
        this.tooltipEl.style.left = `${Math.max(8, tooltipLeft)}px`;
        this.tooltipEl.style.display = "block";
    }

    hide() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (this.highlightEl) this.highlightEl.style.display = "none";
        if (this.tooltipEl) this.tooltipEl.style.display = "none";
    }

    /**
     * Visualizes component boundaries in the viewport.
     */
    showBoundaries(components = []) {
        if (!this.boundaryContainer) return;
        this.boundaryContainer.innerHTML = "";
        this.boundaryContainer.style.display = "block";

        const colors = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];

        components.forEach((comp, idx) => {
            const el = comp.element;
            if (!el || typeof el.getBoundingClientRect !== "function") return;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const color = colors[idx % colors.length];

            const box = document.createElement("div");
            box.style.cssText = `
                position: absolute;
                top: ${rect.top}px;
                left: ${rect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                border: 1.5px dashed ${color};
                background: ${color}10;
                pointer-events: none;
                box-sizing: border-box;
                border-radius: 4px;
            `;

            const label = document.createElement("div");
            label.textContent = comp.name || "Component";
            label.style.cssText = `
                position: absolute;
                top: -18px;
                left: 0;
                background: ${color};
                color: #fff;
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 10px;
                font-weight: 700;
                padding: 1px 6px;
                border-radius: 4px;
                white-space: nowrap;
            `;
            box.appendChild(label);
            this.boundaryContainer.appendChild(box);
        });
    }

    hideBoundaries() {
        if (this.boundaryContainer) {
            this.boundaryContainer.innerHTML = "";
            this.boundaryContainer.style.display = "none";
        }
    }

    /**
     * Visually flashes an updated DOM element with a transient glowing outline overlay.
     */
    flash(element, options = {}) {
        if (typeof document === "undefined" || !element) return null;
        let targetEl = element;
        if (targetEl.nodeType === 3) targetEl = targetEl.parentElement;
        if (!targetEl) return null;

        const rawRect =
            typeof targetEl.getBoundingClientRect === "function" ? targetEl.getBoundingClientRect() : null;
        const width = rawRect?.width || targetEl.offsetWidth || 100;
        const height = rawRect?.height || targetEl.offsetHeight || 28;
        const top = rawRect?.top !== undefined ? rawRect.top : targetEl.offsetTop || 0;
        const left = rawRect?.left !== undefined ? rawRect.left : targetEl.offsetLeft || 0;

        if (!this.flashContainer) {
            this.flashContainer = document.createElement("div");
            this.flashContainer.id = "euix-inspector-flash-container";
            this.flashContainer.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 999995;
            `;
            document.body.appendChild(this.flashContainer);
        }

        const color = options.color || "#10b981";
        const box = document.createElement("div");
        box.className = "euix-flash-box";
        box.setAttribute(
            "style",
            `position: fixed; top: ${top}px; left: ${left}px; width: ${width}px; height: ${height}px; border: 2px solid ${color}; background: ${color}26; box-shadow: 0 0 12px ${color}80; border-radius: 4px; pointer-events: none; box-sizing: border-box; opacity: 1; transition: opacity 0.35s ease-out, transform 0.35s ease-out; transform: scale(1.02);`,
        );

        if (options.label) {
            const label = document.createElement("div");
            label.className = "euix-flash-label";
            label.textContent = `⚡ ${options.label}`;
            label.style.cssText = `
                position: absolute;
                top: -16px;
                right: 0;
                background: ${color};
                color: #fff;
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 9px;
                font-weight: 700;
                padding: 1px 4px;
                border-radius: 3px;
                white-space: nowrap;
            `;
            box.appendChild(label);
        }

        this.flashContainer.appendChild(box);

        if (typeof requestAnimationFrame !== "undefined") {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    box.style.opacity = "0";
                    box.style.transform = "scale(1)";
                });
            });
        }

        setTimeout(() => {
            if (box.parentNode) {
                box.parentNode.removeChild(box);
            }
        }, 400);

        return box;
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (this.highlightEl?.parentNode) this.highlightEl.parentNode.removeChild(this.highlightEl);
        if (this.tooltipEl?.parentNode) this.tooltipEl.parentNode.removeChild(this.tooltipEl);
        if (this.boundaryContainer?.parentNode) this.boundaryContainer.parentNode.removeChild(this.boundaryContainer);
        if (this.flashContainer?.parentNode) this.flashContainer.parentNode.removeChild(this.flashContainer);
    }

    escape(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}
