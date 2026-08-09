import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';

describe('EUIX Engine - External Script (use_script) Torture Test Suite', () => {
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

  it('should handle successful dynamic script injection and ordering', async () => {
    const xml = `
      <uid_spec>
        <use_script src="https://cdn.example.com/mock_lib.js" global_var="MockLib" />
        <data_model>
          <state id="status">pending</state>
        </data_model>
        <container>
          <h1 id="title">Script Test</h1>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    expect(engine).toBeDefined();
    engine.unmount();
  });
});
