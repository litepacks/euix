import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('Live Editor Preset Switching Test', () => {
  it('should switch preset and render new XML correctly when selecting dropdown item', () => {
    document.body.innerHTML = `
      <select id="preset_select" onchange="window.onPresetSelectChange(this.value)">
        <option value="counter">Counter</option>
        <option value="accordion">Accordion</option>
        <option value="modal">Modal</option>
      </select>
      <div id="preview-mount-root"></div>
    `;

    window.EUIXEngine = EUIXEngine;
    window.DEFAULT_XML_PRESET = `<uid_spec><data_model><state id="counter">0</state></data_model><flex><h1>Counter Page</h1></flex></uid_spec>`;
    window.SAMPLES = {
      counter: window.DEFAULT_XML_PRESET,
      accordion: `<uid_spec><data_model><state id="sec1">true</state></data_model><collapse title="Accordion Preset"><p>Accordion Body</p></collapse></uid_spec>`,
      modal: `<uid_spec><data_model><state id="isOpen">true</state></data_model><dialog title="Modal Preset"><p>Modal Body</p></dialog></uid_spec>`
    };

    let monacoValue = "";
    window.monacoEditor = {
      setValue: (val) => { monacoValue = val; },
      getValue: () => monacoValue
    };

    window.renderLivePreview = function(xml) {
      const root = document.getElementById("preview-mount-root");
      root.innerHTML = "";
      EUIXEngine.mount(xml, root);
    };

    window.onPresetSelectChange = function(presetKey) {
      if (window.SAMPLES && window.SAMPLES[presetKey]) {
        const newCode = window.SAMPLES[presetKey];
        if (window.monacoEditor) {
          window.monacoEditor.setValue(newCode);
        }
        window.renderLivePreview(newCode);
      }
    };

    const selectEl = document.getElementById("preset_select");
    expect(selectEl).not.toBeNull();

    // Initial render
    window.renderLivePreview(window.SAMPLES.counter);
    expect(document.getElementById("preview-mount-root").innerHTML).toContain("Counter Page");

    // Change select option to 'accordion'
    selectEl.value = 'accordion';
    window.onPresetSelectChange(selectEl.value);

    // Assert monacoValue updated to accordion preset
    expect(monacoValue).toContain("Accordion Preset");

    // Assert live preview contains Accordion
    expect(document.getElementById("preview-mount-root").innerHTML).toContain("Accordion Preset");
  });
});
