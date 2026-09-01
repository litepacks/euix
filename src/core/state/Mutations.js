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
            const { field, equals, op } = payload.where;
            const isNeq = op === "neq" || op === "!=" || op === "ne";
            let w = 0;
            for (let r = 0; r < current.length; r++) {
                const item = current[r];
                if (!item) continue;
                const actual = item[field];
                const isMatch =
                    actual === equals ||
                    (actual !== undefined &&
                        actual !== null &&
                        equals !== undefined &&
                        equals !== null &&
                        String(actual) === String(equals));
                if (isNeq ? isMatch : !isMatch) {
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
            const { field, equals, op } = payload.where;
            const isNeq = op === "neq" || op === "!=" || op === "ne";
            const isObjVal = typeof payload.value === "object" && payload.value !== null;
            for (let i = 0; i < current.length; i++) {
                const item = current[i];
                if (!item) continue;
                const actual = item[field];
                const isMatch =
                    actual === equals ||
                    (actual !== undefined &&
                        actual !== null &&
                        equals !== undefined &&
                        equals !== null &&
                        String(actual) === String(equals));
                if (isNeq ? !isMatch : isMatch) {
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
    if (op === MUTATION_OPS.REVERSE) {
        current.reverse();
        return current;
    }
    if (op === MUTATION_OPS.MOVE_UP) {
        let idx = -1;
        if (payload && payload.index !== undefined) {
            idx = Number(payload.index);
        } else if (payload?.where) {
            const { field, equals } = payload.where;
            idx = current.findIndex(
                (item) => item && (item[field] === equals || String(item[field]) === String(equals)),
            );
        }
        if (idx > 0 && idx < current.length) {
            const temp = current[idx];
            current[idx] = current[idx - 1];
            current[idx - 1] = temp;
        }
        return current;
    }
    if (op === MUTATION_OPS.MOVE_DOWN) {
        let idx = -1;
        if (payload && payload.index !== undefined) {
            idx = Number(payload.index);
        } else if (payload?.where) {
            const { field, equals } = payload.where;
            idx = current.findIndex(
                (item) => item && (item[field] === equals || String(item[field]) === String(equals)),
            );
        }
        if (idx >= 0 && idx < current.length - 1) {
            const temp = current[idx];
            current[idx] = current[idx + 1];
            current[idx + 1] = temp;
        }
        return current;
    }
    if (op === MUTATION_OPS.SORT) {
        const field = payload?.by || payload?.field || payload?.key;
        const order = String(payload?.order || payload?.direction || "asc").toLowerCase();
        const isDesc = order === "desc" || order === "descending" || order === "reverse";
        if (typeof payload?.compare === "function") {
            current.sort(payload.compare);
        } else if (field) {
            current.sort((a, b) => {
                const valA = a != null && typeof a === "object" ? a[field] : a;
                const valB = b != null && typeof b === "object" ? b[field] : b;
                if (valA === valB) return 0;
                if (valA == null) return isDesc ? -1 : 1;
                if (valB == null) return isDesc ? 1 : -1;
                if (typeof valA === "number" && typeof valB === "number") {
                    return isDesc ? valB - valA : valA - valB;
                }
                const strA = String(valA);
                const strB = String(valB);
                return isDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
            });
        } else {
            current.sort((a, b) => {
                if (a === b) return 0;
                if (a == null) return isDesc ? -1 : 1;
                if (b == null) return isDesc ? 1 : -1;
                if (typeof a === "number" && typeof b === "number") {
                    return isDesc ? b - a : a - b;
                }
                return isDesc ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
            });
        }
        return current;
    }
    return current;
}

