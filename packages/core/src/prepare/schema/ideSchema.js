/**
 * packages/core/src/prepare/schema/ideSchema.js
 * Generates official Draft-07 JSON Schema for EUIX Source JSON representation (.euix.json).
 * Provides rich IntelliSense, autocompletion, property definitions, and validation for IDEs (VS Code, Cursor).
 */

/**
 * Returns the complete, official JSON Schema Draft-07 specification for EUIX Source JSON files.
 *
 * @returns {object} JSON Schema
 */
export function generateSourceSchema() {
    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://euix.org/schema/source.v1.json",
        title: "EUIX Source JSON Specification",
        description: "Official declarative JSON schema for EUIX Engine (euixjs) applications and components",
        type: "object",
        required: ["version", "view"],
        properties: {
            $schema: {
                type: "string",
                description: "URI or path of the JSON Schema validator",
            },
            version: {
                type: "integer",
                enum: [1],
                default: 1,
                description: "EUIX JSON Source Specification version (currently 1)",
            },
            imports: {
                type: "object",
                description: "Map of component, utility, and service imports",
                additionalProperties: {
                    anyOf: [
                        { type: "string", description: "Relative file path (e.g. ./components/UserCard.euix)" },
                        {
                            type: "object",
                            properties: {
                                src: { type: "string", description: "Path or URL of the imported module" },
                                as: { type: "string", description: "Import alias" },
                                lazy: { type: ["boolean", "string"], description: "Whether to lazy-load on view intersection" },
                                mode: { enum: ["async", "sync", "island"], description: "Component hydration/loading mode" },
                            },
                            required: ["src"],
                        },
                    ],
                },
            },
            route: {
                description: "Declarative page route path and metadata",
                anyOf: [
                    { type: "string", description: "Route path pattern (e.g. /users/:id)" },
                    {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Route path pattern (e.g. /users/:id)" },
                            name: { type: "string", description: "Named route identifier" },
                            meta: { type: "object", description: "Route metadata and auth guards" },
                        },
                        required: ["path"],
                    },
                ],
            },
            props: {
                type: "object",
                description: "Declared component input props, validation types, and default values",
                additionalProperties: {
                    anyOf: [
                        { type: "string", description: "Prop type (string, number, boolean, array, object, func)" },
                        {
                            type: "object",
                            properties: {
                                type: { type: "string", description: "Data type of the prop" },
                                default: { description: "Default fallback value" },
                                required: { type: "boolean", description: "Whether the prop is mandatory" },
                            },
                        },
                    ],
                },
            },
            state: {
                type: "object",
                description: "Reactive state model declaring initial values for primitives, arrays, and objects",
                additionalProperties: true,
            },
            computed: {
                type: "object",
                description: "Reactive computed properties with automatic dependency tracking",
                additionalProperties: {
                    anyOf: [
                        { type: "string", description: "Computed JavaScript getter expression" },
                        {
                            type: "object",
                            properties: {
                                deps: { type: "array", items: { type: "string" }, description: "Explicit state dependencies" },
                                get: { type: "string", description: "Expression or script returning the computed value" },
                            },
                            required: ["get"],
                        },
                    ],
                },
            },
            watch: {
                type: "object",
                description: "Reactive watchers that trigger actions upon state changes",
                additionalProperties: {
                    anyOf: [
                        { type: "string", description: "Action name to trigger upon state mutation" },
                        {
                            type: "object",
                            properties: {
                                action: { type: "string", description: "Action name to execute" },
                                immediate: { type: "boolean", description: "Whether to fire immediately upon component mount" },
                                deep: { type: "boolean", description: "Whether to deep watch nested object/array mutations" },
                            },
                            required: ["action"],
                        },
                    ],
                },
            },
            actions: {
                type: "object",
                description: "Declarative actions and business logic workflows",
                additionalProperties: {
                    $ref: "#/$defs/ActionDef",
                },
            },
            lifecycle: {
                type: "object",
                description: "Component lifecycle hook registrations (mount, unmount)",
                properties: {
                    mount: {
                        type: "array",
                        description: "Actions to execute when component mounts to the DOM",
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
                        description: "Actions to execute when component unmounts from the DOM",
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
            provide: {
                type: "object",
                description: "State or services provided to descendant components via context",
            },
            inject: {
                description: "State or services injected from ancestor components",
                anyOf: [
                    { type: "array", items: { type: "string" } },
                    { type: "object" },
                ],
            },
            components: {
                type: "object",
                description: "Local inline component definitions",
                additionalProperties: {
                    type: "object",
                },
            },
            view: {
                $ref: "#/$defs/ViewNode",
                description: "UI view tree specification",
            },
        },
        $defs: {
            ActionDef: {
                anyOf: [
                    { type: "string", description: "Service or handler method to invoke" },
                    {
                        type: "object",
                        properties: {
                            call: { type: "string", description: "Service or handler method name (e.g. api.getUser)" },
                            args: { type: "array", description: "Arguments to pass to the function" },
                            assign: { type: "string", description: "State key to store the return value" },
                            set: { type: "object", description: "Direct state mutation key-value pairs" },
                            mutate: {
                                type: "object",
                                description: "Array mutation operation (PUSH, REMOVE, CLEAR, etc.)",
                                properties: {
                                    target: { type: "string" },
                                    operation: { enum: ["PUSH", "REMOVE", "CLEAR", "SWAP", "REVERSE"] },
                                    item: {},
                                    where: { type: "object" },
                                },
                            },
                            steps: {
                                type: "array",
                                description: "Sequential composed action steps",
                                items: { $ref: "#/$defs/ActionDef" },
                            },
                        },
                    },
                ],
            },
            ViewNode: {
                anyOf: [
                    { type: "string", description: "Text content or expression (e.g. Hello {data.name})" },
                    {
                        type: "object",
                        properties: {
                            $bind: { type: "string", description: "Two-way state binding directive" },
                            $prop: { type: "string", description: "Prop binding directive" },
                            $route: { type: "string", description: "Route param binding directive" },
                            $action: { type: "string", description: "Action handler directive" },
                            tag: {
                                type: "string",
                                description: "HTML tag name (div, span, button, flex, grid, etc.)",
                            },
                            component: {
                                type: "string",
                                description: "Name of imported or registered component",
                            },
                            props: {
                                type: "object",
                                description: "Element attributes, styles, classes, and props",
                                additionalProperties: true,
                            },
                            events: {
                                type: "object",
                                description: "Event listeners (click, change, input, submit, etc.)",
                                additionalProperties: {
                                    anyOf: [
                                        { type: "string", description: "Action name" },
                                        {
                                            type: "object",
                                            properties: {
                                                $action: { type: "string", description: "Action name" },
                                            },
                                        },
                                    ],
                                },
                            },
                            for_each: {
                                anyOf: [
                                    { type: "string" },
                                    {
                                        type: "object",
                                        properties: {
                                            $bind: { type: "string" },
                                        },
                                    },
                                ],
                                description: "Array state binding for iteration",
                            },
                            var: { type: "string", description: "Iteration variable name (default: item)" },
                            index: { type: "string", description: "Iteration index variable name" },
                            key: { type: "string", description: "Key property for reconciliation" },
                            if: { description: "Conditional rendering expression" },
                            children: {
                                type: "array",
                                description: "Child view elements",
                                items: { $ref: "#/$defs/ViewNode" },
                            },
                        },
                    },
                    {
                        type: "array",
                        items: { $ref: "#/$defs/ViewNode" },
                    },
                ],
            },
        },
    };
}
