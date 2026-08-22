import { MUTATION_OPS } from "../utils/constants.js";

export function applyArrayMutation(current, operation, payload = {}) {
    const op = String(operation || "").toUpperCase();

    if (op === MUTATION_OPS.CLEAR || op === MUTATION_OPS.EMPTY || op === MUTATION_OPS.RESET) {
        return [];
    }
    if (op === MUTATION_OPS.PUSH || op === MUTATION_OPS.APPEND) {
        const item = payload && typeof payload === "object" && payload.item !== undefined ? payload.item : payload;
        current.push(item);
        return current;
    }
    if (op === MUTATION_OPS.UNSHIFT || op === MUTATION_OPS.PREPEND) {
        const item = payload && typeof payload === "object" && payload.item !== undefined ? payload.item : payload;
        current.unshift(item);
        return current;
    }
    if (op === MUTATION_OPS.POP) {
        current.pop();
        return current;
    }
    if (op === MUTATION_OPS.SHIFT) {
        current.shift();
        return current;
    }
    if (op === MUTATION_OPS.REMOVE || op === MUTATION_OPS.DELETE) {
        if (payload && payload.index !== undefined) {
            const idx = Number(payload.index);
            if (idx >= 0 && idx < current.length) current.splice(idx, 1);
        } else if (payload?.where) {
            const { field, equals } = payload.where;
            const eqStr = String(equals);
            let w = 0;
            for (let r = 0; r < current.length; r++) {
                const item = current[r];
                if (!item || String(item[field]) !== eqStr) {
                    current[w++] = item;
                }
            }
            current.length = w;
        } else {
            let w = 0;
            for (let r = 0; r < current.length; r++) {
                const item = current[r];
                if (item !== payload) {
                    current[w++] = item;
                }
            }
            current.length = w;
        }
        return current;
    }
    if (op === MUTATION_OPS.INSERT) {
        const idx = Number(payload.index || 0);
        const item = payload && typeof payload === "object" && payload.item !== undefined ? payload.item : payload;
        current.splice(idx, 0, item);
        return current;
    }
    if (op === MUTATION_OPS.UPDATE) {
        if (payload?.where) {
            const { field, equals } = payload.where;
            const eqStr = String(equals);
            const isObjVal = typeof payload.value === "object" && payload.value !== null;
            for (let i = 0; i < current.length; i++) {
                const item = current[i];
                if (item && String(item[field]) === eqStr) {
                    current[i] = isObjVal ? Object.assign({}, item, payload.value) : payload.value;
                }
            }
            return current;
        }
    }
    if (op === MUTATION_OPS.SWAP) {
        const idx1 = Number(payload.index1);
        const idx2 = Number(payload.index2);
        if (
            !Number.isNaN(idx1) &&
            !Number.isNaN(idx2) &&
            idx1 >= 0 &&
            idx2 >= 0 &&
            idx1 < current.length &&
            idx2 < current.length &&
            idx1 !== idx2
        ) {
            const temp = current[idx1];
            current[idx1] = current[idx2];
            current[idx2] = temp;
        }
        return current;
    }
    return current;
}
