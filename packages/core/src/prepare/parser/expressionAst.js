/**
 * packages/core/src/prepare/parser/expressionAst.js
 * Deterministic expression tokenizer and AST parser for EUIX.
 * Parses template text and attribute strings into explicit TextNode and ExpressionNode ASTs.
 * Pre-emptively catches unclosed braces, stray braces, and malformed expressions.
 */

import { createDiagnostic, DIAGNOSTIC_CODES } from "../validator/diagnostics.js";

/**
 * Calculates line and column for a given character index in a source string.
 *
 * @param {string} source
 * @param {number} index
 * @param {number} [baseLine=1]
 * @param {number} [baseCol=1]
 * @returns {{ line: number, column: number }}
 */
export function getSourcePosition(source, index, baseLine = 1, baseCol = 1) {
    let line = baseLine;
    let column = baseCol;
    const len = Math.min(index, source.length);

    for (let i = 0; i < len; i++) {
        if (source.charCodeAt(i) === 10) { // '\n'
            line++;
            column = 1;
        } else {
            column++;
        }
    }
    return { line, column };
}

/**
 * Parses a simple expression into a structured AST (Path, Literal, Binary, Unary, or Raw).
 *
 * @param {string} expr
 * @returns {object}
 */
export function parseExpressionToAst(expr) {
    const trimmed = expr.trim();

    // Check for string literal
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return {
            type: "Literal",
            value: trimmed.slice(1, -1),
            raw: trimmed,
        };
    }

    // Check for number literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return {
            type: "Literal",
            value: Number(trimmed),
            raw: trimmed,
        };
    }

    // Check for boolean literal
    if (trimmed === "true" || trimmed === "false") {
        return {
            type: "Literal",
            value: trimmed === "true",
            raw: trimmed,
        };
    }

    // Check for null/undefined
    if (trimmed === "null") return { type: "Literal", value: null, raw: trimmed };
    if (trimmed === "undefined") return { type: "Literal", value: undefined, raw: trimmed };

    // Simple path expressions: data.user.name, user.name, count, props.id, local.item
    const pathMatch = trimmed.match(/^([a-zA-Z_$][\w$]*)(?:\.([a-zA-Z0-9_$.]+))?$/);
    if (pathMatch) {
        const root = pathMatch[1];
        const rest = pathMatch[2];
        const segments = rest ? rest.split(".") : [];

        let scope = "local";
        if (root === "data" || root === "$data") {
            scope = "data";
        } else if (root === "props" || root === "$props") {
            scope = "props";
        } else if (root === "local" || root === "$local") {
            scope = "local";
        } else if (root === "api" || root === "$api") {
            scope = "api";
        } else {
            // Root identifier is part of segments if not a known scope prefix
            scope = "auto";
            segments.unshift(root);
        }

        return {
            type: "Path",
            scope,
            segments,
            raw: trimmed,
        };
    }

    // Unary not: !foo or not(foo)
    if (trimmed.startsWith("!") && trimmed.length > 1) {
        return {
            type: "UnaryExpression",
            operator: "!",
            argument: parseExpressionToAst(trimmed.slice(1)),
            raw: trimmed,
        };
    }

    // Binary expressions: e.g. count + 1, a == b, etc.
    const binaryMatch = trimmed.match(/^(.+?)\s*(===|==|!==|!=|<=|>=|<|>|\+|\-|\*|\/|%|&&|\|\|)\s*(.+)$/);
    if (binaryMatch) {
        return {
            type: "BinaryExpression",
            operator: binaryMatch[2],
            left: parseExpressionToAst(binaryMatch[1]),
            right: parseExpressionToAst(binaryMatch[3]),
            raw: trimmed,
        };
    }

    // Fallback: Complex expression
    return {
        type: "Expression",
        raw: trimmed,
    };
}

/**
 * Parses template text containing optional `{...}` interpolations into an array of
 * explicit TextNode and ExpressionNode AST nodes, with strict syntax validation.
 *
 * @param {string} text - The input template string
 * @param {object} [options={}]
 * @param {string} [options.file="source.euix"]
 * @param {string} [options.path=""]
 * @param {number} [options.baseLine=1]
 * @param {number} [options.baseColumn=1]
 * @returns {{ ast: Array<object>, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }}
 */
