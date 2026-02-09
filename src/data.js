import { isPromotionActive, hasWeekendHours, getActiveDays, detectIs24h, normalizeTimeRange } from './utils.js?v=13';

const DAY_COLUMNS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PROMO_DESCRIPTION_COLUMNS = [
  'Promo Description',
  'Promotion Description',
  'Running Promo Description',
  'Promo Details',
  'Description'
];

// Missing coordinates looked up from venue addresses
const MISSING_COORDS = {
  'Amigos Birria Tacos': { lat: 33.9870, lng: -118.4727 },
  'Moto Azabu': { lat: 33.9803, lng: -118.4520 },
  'Venice Beach Club': { lat: 33.9940, lng: -118.4810 }
};

/**
 * Parse menu field — a URL or plain text description.
 */
function parseMenuField(menuStr) {
  if (!menuStr || !menuStr.trim()) {
    return { menuUrl: null, menuDescription: '' };
  }

  const trimmed = menuStr.trim();

  // Check if it's a URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { menuUrl: trimmed, menuDescription: '' };
  }

  // Otherwise it's a description
  return { menuUrl: null, menuDescription: trimmed };
}

function getPromoDescription(row, venueDescription) {
  for (const col of PROMO_DESCRIPTION_COLUMNS) {
    const val = (row[col] || '').trim();
    if (val) {
      if (venueDescription && val === venueDescription) return '';
      return val;
    }
  }
  return '';
}

/**
 * Parse hours from CSV row day columns into an hours object.
 * Detects 12h vs 24h format at the row level and normalizes to 24h.
 */
function parseRowHours(row) {
  // First pass: collect all time range strings from this row
  const allRanges = [];
  const rawHours = {};

  for (const day of DAY_COLUMNS) {
    const val = (row[day] || '').trim();
    if (val) {
      const ranges = val.split(',').map(r => r.trim()).filter(Boolean);
      rawHours[day] = ranges;
      allRanges.push(...ranges);
    }
  }

  if (allRanges.length === 0) return {};

  // All promo windows are in 24h (military) format
  const is24h = true;

  // Normalize all ranges to 24h format
  const hours = {};
  for (const [day, ranges] of Object.entries(rawHours)) {
    hours[day] = ranges.map(r => is24h ? r : normalizeTimeRange(r, false));
  }

  return hours;
}

/**
 * Check if an hours object has any time entries at all.
 */
function hasAnyHours(hours) {
  return Object.values(hours).some(arr => arr && arr.length > 0);
}

/**
 * Parse the published Google Sheets CSV into venue objects.
 * Uses PapaParse (loaded from CDN, available as window.Papa).
 */
export async function fetchVenues(csvUrl) {
  let csvText;

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    csvText = await response.text();
  } catch (err) {
    console.warn('Failed to fetch CSV, using fallback data:', err);
    return getFallbackVenues();
  }

  return parseCSV(csvText);
}

/**
 * Fetch and parse limited-time offers CSV into offer objects.
 */
export async function fetchLimitedOffers(csvUrl) {
  let csvText;

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    csvText = await response.text();
  } catch (err) {
    console.warn('Failed to fetch limited offers CSV:', err);
    return [];
  }

  return parseLimitedOffersCSV(csvText);
}

/**
 * Parse CSV text into normalized venue objects.
 * The Google Sheet CSV may have junk rows before the actual header row.
 * We detect the header row by looking for "Business DBA".
 */
