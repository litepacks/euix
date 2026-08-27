import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('BigInt Dynamic Bitmask Tracking (>32 State Variables)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should correctly allocate distinct bitmasks and avoid collision for 100+ state variables', () => {
        const stateCount = 100;
        const states = Array.from({ length: stateCount }, (_, i) => `<state id="var_${i}" type="number">${i}</state>`).join('\n');
        const elements = Array.from({ length: stateCount }, (_, i) => `<span id="el_${i}">{data.var_${i}}</span>`).join('\n');

        const xml = `
            <uid_spec>
                <data_model>
                    ${states}
                </data_model>
                <flex direction="column">
                    ${elements}
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        // Check that initial render works
        expect(container.querySelector('#el_0').textContent).toBe('0');
        expect(container.querySelector('#el_32').textContent).toBe('32');
        expect(container.querySelector('#el_64').textContent).toBe('64');
        expect(container.querySelector('#el_99').textContent).toBe('99');

        // Check key masks
        const mask0 = engine.getKeyMask('var_0');
        const mask32 = engine.getKeyMask('var_32');
        const mask64 = engine.getKeyMask('var_64');

        expect(typeof mask0).toBe('number');
        expect(typeof mask32).toBe('bigint');
        expect(typeof mask64).toBe('bigint');

        expect(mask0 > 0).toBe(true);
        expect(mask32 > 0n).toBe(true);
        expect(mask64 > 0n).toBe(true);

        // In 32-bit integer, mask32 & mask0 would collide after 32 keys. With BigInt, they must NOT collide!
        expect(BigInt(mask32) !== BigInt(mask0)).toBe(true);
        expect(mask64 !== mask32).toBe(true);
        expect((BigInt(mask32) & BigInt(mask0))).toBe(0n);
        expect((mask64 & mask32)).toBe(0n);
        expect((mask64 & BigInt(mask0))).toBe(0n);

        // Verify all 100 keys have unique non-colliding bitmasks
        const allMasks = new Set();
        for (let i = 0; i < stateCount; i++) {
            const m = engine.getKeyMask(`var_${i}`);
            expect(allMasks.has(m)).toBe(false);
            allMasks.add(m);
        }
        expect(allMasks.size).toBe(stateCount);

        // Update single high-index state
        engine.setState('var_64', 999);
        expect(container.querySelector('#el_64').textContent).toBe('999');
        // Neighboring states remain unaffected
        expect(container.querySelector('#el_0').textContent).toBe('0');
        expect(container.querySelector('#el_32').textContent).toBe('32');
    });
});
