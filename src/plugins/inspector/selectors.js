/**
 * src/plugins/inspector/selectors.js
 * Stable E2E Selector Generator, Scorer, and Code Formatter for EUIX Inspector.
 */

/**
 * Checks how many elements in the document match a given CSS selector.
 */
export function checkUniqueness(selector, doc = document) {
    if (!selector || !doc || typeof doc.querySelectorAll !== "function") {
        return { isUnique: false, count: 0 };
    }
    try {
        const matches = doc.querySelectorAll(selector);
        return {
            isUnique: matches.length === 1,
            count: matches.length,
        };
    } catch (_) {
        return { isUnique: false, count: 0 };
    }
}

/**
 * Derives accessible role and name for an element.
 */
export function getAccessibleInfo(el) {
    if (!el || el.nodeType !== 1) return null;
    const tagName = el.tagName.toLowerCase();
    let role = el.getAttribute("role");
    if (!role) {
        if (tagName === "button") role = "button";
        else if (tagName === "a" && el.hasAttribute("href")) role = "link";
        else if (tagName === "input") {
            const type = el.getAttribute("type") || "text";
            if (type === "checkbox") role = "checkbox";
            else if (type === "radio") role = "radio";
            else if (type === "button" || type === "submit") role = "button";
            else role = "textbox";
        } else if (tagName === "select") role = "combobox";
        else if (tagName === "textarea") role = "textbox";
        else if (
            tagName === "h1" ||
            tagName === "h2" ||
            tagName === "h3" ||
            tagName === "h4" ||
            tagName === "h5" ||
            tagName === "h6"
        )
            role = "heading";
        else if (tagName === "img") role = "img";
        else if (tagName === "dialog") role = "dialog";
    }

    let name = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt");
    if (!name && (role === "button" || role === "link" || role === "heading")) {
        const text = el.textContent ? el.textContent.trim().replace(/\s+/g, " ") : "";
        if (text.length > 0 && text.length <= 40) {
            name = text;
        }
    }
    if (!name && el.getAttribute("placeholder")) {
        name = el.getAttribute("placeholder");
    }

    return role && name ? { role, name } : role ? { role, name: "" } : null;
}

function safeEscape(str) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(str);
    }
    return String(str).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

/**
 * Builds a CSS structural selector walking up the DOM hierarchy.
 */
export function getCssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && !/^\d/.test(el.id)) {
        return `#${safeEscape(el.id)}`;
    }

    const path = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr !== document.body && curr !== document.documentElement) {
        let selector = curr.tagName.toLowerCase();
        if (curr.id && !/^\d/.test(curr.id)) {
            selector = `#${safeEscape(curr.id)}`;
            path.unshift(selector);
            break;
        } else {
            const className = typeof curr.className === "string" ? curr.className.trim() : "";
            const validClasses = className
                .split(/\s+/)
                .filter(
                    (c) => c && !c.startsWith("euix-") && !c.startsWith("is-") && !c.includes(":") && !c.includes("["),
                );
            if (validClasses.length > 0) {
                selector += `.${validClasses
                    .slice(0, 2)
                    .map((c) => safeEscape(c))
                    .join(".")}`;
            }
        }
        path.unshift(selector);
        curr = curr.parentElement;
        if (path.length >= 4) break;
    }
    return path.join(" > ");
}

/**
 * Builds an nth-child structural path fallback.
 */
export function getNthChildPath(el) {
    if (!el || el.nodeType !== 1) return "";
    const path = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr !== document.body && curr !== document.documentElement) {
        let index = 1;
        let sibling = curr.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === curr.tagName) index++;
            sibling = sibling.previousElementSibling;
        }
        const tag = curr.tagName.toLowerCase();
        path.unshift(`${tag}:nth-of-type(${index})`);
        curr = curr.parentElement;
        if (path.length >= 4) break;
    }
    return path.join(" > ");
}

/**
 * Generates ranked stable selector alternatives for a given DOM element.
 */
