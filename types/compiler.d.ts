export interface EUIXAstNode {
    tag: string;
    attrs: Record<string, string>;
    children: Array<EUIXAstNode | string>;
    isSelfClosing?: boolean;
}

export function compileXmlToAst(xmlString: string): EUIXAstNode | null;
export function compileXmlToJs(xmlString: string, options?: Record<string, any>): string;
export function euixVitePlugin(options?: Record<string, any>): any;
export const euixRollupPlugin: (options?: Record<string, any>) => any;
export const euixPlugin: (options?: Record<string, any>) => any;
