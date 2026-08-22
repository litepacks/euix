/**
 * src/plugins/inspector/playwright.js
 * Playwright E2E Test Helper Suite for EUIX Engine.
 */

/**
 * Creates a chainable EUIX Playwright helper wrapper around a Playwright Page or Locator.
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} pageOrLocator
 */
export function euix(pageOrLocator) {
    return new EuixPlaywrightWrapper(pageOrLocator);
}

/**
 * Standalone locator helper for finding elements by EUIX component name.
 */
export function getByComponent(pageOrLocator, componentName) {
    return pageOrLocator.locator(`[data-euix-component="${componentName}"], [data-xui-component="${componentName}"]`);
}

/**
 * Standalone locator helper for finding elements by EUIX action name.
 */
export function getByAction(pageOrLocator, actionName) {
    return pageOrLocator.locator(`[data-euix-action*="${actionName}"], [action="${actionName}"]`);
}

/**
 * Standalone locator helper for finding elements by EUIX test ID.
 */
export function getByTestId(pageOrLocator, testId) {
    return pageOrLocator.locator(`[data-euix-test="${testId}"], [data-testid="${testId}"], [test-id="${testId}"]`);
}

export class EuixPlaywrightWrapper {
    constructor(pageOrLocator, scopeSelector = "") {
        this.context = pageOrLocator;
        this.scopeSelector = scopeSelector;
        this.page =
            typeof pageOrLocator.evaluate === "function" && typeof pageOrLocator.locator === "function"
                ? pageOrLocator
                : pageOrLocator.page();
    }

    /**
     * Resolves a Locator within the current scope.
     */
    _getLocator(selector) {
        if (!this.scopeSelector) {
            return this.context.locator(selector);
        }
        return this.context.locator(`${this.scopeSelector} ${selector}`);
    }

    /**
     * Scopes locator to a specific component.
     */
    component(componentName) {
        const compSel = `[data-euix-component="${componentName}"], [data-xui-component="${componentName}"]`;
        const newScope = this.scopeSelector ? `${this.scopeSelector} ${compSel}` : compSel;
        return new EuixPlaywrightWrapper(this.context, newScope);
    }

    /**
     * Finds an element by defined action.
     */
    action(actionName) {
        return this._getLocator(`[data-euix-action*="${actionName}"], [action="${actionName}"]`);
    }

    /**
     * Finds an element by test ID.
     */
    getByTestId(testId) {
        return this._getLocator(`[data-euix-test="${testId}"], [data-testid="${testId}"], [test-id="${testId}"]`);
    }

    testId(testId) {
        return this.getByTestId(testId);
    }

    /**
     * Finds an element by EUIX reference name or selector.
     */
    element(refOrSelector) {
        if (refOrSelector.startsWith(".") || refOrSelector.startsWith("#") || refOrSelector.startsWith("[")) {
            return this._getLocator(refOrSelector);
        }
        return this._getLocator(`[data-xui-ref="${refOrSelector}"]`);
    }

    /**
     * Waits for the EUIX runtime to reach an idle state.
     * Checks pending actions, loaders, revalidations, and route transitions.
     */
    async waitForIdle(options = {}) {
        const timeout = options.timeout || 10000;
        const page = this.page;

        await page.waitForFunction(
            () => {
                const dev = window.__EUIX_DEVTOOLS__;
                if (!dev) return true;
                return (
                    (dev.pendingActions || 0) === 0 &&
                    (dev.pendingLoaders || 0) === 0 &&
                    (dev.pendingRevalidations || 0) === 0 &&
                    !dev.routeTransition
                );
            },
            { timeout },
        );

        return this;
    }

    /**
     * Waits for a component to be ready in the DOM.
     */
    async waitForReady(options = {}) {
        const locator = this.scopeSelector ? this.context.locator(this.scopeSelector) : this.context;
        await locator.waitFor({ state: "visible", timeout: options.timeout || 5000 });
        await this.waitForIdle(options);
        return this;
    }

    /**
     * Extracts debug snapshot from the browser context and prints formatted output.
     */
    async debug() {
        const selector = this.scopeSelector || "body";
        const snapshot = await this.page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            if (window.$euix && typeof window.$euix.snapshot === "function") {
                return window.$euix.snapshot(el);
            }
            return {
                component: el.dataset?.euixComponent || el.dataset?.xuiComponent || "Unknown",
                tagName: el.tagName.toLowerCase(),
                testId: el.getAttribute("data-euix-test") || el.getAttribute("test-id"),
                action: el.getAttribute("data-euix-action") || el.getAttribute("action"),
            };
        }, selector);

        const formatted = `
==============================================
EUIX DEBUG SNAPSHOT (${this.scopeSelector || "root"})
==============================================
Component: ${snapshot?.component || "N/A"}
Instance ID: ${snapshot?.componentId || "N/A"}
Route: ${snapshot?.route || "N/A"}

Props:
${JSON.stringify(snapshot?.props || {}, null, 2)}

Local State:
${JSON.stringify(snapshot?.localState || {}, null, 2)}

Global State:
${JSON.stringify(snapshot?.globalState || {}, null, 2)}

Bindings:
${(snapshot?.bindings || []).join(", ") || "None"}

Actions:
${(snapshot?.actions || []).join(", ") || "None"}
==============================================
        `;

        if (typeof console !== "undefined" && console.log) {
            console.log(formatted);
        }

        return snapshot;
    }

    /**
     * Proxy locator methods (click, fill, textContent, etc.) directly.
     */
    locator(selector) {
        return this._getLocator(selector);
    }

    click(options) {
        return this._getLocator("").click(options);
    }

    fill(value, options) {
        return this._getLocator("").fill(value, options);
    }

    textContent() {
        return this._getLocator("").textContent();
    }
}

export default euix;
