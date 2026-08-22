import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateDevToolsStatus, getBindingsStats, _getTestStats, getPerformanceMetrics, enableDevTools } from '../src/core/profiler/Profiler.js';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('Profiler & Performance Diagnostics Exhaustive Suite', () => {
    let originalWindow;

    beforeEach(() => {
        originalWindow = global.window;
    });

    afterEach(() => {
        global.window = originalWindow;
    });

    it('should update DevTools status with delta numbers and booleans', () => {
        global.window = {};
        updateDevToolsStatus(null, 'pendingActions', 2);
        expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(2);
        expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(false);

        updateDevToolsStatus(null, 'pendingActions', -1);
        expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(1);

        updateDevToolsStatus(null, 'pendingActions', -5); // Clamped at 0
        expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(0);

        updateDevToolsStatus(null, 'routeTransition', true);
        expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(false);

        updateDevToolsStatus(null, 'routeTransition', false);
        expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(true);

        // Window undefined branch
        global.window = undefined;
        expect(() => updateDevToolsStatus(null, 'pendingActions', 1)).not.toThrow();
    });

    it('should compute getBindingsStats and _getTestStats with populated and empty engine stores', () => {
        const emptyEngine = {};
        expect(getBindingsStats(emptyEngine)).toEqual({
            totalBindings: 0,
            uniqueElements: 0,
            registeredKeys: 0
        });

        const el1 = document.createElement('div');
        const el2 = document.createElement('span');
        const populatedEngine = {
            _bindings: new Map([
                ['key1', [{ el: el1 }, { el: el2 }, {}]],
                ['key2', [{ el: el1 }]],
                ['key3', 'not-an-array']
            ]),
            _activeIntervals: [1, 2],
            _stateWatchers: new Set(['w1']),
            _watchRegistry: new Map([['w2', {}]]),
            _registeredXhrs: new Map([['x1', {}]]),
            _componentSpecs: new Map([['c1', {}]]),
            _activeAnimations: new Set(['a1']),
            _activeControllers: new Set(['ctrl1']),
            _externalResources: new Set(['res1'])
        };

        const stats = getBindingsStats(populatedEngine);
        expect(stats.totalBindings).toBe(4);
        expect(stats.uniqueElements).toBe(2);
        expect(stats.registeredKeys).toBe(3);

        const testStats = _getTestStats(populatedEngine);
        expect(testStats.activeIntervals).toBe(2);
        expect(testStats.activeWatchers).toBe(2);
        expect(testStats.activeSubscriptions).toBe(3);
        expect(testStats.activeXhrs).toBe(1);
        expect(testStats.mountedComponents).toBe(1);
        expect(testStats.activeAnimations).toBe(1);
        expect(testStats.activeControllers).toBe(1);
        expect(testStats.activeResources).toBe(1);

        const emptyTestStats = _getTestStats({});
        expect(emptyTestStats.activeIntervals).toBe(0);
        expect(emptyTestStats.activeWatchers).toBe(0);
    });

    it('should extract comprehensive performance metrics including memory if available', () => {
        const mockEngine = {
            _mountDuration: 12.34,
            _bindings: new Map(),
            _componentSpecs: new Map(),
            _rawState: { a: 1, b: 2 },
            _stateWatchers: new Set(),
            _watchRegistry: new Map(),
            _computedRegistry: new Map([['comp1', {}]])
        };

        const metrics1 = getPerformanceMetrics(mockEngine, EUIXEngineCore);
        expect(metrics1.mountDuration).toBe(12.34);
        expect(metrics1.computedPropertiesCount).toBe(1);
        expect(metrics1.rawStateKeysCount).toBe(2);

        // Test with performance.memory mock
        const originalPerf = global.performance;
        global.performance = {
            ...originalPerf,
            memory: {
                usedJSHeapSize: 1024 * 1024 * 15.5,
                totalJSHeapSize: 1024 * 1024 * 32.0
            }
        };

        const metricsWithMemory = getPerformanceMetrics(mockEngine, EUIXEngineCore);
        expect(metricsWithMemory.memory).toEqual({
            usedJSHeapSize: '15.5 MB',
            totalJSHeapSize: '32.0 MB'
        });

        global.performance = originalPerf;
    });

    it('should enableDevTools with window class and autoOpen flags', () => {
        const mockDevToolsInstance = { toggle: vi.fn() };
        const mockDevToolsClass = {
            init: vi.fn(() => mockDevToolsInstance)
        };

        global.window = {
            EUIXDevTools: mockDevToolsClass
        };

        const mockEngine = {};
        enableDevTools(mockEngine, true);
        expect(mockDevToolsClass.init).toHaveBeenCalledWith(mockEngine);
        expect(mockDevToolsInstance.toggle).toHaveBeenCalledWith(true);

        // AutoOpen false
        enableDevTools(mockEngine, false);
        expect(mockDevToolsInstance.toggle).toHaveBeenCalledTimes(1);

        // Devtools returning null or not present
        global.window = {};
        enableDevTools(mockEngine, true);
    });
});
