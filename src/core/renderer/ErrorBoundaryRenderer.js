import { EUIXStructuredError } from "../parser/errors.js";
import { _createShorthandActionNode } from "../actions/ActionDispatcher.js";

let _ebSeq = 0;
const genBoundaryId = () => `eb_${++_ebSeq}_${Math.random().toString(36).substring(2, 7)}`;

/**
 * Renders an <error_boundary> declarative template wrapper.
 * Isolates runtime exceptions, component render failures, and expression errors,
 * rendering a fallback UI while exposing error details and retry mechanisms.
 */
export function renderErrorBoundary(engine, xmlNode, context = {}) {
    const boundaryId =
        xmlNode.getAttribute("id") ||
        xmlNode.getAttribute("name") ||
        genBoundaryId();

    const boundaryName = xmlNode.getAttribute("name") || xmlNode.getAttribute("id") || boundaryId;

    const boundaryEl = document.createElement("div");
    boundaryEl.className = [
        "euix-error-boundary",
        engine.interpolate(xmlNode.getAttribute("class") || "", context),
    ]
        .filter(Boolean)
        .join(" ");

    const displayStyle = xmlNode.getAttribute("display");
    if (displayStyle) {
        boundaryEl.style.display = displayStyle;
    } else if (!xmlNode.getAttribute("class") && !xmlNode.getAttribute("style")) {
        boundaryEl.style.display = "contents";
    }

    if (typeof engine.applyLayoutStyles === "function") {
        engine.applyLayoutStyles(boundaryEl, xmlNode, context);
    }

    // Separate fallback template/tag from main child nodes
    let fallbackNode = null;
    let fallbackLet = "error";
    const mainNodes = [];

    const chNodes = xmlNode.childNodes || [];
    const chLen = chNodes.length;
    for (let i = 0; i < chLen; i++) {
        const c = chNodes[i];
        if (c.nodeType === 1) {
            const tag = (c.tagName || "").toLowerCase();
            if (
                tag === "fallback" ||
                (tag === "template" &&
                    (c.getAttribute("slot") === "fallback" ||
                        c.getAttribute("name") === "fallback" ||
                        c.getAttribute("id") === "fallback"))
            ) {
                fallbackNode = c;
                fallbackLet =
                    c.getAttribute("let") ||
                    c.getAttribute("var") ||
                    c.getAttribute("as") ||
                    c.getAttribute("slot_scope") ||
                    "error";
                continue;
            }
        }
        mainNodes.push(c);
    }

    const fallbackAttr = xmlNode.getAttribute("fallback");
    const onErrorAttr =
        xmlNode.getAttribute("on_error") ||
        xmlNode.getAttribute("on-error") ||
        xmlNode.getAttribute("error_handler");

    let hasError = false;
    let currentError = null;

    const boundaryController = {
        id: boundaryId,
        name: boundaryName,
        el: boundaryEl,
        get hasError() {
            return hasError;
        },
        get error() {
            return currentError;
        },
        catchError(err) {
            hasError = true;
            currentError = {
                message: err?.message || String(err),
                code: err?.code || "RUNTIME_ERROR",
                name: err?.name || "Error",
                stack: err?.stack || "",
                raw: err,
            };

            // Clear boundary children
            boundaryEl.innerHTML = "";
            boundaryEl.dataset.euixBoundaryError = "true";

            // Render Fallback UI
            if (fallbackNode) {
                const fallbackContext = {
                    ...context,
                    [fallbackLet]: currentError,
                    $error: currentError,
                    error: currentError,
                    err: currentError,
                    _errorBoundary: boundaryController,
                };
                const fNodes = fallbackNode.childNodes || [];
                const fLen = fNodes.length;
                for (let j = 0; j < fLen; j++) {
                    const fEl = engine.createHTMLElement(fNodes[j], fallbackContext);
                    if (fEl) boundaryEl.appendChild(fEl);
                }
            } else if (fallbackAttr) {
                const fallbackText = engine.interpolate(fallbackAttr, {
                    ...context,
                    error: currentError,
                    $error: currentError,
                    err: currentError,
                });
                const span = document.createElement("div");
                span.className = "euix-error-fallback";
                span.textContent = fallbackText;
                boundaryEl.appendChild(span);
            }

            // Emit hook & log devtools
            if (engine.hooks) {
                engine.hooks.emit("error:boundary", {
                    boundaryId,
                    name: boundaryName,
                    error: currentError,
                    element: boundaryEl,
                });
            }

            if (engine._devtools?.logAction) {
                engine._devtools.logAction("ERROR_BOUNDARY", {
                    path: boundaryName,
                    value: currentError.message,
                    status: "error",
                });
            }

            // Execute on_error action shorthand or attribute if present
            if (onErrorAttr) {
                try {
                    const syntheticNode = _createShorthandActionNode("error", "auto", onErrorAttr, xmlNode);
                    if (syntheticNode) {
                        engine.handleAction(syntheticNode, {
                            ...context,
                            $error: currentError,
                            error: currentError,
                        });
                    }
                } catch (_) {}
            }
        },
        retry() {
            hasError = false;
            currentError = null;
            boundaryEl.innerHTML = "";
            delete boundaryEl.dataset.euixBoundaryError;
            renderChildren();
        },
        reset() {
            this.retry();
        },
    };

    boundaryEl._errorBoundary = boundaryController;
    if (!engine._errorBoundaries) engine._errorBoundaries = new Map();
    engine._errorBoundaries.set(boundaryId, boundaryController);
    if (boundaryName && boundaryName !== boundaryId) {
        engine._errorBoundaries.set(boundaryName, boundaryController);
    }

    function renderChildren() {
        try {
            const childContext = {
                ...context,
                _errorBoundary: boundaryController,
            };
            for (let i = 0; i < mainNodes.length; i++) {
                const childEl = engine.createHTMLElement(mainNodes[i], childContext);
                if (childEl) boundaryEl.appendChild(childEl);
            }
        } catch (err) {
            boundaryController.catchError(err);
        }
    }

    renderChildren();
    return engine.applyRef(boundaryEl, xmlNode, context);
}
