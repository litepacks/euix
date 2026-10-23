/**
 * src/core/renderer/LayoutStyles.js
 * High-performance layout style resolution (flex, grid, gap, justify, align) and compilation for EUIX Engine.
 */

import { isElem, getAttr } from "../utils/constants.js";

/**
 * Applies layout styles (flex/grid/alignment/gaps) to a DOM element based on XML attributes or pre-computed static style cache.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {HTMLElement} el
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 */
export function applyLayoutStyles(engine, el, xmlNode, context = {}) {
    if (!el || !isElem(xmlNode)) return;

    if (xmlNode._staticLayoutStyle) {
        const s = xmlNode._staticLayoutStyle;
        if (s.flexDirection) el.style.flexDirection = s.flexDirection;
        if (s.alignItems) el.style.alignItems = s.alignItems;
        if (s.justifyContent) el.style.justifyContent = s.justifyContent;
        if (s.gap) el.style.gap = s.gap;
        if (s.columnGap) el.style.columnGap = s.columnGap;
        if (s.rowGap) el.style.rowGap = s.rowGap;
        if (s.flexWrap) el.style.flexWrap = s.flexWrap;
        if (s.gridTemplateColumns) el.style.gridTemplateColumns = s.gridTemplateColumns;
        if (s.gridTemplateRows) el.style.gridTemplateRows = s.gridTemplateRows;
        if (s.padding) el.style.padding = s.padding;
        if (s.borderRadius) el.style.borderRadius = s.borderRadius;
        if (s.margin) el.style.margin = s.margin;
        if (s.background) el.style.background = s.background;
        if (s.width) el.style.width = s.width;
        if (s.height) el.style.height = s.height;
        if (s.cssText) el.style.cssText += `;${s.cssText}`;
        return;
    }

    const tagName = xmlNode.tagName.toLowerCase();
    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();
    const isFlex = tagName === "flex" || typeAttr === "flex";

    const staticStyle = {};
    let isDynamic = false;

    const direction =
        getAttr(xmlNode, "direction", "flex_direction", "dir");
    if (direction) {
        if (direction.includes("{")) {
            isDynamic = true;
            el.style.flexDirection = engine.interpolate(direction, context).trim();
        } else {
            el.style.flexDirection = direction;
            staticStyle.flexDirection = direction;
        }
    }

    const align = getAttr(xmlNode, "align", "align_items");
    if (align) {
        if (align.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(align, context).trim();
            el.style.alignItems = val === "start" ? "flex-start" : val === "end" ? "flex-end" : val;
        } else {
            const v = align === "start" ? "flex-start" : align === "end" ? "flex-end" : align;
            el.style.alignItems = v;
            staticStyle.alignItems = v;
        }
    }

    const justify = getAttr(xmlNode, "justify", "justify_content");
    if (justify) {
        if (justify.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(justify, context).trim();
            el.style.justifyContent =
                val === "start"
                    ? "flex-start"
                    : val === "end"
                      ? "flex-end"
                      : val === "between"
                        ? "space-between"
                        : val === "around"
                          ? "space-around"
                          : val === "evenly"
                            ? "space-evenly"
                            : val;
        } else {
            const v =
                justify === "start"
                    ? "flex-start"
                    : justify === "end"
                      ? "flex-end"
                      : justify === "between"
                        ? "space-between"
                        : justify === "around"
                          ? "space-around"
                          : justify === "evenly"
                            ? "space-evenly"
                            : justify;
            el.style.justifyContent = v;
            staticStyle.justifyContent = v;
        }
    }

    const gap = xmlNode.getAttribute("gap");
    if (gap) {
        if (gap.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gap, context).trim();
            el.style.gap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gap) ? `${gap}px` : gap;
            el.style.gap = v;
            staticStyle.gap = v;
        }
    }

    const gapX = getAttr(xmlNode, "gap_x", "col_gap");
    if (gapX) {
        if (gapX.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gapX, context).trim();
            el.style.columnGap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gapX) ? `${gapX}px` : gapX;
            el.style.columnGap = v;
            staticStyle.columnGap = v;
        }
    }

    const gapY = getAttr(xmlNode, "gap_y", "row_gap");
    if (gapY) {
        if (gapY.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gapY, context).trim();
            el.style.rowGap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gapY) ? `${gapY}px` : gapY;
            el.style.rowGap = v;
            staticStyle.rowGap = v;
        }
    }

    const wrap = xmlNode.getAttribute("wrap");
    if (wrap) {
        if (wrap.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(wrap, context).trim();
            if (isFlex) {
                el.style.flexWrap = val === "true" || val === "wrap" ? "wrap" : "nowrap";
            }
        } else {
            if (isFlex) {
                const v = wrap === "true" || wrap === "wrap" ? "wrap" : "nowrap";
                el.style.flexWrap = v;
                staticStyle.flexWrap = v;
            }
        }
    }

    const cols = getAttr(xmlNode, "cols", "columns");
    if (cols) {
        if (cols.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(cols, context).trim();
            el.style.gridTemplateColumns = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
        } else {
            const v = /^\d+$/.test(cols) ? `repeat(${cols}, minmax(0, 1fr))` : cols;
            el.style.gridTemplateColumns = v;
            staticStyle.gridTemplateColumns = v;
        }
    }

    const rows = xmlNode.getAttribute("rows");
    if (rows) {
        if (rows.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(rows, context).trim();
            el.style.gridTemplateRows = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
        } else {
            const v = /^\d+$/.test(rows) ? `repeat(${rows}, minmax(0, 1fr))` : rows;
            el.style.gridTemplateRows = v;
            staticStyle.gridTemplateRows = v;
        }
    }

    const padding = getAttr(xmlNode, "padding", "pad", "p");
    if (padding) {
        if (padding.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(padding, context).trim();
            el.style.padding = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(padding) ? `${padding}px` : padding;
            el.style.padding = v;
            staticStyle.padding = v;
        }
    }

    const radius =
        getAttr(xmlNode, "radius", "rounded", "border_radius");
    if (radius) {
        if (radius.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(radius, context).trim();
            el.style.borderRadius = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(radius) ? `${radius}px` : radius;
            el.style.borderRadius = v;
            staticStyle.borderRadius = v;
        }
    }

    const margin = getAttr(xmlNode, "margin", "m");
    if (margin) {
        if (margin.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(margin, context).trim();
            el.style.margin = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(margin) ? `${margin}px` : margin;
            el.style.margin = v;
            staticStyle.margin = v;
        }
    }

    const bg = getAttr(xmlNode, "bg", "background");
    if (bg) {
        if (bg.includes("{")) {
            isDynamic = true;
            el.style.background = engine.interpolate(bg, context).trim();
        } else {
            el.style.background = bg;
            staticStyle.background = bg;
        }
    }

    const width = getAttr(xmlNode, "width", "w");
    if (width) {
        if (width.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(width, context).trim();
            el.style.width = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(width) ? `${width}px` : width;
            el.style.width = v;
            staticStyle.width = v;
        }
    }

    const height = getAttr(xmlNode, "height", "h");
    if (height) {
        if (height.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(height, context).trim();
            el.style.height = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(height) ? `${height}px` : height;
            el.style.height = v;
            staticStyle.height = v;
        }
    }

    const customStyle = xmlNode.getAttribute("style");
    if (customStyle) {
        if (customStyle.includes("{")) {
            isDynamic = true;
            const styleStr = engine.interpolate(customStyle, context).trim();
            if (styleStr) el.style.cssText += `;${styleStr}`;
        } else {
            el.style.cssText += `;${customStyle}`;
            staticStyle.cssText = customStyle;
        }
    }

    if (!isDynamic) {
        xmlNode._staticLayoutStyle = staticStyle;
    }
}

/**
 * Applies child layout styles (flex, gridColumn span, gridRow span).
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {HTMLElement} childEl
 * @param {Element} childXmlNode
 * @param {Record<string, any>} context
 */
export function applyItemChildStyles(engine, childEl, childXmlNode, context = {}) {
    if (!childEl || !isElem(childXmlNode)) return;

    const flex = childXmlNode.getAttribute("flex");
    if (flex) {
        childEl.style.flex = engine.interpolate(flex, context).trim();
    }

    const colSpan = childXmlNode.getAttribute("col_span");
    if (colSpan) {
        const val = engine.interpolate(colSpan, context).trim();
        childEl.style.gridColumn = val.startsWith("span") ? val : `span ${val} / span ${val}`;
    }

    const rowSpan = childXmlNode.getAttribute("row_span");
    if (rowSpan) {
        const val = engine.interpolate(rowSpan, context).trim();
        childEl.style.gridRow = val.startsWith("span") ? val : `span ${val} / span ${val}`;
    }
}
