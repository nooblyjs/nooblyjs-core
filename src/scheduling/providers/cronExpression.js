/**
 * @fileoverview Minimal standard 5-field CRON expression parser and matcher.
 * Supports the standard POSIX cron syntax used by most schedulers:
 *
 *   ┌──── minute        (0 - 59)
 *   │ ┌── hour          (0 - 23)
 *   │ │ ┌─ day of month (1 - 31)
 *   │ │ │ ┌── month     (1 - 12)
 *   │ │ │ │ ┌── day of week (0 - 6, Sunday = 0)
 *   │ │ │ │ │
 *   * * * * *
 *
 * Each field supports:
 *   - `*`            wildcard (any value)
 *   - `n`            specific value
 *   - `n-m`          inclusive range
 *   - `n,m,p`        list of values
 *   - `* / n`        step (every Nth value across range)
 *   - `n-m/k`        stepped range
 *
 * Named months / weekdays are NOT supported (numeric only).
 * The day-of-month and day-of-week fields use cron's OR semantics: if both
 * are restricted (i.e. neither is `*`), the cron fires when EITHER matches,
 * matching the behaviour of Vixie cron.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.15
 */

'use strict';

/** @const {!Array<{name: string, min: number, max: number}>} */
const FIELDS = [
  { name: 'minute',     min: 0, max: 59 },
  { name: 'hour',       min: 0, max: 23 },
  { name: 'dayOfMonth', min: 1, max: 31 },
  { name: 'month',      min: 1, max: 12 },
  { name: 'dayOfWeek',  min: 0, max: 6  }
];

/**
 * Parses a single cron field token (e.g. `*`, `5`, `1-10`, `* / 5`, `2-30/2`)
 * into a Set of integer values it matches.
 *
 * @param {string} token The raw field token from the cron expression.
 * @param {number} min The minimum allowed value for this field.
 * @param {number} max The maximum allowed value for this field.
 * @return {!Set<number>} A set of integer values that match this field.
 * @throws {Error} If the token is malformed or out of range.
 */
function parseField(token, min, max) {
  const result = new Set();
  const parts = token.split(',');

  for (const part of parts) {
    let stepStr = null;
    let rangeStr = part;

    if (part.includes('/')) {
      const split = part.split('/');
      if (split.length !== 2) {
        throw new Error(`Invalid step expression: "${part}"`);
      }
      rangeStr = split[0];
      stepStr = split[1];
    }

    const step = stepStr === null ? 1 : Number(stepStr);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid step value: "${stepStr}"`);
    }

    let start;
    let end;

    if (rangeStr === '*') {
      start = min;
      end = max;
    } else if (rangeStr.includes('-')) {
      const [s, e] = rangeStr.split('-').map(Number);
      if (!Number.isInteger(s) || !Number.isInteger(e)) {
        throw new Error(`Invalid range: "${rangeStr}"`);
      }
      start = s;
      end = e;
    } else {
      const value = Number(rangeStr);
      if (!Number.isInteger(value)) {
        throw new Error(`Invalid value: "${rangeStr}"`);
      }
      start = value;
      // If a step was supplied with a single value (e.g. `5/10`), treat it as
      // "starting at value, step through to max" — this matches common cron
      // implementations.
      end = stepStr === null ? value : max;
    }

    if (start < min || end > max || start > end) {
      throw new Error(
        `Value out of range for field (${min}-${max}): "${rangeStr}"`
      );
    }

    for (let v = start; v <= end; v += step) {
      result.add(v);
    }
  }

  return result;
}

/**
 * Parses a complete 5-field cron expression into per-field value sets.
 *
 * @param {string} expression A standard 5-field cron expression.
 * @return {{
 *   minute: !Set<number>,
 *   hour: !Set<number>,
 *   dayOfMonth: !Set<number>,
 *   month: !Set<number>,
 *   dayOfWeek: !Set<number>,
 *   raw: string,
 *   dayOfMonthRestricted: boolean,
 *   dayOfWeekRestricted: boolean
 * }} The parsed cron descriptor.
 * @throws {Error} If the expression is malformed.
 *
 * @example
 * const cron = parseCron('0 9 * * 1-5');  // Weekdays at 9am
 */
function parseCron(expression) {
  if (typeof expression !== 'string' || expression.trim() === '') {
    throw new Error('Cron expression must be a non-empty string');
  }

  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5) {
    throw new Error(
      `Cron expression must have exactly 5 fields, got ${tokens.length}: "${expression}"`
    );
  }

  const parsed = {
    raw: expression.trim(),
    dayOfMonthRestricted: tokens[2] !== '*',
    dayOfWeekRestricted: tokens[4] !== '*'
  };

  for (let i = 0; i < FIELDS.length; i++) {
    const field = FIELDS[i];
    try {
      parsed[field.name] = parseField(tokens[i], field.min, field.max);
    } catch (err) {
      throw new Error(
        `Invalid ${field.name} field "${tokens[i]}": ${err.message}`
      );
    }
  }

  return parsed;
}

/**
 * Returns true if the given Date matches the parsed cron expression.
 * Comparison is at minute resolution; seconds and milliseconds are ignored.
 *
 * @param {!Object} parsed A cron descriptor returned from {@link parseCron}.
 * @param {!Date} date The date to test.
 * @return {boolean} True if the date matches the cron expression.
 */
function matches(parsed, date) {
  if (!parsed.minute.has(date.getMinutes())) return false;
  if (!parsed.hour.has(date.getHours())) return false;
  if (!parsed.month.has(date.getMonth() + 1)) return false;

  const domMatches = parsed.dayOfMonth.has(date.getDate());
  const dowMatches = parsed.dayOfWeek.has(date.getDay());

  // Vixie cron OR semantics: when both day fields are restricted, fire if
  // either matches. When only one is restricted, that one must match.
  if (parsed.dayOfMonthRestricted && parsed.dayOfWeekRestricted) {
    if (!domMatches && !dowMatches) return false;
  } else if (parsed.dayOfMonthRestricted) {
    if (!domMatches) return false;
  } else if (parsed.dayOfWeekRestricted) {
    if (!dowMatches) return false;
  }

  return true;
}

/**
 * Validates a cron expression and returns true if it parses cleanly.
 *
 * @param {string} expression The cron expression to validate.
 * @return {boolean} True if valid.
 */
function isValid(expression) {
  try {
    parseCron(expression);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { parseCron, matches, isValid };
