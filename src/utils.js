const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getCurrentDayName() {
  return DAY_NAMES[new Date().getDay()];
}

export function getDayNames() {
  return DAY_NAMES;
}

export function getDayShortNames() {
  return DAY_SHORT;
}

/**
 * Parse a time string like "15:00" or "3:00" into minutes since midnight.
 * Handles both 24h and 12h formats (no AM/PM — we infer from context).
 */
export function parseTime(timeStr) {
  const trimmed = timeStr.trim();
  const parts = trimmed.split(':');
  if (parts.length !== 2) return null;

  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

/**
 * Parse a time range string like "15:00-18:00" into {start, end} in minutes.
 * Handles midnight-crossing ranges (e.g., "21:30-0:00" or "22:00-3:00").
 * The `is24h` parameter indicates whether the row uses 24h format.
 * If false, ambiguous times (1:00-11:59) are shifted to PM.
 */
export function parseTimeRange(rangeStr, is24h = true) {
  const parts = rangeStr.split('-');
  if (parts.length !== 2) return null;

  let start = parseTime(parts[0]);
  let end = parseTime(parts[1]);

  if (start === null || end === null) return null;

  if (!is24h) {
    const startHour = Math.floor(start / 60);
    const endHour = Math.floor(end / 60);

    // Shift ambiguous times to PM
    if (startHour >= 1 && startHour <= 11) {
      start += 12 * 60;
    }
    if (endHour >= 1 && endHour <= 11) {
      end += 12 * 60;
    }
    // 0:XX stays as midnight, 12:XX stays as noon
  }

  return { start, end };
}

/**
 * Normalize a time range string to 24h format.
 * Returns the normalized string (e.g., "3:00-7:00" → "15:00-19:00").
 */
export function normalizeTimeRange(rangeStr, is24h) {
  const range = parseTimeRange(rangeStr, is24h);
  if (!range) return rangeStr;

  const startH = Math.floor(range.start / 60);
  const startM = range.start % 60;
  const endH = Math.floor(range.end / 60);
  const endM = range.end % 60;

  return `${startH}:${startM.toString().padStart(2, '0')}-${endH}:${endM.toString().padStart(2, '0')}`;
}

/**
 * Detect if a set of time range strings uses 24h format.
 * If any time has an hour >= 13, the whole set is 24h.
 */
export function detectIs24h(timeRanges) {
  for (const rangeStr of timeRanges) {
    const parts = rangeStr.split('-');
    for (const part of parts) {
      const hours = parseInt(part.trim().split(':')[0], 10);
      if (hours >= 13) return true;
    }
  }
  return false;
}

/**
 * Check if the current time falls within a time range.
 * Handles midnight-crossing (end < start means it wraps past midnight).
 */
export function isTimeInRange(currentMinutes, range) {
  if (range.end > range.start) {
    // Normal range: e.g., 15:00-18:00
    return currentMinutes >= range.start && currentMinutes < range.end;
  } else if (range.end < range.start) {
    // Midnight-crossing: e.g., 21:30-0:30 means 21:30 to next day 0:30
    return currentMinutes >= range.start || currentMinutes < range.end;
  } else {
    // start === end, treat as inactive
    return false;
  }
}

/**
 * Check if a promotion is currently active given its hours object.
 * hours: { Monday: ["15:00-18:00"], Tuesday: ["15:00-18:00", "21:30-0:00"], ... }
 */
export function isPromotionActive(hours) {
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return isPromotionActiveForDayTime(hours, dayName, currentMinutes);
}

/**
 * Check if a promotion is active for a specific day and time.
 */
export function isPromotionActiveForDayTime(hours, dayName, currentMinutes) {
  const dayHours = hours[dayName];
  if (!dayHours || dayHours.length === 0) return false;

  for (const rangeStr of dayHours) {
    const range = parseTimeRange(rangeStr);
    if (range && isTimeInRange(currentMinutes, range)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a promotion has any hours on a given day.
 */
export function hasHoursOnDay(hours, dayName) {
  const dayHours = hours[dayName];
  return dayHours && dayHours.length > 0;
}

/**
 * Get which days a promotion has hours.
 */
export function getActiveDays(hours) {
  return DAY_NAMES.filter(day => hasHoursOnDay(hours, day));
}

/**
 * Check if a promotion has weekend hours (Saturday or Sunday).
 */
export function hasWeekendHours(hours) {
  return hasHoursOnDay(hours, 'Saturday') || hasHoursOnDay(hours, 'Sunday');
}

/**
 * Format minutes since midnight to a display string like "3:00 PM".
 */
export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format minutes since midnight to a display string like "3:00" (no AM/PM).
 */
export function formatTimeNoPeriod(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format a time range string "15:00-18:00" into "3:00 PM - 6:00 PM".
 */
export function formatTimeRange(rangeStr) {
  const range = parseTimeRange(rangeStr);
  if (!range) return rangeStr;
  return `${formatTime(range.start)} - ${formatTime(range.end)}`;
}

/**
 * Get current time as a formatted string.
 */
export function getCurrentTimeFormatted() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
