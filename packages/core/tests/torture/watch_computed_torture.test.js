import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin);

describe('EUIX Engine - Watch / Computed Torture Test Suite', () => {
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

  it('should evaluate deep 5-level computed dependency DAGs cleanly', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="val" type="number">1</state>
          <computed id="c1" deps="val">return $data.val + 1;</computed>
          <computed id="c2" deps="c1">return $data.c1 * 2;</computed>
          <computed id="c3" deps="c2">return $data.c2 + 10;</computed>
          <computed id="c4" deps="c3">return $data.c3 * 3;</computed>
          <computed id="c5" deps="c4">return $data.c4 + 5;</computed>
        </data_model>
        <container>
          <span id="res">{data.c5}</span>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    // val=1 => c1=2 => c2=4 => c3=14 => c4=42 => c5=47
    expect(engine.getState('c5')).toBe(47);

    engine.setState('val', 2);
    // val=2 => c1=3 => c2=6 => c3=16 => c4=48 => c5=53
    expect(engine.getState('c5')).toBe(53);

    engine.unmount();
  });
});
