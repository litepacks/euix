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

        if (isPop && location.key && this._positions.has(location.key)) {
            const pos = this._positions.get(location.key);
            if (typeof window.scrollTo === "function") {
                try { window.scrollTo(pos.x, pos.y); } catch (_) {}
            }
        } else {
            // New navigation: scroll to top
            if (typeof window.scrollTo === "function") {
                try { window.scrollTo(0, 0); } catch (_) {}
            }
        }
    }
}
