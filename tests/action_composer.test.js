import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';

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
});
