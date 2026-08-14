import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Keyed List Reconciliation Suite (<for_each key="...">)', () => {
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

    it('should retain exact DOM element instances during list reordering (SWAP)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.items}" var="item" key="id">
                    <div class="row" data-id="{item.id}">
                        <span>{item.name}</span>
                    </div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('items', [
            { id: 'a', name: 'Item A' },
            { id: 'b', name: 'Item B' },
            { id: 'c', name: 'Item C' }
        ]);

        const rowsBefore = Array.from(container.querySelectorAll('.row'));
        const rowA = rowsBefore[0];
        const rowB = rowsBefore[1];
        const rowC = rowsBefore[2];

        expect(rowA.getAttribute('data-id')).toBe('a');
        expect(rowB.getAttribute('data-id')).toBe('b');

        // Swap A and B -> [Item B, Item A, Item C]
        engine.setState('items', [
            { id: 'b', name: 'Item B' },
            { id: 'a', name: 'Item A' },
            { id: 'c', name: 'Item C' }
        ]);

        const rowsAfter = Array.from(container.querySelectorAll('.row'));
        expect(rowsAfter[0]).toBe(rowB); // Exact same DOM instance!
        expect(rowsAfter[1]).toBe(rowA); // Exact same DOM instance!
        expect(rowsAfter[2]).toBe(rowC);
    });

    it('should preserve input typed text and focus when sibling items are inserted or removed', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="tasks" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.tasks}" var="task" key="id">
                    <div class="task-card">
                        <input class="note-input" placeholder="Type note" />
                        <span>{task.title}</span>
                    </div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('tasks', [
            { id: '1', title: 'Task 1' },
            { id: '2', title: 'Task 2' }
        ]);

        const inputsBefore = container.querySelectorAll('.note-input');
        inputsBefore[1].value = 'User draft note for Task 2';
        inputsBefore[1].focus();

        // Insert new task at beginning -> Task 0
        engine.setState('tasks', [
            { id: '0', title: 'Task 0 (New)' },
            { id: '1', title: 'Task 1' },
            { id: '2', title: 'Task 2' }
        ]);

        const cardsAfter = container.querySelectorAll('.task-card');
        expect(cardsAfter.length).toBe(3);
        expect(cardsAfter[0].querySelector('span').textContent).toBe('Task 0 (New)');
        expect(cardsAfter[2].querySelector('span').textContent).toBe('Task 2');

        // Draft text in Task 2 input must be preserved!
        expect(cardsAfter[2].querySelector('.note-input').value).toBe('User draft note for Task 2');
    });

    it('should support dynamic interpolated key expressions key="{item.uuid}"', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.users}" var="usr" key="{usr.uuid}">
                    <span class="user-item">{usr.username}</span>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('users', [
            { uuid: 'u-101', username: 'Alice' },
            { uuid: 'u-102', username: 'Bob' }
        ]);

        const spanAlice = container.querySelector('.user-item');

        engine.setState('users', [
            { uuid: 'u-102', username: 'Bob' },
            { uuid: 'u-101', username: 'Alice' }
        ]);

        const spansAfter = container.querySelectorAll('.user-item');
        expect(spansAfter[1]).toBe(spanAlice); // Preserved DOM instance!
    });

    it('should gracefully handle unkeyed for_each loops via index fallback', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="tags" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.tags}" var="tag">
                    <button class="tag-btn">{tag}</button>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('tags', ['JavaScript', 'HTML', 'CSS']);

        let buttons = container.querySelectorAll('.tag-btn');
        expect(buttons.length).toBe(3);
        expect(buttons[0].textContent).toBe('JavaScript');

        engine.setState('tags', ['TypeScript', 'JavaScript']);
        buttons = container.querySelectorAll('.tag-btn');
        expect(buttons.length).toBe(2);
        expect(buttons[0].textContent).toBe('TypeScript');
        expect(buttons[1].textContent).toBe('JavaScript');
    });
});
