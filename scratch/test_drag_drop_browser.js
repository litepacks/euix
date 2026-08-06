import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/',
    runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.window.cancelAnimationFrame = (id) => clearTimeout(id);

const EUIXEngineModule = await import('../src/EUIXEngine.js');
const EUIXEngine = EUIXEngineModule.default || EUIXEngineModule.EUIXEngine;

const kanbanXml = fs.readFileSync(path.join(process.cwd(), 'components/KanbanSection.xml'), 'utf-8');

const engine = new EUIXEngine({ document: dom.window.document });
engine.container = dom.window.document.getElementById('app');
engine.registerComponent('kanban-section', kanbanXml);
engine.mount('<kanban-section />');

console.log('rawState keys:', Object.keys(engine._rawState));
const tasksKey = Object.keys(engine._rawState).find(k => k.endsWith('kanban_tasks'));
console.log('Tasks key:', tasksKey, 'Tasks count:', engine.getState(tasksKey)?.length);

// 1. Add new task
engine.setState('new_kanban_title', 'Test Added Task');
engine.setState('new_kanban_col', 'todo');

const addBtn = document.querySelector('button[type="button"].bg-purple-600');
addBtn.dispatchEvent(new window.MouseEvent('click'));

console.log('After add task count:', engine.getState('kanban_tasks').length);
console.log('Tasks in state:', engine.getState('kanban_tasks'));

// 2. Simulate dragging task-1 to in_progress
const task1Card = document.querySelector('[data-id="task-1"]');
console.log('Task 1 card found:', !!task1Card);

task1Card.dispatchEvent(new window.Event('dragstart'));

const inProgressCol = document.querySelector('.bg-amber-50\\/40');
inProgressCol.dispatchEvent(new window.Event('drop'));

console.log('After drop tasks count:', engine.getState('kanban_tasks').length);
console.log('After drop tasks:', engine.getState('kanban_tasks'));
