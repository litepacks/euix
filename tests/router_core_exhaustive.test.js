import { describe, it, expect, vi } from 'vitest';
import { createHistory, MemoryHistory, HashHistory } from '../src/plugins/router/core/history.js';
import { EUIXRouter } from '../src/plugins/router/index.js';

describe('Router Core & History Exhaustive Suite', () => {
    it('should test MemoryHistory navigation (push, replace, go, back, forward, destroy)', () => {
        const history = new MemoryHistory({ initialEntries: ['/home', '/about'], initialIndex: 0 });
        expect(history.location.pathname).toBe('/home');

        const listener = vi.fn();
        history.listen(listener);

        history.push('/contact', { from: 'home' });
        expect(history.location.pathname).toBe('/contact');
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            action: 'PUSH',
            location: expect.objectContaining({ pathname: '/contact' })
        }));

        history.replace('/contact-updated');
        expect(history.location.pathname).toBe('/contact-updated');
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            action: 'REPLACE',
            location: expect.objectContaining({ pathname: '/contact-updated' })
        }));

        history.back();
        expect(history.location.pathname).toBe('/home');

        history.forward();
        expect(history.location.pathname).toBe('/contact-updated');

        history.destroy();
        expect(history.listeners.size).toBe(0);
    });

    it('should test createHistory factory with all modes', () => {
        const memHist = createHistory({ mode: 'memory', initialEntries: ['/dashboard'] });
        expect(memHist).toBeInstanceOf(MemoryHistory);

        const hashHist = createHistory({ mode: 'hash' });
        expect(hashHist).toBeInstanceOf(HashHistory);
        hashHist.destroy();
    });

    it('should test EUIXRouter with memory history and route navigation', async () => {
        const router = new EUIXRouter({
            mode: 'memory',
            initialEntries: ['/'],
            routes: [
                {
                    path: '/',
                    id: 'root',
                    component: '<div id="home-view">Home</div>'
                },
                {
                    path: '/posts/:id',
                    id: 'post_detail',
                    loader: async ({ params }) => {
                        return { title: `Post ${params.id}` };
                    },
                    component: '<div id="post-view">Post View</div>'
                }
            ]
        });

        expect(router.location.pathname).toBe('/');

        await router.navigate('/posts/123');
        expect(router.location.pathname).toBe('/posts/123');
        expect(router.params.id).toBe('123');

        router.destroy();
    });
});
