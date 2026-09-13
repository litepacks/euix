import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { _setScopedState, applyResets, confirmAction, _handleActionError, handleAction, _handleTryCatchFinally } from '../src/core/actions/ActionDispatcher.js';
import { EUIXStructuredError } from '../src/core/parser/errors.js';

describe('Action Dispatcher & Built-in Actions Master Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should test _setScopedState for local, $local, and global fallback scoping', () => {
        const mockEngine = {
            setState: vi.fn(),
            syncBindings: vi.fn()
        };

        const context = {
            _localState: { counter: 10 },
            _instanceId: 'inst_99'
        };

        // 1. Path starts with local.
        const res1 = _setScopedState(mockEngine, 'local.counter', 'counter', 15, context);
        expect(res1).toBe(true);
        expect(context._localState.counter).toBe(15);
        expect(mockEngine.syncBindings).toHaveBeenCalledWith('inst_99:counter', 15);

        // 2. Path starts with $local.
        const res2 = _setScopedState(mockEngine, '$local.counter', 'counter', 20, context);
        expect(res2).toBe(true);
        expect(context._localState.counter).toBe(20);

        // 3. Fallback to global state if not scoped
        const res3 = _setScopedState(mockEngine, 'user_name', 'user_name', 'Ahmet', context);
        expect(res3).toBe(false);
        expect(mockEngine.setState).toHaveBeenCalledWith('user_name', 'Ahmet');
    });

    it('should test applyResets on action nodes', () => {
        const mockEngine = {
            getChildren: vi.fn((node, tag) => {
                if (tag === 'reset') {
                    return [
                        { textContent: 'search_query' },
                        { getAttribute: () => 'filter_category' }
                    ];
                }
                return [];
            }),
            parseBindPath: vi.fn((p) => p),
            setState: vi.fn()
        };

        applyResets(mockEngine, {});
        expect(mockEngine.setState).toHaveBeenCalledWith('search_query', '', { silent: true });
        expect(mockEngine.setState).toHaveBeenCalledWith('filter_category', '', { silent: true });
    });

    it('should test confirmAction with prompt, condition, and attribute variants', () => {
        const originalConfirm = window.confirm;
        window.confirm = vi.fn(() => true);

        const mockEngine = {
            getChild: vi.fn((node, tag) => {
                if (tag === 'confirm') {
                    return {
                        getAttribute: (attr) => attr === 'condition' ? 'data.is_admin' : null,
                        textContent: 'Are you sure you want to delete?'
                    };
                }
                return null;
            }),
            evalCondition: vi.fn(() => true),
            interpolate: vi.fn((str) => str)
        };

        const res = confirmAction(mockEngine, { getAttribute: () => null }, {});
        expect(res).toBe(true);
        expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete?');

        window.confirm = originalConfirm;
    });

    it('should test _handleActionError loop guards, watcher cycles, and reporting', () => {
        const mockEngine = {
            reportError: vi.fn()
        };

        const structuredErr = new EUIXStructuredError({
            message: 'Infinite Loop Guard triggered',
            code: 'WATCHER_CYCLE_ERROR'
        });

        expect(() => {
            _handleActionError(mockEngine, structuredErr, null, { _inTryScope: true });
        }).toThrow();

        expect(mockEngine.reportError).toHaveBeenCalled();
    });

    it('should test declarative TRY / CATCH / FINALLY syntax validation and execution', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="status_msg">init</state>
                <state id="finally_ran">false</state>
            </data_model>
            <div>
                <button id="try-btn">
                    <on_click action="TRY">
                        <step action="RUN_SCRIPT">
                            throw new Error("Deliberate error in try");
                        </step>
                        <catch var="err">
                            <step action="SET_STATE">
                                <path>data.status_msg</path>
                                <value>Caught: {err.message}</value>
                            </step>
                        </catch>
                        <finally>
                            <step action="SET_STATE">
                                <path>data.finally_ran</path>
                                <value>true</value>
                            </step>
                        </finally>
                    </on_click>
                    Run Try Catch
                </button>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector('#try-btn');
        btn.click();

        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState('status_msg')).toContain('Deliberate error in try');
        expect(engine.getState('finally_ran')).toBe('true');
    });

    it('should execute SET_STATE with math expressions, ternary strings, and date formulas', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter">5</state>
                <state id="is_active">true</state>
                <state id="badge"></state>
            </data_model>
            <div>
                <button id="math-btn">
                    <on_click action="SET_STATE">
                        <path>data.counter</path>
                        <value>{data.counter} * 2 + 10</value>
                    </on_click>
                </button>
                <button id="ternary-btn">
                    <on_click action="SET_STATE">
                        <path>data.badge</path>
                        <value>{data.is_active ? 'ACTIVE_USER' : 'INACTIVE_USER'}</value>
                    </on_click>
                </button>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        container.querySelector('#math-btn').click();
        expect(engine.getState('counter')).toBe('20');

        container.querySelector('#ternary-btn').click();
        expect(engine.getState('badge')).toBe('ACTIVE_USER');
    });
});
