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
        let handlers = this._listeners.get(event);
        if (!handlers) {
            handlers = [];
            this._listeners.set(event, handlers);
        }
        handlers.push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        const handlers = this._listeners.get(event);
        if (!handlers) return;
        if (handler) {
            const idx = handlers.indexOf(handler);
            if (idx !== -1) handlers.splice(idx, 1);
            if (handlers.length === 0) this._listeners.delete(event);
        } else {
            this._listeners.delete(event);
        }
    }

    emit(event, data) {
        const handlers = this._listeners.get(event);
        if (!handlers || handlers.length === 0) return;
        const snapshot = handlers.length === 1 ? handlers : handlers.slice();
        const len = snapshot.length;
        for (let i = 0; i < len; i++) {
            try {
                snapshot[i](data);
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
