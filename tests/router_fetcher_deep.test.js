// @vitest-environment node
/**
 * tests/router_fetcher_deep.test.js
 * Comprehensive tests for RouteFetcher submit, load, state transitions, and revalidation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FetcherInstance } from '../src/plugins/router/data/fetcher.js';

describe('FetcherInstance Deep Coverage - Load, Submit, and State Transitions', () => {
    let mockRouter;
    let mockDataEngine;

    beforeEach(() => {
        mockDataEngine = {
            loaderManager: {
                executeLoader: vi.fn().mockResolvedValue({ id: '10', username: 'alex' })
            },
            actionManager: {
                executeAction: vi.fn().mockResolvedValue({ success: true, createdId: '101' })
            }
        };

        mockRouter = {
            matcher: {
                match: vi.fn((path) => {
                    if (path === '/profile') {
                        return [{ id: 'profile-route', route: { loader: true } }];
                    }
                    if (path === '/users/create') {
                        return [{ id: 'user-create-route', route: { action: true } }];
                    }
                    return null;
                })
            },
            _notifyFetcherUpdate: vi.fn(),
            revalidate: vi.fn().mockResolvedValue(undefined),
            context: {}
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should execute fetcher.load and transition states (idle -> loading -> idle)', async () => {
        const fetcher = new FetcherInstance('fetcher_1', {
            router: mockRouter,
            dataEngine: mockDataEngine
        });

        const stateChanges = [];
        fetcher.addEventListener('change', (e) => stateChanges.push(e.detail.state));

        const result = await fetcher.load('/profile');

        expect(result).toEqual({ id: '10', username: 'alex' });
        expect(fetcher.data).toEqual({ id: '10', username: 'alex' });
        expect(fetcher.state).toBe('idle');
        expect(stateChanges).toContain('loading');
        expect(stateChanges).toContain('idle');
    });

    it('should execute fetcher.submit with object data, convert to FormData, and trigger router.revalidate()', async () => {
        const fetcher = new FetcherInstance('fetcher_2', {
            router: mockRouter,
            dataEngine: mockDataEngine
        });

        const result = await fetcher.submit({ name: 'Bob', role: 'Engineer' }, { action: '/users/create' });

        expect(result).toEqual({ success: true, createdId: '101' });
        expect(mockDataEngine.actionManager.executeAction).toHaveBeenCalledWith(
            expect.objectContaining({
                formData: expect.any(FormData)
            })
        );
        expect(mockRouter.revalidate).toHaveBeenCalled();
        expect(fetcher.state).toBe('idle');
    });

    it('should handle fetcher.submit action failure and populate fetcher.error', async () => {
        mockDataEngine.actionManager.executeAction = vi.fn().mockRejectedValue(new Error('Validation Failed'));

        const fetcher = new FetcherInstance('fetcher_3', {
            router: mockRouter,
            dataEngine: mockDataEngine
        });

        await expect(fetcher.submit({ name: '' }, { action: '/users/create' })).rejects.toThrow('Validation Failed');
        expect(fetcher.error).toBeDefined();
        expect(fetcher.error.message).toBe('Validation Failed');
        expect(fetcher.state).toBe('idle');
    });
});
