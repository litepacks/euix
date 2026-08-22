/**
 * tests/router_location_and_blocker_prompts.test.js
 * Deep coverage for location search param arrays, createLocation parsing, and NavigationBlockerManager prompts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocation, parseSearchParams } from '../src/plugins/router/core/location.js';
import { fastDecode, matchPath, generatePath } from '../src/plugins/router/core/utils.js';
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

    it('should safely decode URI components and handle malformed percent-encoded sequences without throwing URIError', () => {
        // 1. Normal decoding
        expect(fastDecode('hello%20world')).toBe('hello world');
        expect(fastDecode('normal_string')).toBe('normal_string');
        expect(fastDecode('')).toBe('');

        // 2. Malformed URI component (e.g. invalid % sequences)
        const malformed1 = '%E0%A4%A';
        const malformed2 = '%';
        const malformed3 = 'invalid%2';

        expect(() => fastDecode(malformed1)).not.toThrow();
        expect(fastDecode(malformed1)).toBe(malformed1);
        expect(fastDecode(malformed2)).toBe(malformed2);
        expect(fastDecode(malformed3)).toBe(malformed3);

        // 3. matchPath with malformed URL parameter
        const matched = matchPath('/user/:id', '/user/%E0%A4%A');
        expect(matched).not.toBeNull();
        expect(matched.params.id).toBe('%E0%A4%A');

        // 4. generatePath with wildcard splat containing special characters
        const path = generatePath('/files/*', { '*': 'docs/my report #1?.pdf' });
        expect(path).toBe('/files/docs/my%20report%20#1?.pdf');
    });
});
