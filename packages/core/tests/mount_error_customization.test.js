import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { mountElement } from "../src/core/lifecycle/DeclarativeLoader.js";

describe("Mount Error Customization & Visibility Controls", () => {
    let container;
    let originalFetch;
    let consoleErrorSpy;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        originalFetch = globalThis.fetch;
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        EUIXEngine.config.showMountErrors = true;
        EUIXEngine.config.defaultMountError = null;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        consoleErrorSpy.mockRestore();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        EUIXEngine.config.showMountErrors = true;
        EUIXEngine.config.defaultMountError = null;
        if (typeof window !== "undefined") {
            delete window.__EUIX_SHOW_MOUNT_ERRORS__;
            delete window.__EUIX_DEFAULT_MOUNT_ERROR__;
        }
    });

    it("should render default [EUIX Mount Error] when fetch fails without custom error config", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing-component.xml");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(engine).toBeNull();
        expect(div.classList.contains("euix-error")).toBe(true);

        const errEl = div.querySelector(".euix-mount-error");
        expect(errEl).not.toBeNull();
        expect(errEl.textContent).toContain("[EUIX Mount Error]");
    });

    it("should completely hide visual error when data-show-error='false'", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/network-fail.xml");
        div.setAttribute("data-show-error", "false");
        container.appendChild(div);

        let eventDispatched = false;
        div.addEventListener("euix:error", (e) => {
            eventDispatched = true;
            expect(e.detail.error.message).toBe("Failed to fetch");
        });

        const engine = await mountElement(EUIXEngine, div);
        expect(engine).toBeNull();
        expect(div.classList.contains("euix-error")).toBe(true);
        expect(div.querySelector(".euix-mount-error")).toBeNull();
        expect(eventDispatched).toBe(true);
    });

    it("should hide visual error when data-error='none' or data-error='false'", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div1 = document.createElement("div");
        div1.setAttribute("data-euix", "/fail1.xml");
        div1.setAttribute("data-error", "none");
        container.appendChild(div1);

        await mountElement(EUIXEngine, div1);
        expect(div1.querySelector(".euix-mount-error")).toBeNull();

        const div2 = document.createElement("div");
        div2.setAttribute("data-euix", "/fail2.xml");
        div2.setAttribute("data-error", "false");
        container.appendChild(div2);

        await mountElement(EUIXEngine, div2);
        expect(div2.querySelector(".euix-mount-error")).toBeNull();
    });

    it("should hide visual error when programmatic option showError is false", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/fail.xml");
        container.appendChild(div);

        await mountElement(EUIXEngine, div, { showError: false });
        expect(div.querySelector(".euix-mount-error")).toBeNull();
        expect(div.classList.contains("euix-error")).toBe(true);
    });

    it("should render custom error message defined via data-error attribute", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        div.setAttribute("data-error", "Bileşen yüklenemedi. Lütfen tekrar deneyin.");
        container.appendChild(div);

        await mountElement(EUIXEngine, div);
        const errEl = div.querySelector(".euix-mount-error");
        expect(errEl).not.toBeNull();
        expect(errEl.textContent).toBe("Bileşen yüklenemedi. Lütfen tekrar deneyin.");
    });

    it("should render custom template defined via data-error='#template-id'", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const template = document.createElement("template");
        template.id = "my-custom-error-tpl";
        template.innerHTML = `<div class="user-custom-err-box"><h3>Özel Hata Başlığı</h3><p>İçerik yüklenirken bir problem oluştu.</p></div>`;
        document.body.appendChild(template);

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        div.setAttribute("data-error", "#my-custom-error-tpl");
        container.appendChild(div);

        await mountElement(EUIXEngine, div);
        expect(div.querySelector(".user-custom-err-box")).not.toBeNull();
        expect(div.textContent).toContain("Özel Hata Başlığı");

        template.remove();
    });

    it("should support programmatic renderError callback", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        container.appendChild(div);

        await mountElement(EUIXEngine, div, {
            renderError: (err, el) => {
                const span = document.createElement("span");
                span.className = "custom-rendered-span";
                span.textContent = `Özel Hata: ${err.message}`;
                return span;
            },
        });

        const span = div.querySelector(".custom-rendered-span");
        expect(span).not.toBeNull();
        expect(span.textContent).toBe("Özel Hata: Failed to fetch");
    });

    it("should support global config EUIXEngine.config.showMountErrors = false", async () => {
        EUIXEngine.config.showMountErrors = false;
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        container.appendChild(div);

        await mountElement(EUIXEngine, div);
        expect(div.querySelector(".euix-mount-error")).toBeNull();
    });

    it("should support global config EUIXEngine.config.defaultMountError", async () => {
        EUIXEngine.config.defaultMountError = "Genel Sistem Hatası: Bileşen bulunamadı.";
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        container.appendChild(div);

        await mountElement(EUIXEngine, div);
        const errEl = div.querySelector(".euix-mount-error");
        expect(errEl).not.toBeNull();
        expect(errEl.textContent).toBe("Genel Sistem Hatası: Bileşen bulunamadı.");
    });

    it("should support options.onError callback alongside euix:error event", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/missing.xml");
        container.appendChild(div);

        let onErrorCalled = false;
        await mountElement(EUIXEngine, div, {
            onError: (err, el) => {
                onErrorCalled = true;
                expect(err.message).toBe("Failed to fetch");
                expect(el).toBe(div);
            },
        });

        expect(onErrorCalled).toBe(true);
    });
});
