import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXDatePlugin } from '../src/plugins/EUIXDatePlugin.js';
import { EUIXLeafletPlugin } from '../src/plugins/EUIXLeafletPlugin.js';

describe('Date & Leaflet Plugins Extended Matrix Suite', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXDatePlugin).use(EUIXLeafletPlugin);
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should test <date_range> tag with custom locales, timezones, presets, and fallback', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="start_date">2026-01-01</state>
                <state id="end_date">2026-01-15</state>
                <state id="empty_start"></state>
                <state id="empty_end"></state>
            </data_model>
            <div>
                <date_range 
                    id="range1" 
                    start="{data.start_date}" 
                    end="{data.end_date}" 
                    locale="en-US" 
                    timezone="UTC" 
                    format="medium" 
                    data-testid="date-range-el" 
                />
                <date_range 
                    id="range-empty" 
                    start="{data.empty_start}" 
                    end="{data.empty_end}" 
                    fallback="No Date Available" 
                />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const rangeEl = container.querySelector('#range1');
        expect(rangeEl).toBeTruthy();
        expect(rangeEl.getAttribute('data-testid')).toBe('date-range-el');
        expect(rangeEl.textContent).toBeTruthy();

        const emptyRangeEl = container.querySelector('#range-empty');
        expect(emptyRangeEl.textContent).toBe('No Date Available');

        // Dynamically update dates
        engine.setState('start_date', '2026-06-01');
        engine.setState('end_date', '2026-06-10');
        expect(rangeEl.textContent).toBeTruthy();
    });

    it('should test Leaflet map custom actions and bindings if available', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="lat" type="number">41.0082</state>
                <state id="lng" type="number">28.9784</state>
                <state id="zoom" type="number">12</state>
            </data_model>
            <div>
                <map id="city_map" lat="{data.lat}" lng="{data.lng}" zoom="{data.zoom}" class="h-64 w-full" />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const mapEl = container.querySelector('#city_map');
        expect(mapEl).toBeTruthy();
    });
});
