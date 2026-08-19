/**
 * src/plugins/router/navigation/blocker.js
 * SPA navigation blocking and window beforeunload handling.
 */

export class NavigationBlockerManager extends EventTarget {
    constructor({ engine } = {}) {
        super();
        this.engine = engine;
        this._blockers = new Set();
        this.state = "idle"; // 'idle' | 'blocked' | 'proceeding'
        this._pendingNavigation = null;

        this._handleBeforeUnload = this._handleBeforeUnload.bind(this);
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this._handleBeforeUnload);
        }
    }

    _handleBeforeUnload(event) {
        let shouldBlock = false;
        let blockMessage = "Are you sure you want to leave?";

        for (const blocker of this._blockers) {
            const res = typeof blocker === "function" ? blocker() : blocker;
            if (res) {
                shouldBlock = true;
                if (typeof res === "string") blockMessage = res;
                break;
            }
        }

        if (shouldBlock) {
            event.preventDefault();
            event.returnValue = blockMessage;
            return blockMessage;
        }
    }

    addBlocker(fnOrCondition) {
        this._blockers.add(fnOrCondition);
        return () => this._blockers.delete(fnOrCondition);
    }

    async shouldBlock(navigationDetails) {
        if (this.state === "proceeding") {
            this.state = "idle";
            return false;
        }

        let isBlocked = false;
        let message = "Discard unsaved changes?";

        for (const blocker of this._blockers) {
            let res;
            if (typeof blocker === "function") {
                res = blocker(navigationDetails);
            } else if (typeof blocker === "string" && this.engine) {
                res = this.engine.isTruthy(this.engine.getState(blocker));
            } else {
                res = !!blocker;
            }

            if (res) {
                isBlocked = true;
                if (typeof res === "string") message = res;
                break;
            }
        }

        if (isBlocked) {
            this.state = "blocked";
            this.dispatchEvent(new CustomEvent("blocked", {
                detail: {
                    ...navigationDetails,
                    message,
                    proceed: () => this.proceed(navigationDetails),
                    cancel: () => this.cancel()
                }
            }));

            if (typeof window !== "undefined" && typeof window.confirm === "function") {
                const confirmed = window.confirm(message);
                if (confirmed) {
                    this.state = "proceeding";
                    return false;
                } else {
                    this.state = "idle";
                    return true;
                }
            }

            return true;
        }

        return false;
    }

    proceed(navigationDetails) {
        this.state = "proceeding";
        this._pendingNavigation = null;
    }

    cancel() {
        this.state = "idle";
        this._pendingNavigation = null;
        this.dispatchEvent(new CustomEvent("cancelled"));
    }

    destroy() {
        if (typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this._handleBeforeUnload);
        }
        this._blockers.clear();
    }
}
