import { describe, it, expect } from "vitest";
import { compileXmlToAst, compileXmlToJs, euixVitePlugin } from "../src/compiler/index.js";
import { renderToString, compileXmlToHtml } from "../src/server/index.js";

describe("EUIX Compiler & Zero-JSDOM SSR Suite", () => {
    const sampleXml = `
    <uid_spec>
      <data_model>
        <state id="title">My SSR Application</state>
        <state id="counter" type="number">42</state>
        <state id="isLoggedIn" type="boolean">true</state>
        <state id="items" type="array">[
          {"id": "1", "name": "Alpha", "price": 10},
          {"id": "2", "name": "Beta", "price": 25}
        ]</state>
      </data_model>

      <flex direction="column" gap="16" class="container">
        <h1>{data.title}</h1>
        <p>Counter: {data.counter}</p>

        <if condition="data.isLoggedIn">
          <card padding="20" radius="10">
            <for_each items="{data.items}" var="row" key="id">
              <div class="row-item">
                <span>{row.name}</span>
                <strong>\${row.price}</strong>
              </div>
            </for_each>
          </card>
        </if>
      </flex>
    </uid_spec>
    `;

    it("should compile XML into a lightweight AST tree without DOMParser", () => {
        const ast = compileXmlToAst(sampleXml);
        expect(ast).not.toBeNull();
        expect(ast.tag).toBe("uid_spec");
        expect(Array.isArray(ast.children)).toBe(true);

        const flexNode = ast.children.find((c) => typeof c === "object" && c.tag === "flex");
        expect(flexNode).toBeDefined();
        expect(flexNode.attrs.direction).toBe("column");
        expect(flexNode.attrs.gap).toBe("16");
    });

    it("should generate a valid JS module via compileXmlToJs", () => {
        const js = compileXmlToJs(sampleXml);
        expect(js).toContain("export const ast =");
        expect(js).toContain("export const xml =");
        expect(js).toContain("export default xml;");
    });

    it("should transform .xml and .euix files in Vite plugin", () => {
        const plugin = euixVitePlugin();
        const res = plugin.transform(sampleXml, "/src/views/Dashboard.xml");
        expect(res).not.toBeNull();
        expect(res.code).toContain("export const ast =");

        const nonXmlRes = plugin.transform("const x = 1;", "/src/main.js");
        expect(nonXmlRes).toBeNull();
    });

    it("should render XML directly into static HTML without JSDOM (Zero-JSDOM SSR)", () => {
        const html = renderToString(sampleXml);
        expect(html).toContain("My SSR Application");
        expect(html).toContain("Counter: 42");
        expect(html).toContain("Alpha");
        expect(html).toContain("$10");
        expect(html).toContain("Beta");
        expect(html).toContain("$25");
        expect(html).toContain("euix-card");
        expect(html).toContain("display: flex");
    });

    it("should allow passing initialData override to renderToString", () => {
        const html = compileXmlToHtml(sampleXml, {
            title: "Overridden Title from Server Context",
            counter: 999,
        });

        expect(html).toContain("Overridden Title from Server Context");
        expect(html).toContain("Counter: 999");
    });

    it("should correctly handle conditional rendering (<if>) in SSR", () => {
        const htmlLoggedOut = renderToString(sampleXml, { isLoggedIn: false });
        expect(htmlLoggedOut).not.toContain("Alpha");
        expect(htmlLoggedOut).not.toContain("Beta");
    });
});
