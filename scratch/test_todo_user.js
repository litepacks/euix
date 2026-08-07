import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const xmlSpec = `
<uid_spec>
    <data_model>
      <state id="newTask"></state>
      <state id="tasks" type="array"></state>
    </data_model>

    <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md">
        <h2 class="text-xl font-bold text-indigo-600">✅ Todo List</h2>
        
        <!-- Add Task Input & Button -->
        <flex direction="row" gap="8">
          <input bind="newTask" placeholder="Add a new task..." class="flex-1 px-4 py-2 border rounded-xl" />
          <button class="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer">
            <on_click action="RUN_SCRIPT">
              if ($data.newTask &amp;&amp; $data.newTask.trim()) {
                $data.tasks.push({ id: Date.now(), title: $data.newTask.trim(), done: false });
                $data.newTask = "";
              }
            </on_click>
            Add
          </button>
        </flex>

        <!-- Tasks List -->
        <flex direction="column" gap="8">
          <for_each items="{data.tasks}" var="task">
            <flex direction="row" align="center" gap="8" class="p-3 border rounded-xl bg-slate-50">
              <input type="checkbox" checked="{task.done}">
                <on_click action="RUN_SCRIPT">
                  const item = $data.tasks.find(t => String(t.id) === "{task.id}");
                  if (item) item.done = !item.done;
                </on_click>
              </input>
              <span class="flex-1 text-slate-800" style="text-decoration: {task.done ? 'line-through' : 'none'};">{task.title}</span>
              <button class="px-3 py-1 bg-rose-500 text-white text-xs font-bold rounded-lg cursor-pointer">
                <on_click action="MUTATE_STATE">
                  <path>data.tasks</path>
                  <operation>REMOVE</operation>
                  <where field="id" equals="{task.id}" />
                </on_click>
                Delete
              </button>
            </flex>
          </for_each>
        </flex>

        <!-- Counter -->
        <p class="text-slate-500 text-sm">
          <span class="font-bold">{data.tasks.length}</span> tasks total
        </p>
    </flex>
</uid_spec>`;

const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;

const engine = EUIXEngine.mount(xmlSpec, document.getElementById('app'));

console.log('1. Initial length:', engine.getState('tasks').length);

engine.setState('newTask', 'Buy groceries');
const addButton = document.querySelector('button');
addButton.click();

console.log('2. Tasks length after add:', engine.getState('tasks').length);

const p = document.querySelector('p');
console.log('Paragraph text output:', p.textContent.trim());

const checkbox = document.querySelector('input[type="checkbox"]');
console.log('Checkbox exists:', !!checkbox);
if (checkbox) {
  checkbox.click();
  console.log('After checkbox click, task done state:', engine.getState('tasks')[0].done);
}
