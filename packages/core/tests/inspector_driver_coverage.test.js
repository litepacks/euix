import { describe, it, expect, vi } from 'vitest';
import { euix, getByComponent, getByAction, getByTestId, EuixPlaywrightWrapper } from '../src/plugins/inspector/playwright.js';
import { registerElementMetadata, getElementMetadata, isSensitiveKey, maskSensitive } from '../src/plugins/inspector/metadata.js';
import { checkUniqueness, getAccessibleInfo } from '../src/plugins/inspector/selectors.js';

describe('Inspector & Playwright Driver Unit Suite', () => {
    it('should test standalone Playwright locator helpers', () => {
        const mockPage = {
            locator: vi.fn((sel) => ({ selector: sel })),
            evaluate: vi.fn(),
            page: vi.fn()
        };

        getByComponent(mockPage, 'AppHeader');
        expect(mockPage.locator).toHaveBeenCalledWith('[data-euix-component="AppHeader"], [data-xui-component="AppHeader"]');

        getByAction(mockPage, 'SET_STATE');
        expect(mockPage.locator).toHaveBeenCalledWith('[data-euix-action*="SET_STATE"], [action="SET_STATE"]');

        getByTestId(mockPage, 'save-btn');
        expect(mockPage.locator).toHaveBeenCalledWith('[data-euix-test="save-btn"], [data-testid="save-btn"], [test-id="save-btn"]');
    });

    it('should test EuixPlaywrightWrapper chaining, wait, and scope resolution', async () => {
        const mockLocatorObj = { isVisible: vi.fn(async () => true), waitFor: vi.fn(async () => {}) };
        const mockPage = {
            locator: vi.fn((sel) => mockLocatorObj),
            evaluate: vi.fn(async () => ({ count: 10 })),
            waitForFunction: vi.fn(async () => true),
            waitForTimeout: vi.fn(async () => {}),
            page: vi.fn()
        };

        const wrapper = euix(mockPage);
        expect(wrapper).toBeInstanceOf(EuixPlaywrightWrapper);

        const compWrapper = wrapper.component('Navbar');
        expect(compWrapper.scopeSelector).toContain('Navbar');

        const actionLocator = compWrapper.action('Save');
        expect(actionLocator).toBeDefined();

        const testIdLocator = compWrapper.getByTestId('profile-link');
        expect(testIdLocator).toBeDefined();

        const elemLocator = compWrapper.element('#submit-btn');
        expect(elemLocator).toBeDefined();

        // waitForIdle
        await wrapper.waitForIdle({ timeout: 1000 });
        expect(mockPage.waitForFunction).toHaveBeenCalled();

        // waitForReady
        await compWrapper.waitForReady({ timeout: 1000 });
        expect(mockLocatorObj.waitFor).toHaveBeenCalled();
    });

    it('should test metadata registry, masking, and accessibility selectors', () => {
        const div = document.createElement('div');
        div.setAttribute('id', 'main-container');
        document.body.appendChild(div);

        registerElementMetadata(div, { component: 'MainApp', key: 'testKey' });
        const meta = getElementMetadata(div);
        expect(meta).toBeDefined();
        expect(meta.component).toBe('MainApp');

        expect(isSensitiveKey('password')).toBe(true);
        expect(isSensitiveKey('user_name')).toBe(false);

        const masked = maskSensitive({ token: 'secret123', publicInfo: 'open' });
        expect(masked.token).toBe('********');
        expect(masked.publicInfo).toBe('open');

        const btn = document.createElement('button');
        btn.textContent = 'Save Profile';
        const info = getAccessibleInfo(btn);
        expect(info.role).toBe('button');
        expect(info.name).toBe('Save Profile');

        const uniqueCheck = checkUniqueness('#main-container');
        expect(uniqueCheck.isUnique).toBe(true);
    });
});
