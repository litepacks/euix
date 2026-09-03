import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("TypeScript State Schema & Types Suite", () => {
    it("exports valid TypeScript definition files for core, plugins, and main bundle", () => {
        const rootDir = process.cwd();
        const indexDts = path.join(rootDir, "types/index.d.ts");
        const coreDts = path.join(rootDir, "types/core.d.ts");
        const pluginsDts = path.join(rootDir, "types/plugins.d.ts");

        expect(fs.existsSync(indexDts)).toBe(true);
        expect(fs.existsSync(coreDts)).toBe(true);
        expect(fs.existsSync(pluginsDts)).toBe(true);

        const coreContent = fs.readFileSync(coreDts, "utf8");
        expect(coreContent).toContain("class EUIXEngineCore<TState");
        expect(coreContent).toContain("getState<K extends keyof TState>(key: K): TState[K]");
        expect(coreContent).toContain("setState<K extends keyof TState>");
        expect(coreContent).toContain("ErrorBoundaryController");
        expect(coreContent).toContain("BindingModifiers");

        const indexContent = fs.readFileSync(indexDts, "utf8");
        expect(indexContent).toContain("class EUIXEngine<TState");
    });

    it("verifies strong type checking with tsc compiler across generic state schemas", () => {
        const tempTsPath = path.join(process.cwd(), "test_temp_typecheck.ts");
        const sampleTs = `
            import { EUIXEngine, EUIXEngineCore } from "./types/index";

            interface Todo {
                id: number;
                title: string;
                completed: boolean;
            }

            interface MyDashboardState {
                counter: number;
                userName: string;
                isOnline: boolean;
                todos: Todo[];
            }

            const xml = "<uid_spec></uid_spec>";
            const container = document.createElement("div");

            // 1. Full bundle mount<TState>()
            const engine = EUIXEngine.mount<MyDashboardState>(xml, container);

            // Inferred state reads
            const count: number = engine.getState("counter");
            const user: string = engine.getState("userName");
            const online: boolean = engine.getState("isOnline");
            const list: Todo[] = engine.getState("todos");

            // Typed state updates
            engine.setState("counter", 42);
            engine.setState("userName", "Bob");
            engine.setState("isOnline", true);
            engine.setState({ counter: 50, isOnline: false });

            // Array mutation
            engine.mutateState("todos", "PUSH", { id: 1, title: "Buy Milk", completed: false });

            // Error boundary controls
            engine.resetErrorBoundary("MyBoundary");
            const boundary = engine.getErrorBoundary("MyBoundary");
            if (boundary) {
                boundary.retry();
            }

            // 2. Core bundle mount<TState>()
            const coreEngine = EUIXEngineCore.mount<MyDashboardState>(xml, container);
            const coreCount: number = coreEngine.getState("counter");
        `;

        fs.writeFileSync(tempTsPath, sampleTs);
        try {
            const localTsc = path.join(process.cwd(), "node_modules/.bin/tsc");
            const tscCmd = fs.existsSync(localTsc) ? `"${localTsc}"` : "npx -p typescript tsc";
            const output = execSync(`${tscCmd} --noEmit --skipLibCheck --target ES2022 test_temp_typecheck.ts`, {
                cwd: process.cwd(),
                encoding: "utf8"
            });
            expect(output).toBe("");
        } finally {
            if (fs.existsSync(tempTsPath)) fs.unlinkSync(tempTsPath);
        }
    });
});
