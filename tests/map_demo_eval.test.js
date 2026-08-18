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

    it("should mount map_demo.html XML spec, switch active_country and update UI classes on button clicks", async () => {
        const html = fs.readFileSync(path.resolve(__dirname, "../map_demo.html"), "utf-8");
        const match = html.match(/<script type="application\/euix"[^>]*>([\s\S]*?)<\/script>/);
        expect(match).toBeTruthy();

        const xml = match[1].trim();
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
