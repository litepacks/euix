import { describe, it, expect, vi, afterEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";

describe("Global Error Handling in EUIX Engine", () => {
    afterEach(() => {
        EUIXEngineCore._globalErrorHandler = null;
    });

    it("should catch all runtime errors via static EUIXEngine.onError()", () => {
        const errorLog = [];
        EUIXEngine.onError((err, contextInfo, engine) => {
            errorLog.push({ err, contextInfo, hasEngine: Boolean(engine) });
        });

        const container = document.createElement("div");
        document.body.appendChild(container);

        const xml = `
        <uid_spec>
          <data_model>
            <state id="count">0</state>
          </data_model>
          <button id="btn-err">
            <on_click action="RUN_SCRIPT">
              throw new Error("Simulated Global Failure");
            </on_click>
            Crash
          </button>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const btn = container.querySelector("#btn-err");
        btn.click();

        expect(errorLog.length).toBeGreaterThan(0);
        expect(errorLog[0].err.message).toBe("Simulated Global Failure");
        expect(errorLog[0].contextInfo).toContain("Action Execution (RUN_SCRIPT)");
        expect(errorLog[0].hasEngine).toBe(true);
    });

    it("should catch instance-level errors via engine.onError", () => {
        const instanceErrors = [];
        const container = document.createElement("div");
        document.body.appendChild(container);

        const xml = `
        <uid_spec>
          <button id="btn-inst-err">
            <on_click action="RUN_SCRIPT">
              nonExistentFunctionCall();
            </on_click>
            Trigger
          </button>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        engine.onError = (err, contextInfo) => {
            instanceErrors.push({ err, contextInfo });
        };

        const btn = container.querySelector("#btn-inst-err");
        btn.click();

        expect(instanceErrors.length).toBeGreaterThan(0);
        expect(instanceErrors[0].err.message).toContain("nonExistentFunctionCall is not defined");
    });
});
