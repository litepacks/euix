import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    prepare,
    createSnapshot,
    verifySnapshot,
    diffStructural,
    updateSnapshotFile,
    verifySnapshotFile,
    resolveSnapshotPath,
    SNAPSHOT_VERSION,
} from "../src/prepare/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("EUIX Deterministic IR Snapshot Testing Subsystem (euix snapshot)", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_snapshot");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should create deterministic snapshot from XML string, PreparedApp, and JSON source", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter" type="number">0</state>
                    <state id="username" type="string">Alice</state>
                </data_model>
                <flex direction="column">
                    <span>Hello, {data.username}</span>
                    <button on_click:set="counter={data.counter + 1}">Increment</button>
                </flex>
            </uid_spec>
        `;

        // 1. From XML string
        const snapFromXml = await createSnapshot(xml, {
            target: "UserCounter.xml",
            fixedDate: "2026-09-21T18:00:00.000Z",
        });

        expect(snapFromXml.version).toBe(SNAPSHOT_VERSION);
        expect(snapFromXml.target).toBe("UserCounter.xml");
        expect(snapFromXml.createdAt).toBe("2026-09-21T18:00:00.000Z");
        expect(typeof snapFromXml.hash).toBe("string");
        expect(snapFromXml.hash.length).toBeGreaterThan(0);
        expect(snapFromXml.ir).toBeDefined();
        expect(snapFromXml.ir.states.length).toBe(2);

        // 2. From PreparedApp instance
        const app = await prepare(xml);
        const snapFromApp = await app.createSnapshot({
            target: "UserCounter.xml",
            fixedDate: "2026-09-21T18:00:00.000Z",
        });

        expect(snapFromApp.hash).toBe(snapFromXml.hash);
        expect(snapFromApp.ir).toEqual(snapFromXml.ir);

        // 3. From JSON Source
        const jsonSource = {
            version: 1,
            state: {
                counter: 0,
                username: "Alice",
            },
            view: {
                tag: "flex",
                children: [
                    { tag: "span", children: ["Hello, ", { $bind: "username" }] },
                ],
            },
        };
        const snapFromJson = await createSnapshot(jsonSource, {
            target: "UserCounter.euix.json",
        });
        expect(snapFromJson.version).toBe(1);
        expect(snapFromJson.ir.states.length).toBe(2);
    });

    it("should diff structural differences accurately with diffStructural()", () => {
        const expected = {
            name: "App",
            count: 42,
            tags: ["ui", "engine"],
            config: { debug: true, port: 8080 },
        };

        // Exact match
        const diffsEmpty = diffStructural(expected, { ...expected, config: { ...expected.config } });
        expect(diffsEmpty).toEqual([]);

        // Value mismatch
        const diffsVal = diffStructural(expected, { ...expected, count: 99 });
        expect(diffsVal.length).toBe(1);
        expect(diffsVal[0].path).toBe("count");
        expect(diffsVal[0].expected).toBe(42);
        expect(diffsVal[0].actual).toBe(99);

        // Missing and unexpected properties
        const modifiedConfig = { ...expected, config: { port: 8080, extra: "yes" } };
        delete modifiedConfig.tags;
        const diffsObj = diffStructural(expected, modifiedConfig);

        expect(diffsObj.some((d) => d.path === "tags" && d.message.includes("Missing"))).toBe(true);
        expect(diffsObj.some((d) => d.path === "config.debug" && d.message.includes("Missing"))).toBe(true);
        expect(diffsObj.some((d) => d.path === "config.extra" && d.message.includes("Unexpected"))).toBe(true);

        // Array length and element differences
        const diffsArr = diffStructural(["a", "b"], ["a", "c", "d"]);
        expect(diffsArr.some((d) => d.path.includes("length"))).toBe(true);
        expect(diffsArr.some((d) => d.path === "[1]" && d.expected === "b" && d.actual === "c")).toBe(true);
        expect(diffsArr.some((d) => d.path === "[2]" && d.message.includes("Unexpected extra element"))).toBe(true);
    });

    it("should verify snapshots and detect regressions across states, views, and actions", async () => {
        const baseXml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="number">100</state>
                </data_model>
                <div>Current score: {data.score}</div>
            </uid_spec>
        `;

        const snapshot = await createSnapshot(baseXml, { target: "Score.xml" });

        // 1. Identical source passes
        const verifyPass = await verifySnapshot(baseXml, snapshot);
        expect(verifyPass.match).toBe(true);
        expect(verifyPass.diffs).toHaveLength(0);
        expect(verifyPass.expectedHash).toBe(snapshot.hash);
        expect(verifyPass.actualHash).toBe(snapshot.hash);

        // 2. State type regression (number -> string)
        const mutatedTypeXml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="string">100</state>
                </data_model>
                <div>Current score: {data.score}</div>
            </uid_spec>
        `;
        const verifyTypeFail = await verifySnapshot(mutatedTypeXml, snapshot);
        expect(verifyTypeFail.match).toBe(false);
        expect(verifyTypeFail.diffs.some((d) => d.path.includes("type") && d.expected === "number" && d.actual === "string")).toBe(true);

        // 3. View structure regression (tag change or added element)
        const mutatedViewXml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="number">100</state>
                </data_model>
                <section>Score: {data.score}</section>
            </uid_spec>
        `;
        const verifyViewFail = await verifySnapshot(mutatedViewXml, snapshot);
        expect(verifyViewFail.match).toBe(false);
        expect(verifyViewFail.diffs.some((d) => d.path.includes("tag") && d.expected === "div" && d.actual === "section")).toBe(true);

        // 4. Verify via PreparedApp method
        const app = await prepare(baseXml);
        const appVerify = await app.verifySnapshot(snapshot);
        expect(appVerify.match).toBe(true);
    });

    it("should resolve snapshot paths and handle filesystem snapshot management", async () => {
        const sourceFile = path.join(tempDir, "UserProfile.xml");
        const xmlContent = `
            <uid_spec>
                <data_model>
                    <state id="email" type="string">user@example.com</state>
                </data_model>
                <span>{data.email}</span>
            </uid_spec>
        `;
        fs.writeFileSync(sourceFile, xmlContent, "utf8");

        // 1. Path resolution
        const expectedSnapPath = path.join(tempDir, ".snapshots", "UserProfile.snap.json");
        expect(resolveSnapshotPath(sourceFile)).toBe(expectedSnapPath);

        const customOutDir = path.join(tempDir, "custom_snaps");
        expect(resolveSnapshotPath(sourceFile, customOutDir)).toBe(
            path.join(customOutDir, "UserProfile.snap.json"),
        );

        // 2. Snapshot file does not exist initially
        const preCheck = await verifySnapshotFile(sourceFile);
        expect(preCheck.exists).toBe(false);
        expect(preCheck.match).toBe(false);

        // 3. Create snapshot file
        const updateRes = await updateSnapshotFile(sourceFile);
        expect(updateRes.created).toBe(true);
        expect(fs.existsSync(expectedSnapPath)).toBe(true);

        const writtenSnap = JSON.parse(fs.readFileSync(expectedSnapPath, "utf8"));
        expect(writtenSnap.version).toBe(1);
        expect(writtenSnap.ir.states[0].name).toBe("email");

        // 4. Verify against existing snapshot
        const postCheck = await verifySnapshotFile(sourceFile);
        expect(postCheck.exists).toBe(true);
        expect(postCheck.match).toBe(true);
        expect(postCheck.diffs).toHaveLength(0);

        // 5. Detect change when source file is modified
        const modifiedXml = `
            <uid_spec>
                <data_model>
                    <state id="email" type="string">user@example.com</state>
                    <state id="verified" type="boolean">true</state>
                </data_model>
                <span>{data.email}</span>
            </uid_spec>
        `;
        fs.writeFileSync(sourceFile, modifiedXml, "utf8");

        const changedCheck = await verifySnapshotFile(sourceFile);
        expect(changedCheck.match).toBe(false);
        expect(changedCheck.diffs.length).toBeGreaterThan(0);
        expect(changedCheck.diffs.some((d) => d.path.includes("states"))).toBe(true);
    });

    it("should execute CLI snapshot command for --update and verification", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const compFile = path.join(tempDir, "Dashboard.xml");
        const compXml = `
            <uid_spec>
                <data_model>
                    <state id="widgets" type="number">4</state>
                </data_model>
                <card>Widgets: {data.widgets}</card>
            </uid_spec>
        `;
        fs.writeFileSync(compFile, compXml, "utf8");

        // 1. Check before snapshot creation should exit with code 1
        expect(() => {
            execSync(`node "${cliPath}" snapshot "${compFile}"`, { encoding: "utf8" });
        }).toThrow();

        // 2. Generate snapshot with --update flag
        const updateOutput = execSync(`node "${cliPath}" snapshot "${compFile}" --update`, {
            encoding: "utf8",
        });
        expect(updateOutput).toContain("Snapshot created for");
        expect(fs.existsSync(path.join(tempDir, ".snapshots", "Dashboard.snap.json"))).toBe(true);

        // 3. Verify snapshot with default check mode
        const verifyOutput = execSync(`node "${cliPath}" snapshot "${compFile}"`, {
            encoding: "utf8",
        });
        expect(verifyOutput).toContain("Snapshot matches for");

        // 4. Test --json flag
        const jsonOutput = execSync(`node "${cliPath}" snapshot "${compFile}" --json`, {
            encoding: "utf8",
        });
        const parsedJson = JSON.parse(jsonOutput);
        expect(parsedJson.success).toBe(true);
        expect(parsedJson.failures).toBe(0);
        expect(parsedJson.results[0].match).toBe(true);

        // 5. Break source file and assert exit code 1 with mismatch details
        const brokenXml = compXml.replace('widgets" type="number"', 'widgets" type="string"');
        fs.writeFileSync(compFile, brokenXml, "utf8");

        try {
            execSync(`node "${cliPath}" snapshot "${compFile}"`, { encoding: "utf8" });
            expect.unreachable("Command should have thrown exit code 1");
        } catch (err) {
            expect(err.status).toBe(1);
            expect(err.stderr || err.stdout).toContain("Snapshot mismatch");
        }
    }, 90000);

    it("should work with canonical JSON source files via CLI snapshot", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const jsonFile = path.join(tempDir, "AppConfig.euix.json");
        const jsonContent = {
            version: 1,
            state: {
                theme: "dark",
                fontSize: 14,
            },
            view: {
                tag: "div",
                children: ["Theme: {data.theme}"],
            },
        };
        fs.writeFileSync(jsonFile, JSON.stringify(jsonContent, null, 2), "utf8");

        // 1. Update snapshot
        const updateOutput = execSync(`node "${cliPath}" snapshot "${jsonFile}" -u`, {
            encoding: "utf8",
        });
        expect(updateOutput).toContain("Snapshot created for");
        expect(fs.existsSync(path.join(tempDir, ".snapshots", "AppConfig.snap.json"))).toBe(true);

        // 2. Check snapshot matches
        const checkOutput = execSync(`node "${cliPath}" snapshot "${jsonFile}"`, {
            encoding: "utf8",
        });
        expect(checkOutput).toContain("Snapshot matches for");
    }, 60000);
});
