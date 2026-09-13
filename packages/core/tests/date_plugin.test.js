/**
 * tests/date_plugin.test.js
 * Comprehensive unit and integration test suite for EUIXDatePlugin & Intl Formatting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXDatePlugin, EUIXDateFormatter, DATE_PRESETS } from "../src/plugins/EUIXDatePlugin.js";

describe("EUIXDatePlugin - Intl Date & Time Formatting Suite", () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXDatePlugin);
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe("1. EUIXDateFormatter Core Unit Tests", () => {
        const formatter = new EUIXDateFormatter();
        const testDate = new Date("2026-08-20T14:30:00Z");

        it("should safely parse various date inputs", () => {
            expect(formatter.parseDate(testDate)).toBeInstanceOf(Date);
            expect(formatter.parseDate("2026-08-20T14:30:00Z")?.getTime()).toBe(testDate.getTime());
            expect(formatter.parseDate(1787149800000)?.getTime()).toBe(1787149800000);
            expect(formatter.parseDate("1787149800000")?.getTime()).toBe(1787149800000);
            expect(formatter.parseDate("now")).toBeInstanceOf(Date);
            expect(formatter.parseDate(null)).toBeNull();
            expect(formatter.parseDate("invalid-date-string")).toBeNull();
        });

        it("should format dates using standard presets and custom options", () => {
            const formattedEn = formatter.format(testDate, "short", "en-US", "UTC");
            expect(formattedEn).toBe("8/20/26");

            const formattedTr = formatter.format(testDate, "short", "tr-TR", "UTC");
            expect(formattedTr).toBe("20.08.2026");

            const formattedIso = formatter.format(testDate, "iso");
            expect(formattedIso).toBe("2026-08-20T14:30:00.000Z");

            const formattedCustom = formatter.format(testDate, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }, "en-US");
            expect(formattedCustom).toContain("Thursday");
            expect(formattedCustom).toContain("August");
            expect(formattedCustom).toContain("2026");
        });

        it("should format relative time correctly", () => {
            const base = new Date("2026-08-20T12:00:00Z");
            
            // 5 minutes ago
            const fiveMinAgo = new Date("2026-08-20T11:55:00Z");
            expect(formatter.formatRelative(fiveMinAgo, base, {}, "en-US")).toBe("5 minutes ago");
            expect(formatter.formatRelative(fiveMinAgo, base, {}, "tr-TR")).toBe("5 dakika önce");

            // 2 days ago (auto numeric -> "2 days ago" or "dün")
            const yesterday = new Date("2026-08-19T12:00:00Z");
            expect(formatter.formatRelative(yesterday, base, { numeric: "auto" }, "en-US")).toBe("yesterday");
            expect(formatter.formatRelative(yesterday, base, { numeric: "auto" }, "tr-TR")).toBe("dün");

            // in 3 hours
            const in3Hours = new Date("2026-08-20T15:00:00Z");
            expect(formatter.formatRelative(in3Hours, base, {}, "en-US")).toBe("in 3 hours");
            expect(formatter.formatRelative(in3Hours, base, {}, "tr-TR")).toBe("3 saat sonra");
        });

        it("should format date ranges", () => {
            const start = new Date("2026-09-01T10:00:00Z");
            const end = new Date("2026-09-05T18:00:00Z");

            const rangeEn = formatter.formatRange(start, end, "medium", "en-US", "UTC");
            expect(rangeEn).toBeDefined();
            expect(rangeEn).toContain("Sep");
        });

        it("should perform date calculations (add, diff, startOf, endOf)", () => {
            const base = new Date("2026-08-20T12:00:00Z");
            
            const in5Days = formatter.add(base, 5, "days");
            expect(in5Days.getUTCDate()).toBe(25);

            const diffDays = formatter.diff(base, in5Days, "days");
            expect(diffDays).toBe(5);

            const startOfDay = formatter.startOf(base, "day");
            expect(startOfDay.getHours()).toBe(0);
            expect(startOfDay.getMinutes()).toBe(0);

            const endOfDay = formatter.endOf(base, "day");
            expect(endOfDay.getHours()).toBe(23);
            expect(endOfDay.getMinutes()).toBe(59);

            const sub3Days = formatter.subtract(base, 3, "days");
            expect(sub3Days.getUTCDate()).toBe(17);
        });

        it("should provide Day.js-like utility functions (daysInMonth, isLeapYear, comparisons, quarter, weekOfYear)", () => {
            // daysInMonth
            expect(formatter.daysInMonth("2026-08-20")).toBe(31);
            expect(formatter.daysInMonth("2026-02-10")).toBe(28);
            expect(formatter.daysInMonth("2024-02-10")).toBe(29); // Leap year

            // isLeapYear
            expect(formatter.isLeapYear("2024-01-01")).toBe(true);
            expect(formatter.isLeapYear("2026-01-01")).toBe(false);
            expect(formatter.isLeapYear(2000)).toBe(true);
            expect(formatter.isLeapYear(1900)).toBe(false);

            // isSame, isBefore, isAfter
            const d1 = "2026-08-20T10:00:00Z";
            const d2 = "2026-08-20T18:00:00Z";
            const d3 = "2026-08-25T10:00:00Z";

            expect(formatter.isSame(d1, d2, "day")).toBe(true);
            expect(formatter.isSame(d1, d3, "day")).toBe(false);
            expect(formatter.isBefore(d1, d3)).toBe(true);
            expect(formatter.isAfter(d3, d1)).toBe(true);

            // isBetween
            expect(formatter.isBetween("2026-08-22", d1, d3)).toBe(true);
            expect(formatter.isBetween("2026-08-30", d1, d3)).toBe(false);
            expect(formatter.isBetween(d1, d1, d3, "[)")).toBe(true);
            expect(formatter.isBetween(d1, d1, d3, "()")).toBe(false);

            // quarter & weekOfYear
            expect(formatter.quarter("2026-01-15")).toBe(1);
            expect(formatter.quarter("2026-08-20")).toBe(3);
            expect(formatter.quarter("2026-11-05")).toBe(4);
            expect(formatter.weekOfYear("2026-01-01")).toBe(1);
            expect(formatter.weekOfYear("2026-08-20")).toBeGreaterThan(30);

            // formatToParts
            const parts = formatter.formatToParts("2026-08-20T14:30:00Z", "short", "en-US", "UTC");
            expect(Array.isArray(parts)).toBe(true);
            expect(parts.some(p => p.type === "year")).toBe(true);
            expect(parts.some(p => p.type === "month")).toBe(true);
            expect(parts.some(p => p.type === "day")).toBe(true);
        });
    });

    describe("2. Declarative XML Tags & Engine Integration", () => {
        it("should render <date> and <time> tags with reactive state updates", async () => {
            const xml = `
            <uid_spec>
                <date_config locale="tr-TR" timezone="UTC" default_format="short" />
                <data_model>
                    <state id="createdAt">2026-08-20T14:30:00Z</state>
                </data_model>
                <div class="test-wrapper">
                    <date id="date-el" value="{data.createdAt}" format="short" />
                    <time id="time-el" value="{data.createdAt}" format="time" />
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const dateEl = container.querySelector("#date-el");
            const timeEl = container.querySelector("#time-el");

            expect(dateEl).not.toBeNull();
            expect(dateEl.textContent.trim()).toBe("20.08.2026");

            expect(timeEl).not.toBeNull();
            expect(timeEl.tagName.toLowerCase()).toBe("time");
            expect(timeEl.getAttribute("datetime")).toBe("2026-08-20T14:30:00.000Z");

            // Reactive state update
            engine.setState("createdAt", "2026-12-31T09:15:00Z");
            await new Promise(r => queueMicrotask(r));

            expect(dateEl.textContent.trim()).toBe("31.12.2026");
        });

        it("should render relative time and date ranges reactively", async () => {
            const xml = `
            <uid_spec>
                <date_config locale="en-US" timezone="UTC" />
                <data_model>
                    <state id="startDate">2026-09-01T09:00:00Z</state>
                    <state id="endDate">2026-09-05T18:00:00Z</state>
                    <state id="pastTimestamp">2026-08-20T10:00:00Z</state>
                </data_model>
                <div>
                    <date_range id="range-el" start="{data.startDate}" end="{data.endDate}" format="short" />
                    <relative_time id="rel-el" value="{data.pastTimestamp}" />
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const rangeEl = container.querySelector("#range-el");
            const relEl = container.querySelector("#rel-el");

            expect(rangeEl).not.toBeNull();
            expect(rangeEl.textContent).toContain("26");

            expect(relEl).not.toBeNull();
            expect(relEl.textContent.length).toBeGreaterThan(0);
        });

        it("should support $date context helper in expressions and scripts", async () => {
            const xml = `
            <uid_spec>
                <date_config locale="tr-TR" timezone="UTC" />
                <data_model>
                    <state id="rawDate">2026-08-20T14:30:00Z</state>
                    <state id="diffResult">0</state>
                </data_model>
                <div>
                    <button id="calc-btn">
                        <on_click action="RUN_SCRIPT">
                            const d1 = $data.rawDate;
                            const d2 = $date.add(d1, 10, 'days');
                            $data.diffResult = $date.diff(d1, d2, 'days');
                        </on_click>
                        Calculate
                    </button>
                    <span id="diff-span">{data.diffResult}</span>
                    <span id="days-span">{$date.daysInMonth(data.rawDate)}</span>
                    <span id="leap-span">{$date.isLeapYear(data.rawDate) ? 'LEAP' : 'COMMON'}</span>
                    <span id="quarter-span">{$date.quarter(data.rawDate)}</span>
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const btn = container.querySelector("#calc-btn");
            const diffSpan = container.querySelector("#diff-span");
            const daysSpan = container.querySelector("#days-span");
            const leapSpan = container.querySelector("#leap-span");
            const quarterSpan = container.querySelector("#quarter-span");

            expect(diffSpan.textContent.trim()).toBe("0");
            expect(daysSpan.textContent.trim()).toBe("31");
            expect(leapSpan.textContent.trim()).toBe("COMMON");
            expect(quarterSpan.textContent.trim()).toBe("3");

            btn.click();
            await new Promise(r => queueMicrotask(r));

            expect(diffSpan.textContent.trim()).toBe("10");

            // Change date to leap year Feb 2024
            engine.setState("rawDate", "2024-02-15T00:00:00Z");
            await new Promise(r => queueMicrotask(r));

            expect(daysSpan.textContent.trim()).toBe("29");
            expect(leapSpan.textContent.trim()).toBe("LEAP");
            expect(quarterSpan.textContent.trim()).toBe("1");
        });

        it("should execute declarative date actions (SET_DATE_LOCALE, FORMAT_DATE)", async () => {
            const xml = `
            <uid_spec>
                <date_config locale="en-US" timezone="UTC" />
                <data_model>
                    <state id="myDate">2026-08-20T14:30:00Z</state>
                    <state id="formattedResult"></state>
                </data_model>
                <div>
                    <date id="dyn-date" value="{data.myDate}" format="short" />

                    <button id="format-action-btn">
                        <on_click action="FORMAT_DATE" value="{data.myDate}" format="short" locale="tr-TR" target="formattedResult" />
                        Format TR
                    </button>

                    <button id="locale-action-btn">
                        <on_click action="SET_DATE_LOCALE" locale="tr-TR" />
                        Set Locale TR
                    </button>

                    <span id="res-span">{data.formattedResult}</span>
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const formatBtn = container.querySelector("#format-action-btn");
            const localeBtn = container.querySelector("#locale-action-btn");
            const dynDate = container.querySelector("#dyn-date");
            const resSpan = container.querySelector("#res-span");

            expect(dynDate.textContent.trim()).toBe("8/20/26");

            // Execute FORMAT_DATE action
            formatBtn.click();
            await new Promise(r => queueMicrotask(r));
            expect(resSpan.textContent.trim()).toBe("20.08.2026");

            // Execute SET_DATE_LOCALE action
            localeBtn.click();
            await new Promise(r => queueMicrotask(r));
            expect(engine.getDateConfig().locale).toBe("tr-TR");
        });

        it("should handle live relative time timer with lifecycle cleanup on unmount", async () => {
            vi.useFakeTimers();
            const initialTime = new Date("2026-08-20T12:00:00Z");
            vi.setSystemTime(initialTime);

            const xml = `
            <uid_spec>
                <data_model>
                    <state id="fixedTimestamp">2026-08-20T12:00:00Z</state>
                </data_model>
                <div>
                    <date id="live-rel" value="{data.fixedTimestamp}" relative="true" live="true" interval="1000" />
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const liveEl = container.querySelector("#live-rel");
            expect(liveEl).not.toBeNull();

            // Advance timers & system time by 65 seconds
            vi.advanceTimersByTime(65000);
            await new Promise(r => queueMicrotask(r));

            expect(liveEl.textContent).toContain("minute");

            // Unmount engine cleanly
            engine.unmount();
            vi.useRealTimers();
        });
    });
});