export function generateSelectors(element, doc = document) {
    if (!element || element.nodeType !== 1) return [];

    const candidates = [];
    const tagName = element.tagName.toLowerCase();

    // 1. Explicit Test ID (Score: 100)
    const testId =
        element.getAttribute("data-euix-test") ||
        element.getAttribute("test-id") ||
        element.getAttribute("data-testid");
    if (testId) {
        const sel = `[data-euix-test="${testId}"]`;
        const uniq = checkUniqueness(sel, doc);
        candidates.push({
            type: "test-id",
            label: "Test ID",
            selector: sel,
            rawId: testId,
            score: uniq.isUnique ? 100 : 85,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.getByTestId('${testId}')`,
            cypress: `cy.get('[data-euix-test="${testId}"]')`,
            vanilla: `document.querySelector('[data-euix-test="${testId}"]')`,
        });
    }

    // 2. Accessible Role / Name (Score: 90)
    const accessInfo = getAccessibleInfo(element);
    if (accessInfo && accessInfo.name) {
        const ariaSel = `[aria-label="${accessInfo.name}"]`;
        const uniq = checkUniqueness(ariaSel, doc);
        candidates.push({
            type: "accessible",
            label: "Accessible Role & Name",
            selector: ariaSel,
            role: accessInfo.role,
            name: accessInfo.name,
            score: uniq.isUnique ? 90 : 75,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.getByRole('${accessInfo.role}', { name: '${accessInfo.name.replace(/'/g, "\\'")}' })`,
            cypress: `cy.get('${ariaSel}')`,
            vanilla: `document.querySelector('${ariaSel}')`,
        });
    }

    // 3. EUIX Semantic Action / Ref (Score: 85)
    const action = element.getAttribute("data-euix-action") || element.getAttribute("action");
    if (action) {
        const sel = `[data-euix-action="${action}"]`;
        const uniq = checkUniqueness(sel, doc);
        candidates.push({
            type: "action",
            label: "EUIX Action",
            selector: sel,
            score: uniq.isUnique ? 85 : 70,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${sel}')`,
            cypress: `cy.get('${sel}')`,
            vanilla: `document.querySelector('${sel}')`,
        });
    }

    const ref =
        element.dataset?.euixRef ||
        element.dataset?.xuiRef ||
        element.getAttribute("data-euix-ref") ||
        element.getAttribute("data-xui-ref");
    if (ref) {
        const sel = `[data-euix-ref="${ref}"]`;
        const uniq = checkUniqueness(sel, doc);
        candidates.push({
            type: "ref",
            label: "EUIX Ref",
            selector: sel,
            score: uniq.isUnique ? 80 : 65,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${sel}')`,
            cypress: `cy.get('${sel}')`,
            vanilla: `document.querySelector('${sel}')`,
        });
    }

    // 4. Component Scoped Selector (Score: 75)
    const compEl = element.closest("[data-euix-component], [data-xui-component]");
    if (compEl) {
        const compName = compEl.dataset.euixComponent || compEl.dataset.xuiComponent;
        let scopedSel = `[data-euix-component="${compName}"] ${tagName}`;
        if (element.getAttribute("name")) {
            scopedSel = `[data-euix-component="${compName}"] ${tagName}[name="${element.getAttribute("name")}"]`;
        } else if (action) {
            scopedSel = `[data-euix-component="${compName}"] [data-euix-action="${action}"]`;
        }
        const uniq = checkUniqueness(scopedSel, doc);
        candidates.push({
            type: "component-scoped",
            label: "Component Scoped",
            selector: scopedSel,
            component: compName,
            score: uniq.isUnique ? 75 : 55,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${scopedSel}')`,
            cypress: `cy.get('${scopedSel}')`,
            vanilla: `document.querySelector('${scopedSel}')`,
        });
    }

    // 5. Stable DOM Attributes (Score: 60)
    if (element.id && !/^\d/.test(element.id)) {
        const idSel = `#${safeEscape(element.id)}`;
        const uniq = checkUniqueness(idSel, doc);
        candidates.push({
            type: "id",
            label: "ID Attribute",
            selector: idSel,
            score: uniq.isUnique ? 70 : 40,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${idSel}')`,
            cypress: `cy.get('${idSel}')`,
            vanilla: `document.querySelector('${idSel}')`,
        });
    }

    if (element.getAttribute("name")) {
        const nameSel = `${tagName}[name="${element.getAttribute("name")}"]`;
        const uniq = checkUniqueness(nameSel, doc);
        candidates.push({
            type: "name",
            label: "Name Attribute",
            selector: nameSel,
            score: uniq.isUnique ? 65 : 45,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${nameSel}')`,
            cypress: `cy.get('${nameSel}')`,
            vanilla: `document.querySelector('${nameSel}')`,
        });
    }

    // 6. CSS Structural Hierarchy (Score: 40)
    const cssPath = getCssPath(element);
    if (cssPath) {
        const uniq = checkUniqueness(cssPath, doc);
        candidates.push({
            type: "css",
            label: "CSS Hierarchy",
            selector: cssPath,
            score: uniq.isUnique ? 40 : 25,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${cssPath}')`,
            cypress: `cy.get('${cssPath}')`,
            vanilla: `document.querySelector('${cssPath}')`,
        });
    }

    // 7. nth-child Fallback (Score: 20)
    const nthPath = getNthChildPath(element);
    if (nthPath && nthPath !== cssPath) {
        const uniq = checkUniqueness(nthPath, doc);
        candidates.push({
            type: "nth-child",
            label: "DOM Structural Path",
            selector: nthPath,
            score: uniq.isUnique ? 20 : 10,
            isUnique: uniq.isUnique,
            matchCount: uniq.count,
            playwright: `page.locator('${nthPath}')`,
            cypress: `cy.get('${nthPath}')`,
            vanilla: `document.querySelector('${nthPath}')`,
        });
    }

    // Sort descending by score, unique selectors prioritized
    return candidates.sort((a, b) => {
        if (a.isUnique && !b.isUnique) return -1;
        if (!a.isUnique && b.isUnique) return 1;
        return b.score - a.score;
    });
}
