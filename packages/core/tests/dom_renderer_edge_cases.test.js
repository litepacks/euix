import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('DOMRenderer Layout & Directives Exhaustive Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should render all static and dynamic flex properties (gap_x, gap_y, align, justify variants)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="flex_align">end</state>
                <state id="flex_justify">between</state>
                <state id="dynamic_gap">24</state>
                <state id="dynamic_gap_x">16</state>
                <state id="dynamic_gap_y">12</state>
            </data_model>
            <flex 
                direction="row-reverse" 
                align="{data.flex_align}" 
                justify="{data.flex_justify}" 
                gap="{data.dynamic_gap}" 
                gap_x="{data.dynamic_gap_x}" 
                gap_y="{data.dynamic_gap_y}" 
                class="custom-flex"
            >
                <span>Flex Item 1</span>
                <span>Flex Item 2</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const flexEl = container.querySelector('.custom-flex');
        expect(flexEl).toBeTruthy();
        expect(flexEl.style.flexDirection).toBe('row-reverse');
        expect(flexEl.style.alignItems).toBe('flex-end');
        expect(flexEl.style.justifyContent).toBe('space-between');
        expect(flexEl.style.gap).toBe('24px');
        expect(flexEl.style.columnGap).toBe('16px');
        expect(flexEl.style.rowGap).toBe('12px');

        // Update dynamic states
        engine.setState('flex_align', 'start');
        engine.setState('flex_justify', 'around');
        engine.setState('dynamic_gap', '32');
    });

    it('should render all grid layout tags and attributes (columns, rows, gap)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="cols">4</state>
                <state id="col_gap_val">10</state>
            </data_model>
            <grid 
                cols="{data.cols}" 
                rows="2" 
                gap="16" 
                col_gap="{data.col_gap_val}" 
                row_gap="20" 
                class="custom-grid"
            >
                <div class="col-span-2">Cell 1</div>
                <div>Cell 2</div>
            </grid>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const gridEl = container.querySelector('.custom-grid');
        expect(gridEl).toBeTruthy();
        expect(gridEl.style.display).toBe('grid');
        expect(gridEl.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
        expect(gridEl.style.gridTemplateRows).toBe('repeat(2, minmax(0, 1fr))');
        expect(gridEl.style.gap).toBe('16px');
        expect(gridEl.style.columnGap).toBe('10px');
        expect(gridEl.style.rowGap).toBe('20px');
    });

    it('should render SVG tags with proper namespace and dynamic attribute bindings', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="circle_radius">40</state>
                <state id="stroke_color">#4f46e5</state>
            </data_model>
            <svg width="100" height="100" viewBox="0 0 100 100" class="test-svg">
                <circle cx="50" cy="50" r="{data.circle_radius}" stroke="{data.stroke_color}" stroke-width="4" fill="none" />
                <path d="M 10 10 L 90 90" stroke="#f43f5e" />
            </svg>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const svgEl = container.querySelector('.test-svg');
        expect(svgEl).toBeTruthy();
        expect(svgEl.namespaceURI).toBe('http://www.w3.org/2000/svg');

        const circleEl = svgEl.querySelector('circle');
        expect(circleEl.getAttribute('r')).toBe('40');
        expect(circleEl.getAttribute('stroke')).toBe('#4f46e5');

        engine.setState('circle_radius', 48);
        expect(circleEl.getAttribute('r')).toBe('48');
    });
});
