import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXDatePlugin, DATE_PRESETS, EUIXDateFormatter } from "../src/plugins/EUIXDatePlugin.js";

EUIXEngineCore.use(EUIXDatePlugin);

describe("EUIXDatePlugin Comprehensive Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("should test all EUIXDateFormatter helper calculations and edge cases", () => {
        const formatter = new EUIXDateFormatter();

        // parseDate
        expect(formatter.parseDate(new Date()) instanceof Date).toBe(true);
        expect(formatter.parseDate("2026-08-20") instanceof Date).toBe(true);
        expect(formatter.parseDate("invalid-date-string")).toBeNull();
        expect(formatter.parseDate(null)).toBeNull();
        expect(formatter.parseDate(undefined)).toBeNull();

        // toDate / parseDate
        const d1 = formatter.parseDate("2026-08-20T12:00:00Z");
        expect(d1 instanceof Date).toBe(true);
        expect(formatter.parseDate(d1)).toBe(d1);
        expect(formatter.parseDate(1700000000000) instanceof Date).toBe(true);
        expect(formatter.parseDate("invalid")).toBeNull();

        // format with various presets
        const dIso = "2026-08-20T15:30:45Z";
        expect(formatter.format(dIso, "date_short", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "date_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "date_long", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "date_full", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "time_short", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "time_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "time_long", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "datetime_short", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "datetime_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "datetime_long", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "datetime_full", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "year", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "year_month", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "month", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "month_short", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "weekday", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "weekday_short", "en-US", "UTC")).toBeDefined();
        expect(formatter.format(dIso, "weekday_date", "en-US", "UTC")).toBeDefined();
        expect(formatter.format("invalid", "medium")).toBe("");

        // formatRange
        const dStart = "2026-08-20T10:00:00Z";
        const dEnd = "2026-08-25T18:00:00Z";
        expect(formatter.formatRange(dStart, dEnd, "date_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.formatRange(dStart, "invalid", "date_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.formatRange("invalid", dEnd, "date_medium", "en-US", "UTC")).toBeDefined();
        expect(formatter.formatRange("invalid", "invalid", "date_medium", "en-US", "UTC")).toBe("");

        // relative time
        const now = Date.now();
        const past = new Date(now - 3600 * 1000 * 5); // 5 hours ago
        const future = new Date(now + 3600 * 1000 * 24 * 3); // in 3 days
        expect(formatter.formatRelative(past, "en-US")).toContain("ago");
        expect(formatter.formatRelative(future, "en-US")).toContain("in");
        expect(formatter.formatRelative("invalid")).toBe("");

        // Math calculations
        expect(formatter.isLeapYear(2024)).toBe(true);
        expect(formatter.isLeapYear(2026)).toBe(false);
        expect(formatter.isLeapYear(2000)).toBe(true);
        expect(formatter.isLeapYear(1900)).toBe(false);
        expect(formatter.isLeapYear("invalid")).toBe(false);

        expect(formatter.daysInMonth("2024-02-15")).toBe(29);
        expect(formatter.daysInMonth("2026-02-15")).toBe(28);
        expect(formatter.daysInMonth("2026-01-01")).toBe(31);
        expect(formatter.daysInMonth("invalid")).toBe(0);

        // startOf & endOf
        const baseDate = "2026-08-20T15:30:45.500Z";
        expect(formatter.startOf(baseDate, "year")).toBeDefined();
        expect(formatter.startOf(baseDate, "month")).toBeDefined();
        expect(formatter.startOf(baseDate, "day")).toBeDefined();
        expect(formatter.startOf(baseDate, "hour")).toBeDefined();
        expect(formatter.startOf(baseDate, "minute")).toBeDefined();
        expect(formatter.startOf("invalid", "day")).toBeFalsy();

        expect(formatter.endOf(baseDate, "year")).toBeDefined();
        expect(formatter.endOf(baseDate, "month")).toBeDefined();
        expect(formatter.endOf(baseDate, "day")).toBeDefined();
        expect(formatter.endOf(baseDate, "hour")).toBeDefined();
        expect(formatter.endOf(baseDate, "minute")).toBeDefined();
        expect(formatter.endOf("invalid", "day")).toBeFalsy();

        // add & subtract
        expect(formatter.add(baseDate, 5, "days")).toBeDefined();
        expect(formatter.add(baseDate, 2, "months")).toBeDefined();
        expect(formatter.add(baseDate, 1, "years")).toBeDefined();
        expect(formatter.add(baseDate, 3, "hours")).toBeDefined();
        expect(formatter.add(baseDate, 30, "minutes")).toBeDefined();
        expect(formatter.add(baseDate, 45, "seconds")).toBeDefined();
        expect(formatter.add("invalid", 5, "days")).toBeFalsy();

        expect(formatter.subtract(baseDate, 5, "days")).toBeDefined();
        expect(formatter.subtract("invalid", 5, "days")).toBeFalsy();

        // diff
        expect(formatter.diff("2026-08-25", "2026-08-20", "days")).toBe(-5);
        expect(formatter.diff("2026-08-20", "2026-08-25", "days")).toBe(5);
        expect(formatter.diff("2026-08-20T12:00:00Z", "2026-08-20T15:00:00Z", "hours")).toBe(3);
        expect(formatter.diff("2026-08-20T12:00:00Z", "2026-08-20T12:30:00Z", "minutes")).toBe(30);
        expect(formatter.diff("2026-08-20T12:00:00Z", "2026-08-20T12:00:45Z", "seconds")).toBe(45);
        expect(formatter.diff("2026-01-01", "2027-01-01", "years")).toBe(1);
        expect(formatter.diff("2026-01-01", "2026-07-01", "months")).toBe(6);
        expect(formatter.diff("invalid", "2026-08-25")).toBe(0);

        // comparisons
        expect(formatter.isBefore("2026-08-19", "2026-08-20")).toBe(true);
        expect(formatter.isBefore("2026-08-21", "2026-08-20")).toBe(false);
        expect(formatter.isAfter("2026-08-21", "2026-08-20")).toBe(true);
        expect(formatter.isAfter("2026-08-19", "2026-08-20")).toBe(false);
        expect(formatter.isSame("2026-08-20", "2026-08-20")).toBe(true);
        expect(formatter.isSame("invalid", "2026-08-20")).toBe(false);
    });

    it("should test declarative date XML tags and event actions", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="startDate">2026-08-01T10:00:00Z</state>
                <state id="endDate">2026-08-15T18:00:00Z</state>
                <state id="formattedResult"></state>
                <state id="diffResult"></state>
                <state id="currentLocale">en-US</state>
                <state id="currentTimeZone">UTC</state>
            </data_model>

            <date_config locale="en-US" timezone="UTC" format="date_medium" />

            <flex direction="column">
                <date value="{data.startDate}" format="date_full" id="full-date-el" data-test="custom-data" aria-label="Date Field" />
                <time value="{data.startDate}" format="time_short" id="time-el" />
                <date_range start="{data.startDate}" end="{data.endDate}" format="date_short" id="range-el" fallback="N/A" />
                <relative_time value="{data.startDate}" id="rel-el" />

                <button id="btn-locale">
                    <on_click action="SET_DATE_LOCALE" locale="tr-TR" />
                    Change Locale
                </button>

                <button id="btn-tz">
                    <on_click action="SET_DATE_TIMEZONE" timezone="Europe/Istanbul" />
                    Change Timezone
                </button>

                <button id="btn-format">
                    <on_click action="FORMAT_DATE" value="{data.startDate}" format="date_full" target="formattedResult" />
                    Format
                </button>

                <button id="btn-diff">
                    <on_click action="CALCULATE_DATE_DIFF" start="{data.startDate}" end="{data.endDate}" unit="days" target="diffResult" />
                    Diff
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        const fullDateEl = container.querySelector("#full-date-el");
        expect(fullDateEl).not.toBeNull();
        expect(fullDateEl.getAttribute("data-test")).toBe("custom-data");
        expect(fullDateEl.getAttribute("aria-label")).toBe("Date Field");

        const rangeEl = container.querySelector("#range-el");
        expect(rangeEl).not.toBeNull();

        // Trigger actions
        const btnLocale = container.querySelector("#btn-locale");
        btnLocale.click();
        expect(engine._defaultDateLocale).toBe("tr-TR");

        const btnTz = container.querySelector("#btn-tz");
        btnTz.click();
        expect(engine._defaultDateTimeZone).toBe("Europe/Istanbul");

        const btnFormat = container.querySelector("#btn-format");
        btnFormat.click();
        expect(engine.getState("formattedResult")).toBeDefined();

        const btnDiff = container.querySelector("#btn-diff");
        btnDiff.click();
        expect(engine.getState("diffResult")).toBe(14);
    });
});
