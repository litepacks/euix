import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../../packages/core/src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xmlAppTemplate = `
<uid_spec>
    <data_model>
        <state id="counter" type="number">0</state>
        <state id="user_name" type="string">Developer</state>
        <state id="is_active" type="boolean">true</state>
        <state id="items" type="array">[{"id": 1, "text": "Alpha"}, {"id": 2, "text": "Beta"}]</state>
    </data_model>

    <flex direction="column" gap="12" class="main-card">
        <h1 ref="titleHeading">Welcome {data.user_name}</h1>
        <p>Counter: <span id="count">{data.counter}</span></p>

        <button ref="actionBtn" class="btn">
            <on_click action="SET_STATE">
                <path>data.counter</path>
                <value>{data.counter + 1}</value>
            </on_click>
            Increment
        </button>

        <on_interval ms="5000" action="SET_STATE">
            <path>data.counter</path>
            <value>{data.counter + 1}</value>
        </on_interval>

        <for_each items="{data.items}" var="it" key="id">
            <div class="row">
                <span>{it.text}</span>
            </div>
        </for_each>
    </flex>
</uid_spec>
`;

const ITERATIONS = 1000;
const container = document.getElementById('app');

// Force GC helper if exposed
const forceGC = () => {
    if (typeof global.gc === 'function') {
        global.gc();
    }
};

forceGC();
const initialHeapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

// 1. Warmup (50 cycles)
for (let i = 0; i < 50; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlAppTemplate);
    engine.setState('counter', i);
    engine.destroy();
}

forceGC();
const postWarmupHeapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

// 2. Stress Run (1,000 cycles)
const startTime = performance.now();

// Track window event listener additions and removals during stress cycles
let activeWindowListeners = 0;
const origAddEventListener = window.addEventListener;
const origRemoveEventListener = window.removeEventListener;

window.addEventListener = function (...args) {
    activeWindowListeners++;
    return origAddEventListener.apply(this, args);
};
window.removeEventListener = function (...args) {
    activeWindowListeners--;
    return origRemoveEventListener.apply(this, args);
};

let lastEngineInstance = null;
let maxHeapBytes = 0;

for (let i = 0; i < ITERATIONS; i++) {
    const engine = new EUIXEngine(container);
    engine.mount(xmlAppTemplate);
    engine.setState('counter', i + 1);
    engine.setState('user_name', `Dev-${i}`);

    const heapNow = process.memoryUsage().heapUsed;
    if (heapNow > maxHeapBytes) maxHeapBytes = heapNow;

    engine.destroy();
    lastEngineInstance = engine;
}

window.addEventListener = origAddEventListener;
window.removeEventListener = origRemoveEventListener;

const totalDuration = performance.now() - startTime;
forceGC();

const finalHeapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
const maxHeapMB = (maxHeapBytes / 1024 / 1024).toFixed(2);
const heapGrowthMB = (parseFloat(finalHeapMB) - parseFloat(postWarmupHeapMB)).toFixed(2);
const avgTimePerCycle = (totalDuration / ITERATIONS).toFixed(3);
const opsPerSec = (ITERATIONS / (totalDuration / 1000)).toFixed(0);

// Leak checks
const lingeringDOMNodes = container.children.length;
const lingeringBindings = lastEngineInstance?._bindings?.size || 0;
const lingeringWatchers = lastEngineInstance?._stateWatchers?.size || 0;
const lingeringIntervals = lastEngineInstance?._activeIntervals?.length || 0;

console.log(`=======================================================`);
console.log(`🧠 Memory & Detached DOM Leak Benchmark (${ITERATIONS} cycles)`);
console.log(`-------------------------------------------------------`);
console.log(`Execution Throughput:   ${opsPerSec} cycles/sec`);
console.log(`Average Cycle Time:     ${avgTimePerCycle} ms`);
console.log(`Total Stress Duration:  ${totalDuration.toFixed(2)} ms`);
console.log(`-------------------------------------------------------`);
console.log(`Initial Heap:           ${initialHeapMB} MB`);
console.log(`Post-Warmup Heap:       ${postWarmupHeapMB} MB`);
console.log(`Peak Heap:              ${maxHeapMB} MB`);
console.log(`Final Heap:             ${finalHeapMB} MB`);
console.log(`Net Heap Growth:        ${heapGrowthMB} MB`);
console.log(`-------------------------------------------------------`);
console.log(`Lingering DOM Nodes:    ${lingeringDOMNodes} (Expect: 0) ${lingeringDOMNodes === 0 ? '✅ PASS' : '❌ LEAK'}`);
console.log(`Lingering Bindings:     ${lingeringBindings} (Expect: 0) ${lingeringBindings === 0 ? '✅ PASS' : '❌ LEAK'}`);
console.log(`Lingering Watchers:     ${lingeringWatchers} (Expect: 0) ${lingeringWatchers === 0 ? '✅ PASS' : '❌ LEAK'}`);
console.log(`Lingering Intervals:    ${lingeringIntervals} (Expect: 0) ${lingeringIntervals === 0 ? '✅ PASS' : '❌ LEAK'}`);
console.log(`Active Window Listeners:${activeWindowListeners} (Expect: 0) ${activeWindowListeners === 0 ? '✅ PASS' : '❌ LEAK'}`);
console.log(`=======================================================`);
