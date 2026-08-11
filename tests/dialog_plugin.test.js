import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXDialogPlugin } from '../src/plugins/EUIXDialogPlugin.js';

EUIXEngineCore.use(EUIXDialogPlugin);

describe('EUIXDialogPlugin Test Suite', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should toggle dialog overlay when state changes using bind attribute', async () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="isOpen" type="boolean">false</state>
      </data_model>
      <flex>
        <button id="open_btn">
          <on_click action="SET_STATE">
            <path>data.isOpen</path>
            <value>true</value>
          </on_click>
          Open
        </button>
        <dialog bind="isOpen" title="Test Modal">
          <p id="modal_content">Modal text inside dialog</p>
        </dialog>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    expect(document.querySelector('.dialog-backdrop')).toBeNull();

    // Trigger open
    engine.setState('isOpen', true);
    expect(document.querySelector('.dialog-backdrop')).not.toBeNull();
    expect(document.querySelector('#modal_content').textContent).toBe('Modal text inside dialog');

    // Trigger close
    engine.setState('isOpen', false);
    expect(document.querySelector('.dialog-backdrop')).toBeNull();
  });

  it('should toggle dialog overlay when using show attribute with expression', async () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="isOpen" type="boolean">false</state>
      </data_model>
      <flex>
        <dialog show="{data.isOpen}" title="Confirm Modal">
          <p id="modal_text">Show expression test</p>
        </dialog>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    expect(document.querySelector('.dialog-backdrop')).toBeNull();

    // Set show expression state to true
    engine.setState('isOpen', true);
    expect(document.querySelector('.dialog-backdrop')).not.toBeNull();
    expect(document.querySelector('#modal_text').textContent).toBe('Show expression test');

    // Close via close button
    const closeBtn = document.querySelector('.dialog-close');
    closeBtn.click();
    expect(engine.getState('isOpen')).toBe(false);
    expect(document.querySelector('.dialog-backdrop')).toBeNull();
  });
});
