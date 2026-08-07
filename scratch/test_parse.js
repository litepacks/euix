import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { EUIXEngine } from '../src/EUIXEngine.js';

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;

const xmlPath = path.resolve(process.cwd(), 'components/DocPortalSection.xml');
const xmlContent = fs.readFileSync(xmlPath, 'utf8');

const spec = `<uid_spec>
    ${xmlContent}
    <doc-portal-section />
</uid_spec>`;

EUIXEngine.mount(spec, '#app');

const codeBlocks = Array.from(document.querySelectorAll('code'));
const specBlock = codeBlocks.find(c => c.textContent.includes('<!DOCTYPE html>'));

console.log('--- MOUNTED CODE BLOCK OUTPUT ---');
console.log('Found block:', !!specBlock);
if (specBlock) {
    console.log(specBlock.textContent);
    console.log('Includes {data.message}:', specBlock.textContent.includes('{data.message}'));
}
