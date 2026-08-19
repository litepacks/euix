/**
 * src/plugins/router/navigation/scroll.js
 * Automatic scroll restoration and position history persistence for EUIX Web Router.
 */

export class ScrollRestorationManager {
    constructor({ enabled = true, storageKey = "euix_router_scroll" } = {}) {
        this.enabled = enabled;
        this.storageKey = storageKey;
        this._positions = new Map();
        this._loadFromStorage();
    }

    _loadFromStorage() {
        if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
            try {
                const stored = sessionStorage.getItem(this.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    Object.entries(parsed).forEach(([k, v]) => this._positions.set(k, v));
                }
            } catch (_) {}
        }
    }

    _saveToStorage() {
        if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
            try {
                const obj = Object.fromEntries(this._positions);
                sessionStorage.setItem(this.storageKey, JSON.stringify(obj));
            } catch (_) {}
        }
    }

    saveCurrentPosition(locationKey) {
        if (!this.enabled || typeof window === "undefined" || !locationKey) return;
        const pos = {
            x: window.scrollX || window.pageXOffset || 0,
            y: window.scrollY || window.pageYOffset || 0
        };
        this._positions.set(locationKey, pos);
        this._saveToStorage();
    }

    handleNavigation({ location, preserveScroll = false, isPop = false }) {
        if (!this.enabled || typeof window === "undefined") return;

        if (preserveScroll) return;

        // Hash navigation: scroll to target element
        if (location.hash) {
            const targetId = location.hash.slice(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView();
                return;
            }
        }

        const safeScrollTo = (x, y) => {
            if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
            try {
                // In JSDOM test environments, skip scrollTo to prevent noise
                if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "")) {
                    return;
                }
                window.scrollTo(x, y);
            } catch (_) {}
        };

        if (isPop && location.key && this._positions.has(location.key)) {
            const pos = this._positions.get(location.key);
            safeScrollTo(pos.x, pos.y);
        } else {
            // New navigation: scroll to top
            safeScrollTo(0, 0);
        }
    }
}
