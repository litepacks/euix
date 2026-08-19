/**
 * src/plugins/router/server/hydration.js
 * Hydration state serialization, XSS escaping, and client rehydration.
 */

/**
 * Safely serializes hydration state into an inline <script> tag with XSS mitigation.
 * @param {object} hydrationData 
 * @returns {string}
 */
export function serializeHydrationState(hydrationData = {}) {
    const json = JSON.stringify(hydrationData)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\//g, "\\u002f");

    return `<script type="application/json" id="__EUIX_ROUTER_DATA__">${json}</script>`;
}

/**
 * Extracts and parses hydration state from document on the client.
 * @returns {object|null}
 */
export function getHydrationData() {
    if (typeof document === "undefined") return null;
    const scriptEl = document.getElementById("__EUIX_ROUTER_DATA__");
    if (!scriptEl) return null;

    try {
        return JSON.parse(scriptEl.textContent);
    } catch (err) {
        console.error("[EUIXRouter] Failed to parse hydration data:", err);
        return null;
    }
}
