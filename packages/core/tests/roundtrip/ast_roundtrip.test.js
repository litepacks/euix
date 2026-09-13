import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';

/**
 * Serializes XML specification DOM into a JSON AST structure
 */
function specXmlToJson(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  function nodeToObj(node) {
    if (node.nodeType === 3) {
      return node.nodeValue.trim() ? { type: 'text', value: node.nodeValue.trim() } : null;
    }
    if (node.nodeType !== 1) return null;

    const attrs = {};
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      attrs[a.name] = a.value;
    }

    const children = Array.from(node.childNodes)
      .map(nodeToObj)
      .filter(Boolean);

    return {
      tagName: node.tagName,
      attributes: attrs,
      children
    };
  }

  return nodeToObj(doc.documentElement);
}

/**
 * Deserializes JSON AST back to XML string
 */
function jsonToSpecXml(astNode) {
  if (!astNode) return '';
  if (astNode.type === 'text') return astNode.value;

  const attrsStr = Object.entries(astNode.attributes || {})
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const openTag = attrsStr ? `<${astNode.tagName} ${attrsStr}>` : `<${astNode.tagName}>`;
  const childrenStr = (astNode.children || []).map(jsonToSpecXml).join('');
  return `${openTag}${childrenStr}</${astNode.tagName}>`;
}

describe('EUIX Engine - Round-Trip AST & Serialization Suite', () => {
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

  it('should preserve semantic equivalence across XML -> JSON AST -> XML round-trips', () => {
    const originalXml = `
      <uid_spec>
        <data_model>
          <state id="user_name">Alice</state>
          <state id="counter" type="number">42</state>
        </data_model>
        <container class="p-6">
          <h1 id="title">Hello, {data.user_name}!</h1>
          <p id="count">Count: {data.counter}</p>
          <button id="inc_btn">
            <on_click action="SET_STATE">
              <path>data.counter</path>
              <value>{data.counter} + 1</value>
            </on_click>
            Increment
          </button>
        </container>
      </uid_spec>
    `.trim();

    // 1. Mount original XML
    const engine1 = EUIXEngineCore.mount(originalXml, container);
    expect(engine1.getState('user_name')).toBe('Alice');
    expect(engine1.getState('counter')).toBe(42);
    engine1.unmount();

    // 2. Perform Round-Trip: XML -> JSON AST -> XML
    const ast = specXmlToJson(originalXml);
    expect(ast).toBeDefined();
    expect(ast.tagName).toBe('uid_spec');

    const reconstructedXml = jsonToSpecXml(ast);
    expect(reconstructedXml).toContain('user_name');

    // 3. Mount Reconstructed XML and verify identical behavior
    const engine2 = EUIXEngineCore.mount(reconstructedXml, container);
    expect(engine2.getState('user_name')).toBe('Alice');
    expect(engine2.getState('counter')).toBe(42);

    const btn = container.querySelector('#inc_btn');
    btn.click();
    expect(Number(engine2.getState('counter'))).toBe(43);

    engine2.unmount();
  });
});
