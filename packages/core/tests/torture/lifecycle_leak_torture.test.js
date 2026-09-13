import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';
import { assertNoActiveTimers, assertNoWatcherLeaks, assertNoSubscriptionLeaks } from '../helpers/invariants.js';

EUIXEngineCore.use(EUIXReactivePlugin).use(EUIXResiliencePlugin);

describe('EUIX Engine - Mount/Unmount Lifecycle Memory Leak Torture Suite', () => {
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

  it('should mount and unmount 200 components repeatedly with zero retained subscriptions or active timers', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="timer_val">0</state>
        </data_model>
        <on_interval ms="10" action="SET_STATE">
          <path>data.timer_val</path>
          <value>{data.timer_val} + 1</value>
        </on_interval>
        <container>
          <span>{data.timer_val}</span>
        </container>
      </uid_spec>
    `;

    for (let i = 0; i < 200; i++) {
      const engine = EUIXEngineCore.mount(xml, container);
      engine.unmount();

      assertNoActiveTimers(engine);
      assertNoWatcherLeaks(engine);
      assertNoSubscriptionLeaks(engine);
    }

    expect(container.children.length).toBe(0);
  }, 30000);
});
