import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin).use(EUIXResiliencePlugin);

describe('EUIX Engine - Soak Load Test Suite', () => {
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

  it('should sustain continuous state updates, mounts, and unmounts over soak duration without unhandled rejections', async () => {
    const durationMin = parseFloat(process.env.SOAK_DURATION_MIN || '0.05'); // Default short duration (3 sec) for test suite
    const durationMs = durationMin * 60 * 1000;
    const startTime = Date.now();

    const xml = `
      <uid_spec>
        <data_model>
          <state id="count">0</state>
        </data_model>
        <container>
          <span id="val">{data.count}</span>
        </container>
      </uid_spec>
    `;

    let cycles = 0;
    while (Date.now() - startTime < durationMs) {
      const engine = EUIXEngineCore.mount(xml, container);
      for (let j = 0; j < 50; j++) {
        engine.setState('count', j);
      }
      engine.unmount();
      cycles++;
    }

    expect(cycles).toBeGreaterThan(0);
  });
});
