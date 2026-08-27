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
        <state id="products" type="array"></state>
    </data_model>

    <div class="product-table">
        <for_each items="{data.products}" var="p" key="id">
            <div class="row {p.inStock ? 'in-stock' : 'out-of-stock'}">
                <span class="p-title">{p.title}</span>
                <span class="p-total">Total: {p.price * p.quantity}</span>
                <span class="p-badge">{p.discount > 0 ? 'ON SALE' : 'REGULAR'}</span>
            </div>
        </for_each>
    </div>
</uid_spec>
`;

const container = document.getElementById('app');
const engine = new EUIXEngine(container);
engine.mount(xml);

const generateProducts = (count) => Array.from({ length: count }, (_, i) => ({
    id: i,
    title: `Product #${i}`,
    price: 25 + (i % 100),
    quantity: 1 + (i % 10),
    discount: i % 3 === 0 ? 5 : 0,
    inStock: i % 4 !== 0,
}));

const initialList = generateProducts(2000);

// Initial list render
const startInitial = performance.now();
engine.setState('products', initialList);
const initialDuration = performance.now() - startInitial;

// Reorder / Shuffle / Sort list (LIS reconciliation)
const sortedList = [...initialList].reverse();
const startReorder = performance.now();
engine.setState('products', sortedList);
const reorderDuration = performance.now() - startReorder;

// Partial update (update quantities on 2,000 items)
const updatedList = sortedList.map((p) => ({ ...p, quantity: p.quantity + 1 }));
const startUpdate = performance.now();
engine.setState('products', updatedList);
const updateDuration = performance.now() - startUpdate;

const totalDuration = initialDuration + reorderDuration + updateDuration;

console.log(`=======================================================`);
console.log(`📊 <for_each> Keyed List & LIS Benchmark (2,000 items)`);
console.log(`-------------------------------------------------------`);
console.log(`1. Initial 2k Render:   ${initialDuration.toFixed(2)} ms`);
console.log(`2. 2k Reverse Reorder:  ${reorderDuration.toFixed(2)} ms`);
console.log(`3. 2k Partial Update:   ${updateDuration.toFixed(2)} ms`);
console.log(`Total Duration:         ${totalDuration.toFixed(2)} ms`);
console.log(`=======================================================`);
