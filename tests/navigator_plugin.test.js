import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXNavigatorPlugin } from '../src/plugins/EUIXNavigatorPlugin.js';

describe('EUIXNavigatorPlugin - Browser Device & Navigator Capabilities Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        EUIXEngineCore.use(EUIXNavigatorPlugin);

        // Mock navigator APIs in JSDOM environment
        Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'hardwareConcurrency', { value: 8, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'deviceMemory', { value: 16, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'language', { value: 'tr-TR', configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'languages', { value: ['tr-TR', 'tr', 'en-US', 'en'], configurable: true, writable: true });

        // Mock clipboard
        global.navigator.clipboard = {
            writeText: vi.fn().mockResolvedValue(undefined),
            readText: vi.fn().mockResolvedValue('Pasted Clipboard Content')
        };

        // Mock share
        global.navigator.share = vi.fn().mockResolvedValue(undefined);
        global.navigator.canShare = vi.fn().mockReturnValue(true);

        // Mock vibrate
        global.navigator.vibrate = vi.fn().mockReturnValue(true);

        // Mock connection
        global.navigator.connection = {
            effectiveType: '4g',
            downlink: 15.5,
            rtt: 35,
            saveData: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };

        // Mock battery
        global.navigator.getBattery = vi.fn().mockResolvedValue({
            level: 0.85,
            charging: true,
            chargingTime: 1200,
            dischargingTime: Infinity,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });

        // Mock geolocation
        global.navigator.geolocation = {
            getCurrentPosition: vi.fn((success) => {
                success({
                    coords: {
                        latitude: 41.0082,
                        longitude: 28.9784,
                        accuracy: 10,
                        altitude: null,
                        heading: null,
                        speed: null
                    },
                    timestamp: Date.now()
                });
            }),
            watchPosition: vi.fn((success) => {
                success({
                    coords: {
                        latitude: 41.0082,
                        longitude: 28.9784,
                        accuracy: 10,
                        altitude: null,
                        heading: null,
                        speed: null
                    },
                    timestamp: Date.now()
                });
                return 42;
            }),
            clearWatch: vi.fn()
        };

        // Mock App Badge
        global.navigator.setAppBadge = vi.fn().mockResolvedValue(undefined);
        global.navigator.clearAppBadge = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('1. should initialize network and hardware state reactively via <navigator_config>', () => {
        const xml = `
            <uid_spec>
                <navigator_config bind_target="nav" track_network="true" />
                <div>
                    <span class="online">{data.nav.network.online ? 'ONLINE' : 'OFFLINE'}</span>
                    <span class="eff-type">{data.nav.network.effectiveType}</span>
                    <span class="cores">{data.nav.hardware.cores}</span>
                    <span class="touch">{data.nav.hardware.touch ? 'TOUCH_ENABLED' : 'NO_TOUCH'}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const navState = engine.getState('nav');

        expect(navState).toBeDefined();
        expect(navState.network.online).toBe(true);
        expect(navState.network.effectiveType).toBe('4g');
        expect(navState.hardware.cores).toBe(8);
        expect(navState.hardware.touch).toBe(true);

        expect(container.querySelector('.online').textContent).toBe('ONLINE');
        expect(container.querySelector('.eff-type').textContent).toBe('4g');
        expect(container.querySelector('.cores').textContent).toBe('8');
        expect(container.querySelector('.touch').textContent).toBe('TOUCH_ENABLED');

        engine.unmount();
    });

    it('2. should execute declarative CLIPBOARD_COPY and CLIPBOARD_READ actions', async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="share_url">https://euixjs.org/docs</state>
                    <state id="pasted"></state>
                </data_model>
                <div>
                    <button class="btn-copy">
                        <on_click action="CLIPBOARD_COPY">
                            <text>{data.share_url}</text>
                        </on_click>
                        Copy
                    </button>
                    <button class="btn-read">
                        <on_click action="CLIPBOARD_READ" target="pasted" />
                        Paste
                    </button>
                    <span class="pasted-result">{data.pasted}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btnCopy = container.querySelector('.btn-copy');
        const btnRead = container.querySelector('.btn-read');

        btnCopy.click();
        expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('https://euixjs.org/docs');

        btnRead.click();
        await new Promise(r => setTimeout(r, 20));

        expect(global.navigator.clipboard.readText).toHaveBeenCalled();
        expect(engine.getState('pasted')).toBe('Pasted Clipboard Content');
        expect(container.querySelector('.pasted-result').textContent).toBe('Pasted Clipboard Content');

        engine.unmount();
    });

    it('3. should execute declarative WEB_SHARE action', async () => {
        const xml = `
            <uid_spec>
                <div>
                    <button class="btn-share">
                        <on_click action="WEB_SHARE">
                            <title>EUIX Framework</title>
                            <text>Ultra fast XML declarative UI</text>
                            <url>https://github.com/litepacks/euix</url>
                        </on_click>
                        Share
                    </button>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btnShare = container.querySelector('.btn-share');

        btnShare.click();
        expect(global.navigator.share).toHaveBeenCalledWith({
            title: 'EUIX Framework',
            text: 'Ultra fast XML declarative UI',
            url: 'https://github.com/litepacks/euix'
        });

        engine.unmount();
    });

    it('4. should execute declarative VIBRATE action', () => {
        const xml = `
            <uid_spec>
                <div>
                    <button class="btn-vibrate">
                        <on_click action="VIBRATE" pattern="[100, 50, 100]" />
                        Buzz
                    </button>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btnVibrate = container.querySelector('.btn-vibrate');

        btnVibrate.click();
        expect(global.navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);

        engine.unmount();
    });

    it('5. should execute GET_GEOLOCATION action and set state', async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user_location" type="object"></state>
                </data_model>
                <div>
                    <button class="btn-loc">
                        <on_click action="GET_GEOLOCATION" target="user_location" />
                        Get Location
                    </button>
                    <span class="lat">{data.user_location.latitude}</span>
                    <span class="lng">{data.user_location.longitude}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btnLoc = container.querySelector('.btn-loc');

        btnLoc.click();
        await new Promise(r => setTimeout(r, 20));

        const loc = engine.getState('user_location');
        expect(loc).toBeDefined();
        expect(loc.latitude).toBe(41.0082);
        expect(loc.longitude).toBe(28.9784);

        expect(container.querySelector('.lat').textContent).toBe('41.0082');
        expect(container.querySelector('.lng').textContent).toBe('28.9784');

        engine.unmount();
    });

    it('6. should execute SET_APP_BADGE and CLEAR_APP_BADGE actions', async () => {
        const xml = `
            <uid_spec>
                <div>
                    <button class="btn-badge">
                        <on_click action="SET_APP_BADGE" count="5" />
                        Set 5
                    </button>
                    <button class="btn-clear-badge">
                        <on_click action="CLEAR_APP_BADGE" />
                        Clear
                    </button>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btnBadge = container.querySelector('.btn-badge');
        const btnClear = container.querySelector('.btn-clear-badge');

        btnBadge.click();
        expect(global.navigator.setAppBadge).toHaveBeenCalledWith(5);

        btnClear.click();
        expect(global.navigator.clearAppBadge).toHaveBeenCalled();

        engine.unmount();
    });

    it('7. should render GPS fallback "N/A" initially and render real coordinates after GET_GEOLOCATION', async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user_coords" type="object">{}</state>
                </data_model>
                <div>
                    <div class="toast-box">
                        <strong>GPS:</strong> Lat: {data.user_coords.latitude || 'N/A'}, Lng: {data.user_coords.longitude || 'N/A'}
                    </div>
                    <button class="btn-locate">
                        <on_click action="GET_GEOLOCATION" target="user_coords" />
                        Locate
                    </button>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const toast = container.querySelector('.toast-box');

        // Initial state -> must show N/A, not true!
        expect(toast.textContent).toContain('Lat: N/A, Lng: N/A');
        expect(toast.textContent).not.toContain('true');

        // Trigger Geolocation
        const btnLocate = container.querySelector('.btn-locate');
        btnLocate.click();
        await new Promise(r => setTimeout(r, 20));

        // After locating -> must show coordinates
        expect(toast.textContent).toContain('Lat: 41.0082, Lng: 28.9784');

        engine.unmount();
    });
});
