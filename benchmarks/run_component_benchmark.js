import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xmlComponentTemplate = `
<uid_spec>
    <component_def name="metric-badge">
        <flex direction="row" align="center" gap="8" class="p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div class="icon-wrap w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <span class="icon">★</span>
            </div>
            <div class="content flex flex-col">
                <span class="title text-xs text-slate-400 font-medium">Server Uptime</span>
                <span class="val text-sm font-bold text-slate-100">99.98%</span>
            </div>
            <span class="status-pill px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Active</span>
        </flex>
    </component_def>

    <grid columns="4" gap="8" class="badge-grid">
        ${Array.from({ length: 50 }, () => '<component name="metric-badge" />').join('\n')}
    </grid>
</uid_spec>
`;

const ITERATIONS = 200;
const container = document.getElementById('app');

// Warmup
for (let i = 0; i < 10; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlComponentTemplate);
    engine.destroy();
}

const startTime = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlComponentTemplate);
    engine.destroy();
}

const totalDuration = performance.now() - startTime;
const avgDurationPerMount = totalDuration / ITERATIONS;
const opsPerSec = (ITERATIONS / (totalDuration / 1000)).toFixed(0);

console.log(`=======================================================`);
console.log(`📊 Component Instantiation Benchmark (50 badges x ${ITERATIONS} = ${50 * ITERATIONS} components)`);
console.log(`-------------------------------------------------------`);
console.log(`Total Time:             ${totalDuration.toFixed(2)} ms`);
console.log(`Avg Time per Mount:     ${avgDurationPerMount.toFixed(3)} ms`);
console.log(`Throughput (Ops/sec):   ${opsPerSec} mounts/sec`);
console.log(`=======================================================`);
