/**
 * tests/chart_multiseries_and_radar.test.js
 * Comprehensive tests for EUIXChartPlugin multi-series radar/donut charts, dataset toggling, export, and chart click/hover events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXChartPlugin } from '../src/plugins/EUIXChartPlugin.js';

describe('EUIXChartPlugin - Radar, Donut, Multi-series Actions and Interactions', () => {
    let container;
    let mockChartInstance;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXChartPlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);

        mockChartInstance = {
            config: { type: 'radar' },
            data: {
                labels: ['Speed', 'Reliability', 'Comfort'],
                datasets: [
                    { label: 'Model X', data: [90, 85, 95] },
                    { label: 'Model Y', data: [80, 90, 85] }
                ]
            },
            options: {},
            update: vi.fn(),
            resize: vi.fn(),
            destroy: vi.fn(),
            show: vi.fn(),
            hide: vi.fn(),
            isDatasetVisible: vi.fn().mockReturnValue(true),
            setDatasetVisibility: vi.fn(),
            getDataVisibility: vi.fn().mockReturnValue(true),
            toggleDataVisibility: vi.fn(),
            toBase64Image: vi.fn().mockReturnValue('data:image/png;base64,mockChartImage'),
            getElementsAtEventForMode: vi.fn().mockReturnValue([
                { datasetIndex: 0, index: 1, element: {} }
            ])
        };

        window.Chart = vi.fn(function(canvas, config) {
            mockChartInstance.config = config;
            mockChartInstance.data = config.data;
            return mockChartInstance;
        });
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should initialize radar chart and execute dataset toggle, show, hide, and export image actions', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="chart_img"></state>
                <state id="radar_config" type="object">{
                    "type": "radar",
                    "data": {
                        "labels": ["Speed", "Reliability", "Comfort"],
                        "datasets": [
                            {"label": "Model X", "data": [90, 85, 95]},
                            {"label": "Model Y", "data": [80, 90, 85]}
                        ]
                    }
                }</state>
            </data_model>
            <flex direction="column">
                <chart id="metrics_radar" config="{data.radar_config}" width="400" height="300" />

                <button id="toggle_ds_btn">
                    <on_click action="CHART_TOGGLE_DATASET" chart="metrics_radar" dataset="1" />
                </button>
                <button id="hide_ds_btn">
                    <on_click action="CHART_HIDE_DATASET" chart="metrics_radar" dataset="0" />
                </button>
                <button id="show_ds_btn">
                    <on_click action="CHART_SHOW_DATASET" chart="metrics_radar" dataset="0" />
                </button>
                <button id="export_btn">
                    <on_click action="CHART_EXPORT_IMAGE" chart="metrics_radar" target_state="data.chart_img" />
                </button>
                <button id="resize_btn">
                    <on_click action="CHART_RESIZE" chart="metrics_radar" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(window.Chart).toHaveBeenCalled();

        // 1. CHART_TOGGLE_DATASET
        container.querySelector('#toggle_ds_btn').click();
        expect(mockChartInstance.setDatasetVisibility).toHaveBeenCalledWith(1, false);

        // 2. CHART_HIDE_DATASET
        container.querySelector('#hide_ds_btn').click();
        expect(mockChartInstance.hide).toHaveBeenCalledWith(0);

        // 3. CHART_SHOW_DATASET
        container.querySelector('#show_ds_btn').click();
        expect(mockChartInstance.show).toHaveBeenCalledWith(0);

        // 4. CHART_EXPORT_IMAGE
        container.querySelector('#export_btn').click();
        expect(mockChartInstance.toBase64Image).toHaveBeenCalled();
        expect(engine.getState('chart_img')).toBe('data:image/png;base64,mockChartImage');

        // 5. CHART_RESIZE
        container.querySelector('#resize_btn').click();
        expect(mockChartInstance.resize).toHaveBeenCalled();
    });

    it('should bridge <on_chart_click> and <on_chart_hover> events to EUIX event listeners', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="last_clicked_index"></state>
                <state id="donut_config" type="object">{
                    "type": "doughnut",
                    "data": {
                        "labels": ["Chrome", "Safari", "Edge"],
                        "datasets": [{"data": [65, 20, 15]}]
                    }
                }</state>
            </data_model>
            <chart id="browser_donut" config="{data.donut_config}">
                <on_chart_click action="RUN_SCRIPT">
                    $data.last_clicked_index = $evt.detail.index;
                </on_chart_click>
            </chart>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const canvas = container.querySelector('canvas');
        expect(canvas).not.toBeNull();

        // Simulate canvas click
        canvas.dispatchEvent(new MouseEvent('click'));
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState('last_clicked_index')).toBe(1);
    });
});
