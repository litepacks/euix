/**
 * packages/core/src/prepare/schema/index.js
 * Canonical EUIX Source JSON Schema (v1) and structural validator.
 */

export const EUIX_SCHEMA_VERSION = 1;

export const EUIX_SOURCE_SCHEMA = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "EUIX Source JSON Schema",
    version: EUIX_SCHEMA_VERSION,
    type: "object",
    properties: {
        version: { type: "integer", default: 1 },
        imports: {
            type: "object",
            additionalProperties: {
                anyOf: [
                    { type: "string" },
                    {
                        type: "object",
                        properties: {
                            src: { type: "string" },
                            as: { type: "string" },
                            lazy: { type: ["boolean", "string"] },
                            mode: { type: "string" },
                        },
                        required: ["src"],
                    },
                ],
            },
        },
        route: {
            anyOf: [
                { type: "string" },
                {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        name: { type: "string" },
                        meta: { type: "object" },
                    },
                    required: ["path"],
                },
            ],
        },
        props: {
            type: "object",
            additionalProperties: {
                anyOf: [
                    { type: "string" },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            default: {},
                            required: { type: "boolean" },
                        },
                    },
                ],
            },
        },
        state: {
            type: "object",
            additionalProperties: {},
        },
        computed: {
            type: "object",
            additionalProperties: {
                anyOf: [
                    { type: "string" },
                    {
                        type: "object",
                        properties: {
                            deps: { type: "array", items: { type: "string" } },
                            get: { type: "string" },
                        },
                    },
                ],
            },
        },
        watch: {
            type: "object",
            additionalProperties: {
                anyOf: [
                    { type: "string" },
                    {
                        type: "object",
                        properties: {
                            action: { type: "string" },
                            immediate: { type: "boolean" },
                            deep: { type: "boolean" },
                        },
                    },
                ],
            },
        },
        actions: {
            type: "object",
            additionalProperties: {
                anyOf: [
                    { type: "string" },
                    {
                        type: "object",
                        properties: {
                            call: { type: "string" },
                            args: { type: "array" },
                            assign: { type: "string" },
                            set: { type: "object" },
                            mutate: { type: "object" },
                            steps: { type: "array" },
                        },
                    },
                ],
            },
        },
        lifecycle: {
            type: "object",
            properties: {
                mount: {
                    type: "array",
                    items: {
                        anyOf: [
                            { type: "string" },
                            {
                                type: "object",
                                properties: {
                                    $action: { type: "string" },
                                    call: { type: "string" },
                                    args: { type: "array" },
                                },
                            },
                        ],
                    },
                },
                unmount: {
                    type: "array",
                    items: {
                        anyOf: [
                            { type: "string" },
                            {
                                type: "object",
                                properties: {
                                    $action: { type: "string" },
                                    call: { type: "string" },
                                    args: { type: "array" },
                                },
                            },
                        ],
                    },
                },
            },
        },
        provide: { type: "object" },
        inject: {
            anyOf: [
                { type: "array", items: { type: "string" } },
                { type: "object" },
            ],
        },
        components: {
            type: "object",
            additionalProperties: {
                type: "object",
            },
        },
        view: {
            anyOf: [
                { type: "object" },
                { type: "array" },
                { type: "string" },
            ],
        },
    },
    additionalProperties: true,
};

const ALLOWED_ROOT_KEYS = new Set([
    "version",
    "imports",
    "route",
    "props",
    "state",
    "computed",
    "watch",
    "actions",
    "lifecycle",
    "provide",
    "inject",
    "components",
    "view",
]);

/**
 * Lightweight structural validator for EUIX Source JSON.
 * Returns an array of error objects if structural violations are found.
 *
 * @param {any} source
 * @param {string} [fileName="source.euix.json"]
 * @returns {Array<{ path: string, message: string, code: string }>}
 */
export function validateSchema(source, fileName = "source.euix.json") {
    const errors = [];

    if (!source || typeof source !== "object" || Array.isArray(source)) {
        errors.push({
            code: "EUIX200",
            path: "",
            file: fileName,
            message: "Source must be a valid JSON object.",
        });
        return errors;
    }

    if (source.version !== undefined && typeof source.version !== "number") {
        errors.push({
            code: "EUIX200",
            path: "version",
            file: fileName,
            message: "Field 'version' must be a number.",
        });
    }

    if (source.imports !== undefined && (typeof source.imports !== "object" || source.imports === null || Array.isArray(source.imports))) {
        errors.push({
            code: "EUIX200",
            path: "imports",
            file: fileName,
            message: "Field 'imports' must be an object map.",
        });
    }

    if (source.state !== undefined && (typeof source.state !== "object" || source.state === null || Array.isArray(source.state))) {
        errors.push({
            code: "EUIX200",
            path: "state",
            file: fileName,
            message: "Field 'state' must be an object map.",
        });
    }

    if (source.actions !== undefined && (typeof source.actions !== "object" || source.actions === null || Array.isArray(source.actions))) {
        errors.push({
            code: "EUIX200",
            path: "actions",
            file: fileName,
            message: "Field 'actions' must be an object map.",
        });
    }

    if (source.lifecycle !== undefined && (typeof source.lifecycle !== "object" || source.lifecycle === null || Array.isArray(source.lifecycle))) {
        errors.push({
            code: "EUIX200",
            path: "lifecycle",
            file: fileName,
            message: "Field 'lifecycle' must be an object.",
        });
    }

    return errors;
}

export { generateSourceSchema } from "./ideSchema.js";
