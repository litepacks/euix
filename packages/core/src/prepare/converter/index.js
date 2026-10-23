import { safeParse } from "../../core/utils/constants.js";
/**
 * packages/core/src/prepare/converter/index.js
 * Bi-directional converter between EUIX XML (<uid_spec>) and EUIX Canonical JSON (.euix.json).
 */

import { jsonToXml } from "./jsonToXml.js";
import { parseXmlToJson } from "../parser/xmlToJson.js";
import { jsonToToon, toonToJson } from "./toon.js";

/**
 * Converts EUIX XML string to canonical JSON representation.
 *
 * @param {string} xmlString
 * @param {string} [fileName="source.euix"]
 * @returns {object} Canonical EUIX Source JSON object
 */
export function xmlToJson(xmlString, fileName = "source.euix") {
    const { source, diagnostics } = parseXmlToJson(xmlString, fileName);
    if (!source) {
        const firstErr = diagnostics.find((d) => d.severity === "error") || diagnostics[0];
        throw new Error(`XML to JSON conversion failed: ${firstErr?.message || "Unknown error"}`);
    }
    return source;
}

/**
 * Converts EUIX XML string directly to TOON representation.
 *
 * @param {string} xmlString
 * @param {string} [fileName="source.euix"]
 * @returns {string} TOON formatted string
 */
export function xmlToToon(xmlString, fileName = "source.euix") {
    const source = xmlToJson(xmlString, fileName);
    return jsonToToon(source);
}

/**
 * Converts TOON string to EUIX XML representation.
 *
 * @param {string} toonStr
 * @param {object} [options={}]
 * @returns {string} EUIX XML string
 */
export function toonToXml(toonStr, options = {}) {
    const parsed = toonToJson(toonStr);
    return jsonToXml(parsed, options);
}

/**
 * Bi-directionally converts between EUIX XML, Canonical JSON, and TOON.
 *
 * @param {string|object} source - Input XML string, JSON object/string, or TOON string
 * @param {object} [options={}]
 * @param {"xml"|"json"|"toon"|"auto"} [options.targetFormat="auto"]
 * @param {string} [options.fileName="source"]
 * @returns {string} Converted text output (XML, JSON, or TOON string)
 */
export function convert(source, options = {}) {
    const targetFormat = options.targetFormat || options.format || "auto";
    const fileName = options.fileName || "source";

    // If source is a JS object
    if (typeof source === "object" && source !== null) {
        if (targetFormat === "json") {
            return JSON.stringify(source, null, 2);
        }
        if (targetFormat === "toon") {
            return jsonToToon(source, options);
        }
        return jsonToXml(source, options);
    }

    if (typeof source !== "string") {
        throw new Error(`Unsupported source type: ${typeof source}. Expected object or string.`);
    }

    const trimmed = source.trim();
    const isXml = trimmed.startsWith("<") || trimmed.includes("<uid_spec");
    const isJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));

    if (isXml) {
        // XML input
        if (targetFormat === "xml") {
            return source;
        }
        const jsonSource = xmlToJson(trimmed, fileName);
        if (targetFormat === "toon") {
            return jsonToToon(jsonSource, options);
        }
        return JSON.stringify(jsonSource, null, 2);
    }

    if (isJson) {
        // JSON string input
        const parsedJson = safeParse(trimmed, null);

        if (!parsedJson) {
            throw new Error("Failed to parse JSON input string.");
        }

        if (targetFormat === "json") {
            return JSON.stringify(parsedJson, null, 2);
        }
        if (targetFormat === "toon") {
            return jsonToToon(parsedJson, options);
        }
        return jsonToXml(parsedJson, options);
    }

    // TOON string input
    const parsedFromToon = toonToJson(trimmed);
    if (!parsedFromToon) {
        throw new Error("Failed to parse TOON input string.");
    }

    if (targetFormat === "toon") {
        return trimmed;
    }
    if (targetFormat === "xml") {
        return jsonToXml(parsedFromToon, options);
    }
    return JSON.stringify(parsedFromToon, null, 2);
}

export { jsonToToon, toonToJson, jsonToXml };

