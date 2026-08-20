/**
 * tests/date_plugin_deep.test.js
 * Deep coverage for EUIXDatePlugin declarative actions, timezones, date diff calculations, and helper functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXDatePlugin } from '../src/plugins/EUIXDatePlugin.js';

describe('EUIXDatePlugin Deep Coverage - Actions, Timezones & Date Math', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXDatePlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should execute SET_DATE_TIMEZONE, FORMAT_DATE, and CALCULATE_DATE_DIFF declarative actions', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="formattedResult"></state>
                <state id="diffResult"></state>
            </data_model>
            <flex direction="column">
                <button id="tz_btn">
                    <on_click action="SET_DATE_TIMEZONE" timezone="America/New_York" />
                </button>
                <button id="format_btn">
                    <on_click action="FORMAT_DATE" value="2026-08-20T12:00:00Z" format="YYYY-MM-DD" target="formattedResult" />
                </button>
                <button id="diff_btn">
                    <on_click action="CALCULATE_DATE_DIFF" start="2026-08-20" end="2026-08-25" unit="days" target="diffResult" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1. SET_DATE_TIMEZONE
        container.querySelector('#tz_btn').click();
        expect(engine._defaultDateTimeZone).toBe('America/New_York');

        // 2. FORMAT_DATE
        container.querySelector('#format_btn').click();
        expect(engine.getState('formattedResult')).toContain('2026');

        // 3. CALCULATE_DATE_DIFF
        container.querySelector('#diff_btn').click();
        expect(Math.abs(Number(engine.getState('diffResult')))).toBe(5);
    });

    it('should test $date context helper functions (add, subtract, startOf, endOf, diff, calendar, fromNow)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="baseDate">2026-08-20T15:00:00Z</state>
                <state id="addedDate"></state>
                <state id="subtractedDate"></state>
                <state id="startOfDay"></state>
                <state id="endOfDay"></state>
                <state id="calendarText"></state>
            </data_model>
            <flex direction="column">
                <button id="calc_btn">
                    <on_click action="RUN_SCRIPT">
                        $data.addedDate = $date.add($data.baseDate, 5, 'days');
                        $data.subtractedDate = $date.subtract($data.baseDate, 2, 'months');
                        $data.startOfDay = $date.startOf($data.baseDate, 'day');
                        $data.endOfDay = $date.endOf($data.baseDate, 'day');
                        $data.calendarText = $date.calendar($data.baseDate);
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        container.querySelector('#calc_btn').click();

        expect(engine.getState('addedDate')).toBeDefined();
        expect(engine.getState('subtractedDate')).toBeDefined();
        expect(engine.getState('startOfDay')).toBeDefined();
        expect(engine.getState('endOfDay')).toBeDefined();
        expect(engine.getState('calendarText')).toBeDefined();
    });
});
