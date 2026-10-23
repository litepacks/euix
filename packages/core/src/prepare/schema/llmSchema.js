/**
 * packages/core/src/prepare/schema/llmSchema.js
 * Generates constrained, LLM-targeted JSON Schemas for Structured Outputs
 * (OpenAI Structured Outputs, Gemini JSON Mode, Anthropic Tool Calling).
 * Injects dynamic project state, component, and action enums to prevent hallucinations.
 */

import { generateSourceSchema } from "./ideSchema.js";
import { generateLlmContext } from "../context/index.js";

/**
 * Recursively deep clones an object.
 *
 * @param {any} obj
 * @returns {any}
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    const copy = {};
    for (const [k, v] of Object.entries(obj)) {
        copy[k] = deepClone(v);
    }
    return copy;
}

const COMMON_EVENT_NAMES = [
    "click",
    "change",
    "input",
    "submit",
    "keydown",
    "keyup",
    "focus",
    "blur",
];

const COMMON_HTML_PROPS = [
    "id",
    "class",
    "style",
    "type",
    "placeholder",
    "disabled",
    "value",
    "name",
    "direction",
    "gap",
    "align",
    "justify",
    "title",
    "href",
    "src",
    "alt",
    "bind",
];

/**
 * Recursively applies strict OpenAI Structured Output rules (additionalProperties: false, all properties in required).
 *
 * @param {object} schema
 */
function makeSchemaStrict(schema) {
    if (!schema || typeof schema !== "object") return;

    if (schema.type === "object" || (schema.properties && !schema.type)) {
        schema.type = "object";
        schema.additionalProperties = false;
        if (!schema.properties) {
            schema.properties = {};
        }
        schema.required = Object.keys(schema.properties);
        for (const propVal of Object.values(schema.properties)) {
            makeSchemaStrict(propVal);
        }
    }

    if (schema.items) {
        if (Array.isArray(schema.items)) {
            schema.items.forEach(makeSchemaStrict);
        } else {
            makeSchemaStrict(schema.items);
        }
    }

    if (schema.anyOf) {
        schema.anyOf.forEach(makeSchemaStrict);
    }
    if (schema.oneOf) {
        schema.oneOf.forEach(makeSchemaStrict);
    }
    if (schema.allOf) {
        schema.allOf.forEach(makeSchemaStrict);
    }
    if (schema.$defs) {
        for (const def of Object.values(schema.$defs)) {
            makeSchemaStrict(def);
        }
    }
    if (schema.definitions) {
        for (const def of Object.values(schema.definitions)) {
            makeSchemaStrict(def);
        }
    }
}

/**
 * Generates a constrained JSON Schema tailored for LLM code generation.
 * Can extract available states, actions, components, and routes dynamically from a project path.
 *
 * @param {object} [options={}]
 * @param {string[]} [options.states=[]] - Available state identifiers in data_model
 * @param {string[]} [options.actions=[]] - Available custom actions and workflow names
 * @param {string[]} [options.components=[]] - Available registered/imported component names
 * @param {string[]} [options.routes=[]] - Available route paths
 * @param {string} [options.projectPath] - Path to scan for states/actions/components/routes
 * @param {boolean} [options.strict=false] - Whether to enforce OpenAI Structured Outputs strict mode
 * @returns {Promise<object>} Tailored JSON Schema
 */
