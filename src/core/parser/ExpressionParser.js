/**
 * src/core/parser/ExpressionParser.js
 * Lightweight AST-based expression tokenizer, parser and evaluator for EUIX Engine.
 */

export class EUIXExpressionParser {
    static tokenize(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const char = expr[i];

            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // String literals
            if (char === '"' || char === "'") {
                const quote = char;
                let str = "";
                i++;
                while (i < expr.length && expr[i] !== quote) {
                    if (expr[i] === "\\" && i + 1 < expr.length) {
                        i++;
                        str += expr[i];
                    } else {
                        str += expr[i];
                    }
                    i++;
                }
                i++; // skip closing quote
                tokens.push({ type: "STRING", value: str });
                continue;
            }

            // Numbers
            if (/\d/.test(char) || (char === "." && /\d/.test(expr[i + 1]))) {
                let numStr = "";
                while (i < expr.length && /[\d.]/.test(expr[i])) {
                    numStr += expr[i];
                    i++;
                }
                tokens.push({ type: "NUMBER", value: parseFloat(numStr) });
                continue;
            }

            // Two-character operators
            const twoChar = expr.slice(i, i + 2);
            if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)) {
                tokens.push({ type: "OPERATOR", value: twoChar });
                i += 2;
                continue;
            }

            // Single-character operators & punctuation
            if ([">", "<", "!", "+", "-", "*", "/", "%", "(", ")", ",", "?", ":"].includes(char)) {
                if (char === "(" || char === ")" || char === "," || char === "?" || char === ":") {
                    tokens.push({ type: char, value: char });
                } else {
                    tokens.push({ type: "OPERATOR", value: char });
                }
                i++;
                continue;
            }

            // Identifiers / Keywords
            if (/[a-zA-Z_$]/.test(char)) {
                let idStr = "";
                while (i < expr.length && /[a-zA-Z0-9_$.[\]]/.test(expr[i])) {
                    idStr += expr[i];
                    i++;
                }
                if (idStr === "true" || idStr === "false") {
                    tokens.push({ type: "BOOLEAN", value: idStr === "true" });
                } else if (idStr === "null") {
                    tokens.push({ type: "NULL", value: null });
                } else {
                    tokens.push({ type: "IDENTIFIER", value: idStr });
                }
                continue;
            }

            i++;
        }
        return tokens;
    }

    static parseToJs(tokens) {
        let current = 0;
        function peek() {
            return tokens[current];
        }
        function consume() {
            return tokens[current++];
        }

        function parsePrimary() {
            const token = peek();
            if (!token) return "undefined";

            if (token.type === "STRING") {
                consume();
                return JSON.stringify(token.value);
            }
            if (token.type === "NUMBER") {
                consume();
                return String(token.value);
            }
            if (token.type === "BOOLEAN") {
                consume();
                return token.value ? "true" : "false";
            }
            if (token.type === "NULL") {
                consume();
                return "null";
            }
            if (token.type === "(") {
                consume();
                const inner = parseExpression();
                if (peek() && peek().type === ")") consume();
                return `(${inner})`;
            }
            if (token.type === "IDENTIFIER") {
                consume();
                const id = token.value;
                const lower = id.toLowerCase();
                if (peek() && peek().type === "(") {
                    consume();
                    const args = [];
                    if (peek() && peek().type !== ")") {
                        args.push(parseExpression());
                        while (peek() && peek().type === ",") {
                            consume();
                            args.push(parseExpression());
                        }
                    }
                    if (peek() && peek().type === ")") consume();
                    if (lower === "length") {
                        return `((Array.isArray(${args[0]}) || typeof (${args[0]}) === "string") ? (${args[0]}).length : 0)`;
                    }
                    if (lower === "contains" || lower === "includes") {
                        return `((Array.isArray(${args[0]})) ? (${args[0]}).includes(${args[1]}) : (typeof (${args[0]}) === "string" ? (${args[0]}).includes(String(${args[1]})) : false))`;
                    }
                    if (lower === "not") {
                        return `(!(${args[0]}) || (${args[0]}) === "false")`;
                    }
                    if (id.includes(".")) {
                        const lastDot = id.lastIndexOf(".");
                        const targetObj = id.slice(0, lastDot);
                        const method = id.slice(lastDot + 1);
                        return `(($r(${JSON.stringify(targetObj)}) && typeof $r(${JSON.stringify(targetObj)})[${JSON.stringify(method)}] === "function") ? $r(${JSON.stringify(targetObj)})[${JSON.stringify(method)}](${args.join(", ")}) : undefined)`;
                    }
                    return `(($r(${JSON.stringify(id)}) && typeof $r(${JSON.stringify(id)}) === "function") ? $r(${JSON.stringify(id)})(${args.join(", ")}) : undefined)`;
                }
                if (
                    id.includes(".") ||
                    id.startsWith("data.") ||
                    id.startsWith("parent.") ||
                    id.startsWith("local.") ||
                    id.startsWith("props.") ||
                    id.startsWith("args.") ||
                    id.startsWith("params.") ||
                    id.startsWith("result.")
                ) {
                    if (id.startsWith("data.")) {
                        const propPath = id.slice(5);
                        const jsProp = propPath
                            .split(".")
                            .map((p) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p) ? p : `[${JSON.stringify(p)}]`))
                            .join("?.");
                        return `(($data?.${jsProp}) ?? $r(${JSON.stringify(id)}))`;
                    }
                    if (id.startsWith("local.") || id.startsWith("$local.")) {
                        const propPath = id.replace(/^(\$local|local)\./, "");
                        const jsProp = propPath
                            .split(".")
                            .map((p) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p) ? p : `[${JSON.stringify(p)}]`))
                            .join("?.");
                        return `(($local?.${jsProp}) ?? $r(${JSON.stringify(id)}))`;
                    }
                    if (id.startsWith("props.") || id.startsWith("$props.")) {
                        const propPath = id.replace(/^(\$props|props)\./, "");
                        const jsProp = propPath
                            .split(".")
                            .map((p) => (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p) ? p : `[${JSON.stringify(p)}]`))
                            .join("?.");
                        return `(($ctx?.props?.${jsProp}) ?? $r(${JSON.stringify(id)}))`;
                    }
                    if (id.startsWith("args.") || id.startsWith("params.")) {
                        const propPath = id.replace(/^(args|params)\./, "");
                        return `(($ctx?.args?.${propPath}) ?? ($ctx?.params?.${propPath}) ?? $r(${JSON.stringify(id)}))`;
                    }
                    if (id.startsWith("result.")) {
                        const propPath = id.slice(7);
                        return `(($ctx?.result?.${propPath}) ?? $r(${JSON.stringify(id)}))`;
                    }
                    return `($r(${JSON.stringify(id)}))`;
                }
                return `(($r(${JSON.stringify(id)})) !== undefined ? ($r(${JSON.stringify(id)})) : ${JSON.stringify(id)})`;
            }
            if (token.type === "OPERATOR" && token.value === "!") {
                consume();
                return `(!${parseUnary()} || ${parseUnary()} === "false")`;
            }
            consume();
            return "undefined";
        }

        function parseUnary() {
            if (peek() && peek().type === "OPERATOR" && (peek().value === "!" || peek().value === "-")) {
                const op = consume().value;
                if (op === "!") return `(!(${parseUnary()}) || (${parseUnary()}) === "false")`;
                if (op === "-") return `(-Number(${parseUnary()}))`;
            }
            return parsePrimary();
        }

        function parseBinary(nextLevel, ops, codeGen) {
            let left = nextLevel();
            while (peek() && peek().type === "OPERATOR" && ops.includes(peek().value)) {
                const op = consume().value;
                const right = nextLevel();
                left = codeGen(op, left, right);
            }
            return left;
        }

        function parseMultiplicative() {
            return parseBinary(parseUnary, ["*", "/", "%"], (op, l, r) => {
                if (op === "*") return `(Number(${l}) * Number(${r}))`;
                if (op === "/") return `(Number(${r}) !== 0 ? Number(${l}) / Number(${r}) : 0)`;
                if (op === "%") return `(Number(${r}) !== 0 ? Number(${l}) % Number(${r}) : 0)`;
            });
        }

        function parseAdditive() {
            return parseBinary(parseMultiplicative, ["+", "-"], (op, l, r) => {
                if (op === "+")
                    return `((typeof (${l}) === "string" || typeof (${r}) === "string") ? String((${l}) ?? "") + String((${r}) ?? "") : Number(${l}) + Number(${r}))`;
                if (op === "-") return `(Number(${l}) - Number(${r}))`;
            });
        }

        function parseRelational() {
            return parseBinary(parseAdditive, [">", "<", ">=", "<="], (op, l, r) => {
                return `(Number(${l}) ${op} Number(${r}))`;
            });
        }

        function parseEquality() {
            return parseBinary(parseRelational, ["==", "!="], (op, l, r) => {
                if (op === "==") return `(String((${l}) ?? "").trim() === String((${r}) ?? "").trim())`;
                if (op === "!=") return `(String((${l}) ?? "").trim() !== String((${r}) ?? "").trim())`;
            });
        }

        function parseLogicalAnd() {
            return parseBinary(
                parseEquality,
                ["&&"],
                (_op, l, r) =>
                    `(((${l}) !== false && (${l}) !== "false" && (${l}) !== 0 && (${l}) !== null && (${l}) !== undefined && (${l}) !== "") ? (${r}) : (${l}))`,
            );
        }

        function parseLogicalOr() {
            return parseBinary(
                parseLogicalAnd,
                ["||"],
                (_op, l, r) =>
                    `(((${l}) !== false && (${l}) !== "false" && (${l}) !== 0 && (${l}) !== null && (${l}) !== undefined && (${l}) !== "") ? (${l}) : (${r}))`,
            );
        }

        function parseTernary() {
            const test = parseLogicalOr();
            if ((peek() && peek().type === "?") || (peek() && peek().type === "OPERATOR" && peek().value === "?")) {
                consume();
                const cons = parseExpression();
                if ((peek() && peek().type === ":") || (peek() && peek().type === "OPERATOR" && peek().value === ":")) {
                    consume();
                    const alt = parseExpression();
                    return `(((${test}) !== false && (${test}) !== "false" && (${test}) !== 0 && (${test}) !== null && (${test}) !== undefined && (${test}) !== "") ? (${cons}) : (${alt}))`;
                }
            }
            return test;
        }

        function parseExpression() {
            return parseTernary();
        }

        return parseExpression();
    }

    static _compiledFnCache = new Map();
    static _compiledTemplateFnCache = new Map();
    static _compiledFnCacheMaxSize = 2000;
    static _cacheStats = { hits: 0, misses: 0 };

    static compileExpression(exprString) {
        let fn = EUIXExpressionParser._compiledFnCache.get(exprString);
        if (fn !== undefined) {
            EUIXExpressionParser._cacheStats.hits++;
            return fn;
        }

        EUIXExpressionParser._cacheStats.misses++;
        try {
            const tokens = EUIXExpressionParser.tokenize(exprString);
            const jsCode = EUIXExpressionParser.parseToJs(tokens);
            fn = new Function(
                "$data",
                "$local",
                "$ctx",
                "$engine",
                "$r",
                `try {
                    if (typeof $data === "function" && $r === undefined) {
                        $r = $data;
                        $data = null;
                    }
                    return (${jsCode});
                } catch (_) { return undefined; }`,
            );
        } catch (_) {
            fn = null;
        }

        if (EUIXExpressionParser._compiledFnCache.size >= EUIXExpressionParser._compiledFnCacheMaxSize) {
            const firstKey = EUIXExpressionParser._compiledFnCache.keys().next().value;
            if (firstKey !== undefined) EUIXExpressionParser._compiledFnCache.delete(firstKey);
        }
        EUIXExpressionParser._compiledFnCache.set(exprString, fn);
        return fn;
    }

    static compileTemplateFunction(templateString) {
        if (!templateString || typeof templateString !== "string" || !templateString.includes("{")) {
            return null;
        }

        let cached = EUIXExpressionParser._compiledTemplateFnCache.get(templateString);
        if (cached !== undefined) {
            EUIXExpressionParser._cacheStats.hits++;
            return cached;
        }

        EUIXExpressionParser._cacheStats.misses++;
        try {
            const parts = [];
            let lastIdx = 0;
            let i = 0;
            const len = templateString.length;

            while (i < len) {
                if (templateString.charCodeAt(i) === 123) {
                    // '{'
                    const nextChar = templateString.charAt(i + 1).trim();
                    if (nextChar === '"' || nextChar === "'") {
                        const nextColon = templateString.indexOf(":", i + 1);
                        const nextClose = templateString.indexOf("}", i + 1);
                        if (nextColon !== -1 && (nextClose === -1 || nextColon < nextClose)) {
                            i++;
                            continue;
                        }
                    }

                    let closeIdx = -1;
                    let inQuote = null;
                    for (let j = i + 1; j < len; j++) {
                        const ch = templateString.charAt(j);
                        if (inQuote) {
                            if (ch === inQuote && templateString.charAt(j - 1) !== "\\") {
                                inQuote = null;
                            }
                        } else if (ch === '"' || ch === "'") {
                            inQuote = ch;
                        } else if (ch === "{") {
                            break;
                        } else if (ch === "}") {
                            closeIdx = j;
                            break;
                        }
                    }

                    if (closeIdx === -1) {
                        i++;
                        continue;
                    }

                    const expr = templateString.slice(i + 1, closeIdx).trim();
                    if (expr && !expr.startsWith('"') && !expr.includes('":') && !expr.includes("':")) {
                        if (i > lastIdx) {
                            parts.push(JSON.stringify(templateString.slice(lastIdx, i)));
                        }
                        const tokens = EUIXExpressionParser.tokenize(expr);
                        const jsExpr = EUIXExpressionParser.parseToJs(tokens);
                        parts.push(`((${jsExpr}) ?? "")`);
                        i = closeIdx;
                        lastIdx = closeIdx + 1;
                    }
                }
                i++;
            }

            if (parts.length === 0) {
                cached = null;
            } else {
                if (lastIdx < len) {
                    parts.push(JSON.stringify(templateString.slice(lastIdx)));
                }
                const code = parts.length === 1 ? parts[0] : parts.join(" + ");
                cached = new Function(
                    "$data",
                    "$local",
                    "$ctx",
                    "$engine",
                    "$r",
                    `try { return String(${code}); } catch (_) { return ""; }`,
                );
            }
        } catch (_) {
            cached = null;
        }

        if (EUIXExpressionParser._compiledTemplateFnCache.size >= EUIXExpressionParser._compiledFnCacheMaxSize) {
            const firstKey = EUIXExpressionParser._compiledTemplateFnCache.keys().next().value;
            if (firstKey !== undefined) EUIXExpressionParser._compiledTemplateFnCache.delete(firstKey);
        }
        EUIXExpressionParser._compiledTemplateFnCache.set(templateString, cached);
        return cached;
    }

    static eval(exprString, resolveValueFn, context = {}, engine = null) {
        if (!exprString?.trim()) return undefined;
        try {
            const compiled = EUIXExpressionParser.compileExpression(exprString);
            if (compiled) {
                const dataScope = engine ? engine._state : (context && context.$data ? context.$data : (context && context.data ? context.data : null));
                const localScope = context ? (context._localState || context.local) : null;
                const resolver = typeof resolveValueFn === "function" ? resolveValueFn : (p) => (engine ? engine.resolveValueFromPath(p, context) : undefined);
                return compiled(dataScope, localScope, context, engine, resolver);
            }
        } catch (_) {}
        return undefined;
    }

    static clearExpressionCache() {
        EUIXExpressionParser._compiledFnCache.clear();
        EUIXExpressionParser._compiledTemplateFnCache.clear();
        EUIXExpressionParser._cacheStats = { hits: 0, misses: 0 };
    }

    static getExpressionCacheStats() {
        const total = EUIXExpressionParser._cacheStats.hits + EUIXExpressionParser._cacheStats.misses;
        return {
            size: EUIXExpressionParser._compiledFnCache.size,
            templateSize: EUIXExpressionParser._compiledTemplateFnCache.size,
            maxSize: EUIXExpressionParser._compiledFnCacheMaxSize,
            hits: EUIXExpressionParser._cacheStats.hits,
            misses: EUIXExpressionParser._cacheStats.misses,
            hitRatio: total > 0 ? Number((EUIXExpressionParser._cacheStats.hits / total).toFixed(4)) : 0,
        };
    }
}
