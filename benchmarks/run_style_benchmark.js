import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xmlStyleTemplate = `
<uid_spec>
    <data_model>
        <state id="themeColor">#6366f1</state>
        <state id="cardPadding" type="number">16</state>
        <state id="borderRadius" type="number">12</state>
        <state id="shadowIntensity" type="number">0.25</state>
    </data_model>

    <style scoped="true">
        :host {
            --accent: {data.themeColor};
            --pad: {data.cardPadding}px;
            --radius: {data.borderRadius}px;
            padding: var(--pad);
            border-radius: var(--radius);
        }
        .themed-card {
            background: #1e293b;
            border: 1px solid var(--accent);
            box-shadow: 0 4px 20px rgba(0, 0, 0, {data.shadowIntensity});
            padding: {data.cardPadding}px;
        }
        .themed-title {
            color: {data.themeColor};
            font-size: 18px;
        }
    </style>

    <div class="themed-card">
        <h2 class="themed-title">Dynamic Themed Card</h2>
    </div>
</uid_spec>
`;

const container = document.getElementById('app');
const engine = new EUIXEngine(container);
engine.mount(xmlStyleTemplate);

const ITERATIONS = 10000;
const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Warmup
for (let i = 0; i < 200; i++) {
    engine.setState('themeColor', colors[i % colors.length]);
    engine.setState('cardPadding', 10 + (i % 20));
}

const startTime = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
    engine.setState('themeColor', colors[i % colors.length]);
    engine.setState('cardPadding', 10 + (i % 20));
}

const totalDuration = performance.now() - startTime;
const opsPerSec = ((ITERATIONS * 2) / (totalDuration / 1000)).toFixed(0);

console.log(`=======================================================`);
console.log(`📊 Reactive Style Benchmark (${ITERATIONS * 2} style state updates)`);
console.log(`-------------------------------------------------------`);
console.log(`Total Time:             ${totalDuration.toFixed(2)} ms`);
console.log(`Avg Time per Update:    ${(totalDuration / (ITERATIONS * 2)).toFixed(4)} ms`);
console.log(`Throughput (Ops/sec):   ${opsPerSec} style updates/sec`);
console.log(`=======================================================`);
