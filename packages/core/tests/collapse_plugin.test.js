import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXCollapsePlugin } from '../src/plugins/EUIXCollapsePlugin.js';

EUIXEngineCore.use(EUIXCollapsePlugin);

describe('EUIXCollapsePlugin Test Suite', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should test plugin metadata and install method', () => {
    expect(EUIXCollapsePlugin.name).toBe('collapse');
    expect(typeof EUIXCollapsePlugin.install).toBe('function');
  });

  it('should render collapse with summary tag, dynamic title, and toggle on header click', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="isExpanded" type="boolean">true</state>
        <state id="sectionTitle">My Section</state>
      </data_model>
      <flex>
        <collapse bind="isExpanded" class="custom-card" header_class="my-hdr" body_class="my-bdy">
          <summary>Header: {data.sectionTitle}</summary>
          <p id="body_text">Inside accordion body</p>
        </collapse>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    const collapseEl = container.querySelector('.euix-collapse');
    const headerBtn = container.querySelector('.my-hdr');
    const chevron = container.querySelector('.euix-collapse-chevron');
    const title = container.querySelector('.euix-collapse-title');
    const body = container.querySelector('.my-bdy');

    expect(collapseEl).not.toBeNull();
    expect(collapseEl.classList.contains('is-open')).toBe(true);
    expect(collapseEl.classList.contains('custom-card')).toBe(true);
    expect(headerBtn.getAttribute('aria-expanded')).toBe('true');
    expect(chevron.textContent).toBe('▼');
    expect(title.textContent).toBe('Header: My Section');
    expect(body).not.toBeNull();
    expect(container.querySelector('#body_text').textContent).toBe('Inside accordion body');

    // Test dynamic title update via watcher
    engine.setState('sectionTitle', 'Updated Section Name');
    expect(title.textContent).toBe('Header: Updated Section Name');

    // Click header to close
    headerBtn.click();
    expect(engine.getState('isExpanded')).toBe('false');
    expect(collapseEl.classList.contains('is-closed')).toBe(true);
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false');
    expect(chevron.textContent).toBe('▶');
    expect(collapseEl.querySelector('.my-bdy')).toBeNull();

    // Click header to open again
    headerBtn.click();
    expect(engine.getState('isExpanded')).toBe('true');
    expect(collapseEl.classList.contains('is-open')).toBe(true);
    expect(collapseEl.querySelector('.my-bdy')).not.toBeNull();
  });

  it('should render collapse with title attribute fallback and un-bound default open', () => {
    const xml = `<uid_spec>
      <flex>
        <collapse title="Static Title">
          <p id="static_p">Static content</p>
        </collapse>
        <collapse>
          <span>Fallback title test</span>
        </collapse>
      </flex>
    </uid_spec>`;

    const engine = EUIXEngineCore.mount(xml, container);
    const collapses = container.querySelectorAll('.euix-collapse');
    expect(collapses.length).toBe(2);

    const firstTitle = collapses[0].querySelector('.euix-collapse-title');
    expect(firstTitle.textContent).toBe('Static Title');

    const secondTitle = collapses[1].querySelector('.euix-collapse-title');
    expect(secondTitle.textContent).toBe('Detay');
  });
});
