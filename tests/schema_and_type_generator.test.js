// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { generateXSDSchema, generateJsonSchema, generateComponentTypes } from "../src/compiler/index.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("XSD / JSON Schema & TypeScript Type Generation Suite", () => {
    const tmpDir = path.resolve("./scratch/schema_test_tmp");

    afterEach(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("should generate comprehensive W3C XML Schema Definition (XSD)", () => {
        const xsd = generateXSDSchema();
        expect(typeof xsd).toBe("string");
        expect(xsd).toContain("<xs:schema");
        expect(xsd).toContain('targetNamespace="http://euix.org/schema/uid_spec"');
        expect(xsd).toContain('<xs:element name="uid_spec" type="UidSpecType" />');
        expect(xsd).toContain('<xs:element name="component_def" type="ComponentDefType" />');
        expect(xsd).toContain('<xs:complexType name="DataModelType">');
        expect(xsd).toContain('<xs:complexType name="ApiEndpointType"');
        expect(xsd).toContain('<xs:complexType name="ApiStreamType">');
        expect(xsd).toContain('<xs:complexType name="ValidationRulesType">');
        expect(xsd).toContain('<xs:complexType name="DialogType"');
        expect(xsd).toContain('<xs:complexType name="CollapseType"');
        expect(xsd).toContain('<xs:complexType name="LiveRegionType"');
        expect(xsd).toContain('<xs:complexType name="FlexType"');
        expect(xsd).toContain('<xs:complexType name="ForEachType">');
    });

    it("should generate standard JSON Schema draft-07", () => {
        const jsonSchema = generateJsonSchema();
        expect(jsonSchema.$schema).toBe("http://json-schema.org/draft-07/schema#");
        expect(jsonSchema.properties.uid_spec).toBeDefined();
        expect(jsonSchema.properties.uid_spec.properties.data_model).toBeDefined();
        expect(jsonSchema.properties.uid_spec.properties.api_config).toBeDefined();
    });

    it("should generate strict TypeScript definitions (.d.ts) from XML templates", () => {
        const xml = `
        <component_def name="UserProfileCard">
          <data_model>
            <state id="userId" type="number">101</state>
            <state id="username" type="string">johndoe</state>
            <state id="isActive" type="boolean">true</state>
            <state id="tags" type="array">["admin", "moderator"]</state>
            <state id="metadata" type="object">{"theme": "dark"}</state>
            <computed id="fullName" type="string">{data.username} (Active)</computed>
          </data_model>

          <actions>
            <action_def name="UpdateUserProfile">
              <param name="newUsername" type="string" required="true" />
              <param name="theme" type="string" default="light" />
              <param name="age" type="number" />
              <step action="SET_STATE">
                <path>data.username</path>
                <value>{args.newUsername}</value>
              </step>
            </action_def>
          </actions>

          <flex direction="column">
            <h2>{data.fullName}</h2>
          </flex>
        </component_def>
        `;

        const dts = generateComponentTypes(xml, { componentName: "UserProfileCard" });
        expect(dts).toContain("export interface UserProfileCardState {");
        expect(dts).toContain("    userId: number;");
        expect(dts).toContain("    username: string;");
        expect(dts).toContain("    isActive: boolean;");
        expect(dts).toContain("    tags: Array<any>;");
        expect(dts).toContain("    metadata: Record<string, any>;");
        expect(dts).toContain("    fullName: string;");

        expect(dts).toContain("export interface UserProfileCardActions {");
        expect(dts).toContain("    UpdateUserProfile: (args: { newUsername: string; theme?: string; age?: number }) => Promise<any>;");

        expect(dts).toContain("export type UserProfileCardEngine = EUIXEngineCore & {");
    });

    it("should execute CLI commands via bin/euix.js for XSD, JSON, Typegen, and Compile", () => {
        fs.mkdirSync(tmpDir, { recursive: true });

        const testXmlPath = path.join(tmpDir, "TestComp.xml");
        const xsdPath = path.join(tmpDir, "schema.xsd");
        const jsonPath = path.join(tmpDir, "schema.json");
        const dtsPath = path.join(tmpDir, "TestComp.d.ts");
        const compiledJsPath = path.join(tmpDir, "TestComp.compiled.js");

        fs.writeFileSync(
            testXmlPath,
            `<uid_spec>
              <data_model>
                <state id="score" type="number">100</state>
                <state id="name">Winner</state>
              </data_model>
              <h1>{data.name}: {data.score}</h1>
            </uid_spec>`,
            "utf8"
        );

        // 1. Test CLI schema:xsd
        execSync(`node ./bin/euix.js schema:xsd -o "${xsdPath}"`, { stdio: "pipe" });
        expect(fs.existsSync(xsdPath)).toBe(true);
        expect(fs.readFileSync(xsdPath, "utf8")).toContain("<xs:schema");

        // 2. Test CLI schema:json
        execSync(`node ./bin/euix.js schema:json -o "${jsonPath}"`, { stdio: "pipe" });
        expect(fs.existsSync(jsonPath)).toBe(true);
        expect(fs.readFileSync(jsonPath, "utf8")).toContain('"title": "EUIX XML UI Specification Schema"');

        // 3. Test CLI typegen
        execSync(`node ./bin/euix.js typegen "${testXmlPath}" -o "${dtsPath}"`, { stdio: "pipe" });
        expect(fs.existsSync(dtsPath)).toBe(true);
        const generatedDts = fs.readFileSync(dtsPath, "utf8");
        expect(generatedDts).toContain("score: number;");
        expect(generatedDts).toContain("name: string;");

        // 4. Test CLI compile
        execSync(`node ./bin/euix.js compile "${testXmlPath}" -o "${compiledJsPath}"`, { stdio: "pipe" });
        expect(fs.existsSync(compiledJsPath)).toBe(true);
        expect(fs.readFileSync(compiledJsPath, "utf8")).toContain("export const ast =");
    });
});
