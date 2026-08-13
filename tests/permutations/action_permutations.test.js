import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';
import { EUIXComposerPlugin } from '../../src/plugins/EUIXComposerPlugin.js';
import { assertFinallyExecutedOnce, assertNoLateStateMutation } from '../helpers/invariants.js';

EUIXEngineCore
  .use(EUIXResiliencePlugin)
  .use(EUIXComposerPlugin);

describe('EUIX Engine - Declarative Action Permutation Engine', () => {
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

  it('Permutation 1: TRY -> RETRY -> TIMEOUT -> SET_STATE (Success on retry)', async () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="status">pending</state>
          <state id="finally_count">0</state>
        </data_model>
        <container>
          <button id="btn">
            <on_click action="TRY">
              <retry attempts="3" delay="10">
                <timeout ms="100">
                  <step action="RUN_SCRIPT">
                    if ($retry.attempt === 1) {
                      throw new Error("Flaky network error");
                    }
                    $data.status = "success";
                  </step>
                </timeout>
              </retry>
              <finally>
                <step action="SET_STATE">
                  <path>data.finally_count</path>
                  <value>1</value>
                </step>
              </finally>
            </on_click>
            Run
          </button>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    const button = container.querySelector('#btn');
    button.click();

    await new Promise(r => setTimeout(r, 300));

    expect(engine.getState('status')).toBe('success');
    expect(engine.getState('finally_count')).toBe('1');
    engine.unmount();
  });

  it('Permutation 2: TIMEOUT containing RETRY containing DELAY (Scope cancellation)', async () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="late_mutated">false</state>
          <state id="caught_error">none</state>
        </data_model>
        <container>
          <button id="btn">
            <on_click action="TRY">
              <timeout ms="30">
                <delay ms="100" />
                <step action="SET_STATE">
                  <path>data.late_mutated</path>
                  <value>true</value>
                </step>
              </timeout>
              <catch var="err">
                <step action="SET_STATE">
                  <path>data.caught_error</path>
                  <value>{err.code}</value>
                </step>
              </catch>
            </on_click>
            Run
          </button>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    const button = container.querySelector('#btn');
    button.click();

    await new Promise(r => setTimeout(r, 300));

    expect(engine.getState('caught_error')).toBe('TIMEOUT_ERROR');
    expect(engine.getState('late_mutated')).toBe('false'); // Blocked late mutation invariant!

    engine.unmount();
  });

  it('Permutation 3: COMPOSED_ACTION calling COMPOSED_ACTION with RETRY and CATCH', async () => {
    const xml = `
      <uid_spec>
        <actions>
          <action_def name="InnerWorkflow">
            <step action="TRY">
              <retry attempts="2" delay="5">
                <step action="RUN_SCRIPT">
                  throw new Error("Inner error");
                </step>
              </retry>
              <catch var="err">
                <step action="SET_STATE">
                  <path>data.inner_result</path>
                  <value>caught_inner</value>
                </step>
              </catch>
            </step>
          </action_def>
          <action_def name="OuterWorkflow">
            <step action="InnerWorkflow" />
          </action_def>
        </actions>

        <data_model>
          <state id="inner_result">pending</state>
        </data_model>

        <container>
          <button id="btn">
            <on_click action="OuterWorkflow" />
            Run
          </button>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    const button = container.querySelector('#btn');
    button.click();

    await new Promise(r => setTimeout(r, 200));

    expect(engine.getState('inner_result')).toBe('caught_inner');
    engine.unmount();
  });
});
