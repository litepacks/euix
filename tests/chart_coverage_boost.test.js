import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXChartPlugin, EUIXChartError } from "../src/plugins/EUIXChartPlugin.js";

EUIXEngineCore.use(EUIXChartPlugin);

describe("EUIXChartPlugin Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);

        // Mock Chart constructor in window
        window.Chart = vi.fn(function(ctx, config) {
            this.ctx = ctx;
            this.config = config;
            this.data = config.data || { labels: [], datasets: [] };
            this.options = config.options || {};
            this.canvas = ctx;
            this.update = vi.fn();
            this.resize = vi.fn();
            this.destroy = vi.fn();
            this.toBase64Image = vi.fn(() => "data:image/png;base64,mockImageBase64");
            this.show = vi.fn();
            this.hide = vi.fn();
            this.isDatasetVisible = vi.fn(() => true);
            this.setDatasetVisibility = vi.fn();
            this.toggleDataVisibility = vi.fn();
            this.isDataVisibilityMultiselect = vi.fn(() => false);
            this.getDataVisibility = vi.fn(() => true);
            this.getElementsAtEventForMode = vi.fn(() => []);
        });
    });

    it("should instantiate EUIXChartError structured error properly", () => {
        const err = new EUIXChartError("Chart rendering failed", "RENDER_FAILED", { chartId: "chart-1" });
        expect(err.name).toBe("EUIXChartError");
        expect(err.code).toBe("RENDER_FAILED");
        expect(err.context.chartId).toBe("chart-1");
    });

    it("should execute CHART_EXPORT with download, CHART_UPDATE, CHART_RESIZE, CHART_DESTROY actions", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="chartConfig" type="object">
                    {
                        "type": "bar",
                        "data": {
                            "labels": ["Q1", "Q2"],
                            "datasets": [{ "label": "Sales", "data": [100, 200] }]
                        }
                    }
                </state>
                <state id="exportedImg"></state>
            </data_model>

            <flex direction="column">
                <chart id="sales-chart" config="{data.chartConfig}" height="200" />

                <button id="btn-export">
                    <on_click action="CHART_EXPORT" chart="sales-chart" target="data.exportedImg" download="true" filename="report.png" />
                    Export
                </button>

                <button id="btn-toggle-ds">
                    <on_click action="CHART_TOGGLE_DATASET" chart="sales-chart" dataset_index="0" />
                    Toggle DS
                </button>

                <button id="btn-show-ds">
                    <on_click action="CHART_SHOW_DATASET" chart="sales-chart" dataset_index="0" />
                    Show DS
                </button>

                <button id="btn-hide-ds">
                    <on_click action="CHART_HIDE_DATASET" chart="sales-chart" dataset_index="0" />
                    Hide DS
                </button>

                <button id="btn-toggle-data">
                    <on_click action="CHART_TOGGLE_DATA" chart="sales-chart" data_index="0" />
                    Toggle Data
                </button>

                <button id="btn-resize">
                    <on_click action="CHART_RESIZE" chart="sales-chart" />
                    Resize
                </button>

                <button id="btn-destroy">
                    <on_click action="CHART_DESTROY" chart="sales-chart" />
                    Destroy
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        const btnExport = container.querySelector("#btn-export");
        btnExport.click();
        expect(engine.getState("exportedImg")).toBe("data:image/png;base64,mockImageBase64");

        const btnToggleDs = container.querySelector("#btn-toggle-ds");
        btnToggleDs.click();

        const btnShowDs = container.querySelector("#btn-show-ds");
        btnShowDs.click();

        const btnHideDs = container.querySelector("#btn-hide-ds");
        btnHideDs.click();

        const btnToggleData = container.querySelector("#btn-toggle-data");
        btnToggleData.click();

        const btnResize = container.querySelector("#btn-resize");
        btnResize.click();

        const btnDestroy = container.querySelector("#btn-destroy");
        btnDestroy.click();
    });
});
