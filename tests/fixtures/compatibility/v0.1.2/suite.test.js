import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../../../src/plugins/EUIXReactivePlugin.js';
import { EUIXResiliencePlugin } from '../../../../src/plugins/EUIXResiliencePlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin).use(EUIXResiliencePlugin);

describe('EUIX Engine - Backward Compatibility Corpus (v0.1.2)', () => {
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

  it('v0.1.2 Contract: Core data binding, state mutations, and flex layout', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="username">Guest</state>
          <state id="counter" type="number">0</state>
        </data_model>

        <flex direction="column" gap="12">
          <h1 id="title">Hello, {data.username}!</h1>
          <span id="counter_val">{data.counter}</span>
          <input id="input_name" bind="username" />
          <button id="inc_btn">
            <on_click action="SET_STATE">
              <path>data.counter</path>
              <value>{data.counter} + 1</value>
            </on_click>
            +1
          </button>
        </flex>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    expect(engine.getState('username')).toBe('Guest');
    expect(engine.getState('counter')).toBe(0);

    const btn = container.querySelector('#inc_btn');
    btn.click();
    expect(Number(engine.getState('counter'))).toBe(1);

    engine.unmount();
  });
});
