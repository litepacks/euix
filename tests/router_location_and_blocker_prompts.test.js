/**
 * tests/router_location_and_blocker_prompts.test.js
 * Deep coverage for location search param arrays, createLocation parsing, and NavigationBlockerManager prompts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocation, parseSearchParams } from '../src/plugins/router/core/location.js';
import { NavigationBlockerManager } from '../src/plugins/router/navigation/blocker.js';

describe('Router Location & Navigation Blocker Prompts', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should parse search params with duplicate keys into arrays and handle empty strings', () => {
        // 1. Empty string
        const emptyParams = parseSearchParams('');
        expect(emptyParams).toEqual({});

        // 2. Duplicate keys -> array
        const params = parseSearchParams('?category=tech&tag=react&tag=vue&tag=euix&sort=asc');
        expect(params.category).toBe('tech');
        expect(params.sort).toBe('asc');
        expect(params.tag).toEqual(['react', 'vue', 'euix']);
        expect(params._params).toBeInstanceOf(URLSearchParams);

        // 3. createLocation from object and string with hash
        const loc = createLocation('/products?filter=all#top', undefined, { view: 'grid' }, 'loc_1');
        expect(loc.pathname).toBe('/products');
        expect(loc.search).toBe('?filter=all');
        expect(loc.hash).toBe('#top');
        expect(loc.state).toEqual({ view: 'grid' });
        expect(loc.key).toBe('loc_1');
    });

    it('should test NavigationBlockerManager shouldBlock with window.confirm true and false', async () => {
        const blockerManager = new NavigationBlockerManager();

        // 1. No blockers -> should not block
        let blocked = await blockerManager.shouldBlock({ to: '/home' });
        expect(blocked).toBe(false);

        // 2. Add blocker with custom message
        const removeBlocker = blockerManager.addBlocker(() => 'Unsaved article draft!');

        // Mock window.confirm -> false (cancel)
        window.confirm = vi.fn().mockReturnValue(false);
        blocked = await blockerManager.shouldBlock({ to: '/home' });
        expect(blocked).toBe(true);
        expect(window.confirm).toHaveBeenCalledWith('Unsaved article draft!');

        // Mock window.confirm -> true (proceed)
        window.confirm = vi.fn().mockReturnValue(true);
        blocked = await blockerManager.shouldBlock({ to: '/home' });
        expect(blocked).toBe(false);
        expect(blockerManager.state).toBe('proceeding');

        // Next call resets proceeding -> false
        blocked = await blockerManager.shouldBlock({ to: '/home' });
        expect(blocked).toBe(false);

        // 3. Test proceed, cancel and destroy cleanup
        let cancelFired = false;
        blockerManager.addEventListener('cancelled', () => { cancelFired = true; });
        blockerManager.cancel();
        expect(cancelFired).toBe(true);

        removeBlocker();
        blockerManager.destroy();
    });
});
