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
  // First, find the header row
  const lines = csvText.split('\n');
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Business DBA')) {
      headerIndex = i;
      break;
    }
  }

  // If we found a header row that's not the first line, skip the preamble
  let cleanedCSV = csvText;
  if (headerIndex > 0) {
    cleanedCSV = lines.slice(headerIndex).join('\n');
  }

  const parsed = Papa.parse(cleanedCSV, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  const rows = parsed.data;
  const venues = [];
  let currentVenue = null;

  for (const row of rows) {
    const businessName = (row['Business DBA'] || '').trim();
    const promotionType = (row['Promotion Type'] || '').trim();
    const hours = parseRowHours(row);
    const hasHours = hasAnyHours(hours);

    // Skip rows with no useful data
    if (!promotionType && !businessName && !hasHours) continue;

    // Handle rows that are just additional time ranges for the previous promotion
    // (no business name, no promotion type, but has hours)
    if (!promotionType && !businessName && hasHours && currentVenue) {
      // Append hours to the last promotion entry (HH or Special)
      const lastPromos = currentVenue.happyHours.length > 0
        ? currentVenue.happyHours
        : currentVenue.specials;
      if (lastPromos.length > 0) {
        const lastPromo = lastPromos[lastPromos.length - 1];
        for (const [day, ranges] of Object.entries(hours)) {
          if (!lastPromo.hours[day]) {
            lastPromo.hours[day] = [];
          }
          lastPromo.hours[day].push(...ranges);
        }
      }
      continue;
    }

    // New venue starts when Business DBA is filled
    if (businessName) {
      // Save previous venue
      if (currentVenue) {
        venues.push(currentVenue);
      }

      let lat = parseFloat(row['Lat']);
      let lng = parseFloat(row['Long']);

      // Fill in missing coordinates
      if ((isNaN(lat) || isNaN(lng)) && MISSING_COORDS[businessName]) {
        lat = MISSING_COORDS[businessName].lat;
        lng = MISSING_COORDS[businessName].lng;
      }

      currentVenue = {
        name: businessName,
        area: (row['Area'] || '').trim(),
        lat: lat,
        lng: lng,
        instagram: (row['Instagram'] || '').trim(),
        website: (row['Website'] || '').trim(),
        description: (row['Description'] || '').trim(),
        happyHours: [],
        specials: [],
        // Computed later
        hasActiveHappyHour: false,
        hasActiveSpecial: false,
        hasWeekendHappyHour: false,
        hasWeekendSpecial: false
      };
    }

    if (!currentVenue) continue;

    const menuField = (row['Menu'] || '').trim();
    const notes = (row['Notes'] || '').trim();
    const { menuUrl, menuDescription } = parseMenuField(menuField);
    const promoDescription = getPromoDescription(row, currentVenue.description);

    if (promotionType === 'Special') {
      const resolvedMenuUrl =
        currentVenue.name.toLowerCase() === 'cou cou' &&
        (menuDescription || menuField || notes || '').toLowerCase().includes('martini monday')
          ? 'https://www.coucou.la/martini-monday-venice'
          : menuUrl;
      currentVenue.specials.push({
        name: menuDescription || menuField || notes || 'Special',
        typeLabel: promotionType || 'Special',
        menuUrl: resolvedMenuUrl,
        description: promoDescription,
        notes,
        hours
      });
    } else {
      // Treat any other promotion type as a generic promo (rendered like HH)
      currentVenue.happyHours.push({
        typeLabel: promotionType || 'Promotion',
        menuUrl,
        menuDescription,
        description: promoDescription,
        notes,
        hours
      });
    }
  }

  // Don't forget the last venue
  if (currentVenue) {
    venues.push(currentVenue);
  }

  // Compute runtime fields
  for (const venue of venues) {
    updateVenueStatus(venue);
  }

  return venues.filter(v => !isNaN(v.lat) && !isNaN(v.lng));
}

function parseLimitedOffersCSV(csvText) {
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

  let headerIndex = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row.some(cell => (cell || '').toString().replace(/^\uFEFF/, '').trim().toLowerCase() === 'event name')) {
      headerIndex = i;
      break;
    }
  }
  window.__limitedOffersHeaderIndex = headerIndex;
  window.__limitedOffersHeaderCols = headerIndex === -1 ? 0 : (rows[headerIndex] || []).length;
  if (headerIndex === -1) {
    console.warn('Limited offers header not found');
    return [];
  }

  const header = rows[headerIndex].map((h = '') => h.toString().trim());
  const offers = [];
  const dateColRegex = /^\d{1,2}\/\d{1,2}\/\d{2}$/;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const get = (name) => {
      const idx = header.indexOf(name);
      return idx === -1 ? '' : (row[idx] || '').toString().trim();
    };

    const eventName = get('Event Name');
    const lat = parseFloat(get('Lat'));
    const lng = parseFloat(get('Long'));
    if (!eventName || isNaN(lat) || isNaN(lng)) continue;

    const times = {};
    for (let c = 0; c < header.length; c += 1) {
      const key = header[c];
      if (!dateColRegex.test(key)) continue;
      const val = (row[c] || '').toString().trim();
      if (val) times[key] = val;
    }

    offers.push({
      name: eventName,
      description: get('Description'),
      instagram: get('Venue Instagram'),
      link: get('Link'),
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
