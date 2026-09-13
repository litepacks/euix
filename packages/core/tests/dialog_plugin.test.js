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

  it('should test plugin metadata and install method', () => {
    expect(EUIXDialogPlugin.name).toBe('dialog');
    expect(typeof EUIXDialogPlugin.install).toBe('function');
  });

  it('should render dialog with summary title, actions footer, and custom classes', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="showModal" type="string">true</state>
        <state id="dynamicTitle">Delete Item</state>
      </data_model>
      <flex>
        <dialog bind="showModal" class="my-dialog-custom" header_class="my-hdr" body_class="my-bdy" footer_class="my-ftr" panel_class="my-pnl" backdrop_class="my-bg">
          <summary>{data.dynamicTitle} Confirm</summary>
          <p id="msg">Are you sure?</p>
          <actions>
            <button id="cancel_btn">Cancel</button>
            <button id="confirm_btn">Confirm</button>
          </actions>
        </dialog>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    const backdrop = document.querySelector('.my-bg');
    const panel = document.querySelector('.my-pnl');
    const title = document.querySelector('.dialog-title');
    const footer = document.querySelector('.my-ftr');
    const cancelBtn = document.querySelector('#cancel_btn');

    expect(backdrop).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(title.textContent).toBe('Delete Item Confirm');
    expect(footer).not.toBeNull();
    expect(cancelBtn).not.toBeNull();

    // Click inside panel should stop propagation and NOT close dialog
    panel.click();
    expect(engine.getState('showModal')).toBe('true');
    expect(document.querySelector('.my-bg')).not.toBeNull();

    // Click on backdrop should close dialog
    backdrop.click();
    expect(engine.getState('showModal')).toBe('false');
    expect(document.querySelector('.my-bg')).toBeNull();
  });

  it('should handle Escape keypress on backdrop and close_on_backdrop=false', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="isModalOpen" type="boolean">true</state>
      </data_model>
      <flex>
        <dialog bind="isModalOpen" close_on_backdrop="false" title="No Backdrop Close">
          <p>Locked dialog</p>
        </dialog>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    const backdrop = document.querySelector('.dialog-backdrop');

    // Click backdrop with close_on_backdrop="false" should NOT close
    backdrop.click();
    expect(engine.getState('isModalOpen')).toBe(true);

    // Escape keydown should close dialog
    const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
    backdrop.dispatchEvent(escapeEvent);
    expect(engine.getState('isModalOpen')).toBe(false);
  });

  it('should support open/is_open attributes and default fallback title', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="statusOpen">true</state>
      </data_model>
      <flex>
        <dialog is_open="statusOpen">
          <p>Dialog with default title</p>
        </dialog>
        <dialog>
          <p>Static dialog without bind</p>
        </dialog>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    const title = document.querySelector('.dialog-title');
    expect(title.textContent).toBe('Dialog');
  });
});


