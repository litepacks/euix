/**
 * src/plugins/EUIXDatePlugin.js
 * Comprehensive Declarative Date, Time & Intl Formatting Plugin for EUIX Engine.
 * 
 * Built strictly on native Web Platform primitives:
 * - Intl.DateTimeFormat (Locale-aware date/time formatting, parts & range)
 * - Intl.RelativeTimeFormat (Locale-aware relative time like "3 gün önce", "in 2 hours")
 * - Native Date manipulation and calculation helpers
 * 
 * Features:
 * - XML-first declarative tags: <date>, <time>, <date_range>, <relative_time>, <date_config>
 * - Reactive state interpolation and automatic fine-grained in-place updates
 * - Live relative time updates (live="true" / interval="30000") with lifecycle cleanup
 * - Zero-allocation memoized Intl formatter cache (Map LRU)
 * - Rich template & script context helper: $date (format, relative, range, add, diff, startOf, endOf)
 * - Declarative event actions: SET_DATE_LOCALE, SET_DATE_TIMEZONE, FORMAT_DATE, CALCULATE_DATE_DIFF
 */

// Preset format options mapped to standard Intl configurations
export const DATE_PRESETS = {
    date: { dateStyle: "medium" },
    date_short: { dateStyle: "short" },
    short: { dateStyle: "short" },
    date_medium: { dateStyle: "medium" },
    medium: { dateStyle: "medium" },
    date_long: { dateStyle: "long" },
    long: { dateStyle: "long" },
    date_full: { dateStyle: "full" },
    full: { dateStyle: "full" },
    
    time: { timeStyle: "short" },
    time_short: { timeStyle: "short" },
    time_medium: { timeStyle: "medium" },
    time_seconds: { timeStyle: "medium" },
    time_long: { timeStyle: "long" },
    
    datetime: { dateStyle: "medium", timeStyle: "short" },
    datetime_short: { dateStyle: "short", timeStyle: "short" },
    datetime_medium: { dateStyle: "medium", timeStyle: "short" },
    datetime_long: { dateStyle: "long", timeStyle: "short" },
    datetime_full: { dateStyle: "full", timeStyle: "medium" },
    
    year: { year: "numeric" },
    year_month: { year: "numeric", month: "long" },
    month: { month: "long" },
    month_short: { month: "short" },
    weekday: { weekday: "long" },
    weekday_short: { weekday: "short" },
    weekday_date: { weekday: "long", year: "numeric", month: "long", day: "numeric" }
};

/**
 * High-performance memoized Intl formatter cache
 */
export class EUIXDateFormatter {
    constructor() {
        this._dateTimeFormatters = new Map();
        this._relativeFormatters = new Map();
        this._maxCache = 256;
    }

    _getDateTimeFormatter(locale, options = {}) {
        const key = `${locale || "default"}|${options.timeZone || "default"}|${JSON.stringify(options)}`;
        let formatter = this._dateTimeFormatters.get(key);
        if (!formatter) {
            if (this._dateTimeFormatters.size >= this._maxCache) {
                const firstKey = this._dateTimeFormatters.keys().next().value;
                this._dateTimeFormatters.delete(firstKey);
            }
            try {
                formatter = new Intl.DateTimeFormat(locale || undefined, options);
            } catch (_) {
                // Fallback to default if invalid locale or timezone
                formatter = new Intl.DateTimeFormat(undefined, { ...options, timeZone: undefined });
            }
            this._dateTimeFormatters.set(key, formatter);
        }
        return formatter;
    }

    _getRelativeFormatter(locale, options = {}) {
        const key = `${locale || "default"}|${JSON.stringify(options)}`;
        let formatter = this._relativeFormatters.get(key);
        if (!formatter) {
            if (this._relativeFormatters.size >= this._maxCache) {
                const firstKey = this._relativeFormatters.keys().next().value;
                this._relativeFormatters.delete(firstKey);
            }
            try {
                formatter = new Intl.RelativeTimeFormat(locale || undefined, options);
            } catch (_) {
                formatter = new Intl.RelativeTimeFormat(undefined, options);
            }
            this._relativeFormatters.set(key, formatter);
        }
        return formatter;
    }

