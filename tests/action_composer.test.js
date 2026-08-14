import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import {
    EUIXComposerPlugin,
    EUIXActionRecursionError,
    EUIXActionValidationError,
    EUIXActionContext,
    EUIXActionValidator,
    EUIXActionRegistry,
    EUIXActionComposer
} from '../src/plugins/EUIXComposerPlugin.js';

describe('EUIX Engine - Action Composer Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('1. should register and execute a simple composed action defined in XML', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="user_name">Guest</state>
                <state id="counter">0</state>
            </data_model>

            <actions>
                <action_def name="IncrementAndRename">
                    <param name="newName" default="Alice" />
                    <step action="SET_STATE">
                        <path>data.user_name</path>
                        <value>{args.newName}</value>
                    </step>
                    <step action="SET_STATE">
                        <path>data.counter</path>
                        <value>{data.counter} + 1</value>
                    </step>
                    <return>{data.user_name}</return>
                </action_def>
            </actions>

            <flex direction="column">
                <span id="name-display">{data.user_name}</span>
                <span id="count-display">{data.counter}</span>
                <button id="btn-trigger">
                    <on_click action="EXECUTE_ACTION" name="IncrementAndRename">
                        <arg name="newName">Bob</arg>
                    </on_click>
                    Trigger Action
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState('user_name')).toBe('Guest');
        expect(String(engine.getState('counter'))).toBe('0');

        const button = container.querySelector('#btn-trigger');
        button.click();

        await new Promise(r => setTimeout(r, 50));

        expect(engine.getState('user_name')).toBe('Bob');
        expect(String(engine.getState('counter'))).toBe('1');
    });

    it('2. should execute composed action via short-hand syntax and default parameter values', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="status">idle</state>
            </data_model>

            <actions>
                <action_def name="SetStatus">
                    <param name="message" default="ready" />
                    <step action="SET_STATE">
                        <path>data.status</path>
                        <value>{args.message}</value>
                    </step>
                    <return>{data.status}</return>
                </action_def>
            </actions>

            <flex direction="column">
                <button id="btn-short">
                    <on_click action="SetStatus" />
                    Set Default Status
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState('status')).toBe('idle');

        const button = container.querySelector('#btn-short');
        expect(button).not.toBeNull();
        button.click();

        await new Promise(r => setTimeout(r, 50));
        expect(engine.getState('status')).toBe('ready');
    });

    it('3. should support programmatic execution via engine.executeAction() with return value', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="total">0</state>
            </data_model>

            <actions>
                <action_def name="CalculateTotal">
                    <param name="a" required="true" />
                    <param name="b" default="10" />
                    <step action="RUN_SCRIPT">
                        const sum = Number($args.a) + Number($args.b);
                        $data.total = sum;
                        return sum;
                    </step>
                    <return>{result}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const result = await engine.executeAction('CalculateTotal', { a: 5, b: 15 });

        expect(result).toBe(20);
        expect(engine.getState('total')).toBe(20);
    });

    it('4. should enforce missing required parameter validation', async () => {
        const xml = `
        <uid_spec>
            <actions>
                <action_def name="StrictAction">
                    <param name="requiredKey" required="true" />
                    <step action="RUN_SCRIPT">console.log($args.requiredKey)</step>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);

        await expect(engine.executeAction('StrictAction', {})).rejects.toThrow(
            /Missing required argument 'requiredKey'/
        );
    });

    it('5. should handle sequential steps and pass step results to subsequent steps via {result}', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="log" type="array"></state>
            </data_model>

            <actions>
                <action_def name="MultiStepWorkflow">
                    <param name="initial" default="Hello" />
                    
                    <step action="RUN_SCRIPT">
                        return $args.initial + " World";
                    </step>

                    <step action="MUTATE_STATE">
                        <path>data.log</path>
                        <operation>PUSH</operation>
                        <value>{result}</value>
                    </step>

                    <step action="RUN_SCRIPT">
                        return $result + "!";
                    </step>

                    <return>{result}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const finalResult = await engine.executeAction('MultiStepWorkflow', { initial: 'Greetings' });

        expect(finalResult).toBe('Greetings World!');
        const logState = engine.getState('log');
        const firstEntry = logState[0];
        expect(typeof firstEntry === 'object' ? (firstEntry.text || firstEntry.title) : firstEntry).toBe('Greetings World');
    });

    it('6. should support nested composed action calls (ActionA -> ActionB)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="log" type="array"></state>
            </data_model>

            <actions>
                <action_def name="ChildAction">
                    <param name="item" />
                    <step action="MUTATE_STATE">
                        <path>data.log</path>
                        <operation>PUSH</operation>
                        <value>{args.item}</value>
                    </step>
                    <return>saved:{args.item}</return>
                </action_def>

                <action_def name="ParentAction">
                    <param name="title" />
                    <step action="EXECUTE_ACTION" name="ChildAction">
                        <arg name="item">Parent-{args.title}</arg>
                    </step>
                    <return>{result}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const result = await engine.executeAction('ParentAction', { title: 'Test' });

        expect(result).toBe('saved:Parent-Test');
        const logState = engine.getState('log');
        const firstEntry = logState[0];
        expect(typeof firstEntry === 'object' ? (firstEntry.text || firstEntry.title) : firstEntry).toBe('Parent-Test');
    });

    it('7. should detect and prevent circular action recursion loops (ActionA -> ActionB -> ActionA)', async () => {
        const xml = `
        <uid_spec>
            <actions>
                <action_def name="ActionLoopA">
                    <step action="EXECUTE_ACTION" name="ActionLoopB" />
                </action_def>
                <action_def name="ActionLoopB">
                    <step action="EXECUTE_ACTION" name="ActionLoopA" />
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);

        await expect(engine.executeAction('ActionLoopA')).rejects.toThrow(
            /Circular action recursion detected: ActionLoopA -> ActionLoopB -> ActionLoopA/
        );
    });

    it('8. should enforce maximum action recursion depth limit guard', async () => {
        const engine = new EUIXEngine(container);
        engine._maxActionDepth = 3;

        const xml = `
        <uid_spec>
            <actions>
                <action_def name="ActionStep1">
                    <step action="EXECUTE_ACTION" name="ActionStep2" />
                </action_def>
                <action_def name="ActionStep2">
                    <step action="EXECUTE_ACTION" name="ActionStep3" />
                </action_def>
                <action_def name="ActionStep3">
                    <step action="EXECUTE_ACTION" name="ActionStep4" />
                </action_def>
                <action_def name="ActionStep4">
                    <step action="RUN_SCRIPT">return "done";</step>
                </action_def>
            </actions>
        </uid_spec>
        `;

        engine.mount(xml);

        await expect(engine.executeAction('ActionStep1')).rejects.toThrow(
            /Maximum action recursion depth \(3\) exceeded for action <ActionStep4>/
        );
    });

    it('9. should handle async actions (XHR / Promises) cleanly inside composed action', async () => {
        const fakeFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ id: 42, title: 'Async Post Title' })
        });
        vi.stubGlobal('fetch', fakeFetch);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="post_title"></state>
                <state id="post_id">0</state>
            </data_model>

            <actions>
                <action_def name="FetchPostWorkflow">
                    <param name="id" required="true" />
                    
                    <step action="XHR">
                        <method>GET</method>
                        <url>https://api.example.com/posts/{args.id}</url>
                        <target>data.post_title</target>
                    </step>

                    <step action="SET_STATE">
                        <path>data.post_id</path>
                        <value>{args.id}</value>
                    </step>

                    <return>{result.title}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const result = await engine.executeAction('FetchPostWorkflow', { id: 42 });

        expect(fakeFetch).toHaveBeenCalledWith('https://api.example.com/posts/42', expect.any(Object));
        expect(engine.getState('post_id')).toBe('42');
        expect(result).toBe('Async Post Title');

        vi.unstubAllGlobals();
    });

    it('10. should log composed action execution metadata to DevTools trace logger when enabled', async () => {
        const xml = `
        <uid_spec>
            <actions>
                <action_def name="TraceableAction">
                    <param name="val" default="100" />
                    <step action="RUN_SCRIPT">return Number($args.val) * 2;</step>
                    <return>{result}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const logSpy = vi.fn();
        engine._devtools = { enabled: true, logAction: logSpy };

        await engine.executeAction('TraceableAction', { val: 50 });

        expect(logSpy).toHaveBeenCalledWith('ActionComposer', expect.objectContaining({
            name: 'TraceableAction',
            args: { val: 50 },
            result: 100,
            depth: 1
        }));
    });

    it('11. should instantiate custom error classes correctly', () => {
        const recErr = new EUIXActionRecursionError('Recursion error');
        expect(recErr.name).toBe('EUIXActionRecursionError');
        expect(recErr.message).toBe('Recursion error');

        const valErr = new EUIXActionValidationError('Validation error');
        expect(valErr.name).toBe('EUIXActionValidationError');
        expect(valErr.message).toBe('Validation error');
    });

    it('12. should construct EUIXActionContext with default and inherited properties', () => {
        const parentCtx = new EUIXActionContext({
            name: 'ParentAction',
            args: { x: 10 },
            eventContext: { _targetEl: container, props: { theme: 'dark' }, constants: { API: 'v1' } }
        });
        expect(parentCtx.depth).toBe(1);
        expect(parentCtx.callChain.has('ParentAction')).toBe(true);
        expect(parentCtx._targetEl).toBe(container);
        expect(parentCtx.props.theme).toBe('dark');

        const childCtx = new EUIXActionContext({
            name: 'ChildAction',
            args: { y: 20 },
            parent: parentCtx
        });
        expect(childCtx.depth).toBe(2);
        expect(childCtx.callChain.has('ParentAction')).toBe(true);
        expect(childCtx.callChain.has('ChildAction')).toBe(true);
        expect(childCtx._targetEl).toBe(container);
        expect(childCtx.props.theme).toBe('dark');
        expect(childCtx.constants.API).toBe('v1');
    });

    it('13. should validate action definition names and objects in EUIXActionValidator', () => {
        expect(() => EUIXActionValidator.validateDefinition('', {})).toThrow(EUIXActionValidationError);
        expect(() => EUIXActionValidator.validateDefinition(null, {})).toThrow(EUIXActionValidationError);
        expect(() => EUIXActionValidator.validateDefinition(123, {})).toThrow(EUIXActionValidationError);
        expect(() => EUIXActionValidator.validateDefinition('ValidName', null)).toThrow(EUIXActionValidationError);
        expect(() => EUIXActionValidator.validateDefinition('ValidName', 'not-an-object')).toThrow(EUIXActionValidationError);

        expect(() => EUIXActionValidator.validateDefinition('ValidName', { steps: [] })).not.toThrow();
    });

    it('14. should validate action invocation parameter requirements and edge cases in EUIXActionValidator', () => {
        expect(() => EUIXActionValidator.validateInvocation(null, {}, { name: 'Unknown' }, null)).toThrow(
            EUIXActionValidationError
        );

        const actionDef = {
            name: 'TestParamAction',
            params: [
                { name: 'reqField', required: true }
            ]
        };

        expect(() => EUIXActionValidator.validateInvocation(actionDef, { reqField: undefined }, { name: 'TestParamAction' }, null)).toThrow(
            EUIXActionValidationError
        );
        expect(() => EUIXActionValidator.validateInvocation(actionDef, { reqField: null }, { name: 'TestParamAction' }, null)).toThrow(
            EUIXActionValidationError
        );
        expect(() => EUIXActionValidator.validateInvocation(actionDef, { reqField: '' }, { name: 'TestParamAction' }, null)).toThrow(
            EUIXActionValidationError
        );
        expect(() => EUIXActionValidator.validateInvocation(actionDef, { reqField: 'valid' }, { name: 'TestParamAction' }, null)).not.toThrow();
    });

    it('15. should register and parse XML action definitions with arg_def, parameter, return expressions in EUIXActionRegistry', () => {
        const registry = new EUIXActionRegistry();

        expect(registry.register('', {})).toBeNull();
        expect(registry.register(null, {})).toBeNull();
        expect(registry.register('InvalidType', 12345)).toBeNull();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
            <action_def name="CustomXmlAction">
                <arg_def name="param1" default="default1" required="true" type="string" />
                <parameter name="param2" value="val2" />
                <step action="SET_STATE"><path>data.x</path><value>1</value></step>
                <return value='{"status":"success"}' />
            </action_def>
        `, 'text/xml');

        const registered = registry.register('CustomXmlAction', xmlDoc.documentElement);
        expect(registered).not.toBeNull();
        expect(registered.name).toBe('CustomXmlAction');
        expect(registered.params).toHaveLength(2);
        expect(registered.params[0]).toEqual({ name: 'param1', default: 'default1', required: true, type: 'string' });
        expect(registered.params[1]).toEqual({ name: 'param2', default: 'val2', required: false, type: 'string' });
        expect(registered.returnExpr).toBe('{"status":"success"}');

        expect(registry.has('CustomXmlAction')).toBe(true);
        expect(registry.has('NonExistent')).toBe(false);
        expect(registry.get('CustomXmlAction')).toBeDefined();
        expect(registry.getAll().size).toBe(1);

        registry.clear();
        expect(registry.getAll().size).toBe(0);
    });

    it('16. should parse JSON return expressions automatically in EUIXActionComposer', async () => {
        const xml = `
        <uid_spec>
            <actions>
                <action_def name="GetJsonObject">
                    <param name="key" default="user" />
                    <return>{"status": "ok", "requestedKey": "{args.key}"}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const res = await engine.executeAction('GetJsonObject', { key: 'profile' });

        expect(res).toEqual({ status: 'ok', requestedKey: 'profile' });
    });

    it('17. should execute <if condition="..."> and <else> branches in action steps', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="score">75</state>
                <state id="grade">unknown</state>
            </data_model>

            <actions>
                <action_def name="EvaluateGrade">
                    <if condition="{data.score} >= 50">
                        <step action="SET_STATE">
                            <path>data.grade</path>
                            <value>Pass</value>
                        </step>
                    </if>
                    <else>
                        <step action="SET_STATE">
                            <path>data.grade</path>
                            <value>Fail</value>
                        </step>
                    </else>
                    <return>{data.grade}</return>
                </action_def>
            </actions>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const passRes = await engine.executeAction('EvaluateGrade');
        expect(passRes).toBe('Pass');
        expect(engine.getState('grade')).toBe('Pass');

        engine.setState('score', 30);
        const failRes = await engine.executeAction('EvaluateGrade');
        expect(failRes).toBe('Fail');
        expect(engine.getState('grade')).toBe('Fail');
    });

    it('18. should support EXECUTE_ACTION attribute variants (action_name, target, child <name>) and arguments', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="target_val">none</state>
            </data_model>

            <actions>
                <action_def name="UpdateValue">
                    <param name="val" required="true" />
                    <step action="SET_STATE">
                        <path>data.target_val</path>
                        <value>{args.val}</value>
                    </step>
                </action_def>
            </actions>

            <flex direction="column">
                <button id="btn-action-name">
                    <on_click action="EXECUTE_ACTION" action_name="UpdateValue" val="FromAttr" />
                </button>

                <button id="btn-target">
                    <on_click action="EXECUTE_ACTION" target="UpdateValue">
                        <argument name="val" value="FromChildArgument" />
                    </on_click>
                </button>

                <button id="btn-child-name">
                    <on_click action="EXECUTE_ACTION">
                        <name>UpdateValue</name>
                        <param name="val" value="FromChildParam" />
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);

        container.querySelector('#btn-action-name').click();
        await new Promise(r => setTimeout(r, 50));
        expect(engine.getState('target_val')).toBe('FromAttr');

        container.querySelector('#btn-target').click();
        await new Promise(r => setTimeout(r, 50));
        expect(engine.getState('target_val')).toBe('FromChildArgument');

        container.querySelector('#btn-child-name').click();
        await new Promise(r => setTimeout(r, 50));
        expect(engine.getState('target_val')).toBe('FromChildParam');
    });

    it('19. should trigger window.__EUIX_DEVTOOLS_LOG_ACTION__ callback when action executes', async () => {
        const devtoolsSpy = vi.fn();
        window.__EUIX_DEVTOOLS_LOG_ACTION__ = devtoolsSpy;

        const actionDef = {
            name: 'GlobalDevToolsAction',
            steps: []
        };

        const engine = EUIXEngine.mount('<uid_spec></uid_spec>', container);
        await EUIXActionComposer.execute(actionDef, {}, engine);

        expect(devtoolsSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ACTION_COMPOUND',
            actionName: 'GlobalDevToolsAction'
        }));

        delete window.__EUIX_DEVTOOLS_LOG_ACTION__;
    });

    it('20. should test EUIXComposerPlugin metadata, installation, and EXECUTE_ACTION handler edge cases', async () => {
        expect(EUIXComposerPlugin.name).toBe('composer');
        expect(typeof EUIXComposerPlugin.install).toBe('function');

        let executeHandler = null;
        const mockEngineClass = {
            registerAction(name, handler) {
                if (name === 'EXECUTE_ACTION') {
                    executeHandler = handler;
                }
            }
        };

        EUIXComposerPlugin.install(mockEngineClass);
        expect(executeHandler).toBeInstanceOf(Function);

        const executeActionSpy = vi.fn().mockResolvedValue('OK');
        const fakeEngine = {
            getChild() { return null; },
            executeAction: executeActionSpy
        };

        // 1. Missing action name returns undefined
        const noNameNode = document.createElement('on_click');
        const emptyResult = await executeHandler.call(fakeEngine, noNameNode, {});
        expect(emptyResult).toBeUndefined();
        expect(executeActionSpy).not.toHaveBeenCalled();

        // 2. Action name via attribute with arg expr/id
        const actionNode = document.createElement('on_click');
        actionNode.setAttribute('action_name', 'MyWorkflow');
        actionNode.setAttribute('customAttr', 'val1');

        const argChild = document.createElement('arg');
        argChild.setAttribute('id', 'paramKey');
        argChild.setAttribute('expr', '{data.val}');
        actionNode.appendChild(argChild);

        const res = await executeHandler.call(fakeEngine, actionNode, { _componentName: 'App' });
        expect(res).toBe('OK');
        expect(executeActionSpy).toHaveBeenCalledWith('MyWorkflow', {
            customattr: 'val1',
            paramKey: '{data.val}'
        }, { _componentName: 'App' });
    });
});

