import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const xml = `
<uid_spec>
    <data_model>
        <state id="price" type="number">120</state>
        <state id="quantity" type="number">5</state>
        <state id="taxRate" type="number">0.18</state>
        <state id="discount" type="number">10</state>
        <state id="isVip" type="boolean">true</state>
    </data_model>

    <card>
        <p>Subtotal: {data.price * data.quantity}</p>
        <p>Total with Tax: {(data.price * data.quantity - data.discount) * (1 + data.taxRate)}</p>
        <p>VIP Status: {data.isVip ? 'VIP Customer (10% applied)' : 'Standard Customer'}</p>
        <p>Free Shipping: {(data.price * data.quantity) > 500 ? 'YES' : 'NO'}</p>
    </card>
</uid_spec>
`;

const container = document.getElementById('app');
const engine = new EUIXEngine(container);
engine.mount(xml);

const ITERATIONS = 25000;

// Warmup
for (let i = 0; i < 500; i++) {
    engine.setState('price', 100 + (i % 20));
}

const startTime = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
    engine.setState('price', 100 + (i % 50));
}

const totalDuration = performance.now() - startTime;
const avgTimePerEval = (totalDuration / (ITERATIONS * 4)); // 4 expressions per iteration
const opsPerSec = ((ITERATIONS * 4) / (totalDuration / 1000)).toFixed(0);

console.log(`=======================================================`);
console.log(`📊 JIT Expression Benchmark (${ITERATIONS * 4} expression evaluations)`);
console.log(`-------------------------------------------------------`);
console.log(`Total Time:             ${totalDuration.toFixed(2)} ms`);
console.log(`Avg Time per Eval:      ${(avgTimePerEval * 1000).toFixed(2)} µs (${avgTimePerEval.toFixed(4)} ms)`);
console.log(`Throughput (Ops/sec):   ${opsPerSec} expressions/sec`);
console.log(`=======================================================`);
