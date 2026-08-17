import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXDragDropPlugin } from '../src/plugins/EUIXDragDropPlugin.js';

EUIXEngineCore.use(EUIXDragDropPlugin);

describe('EUIXDragDropPlugin Test Suite', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should verify plugin metadata and install method', () => {
    expect(EUIXDragDropPlugin.name).toBe('dnd');
    expect(typeof EUIXDragDropPlugin.install).toBe('function');
  });

  it('should test enableDraggable with pointer events and floating ghost lifecycle', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="dragged_id"></state>
      </data_model>
      <div><span id="target">Card</span></div>
    </uid_spec>`;
    const engine = EUIXEngineCore.mount(xml, container);
    const card = container.querySelector('#target');
    card.setAttribute('data-id', 'task-101');

    // 1. enableDraggable false should return immediately
    engine.enableDraggable(card, false);
    expect(card.draggable).toBe(false);

    // 2. enableDraggable true
    engine.enableDraggable(card, true, { task: { id: 'task-101' } });
    expect(card.draggable).toBe(true);

    // 3. Pointerdown on inner button should be ignored
    const btn = document.createElement('button');
    card.appendChild(btn);
    btn.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    expect(engine.getState('dragged_id')).toBe('');

    // 4. Pointerdown on card initiates drag tracking
    card.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(engine.getState('dragged_id')).toBe('task-101');

    // 5. Pointermove > 3px threshold creates ghost
    window.dispatchEvent(new window.PointerEvent('pointermove', { clientX: 120, clientY: 120 }));
    const ghost = document.getElementById('euix-drag-ghost');
    expect(ghost).not.toBeNull();

    // 6. Further Pointermove updates ghost position
    window.dispatchEvent(new window.PointerEvent('pointermove', { clientX: 150, clientY: 150 }));
    expect(ghost.style.left).toBe('130px');

    // 7. Pointerup cleans up ghost and listeners
    window.dispatchEvent(new window.PointerEvent('pointerup'));
    expect(document.getElementById('euix-drag-ghost')).toBeNull();
  });

  it('should test handleDragEvent for dragstart, dragover, dragenter, drop, and dragend', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="dragged_id"></state>
      </data_model>
      <div><span id="task-202" draggable="true">Draggable Card</span></div>
    </uid_spec>`;
    const engine = EUIXEngineCore.mount(xml, container);
    const card = container.querySelector('#task-202');

    let storedText = '';
    const dataTransfer = {
      setData: (format, val) => { storedText = val; },
      getData: (format) => storedText,
      setDragImage: vi.fn(),
      dropEffect: 'none',
      effectAllowed: 'none'
    };

    // 1. dragstart event
    const dragStartEvt = new window.Event('dragstart');
    dragStartEvt.dataTransfer = dataTransfer;
    engine.handleDragEvent('dragstart', dragStartEvt, card, { task: { id: 'task-202' } });
    expect(engine.getState('dragged_id')).toBe('task-202');
    expect(storedText).toBe('task-202');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.setDragImage).toHaveBeenCalled();

    // 2. dragover event
    let prevented = false;
    const dragOverEvt = new window.Event('dragover');
    dragOverEvt.dataTransfer = dataTransfer;
    dragOverEvt.preventDefault = () => { prevented = true; };
    engine.handleDragEvent('dragover', dragOverEvt, card);
    expect(prevented).toBe(true);
    expect(dataTransfer.dropEffect).toBe('move');

    // 3. dragenter event
    engine.handleDragEvent('dragenter', dragOverEvt, card);

    // 4. drop event with different text/plain data
    storedText = 'dropped-item-777';
    const dropEvt = new window.Event('drop');
    dropEvt.dataTransfer = dataTransfer;
    engine.handleDragEvent('drop', dropEvt, card);
    expect(engine.getState('dragged_id')).toBe('dropped-item-777');

    // 5. drop event with "task" generic text should NOT overwrite
    storedText = 'task';
    engine.handleDragEvent('drop', dropEvt, card);
    expect(engine.getState('dragged_id')).toBe('dropped-item-777');

    // 6. dragend event
    const dragEndEvt = new window.Event('dragend');
    engine.handleDragEvent('dragend', dragEndEvt, card);
  });

  it('should test setupDropListener and trigger drop action on pointerup', () => {
    const xml = `<uid_spec>
      <data_model>
        <state id="dragged_id">task-999</state>
        <state id="drop_done">false</state>
      </data_model>
      <div id="drop_target">
        <on_drop action="SET_STATE">
          <path>data.drop_done</path>
          <value>true</value>
        </on_drop>
      </div>
    </uid_spec>`;
    const engine = EUIXEngineCore.mount(xml, container);
    const dropTarget = container.querySelector('#drop_target');

    // Test setupDropListener with empty event map guard
    engine.setupDropListener(dropTarget, new Map(), {});

    // Trigger dragover on dropTarget
    let dragOverPrevented = false;
    const dragOverEvt = new window.Event('dragover');
    dragOverEvt.preventDefault = () => { dragOverPrevented = true; };
    const dt = { dropEffect: 'none' };
    dragOverEvt.dataTransfer = dt;
    dropTarget.dispatchEvent(dragOverEvt);
    expect(dragOverPrevented).toBe(true);
    expect(dt.dropEffect).toBe('move');

    // Trigger pointerup on dropTarget
    dropTarget.dispatchEvent(new window.PointerEvent('pointerup'));
    expect(engine.getState('drop_done')).toBe('true');
    expect(engine.getState('dragged_id')).toBe('');

    // Trigger pointerup when dragged_id is empty -> does not run
    dropTarget.dispatchEvent(new window.PointerEvent('pointerup'));
  });
});
