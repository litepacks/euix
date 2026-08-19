import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXChartPlugin, EUIXChartError } from '../src/plugins/EUIXChartPlugin.js';

describe('EUIXChartPlugin - Declarative Chart.js Integration Test Suite', () => {
    let container;
    let mockChartInstances = [];

    // Mock Chart constructor mimicking Chart.js v4 API
    class MockChart {
        constructor(canvas, config) {
            this.canvas = canvas;
            this.config = JSON.parse(JSON.stringify(config || {}));
            this.data = this.config.data || { labels: [], datasets: [] };
            this.options = this.config.options || {};
            this.destroyed = false;
            this.updateCount = 0;
            this.resizeCount = 0;
            this.lastUpdateMode = null;
            this.datasetVisibility = [true, true];
            this.dataVisibility = [true, true, true];

            this.update = vi.fn((mode) => {
                this.updateCount++;
                this.lastUpdateMode = mode;
            });

            this.resize = vi.fn(() => {
                this.resizeCount++;
            });

            this.destroy = vi.fn(() => {
                this.destroyed = true;
            });

            this.show = vi.fn((idx) => {
                this.datasetVisibility[idx] = true;
            });

            this.hide = vi.fn((idx) => {
                this.datasetVisibility[idx] = false;
            });

            this.setDatasetVisibility = vi.fn((idx, visible) => {
                this.datasetVisibility[idx] = visible;
            });

            this.isDatasetVisible = vi.fn((idx) => {
                return this.datasetVisibility[idx] ?? true;
            });

            this.toggleDataVisibility = vi.fn((idx) => {
                this.dataVisibility[idx] = !this.dataVisibility[idx];
            });

            this.toBase64Image = vi.fn((type = 'image/png', quality = 1) => {
                return `data:${type};base64,mock_image_data_quality_${quality}`;
            });

            this.getElementsAtEventForMode = vi.fn((evt, mode, options, useFinalPosition) => {
                return [
                    {
                        datasetIndex: 0,
                        index: 1,
                        element: { x: 50, y: 100 }
                    }
                ];
            });

            mockChartInstances.push(this);
        }
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        mockChartInstances = [];

        // Configure plugin with MockChart
        EUIXChartPlugin.configure({ Chart: MockChart });
        EUIXEngineCore.use(EUIXChartPlugin);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        delete window.Chart;
    });

    describe('1. Initialization & Canvas Rendering', () => {
        it('should render <chart> container, create canvas, and instantiate Chart.js', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="sales" type="object">
                            {
                                "type": "bar",
                                "data": {
                                    "labels": ["Q1", "Q2", "Q3"],
                                    "datasets": [{"label": "Revenue", "data": [100, 200, 300]}]
                                }
                            }
                        </state>
                    </data_model>
                    <chart id="revenue_chart" config="{data.sales}" width="100%" height="350" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(mockChartInstances.length).toBe(1);

            const chart = mockChartInstances[0];
            expect(chart.config.type).toBe('bar');
            expect(chart.data.labels).toEqual(['Q1', 'Q2', 'Q3']);
            expect(chart.data.datasets[0].data).toEqual([100, 200, 300]);

            // Check DOM structure
            const chartContainer = container.querySelector('.euix-chart-container');
            expect(chartContainer).toBeTruthy();
            expect(chartContainer.style.height).toBe('350px');
            expect(chartContainer.style.width).toBe('100%');

            const canvas = chartContainer.querySelector('canvas');
            expect(canvas).toBeTruthy();
            expect(chart.canvas).toBe(canvas);

            // Verify imperative API access
            expect(engine.chart.has('revenue_chart')).toBe(true);
            expect(engine.chart.get('revenue_chart')).toBe(chart);
        });

        it('should support inline JSON config without dynamic state binding', () => {
            const xml = `
                <uid_spec>
                    <chart id="static_chart" config='{"type": "pie", "data": {"labels": ["A", "B"], "datasets": [{"data": [10, 20]}]}}' />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.chart.has('static_chart')).toBe(true);
            const chart = engine.chart.get('static_chart');
            expect(chart.config.type).toBe('pie');
        });
    });

    describe('2. Dependency Handling & Global window.Chart', () => {
        it('should use window.Chart when no injected constructor is provided', () => {
            EUIXChartPlugin.configure({ Chart: null });
            window.Chart = MockChart;

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="chart_config" type="object">{"type": "line"}</state>
                    </data_model>
                    <chart id="umd_chart" config="{data.chart_config}" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.chart.has('umd_chart')).toBe(true);
        });

        it('should render fallback error element when Chart.js is not available', () => {
            EUIXChartPlugin.configure({ Chart: null });
            delete window.Chart;

            const xml = `
                <uid_spec>
                    <chart id="missing_chart" config='{"type": "bar"}' />
                </uid_spec>
            `;

            EUIXEngineCore.mount(xml, container);
            const errorEl = container.querySelector('.euix-chart-error');
            expect(errorEl).toBeTruthy();
            expect(errorEl.textContent).toContain('[CHARTJS_NOT_AVAILABLE]');
        });
    });

    describe('3. Reactive Fine-Grained State Updates', () => {
        it('should update chart.data in-place without destroying instance on dataset mutations', async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="metrics" type="object">
                            {
                                "type": "line",
                                "data": {
                                    "labels": ["Jan", "Feb"],
                                    "datasets": [{"label": "Users", "data": [10, 20]}]
                                }
                            }
                        </state>
                    </data_model>
                    <chart id="metric_chart" config="{data.metrics}" update_mode="none" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const chart = engine.chart.get('metric_chart');
            expect(chart.updateCount).toBe(0);

            // Update state
            engine.setState('metrics', {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar'],
                    datasets: [{ label: 'Users', data: [10, 20, 30] }]
                }
            });

            await new Promise(r => queueMicrotask(r));

            // Should update in place with mode "none"
            expect(chart.updateCount).toBe(1);
            expect(chart.lastUpdateMode).toBe('none');
            expect(chart.data.labels).toEqual(['Jan', 'Feb', 'Mar']);
            expect(chart.destroyed).toBe(false);
            expect(mockChartInstances.length).toBe(1);
        });

        it('should recreate chart instance only when chart type fundamentally changes', async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="chart_cfg" type="object">
                            {
                                "type": "bar",
                                "data": { "labels": ["A", "B"], "datasets": [{"data": [1, 2]}] }
                            }
                        </state>
                    </data_model>
                    <chart id="dynamic_type_chart" config="{data.chart_cfg}" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const initialChart = engine.chart.get('dynamic_type_chart');
            expect(initialChart.config.type).toBe('bar');

            // Change chart type to "doughnut"
            engine.setState('chart_cfg', {
                type: 'doughnut',
                data: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] }
            });

            await new Promise(r => queueMicrotask(r));

            expect(initialChart.destroyed).toBe(true);
            expect(mockChartInstances.length).toBe(2);
            const newChart = engine.chart.get('dynamic_type_chart');
            expect(newChart.config.type).toBe('doughnut');
            expect(newChart.destroyed).toBe(false);
        });

        it('should not update chart when unrelated state properties change', async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="unrelated_counter">0</state>
                        <state id="chart_cfg" type="object">{"type": "bar", "data": {"labels": ["A"], "datasets": [{"data": [5]}]}}</state>
                    </data_model>
                    <chart id="stable_chart" config="{data.chart_cfg}" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const chart = engine.chart.get('stable_chart');
            expect(chart.updateCount).toBe(0);

            engine.setState('unrelated_counter', 42);
            await new Promise(r => queueMicrotask(r));

            expect(chart.updateCount).toBe(0);
        });
    });

    describe('4. Instance Lifecycle & Memory Cleanup', () => {
        it('should call chart.destroy() when engine unmounts', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="sales" type="object">{"type": "line"}</state>
                    </data_model>
                    <chart id="cleanup_chart" config="{data.sales}" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const chart = engine.chart.get('cleanup_chart');
            expect(chart.destroyed).toBe(false);

            engine.unmount();

            expect(chart.destroyed).toBe(true);
            expect(engine.chart.has('cleanup_chart')).toBe(false);
        });
    });

    describe('5. Declarative Actions Dispatcher', () => {
        it('should handle CHART_UPDATE, CHART_RESIZE, and CHART_DESTROY actions', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="cfg" type="object">{"type": "line"}</state>
                    </data_model>
                    <flex direction="column">
                        <chart id="action_chart" config="{data.cfg}" />
                        <button id="btn_update">
                            <on_click action="CHART_UPDATE" chart="action_chart" mode="active" />
                        </button>
                        <button id="btn_resize">
                            <on_click action="CHART_RESIZE" chart="action_chart" />
                        </button>
                        <button id="btn_destroy">
                            <on_click action="CHART_DESTROY" chart="action_chart" />
                        </button>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const chart = engine.chart.get('action_chart');

            container.querySelector('#btn_update').click();
            expect(chart.updateCount).toBe(1);
            expect(chart.lastUpdateMode).toBe('active');

            container.querySelector('#btn_resize').click();
            expect(chart.resizeCount).toBe(1);

            container.querySelector('#btn_destroy').click();
            expect(chart.destroyed).toBe(true);
            expect(engine.chart.has('action_chart')).toBe(false);
        });

        it('should handle dataset and data visibility actions', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="cfg" type="object">{"type": "bar"}</state>
                    </data_model>
                    <flex direction="column">
                        <chart id="vis_chart" config="{data.cfg}" />
                        <button id="btn_hide">
                            <on_click action="CHART_HIDE_DATASET" chart="vis_chart" dataset_index="0" />
                        </button>
                        <button id="btn_show">
                            <on_click action="CHART_SHOW_DATASET" chart="vis_chart" dataset_index="0" />
                        </button>
                        <button id="btn_toggle_ds">
                            <on_click action="CHART_TOGGLE_DATASET" chart="vis_chart" dataset_index="0" />
                        </button>
                        <button id="btn_toggle_data">
                            <on_click action="CHART_TOGGLE_DATA" chart="vis_chart" data_index="1" />
                        </button>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const chart = engine.chart.get('vis_chart');

            container.querySelector('#btn_hide').click();
            expect(chart.hide).toHaveBeenCalledWith(0);

            container.querySelector('#btn_show').click();
            expect(chart.show).toHaveBeenCalledWith(0);

            container.querySelector('#btn_toggle_ds').click();
            expect(chart.setDatasetVisibility).toHaveBeenCalled();

            container.querySelector('#btn_toggle_data').click();
            expect(chart.toggleDataVisibility).toHaveBeenCalledWith(1);
        });

        it('should handle CHART_EXPORT_IMAGE and write base64 to target state', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="image_url"></state>
                        <state id="cfg" type="object">{"type": "pie"}</state>
                    </data_model>
                    <flex direction="column">
                        <chart id="export_chart" config="{data.cfg}" />
                        <button id="btn_export">
                            <on_click action="CHART_EXPORT_IMAGE" chart="export_chart" target="data.image_url" type="image/png" quality="0.9" />
                        </button>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            container.querySelector('#btn_export').click();

            expect(engine.getState('image_url')).toContain('data:image/png;base64,mock_image_data_quality_0.9');
        });
    });

    describe('6. Chart Events & Interaction Bridging', () => {
        it('should capture click on chart canvas and dispatch normalized $evt.detail', () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="selected_label"></state>
                        <state id="selected_value"></state>
                        <state id="chart_cfg" type="object">
                            {
                                "type": "bar",
                                "data": {
                                    "labels": ["Chrome", "Safari", "Edge"],
                                    "datasets": [{ "label": "Usage", "data": [65, 20, 15] }]
                                }
                            }
                        </state>
                    </data_model>
                    <chart id="browser_chart" config="{data.chart_cfg}">
                        <on_chart_click action="RUN_SCRIPT">
                            if ($evt.detail) {
                                $data.selected_label = $evt.detail.label;
                                $data.selected_value = $evt.detail.value;
                            }
                        </on_chart_click>
                    </chart>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const canvas = container.querySelector('canvas');

            // Trigger click event on canvas
            canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            // Element index 1 corresponds to "Safari" with value 20 in the mock
            expect(engine.getState('selected_label')).toBe('Safari');
            expect(engine.getState('selected_value')).toBe(20);
        });
    });

    describe('7. Imperative Engine API (engine.chart.*)', () => {
        it('should provide complete imperative control methods', () => {
            const xml = `
                <uid_spec>
                    <chart id="api_chart" config='{"type": "bar"}' />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.chart.has('api_chart')).toBe(true);

            expect(engine.chart.update('api_chart', 'none')).toBe(true);
            expect(engine.chart.resize('api_chart')).toBe(true);
            expect(engine.chart.show('api_chart', 1)).toBe(true);
            expect(engine.chart.hide('api_chart', 1)).toBe(true);
            expect(engine.chart.toggleDataset('api_chart', 0)).toBe(true);
            expect(engine.chart.toggleData('api_chart', 2)).toBe(true);
            expect(engine.chart.toBase64Image('api_chart')).toContain('data:image/png;base64');

            expect(engine.chart.destroy('api_chart')).toBe(true);
            expect(engine.chart.has('api_chart')).toBe(false);
        });
    });

    describe('8. SSR / Non-DOM Graceful Fallback', () => {
        it('should safely render placeholder without crashing in non-canvas environment', () => {
            const origCanvas = globalThis.HTMLCanvasElement;
            delete globalThis.HTMLCanvasElement;

            const xml = `
                <uid_spec>
                    <chart id="ssr_chart" config='{"type": "bar"}' class="p-4" />
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const placeholder = container.querySelector('.euix-chart');
            expect(placeholder).toBeTruthy();
            expect(placeholder.getAttribute('data-euix-chart')).toBe('ssr_chart');

            globalThis.HTMLCanvasElement = origCanvas;
        });
    });
});
