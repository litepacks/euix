/**
 * src/plugins/a11y/announcer.js
 * Screen Reader Live Region Announcer & Keyboard Navigation Helpers for EUIX.
 */

const liveAnnouncerEl = null;

/**
 * Gets or creates a singleton visually-hidden ARIA live region element for screen readers.
 * @param {Document} [doc] - Owner document
 * @param {"polite"|"assertive"} [priority="polite"]
 * @returns {HTMLElement}
 */
export function getOrCreateAnnouncer(doc = typeof document !== "undefined" ? document : null, priority = "polite") {
    if (!doc) return null;

    const id = `euix-a11y-announcer-${priority}`;
    let el = doc.getElementById(id);
    if (!el) {
        el = doc.createElement("div");
        el.id = id;
        el.setAttribute("aria-live", priority);
        el.setAttribute("aria-atomic", "true");
        el.setAttribute("role", priority === "assertive" ? "alert" : "status");
        el.style.cssText = [
            "position: absolute",
            "width: 1px",
            "height: 1px",
            "padding: 0",
            "margin: -1px",
            "overflow: hidden",
            "clip: rect(0, 0, 0, 0)",
            "white-space: nowrap",
            "border: 0",
        ].join("; ");

        if (doc.body) {
            doc.body.appendChild(el);
        }
    }
    return el;
}

/**
 * Announces a message to screen readers via ARIA live region.
 * @param {string} message - Message text to announce
 * @param {"polite"|"assertive"} [priority="polite"] - Urgency level
 * @param {Document} [doc] - Target document
 */
export function announce(message, priority = "polite", doc = typeof document !== "undefined" ? document : null) {
    if (!message || !doc) return;
    const announcer = getOrCreateAnnouncer(doc, priority);
    if (!announcer) return;

    // Reset content first so repeating messages trigger announcements
    announcer.textContent = "";
    setTimeout(() => {
        announcer.textContent = message;
    }, 50);
}

/**
 * Sets up roving tabindex keyboard navigation across a list of items (e.g. accordion headers, tabs, toolbar items).
 * @param {HTMLElement[]} items - List of interactive elements
 * @param {Object} [options]
 * @param {"horizontal"|"vertical"|"both"} [options.orientation="vertical"]
 * @param {boolean} [options.loop=true]
 */
export function setupRovingTabIndex(items, options = {}) {
    if (!items || items.length === 0) return;
    const orientation = options.orientation || "vertical";
    const loop = options.loop !== false;

    items.forEach((item, index) => {
        item.setAttribute("tabindex", index === 0 ? "0" : "-1");

        item.addEventListener("keydown", (e) => {
            let nextIndex = -1;
            const currentIndex = items.indexOf(item);

            const isNext =
                (orientation !== "horizontal" && e.key === "ArrowDown") ||
                (orientation !== "vertical" && e.key === "ArrowRight");
            const isPrev =
                (orientation !== "horizontal" && e.key === "ArrowUp") ||
                (orientation !== "vertical" && e.key === "ArrowLeft");

            if (isNext) {
                e.preventDefault();
                nextIndex = currentIndex + 1;
                if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
            } else if (isPrev) {
                e.preventDefault();
                nextIndex = currentIndex - 1;
                if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
            } else if (e.key === "Home") {
                e.preventDefault();
                nextIndex = 0;
            } else if (e.key === "End") {
                e.preventDefault();
                nextIndex = items.length - 1;
            }

            if (nextIndex !== -1 && items[nextIndex]) {
                items.forEach((it, i) => it.setAttribute("tabindex", i === nextIndex ? "0" : "-1"));
                items[nextIndex].focus();
            }
        });
    });
}
