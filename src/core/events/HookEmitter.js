/**
 * src/core/events/HookEmitter.js
 * Event and lifecycle hook emitter for EUIX Engine.
 */

export class EUIXHookEmitter {
    constructor() {
        this._listeners = new Map();
    }

    on(event, handler) {
        if (!event || typeof handler !== "function") return () => {};
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!this._listeners.has(event)) return;
        if (handler) {
            this._listeners.get(event).delete(handler);
        } else {
            this._listeners.delete(event);
        }
    }

    emit(event, data) {
        if (!this._listeners.has(event)) return;
        const handlers = this._listeners.get(event);
        for (const fn of handlers) {
            try {
                fn(data);
            } catch (err) {
                if (typeof console !== "undefined" && console.error) {
                    console.error(`[EUIXEngine Hook Error] Error in '${event}' hook handler:`, err);
                }
            }
        }
    }

    clear() {
        this._listeners.clear();
    }
}
