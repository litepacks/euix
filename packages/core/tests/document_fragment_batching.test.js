import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine DocumentFragment DOM Batching Suite', () => {
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

    it('should mount 1,000 list items efficiently using DocumentFragment batching', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.items}" var="item" key="id">
                    <div class="row" data-id="{item.id}">
                        <span>Item #{item.id}</span>
                    </div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const initialItems = Array.from({ length: 1000 }, (_, i) => ({ id: String(i + 1) }));
        engine.setState('items', initialItems);

        const listContainer = container.querySelector('.euix-list-container');
        expect(listContainer).not.toBeNull();
        expect(listContainer.children.length).toBe(1000);
        expect(listContainer.children[0].textContent).toContain('Item #1');
        expect(listContainer.children[999].textContent).toContain('Item #1000');
    });

    it('should maintain state mutation invariants and item order under DocumentFragment batching', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="tasks" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.tasks}" var="task" key="id">
                    <div class="task-item" data-id="{task.id}">{task.title}</div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('tasks', [
            { id: 't1', title: 'Task 1' },
            { id: 't2', title: 'Task 2' }
        ]);

        // Push new task
        engine.mutateState('tasks', 'PUSH', { id: 't3', title: 'Task 3' });
        let items = container.querySelectorAll('.task-item');
        expect(items.length).toBe(3);
        expect(items[2].textContent).toBe('Task 3');

        // Swap task 1 and task 3
        engine.setState('tasks', [
            { id: 't3', title: 'Task 3' },
            { id: 't2', title: 'Task 2' },
            { id: 't1', title: 'Task 1' }
        ]);

        items = container.querySelectorAll('.task-item');
        expect(items.length).toBe(3);
        expect(items[0].textContent).toBe('Task 3');
        expect(items[2].textContent).toBe('Task 1');
    });
});
