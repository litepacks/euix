/**
 * packages/core/src/core/parser/toon.js
 * Token-Oriented Object Notation (TOON) bi-directional serializer and parser.
 * Designed for LLM context injection, compact tabular arrays, and data_model state.
 */

/**
 * Parses a single CSV-like row handling quoted strings and escaped quotes.
 *
 * @param {string} rowStr
 * @returns {string[]}
 */
export function parseToonRow(rowStr) {
    const values = [];
    let current = "";
    let inQuotes = false;
    let i = 0;
    const len = rowStr.length;

    while (i < len) {
        const char = rowStr[i];
        if (char === "\\" && inQuotes && i + 1 < len) {
            const nextChar = rowStr[i + 1];
            if (nextChar === '"' || nextChar === "\\") {
                current += nextChar;
                i += 2;
                continue;
            }
        }

        if (char === '"') {
            if (inQuotes && i + 1 < len && rowStr[i + 1] === '"') {
                // Escaped quote: ""
                current += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === "," && !inQuotes) {
            values.push(current.trim());
            current = "";
            i++;
            continue;
        }

        current += char;
        i++;
    }

    values.push(current.trim());
    return values;
}

/**
 * Parses a string value into its native JS primitive type.
 *
 * @param {string} val
 * @returns {any}
 */
export function parseToonPrimitive(val) {
    if (val === undefined || val === null) return null;
    const trimmed = String(val).trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;

    // Quoted string
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/""/g, '"');
    }

    // Number check
    if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        if (!isNaN(num)) return num;
    }

    return trimmed;
}

/**
 * Formats a single primitive value into a TOON-safe string.
 *
 * @param {any} val
 * @returns {string}
 */
