import { EUIXEngine, EUIXExpressionParser } from '../src/EUIXEngine.js';

const exprStr = "data.timer_seconds > 0 ? data.timer_seconds - 1 : 0";
const evalGetter = (key) => {
    console.log("evalGetter called for key:", key);
    return 60;
};

try {
    const tokens = EUIXExpressionParser.tokenize(exprStr);
    console.log("TOKENS:", tokens);
    const ast = EUIXExpressionParser.parse(tokens);
    console.log("AST:", JSON.stringify(ast, null, 2));
    const res = EUIXExpressionParser.evaluate(ast, evalGetter);
    console.log("SUCCESS EVALUATE RESULT:", res);
} catch (err) {
    console.error("ERROR THROWN:", err);
}
