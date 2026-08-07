import { JSDOM } from 'jsdom';
import { EUIXEngine } from '../src/EUIXEngine.js';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EUIX Minimal App</title>
</head>
<body class="bg-slate-100 p-8 flex justify-center">
  <div id="app" class="w-full max-w-md"></div>

  <script type="application/euix" target="#app">
    <uid_spec>
      <data_model>
        <state id="message">Hello EUIX Engine!</state>
      </data_model>

      <flex direction="column" gap="16" class="p-6 bg-slate-900 text-white rounded-2xl shadow-xl">
        <h1 class="text-xl font-bold text-white">{data.message}</h1>
        <button type="button" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer">
          <on_click action="SET_STATE">
            <path>data.message</path>
            <value>🚀 Reactively Updated!</value>
          </on_click>
          Click Me
        </button>
      </flex>
    </uid_spec>
  </script>
</body>
</html>`;

const dom = new JSDOM(html, { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;

EUIXEngine.autoInit();

const h1 = document.querySelector('h1');
console.log('H1 content before click:', h1 ? h1.textContent : 'h1 not found');

const button = document.querySelector('button');
if (button) {
    button.click();
    console.log('H1 content after click:', h1.textContent);
} else {
    console.log('button not found');
}