export function formatToonValue(val) {
    if (val === null) return "null";
    if (val === undefined) return "null";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return String(val);

    if (typeof val === "object") {
        return `"${JSON.stringify(val).replace(/"/g, '\\"')}"`;
    }

    const str = String(val);
    // Needs quotes if it contains comma, colon, newline, quotes, or leading/trailing whitespace
    if (/[\n\r,:"']/.test(str) || str.startsWith(" ") || str.endsWith(" ") || str === "") {
        return `"${str.replace(/"/g, '\\"')}"`;
    }

    // Avoid conflicting with boolean/null keywords if meant as string
    if (str === "true" || str === "false" || str === "null") {
        return `"${str}"`;
    }

    // Avoid conflicting with pure numbers if intended as string
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

    // 1. Array of Objects (Uniform Tabular)
    if (Array.isArray(data)) {
        const len = data.length;
        if (len === 0) {
            return `${pad}${rootName ? `${rootName}` : ""}[0]:`;
        }

        const isObjectArray = data.every((item) => typeof item === "object" && item !== null && !Array.isArray(item));

        if (isObjectArray) {
            // Collect unique column keys in order of appearance
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

        // 2. Array of Primitives
        const prefix = rootName ? rootName : "";
        const header = `${pad}${prefix}[${len}]:`;
        const rows = data.map((item) => `${pad}${formatToonValue(item)}`);
        return [header, ...rows].join("\n");
    }

    // 3. Object
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

    // 4. Single Primitive
    return `${pad}${rootName ? `${rootName}: ` : ""}${formatToonValue(data)}`;
}

/**
 * Parses a TOON string into native JavaScript objects, arrays, or primitives.
 *
 * @param {string} toonStr
 * @returns {any}
 */
export function toonToJson(toonStr) {
    if (!toonStr || typeof toonStr !== "string") return null;

    const rawLines = toonStr.split(/\r?\n/);
    const lines = [];
    for (const l of rawLines) {
        const trimmed = l.trim();
        // Ignore blank lines and comment lines
        if (trimmed && !trimmed.startsWith("#")) {
            lines.push(l);
        }
    }

    if (lines.length === 0) return null;

    // Check if entire input is an unnamed top-level array: [N]{...}: or [N]:
    const firstLine = lines[0].trim();
    const topArrayMatch = firstLine.match(/^\[(\d+)\](?:\{([^}]+)\})?:$/);

    if (topArrayMatch && lines.length > 1) {
        const count = parseInt(topArrayMatch[1], 10);
        const colsStr = topArrayMatch[2] || null;

        if (colsStr) {
            // Tabular array of objects
            const cols = parseToonRow(colsStr);
            const items = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].trim();
                if (!row) continue;
                if (row.match(/^\[\d+\]/)) break;
                const vals = parseToonRow(row);
                const obj = {};
                for (let c = 0; c < cols.length; c++) {
                    const colName = cols[c];
                    obj[colName] = parseToonPrimitive(vals[c]);
                }
                items.push(obj);
                if (items.length >= count) break;
            }
            return items;
        } else {
            // Primitive array
            const items = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].trim();
                if (!row) continue;
                if (row.match(/^\[\d+\]/)) break;
                const vals = parseToonRow(row);
                for (const v of vals) {
                    items.push(parseToonPrimitive(v));
                }
                if (items.length >= count) break;
            }
            return items;
        }
    }

    // General multi-key parser (supports multiple tables, objects, primitives)
    const result = {};
    let currentKey = null;
    let expectedCount = null;
    let currentTableCols = null;
    let currentTableItems = null;
    let currentPrimitiveList = null;

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const trimmed = line.trim();

        // 1. Table or array header: name[count]{cols}: or name[count]:
        const headerMatch = trimmed.match(/^([a-zA-Z0-9_$.-]+)\[(\d+)\](?:\{([^}]+)\})?:$/);
        if (headerMatch) {
            // Commit previous
            if (currentKey && currentTableItems) {
                result[currentKey] = currentTableItems;
            } else if (currentKey && currentPrimitiveList) {
                result[currentKey] = currentPrimitiveList;
            }

            currentKey = headerMatch[1];
            expectedCount = parseInt(headerMatch[2], 10);
            const colsStr = headerMatch[3];

            if (expectedCount === 0) {
                result[currentKey] = [];
                currentKey = null;
                expectedCount = null;
                currentTableCols = null;
                currentTableItems = null;
                currentPrimitiveList = null;
                continue;
            }

            if (colsStr) {
                currentTableCols = parseToonRow(colsStr);
                currentTableItems = [];
                currentPrimitiveList = null;
            } else {
                currentTableCols = null;
                currentTableItems = null;
                currentPrimitiveList = [];
            }
            continue;
        }

        // 2. Row belonging to active table
        if (currentTableCols && currentTableItems) {
            if (trimmed.includes(":") && !trimmed.startsWith('"')) {
                result[currentKey] = currentTableItems;
                currentKey = null;
                expectedCount = null;
                currentTableCols = null;
                currentTableItems = null;
            } else {
                const vals = parseToonRow(trimmed);
                const obj = {};
                for (let c = 0; c < currentTableCols.length; c++) {
                    obj[currentTableCols[c]] = parseToonPrimitive(vals[c]);
                }
                currentTableItems.push(obj);
                if (expectedCount !== null && currentTableItems.length >= expectedCount) {
                    result[currentKey] = currentTableItems;
                    currentKey = null;
                    expectedCount = null;
                    currentTableCols = null;
                    currentTableItems = null;
                }
                continue;
            }
        }

        // 3. Row belonging to primitive list
        if (currentPrimitiveList) {
            if (trimmed.includes(":") && !trimmed.startsWith('"')) {
                result[currentKey] = currentPrimitiveList;
                currentKey = null;
                expectedCount = null;
                currentPrimitiveList = null;
            } else {
                const vals = parseToonRow(trimmed);
                for (const v of vals) {
                    currentPrimitiveList.push(parseToonPrimitive(v));
                }
                if (expectedCount !== null && currentPrimitiveList.length >= expectedCount) {
                    result[currentKey] = currentPrimitiveList;
                    currentKey = null;
                    expectedCount = null;
                    currentPrimitiveList = null;
                }
                continue;
            }
        }

        // Commit previous list if moving to key: value
        if (currentKey && currentTableItems) {
            result[currentKey] = currentTableItems;
            currentKey = null;
            currentTableCols = null;
            currentTableItems = null;
        } else if (currentKey && currentPrimitiveList) {
            result[currentKey] = currentPrimitiveList;
            currentKey = null;
            currentPrimitiveList = null;
        }

        // 4. Simple key-value: key: value or nested key:
        const kvMatch = trimmed.match(/^([a-zA-Z0-9_$.-]+):(?:\s*(.*))?$/);
        if (kvMatch) {
            const k = kvMatch[1];
            const rawV = kvMatch[2];
            if (rawV !== undefined && rawV !== "") {
                result[k] = parseToonPrimitive(rawV);
            } else {
                // Nested object block
                const nestedObj = {};
                let j = idx + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextTrimmed = nextLine.trim();
                    const leadingSpaces = nextLine.search(/\S/);
                    if (leadingSpaces <= 0 || nextTrimmed.match(/^[a-zA-Z0-9_$.-]+\[\d+\]/)) {
                        break;
                    }
                    const subKv = nextTrimmed.match(/^([a-zA-Z0-9_$.-]+):(?:\s*(.*))?$/);
                    if (subKv) {
                        nestedObj[subKv[1]] = parseToonPrimitive(subKv[2] || "");
                    }
                    j++;
                }
                result[k] = nestedObj;
                idx = j - 1;
            }
        }
    }

    if (currentKey && currentTableItems) {
        result[currentKey] = currentTableItems;
    } else if (currentKey && currentPrimitiveList) {
        result[currentKey] = currentPrimitiveList;
    }

    return Object.keys(result).length > 0 ? result : null;
}
