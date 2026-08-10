import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import EUIXApiPlugin from "../src/plugins/EUIXApiPlugin.js";

EUIXEngineCore.use(EUIXApiPlugin);

describe("EUIX Engine - Upstream Package Fixes Verification", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.body.innerHTML = "";
    });

    describe("1. Root Element Detection with <api_endpoint>", () => {
        it("should skip root <api_endpoint> and <endpoint> metadata tags and correctly render visual root layout", () => {
            const xml = `
            <uid_spec>
                <api_config base_url="https://api.example.com" />
                <api_endpoint id="get_countries" url="/countries" method="GET" bind_target="countries" />
                <endpoint id="get_cities" url="/cities" method="GET" bind_target="cities" />
                <flex direction="column" class="main-layout">
                    <h1 class="title">Country Manager</h1>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine).toBeDefined();

            // The rendered container should have mounted the flex layout, not an api_endpoint div
            const titleEl = container.querySelector(".title");
            expect(titleEl).not.toBeNull();
            expect(titleEl.textContent).toBe("Country Manager");

            const flexEl = container.querySelector(".main-layout");
            expect(flexEl).not.toBeNull();
            expect(container.querySelector("api_endpoint")).toBeNull();
        });
    });

    describe("2. Loop Expression Evaluator Scope in <for_each>", () => {
        it("should correctly evaluate complex ternary expressions accessing nested properties on loop item", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="countries" type="array"></state>
                </data_model>
                <flex direction="column">
                    <for_each items="{data.countries}" var="item">
                        <div class="country-row">
                            <span class="country-name">{item.name}</span>
                            <span class="tax-status">{item.finance ? item.finance.crypto_tax_status : 'N/A'}</span>
                        </div>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            
            // Set countries array with mixed nested finance objects
            engine.setState("countries", [
                { id: 1, name: "Germany", finance: { crypto_tax_status: "Tax-Free After 1Y" } },
                { id: 2, name: "USA" }, // No finance property
                { id: 3, name: "Portugal", finance: { crypto_tax_status: "28% Flat Tax" } }
            ]);

            const rows = container.querySelectorAll(".country-row");
            expect(rows.length).toBe(3);

            const statuses = Array.from(container.querySelectorAll(".tax-status")).map(el => el.textContent.trim());
            expect(statuses[0]).toBe("Tax-Free After 1Y");
            expect(statuses[1]).toBe("N/A"); // Evaluated alternate branch when item.finance was undefined
            expect(statuses[2]).toBe("28% Flat Tax");
        });

        it("should evaluate direct nested properties on loop item without ternary operators", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="users" type="array"></state>
                </data_model>
                <flex direction="column">
                    <for_each items="{data.users}" var="user">
                        <div class="user-card">
                            <span class="city">{user.address.city}</span>
                        </div>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.setState("users", [
                { id: 1, name: "Alice", address: { city: "Berlin" } },
                { id: 2, name: "Bob", address: { city: "Tokyo" } }
            ]);

            const cities = Array.from(container.querySelectorAll(".city")).map(el => el.textContent.trim());
            expect(cities[0]).toBe("Berlin");
            expect(cities[1]).toBe("Tokyo");
        });
    });

    describe("3. Tagged POST Endpoint Revalidation", () => {
        it("should revalidate POST endpoints when explicitly triggered via revalidateApi with matching tag or URL filter", async () => {
            const fetchSpy = vi.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, count: 42 })
                })
            );
            global.fetch = fetchSpy;

            const xml = `
            <uid_spec>
                <api_config base_url="https://api.example.com" />
                <flex direction="column">
                    <button class="btn-refresh">
                        <on_click action="REVALIDATE_API" tag="save_country_tag" />
                        Revalidate
                    </button>
                    <button class="btn-post">
                        <on_click action="XHR">
                            <url>/api/admin/countries</url>
                            <method>POST</method>
                            <tag>save_country_tag</tag>
                            <target>result_data</target>
                        </on_click>
                        Submit
                    </button>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Execute POST XHR initially
            const postBtn = container.querySelector(".btn-post");
            postBtn.click();
            await new Promise(r => setTimeout(r, 50));

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(fetchSpy.mock.calls[0][1].method).toBe("POST");

            // Now revalidate using tagged REVALIDATE_API
            const refreshBtn = container.querySelector(".btn-refresh");
            refreshBtn.click();
            await new Promise(r => setTimeout(r, 50));

            // Fetch should have been invoked again for the POST endpoint because it was explicitly tagged!
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });
});
