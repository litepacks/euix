import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prepare, renderToString } from "../src/prepare/index.js";
import { renderToString as serverRenderToString } from "../src/server/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("EUIX Zero-DOM Server-Side Rendering (SSR) Subsystem", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_ssr");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should render PreparedApp and Runtime IR to static HTML without DOM", async () => {
        const source = {
            version: 1,
            state: {
                title: "Welcome to EUIX",
                counter: 42,
                isActive: true,
            },
            view: {
                tag: "flex",
                props: {
                    direction: "column",
                    gap: 16,
                    class: "main-container",
                },
                children: [
                    {
                        tag: "h1",
                        children: ["Hello: ", { $bind: "title" }],
                    },
                    {
                        tag: "span",
                        children: ["Count: {data.counter}"],
                    },
                    {
                        tag: "input",
                        props: {
                            bind: "counter",
                            type: "number",
                        },
                    },
                ],
            },
        };

        const app = await prepare(source);

        // 1. Render via app.renderToString()
        const htmlFromApp = app.renderToString();

        expect(htmlFromApp).toContain('class="main-container"');
        expect(htmlFromApp).toContain("display: flex; flex-direction: column; gap: 16px;");
        expect(htmlFromApp).toContain("<h1>Hello: Welcome to EUIX</h1>");
        expect(htmlFromApp).toContain("<span>Count: 42</span>");
        expect(htmlFromApp).toContain('value="42"');

        // 2. Render via standalone renderToString(app.ir)
        const htmlFromIr = renderToString(app.ir);
        expect(htmlFromIr).toBe(htmlFromApp);

        // 3. Render via server/index.js polymorphic renderToString
        const htmlFromServer = serverRenderToString(app);
        expect(htmlFromServer).toBe(htmlFromApp);
    });

    it("should allow initialData overrides during renderToString", async () => {
        const source = {
            version: 1,
            state: {
                username: "Guest",
                unreadCount: 0,
            },
            view: {
                tag: "div",
                children: [
                    {
                        tag: "p",
                        children: ["User: {data.username}"],
                    },
                    {
                        tag: "span",
                        children: ["Messages: ", { $bind: "unreadCount" }],
                    },
                ],
            },
        };

        const app = await prepare(source);

        const html = app.renderToString({
            username: "Ahmet",
            unreadCount: 7,
        });

        expect(html).toContain("<p>User: Ahmet</p>");
        expect(html).toContain("<span>Messages: 7</span>");
    });

    it("should render conditionals and loops in Runtime IR", async () => {
        const source = {
            version: 1,
            state: {
                isLoggedIn: true,
                showSecret: false,
                tasks: [
                    { id: 1, title: "Task One" },
                    { id: 2, title: "Task Two" },
                ],
            },
            view: {
                tag: "div",
                children: [
                    {
                        condition: { $bind: "isLoggedIn" },
                        tag: "p",
                        children: ["Welcome back!"],
                    },
                    {
                        condition: { $bind: "showSecret" },
                        tag: "p",
                        children: ["Top Secret Info"],
                    },
                    {
                        tag: "ul",
                        for_each: { $bind: "tasks" },
                        var: "t",
                        children: [
                            {
                                tag: "li",
                                children: ["#{index}: {t.title}"],
                            },
                        ],
                    },
                ],
            },
        };

        const app = await prepare(source);
        const html = app.renderToString();

        expect(html).toContain("<p>Welcome back!</p>");
        expect(html).not.toContain("Top Secret Info");
        expect(html).toContain("<li>#0: Task One</li>");
        expect(html).toContain("<li>#1: Task Two</li>");
    });

    it("should render registered components with passed props", async () => {
        const source = {
            version: 1,
            components: {
                Badge: {
                    view: {
                        tag: "span",
                        props: { class: "badge" },
                        children: ["Badge: ", { $prop: "label" }],
                    },
                },
            },
            view: {
                tag: "div",
                children: [
                    {
                        component: "Badge",
                        props: {
                            label: "Pro Member",
                        },
                    },
                ],
            },
        };

        const app = await prepare(source);
        const html = app.renderToString();

        expect(html).toContain('<span class="badge">Badge: Pro Member</span>');
    });

    it("should execute CLI render command with JSON file, --data flag, and -o output flag", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const jsonFilePath = path.join(tempDir, "Page.euix.json");
        const outFilePath = path.join(tempDir, "Page.html");

        const source = {
            version: 1,
            state: { greeting: "Hello World" },
            view: {
                tag: "h2",
                children: [{ $bind: "greeting" }],
            },
        };

        fs.writeFileSync(jsonFilePath, JSON.stringify(source, null, 2), "utf8");

        // 1. Render to stdout with --data override
        const stdout = execSync(
            `node ${cliPath} render ${jsonFilePath} --data '{"greeting":"Hello from SSR CLI"}'`,
            { encoding: "utf8" }
        );
        expect(stdout).toContain("<h2>Hello from SSR CLI</h2>");

        // 2. Render to output file
        execSync(`node ${cliPath} render ${jsonFilePath} -o ${outFilePath}`, {
            encoding: "utf8",
        });
        expect(fs.existsSync(outFilePath)).toBe(true);
        const fileHtml = fs.readFileSync(outFilePath, "utf8");
        expect(fileHtml).toContain("<h2>Hello World</h2>");
    });

    it("should execute CLI render command with XML file", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const xmlFilePath = path.join(tempDir, "App.xml");

        const xml = `<uid_spec>
  <data_model>
    <state id="status">Active</state>
  </data_model>
  <container>
    <h1>Status: {data.status}</h1>
  </container>
</uid_spec>`;

        fs.writeFileSync(xmlFilePath, xml, "utf8");

        const stdout = execSync(`node ${cliPath} render ${xmlFilePath}`, {
            encoding: "utf8",
        });

        expect(stdout).toContain("Status: Active");
    });
});
