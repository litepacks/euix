import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { renderToString } from "../src/server/index.js";

describe("Scoped Slots & Slot Props in EUIX Engine", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        container = document.getElementById("app");
    });

    it("renders basic named scoped slot with let alias", () => {
        const xml = `
            <uid_spec>
                <component_def name="user-card">
                    <div class="user-card">
                        <slot name="header" title="{props.title}" count="{props.count}">
                            <h3>Fallback Header</h3>
                        </slot>
                    </div>
                </component_def>

                <component name="user-card" title="Profile Details" count="5">
                    <template slot="header" let="s">
                        <h2 class="custom-title">{s.title} (Count: {s.count})</h2>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const titleEl = container.querySelector(".custom-title");
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent.trim()).toBe("Profile Details (Count: 5)");
    });

    it("renders default scoped slot without slot name", () => {
        const xml = `
            <uid_spec>
                <component_def name="stat-badge">
                    <div class="stat-badge">
                        <slot value="42" label="Active Users" />
                    </div>
                </component_def>

                <component name="stat-badge">
                    <template let="slot">
                        <span class="badge-val">{slot.label}: {slot.value}</span>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const badgeEl = container.querySelector(".badge-val");
        expect(badgeEl).not.toBeNull();
        expect(badgeEl.textContent.trim()).toBe("Active Users: 42");
    });

    it("supports let:* attribute destructuring on template", () => {
        const xml = `
            <uid_spec>
                <component_def name="item-preview">
                    <div class="preview">
                        <slot name="body" label="Item Alpha" price="99" />
                    </div>
                </component_def>

                <component name="item-preview">
                    <template slot="body" let:label="label" let:price="price">
                        <span class="preview-text">{label} costs \${price}</span>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const textEl = container.querySelector(".preview-text");
        expect(textEl).not.toBeNull();
        expect(textEl.textContent.trim()).toBe("Item Alpha costs $99");
    });

    it("renders fallback slot content when no projection is provided", () => {
        const xml = `
            <uid_spec>
                <component_def name="panel-box">
                    <div class="panel">
                        <slot name="footer" note="Default Note">
                            <footer class="default-footer">Standard Footer: {note}</footer>
                        </slot>
                    </div>
                </component_def>

                <component name="panel-box" />
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const footerEl = container.querySelector(".default-footer");
        expect(footerEl).not.toBeNull();
        expect(footerEl.textContent.trim()).toBe("Standard Footer: Default Note");
    });

    it("renders list component with for_each and scoped slots", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="users" type="array">[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]</state>
                </data_model>

                <component_def name="user-table">
                    <div class="table-wrap">
                        <for_each items="{props.items}" var="u" key="id">
                            <div class="row-wrapper">
                                <slot name="row" user="{u}" index="{$index}">
                                    <span>{u.name}</span>
                                </slot>
                            </div>
                        </for_each>
                    </div>
                </component_def>

                <component name="user-table" items="{data.users}">
                    <template slot="row" let="s">
                        <div class="custom-row">Row #{s.index + 1}: {s.user.name}</div>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const rows = container.querySelectorAll(".custom-row");
        expect(rows.length).toBe(2);
        expect(rows[0].textContent.trim()).toBe("Row #1: Alice");
        expect(rows[1].textContent.trim()).toBe("Row #2: Bob");
    });

    it("reacts to array state mutations in components with scoped slots", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="items" type="array">[{"id": 1, "title": "First"}]</state>
                </data_model>

                <component_def name="custom-list">
                    <div class="list">
                        <for_each items="{props.list}" var="it" key="id">
                            <div class="item-holder">
                                <slot name="item" data="{it}">
                                    <span>{it.title}</span>
                                </slot>
                            </div>
                        </for_each>
                    </div>
                </component_def>

                <component name="custom-list" list="{data.items}">
                    <template slot="item" let="s">
                        <span class="custom-item">{s.data.title}</span>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelectorAll(".custom-item").length).toBe(1);

        engine.mutateState("items", "PUSH", { id: 2, title: "Second" });
        await new Promise((r) => setTimeout(r, 25));

        const items = container.querySelectorAll(".custom-item");
        expect(items.length).toBe(2);
        expect(items[0].textContent.trim()).toBe("First");
        expect(items[1].textContent.trim()).toBe("Second");
    });

    it("renders multiple named scoped slots in a single component", () => {
        const xml = `
            <uid_spec>
                <component_def name="layout-card">
                    <div class="card">
                        <div class="card-head">
                            <slot name="head" title="Default Head" />
                        </div>
                        <div class="card-body">
                            <slot name="body" content="Default Content" />
                        </div>
                        <div class="card-foot">
                            <slot name="foot" status="Ready" />
                        </div>
                    </div>
                </component_def>

                <component name="layout-card">
                    <template slot="head" let="h">
                        <h1 class="slot-head">Head: {h.title}</h1>
                    </template>
                    <template slot="body" let="b">
                        <p class="slot-body">Body: {b.content}</p>
                    </template>
                    <template slot="foot" let="f">
                        <footer class="slot-foot">Status: {f.status}</footer>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".slot-head").textContent.trim()).toBe("Head: Default Head");
        expect(container.querySelector(".slot-body").textContent.trim()).toBe("Body: Default Content");
        expect(container.querySelector(".slot-foot").textContent.trim()).toBe("Status: Ready");
    });

    it("renders non-template elements with slot attribute and scoped let", () => {
        const xml = `
            <uid_spec>
                <component_def name="simple-wrapper">
                    <div class="wrapper">
                        <slot name="content" msg="Hello World" />
                    </div>
                </component_def>

                <component name="simple-wrapper">
                    <section slot="content" let="s" class="my-section">
                        <span>Message: {s.msg}</span>
                    </section>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const section = container.querySelector(".my-section");
        expect(section).not.toBeNull();
        expect(section.tagName.toLowerCase()).toBe("section");
        expect(section.textContent.trim()).toBe("Message: Hello World");
    });

    it("supports direct scoped prop interpolation without let alias", () => {
        const xml = `
            <uid_spec>
                <component_def name="user-badge">
                    <div class="badge">
                        <slot name="badge_content" username="Bob" role="Admin" />
                    </div>
                </component_def>

                <component name="user-badge">
                    <template slot="badge_content">
                        <span class="direct-prop">{username} - {role}</span>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const el = container.querySelector(".direct-prop");
        expect(el).not.toBeNull();
        expect(el.textContent.trim()).toBe("Bob - Admin");
    });

    it("handles actions executed from within scoped slot templates", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="clicked_user" type="string">None</state>
                </data_model>

                <component_def name="action-list">
                    <div class="action-list">
                        <slot name="action_btn" target="Alice" />
                    </div>
                </component_def>

                <component name="action-list">
                    <template slot="action_btn" let="s">
                        <button class="trigger-btn">
                            <on_click action="SET_STATE">
                                <path>data.clicked_user</path>
                                <value>{s.target}</value>
                            </on_click>
                            Click Me
                        </button>
                    </template>
                </component>

                <span class="result-text">{data.clicked_user}</span>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".result-text").textContent.trim()).toBe("None");

        const btn = container.querySelector(".trigger-btn");
        btn.click();
        await new Promise((r) => setTimeout(r, 20));

        expect(container.querySelector(".result-text").textContent.trim()).toBe("Alice");
    });

    it("supports nested components with scoped slots inside scoped slots", () => {
        const xml = `
            <uid_spec>
                <component_def name="inner-badge">
                    <span class="inner-badge">
                        <slot name="inner" text="{props.label}" />
                    </span>
                </component_def>

                <component_def name="outer-box">
                    <div class="outer-box">
                        <slot name="outer" title="Outer Title">
                            <span>Default</span>
                        </slot>
                    </div>
                </component_def>

                <component name="outer-box">
                    <template slot="outer" let="out">
                        <div class="nested-wrapper">
                            <h2>{out.title}</h2>
                            <component name="inner-badge" label="Badge #{out.title}">
                                <template slot="inner" let="inn">
                                    <strong class="deep-text">{inn.text}</strong>
                                </template>
                            </component>
                        </div>
                    </template>
                </component>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const deepEl = container.querySelector(".deep-text");
        expect(deepEl).not.toBeNull();
        expect(deepEl.textContent.trim()).toBe("Badge #Outer Title");
    });

    it("supports SSR renderToString with scoped slots", () => {
        const xml = `
            <uid_spec>
                <component_def name="ssr-card">
                    <div class="ssr-card">
                        <slot name="title_slot" heading="SSR Title" author="Jane Doe">
                            <span>Default SSR</span>
                        </slot>
                    </div>
                </component_def>

                <component name="ssr-card">
                    <template slot="title_slot" let="s">
                        <h1 class="rendered-ssr-heading">{s.heading} by {s.author}</h1>
                    </template>
                </component>
            </uid_spec>
        `;

        const html = renderToString(xml);
        expect(html).toContain('<h1 class="rendered-ssr-heading">SSR Title by Jane Doe</h1>');
    });
});
