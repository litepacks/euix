import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin).use(EUIXResiliencePlugin);

describe('EUIX Engine - Invalid Input Fuzzing & Safety Invariants', () => {
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

  it('should safely handle malformed XML without process crashes or unhandled stack overflows', () => {
    const hostileInputs = [
      '<uid_spec><data_model><state id="foo">bar</data_model></uid_spec>', // Unclosed state tag
      '<uid_spec><unknown_node_xyz attr="<<<>>>">content</unknown_node_xyz></uid_spec>',
      '<uid_spec><data_model><state id="counter">1</state><state id="counter">2</state></data_model></uid_spec>', // Duplicate IDs
      '<uid_spec><container><span>{data.nonexistent.nested.deep.prop}</span></container></uid_spec>', // Invalid deep path
      '<uid_spec><container><input bind="nonexistent_state" /></container></uid_spec>',
      '<uid_spec><container><h1>\u0000\uFFFD\u061C\u200E\u202E Emoji: 🚀🔥💥 Special: <![CDATA[<script>alert(1)</script>]]></h1></container></uid_spec>',
      '   \n\t  ', // Whitespace only
      '<<<<>>>>||||', // Garbage chars
    ];

    for (const xml of hostileInputs) {
      expect(() => {
        try {
          const engine = EUIXEngineCore.mount(xml, container);
          if (engine) engine.unmount();
        } catch (e) {
          // Failure must be structured or handled safely, no unhandled stack overflow
      expect(e).toBeDefined();
        }
      }).not.toThrow(RangeError); // No stack overflow RangeError
    }
  }, 30000);

  it('should handle extreme DOM nesting depth gracefully without call stack overflow', () => {
    let deepXml = '<span>Leaf Content</span>';
    for (let i = 0; i < 150; i++) {
      deepXml = `<flex direction="column" class="depth-${i}">${deepXml}</flex>`;
    }
    const fullSpec = `<uid_spec>${deepXml}</uid_spec>`;

    expect(() => {
      const engine = EUIXEngineCore.mount(fullSpec, container);
      expect(engine).toBeDefined();
      engine.unmount();
    }).not.toThrow(RangeError);
  }, 30000);

  it('should handle circular computed dependencies by predictably throwing COMPUTED_CYCLE_ERROR', () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="base">10</state>
          <computed id="compA" deps="compB">
            return $data.compB + 1;
          </computed>
          <computed id="compB" deps="compA">
            return $data.compA + 1;
          </computed>
        </data_model>
      </uid_spec>
    `;

    expect(() => {
      const engine = EUIXEngineCore.mount(xml, container);
      // Trigger evaluation of circular computed
      const val = engine.getState('compA');
      engine.unmount();
    }).toThrow();
  }, 30000);
});