export function parseCSV(csvText) {
  // Locate header row (supports extra rows before header)
  const lines = csvText.split('\n');
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Business DBA')) {
      headerIndex = i;
      break;
    }
  }

  let cleanedCSV = csvText;
  if (headerIndex > 0) {
    cleanedCSV = lines.slice(headerIndex).join('\n');
  }

  const parsed = Papa.parse(cleanedCSV, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  const rows = parsed.data || [];
  const venues = [];

  const dateColRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
  const headers = parsed.meta && parsed.meta.fields ? parsed.meta.fields : [];
  const dateKeyByIndex = {};
  headers.forEach((h, idx) => {
    const match = (h || '').toString().match(dateColRegex);
    if (match) {
      const m = parseInt(match[1], 10);
      const d = parseInt(match[2], 10);
      const y = match[3];
      const yearNum = parseInt(y, 10);
      const year2 = isNaN(yearNum) ? y : String(yearNum % 100);
      dateKeyByIndex[idx] = `${m}/${d}/${year2}`;
    }
  });

  for (const row of rows) {
    const businessName = (row['Business DBA'] || '').trim();
    if (!businessName) continue;

    let lat = parseFloat(row['Lat']);
    let lng = parseFloat(row['Long']);
    if ((isNaN(lat) || isNaN(lng)) && MISSING_COORDS[businessName]) {
      lat = MISSING_COORDS[businessName].lat;
      lng = MISSING_COORDS[businessName].lng;
    }
    if (isNaN(lat) || isNaN(lng)) continue;

    const menuField = (row['Menu'] || '').trim();
    const { menuUrl } = parseMenuField(menuField);
    const notes = (row['Notes'] || '').trim();

    const times = {};
    headers.forEach((h, idx) => {
      const key = dateKeyByIndex[idx];
      if (!key) return;
      const val = (row[h] || '').toString().trim();
      if (val) times[key] = val;
    });

    venues.push({
      name: businessName,
      lat,
      lng,
      instagram: (row['Instagram'] || '').trim(),
      menuUrl,
      notes,
      promotionType: (row['Promotion Type'] || '').trim(),
      times,
      happyHours: [],
      specials: [],
      hasActiveHappyHour: false,
      hasActiveSpecial: false,
      hasWeekendHappyHour: false,
      hasWeekendSpecial: false
    });
  }

  return venues;
}

