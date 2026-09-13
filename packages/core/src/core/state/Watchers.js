/**
 * src/core/state/Watchers.js
 * State watcher subscription and recursive cycle guard dispatcher for EUIX Engine.
 */

import { EUIXStructuredError } from "../parser/errors.js";
import { isCycleError, isFn, noop } from "../utils/constants.js";

export function watch(engine, key, callback) {
    if (!key || !isFn(callback)) return noop;
    const parsedKey = engine.parseBindPath(key);
    if (!engine._stateWatchers.has(parsedKey)) engine._stateWatchers.set(parsedKey, []);
    engine._stateWatchers.get(parsedKey).push(callback);
    return () => {
        const list = engine._stateWatchers.get(parsedKey) || [];
        const nextList = list.filter((cb) => cb !== callback);
        if (nextList.length === 0) {
            engine._stateWatchers.delete(parsedKey);
        } else {
            engine._stateWatchers.set(parsedKey, nextList);
        }
    };
}

export function onStateChange(engine, callback) {
    if (!isFn(callback)) return noop;
    engine._globalStateWatchers.push(callback);
    return () => {
        engine._globalStateWatchers = engine._globalStateWatchers.filter((cb) => cb !== callback);
    };
}

export function triggerStateWatchers(engine, key, newValue, oldValue) {
    if (!engine._reactiveDepth) engine._reactiveDepth = 0;
    engine._reactiveDepth++;

    if (engine._reactiveDepth > 25) {
        engine._reactiveDepth = 0;
        const err = new EUIXStructuredError({
            message: `Maximum watcher reaction depth (25) exceeded for path "${key}". Possible circular watcher cascade loop.`,
            code: "WATCHER_CYCLE_ERROR",
        });
        engine.reportError(err, "Watcher Cycle Guard");
        throw err;
    }

    try {
        if (engine._globalStateWatchers?.length) {
            engine._globalStateWatchers.forEach((cb) => {
                try {
                    cb(key, newValue, oldValue);
                } catch (err) {
                    if (isCycleError(err)) throw err;
                    engine.reportError(err, `onStateChange watcher error on "${key}"`);
                }
            });
        }
        if (engine._stateWatchers) {
            const watchContext = {
                path: key,
                $path: key,
                newValue,
                $newValue: newValue,
                oldValue,
                $oldValue: oldValue,
                prevValue: oldValue,
                $prevValue: oldValue,
            };
            for (const [wKey, list] of engine._stateWatchers.entries()) {
                if (
                    wKey === key ||
                    wKey.startsWith(`${key}.`) ||
                    key.startsWith(`${wKey}.`) ||
                    key.startsWith(`${wKey}[`)
                ) {
                    list.forEach((cb) => {
                        try {
                            cb(newValue, oldValue, key, watchContext);
                        } catch (err) {
                            if (isCycleError(err)) throw err;
                            engine.reportError(err, `Watcher error on "${key}"`);
                        }
                    });
                }
            }
        }
    } finally {
        engine._reactiveDepth = Math.max(0, (engine._reactiveDepth || 1) - 1);
    }
}
