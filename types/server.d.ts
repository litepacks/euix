import { EUIXAstNode } from "./compiler.js";

export interface RenderOptions {
    isStatic?: boolean;
    includeHydrationScript?: boolean;
    [key: string]: any;
}

export function renderToString(
    xmlOrAst: string | EUIXAstNode,
    initialData?: Record<string, any>,
    options?: RenderOptions
): string;

export function compileXmlToHtml(
    xmlOrAst: string | EUIXAstNode,
    initialData?: Record<string, any>,
    options?: RenderOptions
): string;
