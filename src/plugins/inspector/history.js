/**
 * src/plugins/inspector/history.js
 * Time-Travel Debugging, State Snapshots, Undo/Redo & Diff Engine for EUIX Inspector / DevTools.
 */

function safeClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (_) {
        const copy = Array.isArray(obj) ? [] : {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val !== null && typeof val === "object" && (val.nodeType || val.window === val)) {
                continue; // skip DOM / window references
            }
            copy[key] = typeof val === "object" && val !== null ? safeClone(val) : val;
        }
        return copy;
    }
}

export function computeStateDiff(oldState = {}, newState = {}) {
    const added = {};
    const removed = {};
    const changed = {};

    const allKeys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);

    for (const key of allKeys) {
        const oldVal = oldState ? oldState[key] : undefined;
        const newVal = newState ? newState[key] : undefined;

        if (oldVal === undefined && newVal !== undefined) {
            added[key] = newVal;
        } else if (oldVal !== undefined && newVal === undefined) {
            removed[key] = oldVal;
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changed[key] = { from: oldVal, to: newVal };
        }
    }

    return {
        hasChanges: Object.keys(added).length > 0 || Object.keys(removed).length > 0 || Object.keys(changed).length > 0,
        added,
        removed,
        changed,
    };
}

export class EUIXStateHistoryManager {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.maxSnapshots = options.maxSnapshots || 50;
        this.snapshots = [];
        this.currentIndex = -1;
        this._isTimeTraveling = false;
        this._listeners = new Set();

        if (this.engine) {
            this.init();
        }
    }

    init() {
        const initialState = this.getCurrentEngineState();
        this.takeSnapshot("Initial Mount", { isInitial: true, state: initialState });
        this.bindStateInterceptor();
    }

    getCurrentEngineState() {
        if (!this.engine) return {};
        const raw = this.engine._rawState || this.engine.state || {};
        return safeClone(raw);
    }

    bindStateInterceptor() {
        if (!this.engine) return;

        const originalSetState = this.engine.setState.bind(this.engine);
        const self = this;

        this.engine.setState = function (key, value, options = {}) {
            const prevVal = this.getState(key);
            const res = originalSetState(key, value, options);

            if (!self._isTimeTraveling && !options._skipHistory) {
                const label = options.label || `setState("${key}")`;
                self.recordChange(key, prevVal, value, label);
            }
            return res;
        };

        if (this.engine.mutateState) {
            const originalMutateState = this.engine.mutateState.bind(this.engine);
            this.engine.mutateState = (path, operation, value, options = {}) => {
                const res = originalMutateState(path, operation, value, options);
                if (!self._isTimeTraveling && !options?._skipHistory) {
                    const label = `mutateState("${path}", "${operation}")`;
                    self.recordChange(path, null, value, label);
                }
                return res;
            };
        }
    }

    recordChange(triggerKey, prevVal, nextVal, label) {
        if (this._isTimeTraveling) return;

        const currentState = this.getCurrentEngineState();
        const prevSnapshot = this.snapshots[this.currentIndex];
        const diff = computeStateDiff(prevSnapshot ? prevSnapshot.state : {}, currentState);

        if (!diff.hasChanges && prevSnapshot) return;

        // If we are branching from a previous history index, trim future snapshots
        if (this.currentIndex < this.snapshots.length - 1) {
            this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
        }

        const snapshot = {
            id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            index: this.snapshots.length,
            timestamp: new Date().toLocaleTimeString(),
            label: label || `Update ${triggerKey}`,
            triggerKey,
            state: currentState,
            diff,
        };

        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
            // Re-index
            this.snapshots.forEach((s, idx) => (s.index = idx));
        }

        this.currentIndex = this.snapshots.length - 1;
        this.notifyListeners();
    }

    takeSnapshot(label = "Manual Snapshot", metadata = {}) {
        const state = metadata.state || this.getCurrentEngineState();
        const prevSnapshot = this.snapshots[this.currentIndex];
        const diff = computeStateDiff(prevSnapshot ? prevSnapshot.state : {}, state);

        if (this.currentIndex < this.snapshots.length - 1) {
            this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
        }

        const snapshot = {
            id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            index: this.snapshots.length,
            timestamp: new Date().toLocaleTimeString(),
            label,
            state,
            diff,
            ...metadata,
        };

        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
            this.snapshots.forEach((s, idx) => (s.index = idx));
        }

        this.currentIndex = this.snapshots.length - 1;
        this.notifyListeners();
        return snapshot;
    }

    timeTravelTo(index) {
        if (!this.engine || index < 0 || index >= this.snapshots.length) return false;

        const targetSnapshot = this.snapshots[index];
        if (!targetSnapshot) return false;

        this._isTimeTraveling = true;
        this.currentIndex = index;

        try {
            const targetState = safeClone(targetSnapshot.state);
            const currentRawState = this.engine._rawState || {};

            // Collect all affected keys for reconciliation
            const allKeys = new Set([...Object.keys(currentRawState), ...Object.keys(targetState)]);

            // Replace raw state content
            for (const key of Object.keys(currentRawState)) {
                if (!(key in targetState)) {
                    delete currentRawState[key];
                }
            }
            for (const [key, val] of Object.entries(targetState)) {
                currentRawState[key] = val;
            }

            // Sync UI DOM bindings
            for (const key of allKeys) {
                const val = targetState[key];
                this.engine.syncBindings(key, val);
                this.engine.syncBindings(`data.${key}`, val);
            }

            if (this.engine.flushStateUpdates) {
                this.engine.flushStateUpdates();
            }
        } finally {
            this._isTimeTraveling = false;
        }

        this.notifyListeners();
        return true;
    }

    undo() {
        if (!this.canUndo()) return false;
        return this.timeTravelTo(this.currentIndex - 1);
    }

    redo() {
        if (!this.canRedo()) return false;
        return this.timeTravelTo(this.currentIndex + 1);
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.snapshots.length - 1;
    }

    clearHistory() {
        const currentState = this.getCurrentEngineState();
        this.snapshots = [];
        this.currentIndex = -1;
        this.takeSnapshot("History Cleared", { state: currentState });
        this.notifyListeners();
    }

    exportHistory() {
        return JSON.stringify(
            {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                currentIndex: this.currentIndex,
                snapshots: this.snapshots,
            },
            null,
            2,
        );
    }

    importHistory(jsonString) {
        try {
            const data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
            if (Array.isArray(data.snapshots) && data.snapshots.length > 0) {
                this.snapshots = data.snapshots;
                const idx = typeof data.currentIndex === "number" ? data.currentIndex : this.snapshots.length - 1;
                this.timeTravelTo(Math.min(idx, this.snapshots.length - 1));
                return true;
            }
        } catch (err) {
            if (this.engine) this.engine.reportError(err, "Failed to import state history");
        }
        return false;
    }

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notifyListeners() {
        for (const listener of this._listeners) {
            try {
                listener({
                    currentIndex: this.currentIndex,
                    snapshots: this.snapshots,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    activeSnapshot: this.snapshots[this.currentIndex] || null,
                });
            } catch (_) {}
        }
    }
}
