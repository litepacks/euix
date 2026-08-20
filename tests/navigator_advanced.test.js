/**
 * tests/navigator_advanced.test.js
 * Advanced tests for EUIXNavigatorPlugin covering hardware APIs, clipboard, wake lock, share, and geolocation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXNavigatorPlugin } from '../src/plugins/EUIXNavigatorPlugin.js';

describe('EUIXNavigatorPlugin - Advanced Hardware, Clipboard, and Device Actions', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXNavigatorPlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should execute CLIPBOARD_READ, READ_CLIPBOARD, and fallback CLIPBOARD_COPY', async () => {
        // Mock navigator.clipboard
        navigator.clipboard = {
            readText: vi.fn().mockResolvedValue('Copied Secret Text'),
            writeText: vi.fn().mockResolvedValue(undefined)
        };

        const xml = `
        <uid_spec>
            <data_model>
                <state id="clipText"></state>
            </data_model>
            <flex direction="column">
                <button id="read_btn">
                    <on_click action="CLIPBOARD_READ" target="data.clipText" />
                </button>
                <button id="copy_btn">
                    <on_click action="CLIPBOARD_COPY" text="New Hello World" />
                </button>
                <button id="alias_read_btn">
                    <on_click action="READ_CLIPBOARD" target="data.clipText" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1. CLIPBOARD_READ
        container.querySelector('#read_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(engine.getState('clipText')).toBe('Copied Secret Text');

        // 2. CLIPBOARD_COPY
        container.querySelector('#copy_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('New Hello World');

        // 3. Document.execCommand fallback when navigator.clipboard is unavailable
        navigator.clipboard = undefined;
        document.execCommand = vi.fn().mockReturnValue(true);

        container.querySelector('#copy_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should execute WEB_SHARE, SHARE, and VIBRATE actions', async () => {
        navigator.share = vi.fn().mockResolvedValue(undefined);
        navigator.canShare = vi.fn().mockReturnValue(true);
        navigator.vibrate = vi.fn().mockReturnValue(true);

        const xml = `
        <uid_spec>
            <flex direction="column">
                <button id="share_btn">
                    <on_click action="WEB_SHARE" title="EUIX Engine" text="Declarative UI" url="https://euix.dev" />
                </button>
                <button id="share_alias_btn">
                    <on_click action="SHARE" title="Alias Share" text="Hello" url="https://euix.dev" />
                </button>
                <button id="vibrate_single_btn">
                    <on_click action="VIBRATE" duration="100" />
                </button>
                <button id="vibrate_pattern_btn">
                    <on_click action="VIBRATE" pattern="[100, 50, 100]" />
                </button>
            </flex>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);

        // 1. WEB_SHARE
        container.querySelector('#share_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(navigator.share).toHaveBeenCalledWith({
            title: 'EUIX Engine',
            text: 'Declarative UI',
            url: 'https://euix.dev'
        });

        // 2. SHARE alias
        container.querySelector('#share_alias_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(navigator.share).toHaveBeenCalledTimes(2);

        // 3. VIBRATE single duration
        container.querySelector('#vibrate_single_btn').click();
        expect(navigator.vibrate).toHaveBeenCalledWith(100);

        // 4. VIBRATE pattern array
        container.querySelector('#vibrate_pattern_btn').click();
        expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
    });

    it('should execute WAKE_LOCK request and release, and handle GET_GEOLOCATION success and error', async () => {
        // Mock wakeLock
        const mockWakeLockSentinel = {
            released: false,
            release: vi.fn().mockImplementation(async () => {
                mockWakeLockSentinel.released = true;
            })
        };
        navigator.wakeLock = {
            request: vi.fn().mockResolvedValue(mockWakeLockSentinel)
        };

        // Mock geolocation
        let geoSuccessCb, geoErrorCb;
        navigator.geolocation = {
            getCurrentPosition: vi.fn((success, error) => {
                geoSuccessCb = success;
                geoErrorCb = error;
            }),
            watchPosition: vi.fn().mockReturnValue(123),
            clearWatch: vi.fn()
        };

        const xml = `
        <uid_spec>
            <data_model>
                <state id="geo" type="object"></state>
                <state id="geo_error"></state>
            </data_model>
            <flex direction="column">
                <button id="lock_req_btn">
                    <on_click action="WAKE_LOCK" type="request" />
                </button>
                <button id="lock_rel_btn">
                    <on_click action="WAKE_LOCK" type="release" />
                </button>
                <button id="geo_btn">
                    <on_click action="GET_GEOLOCATION" target="data.geo" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1. Wake Lock Request
        container.querySelector('#lock_req_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');

        // 2. Wake Lock Release
        container.querySelector('#lock_rel_btn').click();
        await new Promise(r => setTimeout(r, 30));
        expect(mockWakeLockSentinel.release).toHaveBeenCalled();

        // 3. GET_GEOLOCATION Success
        container.querySelector('#geo_btn').click();
        if (geoSuccessCb) {
            geoSuccessCb({
                coords: { latitude: 37.7749, longitude: -122.4194, accuracy: 5, altitude: 0, heading: 0, speed: 0 },
                timestamp: 1600000000
            });
        }
        await new Promise(r => setTimeout(r, 30));
        expect(engine.getState('geo')).toEqual(expect.objectContaining({
            latitude: 37.7749,
            longitude: -122.4194
        }));

        // 4. GET_GEOLOCATION Error
        container.querySelector('#geo_btn').click();
        if (geoErrorCb) {
            geoErrorCb({ message: 'User denied Geolocation' });
        }
        await new Promise(r => setTimeout(r, 30));
        expect(engine.getState('geo_error')).toBe('User denied Geolocation');
    });
});