function parseLimitedOffersCSV(csvText) {
  const rawHasEvent = /event name/i.test(csvText);
  const rawLines = csvText.split('\n');
  const rawFirstLine = rawLines.find(line => /[A-Za-z0-9]/.test(line || '')) || '';

  let parsed = Papa.parse(csvText, {
    skipEmptyLines: true
  });
  let rows = parsed.data || [];
  const maxCols = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
  if (maxCols <= 1) {
    parsed = Papa.parse(csvText, {
      skipEmptyLines: true,
      delimiter: '\t'
    });
    rows = parsed.data || [];
  }

  if (rows.length === 0) return [];

  const expectedHeaders = [
    'venue instagram',
    'long',
    'lat',
    'event name',
    'organizer(s)',
    'type',
    'description',
    'link'
  ];

  let headerIndex = -1;
  let headerScore = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const normalizedRow = row.map(cell => (cell || '')
      .toString()
      .replace(/^\uFEFF/, '')
      .replace(/[^a-zA-Z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    );
    const score = expectedHeaders.reduce((acc, h) => acc + (normalizedRow.includes(h) ? 1 : 0), 0);
    if (score > headerScore) {
      headerScore = score;
      headerIndex = i;
    }
    if (score >= 4) break;
  }

  if (headerScore <= 0) headerIndex = -1;
  if (typeof window !== 'undefined') {
    window.__limitedOffersHeaderIndex = headerIndex;
    window.__limitedOffersHeaderCols = headerIndex === -1 ? 0 : (rows[headerIndex] || []).length;
    window.__limitedOffersRowCount = rows.length;
    window.__limitedOffersFirstRow = (rows[0] || []).slice(0, 5);
    window.__limitedOffersRawHasEvent = rawHasEvent;
    window.__limitedOffersFirstLine = rawFirstLine.slice(0, 120);
  }

  if (headerIndex === -1 && rawHasEvent) {
    parsed = Papa.parse(csvText, {
      skipEmptyLines: true,
      delimiter: ';'
    });
    rows = parsed.data || [];
    headerIndex = -1;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const hasEventName = row.some(cell => {
        const normalized = (cell || '')
          .toString()
          .replace(/^\uFEFF/, '')
          .replace(/[^a-zA-Z0-9 ]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return normalized === 'event name' || normalized.includes('event name');
      });
      if (hasEventName) {
        headerIndex = i;
        break;
      }
    }
    if (typeof window !== 'undefined') {
      window.__limitedOffersHeaderIndex = headerIndex;
      window.__limitedOffersHeaderCols = headerIndex === -1 ? 0 : (rows[headerIndex] || []).length;
      window.__limitedOffersRowCount = rows.length;
      window.__limitedOffersFirstRow = (rows[0] || []).slice(0, 5);
    }
  }
  if (headerIndex === -1) {
    console.warn('Limited offers header not found');
    return [];
  }

  const header = rows[headerIndex].map((h = '') => h.toString().trim());
  const normalizeHeader = (value) => (value || '')
    .toString()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-zA-Z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const headerMap = new Map();
  header.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key && !headerMap.has(key)) {
      headerMap.set(key, idx);
    }
  });

  const getBy = (keys, row) => {
    for (const key of keys) {
      const idx = headerMap.get(key);
      if (idx !== undefined) {
        return (row[idx] || '').toString().trim();
      }
    }
    return '';
  };
  const offers = [];
  const dateColRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
  const dateKeyByIndex = {};
  for (let c = 0; c < header.length; c += 1) {
    const match = (header[c] || '').toString().match(dateColRegex);
    if (match) {
      const m = parseInt(match[1], 10);
      const d = parseInt(match[2], 10);
      const y = match[3];
      const yearNum = parseInt(y, 10);
      const year2 = isNaN(yearNum) ? y : String(yearNum % 100);
      dateKeyByIndex[c] = `${m}/${d}/${year2}`;
    }
  }

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const eventName = getBy(['event name'], row) ||
      getBy(['venue', 'venue name', 'name'], row);
    let lat = parseFloat(getBy(['lat'], row));
    let lng = parseFloat(getBy(['long', 'lng', 'longitude'], row));
    if (isNaN(lat) || isNaN(lng)) {
      let foundLat = null;
      let foundLng = null;
      for (const cell of row) {
        const value = parseFloat((cell || '').toString().trim());
        if (isNaN(value)) continue;
        if (value >= 33 && value <= 35 && foundLat === null) {
          foundLat = value;
        } else if (value <= -117 && value >= -119 && foundLng === null) {
          foundLng = value;
        }
      }
      if (!isNaN(foundLat)) lat = foundLat;
      if (!isNaN(foundLng)) lng = foundLng;
    }
    if (!eventName || isNaN(lat) || isNaN(lng)) continue;

    const times = {};
    for (let c = 0; c < header.length; c += 1) {
      const key = dateKeyByIndex[c];
      if (!key) continue;
      const val = (row[c] || '').toString().trim();
      if (val) times[key] = val;
    }

    offers.push({
      name: eventName,
      type: getBy(['type', 'category', 'tier'], row),
      description: getBy(['description'], row),
      instagram: getBy(['venue instagram', 'instagram', 'ig'], row),
      link: getBy(['link', 'menu', 'url'], row),
      lat,
      lng,
      times
    });
  }

  return offers;
}

/**
 * Update computed/runtime fields on a venue (call on refresh).
 */
export function updateVenueStatus(venue) {
  venue.hasActiveHappyHour = venue.happyHours.some(hh => isPromotionActive(hh.hours));
  venue.hasActiveSpecial = venue.specials.some(sp => isPromotionActive(sp.hours));

  // Aggregate weekend hours
  venue.hasWeekendHappyHour = venue.happyHours.some(hh => hasWeekendHours(hh.hours));
  venue.hasWeekendSpecial = venue.specials.some(sp => hasWeekendHours(sp.hours));
}

/**
 * Update status for all venues (called on auto-refresh timer).
 */
export function updateAllVenueStatuses(venues) {
  for (const venue of venues) {
    updateVenueStatus(venue);
  }
}

/**
 * Get all unique neighborhoods from venues.
 */
export function getNeighborhoods(venues) {
  const areas = new Set(venues.map(v => v.area).filter(Boolean));
  return Array.from(areas).sort();
}

/**
 * Fallback data in case CSV fetch fails.
 */
function getFallbackVenues() {
  console.warn('Using fallback venue data');
  return [];
}
