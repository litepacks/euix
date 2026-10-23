/**
 * packages/core/src/prepare/converter/toon.js
 * TOON serializer and converter for the prepare subsystem.
 */

export { parseToonRow, parseToonPrimitive, toonToJson } from "../../core/parser/toon.js";

/**
 * Formats a primitive or string value for TOON serialization.
 *
 * @param {any} val
 * @returns {string}
 */
export function formatToonValue(val) {
    if (val === null || val === undefined) return "null";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return String(val);

    if (typeof val === "object") {
        return `"${JSON.stringify(val).replace(/"/g, '\\"')}"`;
    }

    const str = String(val);
    if (/[\n\r,:"']/.test(str) || str.startsWith(" ") || str.endsWith(" ") || str === "") {
        return `"${str.replace(/"/g, '\\"')}"`;
    }

    if (str === "true" || str === "false" || str === "null") {
        return `"${str}"`;
    }

    if (/^-?\d+(?:\.\d+)?$/.test(str) && typeof val === "string") {
        return `"${str}"`;
    }

    return str;
}

/**
 * Converts a JavaScript value (array or object) into TOON format string.
 *
 * @param {any} data
 * @param {object} [options={}]
 * @param {string} [options.rootName]
 * @param {number} [options.indent=0]
 * @returns {string}
 */
export function jsonToToon(data, options = {}) {
    const indent = options.indent || 0;
    const pad = " ".repeat(indent);
    const rootName = options.rootName || "";

    if (data === null || data === undefined) {
        return `${pad}${rootName ? `${rootName}: ` : ""}null`;
    }

    if (Array.isArray(data)) {
        const len = data.length;
        if (len === 0) {
            return `${pad}${rootName ? `${rootName}` : ""}[0]:`;
        }

        const isObjectArray = data.every((item) => typeof item === "object" && item !== null && !Array.isArray(item));

        if (isObjectArray) {
            const colSet = new Set();
            for (const item of data) {
                for (const k of Object.keys(item)) {
                    colSet.add(k);
                }
            }
            const cols = Array.from(colSet);
            const prefix = rootName ? rootName : "";
            const header = `${pad}${prefix}[${len}]{${cols.join(",")}}:`;

            const rows = data.map((item) => {
                const rowValues = cols.map((col) => formatToonValue(item[col]));
                return `${pad}${rowValues.join(",")}`;
            });

            return [header, ...rows].join("\n");
        }

        const prefix = rootName ? rootName : "";
        const header = `${pad}${prefix}[${len}]:`;
        const rows = data.map((item) => `${pad}${formatToonValue(item)}`);
        return [header, ...rows].join("\n");
    }

    if (typeof data === "object") {
        const lines = [];
        if (rootName) {
            lines.push(`${pad}${rootName}:`);
        }
        const innerPad = rootName ? " ".repeat(indent + 2) : pad;

        for (const [key, val] of Object.entries(data)) {
            if (Array.isArray(val)) {
                lines.push(jsonToToon(val, { rootName: key, indent: rootName ? indent + 2 : indent }));
            } else if (typeof val === "object" && val !== null) {
                lines.push(`${innerPad}${key}:`);
                for (const [subKey, subVal] of Object.entries(val)) {
                    if (typeof subVal === "object" && subVal !== null) {
                        lines.push(jsonToToon(subVal, { rootName: subKey, indent: (rootName ? indent + 4 : indent + 2) }));
                    } else {
                        lines.push(`${" ".repeat(rootName ? indent + 4 : indent + 2)}${subKey}: ${formatToonValue(subVal)}`);
                    }
                }
            } else {
                lines.push(`${innerPad}${key}: ${formatToonValue(val)}`);
            }
        }
        return lines.join("\n");
    }

    return `${pad}${rootName ? `${rootName}: ` : ""}${formatToonValue(data)}`;
}
