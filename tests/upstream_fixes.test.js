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

        it("should evaluate logical operators and comparisons on loop item properties", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="students" type="array"></state>
                </data_model>
                <flex direction="column">
                    <for_each items="{data.students}" var="student">
                        <div class="student-card">
                            <span class="status">{student.score >= 50 && student.active ? 'PASS' : 'FAIL'}</span>
                        </div>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.setState("students", [
                { name: "Alice", score: 85, active: true },
                { name: "Bob", score: 40, active: true },
                { name: "Charlie", score: 90, active: false }
            ]);

            const statuses = Array.from(container.querySelectorAll(".status")).map(el => el.textContent.trim());
            expect(statuses[0]).toBe("PASS");
            expect(statuses[1]).toBe("FAIL");
            expect(statuses[2]).toBe("FAIL");
        });

        it("should evaluate loop index expressions and parent-child nested loop contexts", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="categories" type="array"></state>
                </data_model>
                <flex direction="column">
                    <for_each items="{data.categories}" var="cat">
                        <div class="cat-box">
                            <for_each items="{cat.products}" var="prod">
                                <span class="crumb">{cat.title} > {prod.name}</span>
                            </for_each>
                        </div>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.setState("categories", [
                { title: "Tech", products: [{ name: "Laptop" }, { name: "Phone" }] },
                { title: "Books", products: [{ name: "Novel" }] }
            ]);

            const crumbs = Array.from(container.querySelectorAll(".crumb")).map(el => el.textContent.trim());
            expect(crumbs).toEqual([
                "Tech > Laptop",
                "Tech > Phone",
                "Books > Novel"
            ]);
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

        it("should revalidate POST endpoints using dynamic tag interpolation in REVALIDATE_API action", async () => {
            const fetchSpy = vi.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true })
                })
            );
            global.fetch = fetchSpy;

            const xml = `
            <uid_spec>
                <data_model>
                    <state id="currentTag">my_dynamic_tag</state>
                </data_model>
                <api_config base_url="https://api.example.com" />
                <flex direction="column">
                    <button class="btn-dyn-refresh">
                        <on_click action="REVALIDATE_API" tag="{data.currentTag}" />
                    </button>
                    <button class="btn-dyn-post">
                        <on_click action="XHR">
                            <url>/api/data</url>
                            <method>POST</method>
                            <tag>my_dynamic_tag</tag>
                        </on_click>
                    </button>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            container.querySelector(".btn-dyn-post").click();
            await new Promise(r => setTimeout(r, 50));

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            container.querySelector(".btn-dyn-refresh").click();
            await new Promise(r => setTimeout(r, 50));

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it("should revalidate POST endpoints when filter matches URL substring", async () => {
            const fetchSpy = vi.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ items: [] })
                })
            );
            global.fetch = fetchSpy;

            const xml = `
            <uid_spec>
                <api_config base_url="https://api.example.com" />
                <flex direction="column">
                    <button class="btn-url-post">
                        <on_click action="XHR">
                            <url>/api/v1/orders/query</url>
                            <method>POST</method>
                        </on_click>
                    </button>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            container.querySelector(".btn-url-post").click();
            await new Promise(r => setTimeout(r, 50));

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            // Revalidate by URL filter match
            engine.revalidateApi("/api/v1/orders");
            await new Promise(r => setTimeout(r, 50));

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("4. Additional Resilience & Edge Case Tests", () => {
        it("should render primitive string arrays and handle null/undefined initial states in <for_each>", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="tags" type="array"></state>
                </data_model>
                <flex direction="column">
                    <for_each items="{data.tags}" var="tag">
                        <span class="tag-pill">{tag}</span>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            
            // Set null initially (should not throw)
            expect(() => engine.setState("tags", null)).not.toThrow();
            expect(container.querySelectorAll(".tag-pill").length).toBe(0);

            // Set primitive string array
            engine.setState("tags", ["javascript", "euix", "testing"]);
            const pills = Array.from(container.querySelectorAll(".tag-pill")).map(el => el.textContent.trim());
            expect(pills).toEqual(["javascript", "euix", "testing"]);
        });

        it("should ignore HTML comments inside <uid_spec> and <for_each> without creating dummy DOM nodes", () => {
            const xml = `
            <uid_spec>
                <!-- Root Header Comment -->
                <data_model>
                    <state id="items" type="array"></state>
                </data_model>
                <flex direction="column" class="container-box">
                    <!-- Inside Layout Comment -->
                    <h1>Items List</h1>
                    <for_each items="{data.items}" var="item">
                        <!-- Inside Loop Item Comment -->
                        <span class="item-title">{item.title}</span>
                    </for_each>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.setState("items", [{ title: "Alpha" }, { title: "Beta" }]);

            const titles = Array.from(container.querySelectorAll(".item-title")).map(el => el.textContent.trim());
            expect(titles).toEqual(["Alpha", "Beta"]);

            // Ensure visual root container mounted cleanly
            expect(container.querySelector(".container-box")).not.toBeNull();
        });

        it("should auto-vivify nested property paths when two-way binding on inputs", () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="user" type="object">{}</state>
                </data_model>
                <flex direction="column">
                    <input id="bio_input" bind="user.profile.bio" />
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const inputEl = container.querySelector("#bio_input");

            // Dispatch input event
            inputEl.value = "Hello World";
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));

            const userState = engine.getState("user");
            expect(userState).toBeDefined();
            expect(userState.profile).toBeDefined();
            expect(userState.profile.bio).toBe("Hello World");
        });
    });
});

