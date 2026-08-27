import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xmlListTemplate = `
<uid_spec>
    <data_model>
        <state id="users" type="array"></state>
    </data_model>

    <flex direction="column" gap="8" class="user-list">
        <for_each items="{data.users}" var="u" key="id">
            <flex direction="row" align="center" justify="between" class="user-row p-3 bg-slate-800 rounded">
                <!-- Static Icon & Badge Subtree -->
                <flex direction="row" align="center" gap="6" class="avatar-wrap">
                    <div class="status-dot w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span class="icon-avatar">👤</span>
                </flex>

                <!-- Dynamic text -->
                <span class="user-name font-bold text-white">{u.name}</span>
                <span class="user-email text-slate-400">{u.email}</span>

                <!-- Static Actions Subtree -->
                <flex direction="row" gap="4" class="action-buttons">
                    <span class="badge px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Member</span>
                    <div class="static-pill text-xs text-slate-500 font-mono">ID-VERIFIED</div>
                </flex>
            </flex>
        </for_each>
    </flex>
</uid_spec>
`;

const container = document.getElementById('app');
const engine = new EUIXEngine(container);
engine.mount(xmlListTemplate);

const users = Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
}));

// Benchmark list rendering
const start = performance.now();
engine.setState('users', users);
const duration = performance.now() - start;

console.log(`=======================================================`);
console.log(`📊 2,000 Item List Render with Static Subtrees`);
console.log(`-------------------------------------------------------`);
console.log(`Render Duration:        ${duration.toFixed(2)} ms`);
console.log(`Avg time per row:       ${(duration / 2000).toFixed(3)} ms`);
console.log(`=======================================================`);