export function parseTemplateAst(text, options = {}) {
    const ast = [];
    const diagnostics = [];

    if (!text || typeof text !== "string") {
        return { ast, diagnostics };
    }

    const file = options.file || "source.euix";
    const path = options.path || "";
    const baseLine = options.baseLine || 1;
    const baseColumn = options.baseColumn || 1;

    const len = text.length;
    let lastIdx = 0;
    let i = 0;

    while (i < len) {
        const ch = text.charCodeAt(i);

        // Check for opening brace '{'
        if (ch === 123) {
            // Check for double opening brace: '{{'
            if (i + 1 < len && text.charCodeAt(i + 1) === 123) {
                const pos = getSourcePosition(text, i, baseLine, baseColumn);
                // Look for closing braces
                const closeIdx = text.indexOf("}}", i + 2);
                const rawSnippet = closeIdx !== -1 ? text.slice(i, closeIdx + 2) : text.slice(i, Math.min(len, i + 20));
                const inner = closeIdx !== -1 ? text.slice(i + 2, closeIdx).trim() : text.slice(i + 2).trim();

                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.MALFORMED_EXPRESSION || "MALFORMED_EXPRESSION",
                        type: "malformed-expression",
                        file,
                        path,
                        line: pos.line,
                        column: pos.column,
                        expression: rawSnippet,
                        name: rawSnippet,
                        message: `Malformed expression "${rawSnippet}". Double open brace "{{" detected. EUIX uses single "{...}" expressions.`,
                        suggestion: `{${inner}}`,
                        severity: "error",
                    }),
                );

                if (closeIdx !== -1) {
                    i = closeIdx + 2;
                    lastIdx = i;
                    continue;
                } else {
                    i += 2;
                    continue;
                }
            }

            // Find matching closing '}' while respecting quotes
            let closeIdx = -1;
            let inQuote = null;
            let depth = 1;

            for (let j = i + 1; j < len; j++) {
                const c = text.charAt(j);
                if (inQuote) {
                    if (c === inQuote && text.charAt(j - 1) !== "\\") {
                        inQuote = null;
                    }
                } else if (c === '"' || c === "'" || c === "`") {
                    inQuote = c;
                } else if (c === "{") {
                    depth++;
                } else if (c === "}") {
                    depth--;
                    if (depth === 0) {
                        closeIdx = j;
                        break;
                    }
                }
            }

            // Case 1: Unclosed brace!
            if (closeIdx === -1) {
                const pos = getSourcePosition(text, i, baseLine, baseColumn);
                const unclosedSnippet = text.slice(i);

                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNCLOSED_EXPRESSION || "UNCLOSED_EXPRESSION",
                        type: "unclosed-expression",
                        file,
                        path,
                        line: pos.line,
                        column: pos.column,
                        expression: unclosedSnippet,
                        name: unclosedSnippet,
                        message: `Unclosed expression "${unclosedSnippet}". Missing closing "}".`,
                        suggestion: `${unclosedSnippet}}`,
                        severity: "error",
                    }),
                );

                // Add preceding text if any
                if (i > lastIdx) {
                    const textPos = getSourcePosition(text, lastIdx, baseLine, baseColumn);
                    ast.push({
                        type: "text",
                        value: text.slice(lastIdx, i),
                        start: lastIdx,
                        end: i,
                        loc: { line: textPos.line, column: textPos.column },
                    });
                }
                break;
            }

            // Add preceding text node if any
            if (i > lastIdx) {
                const textPos = getSourcePosition(text, lastIdx, baseLine, baseColumn);
                ast.push({
                    type: "text",
                    value: text.slice(lastIdx, i),
                    start: lastIdx,
                    end: i,
                    loc: { line: textPos.line, column: textPos.column },
                });
            }

            const rawExpr = text.slice(i, closeIdx + 1);
            const innerExpr = text.slice(i + 1, closeIdx).trim();
            const exprPos = getSourcePosition(text, i, baseLine, baseColumn);

            // Validate inner expression syntax
            if (!innerExpr) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.MALFORMED_EXPRESSION || "MALFORMED_EXPRESSION",
                        type: "empty-expression",
                        file,
                        path,
                        line: exprPos.line,
                        column: exprPos.column,
                        expression: rawExpr,
                        name: rawExpr,
                        message: `Empty expression "${rawExpr}". An expression cannot be empty.`,
                        severity: "error",
                    }),
                );
            } else {
                // Check JS syntax validity
                try {
                    new Function("$data", "data", "$ctx", "context", `return (${innerExpr});`);
                } catch (err) {
                    diagnostics.push(
                        createDiagnostic({
                            code: DIAGNOSTIC_CODES.MALFORMED_EXPRESSION || "MALFORMED_EXPRESSION",
                            type: "expression-syntax-error",
                            file,
                            path,
                            line: exprPos.line,
                            column: exprPos.column,
                            expression: rawExpr,
                            name: rawExpr,
                            message: `Syntax error in expression "${rawExpr}": ${err.message}`,
                            severity: "error",
                        }),
                    );
                }
            }

            const exprAst = parseExpressionToAst(innerExpr);
            ast.push({
                type: "expression",
                raw: rawExpr,
                body: innerExpr,
                ast: exprAst,
                start: i,
                end: closeIdx + 1,
                loc: { line: exprPos.line, column: exprPos.column },
            });

            i = closeIdx + 1;
            lastIdx = i;
            continue;
        }

        // Check for stray closing brace '}' without opening '{'
        if (ch === 125) {
            const pos = getSourcePosition(text, i, baseLine, baseColumn);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNEXPECTED_CLOSING_BRACE || "UNEXPECTED_CLOSING_BRACE",
                    type: "unexpected-closing-brace",
                    file,
                    path,
                    line: pos.line,
                    column: pos.column,
                    expression: "}",
                    name: "}",
                    message: `Unexpected closing brace "}" without matching opening "{".`,
                    suggestion: `Remove stray "}" or add opening "{" before expression.`,
                    severity: "error",
                }),
            );
        }

        i++;
    }

    // Remaining trailing text
    if (lastIdx < len) {
        const textPos = getSourcePosition(text, lastIdx, baseLine, baseColumn);
        ast.push({
            type: "text",
            value: text.slice(lastIdx),
            start: lastIdx,
            end: len,
            loc: { line: textPos.line, column: textPos.column },
        });
    }

    return { ast, diagnostics };
}
