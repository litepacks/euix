import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { _getLongestIncreasingSubsequence, _reconcileKeyedDOM } from "../src/core/renderer/KeyedReconciler.js";
import {
    renderInputElement,
    renderTextareaElement,
    renderSelectElement,
    renderOptionElement,
    renderFormElement,
    renderFormControl,
} from "../src/core/renderer/formControls.js";
import { renderSlotElement } from "../src/core/renderer/SlotRenderer.js";

describe("Renderer Modular Units (KeyedReconciler, formControls, SlotRenderer)", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    describe("1. KeyedReconciler & LIS Algorithm", () => {
        it("should calculate correct Longest Increasing Subsequence indices", () => {
            expect(_getLongestIncreasingSubsequence([])).toEqual([0]);
            expect(_getLongestIncreasingSubsequence([10, 9, 2, 5, 3, 7, 101, 18])).toEqual([2, 4, 5, 7]);
            expect(_getLongestIncreasingSubsequence([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
            expect(_getLongestIncreasingSubsequence([4, 3, 2, 1])).toEqual([3]);
        });

        it("should perform 2-item swap fast-path cleanly", () => {
            const nodeA = document.createElement("span");
            nodeA.textContent = "A";
            const nodeB = document.createElement("span");
            nodeB.textContent = "B";

            container.appendChild(nodeA);
            container.appendChild(nodeB);

            const oldKeyedMap = new Map([
                ["a", { nodes: [nodeA] }],
                ["b", { nodes: [nodeB] }],
            ]);
            const newKeyedMap = new Map([
                ["a", { nodes: [nodeA] }],
                ["b", { nodes: [nodeB] }],
            ]);

            // Swap: [a, b] -> [b, a]
            _reconcileKeyedDOM(container, oldKeyedMap, newKeyedMap, ["a", "b"], ["b", "a"]);

            expect(container.childNodes[0]).toBe(nodeB);
            expect(container.childNodes[1]).toBe(nodeA);
        });

        it("should handle sub-array reverse batching", () => {
            const nodes = [1, 2, 3, 4].map((i) => {
                const el = document.createElement("div");
                el.textContent = String(i);
                container.appendChild(el);
                return el;
            });

            const keys = ["k1", "k2", "k3", "k4"];
            const oldMap = new Map(keys.map((k, idx) => [k, { nodes: [nodes[idx]] }]));
            const newMap = new Map(keys.map((k, idx) => [k, { nodes: [nodes[idx]] }]));

            _reconcileKeyedDOM(container, oldMap, newMap, keys, ["k4", "k3", "k2", "k1"]);

            expect(container.childNodes[0].textContent).toBe("4");
            expect(container.childNodes[1].textContent).toBe("3");
            expect(container.childNodes[2].textContent).toBe("2");
            expect(container.childNodes[3].textContent).toBe("1");
        });
    });

    describe("2. formControls Modular Unit", () => {
        it("should render text input and synchronize state on input event", () => {
            const engine = new EUIXEngineCore(container);
            engine.mount(`
                <uid_spec>
                    <data_model>
                        <state id="username" type="string">JohnDoe</state>
                    </data_model>
                    <input bind="username" class="test-input" placeholder="Enter name" />
                </uid_spec>
            `);

            const input = container.querySelector(".test-input");
            expect(input).toBeTruthy();
            expect(input.value).toBe("JohnDoe");

            input.value = "JaneDoe";
            input.dispatchEvent(new Event("input"));

            expect(engine.getState("username")).toBe("JaneDoe");
        });

        it("should render checkbox and synchronize boolean state", () => {
            const engine = new EUIXEngineCore(container);
            engine.mount(`
                <uid_spec>
                    <data_model>
                        <state id="agree" type="boolean">false</state>
                    </data_model>
                    <input type="checkbox" bind.boolean="agree" class="agree-cb" />
                </uid_spec>
            `);

            const cb = container.querySelector(".agree-cb");
            expect(cb.checked).toBe(false);

            cb.checked = true;
            cb.dispatchEvent(new Event("change"));

            expect(engine.getState("agree")).toBe(true);
        });

        it("should render textarea and select dropdowns", () => {
            const engine = new EUIXEngineCore(container);
            engine.mount(`
                <uid_spec>
                    <data_model>
                        <state id="selectedRole" type="string">admin</state>
                        <state id="bio" type="string">Sample bio text</state>
                    </data_model>
                    <form class="profile-form">
                        <select bind="selectedRole" class="role-select">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <textarea bind="bio" class="bio-textarea"></textarea>
                    </form>
                </uid_spec>
            `);

            const select = container.querySelector(".role-select");
            const textarea = container.querySelector(".bio-textarea");
            const form = container.querySelector(".profile-form");

            expect(select.value).toBe("admin");
            expect(textarea.value).toBe("Sample bio text");
            expect(form.tagName.toLowerCase()).toBe("form");

            select.value = "user";
            select.dispatchEvent(new Event("change"));
            expect(engine.getState("selectedRole")).toBe("user");
        });
    });

    describe("3. SlotRenderer Modular Unit", () => {
        it("should project named and default slots with slot scope variables", () => {
            const engine = new EUIXEngineCore(container);
            engine.mount(`
                <uid_spec>
                    <component_def name="user-badge">
                        <div class="user-badge">
                            <slot name="avatar" user="Alice" role="Admin">
                                <span>Default Avatar</span>
                            </slot>
                            <slot>
                                <span>Default Body</span>
                            </slot>
                        </div>
                    </component_def>

                    <div>
                        <component name="user-badge">
                            <template slot="avatar" let="p">
                                <span class="custom-avatar">{p.user} ({p.role})</span>
                            </template>
                            <p class="custom-body">Custom projected body content</p>
                        </component>
                    </div>
                </uid_spec>
            `);

            const avatar = container.querySelector(".custom-avatar");
            expect(avatar).toBeTruthy();
            expect(avatar.textContent).toBe("Alice (Admin)");

            const body = container.querySelector(".custom-body");
            expect(body).toBeTruthy();
            expect(body.textContent).toBe("Custom projected body content");
        });

        it("should render fallback slot content when projection is absent", () => {
            const engine = new EUIXEngineCore(container);
            engine.mount(`
                <uid_spec>
                    <component_def name="card">
                        <div class="card">
                            <slot name="header">
                                <h3 class="default-header">Fallback Title</h3>
                            </slot>
                        </div>
                    </component_def>

                    <component name="card" />
                </uid_spec>
            `);

            const fallbackHeader = container.querySelector(".default-header");
            expect(fallbackHeader).toBeTruthy();
            expect(fallbackHeader.textContent).toBe("Fallback Title");
        });
    });
});
