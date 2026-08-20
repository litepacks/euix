/**
 * tests/navigator_listeners_deep.test.js
 * Deep coverage for EUIXNavigatorPlugin battery events, network changes, and geolocation watcher.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXNavigatorPlugin } from '../src/plugins/EUIXNavigatorPlugin.js';

describe('EUIXNavigatorPlugin - Battery, Network, and Geolocation Listeners', () => {
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

    it('should test trackBattery="true" with levelchange and chargingchange events', async () => {
        const listeners = {};
        const mockBattery = {
            level: 0.85,
            charging: false,
            chargingTime: 0,
            dischargingTime: 3600,
            addEventListener: vi.fn((event, cb) => {
                listeners[event] = cb;
            }),
            removeEventListener: vi.fn((event) => {
                delete listeners[event];
            })
        };

        navigator.getBattery = vi.fn().mockResolvedValue(mockBattery);

        const xml = `
        <uid_spec>
            <navigator_config bind="device" track_battery="true" />
            <div>Device Battery Test</div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 40));

        let deviceState = engine.getState('device');
        expect(deviceState).toBeDefined();
        expect(deviceState.battery).toEqual(expect.objectContaining({
            level: 85,
            charging: false
        }));

        // Trigger chargingchange
        mockBattery.charging = true;
        mockBattery.level = 0.90;
        if (listeners['chargingchange']) {
            listeners['chargingchange']();
        }

        deviceState = engine.getState('device');
        expect(deviceState.battery.charging).toBe(true);
        expect(deviceState.battery.level).toBe(90);

        // Test unmount listener cleanup
        engine.unmount();
        expect(mockBattery.removeEventListener).toHaveBeenCalledWith('levelchange', expect.any(Function));
        expect(mockBattery.removeEventListener).toHaveBeenCalledWith('chargingchange', expect.any(Function));
    });

    it('should test trackNetwork="true" and trackGeo="true" with watchPosition updates', async () => {
        let geoSuccessCb;
        const clearWatchSpy = vi.fn();
        navigator.geolocation = {
            watchPosition: vi.fn((success) => {
                geoSuccessCb = success;
                return 999;
            }),
            clearWatch: clearWatchSpy
        };

        const connListeners = {};
        const mockConnection = {
            downlink: 10,
            rtt: 50,
            effectiveType: '4g',
            saveData: false,
            addEventListener: vi.fn((ev, cb) => {
                connListeners[ev] = cb;
            }),
            removeEventListener: vi.fn((ev) => {
                delete connListeners[ev];
            })
        };
        navigator.connection = mockConnection;

        const xml = `
        <uid_spec>
            <navigator_config bind="system" track_network="true" track_geo="true" />
            <div>System Test</div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 40));

        // Simulate Geolocation watch update
        if (geoSuccessCb) {
            geoSuccessCb({
                coords: { latitude: 41.0082, longitude: 28.9784, accuracy: 10, altitude: 0, heading: 0, speed: 0 },
                timestamp: 1600000050
            });
        }

        let sysState = engine.getState('system');
        expect(sysState.geolocation).toEqual(expect.objectContaining({
            latitude: 41.0082,
            longitude: 28.9784
        }));

        // Simulate Network Connection change
        mockConnection.effectiveType = '3g';
        if (connListeners['change']) {
            connListeners['change']();
        }

        sysState = engine.getState('system');
        expect(sysState.network.effectiveType).toBe('3g');

        // Test unmount cleanup
        engine.unmount();
        expect(clearWatchSpy).toHaveBeenCalledWith(999);
        expect(mockConnection.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});
