/**
 * src/plugins/a11y/focusTrap.js
 * Automated WAI-ARIA Focus Trap & Keyboard Navigation utility for EUIX Engine.
 */

export const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'area[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    "iframe",
    "object",
    "embed",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]:not([tabindex="-1"])',
].join(", ");

/**
 * Returns all focusable and visible elements inside container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
    if (!container || !container.querySelectorAll) return [];
    const elements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    return elements.filter((el) => {
        if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
        // Check visibility if element has offsetParent or layout
        if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
            // In headless/JSDOM environments getClientRects might be 0, so check style display
            const style = el.style || {};
            if (style.display === "none" || style.visibility === "hidden") return false;
        }
        return true;
    });
}

/**
 * Creates an accessible Focus Trap manager for a modal or container element.
 * @param {HTMLElement} container - The container element to trap focus within.
 * @param {Object} options - Focus trap configuration options.
 * @param {HTMLElement|string} [options.initialFocus] - Element or selector to focus initially.
 * @param {HTMLElement} [options.returnFocusElement] - Element to restore focus to on deactivate.
 * @param {Function} [options.onEscape] - Callback when Escape key is pressed.
 * @param {boolean} [options.allowOutsideClick] - Whether to allow clicks outside container.
 * @returns {{ activate: Function, deactivate: Function, getFocusables: Function }}
 */
export function createFocusTrap(container, options = {}) {
    let active = false;
    let previousActiveElement =
        options.returnFocusElement || (typeof document !== "undefined" ? document.activeElement : null);

    function handleKeyDown(e) {
        if (!active || !container) return;

        if (e.key === "Escape") {
            if (typeof options.onEscape === "function") {
                e.stopPropagation();
                options.onEscape(e);
            }
            return;
        }

        if (e.key !== "Tab") return;

        const focusables = getFocusableElements(container);
        if (focusables.length === 0) {
            e.preventDefault();
            if (container.focus) container.focus();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = container.ownerDocument ? container.ownerDocument.activeElement : document.activeElement;

        if (e.shiftKey) {
            // Shift + Tab (Backward cycling)
            if (current === first || !container.contains(current)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            // Tab (Forward cycling)
            if (current === last || !container.contains(current)) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    return {
        activate() {
            if (active) return;
            active = true;
            previousActiveElement =
                options.returnFocusElement || (typeof document !== "undefined" ? document.activeElement : null);

            container.addEventListener("keydown", handleKeyDown);

            // Determine initial element to focus
            let targetToFocus = null;
            if (options.initialFocus) {
                if (typeof options.initialFocus === "string") {
                    targetToFocus = container.querySelector(options.initialFocus);
                } else if (options.initialFocus instanceof HTMLElement) {
                    targetToFocus = options.initialFocus;
                }
            }

            if (!targetToFocus) {
                const focusables = getFocusableElements(container);
                targetToFocus = focusables.length > 0 ? focusables[0] : container;
            }

            if (targetToFocus && typeof targetToFocus.focus === "function") {
                // Ensure container or target is focusable
                if (targetToFocus === container && !container.hasAttribute("tabindex")) {
                    container.setAttribute("tabindex", "-1");
                }
                setTimeout(() => {
                    try {
                        targetToFocus.focus();
                    } catch {
                        // ignore focus errors in non-browser env
                    }
                }, 0);
            }
        },

        deactivate() {
            if (!active) return;
            active = false;
            container.removeEventListener("keydown", handleKeyDown);

            if (previousActiveElement && typeof previousActiveElement.focus === "function") {
                try {
                    previousActiveElement.focus();
                } catch {
                    // element may have been unmounted
                }
            }
        },

        getFocusables() {
            return getFocusableElements(container);
        },

        isActive() {
            return active;
        },
    };
}