    /**
     * Parses diverse date inputs safely into a native Date object.
     * @param {Date|string|number|null|undefined} value 
     * @returns {Date|null}
     */
    parseDate(value) {
        if (!value && value !== 0) return null;
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }
        if (typeof value === "string") {
            const str = value.trim();
            if (str === "now") return new Date();
            // Numeric timestamp string
            if (/^\d{10,13}$/.test(str)) {
                const num = parseInt(str, 10);
                const d = new Date(num < 1e11 ? num * 1000 : num);
                return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === "number") {
            const d = new Date(value < 1e11 ? value * 1000 : value);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    }

    /**
     * Formats a date using Intl.DateTimeFormat or presets.
     * @param {Date|string|number} value 
     * @param {string|object} optionsOrPreset 
     * @param {string} [locale] 
     * @param {string} [timeZone] 
     * @returns {string}
     */
    format(value, optionsOrPreset = "medium", locale, timeZone) {
        const date = this.parseDate(value);
        if (!date) return "";

        if (optionsOrPreset === "iso") {
            return date.toISOString();
        }
        if (optionsOrPreset === "timestamp") {
            return String(date.getTime());
        }

        let options = {};
        if (typeof optionsOrPreset === "string") {
            options = DATE_PRESETS[optionsOrPreset] || DATE_PRESETS.medium;
        } else if (typeof optionsOrPreset === "object" && optionsOrPreset !== null) {
            options = optionsOrPreset;
        }

        if (timeZone && !options.timeZone) {
            options = { ...options, timeZone };
        }

        try {
            const formatter = this._getDateTimeFormatter(locale, options);
            return formatter.format(date);
        } catch (_) {
            return date.toLocaleString(locale || undefined);
        }
    }

    /**
     * Formats a date relatively (e.g. "3 minutes ago", "dün", "next week").
     * @param {Date|string|number} value 
     * @param {Date|string|number} [baseDate=new Date()] 
     * @param {object} [options={}] 
     * @param {string} [locale] 
     * @returns {string}
     */
    formatRelative(value, baseDate = new Date(), options = {}, locale) {
        const target = this.parseDate(value);
        const base = this.parseDate(baseDate) || new Date();
        if (!target) return "";

        const diffSeconds = Math.round((target.getTime() - base.getTime()) / 1000);
        const absSeconds = Math.abs(diffSeconds);

        let unit = "second";
        let amount = diffSeconds;

        if (absSeconds < 45) {
            unit = "second";
            amount = diffSeconds;
        } else if (absSeconds < 2700) { // < 45 min
            unit = "minute";
            amount = Math.round(diffSeconds / 60);
        } else if (absSeconds < 79200) { // < 22 hours
            unit = "hour";
            amount = Math.round(diffSeconds / 3600);
        } else if (absSeconds < 2160000) { // < 25 days
            unit = "day";
            amount = Math.round(diffSeconds / 86400);
        } else if (absSeconds < 27648000) { // < 320 days
            unit = "month";
            amount = Math.round(diffSeconds / 2592000);
        } else {
            unit = "year";
            amount = Math.round(diffSeconds / 31536000);
        }

        const relOpts = {
            numeric: options.numeric || "auto",
            style: options.style || "long"
        };

        try {
            const formatter = this._getRelativeFormatter(locale, relOpts);
            return formatter.format(amount, unit);
        } catch (_) {
            return target.toLocaleString(locale || undefined);
        }
    }

    /**
     * Formats a date range using Intl.DateTimeFormat.prototype.formatRange.
     * @param {Date|string|number} start 
     * @param {Date|string|number} end 
     * @param {string|object} optionsOrPreset 
     * @param {string} [locale] 
     * @param {string} [timeZone] 
     * @returns {string}
     */
    formatRange(start, end, optionsOrPreset = "medium", locale, timeZone) {
        const startDate = this.parseDate(start);
        const endDate = this.parseDate(end);
        if (!startDate && !endDate) return "";
        if (!startDate) return this.format(endDate, optionsOrPreset, locale, timeZone);
        if (!endDate) return this.format(startDate, optionsOrPreset, locale, timeZone);

        let options = {};
        if (typeof optionsOrPreset === "string") {
            options = DATE_PRESETS[optionsOrPreset] || DATE_PRESETS.medium;
        } else if (typeof optionsOrPreset === "object" && optionsOrPreset !== null) {
            options = optionsOrPreset;
        }

        if (timeZone && !options.timeZone) {
            options = { ...options, timeZone };
        }

        try {
            const formatter = this._getDateTimeFormatter(locale, options);
            if (typeof formatter.formatRange === "function") {
                return formatter.formatRange(startDate, endDate);
            }
            return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
        } catch (_) {
            return `${this.format(startDate, options, locale, timeZone)} – ${this.format(endDate, options, locale, timeZone)}`;
        }
    }

    /**
     * Shifts a date by a given amount of units.
     * @param {Date|string|number} value 
     * @param {number} amount 
     * @param {"seconds"|"minutes"|"hours"|"days"|"weeks"|"months"|"years"} unit 
     * @returns {Date|null}
     */
    add(value, amount = 0, unit = "days") {
        const d = this.parseDate(value);
        if (!d) return null;
        const res = new Date(d.getTime());
        const u = String(unit).toLowerCase().replace(/s$/, "");

        switch (u) {
            case "second": res.setSeconds(res.getSeconds() + amount); break;
            case "minute": res.setMinutes(res.getMinutes() + amount); break;
            case "hour": res.setHours(res.getHours() + amount); break;
            case "day": res.setDate(res.getDate() + amount); break;
            case "week": res.setDate(res.getDate() + (amount * 7)); break;
            case "month": res.setMonth(res.getMonth() + amount); break;
            case "year": res.setFullYear(res.getFullYear() + amount); break;
        }
        return res;
    }

    /**
     * Subtracts given amount of units from date.
     * @param {Date|string|number} value
     * @param {number} amount
     * @param {"seconds"|"minutes"|"hours"|"days"|"weeks"|"months"|"years"} unit
     * @returns {Date|null}
     */
    subtract(value, amount = 1, unit = "days") {
        return this.add(value, -amount, unit);
    }

    sub(value, amount = 1, unit = "days") {
        return this.add(value, -amount, unit);
    }

    /**
     * Calculates difference between two dates in requested units.
     * @param {Date|string|number} start 
     * @param {Date|string|number} end 
     * @param {"seconds"|"minutes"|"hours"|"days"|"weeks"|"months"|"years"} unit 
     * @returns {number}
     */
    diff(start, end, unit = "days") {
        const d1 = this.parseDate(start);
        const d2 = this.parseDate(end);
        if (!d1 || !d2) return 0;

        const msDiff = d2.getTime() - d1.getTime();
        const u = String(unit).toLowerCase().replace(/s$/, "");

        switch (u) {
            case "second": return Math.round(msDiff / 1000);
            case "minute": return Math.round(msDiff / 60000);
            case "hour": return Math.round(msDiff / 3600000);
            case "day": return Math.round(msDiff / 86400000);
            case "week": return Math.round(msDiff / 604800000);
            case "month": return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
            case "year": return d2.getFullYear() - d1.getFullYear();
            default: return msDiff;
        }
    }

    /**
     * Truncates date to start of given unit.
     */
    startOf(value, unit = "day") {
        const d = this.parseDate(value);
        if (!d) return null;
        const res = new Date(d.getTime());
        const u = String(unit).toLowerCase().replace(/s$/, "");

        switch (u) {
            case "year":
                res.setMonth(0, 1);
                res.setHours(0, 0, 0, 0);
                break;
            case "month":
                res.setDate(1);
                res.setHours(0, 0, 0, 0);
                break;
            case "week": {
                const day = res.getDay();
                const diff = (day === 0 ? -6 : 1) - day;
                res.setDate(res.getDate() + diff);
                res.setHours(0, 0, 0, 0);
                break;
            }
            case "day":
                res.setHours(0, 0, 0, 0);
                break;
            case "hour":
                res.setMinutes(0, 0, 0);
                break;
            case "minute":
                res.setSeconds(0, 0);
                break;
        }
        return res;
    }

    /**
     * Sets date to end of given unit.
     */
    endOf(value, unit = "day") {
        const d = this.parseDate(value);
        if (!d) return null;
        const res = new Date(d.getTime());
        const u = String(unit).toLowerCase().replace(/s$/, "");

        switch (u) {
            case "year":
                res.setMonth(11, 31);
                res.setHours(23, 59, 59, 999);
                break;
            case "month": {
                res.setMonth(res.getMonth() + 1, 0);
                res.setHours(23, 59, 59, 999);
                break;
            }
            case "week": {
                const day = res.getDay();
                const diff = (day === 0 ? 0 : 7) - day;
                res.setDate(res.getDate() + diff);
                res.setHours(23, 59, 59, 999);
                break;
            }
            case "day":
                res.setHours(23, 59, 59, 999);
                break;
            case "hour":
                res.setMinutes(59, 59, 999);
                break;
            case "minute":
                res.setSeconds(59, 999);
                break;
        }
        return res;
    }

    /**
     * Returns total number of days in the month of the given date.
     * @param {Date|string|number} value
     * @param {number} [month] Optional 0-indexed month when value is year
     * @returns {number}
     */
    daysInMonth(value, month = null) {
        if (typeof value === "number" && value >= 1000 && value <= 9999 && typeof month === "number") {
            return new Date(value, month + 1, 0).getDate();
        }
        const d = this.parseDate(value);
        if (!d) return 0;
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    /**
     * Checks if year is a leap year.
     * @param {Date|string|number} value
     * @returns {boolean}
     */
    isLeapYear(value) {
        if (typeof value === "number" && value >= 1000 && value <= 9999) {
            return (value % 4 === 0 && value % 100 !== 0) || (value % 400 === 0);
        }
        const d = this.parseDate(value);
        if (!d) return false;
        const year = d.getFullYear();
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Checks if two dates fall into the same unit (year, month, week, day, hour, etc.).
     * @param {Date|string|number} start
     * @param {Date|string|number} end
     * @param {string} unit
     * @returns {boolean}
     */
    isSame(start, end, unit = "day") {
        const s = this.startOf(start, unit);
        const e = this.startOf(end, unit);
        if (!s || !e) return false;
        return s.getTime() === e.getTime();
    }

    /**
     * Checks if start date is strictly before end date.
     * @param {Date|string|number} start
     * @param {Date|string|number} end
     * @param {string|null} unit
     * @returns {boolean}
     */
    isBefore(start, end, unit = null) {
        const d1 = unit ? this.startOf(start, unit) : this.parseDate(start);
        const d2 = unit ? this.startOf(end, unit) : this.parseDate(end);
        if (!d1 || !d2) return false;
        return d1.getTime() < d2.getTime();
    }

    /**
     * Checks if start date is strictly after end date.
     * @param {Date|string|number} start
     * @param {Date|string|number} end
     * @param {string|null} unit
     * @returns {boolean}
     */
    isAfter(start, end, unit = null) {
        const d1 = unit ? this.startOf(start, unit) : this.parseDate(start);
        const d2 = unit ? this.startOf(end, unit) : this.parseDate(end);
        if (!d1 || !d2) return false;
        return d1.getTime() > d2.getTime();
    }

    /**
     * Checks if target date is between start and end.
     * @param {Date|string|number} target
     * @param {Date|string|number} start
     * @param {Date|string|number} end
     * @param {"()"|"[)"|"(]"|"[]"} inclusivity
     * @returns {boolean}
     */
    isBetween(target, start, end, inclusivity = "()") {
        const t = this.parseDate(target);
        const s = this.parseDate(start);
        const e = this.parseDate(end);
        if (!t || !s || !e) return false;
        const tMs = t.getTime();
        const sMs = s.getTime();
        const eMs = e.getTime();
        const startInclusive = inclusivity[0] === "[";
        const endInclusive = inclusivity[1] === "]";
        return (startInclusive ? tMs >= sMs : tMs > sMs) && (endInclusive ? tMs <= eMs : tMs < eMs);
    }

    /**
     * Checks if date is today.
     * @param {Date|string|number} value
     * @returns {boolean}
     */
    isToday(value) {
        return this.isSame(value, new Date(), "day");
    }

    /**
     * Checks if date is tomorrow.
     * @param {Date|string|number} value
     * @returns {boolean}
     */
    isTomorrow(value) {
        const tomorrow = this.add(new Date(), 1, "day");
        return this.isSame(value, tomorrow, "day");
    }

    /**
     * Checks if date is yesterday.
     * @param {Date|string|number} value
     * @returns {boolean}
     */
    isYesterday(value) {
        const yesterday = this.add(new Date(), -1, "day");
        return this.isSame(value, yesterday, "day");
    }

    /**
     * Returns quarter of the year (1..4).
     * @param {Date|string|number} value
     * @returns {number}
     */
    quarter(value) {
        const d = this.parseDate(value);
        if (!d) return 1;
        return Math.floor(d.getMonth() / 3) + 1;
    }

    /**
     * Returns ISO week number of the year (1..53).
     * @param {Date|string|number} value
     * @returns {number}
     */
    weekOfYear(value) {
        const d = this.parseDate(value);
        if (!d) return 1;
        const target = new Date(d.valueOf());
        const dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target) / 604800000);
    }

    /**
     * Returns tokenized Intl parts (using Intl.DateTimeFormat.prototype.formatToParts).
     * @param {Date|string|number} value
     * @param {string|Intl.DateTimeFormatOptions} optionsOrPreset
     * @param {string} [locale]
     * @param {string} [timeZone]
     * @returns {Array<{type: string, value: string}>}
     */
    formatToParts(value, optionsOrPreset = "medium", locale = null, timeZone = null) {
        const d = this.parseDate(value);
        if (!d) return [];

        const loc = locale || (typeof navigator !== "undefined" ? navigator.language : "en-US");
        const tz = timeZone || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
        const options = typeof optionsOrPreset === "string" 
            ? (DATE_PRESETS[optionsOrPreset] || { dateStyle: "medium" })
            : (optionsOrPreset || {});

        const mergedOptions = { ...options };
        if (tz && !mergedOptions.timeZone) mergedOptions.timeZone = tz;

        try {
            const formatter = this._getDateTimeFormatter(loc, mergedOptions);
            return formatter.formatToParts(d);
        } catch (_) {
            return [{ type: "literal", value: this.format(d, optionsOrPreset, loc, tz) }];
        }
    }
}

/**
 * Singleton Date Formatter Instance
 */
export const defaultDateFormatter = new EUIXDateFormatter();

/**
 * EUIXDatePlugin Plugin Object
 */
export const EUIXDatePlugin = {
    name: "date",
    formatter: defaultDateFormatter,

    install(engineClass) {
        const proto = engineClass.prototype;

        // Global default config
        proto._defaultDateLocale = typeof navigator !== "undefined" ? (navigator.language || "en-US") : "en-US";
        proto._defaultDateTimeZone = (() => {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
            } catch (_) {
                return "UTC";
            }
        })();
        proto._defaultDateFormat = "medium";
        proto._dateFormatter = defaultDateFormatter;

        /**
         * 1. Tag Processor for <date_config>
         */
        proto._processDateConfigTag = function(xmlNode) {
            if (!xmlNode) return;
            const locale = xmlNode.getAttribute("locale") || xmlNode.getAttribute("lang");
            const timezone = xmlNode.getAttribute("timezone") || xmlNode.getAttribute("timeZone");
            const defaultFormat = xmlNode.getAttribute("default_format") || xmlNode.getAttribute("format");

            if (locale) this._defaultDateLocale = this.interpolate(locale);
            if (timezone) this._defaultDateTimeZone = this.interpolate(timezone);
            if (defaultFormat) this._defaultDateFormat = this.interpolate(defaultFormat);

            this._syncDateContext();
        };

        /**
         * 2. Programmatic Date Config API
         */
        proto.setDateConfig = function({ locale, timeZone, timezone, defaultFormat } = {}) {
            if (locale) this._defaultDateLocale = locale;
            if (timezone || timeZone) this._defaultDateTimeZone = timezone || timeZone;
            if (defaultFormat) this._defaultDateFormat = defaultFormat;
            this._syncDateContext();
            return this;
        };

        proto.getDateConfig = function() {
            return {
                locale: this._defaultDateLocale,
                timeZone: this._defaultDateTimeZone,
                defaultFormat: this._defaultDateFormat
            };
        };

        proto._syncDateContext = function() {
            const config = this.getDateConfig();
            const self = this;

            const helper = {
                locale: config.locale,
                timeZone: config.timeZone,
                defaultFormat: config.defaultFormat,
                now: () => new Date().toISOString(),
                parse: (v) => self._dateFormatter.parseDate(v),
                format: (v, opt = config.defaultFormat, loc = config.locale, tz = config.timeZone) => 
                    self._dateFormatter.format(v, opt, loc, tz),
                formatToParts: (v, opt = config.defaultFormat, loc = config.locale, tz = config.timeZone) => 
                    self._dateFormatter.formatToParts(v, opt, loc, tz),
                relative: (v, opt = {}, loc = config.locale) => 
                    self._dateFormatter.formatRelative(v, new Date(), typeof opt === "string" ? { style: opt } : opt, loc),
                fromNow: (v, loc = config.locale) => 
                    self._dateFormatter.formatRelative(v, new Date(), {}, loc),
                formatRelative: (v, base = new Date(), opt = {}, loc = config.locale) => 
                    self._dateFormatter.formatRelative(v, base, typeof opt === "string" ? { style: opt } : opt, loc),
                range: (s, e, opt = config.defaultFormat, loc = config.locale, tz = config.timeZone) => 
                    self._dateFormatter.formatRange(s, e, opt, loc, tz),
                add: (v, amt, unit) => self._dateFormatter.add(v, amt, unit),
                subtract: (v, amt, unit) => self._dateFormatter.add(v, -amt, unit),
                sub: (v, amt, unit) => self._dateFormatter.add(v, -amt, unit),
                diff: (s, e, unit) => self._dateFormatter.diff(s, e, unit),
                startOf: (v, unit) => self._dateFormatter.startOf(v, unit),
                endOf: (v, unit) => self._dateFormatter.endOf(v, unit),
                daysInMonth: (v) => self._dateFormatter.daysInMonth(v),
                isLeapYear: (v) => self._dateFormatter.isLeapYear(v),
                isSame: (s, e, u) => self._dateFormatter.isSame(s, e, u),
                isBefore: (s, e, u) => self._dateFormatter.isBefore(s, e, u),
                isAfter: (s, e, u) => self._dateFormatter.isAfter(s, e, u),
                isBetween: (t, s, e, inc) => self._dateFormatter.isBetween(t, s, e, inc),
                isToday: (v) => self._dateFormatter.isToday(v),
                isTomorrow: (v) => self._dateFormatter.isTomorrow(v),
                isYesterday: (v) => self._dateFormatter.isYesterday(v),
                quarter: (v) => self._dateFormatter.quarter(v),
                weekOfYear: (v) => self._dateFormatter.weekOfYear(v)
            };

            this.$date = helper;
            this.date = helper;
            this.setState("$date", helper);
            this.setState("date", helper);
        };

        // Hook initDataModel to pre-process <date_config> and initialize $date helper
        const originalInitDataModel = proto.initDataModel;
        if (typeof originalInitDataModel === "function") {
            proto.initDataModel = function(doc, isMainDoc) {
                const res = originalInitDataModel.call(this, doc, isMainDoc);
                const targetDoc = doc || this.xmlDoc;
                if (targetDoc) {
                    const cfgTag = targetDoc.querySelector ? targetDoc.querySelector("date_config, date-config") : 
                                   (targetDoc.getElementsByTagName ? (targetDoc.getElementsByTagName("date_config")[0] || targetDoc.getElementsByTagName("date-config")[0]) : null);
                    if (cfgTag) {
                        this._processDateConfigTag(cfgTag);
                    }
                }
                this._syncDateContext();
                return res;
            };
        }

        /**
         * 3. XML Custom Component: <date>, <time>, <relative_time>, <date_range>
         */
        const renderDateElement = function(xmlNode, context, forceRelative = false) {
            if (typeof document === "undefined") return null;

            const asTag = xmlNode.getAttribute("as") || (xmlNode.tagName.toLowerCase() === "time" ? "time" : "span");
            const el = document.createElement(asTag);
            const baseClass = xmlNode.getAttribute("class") || "";
            if (baseClass) el.className = baseClass;

            const idAttr = xmlNode.getAttribute("id");
            if (idAttr) el.id = this.interpolate(idAttr, context);

            const styleAttr = xmlNode.getAttribute("style");
            if (styleAttr) el.style.cssText = this.interpolate(styleAttr, context);

            Array.from(xmlNode.attributes || []).forEach(attr => {
                if (attr.name.startsWith("data-") || attr.name.startsWith("aria-")) {
                    el.setAttribute(attr.name, this.interpolate(attr.value, context));
                }
            });

            const rawVal = xmlNode.getAttribute("value") || xmlNode.getAttribute("date") || xmlNode.getAttribute("timestamp") || xmlNode.textContent.trim() || "";
            const rawFormat = xmlNode.getAttribute("format") || xmlNode.getAttribute("preset") || "";
            const rawLocale = xmlNode.getAttribute("locale") || xmlNode.getAttribute("lang") || "";
            const rawTimeZone = xmlNode.getAttribute("timezone") || xmlNode.getAttribute("timeZone") || "";
            const fallback = xmlNode.getAttribute("fallback") || "";
            const isRelative = forceRelative || xmlNode.getAttribute("relative") === "true" || rawFormat === "relative";
            const isLive = xmlNode.getAttribute("live") === "true";
            const intervalMs = parseInt(xmlNode.getAttribute("interval") || "60000", 10);

            // Custom Intl options from individual attributes
            const customOptions = {};
            ["dateStyle", "timeStyle", "year", "month", "day", "weekday", "hour", "minute", "second", "timeZoneName"].forEach(k => {
                const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                const attrVal = xmlNode.getAttribute(k) || xmlNode.getAttribute(snake);
                if (attrVal) customOptions[k] = attrVal;
            });

            if (xmlNode.hasAttribute("hour12")) {
                customOptions.hour12 = xmlNode.getAttribute("hour12") === "true";
            }

            let activeTimer = null;

            const updateContent = () => {
                const evaluatedVal = this.interpolate(rawVal, context);
                const locale = rawLocale ? this.interpolate(rawLocale, context) : this._defaultDateLocale;
                const timeZone = rawTimeZone ? this.interpolate(rawTimeZone, context) : this._defaultDateTimeZone;
                const format = rawFormat ? this.interpolate(rawFormat, context) : this._defaultDateFormat;

                if (!evaluatedVal) {
                    el.textContent = fallback;
                    return;
                }

                const parsed = this._dateFormatter.parseDate(evaluatedVal);
                if (!parsed) {
                    el.textContent = fallback || String(evaluatedVal);
                    return;
                }

                // Set datetime attribute for <time> tags (accessibility & HTML5 standard)
                if (el.tagName.toLowerCase() === "time" || el.hasAttribute("datetime")) {
                    el.setAttribute("datetime", parsed.toISOString());
                }

                if (isRelative) {
                    const relOpts = {
                        numeric: xmlNode.getAttribute("numeric") || "auto",
                        style: xmlNode.getAttribute("relative_style") || xmlNode.getAttribute("style") || "long"
                    };
                    el.textContent = this._dateFormatter.formatRelative(parsed, new Date(), relOpts, locale);
                } else {
                    const opts = Object.keys(customOptions).length > 0 ? { ...customOptions, timeZone } : (DATE_PRESETS[format] || { dateStyle: "medium" });
                    el.textContent = this._dateFormatter.format(parsed, opts, locale, timeZone);
                }
            };

            // Initial evaluation
            updateContent();

            // Reactive dependencies
            const exprs = [rawVal, rawFormat, rawLocale, rawTimeZone].filter(Boolean);
            exprs.forEach(tpl => {
                const placeholders = (tpl.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1).trim());
                placeholders.forEach(expr => {
                    const cleanKey = expr.replace(/^(?:parent\.)?data\./, "").split(".")[0];
                    if (cleanKey) {
                        this.registerBinding(cleanKey, el, "custom", () => updateContent());
                    }
                });
            });

            // Live updates for relative timestamps
            if (isLive && intervalMs > 0) {
                activeTimer = setInterval(() => {
                    if (el && el.isConnected) {
                        updateContent();
                    } else if (activeTimer) {
                        clearInterval(activeTimer);
                        activeTimer = null;
                    }
                }, intervalMs);

                if (typeof this.onUnmount === "function") {
                    this.onUnmount(() => {
                        if (activeTimer) {
                            clearInterval(activeTimer);
                            activeTimer = null;
                        }
                    });
                }
            }

            return el;
        };

