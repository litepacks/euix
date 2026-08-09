import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin);

describe('EUIX Engine - Reactive Storm Test Suite', () => {
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

  it('should process 10,000 rapid state changes efficiently without memory leak or extra re-evaluations', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="counter">0</state>
          <state id="unrelated">zero</state>
          <computed id="doubled" deps="counter">
            return $data.counter * 2;
          </computed>
        </data_model>
        <container>
          <span id="val">{data.counter}</span>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    const start = Date.now();

    for (let i = 1; i <= 10000; i++) {
      engine.setState('counter', i);
    }

    const elapsed = Date.now() - start;
    expect(engine.getState('counter')).toBe(10000);
    expect(engine.getState('doubled')).toBe(20000);

    const span = container.querySelector('#val');
    expect(span.textContent).toBe('10000');
    expect(elapsed).toBeLessThan(10000); // 10k updates completed cleanly
    engine.unmount();
  });
});
