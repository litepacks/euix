import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXValidationPlugin } from "../src/plugins/EUIXValidationPlugin.js";
import { JSDOM } from "jsdom";

describe("Declarative Form Validation & Reactive Error Plugin Suite", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>");
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        container = document.getElementById("app");

        EUIXEngineCore.use(EUIXValidationPlugin);
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
    });

    it("should parse <validation_rules> and validate required, email, and min_length fields", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="email"></state>
            <state id="password"></state>
            <state id="submitted" type="boolean">false</state>
          </data_model>

          <validation_rules>
            <field id="email" required="true" email="true" message="Valid email is required" />
            <field id="password" required="true" min_length="8" message="Password must be at least 8 chars" />
          </validation_rules>

          <flex direction="column" gap="8">
            <input bind="email" class="input-email" />
            <span class="error-email">{errors.email}</span>

            <input bind="password" class="input-pass" />
            <span class="error-pass">{errors.password}</span>

            <button class="btn-submit">
              <on_click action="VALIDATE_FORM" on_success="SetSubmitted" />
              Submit
            </button>
          </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.validateField("email")).toBe("Valid email is required");

        // Set invalid email
        engine.setState("email", "not-an-email");
        expect(engine.validateField("email")).toBe("Valid email is required");
        expect(container.querySelector(".error-email").textContent).toBe("Valid email is required");

        // Set valid email
        engine.setState("email", "ahmet@example.com");
        expect(engine.validateField("email")).toBeNull();
        expect(container.querySelector(".error-email").textContent).toBe("");

        // Validate password min length
        engine.setState("password", "short");
        expect(engine.validateField("password")).toBe("Password must be at least 8 chars");
        expect(container.querySelector(".error-pass").textContent).toBe("Password must be at least 8 chars");

        // Set valid password
        engine.setState("password", "supersecret123");
        expect(engine.validateField("password")).toBeNull();

        const formValidation = engine.validateForm();
        expect(formValidation.isValid).toBe(true);
        expect(Object.keys(formValidation.errors).length).toBe(0);
    });

    it("should validate password match (confirm password equality)", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="password">secret123</state>
            <state id="confirm_password">wrongpass</state>
          </data_model>

          <validation_rules>
            <field id="confirm_password" match="password" message="Passwords do not match" />
          </validation_rules>

          <span class="match-error">{errors.confirm_password}</span>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.validateField("confirm_password")).toBe("Passwords do not match");
        expect(container.querySelector(".match-error").textContent).toBe("Passwords do not match");

        engine.setState("confirm_password", "secret123");
        expect(engine.validateField("confirm_password")).toBeNull();
        expect(container.querySelector(".match-error").textContent).toBe("");
    });

    it("should support numeric min and max range rules", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="age" type="number">15</state>
          </data_model>

          <validation_rules>
            <field id="age" min="18" max="65" min_msg="Must be at least 18" max_msg="Must be under 65" />
          </validation_rules>

          <span class="age-error">{errors.age}</span>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.validateField("age")).toBe("Must be at least 18");
        expect(container.querySelector(".age-error").textContent).toBe("Must be at least 18");

        engine.setState("age", 70);
        expect(engine.validateField("age")).toBe("Must be under 65");
        expect(container.querySelector(".age-error").textContent).toBe("Must be under 65");

        engine.setState("age", 25);
        expect(engine.validateField("age")).toBeNull();
        expect(container.querySelector(".age-error").textContent).toBe("");
    });

    it("should reset validation errors with resetValidation() and RESET_VALIDATION action", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="username"></state>
          </data_model>

          <validation_rules>
            <field id="username" required="true" message="Username required" />
          </validation_rules>

          <span class="user-error">{errors.username}</span>

          <button class="btn-reset">
            <on_click action="RESET_VALIDATION" />
            Reset
          </button>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        engine.validateField("username");
        expect(container.querySelector(".user-error").textContent).toBe("Username required");

        const resetBtn = container.querySelector(".btn-reset");
        resetBtn.click();
        expect(container.querySelector(".user-error").textContent).toBe("");
        expect(engine.validateForm().isValid).toBe(false); // Validating again sets it back
    });

    it("should support regex pattern and custom validator functions", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="code">INVALID_CODE</state>
          </data_model>

          <validation_rules>
            <field id="code" pattern="^[A-Z]{3}-\\d{3}$" message="Code must match ABC-123" />
          </validation_rules>

          <span class="code-error">{errors.code}</span>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine.validateField("code")).toBe("Code must match ABC-123");

        engine.setState("code", "XYZ-999");
        expect(engine.validateField("code")).toBeNull();

        // Custom validator function
        engine.registerValidationRule("code", {
            custom: (val) => (val === "XYZ-999" ? "This code is blocked" : null)
        });
        expect(engine.validateField("code")).toBe("This code is blocked");
    });
});
