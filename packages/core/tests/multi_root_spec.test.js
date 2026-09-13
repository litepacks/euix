import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('EUIXEngine - Multi-Root Top-Level Sibling Rendering in <uid_spec>', () => {
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

    it('should render all top-level sibling elements under <uid_spec> and support full reactivity', async () => {
        const xml = `
<uid_spec>
  <data_model>
    <state id="counter" type="number">0</state>
    <state id="newTask" type="string"></state>
    <state id="tasks" type="array">[
      {"id": 1, "title": "Learn EUIX", "done": false},
      {"id": 2, "title": "Build Counter", "done": true}
    ]</state>
    <state id="userName">Guest</state>
  </data_model>

  <!-- Header + Live Clock -->
  <flex direction="row" gap="16" align="center" justify="between" class="header-flex">
    <text class="title">EUIX Sample App</text>
    <time value="now" format="time_medium" live="true" interval="1000" />
    <card>hello world</card>
  </flex>

  <!-- Counter Card -->
  <div class="counter-card">
    <text class="counter-value">{data.counter}</text>
    <flex direction="row" gap="12" align="center">
      <button class="btn-minus">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter} - 1</value>
        </on_click>
        ➖
      </button>
      <button class="btn-reset">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>0</value>
        </on_click>
        🔄 Reset
      </button>
      <button class="btn-plus">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter} + 1</value>
        </on_click>
        ➕
      </button>
    </flex>
  </div>

  <!-- Add Task Form -->
  <div class="add-task-container">
    <flex direction="row" gap="8">
      <input bind="newTask" placeholder="New task..." class="new-task-input" />
      <button class="btn-add">
        <on_click action="MUTATE_STATE">
          <path>tasks</path>
          <operation>PUSH</operation>
          <value>{"id": 3, "title": "{data.newTask}", "done": false}</value>
        </on_click>
        ➕ Add
      </button>
    </flex>
  </div>

  <!-- Task List -->
  <div class="task-list-container">
    <text class="subtitle">Tasks</text>
    <for_each items="{data.tasks}" var="task" key="id">
      <flex direction="row" gap="8" align="center" justify="between" class="task-row">
        <text>{task.title} {task.done ? "✓" : ""}</text>
        <button class="btn-delete">
          <on_click action="MUTATE_STATE">
            <path>tasks</path>
            <operation>REMOVE</operation>
            <where field="id" equals="{task.id}" />
          </on_click>
          🗑️
        </button>
      </flex>
    </for_each>
  </div>
</uid_spec>`;

        const engine = EUIXEngine.mount(xml, container);

        // 1. Verify ALL 4 sibling sections are rendered in the container
        const headerFlex = container.querySelector('.header-flex');
        const counterCard = container.querySelector('.counter-card');
        const addTask = container.querySelector('.add-task-container');
        const taskList = container.querySelector('.task-list-container');

        expect(headerFlex).not.toBeNull();
        expect(counterCard).not.toBeNull();
        expect(addTask).not.toBeNull();
        expect(taskList).not.toBeNull();

        // Check content of all sections
        expect(headerFlex.textContent).toContain('EUIX Sample App');
        expect(headerFlex.textContent).toContain('hello world');

        // Check counter initial state
        const counterVal = counterCard.querySelector('.counter-value');
        expect(counterVal.textContent).toBe('0');

        // Click + button
        const btnPlus = counterCard.querySelector('.btn-plus');
        btnPlus.click();
        await new Promise((r) => queueMicrotask(r));
        expect(counterVal.textContent).toBe('1');

        // Click - button
        const btnMinus = counterCard.querySelector('.btn-minus');
        btnMinus.click();
        await new Promise((r) => queueMicrotask(r));
        expect(counterVal.textContent).toBe('0');

        // Check initial task items
        const taskRows = taskList.querySelectorAll('.task-row');
        expect(taskRows.length).toBe(2);
        expect(taskRows[0].textContent).toContain('Learn EUIX');
        expect(taskRows[1].textContent).toContain('Build Counter ✓');

        // Add a new task via input + button
        const input = addTask.querySelector('.new-task-input');
        input.value = 'Third Task';
        input.dispatchEvent(new Event('input'));
        await new Promise((r) => queueMicrotask(r));

        const btnAdd = addTask.querySelector('.btn-add');
        btnAdd.click();
        await new Promise((r) => queueMicrotask(r));

        const updatedRows = taskList.querySelectorAll('.task-row');
        expect(updatedRows.length).toBe(3);
        expect(updatedRows[2].textContent).toContain('Third Task');

        // Delete first task
        const firstDeleteBtn = updatedRows[0].querySelector('.btn-delete');
        firstDeleteBtn.click();
        await new Promise((r) => queueMicrotask(r));

        const afterDeleteRows = taskList.querySelectorAll('.task-row');
        expect(afterDeleteRows.length).toBe(2);
        expect(afterDeleteRows[0].textContent).toContain('Build Counter ✓');
    });
});
