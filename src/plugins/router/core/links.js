/**
 * src/plugins/router/core/links.js
 * Declarative <route-link> and <a route="..."> link interception and active/pending states.
 */

import { generatePath, resolvePath, createPath, normalizePath } from "./utils.js";

/**
 * Creates the RouteLink renderer function.
 * 
 * @param {object} engine - EUIXEngine instance
 * @param {object} routerInstance - EUIXRouter instance
 * @returns {Function}
 */
export function createLinkRenderer(engine, routerInstance) {
    return function renderRouteLink(xmlNode, context = {}) {
        if (typeof document === "undefined") return null;

        const linkEl = document.createElement("a");
        const baseClass = xmlNode.getAttribute("class") || "";
        if (baseClass) linkEl.className = baseClass;

        const activeClass = xmlNode.getAttribute("active-class") || xmlNode.getAttribute("active_class") || "active";
        const pendingClass = xmlNode.getAttribute("pending-class") || xmlNode.getAttribute("pending_class") || "pending";
        const isExact = xmlNode.hasAttribute("exact") && xmlNode.getAttribute("exact") !== "false";
        const isReplace = xmlNode.hasAttribute("replace") && xmlNode.getAttribute("replace") !== "false";
        const isPreserveScroll = xmlNode.hasAttribute("preserve-scroll") || xmlNode.hasAttribute("preserve_scroll");
        const prefetchMode = xmlNode.getAttribute("prefetch") || "none";

        const rawTo = xmlNode.getAttribute("to") || xmlNode.getAttribute("href") || xmlNode.getAttribute("route");
        const namedRoute = xmlNode.getAttribute("route") || xmlNode.getAttribute("name");
        const paramsAttr = xmlNode.getAttribute("params");

        const isDynamic = (rawTo && rawTo.indexOf("{") !== -1) || 
                          (namedRoute && namedRoute.indexOf("{") !== -1) || 
                          (paramsAttr && (paramsAttr.includes("{data.") || paramsAttr.includes("{$")));

        // Determine target path
        const getTargetPath = () => {
            if (namedRoute && !rawTo?.startsWith("/") && !rawTo?.startsWith(".")) {
                const namedPattern = routerInstance.matcher.getNamedPath(namedRoute);
                if (namedPattern) {
                    let parsedParams = {};
                    if (paramsAttr) {
                        try {
                            parsedParams = JSON.parse(paramsAttr);
                        } catch (_) {
                            try {
                                const interpolated = engine.interpolate(paramsAttr, context);
                                parsedParams = typeof interpolated === "object" ? interpolated : JSON.parse(interpolated);
                            } catch (_) {}
                        }
                    }
                    return generatePath(namedPattern, parsedParams);
                }
            }

            if (rawTo) {
                const interpolated = isDynamic ? engine.interpolate(rawTo, context) : rawTo;
                return resolvePath(interpolated, routerInstance.location.pathname);
            }

            return "/";
        };

        let targetPath = getTargetPath();
        let targetNorm = normalizePath(targetPath.split("?")[0].split("#")[0]);
        linkEl.href = routerInstance.history?.createHref ? routerInstance.history.createHref(targetPath) : (routerInstance.history?.prependBase(targetPath) || targetPath);

        // Render children inside the link
        const childNodes = xmlNode.childNodes;
        const cLen = childNodes.length;
        for (let i = 0; i < cLen; i++) {
            const childEl = engine.createHTMLElement(childNodes[i], context);
            if (childEl) linkEl.appendChild(childEl);
        }

        // Fast zero-allocation active/pending class updater
        const updateClasses = () => {
            if (isDynamic) {
                targetPath = getTargetPath();
                targetNorm = normalizePath(targetPath.split("?")[0].split("#")[0]);
                linkEl.href = routerInstance.history?.createHref ? routerInstance.history.createHref(targetPath) : (routerInstance.history?.prependBase(targetPath) || targetPath);
            }

            const currentPath = normalizePath(routerInstance.location.pathname);

            let isActive = false;
            if (isExact || targetNorm === "/") {
                isActive = currentPath === targetNorm;
            } else {
                isActive = currentPath === targetNorm || currentPath.startsWith(targetNorm + "/");
            }

            let isPending = false;
            if (routerInstance.navigation && routerInstance.navigation.location) {
                const pendingPath = normalizePath(routerInstance.navigation.location.pathname);
                isPending = isExact ? pendingPath === targetNorm : (pendingPath === targetNorm || pendingPath.startsWith(targetNorm + "/"));
            }

            if (activeClass) {
                if (isActive) linkEl.classList.add(activeClass);
                else linkEl.classList.remove(activeClass);
            }
            if (pendingClass) {
                if (isPending) linkEl.classList.add(pendingClass);
                else linkEl.classList.remove(pendingClass);
            }

            linkEl.setAttribute("aria-current", isActive ? "page" : "false");
        };

        updateClasses();

        // Prefetching strategies
        if (prefetchMode !== "none" && routerInstance.prefetch) {
            if (prefetchMode === "render") {
                routerInstance.prefetch(targetPath);
            } else if (prefetchMode === "intent" || prefetchMode === "hover") {
                linkEl.addEventListener("mouseenter", () => routerInstance.prefetch(targetPath), { once: true });
                linkEl.addEventListener("focus", () => routerInstance.prefetch(targetPath), { once: true });
            } else if (prefetchMode === "viewport" && typeof IntersectionObserver !== "undefined") {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            routerInstance.prefetch(targetPath);
                            observer.disconnect();
                        }
                    });
                });
                observer.observe(linkEl);
            }
        }

        // Intercept click for SPA navigation with accessibility checks
        linkEl.onclick = (e) => {
            // Check modifier keys or external targets
            if (
                e.defaultPrevented ||
                e.button !== 0 ||
                e.metaKey ||
                e.altKey ||
                e.ctrlKey ||
                e.shiftKey ||
                (linkEl.target && linkEl.target !== "_self") ||
                linkEl.hasAttribute("download")
            ) {
                return; // Let browser handle native behavior
            }

            e.preventDefault();
            routerInstance.navigate(targetPath, {
                replace: isReplace,
                preserveScroll: isPreserveScroll
            });
        };

        // Subscribe to routing changes for active/pending class updating
        const unlisten1 = routerInstance.on("route:match", updateClasses);
        const unlisten2 = routerInstance.on("navigation:start", updateClasses);
        const unlisten3 = routerInstance.on("navigation:end", updateClasses);

        if (typeof engine.onUnmount === "function") {
            engine.onUnmount(() => {
                unlisten1();
                unlisten2();
                unlisten3();
            });
        }

        return linkEl;
    };
}
