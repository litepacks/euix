import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import EUIXEngine from "../src/EUIXEngine.js";

describe("map_demo.html full template verification", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        // Mock Leaflet on window
        window.L = {
            map: () => ({
                setView: () => {},
                flyTo: () => {},
                panTo: () => {},
                getZoom: () => 13,
                getCenter: () => ({ lat: 41.0082, lng: 28.9784 }),
                addLayer: () => {},
                addControl: () => {},
                on: () => {},
                _layersMap: new Map(),
                _drawnItems: { clearLayers: () => {}, eachLayer: () => {} }
            }),
            tileLayer: () => ({ addTo: () => {} }),
            FeatureGroup: class {
                constructor() {
                    this.clearLayers = () => {};
                    this.eachLayer = () => {};
                    this.addLayer = () => {};
                }
            },
            Draw: {
                Event: {
                    CREATED: "draw:created",
                    EDITED: "draw:edited",
                    DELETED: "draw:deleted"
                }
            },
            Control: {
                Draw: class {
                    constructor() {
                        this.addTo = () => {};
                    }
                }
            },
            polygon: () => ({ addTo: () => {}, bindPopup: () => {}, on: () => {} }),
            marker: () => ({ addTo: () => {}, bindPopup: () => ({ openPopup: () => {} }) })
        };
    });

    it("should mount MapSection XML spec, switch active_country and update UI classes on button clicks", async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="active_country">TR</state>
            </data_model>
            <actions>
                <action_def name="SwitchCity">
                    <param name="country" required="true" />
                    <step action="SET_STATE">
                        <path>data.active_country</path>
                        <value>{args.country}</value>
                    </step>
                </action_def>
            </actions>
            <flex direction="row" gap="4">
                <button class="country-btn {data.active_country == 'TR' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">TR</arg></on_click>
                    TR
                </button>
                <button class="country-btn {data.active_country == 'UK' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">UK</arg></on_click>
                    UK
                </button>
                <button class="country-btn {data.active_country == 'USA' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">USA</arg></on_click>
                    USA
                </button>
                <button class="country-btn {data.active_country == 'JP' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">JP</arg></on_click>
                    JP
                </button>
                <button class="country-btn {data.active_country == 'FR' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">FR</arg></on_click>
                    FR
                </button>
                <button class="country-btn {data.active_country == 'DE' ? 'active' : ''}">
                    <on_click action="SwitchCity"><arg name="country">DE</arg></on_click>
                    DE
                </button>
            </flex>
        </uid_spec>
        `;
        const engine = EUIXEngine.mount(xml, container);

        expect(engine.getState("active_country")).toBe("TR");

        const buttons = Array.from(container.querySelectorAll(".country-btn"));
        expect(buttons.length).toBeGreaterThanOrEqual(6);

        const btnTr = buttons[0];
        const btnUk = buttons[1];
        const btnUsa = buttons[2];
        const btnJp = buttons[3];
        const btnFr = buttons[4];
        const btnDe = buttons[5];

        console.log("Initial Active Country:", engine.getState("active_country"));
        console.log("Initial TR Button Class:", btnTr.className);
        console.log("Initial UK Button Class:", btnUk.className);

        expect(btnTr.className).toContain("active");
        expect(btnUk.className).not.toContain("active");

        // Click UK
        btnUk.click();
        await new Promise(r => setTimeout(r, 40));

        console.log("After UK click Active Country:", engine.getState("active_country"));
        console.log("After UK click TR Button Class:", btnTr.className);
        console.log("After UK click UK Button Class:", btnUk.className);

        expect(engine.getState("active_country")).toBe("UK");
        expect(btnUk.className).toContain("active");
        expect(btnTr.className).not.toContain("active");

        // Click USA
        btnUsa.click();
        await new Promise(r => setTimeout(r, 40));

        console.log("After USA click Active Country:", engine.getState("active_country"));
        console.log("After USA click USA Button Class:", btnUsa.className);

        expect(engine.getState("active_country")).toBe("USA");
        expect(btnUsa.className).toContain("active");
        expect(btnUk.className).not.toContain("active");

        // Click JP
        btnJp.click();
        await new Promise(r => setTimeout(r, 40));
        expect(engine.getState("active_country")).toBe("JP");
        expect(btnJp.className).toContain("active");
        expect(btnUsa.className).not.toContain("active");

        // Click FR
        btnFr.click();
        await new Promise(r => setTimeout(r, 40));
        expect(engine.getState("active_country")).toBe("FR");
        expect(btnFr.className).toContain("active");
        expect(btnJp.className).not.toContain("active");

        // Click DE
        btnDe.click();
        await new Promise(r => setTimeout(r, 40));
        expect(engine.getState("active_country")).toBe("DE");
        expect(btnDe.className).toContain("active");
        expect(btnFr.className).not.toContain("active");
    });
});
