import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { assertResourcesDisposed } from '../helpers/invariants.js';

class MockExternalResource {
  constructor(name) {
    this.name = name;
    this.disposed = false;
    this.disposeCount = 0;
  }

  dispose() {
    this.disposed = true;
    this.disposeCount++;
  }
}

describe('EUIX Engine - External Resource Lifecycle Disposal Suite', () => {
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

  it('INVARIANT: Component unmount MUST dispose external resources exactly once without missing or double disposal', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="status">active</state>
        </data_model>
        <container>
          <h1>Resource Test Component</h1>
        </container>
      </uid_spec>
    `;

    const res1 = new MockExternalResource('WebSocketMock');
    const res2 = new MockExternalResource('CanvasRendererMock');

    const engine = EUIXEngineCore.mount(xml, container);
    
    // Register resources on engine instance
    if (!engine._externalResources) engine._externalResources = new Set();
    engine._externalResources.add(res1);
    engine._externalResources.add(res2);

    expect(res1.disposed).toBe(false);
    expect(res2.disposed).toBe(false);

    // Unmount component
    engine.unmount();

    assertResourcesDisposed([res1, res2]);
    expect(res1.disposeCount).toBe(1); // Exact single disposal invariant!
    expect(res2.disposeCount).toBe(1);
  });
});
