import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXComposerPlugin } from '../src/plugins/EUIXComposerPlugin.js';
import { EUIXRouterPlugin } from '../src/plugins/EUIXRouterPlugin.js';
import {
    EUIXWebMCPPlugin,
    WebMCPPlugin,
    EUIXWebMCPError,
    EUIXWebMCPManager,
    compileJsonSchema,
    validateInput,
    sanitizeResult,
    parseXmlToolDef,
} from '../src/plugins/EUIXWebMCPPlugin.js';

describe('EUIXWebMCPPlugin Test Suite', () => {
    let container;
    let mockModelContext;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        // Ensure plugins are installed on core
        EUIXEngineCore.use(EUIXComposerPlugin);
        EUIXEngineCore.use(EUIXRouterPlugin);
        EUIXEngineCore.use(EUIXWebMCPPlugin);

        // Setup mock document.modelContext
        mockModelContext = {
            registerTool: vi.fn(),
            unregisterTool: vi.fn(),
            getTools: vi.fn(() => []),
            executeTool: vi.fn(),
        };
        document.modelContext = mockModelContext;
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        delete document.modelContext;
        vi.restoreAllMocks();
    });

    describe('1. Feature Detection & Progressive Enhancement', () => {
        it('should correctly detect WebMCP support when document.modelContext is present', () => {
            const engine = new EUIXEngineCore(container);
            expect(engine.webmcp.isSupported()).toBe(true);
            expect(engine.webmcp.getNativeContext()).toBe(mockModelContext);
        });

        it('should gracefully handle unsupported browsers when document.modelContext is absent', () => {
            delete document.modelContext;
            const engine = new EUIXEngineCore(container);
            expect(engine.webmcp.isSupported()).toBe(false);
            expect(engine.webmcp.getNativeContext()).toBeNull();

            // Registering should not throw in unsupported browser
            expect(() => {
                engine.webmcp.register({
                    name: 'test_tool',
                    description: 'A test tool',
                    execute: () => ({ success: true }),
                });
            }).not.toThrow();

            expect(engine.webmcp.has('test_tool')).toBe(true);
            expect(mockModelContext.registerTool).not.toHaveBeenCalled();
        });

        it('should mount declarative XML with <webmcp> without throwing when unsupported', () => {
            delete document.modelContext;
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">ready</state>
                    </data_model>
                    <webmcp>
                        <tool name="check_status" description="Returns status" action="status.check" />
                    </webmcp>
                    <flex>
                        <div id="content">{data.status}</div>
                    </flex>
                </uid_spec>
            `;

            let engine;
            expect(() => {
                engine = EUIXEngineCore.mount(xml, container);
            }).not.toThrow();

            expect(container.querySelector('#content').textContent).toBe('ready');
            expect(engine.webmcp.has('check_status')).toBe(true);
        });
    });

    describe('2. Plugin Initialization & Options', () => {
        it('should support WebMCPPlugin factory with options', () => {
            const customPlugin = WebMCPPlugin({
                debug: false,
                strict: true,
                defaults: {
                    annotations: { readOnlyHint: true },
                    exposedTo: ['https://example.com'],
                },
            });

            expect(customPlugin.name).toBe('webmcp');
            expect(typeof customPlugin.install).toBe('function');
        });

        it('should respect dynamic enabled predicate option', () => {
            let allowWebMCP = false;
            const engine = new EUIXEngineCore(container);
            engine._webmcpManager = new EUIXWebMCPManager(engine, {
                enabled: () => allowWebMCP,
            });

            engine.webmcp.register({
                name: 'disabled_tool',
                execute: () => ({}),
            });

            expect(mockModelContext.registerTool).not.toHaveBeenCalled();

            allowWebMCP = true;
            engine.webmcp.register({
                name: 'enabled_tool',
                execute: () => ({}),
            });

            expect(mockModelContext.registerTool).toHaveBeenCalled();
        });
    });

    describe('3. Imperative Tool Registration & Management', () => {
        it('should register a tool with document.modelContext and track in list()', () => {
            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({
                name: 'create_task',
                title: 'Create Task',
                description: 'Creates a new task',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                    },
                    required: ['title'],
                },
                execute: async ({ title }, ctx) => {
                    return { id: 1, title };
                },
            });

            expect(engine.webmcp.has('create_task')).toBe(true);
            expect(engine.webmcp.get('create_task').title).toBe('Create Task');
            expect(mockModelContext.registerTool).toHaveBeenCalledTimes(1);

            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];
            expect(registeredTool.name).toBe('create_task');
            expect(registeredTool.title).toBe('Create Task');
            expect(registeredTool.description).toBe('Creates a new task');
            expect(registeredTool.inputSchema.properties.title.type).toBe('string');

            const list = engine.webmcp.list();
            expect(list.length).toBe(1);
            expect(list[0].name).toBe('create_task');
        });

        it('should unregister a tool and clear all tools', () => {
            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({ name: 'tool_1', execute: () => ({}) });
            engine.webmcp.register({ name: 'tool_2', execute: () => ({}) });

            expect(engine.webmcp.list().length).toBe(2);

            engine.webmcp.unregister('tool_1');
            expect(engine.webmcp.has('tool_1')).toBe(false);
            expect(engine.webmcp.has('tool_2')).toBe(true);

            engine.webmcp.clear();
            expect(engine.webmcp.list().length).toBe(0);
        });

        it('should throw or warn on duplicate tool registration in strict mode', () => {
            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({ name: 'unique_tool', execute: () => ({}) });

            expect(() => {
                engine.webmcp.register({ name: 'unique_tool', execute: () => ({}) });
            }).toThrowError(/already registered/);
        });

        it('should throw on invalid tool names', () => {
            const engine = new EUIXEngineCore(container);
            expect(() => {
                engine.webmcp.register({ name: 'invalid name with spaces!', execute: () => ({}) });
            }).toThrowError(EUIXWebMCPError);
        });
    });

    describe('4. JSON Schema Compilation & Input Validation', () => {
        it('should compile parameter list into JSON Schema correctly', () => {
            const params = [
                { name: 'query', type: 'string', required: true, description: 'Search term', minLength: 2, maxLength: 50 },
                { name: 'limit', type: 'number', default: 10, minimum: 1, maximum: 100 },
                { name: 'status', type: 'string', enum: 'todo,doing,done', default: 'todo' },
                { name: 'active', type: 'boolean', default: 'true' },
                { name: 'tags', type: 'array', items: 'string' },
            ];

            const schema = compileJsonSchema(params);
            expect(schema.type).toBe('object');
            expect(schema.required).toEqual(['query']);
            expect(schema.properties.query.type).toBe('string');
            expect(schema.properties.query.minLength).toBe(2);
            expect(schema.properties.query.maxLength).toBe(50);
            expect(schema.properties.limit.type).toBe('number');
            expect(schema.properties.limit.default).toBe(10);
            expect(schema.properties.status.enum).toEqual(['todo', 'doing', 'done']);
            expect(schema.properties.active.default).toBe(true);
            expect(schema.properties.tags.items.type).toBe('string');
        });

        it('should validate inputs against schema and populate defaults', () => {
            const schema = {
                type: 'object',
                properties: {
                    title: { type: 'string', minLength: 3 },
                    count: { type: 'number', minimum: 1, default: 5 },
                    role: { type: 'string', enum: ['admin', 'user'], default: 'user' },
                },
                required: ['title'],
            };

            const validated = validateInput({ title: 'Hello World' }, schema);
            expect(validated.title).toBe('Hello World');
            expect(validated.count).toBe(5);
            expect(validated.role).toBe('user');
        });

        it('should throw validation error when required parameter is missing or invalid', () => {
            const schema = {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    age: { type: 'integer', minimum: 18 },
                },
                required: ['title'],
            };

            expect(() => validateInput({}, schema)).toThrowError(EUIXWebMCPError);
            expect(() => validateInput({ title: 'Bob', age: 15 }, schema)).toThrowError(EUIXWebMCPError);
            expect(() => validateInput({ title: 'Bob', age: 18.5 }, schema)).toThrowError(/integer/);
        });
    });

    describe('5. Declarative XML Syntax (<webmcp> and <webmcp_tool>)', () => {
        it('should parse and register declarative tools from XML', () => {
            const xml = `
                <uid_spec>
                    <actions>
                        <action_def name="task.create">
                            <param name="title" required="true" />
                            <step action="SET_STATE">
                                <path>data.lastTask</path>
                                <value>{args.title}</value>
                            </step>
                            <return>{"success": true, "task": "{args.title}"}</return>
                        </action_def>
                    </actions>
                    <data_model>
                        <state id="lastTask"></state>
                    </data_model>
                    <webmcp>
                        <tool
                            name="create_task"
                            title="Create Task"
                            description="Creates a new task in EUIX"
                            action="task.create">
                            <param name="title" type="string" required="true" description="Task title" />
                        </tool>
                        <tool
                            name="get_last_task"
                            description="Returns last task"
                            action="task.getLast"
                            readonly="true"
                            expose-to="https://app.example.com"
                        />
                    </webmcp>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.webmcp.has('create_task')).toBe(true);
            expect(engine.webmcp.has('get_last_task')).toBe(true);

            const tool1 = engine.webmcp.get('create_task');
            expect(tool1.title).toBe('Create Task');
            expect(tool1.inputSchema.properties.title.type).toBe('string');
            expect(tool1.inputSchema.required).toEqual(['title']);

            const tool2 = engine.webmcp.get('get_last_task');
            expect(tool2.readonly).toBe(true);
            expect(tool2.exposedTo).toBe('https://app.example.com');
        });

        it('should support raw JSON schema inside <schema> node in declarative tool', () => {
            const xml = `
                <uid_spec>
                    <webmcp>
                        <tool name="custom_schema_tool" action="dummy">
                            <schema>
                                {
                                    "type": "object",
                                    "properties": {
                                        "rawField": { "type": "string" }
                                    },
                                    "required": ["rawField"]
                                }
                            </schema>
                        </tool>
                    </webmcp>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const tool = engine.webmcp.get('custom_schema_tool');
            expect(tool.inputSchema.properties.rawField.type).toBe('string');
            expect(tool.inputSchema.required).toEqual(['rawField']);
        });
    });

    describe('6. Action Execution Pipeline Integration', () => {
        it('should invoke EUIX Action Composer workflows and return structured result', async () => {
            const xml = `
                <uid_spec>
                    <actions>
                        <action_def name="task.add">
                            <param name="title" required="true" />
                            <param name="priority" default="normal" />
                            <step action="SET_STATE">
                                <path>data.currentTask</path>
                                <value>{args.title}</value>
                            </step>
                            <return>{"created": true, "title": "{args.title}", "priority": "{args.priority}"}</return>
                        </action_def>
                    </actions>
                    <data_model>
                        <state id="currentTask"></state>
                    </data_model>
                    <webmcp>
                        <tool name="add_task" action="task.add">
                            <param name="title" type="string" required="true" />
                            <param name="priority" type="string" default="normal" />
                        </tool>
                    </webmcp>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];

            const result = await registeredTool.execute({ title: 'Deploy App', priority: 'high' });
            expect(result).toEqual({ created: true, title: 'Deploy App', priority: 'high' });
            expect(engine.getState('currentTask')).toBe('Deploy App');
            expect(engine.getState('$webmcp').lastResult).toEqual(result);
        });

        it('should invoke custom registered actions through EUIXEngineCore.registerAction', async () => {
            EUIXEngineCore.registerAction('CUSTOM_CALC', (actionNode, ctx) => {
                return { result: Number(ctx.a) + Number(ctx.b) };
            });

            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({
                name: 'calculate_sum',
                action: 'CUSTOM_CALC',
                inputSchema: {
                    type: 'object',
                    properties: {
                        a: { type: 'number' },
                        b: { type: 'number' },
                    },
                    required: ['a', 'b'],
                },
            });

            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];
            const res = await registeredTool.execute({ a: 10, b: 25 });
            expect(res).toEqual({ result: 35 });
        });

        it('should support custom execute functions with restricted execution context', async () => {
            const engine = new EUIXEngineCore(container);
            engine.initDataModel();
            engine.setState('userRole', 'admin');

            let capturedContext;
            engine.webmcp.register({
                name: 'get_user_info',
                execute: async (input, ctx) => {
                    capturedContext = ctx;
                    return { role: ctx.state.get('userRole') };
                },
            });

            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];
            const res = await registeredTool.execute({});

            expect(res).toEqual({ role: 'admin' });
            expect(capturedContext.state).toBeDefined();
            expect(capturedContext.actions).toBeDefined();
            expect(typeof capturedContext.state.get).toBe('function');
            expect(typeof capturedContext.actions.run).toBe('function');
        });
    });

    describe('7. Result Sanitization & Circular Reference Protection', () => {
        it('should strip DOM elements, functions, and circular references from results', () => {
            const circularObj = { name: 'safe' };
            circularObj.self = circularObj;

            const complexResult = {
                id: 123,
                text: 'Safe text',
                element: document.createElement('div'),
                windowObj: window,
                actionFn: () => {},
                circular: circularObj,
                nested: {
                    count: 42,
                    arr: [1, 2, document.createElement('span'), { ok: true }],
                },
            };

            const sanitized = sanitizeResult(complexResult);
            expect(sanitized.id).toBe(123);
            expect(sanitized.text).toBe('Safe text');
            expect(sanitized.element).toBeUndefined();
            expect(sanitized.windowObj).toBeUndefined();
            expect(sanitized.actionFn).toBeUndefined();
            expect(sanitized.circular).toEqual({ name: 'safe' });
            expect(sanitized.nested.count).toBe(42);
            expect(sanitized.nested.arr).toEqual([1, 2, { ok: true }]);
        });
    });

    describe('8. Router Integration', () => {
        it('should support router navigation actions from WebMCP tools', async () => {
            const xml = `
                <uid_spec>
                    <router mode="memory">
                        <route path="/" id="home_route" />
                        <route path="/tasks" id="tasks_route" />
                        <route path="/settings" id="settings_route" />
                    </router>
                    <webmcp>
                        <tool name="navigate_to" action="router.navigate">
                            <param name="path" type="string" required="true" />
                        </tool>
                    </webmcp>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];

            await registeredTool.execute({ path: '/settings' });
            expect(engine.router.location.pathname).toBe('/settings');
        });
    });

    describe('9. Lifecycle Management & AbortSignal Cleanup', () => {
        it('should abort signal and unregister tool when component unmounts or engine destroys', () => {
            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({
                name: 'temp_tool',
                execute: () => ({}),
            });

            expect(engine.webmcp.has('temp_tool')).toBe(true);

            // Destroy engine
            engine.destroy();
            expect(engine.webmcp.has('temp_tool')).toBe(false);
            expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('temp_tool');
        });

        it('should propagate client AbortSignal to action execution and abort if cancelled', async () => {
            const engine = new EUIXEngineCore(container);
            engine.webmcp.register({
                name: 'cancellable_tool',
                execute: async (input, ctx) => {
                    if (ctx.signal?.aborted) {
                        throw new Error('Operation aborted');
                    }
                    return { success: true };
                },
            });

            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];
            const abortController = new AbortController();
            abortController.abort();

            await expect(registeredTool.execute({}, { signal: abortController.signal })).rejects.toThrowError(
                /cancelled|aborted/i,
            );
        });
    });

    describe('10. Dynamic State-Dependent Tools (if="..." condition)', () => {
        it('should reactively register and unregister tool based on state changes', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="isAuthenticated" type="boolean">false</state>
                    </data_model>
                    <webmcp>
                        <tool
                            name="admin_action"
                            description="Admin only tool"
                            action="admin.do"
                            if="{data.isAuthenticated}"
                        />
                    </webmcp>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Initially false -> not registered
            expect(engine.webmcp.has('admin_action')).toBe(false);

            // Authenticate user -> tool becomes registered
            engine.setState('isAuthenticated', true);
            expect(engine.webmcp.has('admin_action')).toBe(true);
            expect(mockModelContext.registerTool).toHaveBeenCalled();

            // Log out -> tool unregisters
            engine.setState('isAuthenticated', false);
            expect(engine.webmcp.has('admin_action')).toBe(false);
        });
    });

    describe('11. HTML Form Attribute Preservation', () => {
        it('should preserve native WebMCP declarative form attributes in rendered DOM', () => {
            const xml = `
                <uid_spec>
                    <form
                        id="support_form"
                        toolname="createSupportRequest"
                        tooldescription="Create a customer support request"
                        toolparamdescription="Support ticket payload">
                        <input name="subject" placeholder="Subject" />
                    </form>
                </uid_spec>
            `;

            EUIXEngineCore.mount(xml, container);
            const formEl = container.querySelector('#support_form');

            expect(formEl).not.toBeNull();
            expect(formEl.getAttribute('toolname')).toBe('createSupportRequest');
            expect(formEl.getAttribute('tooldescription')).toBe('Create a customer support request');
            expect(formEl.getAttribute('toolparamdescription')).toBe('Support ticket payload');
        });
    });

    describe('12. Component-Local Tools & Lifecycle Cleanup', () => {
        it('should register tool declared inside a component and clean up when component unmounts', () => {
            const xml = `
                <uid_spec>
                    <component_def name="task-widget" isolated="true">
                        <webmcp>
                            <tool name="widget_tool" action="dummy" />
                        </webmcp>
                        <div>Widget Content</div>
                    </component_def>
                    <data_model>
                        <state id="showWidget" type="boolean">true</state>
                    </data_model>
                    <flex>
                        <if condition="{data.showWidget}">
                            <component name="task-widget" />
                        </if>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.webmcp.has('widget_tool')).toBe(true);

            // Destroy / unmount engine
            engine.destroy();
            expect(engine.webmcp.has('widget_tool')).toBe(false);
            expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('widget_tool');
        });
    });

    describe('13. Error Sanitization & Security', () => {
        it('should sanitize action execution errors in production mode without leaking secrets', async () => {
            const xml = `
                <uid_spec>
                    <actions>
                        <action_def name="sensitive.action">
                            <step action="RUN_SCRIPT">
                                throw new Error("Database password db_secret_12345 leaked!");
                            </step>
                        </action_def>
                    </actions>
                    <webmcp>
                        <tool name="sensitive_tool" action="sensitive.action" />
                    </webmcp>
                </uid_spec>
            `;

            EUIXEngineCore.mount(xml, container);
            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];

            try {
                await registeredTool.execute({});
                expect.unreachable('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(EUIXWebMCPError);
                expect(err.code).toBe('ACTION_EXECUTION_FAILED');
                expect(err.message).not.toContain('db_secret_12345');
                expect(err.message).toContain('The tool action failed during execution.');
            }
        });
    });

    describe('14. Tool Execution State Tracking ($webmcp)', () => {
        it('should track execution state reactively during tool execution', async () => {
            const engine = new EUIXEngineCore(container);
            engine.initDataModel();

            let stateDuringExecution;
            engine.webmcp.register({
                name: 'async_task',
                execute: async () => {
                    stateDuringExecution = engine.getState('$webmcp');
                    return { done: true };
                },
            });

            const registeredTool = mockModelContext.registerTool.mock.calls[0][0];
            const result = await registeredTool.execute({});

            expect(stateDuringExecution.executing).toBe(true);
            expect(stateDuringExecution.currentTool).toBe('async_task');

            const stateAfter = engine.getState('$webmcp');
            expect(stateAfter.executing).toBe(false);
            expect(stateAfter.currentTool).toBeNull();
            expect(stateAfter.lastResult).toEqual({ done: true });
            expect(stateAfter.lastError).toBeNull();
        });
    });
});
