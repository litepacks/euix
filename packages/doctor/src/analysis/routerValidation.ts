import type { EuixProject } from "../ir/types.js";

export function documentHasMarkupTag(project: EuixProject, tag: string): boolean {
    const pattern = new RegExp(`<${tag}[\\s>/]`, "i");
    return project.files.some(
        (f) => (f.kind === "xml" || f.kind === "html") && pattern.test(f.source),
    );
}

export function collectLinkTargets(project: EuixProject): { to: string; file: string; line: number; column: number }[] {
    const links: { to: string; file: string; line: number; column: number }[] = [];
    const pattern = /<link\b[^>]*\bto="([^"]+)"/gi;
    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        for (const match of file.source.matchAll(pattern)) {
            const to = match[1]?.trim();
            if (!to) continue;
            const before = file.source.slice(0, match.index ?? 0);
            const line = before.split("\n").length;
            const column = (before.split("\n").pop()?.length ?? 0) + 1;
            links.push({ to, file: file.path, line, column });
        }
    }
    return links;
}

export function routePathMatches(linkPath: string, routePath: string): boolean {
    if (routePath === "*") return false;
    const escaped = routePath
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:[^/]+/g, "[^/]+");
    return new RegExp(`^${escaped}$`).test(linkPath);
}

export function findMatchingRoute(project: EuixProject, linkPath: string): boolean {
    const routes = [...project.routes.values()];
    if (routes.length === 0) return true;
    return routes.some((route) => routePathMatches(linkPath, route.path));
}

export function hasRouterWithoutOutlet(project: EuixProject): boolean {
    const hasRouter = documentHasMarkupTag(project, "router") || project.routes.size > 0;
    const hasOutlet = documentHasMarkupTag(project, "outlet");
    return hasRouter && !hasOutlet;
}
