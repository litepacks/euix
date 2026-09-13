/**
 * src/core/parser/errors.js
 * Line & column accurate error classes and structured action errors for EUIX Engine.
 */

/**
 * EUIXXMLParseError
 * Line & column accurate error for EUIX Engine XML templates with visual code frame.
 */
export class EUIXXMLParseError extends Error {
    constructor(message, line = 1, column = 1, codeFrame = "", sourceXml = "") {
        super(message);
        this.name = "EUIXXMLParseError";
        this.code = "XML_PARSE_ERROR";
        this.line = line;
        this.column = column;
        this.codeFrame = codeFrame;
        this.sourceXml = sourceXml;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * EUIXStructuredError
 * Categorized, structured error object for EUIX Engine actions.
 */
export class EUIXStructuredError extends Error {
    constructor({
        message = "An action execution error occurred",
        code = "ACTION_EXECUTION_ERROR",
        originatingAction = "UNKNOWN",
        status = null,
        request = null,
        component = null,
        cause = null,
        caller = null,
        sourceLocation = null,
    } = {}) {
        super(message);
        this.name = "EUIXStructuredError";
        this.code = code;
        this.originatingAction = originatingAction;
        this.status = status;
        this.request = request;
        this.component = component;
        this.cause = cause;
        this.caller = caller;
        this.sourceLocation = sourceLocation;
        this.timestamp = new Date().toISOString();

        if (cause?.stack) {
            this.stack = cause.stack;
        }
    }

    static from(err, defaultInfo = {}) {
        if (err instanceof EUIXStructuredError || (err && err.name === "EUIXStructuredError")) {
            if (defaultInfo.component && !err.component) err.component = defaultInfo.component;
            if (defaultInfo.originatingAction && (!err.originatingAction || err.originatingAction === "UNKNOWN")) {
                err.originatingAction = defaultInfo.originatingAction;
            }
            return err;
        }

        let code = defaultInfo.code || "ACTION_EXECUTION_ERROR";
        const message = err?.message ? err.message : String(err || "Unknown error");
        const status = defaultInfo.status || err?.status || null;
        const request = defaultInfo.request || err?.request || null;

        if (err && err.name === "EUIXActionValidationError") {
            code = "VALIDATION_ERROR";
        } else if (err && err.name === "EUIXActionRecursionError") {
            code = "ACTION_RECURSION_ERROR";
        } else if (err?.code) {
            code = err.code;
        } else if (status || code?.startsWith("API_")) {
            code = code || "API_HTTP_ERROR";
        }

        return new EUIXStructuredError({
            message,
            code,
            originatingAction: defaultInfo.originatingAction || "UNKNOWN",
            status,
            request,
            component: defaultInfo.component || null,
            cause: err instanceof Error ? err : null,
            caller: defaultInfo.caller || null,
            sourceLocation: defaultInfo.sourceLocation || null,
        });
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            originatingAction: this.originatingAction,
            status: this.status,
            request: this.request,
            component: this.component,
            timestamp: this.timestamp,
        };
    }
}
