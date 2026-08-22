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
                try {
                    updateDOMCallback();
                } catch (_) {}
            });

            // Catch promise rejections on all View Transition lifecycle phases
            if (transition.ready && typeof transition.ready.catch === "function") {
                transition.ready.catch(() => {});
            }
            if (transition.updateCallbackDone && typeof transition.updateCallbackDone.catch === "function") {
                transition.updateCallbackDone.catch(() => {});
            }
            if (transition.finished && typeof transition.finished.catch === "function") {
                transition.finished
                    .catch(() => {}) // Safely ignore AbortError on fast navigation / hashchange
                    .finally(() => {
                        this._manageFocus();
                    });
            }

            try {
                await transition.updateCallbackDone;
            } catch (_) {
                // AbortError: Transition was skipped
            }
        } catch (_err) {
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
