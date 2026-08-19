/**
 * src/plugins/router/navigation/transitions.js
 * View Transitions API integration with automatic accessibility focus management.
 */

export class ViewTransitionManager {
    constructor({ enabled = true } = {}) {
        this.enabled = enabled;
    }

    async runTransition(updateDOMCallback) {
        if (!this.enabled || typeof document === "undefined" || !document.startViewTransition) {
            updateDOMCallback();
            this._manageFocus();
            return;
        }

        try {
            const transition = document.startViewTransition(() => {
                updateDOMCallback();
            });

            transition.finished.finally(() => {
                this._manageFocus();
            });

            await transition.updateCallbackDone;
        } catch (_) {
            updateDOMCallback();
            this._manageFocus();
        }
    }

    _manageFocus() {
        if (typeof document === "undefined") return;

        // Shift focus to main heading or active outlet container for screen readers & keyboard navigation
        const heading = document.querySelector("main h1, [role='main'] h1, .euix-router-outlet h1, h1");
        if (heading) {
            if (!heading.hasAttribute("tabindex")) {
                heading.setAttribute("tabindex", "-1");
            }
            heading.focus({ preventScroll: true });
        }
    }
}