export async function generateLlmSchema(options = {}) {
    let states = options.states ? [...options.states] : [];
    let actions = options.actions ? [...options.actions] : [];
    let components = options.components ? [...options.components] : [];
    let routes = options.routes ? [...options.routes] : [];

    // Dynamically scan project context if projectPath is provided
    if (options.projectPath) {
        try {
            const ctx = await generateLlmContext(options.projectPath);
            if (ctx?.data) {
                if (states.length === 0 && ctx.data.states) {
                    states = ctx.data.states.map((s) => s.name);
                }
                if (actions.length === 0 && ctx.data.actions) {
                    actions = [...ctx.data.actions];
                }
                if (components.length === 0 && ctx.data.components) {
                    components = ctx.data.components.map((c) => c.name);
                }
                if (routes.length === 0 && ctx.data.routes) {
                    routes = ctx.data.routes.map((r) => r.path);
                }
            }
        } catch (_) {}
    }

    const baseSchema = deepClone(generateSourceSchema());

    // Initialize custom $defs for constrained entities
    baseSchema.$defs = baseSchema.$defs || {};

    // 1. StateKey definition
    baseSchema.$defs.StateKey = states.length > 0
        ? {
              type: "string",
              enum: states,
              description: `Must be one of the known project states: [${states.join(", ")}]`,
          }
        : {
              type: "string",
              description: "State identifier in data_model",
          };

    // 2. ActionName definition
    baseSchema.$defs.ActionName = actions.length > 0
        ? {
              type: "string",
              enum: actions,
              description: `Must be one of the known actions: [${actions.join(", ")}]`,
          }
        : {
              type: "string",
              description: "Action or workflow name",
          };

    // 3. ComponentName definition
    baseSchema.$defs.ComponentName = components.length > 0
        ? {
              type: "string",
              enum: components,
              description: `Must be one of the registered components: [${components.join(", ")}]`,
          }
        : {
              type: "string",
              description: "Registered component tag name",
          };

    // 4. Inject constraints into ViewNode
    const viewNodeObj = baseSchema.$defs.ViewNode?.anyOf?.find(
        (entry) => entry.type === "object" && entry.properties,
    );

    if (viewNodeObj && viewNodeObj.properties) {
        // Constrain $bind to known states
        viewNodeObj.properties.$bind = { $ref: "#/$defs/StateKey" };

        // Constrain component to known components if components exist
        if (components.length > 0) {
            viewNodeObj.properties.component = { $ref: "#/$defs/ComponentName" };
        }

        // Constrain for_each array binding
        viewNodeObj.properties.for_each = {
            anyOf: [
                { $ref: "#/$defs/StateKey" },
                {
                    type: "object",
                    properties: {
                        $bind: { $ref: "#/$defs/StateKey" },
                    },
                    required: ["$bind"],
                },
            ],
            description: "Array state binding for iteration",
        };

        // Constrain event handlers to known actions or declarative operations
        viewNodeObj.properties.events = {
            type: "object",
            description: "Event handlers (click, change, submit, etc.)",
            additionalProperties: {
                anyOf: [
                    { $ref: "#/$defs/ActionName" },
                    {
                        type: "object",
                        properties: {
                            $action: { $ref: "#/$defs/ActionName" },
                            set: { type: "string", description: "Shorthand state set (e.g. counter=counter+1)" },
                            toggle: { $ref: "#/$defs/StateKey" },
                            mutate: { type: "string", description: "Array mutation (e.g. items.REMOVE where id={item.id})" },
                            revalidate: { type: "string", description: "API endpoint tag to revalidate" },
                            run: { type: "string", description: "Inline JS script (wrapped in CDATA if containing operators)" },
                        },
                    },
                ],
            },
        };
    }

    // 5. Inject constraints into ActionDef
    const actionDefObj = baseSchema.$defs.ActionDef?.anyOf?.find(
        (entry) => entry.type === "object" && entry.properties,
    );

    if (actionDefObj && actionDefObj.properties) {
        actionDefObj.properties.assign = { $ref: "#/$defs/StateKey" };
        if (actionDefObj.properties.mutate && actionDefObj.properties.mutate.properties) {
            actionDefObj.properties.mutate.properties.target = { $ref: "#/$defs/StateKey" };
        }
    }

    // 6. Route constraints
    if (routes.length > 0 && baseSchema.properties.route) {
        baseSchema.properties.route = {
            anyOf: [
                { type: "string", enum: routes, description: "Known project route path" },
                {
                    type: "object",
                    properties: {
                        path: { type: "string", enum: routes },
                        name: { type: "string" },
                        meta: { type: "object" },
                    },
                    required: ["path"],
                },
            ],
        };
    }

    // 7. Strict mode for OpenAI Structured Outputs
    if (options.strict) {
        if (viewNodeObj && viewNodeObj.properties) {
            // Explicitly define common HTML props for strict mode
            const propProperties = {};
            for (const p of COMMON_HTML_PROPS) {
                propProperties[p] = {
                    anyOf: [
                        { type: "string" },
                        { type: "number" },
                        { type: "boolean" },
                        { type: "null" },
                    ],
                };
            }
            viewNodeObj.properties.props = {
                type: "object",
                properties: propProperties,
                additionalProperties: false,
            };

            // Explicitly define common event names for strict mode
            const eventItemSchema = {
                anyOf: [
                    { $ref: "#/$defs/ActionName" },
                    {
                        type: "object",
                        properties: {
                            $action: { anyOf: [{ $ref: "#/$defs/ActionName" }, { type: "null" }] },
                            set: { anyOf: [{ type: "string" }, { type: "null" }] },
                            toggle: { anyOf: [{ $ref: "#/$defs/StateKey" }, { type: "null" }] },
                            mutate: { anyOf: [{ type: "string" }, { type: "null" }] },
                            revalidate: { anyOf: [{ type: "string" }, { type: "null" }] },
                            run: { anyOf: [{ type: "string" }, { type: "null" }] },
                        },
                    },
                    { type: "null" },
                ],
            };
            const eventProperties = {};
            for (const evt of COMMON_EVENT_NAMES) {
                eventProperties[evt] = eventItemSchema;
            }
            viewNodeObj.properties.events = {
                type: "object",
                properties: eventProperties,
                additionalProperties: false,
            };
        }

        if (baseSchema.properties.state) {
            const stateProps = {};
            for (const s of states) {
                stateProps[s] = {
                    anyOf: [
                        { type: "string" },
                        { type: "number" },
                        { type: "boolean" },
                        { type: "array", items: {} },
                        { type: "object" },
                        { type: "null" },
                    ],
                };
            }
            baseSchema.properties.state = {
                type: "object",
                properties: stateProps,
                additionalProperties: false,
            };
        }

        makeSchemaStrict(baseSchema);
    }

    return baseSchema;
}

/**
 * Formats a generated schema for OpenAI Structured Outputs response_format.
 *
 * @param {object} schema
 * @param {string} [name="euix_source"]
 * @returns {object}
 */
export function formatOpenAiStructuredOutput(schema, name = "euix_source") {
    const strictSchema = deepClone(schema);
    makeSchemaStrict(strictSchema);
    return {
        type: "json_schema",
        json_schema: {
            name,
            strict: true,
            schema: strictSchema,
        },
    };
}

/**
 * Formats a generated schema for Google Gemini JSON Mode.
 *
 * @param {object} schema
 * @returns {object}
 */
export function formatGeminiResponseSchema(schema) {
    return {
        responseMimeType: "application/json",
        responseSchema: deepClone(schema),
    };
}