        engineClass.registerComponent("date", function(xmlNode, context) {
            return renderDateElement.call(this, xmlNode, context, false);
        });

        engineClass.registerComponent("time", function(xmlNode, context) {
            return renderDateElement.call(this, xmlNode, context, false);
        });

        engineClass.registerComponent("relative_time", function(xmlNode, context) {
            return renderDateElement.call(this, xmlNode, context, true);
        });

        engineClass.registerComponent("relative-time", function(xmlNode, context) {
            return renderDateElement.call(this, xmlNode, context, true);
        });

        // <date_range> / <date-range>
        const renderDateRangeElement = function(xmlNode, context) {
            if (typeof document === "undefined") return null;

            const asTag = xmlNode.getAttribute("as") || "span";
            const el = document.createElement(asTag);
            const baseClass = xmlNode.getAttribute("class") || "";
            if (baseClass) el.className = baseClass;

            const idAttr = xmlNode.getAttribute("id");
            if (idAttr) el.id = this.interpolate(idAttr, context);

            const styleAttr = xmlNode.getAttribute("style");
            if (styleAttr) el.style.cssText = this.interpolate(styleAttr, context);

            Array.from(xmlNode.attributes || []).forEach(attr => {
                if (attr.name.startsWith("data-") || attr.name.startsWith("aria-")) {
                    el.setAttribute(attr.name, this.interpolate(attr.value, context));
                }
            });

            const rawStart = xmlNode.getAttribute("start") || xmlNode.getAttribute("from") || "";
            const rawEnd = xmlNode.getAttribute("end") || xmlNode.getAttribute("to") || "";
            const rawFormat = xmlNode.getAttribute("format") || xmlNode.getAttribute("preset") || "";
            const rawLocale = xmlNode.getAttribute("locale") || xmlNode.getAttribute("lang") || "";
            const rawTimeZone = xmlNode.getAttribute("timezone") || xmlNode.getAttribute("timeZone") || "";
            const fallback = xmlNode.getAttribute("fallback") || "";

            const updateRange = () => {
                const startVal = this.interpolate(rawStart, context);
                const endVal = this.interpolate(rawEnd, context);
                const locale = rawLocale ? this.interpolate(rawLocale, context) : this._defaultDateLocale;
                const timeZone = rawTimeZone ? this.interpolate(rawTimeZone, context) : this._defaultDateTimeZone;
                const format = rawFormat ? this.interpolate(rawFormat, context) : this._defaultDateFormat;

                if (!startVal && !endVal) {
                    el.textContent = fallback;
                    return;
                }

                el.textContent = this._dateFormatter.formatRange(startVal, endVal, format, locale, timeZone) || fallback;
            };

            updateRange();

            const exprs = [rawStart, rawEnd, rawFormat, rawLocale, rawTimeZone].filter(Boolean);
            exprs.forEach(tpl => {
                const placeholders = (tpl.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1).trim());
                placeholders.forEach(expr => {
                    const cleanKey = expr.replace(/^(?:parent\.)?data\./, "").split(".")[0];
                    if (cleanKey) {
                        this.registerBinding(cleanKey, el, "custom", () => updateRange());
                    }
                });
            });

