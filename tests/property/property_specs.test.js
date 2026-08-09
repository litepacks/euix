import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';
import { euixAppArb, dataModelArb, identifierArb } from './generators.js';
import { assertNoActiveTimers, assertNoWatcherLeaks, assertNoSubscriptionLeaks } from '../helpers/invariants.js';

EUIXEngineCore
  .use(EUIXResiliencePlugin)
  .use(EUIXReactivePlugin);

describe('EUIX Engine - Property-Based Testing Suite', () => {
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

  it('should parse and mount arbitrary structurally valid EUIX applications without runtime errors', () => {
    fc.assert(
      fc.property(euixAppArb, (xml) => {
        container.innerHTML = '';
        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();
        expect(engine.container).toBe(container);
        expect(container.children.length).toBeGreaterThan(0);

        // Cleanup
        engine.unmount();
        assertNoActiveTimers(engine);
        assertNoWatcherLeaks(engine);
        assertNoSubscriptionLeaks(engine);
      }),
      { numRuns: 50 }
    );
  }, 30000);

  it('should maintain state reactivity invariants under random initial state values', () => {
    fc.assert(
      fc.property(identifierArb, fc.string({ minLength: 1, maxLength: 30 }), (stateId, val) => {
        container.innerHTML = '';
        const xml = `
          <uid_spec>
            <data_model>
              <state id="${stateId}">initial</state>
            </data_model>
            <container>
              <span id="target">{data.${stateId}}</span>
            </container>
          </uid_spec>
        `;
        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.getState(stateId)).toBe('initial');

        engine.setState(stateId, val);
        expect(engine.getState(stateId)).toBe(val);

        const span = container.querySelector('#target');
        expect(span.textContent).toBe(val);

        engine.unmount();
      }),
      { numRuns: 50 }
    );
  }, 30000);
});
