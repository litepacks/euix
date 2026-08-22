import { describe, it, expect, vi } from 'vitest';
import { getJsonPath, mapResponseItems, getKeyMask } from '../src/core/binding/BindingResolver.js';
import { EUIXHookEmitter } from '../src/core/events/HookEmitter.js';

describe('BindingResolver Deep Coverage Suite', () => {
    it('should resolve getJsonPath with nullish paths and deeply nested values', () => {
        const obj = { user: { profile: { name: 'Ahmet', age: 30 } }, tags: ['ui', 'xml'] };
        expect(getJsonPath(obj, null)).toBe(obj);
        expect(getJsonPath(obj, '')).toBe(obj);
        expect(getJsonPath(obj, 'user.profile.name')).toBe('Ahmet');
        expect(getJsonPath(obj, 'user.profile.age')).toBe(30);
        expect(getJsonPath(obj, 'user.profile.nonexistent')).toBeUndefined();
        expect(getJsonPath(obj, 'missing.key.deep')).toBeUndefined();
        expect(getJsonPath(null, 'user.profile')).toBeNull();
    });

    it('should mapResponseItems with various regex patterns, templates, and fallbacks', () => {
        const mockEngine = {
            getChildren: vi.fn((node, tag) => {
                if (tag !== 'field') return [];
                return [
                    {
                        getAttribute: (attr) => {
                            if (attr === 'as') return 'id';
                            if (attr === 'from') return 'url';
                            if (attr === 'match') return '/(\\d+)\\/?$/i';
                            return null;
                        }
                    },
                    {
                        getAttribute: (attr) => {
                            if (attr === 'as') return 'name';
                            if (attr === 'from') return 'title';
                            return null;
                        }
                    },
                    {
                        getAttribute: (attr) => {
                            if (attr === 'as') return 'fallbackField';
                            return null;
                        }
                    },
                    {
                        getAttribute: (attr) => {
                            if (attr === 'as') return 'avatar';
                            if (attr === 'template') return 'https://img.com/{id}_{name}.png';
                            return null;
                        }
                    },
                    {
                        getAttribute: (attr) => {
                            if (attr === 'as') return 'brokenRegex';
                            if (attr === 'from') return 'url';
                            if (attr === 'match') return '[invalid regex(';
                            return null;
                        }
                    },
                    {
                        getAttribute: () => null
                    }
                ];
            })
        };

        expect(mapResponseItems(mockEngine, null, {})).toBeNull();
        expect(mapResponseItems(mockEngine, 'not-array', {})).toBe('not-array');
        expect(mapResponseItems(mockEngine, [{ id: 1 }], null)).toEqual([{ id: 1 }]);

        const rawItems = [
            { url: 'https://api.com/v1/pokemon/25/', title: 'pikachu', fallbackField: 'val1' },
            { url: 'no-match-url', title: 'charmander', fallbackField: null }
        ];

        const mapped = mapResponseItems(mockEngine, rawItems, {});
        expect(mapped).toHaveLength(2);
        expect(mapped[0].id).toBe('25');
        expect(mapped[0].name).toBe('pikachu');
        expect(mapped[0].fallbackField).toBe('val1');
        expect(mapped[0].avatar).toBe('https://img.com/25_pikachu.png');

        expect(mapped[1].id).toBe('no-match-url');
        expect(mapped[1].fallbackField).toBe('');
    });

    it('should evaluate getKeyMask with edge case strings and bit masking wrapping', () => {
        const mockEngine = {
            _stateKeyBits: new Map(),
            _nextStateBitIndex: 0
        };

        expect(getKeyMask(mockEngine, null)).toBe(0);
        expect(getKeyMask(mockEngine, '')).toBe(0);

        const mask1 = getKeyMask(mockEngine, 'data.user_name');
        expect(mask1).toBe(1 << 0);
        expect(mockEngine._stateKeyBits.get('user_name')).toBe(0);

        const mask2 = getKeyMask(mockEngine, 'local.count');
        expect(mask2).toBe(1 << 1);

        const mask3 = getKeyMask(mockEngine, 'user_name');
        expect(mask3).toBe(mask1);

        for (let i = 2; i < 40; i++) {
            getKeyMask(mockEngine, `key_${i}`);
        }
        expect(mockEngine._stateKeyBits.size).toBe(40);
    });
});

describe('HookEmitter Deep Coverage Suite', () => {
    it('should handle all registration, unsubscription, once, off, emit and error catching', () => {
        const emitter = new EUIXHookEmitter();

        expect(emitter.on(null, () => {})).toBeTypeOf('function');
        expect(emitter.on('test', 'not-a-function')).toBeTypeOf('function');

        const fn1 = vi.fn();
        const fn2 = vi.fn(() => { throw new Error('Hook deliberate crash'); });
        const fn3 = vi.fn();

        const unsub1 = emitter.on('mount', fn1);
        emitter.on('mount', fn2);
        emitter.on('mount', fn3);

        emitter.emit('mount', { timestamp: 12345 });

        expect(fn1).toHaveBeenCalledWith({ timestamp: 12345 });
        expect(fn2).toHaveBeenCalledWith({ timestamp: 12345 });
        expect(fn3).toHaveBeenCalledWith({ timestamp: 12345 });

        // Unsubscribe single listener via unsub fn
        unsub1();
        emitter.emit('mount', { timestamp: 67890 });
        expect(fn1).toHaveBeenCalledTimes(1);
        expect(fn3).toHaveBeenCalledTimes(2);

        // Off single listener
        emitter.off('mount', fn3);
        emitter.emit('mount', { timestamp: 99999 });
        expect(fn3).toHaveBeenCalledTimes(2);

        // Off all listeners for event
        emitter.off('mount');
        expect(emitter._listeners.has('mount')).toBe(false);

        emitter.emit('non_existent', {});
        emitter.off('non_existent');

        emitter.on('eventA', () => {});
        emitter.on('eventB', () => {});
        expect(emitter._listeners.size).toBe(2);
        emitter.clear();
        expect(emitter._listeners.size).toBe(0);
    });
});