            return el;
        };

        engineClass.registerComponent("date_range", renderDateRangeElement);
        engineClass.registerComponent("date-range", renderDateRangeElement);

        /**
         * 4. Declarative Event Actions
         */
        // Action: SET_DATE_LOCALE
        engineClass.registerAction("SET_DATE_LOCALE", function(actionNode, context) {
            const locRaw = actionNode.getAttribute("locale") || actionNode.getAttribute("value") || "";
            const locNode = this.getChild(actionNode, "locale") || this.getChild(actionNode, "value");
            const locale = locNode ? this.interpolate(locNode.textContent, context) : this.interpolate(locRaw, context);

            if (locale) {
                this._defaultDateLocale = locale;
                this._syncDateContext();
            }
            return true;
        });

        // Action: SET_DATE_TIMEZONE
        engineClass.registerAction("SET_DATE_TIMEZONE", function(actionNode, context) {
            const tzRaw = actionNode.getAttribute("timezone") || actionNode.getAttribute("timeZone") || actionNode.getAttribute("value") || "";
            const tzNode = this.getChild(actionNode, "timezone") || this.getChild(actionNode, "timeZone") || this.getChild(actionNode, "value");
            const timezone = tzNode ? this.interpolate(tzNode.textContent, context) : this.interpolate(tzRaw, context);

            if (timezone) {
                this._defaultDateTimeZone = timezone;
                this._syncDateContext();
            }
            return true;
        });

        // Action: FORMAT_DATE
        engineClass.registerAction("FORMAT_DATE", function(actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "";
            const valRaw = actionNode.getAttribute("value") || "";
            const formatRaw = actionNode.getAttribute("format") || "medium";
            const locRaw = actionNode.getAttribute("locale") || "";
            const tzRaw = actionNode.getAttribute("timezone") || "";

            const val = this.interpolate(valRaw, context);
            const format = this.interpolate(formatRaw, context);
            const locale = locRaw ? this.interpolate(locRaw, context) : this._defaultDateLocale;
            const timeZone = tzRaw ? this.interpolate(tzRaw, context) : this._defaultDateTimeZone;

            const formatted = this._dateFormatter.format(val, format, locale, timeZone);
            if (targetPath) {
                this.setState(targetPath, formatted);
            }
            return formatted;
        });

        // Action: CALCULATE_DATE_DIFF
        engineClass.registerAction("CALCULATE_DATE_DIFF", function(actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "";
            const startRaw = actionNode.getAttribute("start") || "";
            const endRaw = actionNode.getAttribute("end") || "";
            const unit = actionNode.getAttribute("unit") || "days";

            const start = this.interpolate(startRaw, context);
            const end = this.interpolate(endRaw, context);

            const diff = this._dateFormatter.diff(start, end, unit);
            if (targetPath) {
                this.setState(targetPath, diff);
            }
            return diff;
        });
    }
};

export default EUIXDatePlugin;
