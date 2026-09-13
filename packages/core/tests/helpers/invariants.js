import { expect } from 'vitest';

/**
 * EUIX Battle Testing Invariant Assertion Library
 * Shared invariants for unit, property, chaos, fuzz, torture, and browser tests.
 */

export function assertNoActiveTimers(engine) {
  const stats = engine._getTestStats ? engine._getTestStats() : {};
  expect(stats.activeIntervals || 0).toBe(0);
}

export function assertNoWatcherLeaks(engine) {
  const stats = engine._getTestStats ? engine._getTestStats() : {};
  expect(stats.activeWatchers || 0).toBe(0);
}

export function assertNoSubscriptionLeaks(engine) {
  const stats = engine._getTestStats ? engine._getTestStats() : {};
  expect(stats.activeSubscriptions || 0).toBe(0);
}

export function assertNoLateStateMutation(engine, snapshotBefore) {
  const currentState = engine.state ? JSON.stringify(engine.state) : "{}";
  expect(currentState).toBe(snapshotBefore);
}

export function assertNoDetachedComponents(engine) {
  const stats = engine._getTestStats ? engine._getTestStats() : {};
  expect(stats.mountedComponents || 0).toBe(0);
}

export function assertStateConsistent(engine, expectedKeys = []) {
  expect(engine.state).toBeDefined();
  for (const key of expectedKeys) {
    expect(engine.getState(key)).toBeDefined();
  }
}

export function assertFinallyExecutedOnce(tracker) {
  expect(tracker.finallyCount).toBe(1);
}

export function assertExecutionCompleted(tracker) {
  expect(tracker.completed).toBe(true);
}

export function assertNoReactiveCycle(evaluatedPaths = []) {
  const set = new Set();
  for (const path of evaluatedPaths) {
    if (set.has(path)) {
      throw new Error(`Reactive cycle detected on path: ${path}`);
    }
    set.add(path);
  }
}

export function assertResourcesDisposed(resources = []) {
  for (const res of resources) {
    expect(res.disposed).toBe(true);
  }
}
