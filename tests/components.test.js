import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

// Helper to register all XML files from components/ directory
function registerAllComponents() {
    const componentsDir = path.resolve(__dirname, '../components');
    const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.xml'));

    files.forEach(file => {
        const filePath = path.join(componentsDir, file);
        const xmlContent = fs.readFileSync(filePath, 'utf8');
        const compName = file.replace('.xml', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        
        // Register component spec synchronously
        EUIXEngine.registerComponentSpec(compName, xmlContent);
    });
}

describe('EUIXEngine Components Integration Test Suite', () => {
    beforeAll(() => {
        registerAllComponents();
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('should correctly render AppHeader.xml and UserBadge.xml components', () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <app-header />
            </flex>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');

        const titleEl = document.querySelector('h1');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('EUIX Engine Demo');

        const spans = Array.from(document.querySelectorAll('span'));
        const badgeTitle = spans.find(s => s.textContent === 'Senior Developer');
        const badgeLabel = spans.find(s => s.textContent === 'EUIX Core');
        expect(badgeTitle).toBeDefined();
        expect(badgeLabel).toBeDefined();
    });

    it('should render and interact with CounterSection.xml math buttons (+1, +5, -1, -5, Reset)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter_value" type="string">0</state>
                <state id="counter_open" type="string">true</state>
            </data_model>
            <flex direction="column">
                <counter-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const counterSpan = document.querySelector('.font-mono');
        expect(counterSpan).not.toBeNull();
        expect(counterSpan.textContent).toBe('0');

        const buttons = Array.from(document.querySelectorAll('button'));
        const plusBtn = buttons.find(b => b.textContent.trim().startsWith('+') && !b.textContent.includes('5'));
        const plus5Btn = buttons.find(b => b.textContent.includes('+5'));
        const minusBtn = buttons.find(b => b.textContent.trim().startsWith('-') && !b.textContent.includes('5'));
        const minus5Btn = buttons.find(b => b.textContent.includes('-5'));
        const resetBtn = buttons.find(b => b.textContent.includes('Reset'));

        expect(plusBtn).toBeDefined();

        // Click +1
        plusBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('counter_value')).toBe('1');
        expect(counterSpan.textContent).toBe('1');

        // Click +5
        plus5Btn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('counter_value')).toBe('6');
        expect(counterSpan.textContent).toBe('6');

        // Click -1
        minusBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('counter_value')).toBe('5');
        expect(counterSpan.textContent).toBe('5');

        // Click -5
        minus5Btn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('counter_value')).toBe('0');
        expect(counterSpan.textContent).toBe('0');

        // Click Reset
        plusBtn.dispatchEvent(new window.MouseEvent('click'));
        resetBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('counter_value')).toBe('0');
        expect(counterSpan.textContent).toBe('0');
    });

    it('should render TodoSection.xml and handle task addition, editing, and checkbox toggling', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="new_todo_input" type="string"></state>
                <state id="edit_todo_input" type="string"></state>
                <state id="editing_id" type="string"></state>
                <state id="selected_todo_id" type="string"></state>
                <state id="todos_open" type="string">true</state>
                <state id="confirm_modal_open" type="string">false</state>
                <state id="todos" type="array">
                    <item id="1" text="Test Task 1" completed="false" />
                    <item id="2" text="Test Task 2" completed="true" />
                </state>
            </data_model>
            <flex direction="column">
                <todo-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('todos').length).toBe(2);

        // Type into input and click Add Task button
        const input = document.querySelector('input[placeholder="Enter a new task..."]');
        expect(input).not.toBeNull();
        input.value = 'My New Dynamic Task';
        input.dispatchEvent(new window.Event('input'));

        const addTaskBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Task'));
        expect(addTaskBtn).toBeDefined();
        addTaskBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('todos').length).toBe(3);
        expect(engine.getState('todos')[2].text).toBe('My New Dynamic Task');

        // Add Quick Task
        const quickTaskBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Task'));
        expect(quickTaskBtn).toBeDefined();
        quickTaskBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('todos').length).toBe(4);

        // Toggle checkbox of item 1
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(4);
        checkboxes[0].checked = true;
        checkboxes[0].dispatchEvent(new window.Event('change'));

        expect(engine.getState('todos')[0].completed).toBe('true');
    });

    it('should render FormSection.xml and reflect live inputs in the summary box', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="form_open" type="string">true</state>
                <state id="form_bio" type="string">Initial Bio</state>
                <state id="form_category" type="string">frontend</state>
                <state id="form_level" type="string">senior</state>
                <state id="form_salary" type="string">85</state>
                <state id="form_hours" type="string">40</state>
            </data_model>
            <flex direction="column">
                <form-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');

        const textarea = document.querySelector('textarea');
        const select = document.querySelector('select');
        expect(textarea).not.toBeNull();
        expect(textarea.value).toBe('Initial Bio');
        expect(select.value).toBe('frontend');

        // Update bio
        textarea.value = 'Updated Bio Text';
        textarea.dispatchEvent(new window.Event('input'));

        expect(engine.getState('form_bio')).toBe('Updated Bio Text');

        // Check live summary text for all dynamic fields
        const summaryBox = document.querySelector('.bg-indigo-50\\/50');
        expect(summaryBox).not.toBeNull();
        expect(summaryBox.textContent).toContain('Updated Bio Text');
        expect(summaryBox.textContent).toContain('frontend');
        expect(summaryBox.textContent).toContain('senior');
        expect(summaryBox.textContent).toContain('85k $');
        expect(summaryBox.textContent).toContain('40 hrs/week');

        // Dynamically mutate form_level and form_hours
        engine.setState('form_level', 'lead');
        engine.setState('form_hours', '50');

        expect(summaryBox.textContent).toContain('lead');
        expect(summaryBox.textContent).toContain('50 hrs/week');
    });

    it('should render PokemonSection.xml and PokéAPI card components', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="pokemon_open" type="string">true</state>
                <state id="pokemon_loading" type="string">false</state>
                <state id="pokemon_error" type="string"></state>
                <state id="pokemons" type="array">
                    <item id="25" name="pikachu" image="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" />
                </state>
            </data_model>
            <flex direction="column">
                <pokemon-section />
            </flex>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');

        const cardName = document.querySelector('.pokemon-name, span.capitalize');
        expect(cardName).not.toBeNull();
        expect(cardName.textContent.toLowerCase()).toContain('pikachu');

        const img = document.querySelector('img');
        expect(img).not.toBeNull();
        expect(img.src).toContain('25.png');
    });

    it('should handle mouseenter/mouseleave hover events in EventsSection.xml', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="events_open" type="string">true</state>
                <state id="hover_status" type="string">Hover over this box...</state>
                <state id="quick_todo_input" type="string"></state>
                <state id="confirm_modal_open" type="string">false</state>
                <state id="help_open" type="string">false</state>
            </data_model>
            <flex direction="column">
                <events-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('hover_status')).toBe('Hover over this box...');

        const hoverBox = document.querySelector('.border-dashed');
        expect(hoverBox).not.toBeNull();

        // Trigger mouseenter
        hoverBox.dispatchEvent(new window.MouseEvent('mouseenter'));
        expect(engine.getState('hover_status')).toContain('Mouse hovered');

        // Trigger mouseleave
        hoverBox.dispatchEvent(new window.MouseEvent('mouseleave'));
        expect(engine.getState('hover_status')).toBe('Mouse left the box...');
    });

    it('should test ConfirmModal.xml clear and remove modes', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="confirm_modal_open" type="string">true</state>
                <state id="delete_modal_open" type="string">false</state>
                <state id="selected_todo_id" type="string">1</state>
                <state id="todos" type="array">
                    <item id="1" text="Task 1" />
                    <item id="2" text="Task 2" />
                </state>
            </data_model>
            <flex direction="column">
                <confirm-modal bind="data.confirm_modal_open" mode="clear" title="Clear All Tasks?" message="Delete all?" confirm_text="Yes, Clear All" cancel_text="Cancel" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.querySelector('.dialog-backdrop')).not.toBeNull();

        const buttons = Array.from(document.querySelectorAll('button'));
        const confirmBtn = buttons.find(b => b.textContent.includes('Yes, Clear All'));
        expect(confirmBtn).toBeDefined();

        confirmBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('confirm_modal_open')).toBe('false');
        expect(engine.getState('todos').length).toBe(0);
    });

    it('should test HelpModal.xml opening and closing', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="help_open" type="string">true</state>
            </data_model>
            <flex direction="column">
                <help-modal />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.querySelector('.dialog-backdrop')).not.toBeNull();

        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close'));
        expect(closeBtn).toBeDefined();

        closeBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('help_open')).toBe('false');
    });

    it('should render PostsCrudSection.xml REST API component and display initial posts', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="posts_open" type="string">true</state>
                <state id="posts_loading" type="string">false</state>
                <state id="posts_error" type="string"></state>
                <state id="new_post_title" type="string"></state>
                <state id="new_post_body" type="string"></state>
                <state id="posts" type="array">
                    <item id="101" title="Test Post Title" body="Test Post Body Content" />
                </state>
            </data_model>
            <flex direction="column">
                <posts-crud-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('posts').length).toBe(1);

        const postTitle = document.querySelector('span.capitalize');
        expect(postTitle).not.toBeNull();
        expect(postTitle.textContent).toBe('Test Post Title');

        const postBody = document.querySelector('span.leading-relaxed');
        expect(postBody).not.toBeNull();
        expect(postBody.textContent).toBe('Test Post Body Content');
    });

    it('should render TableSection.xml data table and handle adding and removing employees', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="table_open" type="string">true</state>
                <state id="new_emp_name" type="string"></state>
                <state id="new_emp_role" type="string"></state>
                <state id="new_emp_dept" type="string"></state>
                <state id="employees" type="array">
                    <item name="Alice Smith" role="Engineer" dept="Core" status="Active" />
                    <item name="Bob Jones" role="Designer" dept="UI/UX" status="Active" />
                </state>
            </data_model>
            <flex direction="column">
                <table-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('employees').length).toBe(2);

        const tableRows = Array.from(document.querySelectorAll('tr')).filter(tr => tr.textContent.includes('Alice Smith') || tr.textContent.includes('Bob Jones'));
        expect(tableRows.length).toBe(2);
        expect(tableRows[0].textContent).toContain('Alice Smith');
        expect(tableRows[1].textContent).toContain('Bob Jones');

        // Test removing an employee
        const removeButtons = document.querySelectorAll('button');
        const targetBtn = Array.from(removeButtons).find(b => b.textContent.includes('Remove'));
        expect(targetBtn).toBeDefined();

        targetBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('employees').length).toBe(1);
    });

    it('should render KanbanSection.xml drag and drop board and handle dragstart/drop events', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="dragged_id"></state>
                <state id="new_kanban_title"></state>
                <state id="new_kanban_col">todo</state>
                <state id="kanban_tasks" type="array">
                    <item id="task-1" title="Design EUIX Spec" category="Design" status="todo" />
                    <item id="task-2" title="Implement Drag Handlers" category="Core" status="in_progress" />
                </state>
            </data_model>
            <flex direction="column">
                <kanban-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('kanban_tasks').length).toBe(4);

        // Check task cards rendered in appropriate columns
        const cards = document.querySelectorAll('[draggable="true"]');
        expect(cards.length).toBe(4);
        expect(cards[0].textContent).toContain('Design EUIX Component Spec');
        expect(cards[1].textContent).toContain('Write Playwright E2E Test Suite');

        // Simulate dragstart on task-1 card
        cards[0].dispatchEvent(new window.Event('dragstart'));
        expect(engine.getState('dragged_id')).toBe('task-1');

        // Simulate drop onto In Progress column
        const inProgressCol = document.querySelector('.bg-amber-50\\/40');
        expect(inProgressCol).not.toBeNull();

        inProgressCol.dispatchEvent(new window.Event('drop'));

        // Task 1 should now have status = "in_progress"
        const updatedTasks = engine.getState('kanban_tasks');
        const task1 = updatedTasks.find(t => t.id === 'task-1');
        expect(task1.status).toBe('in_progress');

        // Test adding a new task via form input
        engine.setState('new_kanban_title', 'New Integration Test Task');
        engine.setState('new_kanban_col', 'todo');

        const addBtn = document.querySelector('button[type="button"].bg-purple-600');
        expect(addBtn).not.toBeNull();

        addBtn.dispatchEvent(new window.MouseEvent('click'));

        const finalTasks = engine.getState('kanban_tasks');
        expect(finalTasks.length).toBe(5);
        const newTask = finalTasks.find(t => t.title === 'New Integration Test Task');
        expect(newTask).toBeDefined();
        expect(newTask.status).toBe('todo');

        // Test MOVE_DOWN reordering
        const initialTasks = engine.getState('kanban_tasks');
        const initialZeroId = initialTasks[0].id;

        const parser = new window.DOMParser();
        const actionNode = parser.parseFromString('<on_click action="MUTATE_STATE" operation="MOVE_DOWN"><path>data.kanban_tasks</path><index>0</index></on_click>', 'text/xml').documentElement;
        engine.handleAction(actionNode, {});

        const reorderedTasks = engine.getState('kanban_tasks');
        expect(reorderedTasks[1].id).toBe(initialZeroId);
    });

    it('should render ActionComposerSection.xml and trigger composed actions from UI buttons', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="composer_open" type="string">true</state>
                <state id="composer_status" type="string">Ready</state>
                <state id="composer_tasks" type="array"></state>
                <state id="action_logs" type="array"></state>
                <state id="last_notification" type="string">None</state>
            </data_model>
            <flex direction="column">
                <action-composer-section />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('composer_status')).toBe('Ready');

        const buttons = Array.from(document.querySelectorAll('button'));
        const bugBtn = buttons.find(b => b.textContent.includes('Add Bugfix Task'));
        expect(bugBtn).toBeDefined();

        bugBtn.click();
        await new Promise(r => setTimeout(r, 50));

        expect(engine.getState('composer_tasks').length).toBe(1);
        expect(engine.getState('composer_tasks')[0].title).toBe('Fix API Cache Invalidation');
        expect(engine.getState('last_notification')).toContain('Fix API Cache Invalidation');
    });
});
