import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin } from '../../src/plugins/EUIXReactivePlugin.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';
import { EUIXComposerPlugin } from '../../src/plugins/EUIXComposerPlugin.js';

EUIXEngineCore.use(EUIXReactivePlugin).use(EUIXResiliencePlugin).use(EUIXComposerPlugin);

const fixturesDir = path.join(__dirname, '../fixtures/torture_apps');

function loadFixture(filename) {
  return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
}

describe('EUIX Engine - Real-World Engineering Torture Application Fixtures', () => {
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

  it('Fixture A: StressDashboard - mounts, evaluates computed header, and updates metrics', () => {
    const xml = loadFixture('StressDashboard.xml');
    const engine = EUIXEngineCore.mount(xml, container);

    expect(engine.getState('user_name')).toBe('Admin');
    expect(engine.getState('display_header')).toBe('Admin - Tick #0');

    const tickBtn = container.querySelector('#tick_btn');
    tickBtn.click();

    expect(engine.getState('ticker')).toBe('1');
    expect(engine.getState('display_header')).toBe('Admin - Tick #1');

    engine.unmount();
  });

  it('Fixture B: HugeList - populates array items and performs mutations', () => {
    const xml = loadFixture('HugeList.xml');
    const engine = EUIXEngineCore.mount(xml, container);

    const items = [];
    for (let i = 1; i <= 250; i++) {
      items.push({ id: i, title: `Item #${i}` });
    }

    engine.setState('items', items);
    expect(engine.getState('items').length).toBe(250);

    // Remove first item
    engine.setState('items', engine.getState('items').filter(i => i.id !== 1));
    expect(engine.getState('items').length).toBe(249);

    engine.unmount();
  }, 30000);

  it('Fixture C: WorkflowHell - runs resilient action pipeline with timeout and finally block', async () => {
    const xml = loadFixture('WorkflowHell.xml');
    const engine = EUIXEngineCore.mount(xml, container);

    const btn = container.querySelector('#start_pipeline');
    btn.click();

    await new Promise(r => setTimeout(r, 60));

    expect(engine.getState('status')).toBe('pipeline_running');
    expect(engine.getState('finished')).toBe('true');

    engine.unmount();
  });

  it('Fixture D: LifecycleHell - mounts on_interval timer and cleans up on unmount', async () => {
    const xml = loadFixture('LifecycleHell.xml');
    const engine = EUIXEngineCore.mount(xml, container);

    await new Promise(r => setTimeout(r, 120));

    const seconds = parseInt(engine.getState('seconds'), 10);
    expect(seconds).toBeGreaterThan(1);

    engine.unmount();
    expect(engine._getTestStats().activeIntervals).toBe(0);
  });
});
