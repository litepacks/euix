/**
 * Deterministic Seedable Async Chaos Engine for EUIX Engine
 * Reproducible seed-based PRNG for async latency, network failures, and timing boundaries.
 */

export class Mulberry32PRNG {
  constructor(seed = 123456789) {
    this.seed = seed;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  boolean(chance = 0.5) {
    return this.next() < chance;
  }
}

export function createChaosFetchAdapter(seed = Date.now()) {
  const prng = new Mulberry32PRNG(seed);
  const trace = [];

  function fetch(url, options = {}) {
    const delay = prng.range(5, 100);
    const shouldFail = prng.boolean(0.3);
    const signal = options.signal;

    trace.push({ timestamp: Date.now(), url, delay, shouldFail });

    return new Promise((resolve, reject) => {
      let timerId = setTimeout(() => {
        if (signal && signal.aborted) {
          return reject(new Error('Fetch Aborted'));
        }
        if (shouldFail) {
          reject({ status: 500, message: 'Chaos Network Error', url });
        } else {
          resolve({
            ok: true,
            status: 200,
            json: async () => [{ id: 1, title: 'Chaos Post' }],
            text: async () => 'OK'
          });
        }
      }, delay);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timerId);
          reject(new Error('Fetch Aborted by Signal'));
        });
      }
    });
  }

  return {
    fetch,
    seed,
    getTrace: () => trace
  };
}
