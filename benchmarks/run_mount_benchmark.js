import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

// Setup realistic DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xmlTemplate = `
<uid_spec>
    <data_model>
        <state id="userName">Ahmet</state>
        <state id="counter" type="number">0</state>
    </data_model>

    <flex direction="column" gap="16" class="dashboard-container">
        <!-- Static Header Section (Subtree 1) -->
        <flex direction="row" align="center" justify="between" class="app-header p-4 bg-slate-900 border-b">
            <div class="logo-group">
                <span class="brand-title font-bold text-white">EUIX Platform</span>
                <span class="version-badge px-2 py-0.5 bg-blue-500 text-xs text-white rounded">v0.3.5</span>
            </div>
            <div class="nav-links flex gap-4">
                <a href="#dashboard" class="nav-item text-slate-300">Dashboard</a>
                <a href="#analytics" class="nav-item text-slate-300">Analytics</a>
                <a href="#settings" class="nav-item text-slate-300">Settings</a>
            </div>
        </flex>

        <!-- Dynamic Content Section -->
        <card class="welcome-card p-6 bg-slate-800 rounded-xl">
            <h2>Welcome back, {data.userName}!</h2>
            <p>Your current counter is: {data.counter}</p>
        </card>

        <!-- Static Metric Cards Grid (Subtree 2) -->
        <grid columns="3" gap="12" class="metrics-grid">
            <card class="metric-card p-4 bg-slate-800 rounded-lg">
                <span class="metric-label text-xs text-slate-400">Total Requests</span>
                <h3 class="text-xl font-bold text-emerald-400">1,248,500</h3>
                <span class="metric-trend text-xs text-emerald-500">+14.2% from last week</span>
            </card>
            <card class="metric-card p-4 bg-slate-800 rounded-lg">
                <span class="metric-label text-xs text-slate-400">Avg Latency</span>
                <h3 class="text-xl font-bold text-blue-400">1.84 ms</h3>
                <span class="metric-trend text-xs text-blue-500">P99: 4.2ms</span>
            </card>
            <card class="metric-card p-4 bg-slate-800 rounded-lg">
                <span class="metric-label text-xs text-slate-400">System Health</span>
                <h3 class="text-xl font-bold text-green-400">99.99%</h3>
                <span class="metric-trend text-xs text-slate-400">All clusters operational</span>
            </card>
        </grid>

        <!-- Static Footer (Subtree 3) -->
        <flex direction="row" align="center" justify="between" class="app-footer p-4 border-t text-xs text-slate-500">
            <span>© 2026 EUIX Engine. All rights reserved.</span>
            <div class="footer-links flex gap-2">
                <span>Privacy</span>
                <span>Terms</span>
                <span>Docs</span>
            </div>
        </flex>
    </flex>
</uid_spec>
`;

const ITERATIONS = 1000;
const container = document.getElementById('app');

// Warmup
for (let i = 0; i < 50; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlTemplate);
    engine.destroy();
}

const startTime = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlTemplate);
    engine.destroy();
}

const totalDuration = performance.now() - startTime;
const avgDurationPerMount = totalDuration / ITERATIONS;
const opsPerSec = (ITERATIONS / (totalDuration / 1000)).toFixed(0);

console.log(`=======================================================`);
console.log(`📊 EUIX Engine Mount Benchmark (${ITERATIONS} iterations)`);
console.log(`-------------------------------------------------------`);
console.log(`Total Time:             ${totalDuration.toFixed(2)} ms`);
console.log(`Avg Time per Mount:     ${avgDurationPerMount.toFixed(3)} ms`);
console.log(`Throughput (Ops/sec):   ${opsPerSec} mounts/sec`);
console.log(`=======================================================`);
