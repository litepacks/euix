/**
 * packages/core/src/prepare/converter/index.js
 * Bi-directional converter between EUIX XML (<uid_spec>) and EUIX Canonical JSON (.euix.json).
 */

import { jsonToXml } from "./jsonToXml.js";
import { parseXmlToJson } from "../parser/xmlToJson.js";

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
 * Bi-directionally converts between EUIX XML and Canonical JSON.
 *
 * @param {string|object} source - Input XML string or JSON object/string
 * @param {object} [options={}]
 * @param {"xml"|"json"|"auto"} [options.targetFormat="auto"]
 * @param {string} [options.fileName="source"]
 * @returns {string} Converted text output (XML or formatted JSON string)
 */
export function convert(source, options = {}) {
    const targetFormat = options.targetFormat || options.format || "auto";
    const fileName = options.fileName || "source";

    // If source is a JS object
    if (typeof source === "object" && source !== null) {
        if (targetFormat === "json") {
            return JSON.stringify(source, null, 2);
        }
        return jsonToXml(source, options);
    }

    if (typeof source !== "string") {
        throw new Error(`Unsupported source type: ${typeof source}. Expected object or string.`);
    }

    const trimmed = source.trim();
    const isXml = trimmed.startsWith("<") || trimmed.includes("<uid_spec");

    if (isXml) {
        // XML input
        if (targetFormat === "xml") {
            // Already XML
            return source;
        }
        const jsonSource = xmlToJson(trimmed, fileName);
        return JSON.stringify(jsonSource, null, 2);
    }

    // JSON string input
    const parsedJson = JSON.parse(trimmed);
    if (targetFormat === "json") {
        return JSON.stringify(parsedJson, null, 2);
    }
    return jsonToXml(parsedJson, options);
}

export { jsonToXml };
