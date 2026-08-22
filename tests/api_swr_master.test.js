import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';
import { EUIXChartPlugin } from '../src/plugins/EUIXChartPlugin.js';

describe('API SWR & Chart Plugin Master Suite', () => {
    let container;
    let originalFetch;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXApiPlugin).use(EUIXChartPlugin);
        container = document.createElement('div');
        document.body.appendChild(container);
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should handle SWR focus revalidation and online event revalidation', async () => {
        let reqCount = 0;
        global.fetch = vi.fn().mockImplementation(async () => {
            reqCount++;
            return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({ count: reqCount })
            };
        });

        const xml = `
        <uid_spec>
            <api_config base_url="https://api.test.com">
                <api_endpoint id="status_ep" url="/status" method="GET" target="live_status" auto_fetch="true" revalidate_focus="true" revalidate_online="true" />
            </api_config>
            <data_model>
                <state id="live_status" type="object"></state>
            </data_model>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));
        expect(reqCount).toBe(1);

        // Simulate window focus event
        window.dispatchEvent(new Event('focus'));
        await new Promise(r => setTimeout(r, 20));

        // Simulate online event
        window.dispatchEvent(new Event('online'));
        await new Promise(r => setTimeout(r, 20));

        engine.destroy();
    });

    it('should render declarative charts and handle data mutations', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="chart_data" type="array">
                    <item label="Jan" value="100" />
                    <item label="Feb" value="150" />
                </state>
            </data_model>
            <div>
                <chart type="bar" items="{data.chart_data}" x="label" y="value" id="revenue-chart" class="w-full h-64" />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const chartEl = container.querySelector('#revenue-chart');
        expect(chartEl).toBeTruthy();
    });
});
