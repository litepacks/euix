/**
 * production_bundle.test.js
 * Production Distribution Bundle Verification & Property Mangling Protection Suite.
 * 
 * Verifies that compiled artifacts in dist/ (ES and UMD bundles) maintain full runtime
 * integrity, preservation of Action Composer workflows, plugin interoperability,
 * and freedom from destructive Terser property mangling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

describe("Production Distribution Bundle Verification Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("1. should ensure vite configs never enable destructive property mangling (regex /^_/)", () => {
        const rootVite = fs.readFileSync(path.resolve(__dirname, "../vite.config.js"), "utf-8");
        const coreVite = fs.readFileSync(path.resolve(__dirname, "../vite.core.config.js"), "utf-8");
        const pluginsVite = fs.readFileSync(path.resolve(__dirname, "../vite.plugins.config.js"), "utf-8");

        // Property mangling with regex /^_/ breaks dynamic plugin interoperability and must never be present
        expect(rootVite).not.toMatch(/properties\s*:\s*\{\s*regex/);
        expect(coreVite).not.toMatch(/properties\s*:\s*\{\s*regex/);
        expect(pluginsVite).not.toMatch(/properties\s*:\s*\{\s*regex/);
    });

    it("2. should mount and execute Action Composer workflows using compiled dist/EUIXEngine.es.js", async () => {
        const distEsPath = path.resolve(__dirname, "../dist/EUIXEngine.es.js");
        expect(fs.existsSync(distEsPath)).toBe(true);

        const { EUIXEngine } = await import(distEsPath);
        expect(EUIXEngine).toBeDefined();

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="active_country">TR</state>
                    <state id="status">Initial</state>
                    <state id="counter">0</state>
                </data_model>
                <actions>
                    <action_def name="ChangeCountryWorkflow">
                        <param name="country" required="true" />
                        <param name="name" required="true" />

                        <step action="SET_STATE">
                            <path>data.active_country</path>
                            <value>{args.country}</value>
                        </step>
                        <step action="SET_STATE">
                            <path>data.status</path>
                            <value>Country: {args.name}</value>
                        </step>
                        <step action="SET_STATE">
                            <path>data.counter</path>
                            <value>{data.counter} + 1</value>
                        </step>
                    </action_def>
                </actions>
                <container>
                    <span id="country_display">{data.active_country}</span>
                    <span id="status_display">{data.status}</span>
                    <button id="btn_uk" class="btn {data.active_country == 'UK' ? 'active' : ''}">
                        <on_click action="ChangeCountryWorkflow">
                            <arg name="country">UK</arg>
                            <arg name="name">United Kingdom</arg>
                        </on_click>
                        UK
                    </button>
                    <button id="btn_usa" class="btn {data.active_country == 'USA' ? 'active' : ''}">
                        <on_click action="ChangeCountryWorkflow">
                            <arg name="country">USA</arg>
                            <arg name="name">United States</arg>
                        </on_click>
                        USA
                    </button>
                </container>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine).toBeDefined();
        expect(engine.getState("active_country")).toBe("TR");
        expect(engine.getState("status")).toBe("Initial");
        expect(engine.getState("counter")).toBe("0");

        const btnUk = container.querySelector("#btn_uk");
        const btnUsa = container.querySelector("#btn_usa");
        const countryDisplay = container.querySelector("#country_display");
        const statusDisplay = container.querySelector("#status_display");

        expect(btnUk.className).not.toContain("active");
        expect(btnUsa.className).not.toContain("active");

        // 1. Click UK
        btnUk.click();
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState("active_country")).toBe("UK");
        expect(engine.getState("status")).toBe("Country: United Kingdom");
        expect(engine.getState("counter")).toBe("1");
        expect(btnUk.className).toContain("active");
        expect(btnUsa.className).not.toContain("active");
        expect(countryDisplay.textContent).toBe("UK");
        expect(statusDisplay.textContent).toBe("Country: United Kingdom");

        // 2. Click USA
        btnUsa.click();
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState("active_country")).toBe("USA");
        expect(engine.getState("status")).toBe("Country: United States");
        expect(engine.getState("counter")).toBe("2");
        expect(btnUsa.className).toContain("active");
        expect(btnUk.className).not.toContain("active");
        expect(countryDisplay.textContent).toBe("USA");
        expect(statusDisplay.textContent).toBe("Country: United States");
    });

    it("3. should mount and execute full UMD bundle via global scope emulation", async () => {
        const distUmdPath = path.resolve(__dirname, "../dist/EUIXEngine.umd.js");
        expect(fs.existsSync(distUmdPath)).toBe(true);

        const umdCode = fs.readFileSync(distUmdPath, "utf-8");

        // Execute UMD bundle in current window context
        const execUmd = new Function("window", "document", umdCode);
        execUmd(window, document);

        const EUIX = window.EUIXEngine || window.EUIXEngineCore;
        expect(EUIX).toBeDefined();

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="selected_color">blue</state>
                </data_model>
                <actions>
                    <action_def name="SetColor">
                        <param name="color" required="true" />
                        <step action="SET_STATE">
                            <path>data.selected_color</path>
                            <value>{args.color}</value>
                        </step>
                    </action_def>
                </actions>
                <div>
                    <button id="btn_red" class="{data.selected_color == 'red' ? 'is-active' : ''}">
                        <on_click action="SetColor">
                            <arg name="color">red</arg>
                        </on_click>
                        Red
                    </button>
                </div>
            </uid_spec>
        `;

        const engine = EUIX.mount(xml, container);
        expect(engine.getState("selected_color")).toBe("blue");

        const btnRed = container.querySelector("#btn_red");
        expect(btnRed.className).not.toContain("is-active");

        btnRed.click();
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState("selected_color")).toBe("red");
        expect(btnRed.className).toContain("is-active");
    });
});
