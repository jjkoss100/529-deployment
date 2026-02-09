import { getCurrentDayName, parseTimeRange, formatTimeNoPeriod, getPreviousDayName } from './utils.js?v=13';

const LNG_OFFSET = 0.00012; // Offset for dual markers side by side

let map = null;
let currentVenues = [];
let currentLimitedOffers = [];
let openPopup = null;
let energyAnimationHandle = null;
let offerPulseHandle = null;
let debugPanel = null;
let pendingOfferFeatures = null;
let lastOfferFeatureCount = 0;
let offersLayerRetry = null;
let lastVenueCount = 0;
let lastPromoCount = 0;
let lastVisibleCount = 0;
let lastLimitedCount = 0;
let lastSuperCount = 0;
let lastSuperShown = 0;

const ENERGY_SOURCE_ID = 'energy-trails';
const ENERGY_LAYER_ID = 'energy-trails-line';
const OFFERS_SOURCE_ID = 'offers-points';
const OFFERS_LAYER_ID = 'offers-circles';
const OFFERS_ICON_ID = 'offers-icons';
const OFFERS_LABEL_ID = 'offers-labels';
const SUPER_LIMITED_COLOR = '#4b1a7a';
const EVENT_PRESHOW_MINUTES = 300;
const ORANGE_COLOR = '#f26b2d';
const ORANGE_STROKE = '#f9a15f';
const SPECIAL_COLOR = '#4aa3ff';
const SPECIAL_STROKE = '#9fd0ff';
const POPUP_COLOR = '#ff5db8';
const POPUP_STROKE = '#ff9ed6';

function makeSvgData(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function ensureOfferIcons() {
  if (!map) return;
  const icons = [
    {
      id: 'icon-happy',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="${ORANGE_COLOR}" stroke-width="6"/></svg>`
    },
    {
      id: 'icon-menu',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="${ORANGE_COLOR}"/></svg>`
    },
    {
      id: 'icon-special',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="${SPECIAL_COLOR}" d="M32 8l6.6 13.4 14.8 2.2-10.7 10.4 2.5 14.7L32 41.8 18.8 48.7l2.5-14.7L10.6 23.6l14.8-2.2L32 8z"/></svg>`
    },
    {
      id: 'icon-popup',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="${POPUP_COLOR}" d="M32 8l20 20-20 20-20-20z"/></svg>`
    }
  ];

  icons.forEach((icon) => {
    if (map.hasImage(icon.id)) return;
    const img = new Image(64, 64);
    img.onload = () => {
      if (!map.hasImage(icon.id)) {
        map.addImage(icon.id, img, { pixelRatio: 2 });
      }
    };
    img.src = makeSvgData(icon.svg);
  });
}

const IG_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#405de6"/><stop offset="15%" stop-color="#5851db"/><stop offset="30%" stop-color="#833ab4"/><stop offset="45%" stop-color="#c13584"/><stop offset="60%" stop-color="#e1306c"/><stop offset="72%" stop-color="#fd1d1d"/><stop offset="82%" stop-color="#f56040"/><stop offset="90%" stop-color="#f77737"/><stop offset="96%" stop-color="#fcaf45"/><stop offset="100%" stop-color="#ffdc80"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" stroke="url(#ig-grad)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MENU_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

function ensureUiLayer() {
  let layer = document.getElementById('ui-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'ui-layer';
  document.body.appendChild(layer);
  return layer;
}

/**
 * Initialize the Mapbox GL JS map.
 */
export function initMap(containerId, mapboxToken) {
  mapboxgl.accessToken = mapboxToken;

  const styleUrl = 'mapbox://styles/mapbox/navigation-night-v1';
  map = new mapboxgl.Map({
    container: containerId,
    style: styleUrl,
    center: [-118.469, 33.989],
    zoom: 14,
    minZoom: 12,
    maxZoom: 18
  });

  // Expose map for debugging (use _map to avoid collision with div#map)
  window._map = map;

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  const applyStyleTuning = () => {
    setupMapAtmosphere();
    stylizeBaseLayers();
    ensureEnergyTrails();
    startEnergyAnimation();
  };

  map.on('load', () => {
    applyStyleTuning();
    ensureOffersLayer();
    updateDebugPanel();
    if (pendingOfferFeatures && map.getSource(OFFERS_SOURCE_ID)) {
      map.getSource(OFFERS_SOURCE_ID).setData({ type: 'FeatureCollection', features: pendingOfferFeatures });
      pendingOfferFeatures = null;
    }
  });
  map.on('styledata', () => {
    applyStyleTuning();
    ensureOffersLayer();
    updateDebugPanel();
    if (map.getSource(OFFERS_SOURCE_ID)) {
      map.getSource(OFFERS_SOURCE_ID).setData({
        type: 'FeatureCollection',
        features: pendingOfferFeatures || []
      });
    }
  });
  map.on('idle', updateDebugPanel);

  const styleWatch = setInterval(() => {
    if (!map) {
      clearInterval(styleWatch);
      return;
    }
    if (map.isStyleLoaded()) {
      ensureOffersLayer();
      updateDebugPanel();
      clearInterval(styleWatch);
    } else {
      updateDebugPanel();
    }
  }, 500);

  setTimeout(() => {
    if (!map) return;
    if (!map.isStyleLoaded()) {
      console.warn('Style still not loaded; forcing setStyle refresh.');
      map.setStyle(styleUrl);
    }
  }, 3500);

  return map;
}

/**
 * Get the map instance.
 */
export function getMap() {
  return map;
}

/**
 * Clear all existing markers from the map.
 */
function clearMarkers() {
  if (openPopup) {
    openPopup.remove();
    openPopup = null;
  }
  if (map && map.getSource(OFFERS_SOURCE_ID)) {
    map.getSource(OFFERS_SOURCE_ID).setData({ type: 'FeatureCollection', features: [] });
  }
}

const PRESHOW_MINUTES = 30; // Show markers 30min before start
const MAX_SIZE = 15;        // Consistent marker size

/**
 * Compute the visual lifecycle state of a marker based on current time.
 * Works for both HH and special promotions.
 * @param {Array} promotions - array of promotion objects (happyHours or specials)
 * Returns null if marker should be hidden, or { size, opacity, phase, endingSoon, glow } where:
 *   phase: 'preshow' | 'active'
 */
function getMarkerLifecycleState(promotions) {
  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Collect all today's time ranges across all promotion entries
  const todayRanges = [];
  const prevDayName = getPreviousDayName(dayName);
  const prevCrossRanges = [];
  for (const promo of promotions) {
    const dayHours = promo.hours[dayName];
    if (dayHours && dayHours.length > 0) {
      for (const rangeStr of dayHours) {
        const range = parseTimeRange(rangeStr);
        if (range) todayRanges.push(range);
      }
    }
    const prevHours = promo.hours[prevDayName];
    if (prevHours && prevHours.length > 0) {
      for (const rangeStr of prevHours) {
        const range = parseTimeRange(rangeStr);
        if (range && range.end < range.start) prevCrossRanges.push(range);
      }
    }
  }

  if (todayRanges.length === 0 && prevCrossRanges.length === 0) return null;

  // Check each range for the marker lifecycle
  for (const range of todayRanges) {
    const preshowStart = range.start - PRESHOW_MINUTES;
    let duration;

    if (range.end > range.start) {
      duration = range.end - range.start;
    } else {
      // Midnight crossing
      duration = (1440 - range.start) + range.end;
    }

    // Check if currently in the active window
    let isInRange = false;
    if (range.end > range.start) {
      isInRange = currentMinutes >= range.start && currentMinutes < range.end;
    } else if (range.end < range.start) {
      isInRange = currentMinutes >= range.start || currentMinutes < range.end;
    }

    if (isInRange) {
      // Active — constant size, opacity + glow ramp as event progresses
      let elapsed;
      if (range.end > range.start) {
        elapsed = currentMinutes - range.start;
      } else {
        // Midnight crossing
        elapsed = currentMinutes >= range.start
          ? currentMinutes - range.start
          : (1440 - range.start) + currentMinutes;
      }
      const remaining = duration - elapsed;
      const progress = Math.min(elapsed / duration, 1); // 0 at start, 1 at end
      const opacity = remaining <= 45 ? 1 : Math.min(1, 0.8 + (0.2 * progress));
      let glow = 0;
      if (duration <= 45) {
        // Entire window is the "last 45" segment
        glow = 0.5 + (0.5 * progress);
      } else if (remaining > 45) {
        const preProgress = (duration - remaining) / (duration - 45);
        glow = 0.5 * Math.min(Math.max(preProgress, 0), 1);
      } else {
        const lastProgress = (45 - remaining) / 45;
        glow = 0.5 + (0.5 * Math.min(Math.max(lastProgress, 0), 1));
      }
      const pulse = remaining <= 45 || glow >= 0.5 ? 1 : 0;
      return {
        size: MAX_SIZE,
        opacity: parseFloat(opacity.toFixed(2)),
        phase: 'active',
        endingSoon: remaining <= 45,
        glow: parseFloat(glow.toFixed(2)),
        pulse
      };
    }

    // Check if in preshow window (30min before start)
    if (currentMinutes >= preshowStart && currentMinutes < range.start) {
      // Preshow: constant size with vibration animation
      return { size: MAX_SIZE, opacity: 0.8, phase: 'preshow', endingSoon: false, glow: 0, pulse: 0 };
    }
  }

  // Check previous day's cross-midnight ranges (active only)
  for (const range of prevCrossRanges) {
    if (currentMinutes >= 0 && currentMinutes < range.end) {
      const elapsed = currentMinutes + (1440 - range.start);
      const duration = (1440 - range.start) + range.end;
      const remaining = duration - elapsed;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = remaining <= 45 ? 1 : Math.min(1, 0.8 + (0.2 * progress));
      let glow = 0;
      if (duration <= 45) {
        glow = 0.5 + (0.5 * progress);
      } else if (remaining > 45) {
        const preProgress = (duration - remaining) / (duration - 45);
        glow = 0.5 * Math.min(Math.max(preProgress, 0), 1);
      } else {
        const lastProgress = (45 - remaining) / 45;
        glow = 0.5 + (0.5 * Math.min(Math.max(lastProgress, 0), 1));
      }
      const pulse = remaining <= 45 || glow >= 0.5 ? 1 : 0;
      return {
        size: MAX_SIZE,
        opacity: parseFloat(opacity.toFixed(2)),
        phase: 'active',
        endingSoon: remaining <= 45,
        glow: parseFloat(glow.toFixed(2)),
        pulse
      };
    }
  }

  // No range is active or in preshow window
  return null;
}

// Markers are rendered via Mapbox circle layers (no DOM markers).

/**
 * Get the time status for a set of promotions.
 * @param {Array} promotions - array of promotion objects (happyHours or specials)
 * @param {string} label - "happy hour" or "special" for display text
 * Returns { active: boolean, text: string }
 */
function getTimeStatus(promotions) {
  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRanges = [];
  const prevDayName = getPreviousDayName(dayName);
  const prevCrossRanges = [];
  for (const promo of promotions) {
    const dayHours = promo.hours[dayName];
    if (dayHours && dayHours.length > 0) {
      for (const rangeStr of dayHours) {
        const range = parseTimeRange(rangeStr);
        if (range) todayRanges.push(range);
      }
    }
    const prevHours = promo.hours[prevDayName];
    if (prevHours && prevHours.length > 0) {
      for (const rangeStr of prevHours) {
        const range = parseTimeRange(rangeStr);
        if (range && range.end < range.start) prevCrossRanges.push(range);
      }
    }
  }

  // Always honor previous day's cross-midnight ranges after midnight
  for (const range of prevCrossRanges) {
    if (currentMinutes < range.end) {
      return {
        active: true,
        text: `ends at ${formatTimeNoPeriod(range.end)}`,
        endsSoon: (range.end - currentMinutes) <= 45
      };
    }
  }

  if (todayRanges.length === 0) {
    return { active: false, text: 'No times today' };
  }

  for (const range of todayRanges) {
    let isActive = false;
    if (range.end > range.start) {
      isActive = currentMinutes >= range.start && currentMinutes < range.end;
    } else if (range.end < range.start) {
      isActive = currentMinutes >= range.start || currentMinutes < range.end;
    }
    if (isActive) {
      return {
        active: true,
        text: `ends at ${formatTimeNoPeriod(range.end)}`,
        endsSoon: (range.end > range.start)
          ? (range.end - currentMinutes) <= 45
          : ((1440 - currentMinutes) + range.end) <= 45
      };
    }
  }

  const upcomingStarts = todayRanges
    .filter(r => r.start > currentMinutes)
    .sort((a, b) => a.start - b.start);

  if (upcomingStarts.length > 0) {
    return {
      active: false,
      text: `starts at ${formatTimeNoPeriod(upcomingStarts[0].start)}`
    };
  }

  const lastRange = todayRanges.sort((a, b) => a.start - b.start)[todayRanges.length - 1];
  return {
    active: false,
    text: `ends at ${formatTimeNoPeriod(lastRange.end)}`
  };
}

/**
 * Build popup HTML content for a venue.
 * @param {Object} venue
 * @param {string} type - 'hh' or 'special'
 */
function buildPopupContent(venue, type) {
  const isHH = type === 'hh';
  const promotions = isHH ? venue.happyHours : venue.specials;
  const igSvg = IG_SVG;
  const menuSvg = MENU_SVG;
  let html = `<div class="popup-card">`;

  // Body
  html += `<div class="popup-body">`;

  // Body header: venue name left, instagram right
  html += `<div class="popup-body-header">`;
  html += `<h3 class="popup-venue-name">${escapeHtml(venue.name)}</h3>`;
  if (venue.instagram) {
    html += `<a class="popup-ig-link" href="${escapeHtml(venue.instagram)}" target="_blank" rel="noopener" title="Instagram">${igSvg}</a>`;
  }
  html += `</div>`;

  // Filter to only currently relevant promotions (active or in preshow)
  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prevDayNameForFilter = getPreviousDayName(dayName);
  const relevantPromos = promotions.filter(promo => {
    const dayHours = promo.hours[dayName];
    if (dayHours && dayHours.length > 0) {
      for (const rangeStr of dayHours) {
        const range = parseTimeRange(rangeStr);
        if (!range) continue;
        const preshowStart = range.start - PRESHOW_MINUTES;
        // Check active
        if (range.end > range.start) {
          if (currentMinutes >= range.start && currentMinutes < range.end) return true;
        } else {
          if (currentMinutes >= range.start || currentMinutes < range.end) return true;
        }
        // Check preshow
        if (currentMinutes >= preshowStart && currentMinutes < range.start) return true;
      }
    }
    const prevHours = promo.hours[prevDayNameForFilter];
    if (prevHours && prevHours.length > 0) {
      for (const rangeStr of prevHours) {
        const range = parseTimeRange(rangeStr);
        if (range && range.end < range.start && currentMinutes < range.end) {
          return true;
        }
      }
    }
    return false;
  });
  const displayPromos = relevantPromos.length > 0 ? relevantPromos : promotions;

  // Notes (show for any promo type)
  const notesText = displayPromos.map(p => p.notes).find(n => n && n.trim());
  if (notesText) {
    html += `<p class="popup-notes">${escapeHtml(formatNotesForDisplay(notesText))}</p>`;
  }

 

  // Time status at bottom — use only relevant promotions
  html += `</div>`; // .popup-body

  // Footer
  const timeStatus = getTimeStatus(displayPromos);
  const menuUrl =
    displayPromos.find(p => p.menuUrl)?.menuUrl ||
    displayPromos.map(p => extractUrl(p.notes)).find(Boolean) ||
    displayPromos.map(p => extractUrl(p.description)).find(Boolean) ||
    '';
  html += `<div class="popup-footer">`;
  html += `<div class="popup-footer-actions">`;
  if (menuUrl) {
    html += `<a class="popup-menu-icon" href="${escapeHtml(menuUrl)}" target="_blank" rel="noopener" title="Menu">${menuSvg}</a>`;
  }
  html += `</div>`;
  html += `<div class="popup-time-status ${timeStatus.active ? 'popup-time-status--active' : ''} ${timeStatus.endsSoon ? 'popup-time-status--soon' : ''}">`;
  html += `<span>${timeStatus.text}</span>`;
  html += `</div>`;
  html += `</div>`; // .popup-footer

  html += `</div>`; // .popup-card
  return html;
}

function getDateKey(dateObj, pad = false) {
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const year = dateObj.getFullYear().toString().slice(-2);
  const mm = pad ? String(month).padStart(2, '0') : String(month);
  const dd = pad ? String(day).padStart(2, '0') : String(day);
  return `${mm}/${dd}/${year}`;
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const parts = dateKey.split('/');
  if (parts.length < 3) return null;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const yRaw = parts[2];
  const y = yRaw.length === 2 ? 2000 + parseInt(yRaw, 10) : parseInt(yRaw, 10);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

function formatTimeAP(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr.trim();
  let hour = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minutes)) return timeStr.trim();
  const suffix = hour >= 12 ? 'p' : 'a';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minutes.toString().padStart(2, '0')}${suffix}`;
}

function formatMinutesAP(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const suffix = h >= 12 ? 'p' : 'a';
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m.toString().padStart(2, '0')}${suffix}`;
}

function formatTimeWindowAP(timeStr) {
  if (!timeStr) return '';
  return timeStr
    .split(',')
    .map(segment => {
      const trimmed = segment.trim();
      const rangeParts = trimmed.split('-');
      if (rangeParts.length !== 2) return trimmed;
      const start = formatTimeAP(rangeParts[0].trim());
      const end = formatTimeAP(rangeParts[1].trim());
      return `${start}-${end}`;
    })
    .join(', ');
}

function parseOfferRanges(timeStr) {
  if (!timeStr) return [];
  return timeStr
    .split(',')
    .map(s => s.trim())
    .map(s => parseTimeRange(s))
    .filter(Boolean);
}

function parseFirstRange(timeStr) {
  const ranges = parseOfferRanges(timeStr);
  return ranges.length ? ranges[0] : null;
}

function getEventLifecycleState(timeStr) {
  const range = parseFirstRange(timeStr);
  if (!range) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = range.start;
  const end = range.end;

  let isActive = false;
  if (end > start) {
    isActive = currentMinutes >= start && currentMinutes <= end;
  } else if (end < start) {
    isActive = currentMinutes >= start || currentMinutes <= end;
  }

  const preshowStart = start - EVENT_PRESHOW_MINUTES;
  let isPreshow = false;
  if (preshowStart >= 0) {
    isPreshow = currentMinutes >= preshowStart && currentMinutes < start;
  } else {
    isPreshow = currentMinutes >= (1440 + preshowStart) || currentMinutes < start;
  }

  if (!isActive && !isPreshow) return null;

  return {
    opacity: 1,
    glow: 0,
    pulse: isActive ? 1 : 0,
    active: isActive
  };
}

function getEventTimeStatus(timeStr, dateKey) {
  const range = parseFirstRange(timeStr);
  if (!range) {
    return { text: dateKey || timeStr || 'Time TBD', endsSoon: false, active: false };
  }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = range.start;
  const end = range.end;

  let isActive = false;
  if (end > start) {
    isActive = currentMinutes >= start && currentMinutes <= end;
  } else if (end < start) {
    isActive = currentMinutes >= start || currentMinutes <= end;
  }

  if (isActive) {
    const remaining = end > start
      ? end - currentMinutes
      : (currentMinutes <= end ? end - currentMinutes : (1440 - currentMinutes) + end);
    return {
      active: true,
      endsSoon: remaining <= 45,
      text: `ends at ${formatMinutesAP(end)}`
    };
  }

  const windowLabel = formatTimeWindowAP(timeStr);
  return { active: false, endsSoon: false, text: windowLabel };
}

function getLimitedOfferLifecycleState(timeStr) {
  const ranges = parseOfferRanges(timeStr);
  if (!ranges.length) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = ranges.slice().sort((a, b) => a.start - b.start);

  // Active window
  for (const range of ranges) {
    const preshowStart = range.start - PRESHOW_MINUTES;
    const duration = range.end > range.start
      ? (range.end - range.start)
      : (1440 - range.start) + range.end;

    let isInRange = false;
    if (range.end > range.start) {
      isInRange = currentMinutes >= range.start && currentMinutes < range.end;
    } else if (range.end < range.start) {
      isInRange = currentMinutes >= range.start || currentMinutes < range.end;
    }

    if (isInRange) {
      const elapsed = range.end > range.start
        ? currentMinutes - range.start
        : (currentMinutes >= range.start
          ? currentMinutes - range.start
          : (1440 - range.start) + currentMinutes);
      const remaining = duration - elapsed;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = remaining <= 45 ? 1 : Math.min(1, 0.8 + (0.2 * progress));
      let glow = 0;
      if (duration <= 45) {
        glow = 0.5 + (0.5 * progress);
      } else if (remaining > 45) {
        const preProgress = (duration - remaining) / (duration - 45);
        glow = 0.5 * Math.min(Math.max(preProgress, 0), 1);
      } else {
        const lastProgress = (45 - remaining) / 45;
        glow = 0.5 + (0.5 * Math.min(Math.max(lastProgress, 0), 1));
      }
      return {
        size: MAX_SIZE,
        opacity: parseFloat(opacity.toFixed(2)),
        phase: 'active',
        endingSoon: remaining <= 45,
        glow: parseFloat(glow.toFixed(2)),
        pulse: remaining <= 45 || glow >= 0.5 ? 1 : 0
      };
    }

    if (currentMinutes >= preshowStart && currentMinutes < range.start) {
      return { size: MAX_SIZE, opacity: 0.8, phase: 'preshow', endingSoon: false, glow: 0, pulse: 0 };
    }
  }

  return null;
}

function getLimitedOfferTimeStatus(timeStr) {
  const ranges = parseOfferRanges(timeStr);
  if (!ranges.length) {
    return { active: false, text: timeStr || 'Time TBD', endsSoon: false };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const range of ranges) {
    let isActive = false;
    if (range.end > range.start) {
      isActive = currentMinutes >= range.start && currentMinutes < range.end;
    } else if (range.end < range.start) {
      isActive = currentMinutes >= range.start || currentMinutes < range.end;
    }

    if (isActive) {
      const remaining = (range.end > range.start)
        ? (range.end - currentMinutes)
        : ((1440 - currentMinutes) + range.end);
      return {
        active: true,
        text: `ends at ${formatTimeNoPeriod(range.end)}`,
        endsSoon: remaining <= 45
      };
    }
  }

  const upcoming = ranges
    .filter(r => r.start > currentMinutes)
    .sort((a, b) => a.start - b.start);

  if (upcoming.length > 0) {
    return {
      active: false,
      text: `starts at ${formatTimeNoPeriod(upcoming[0].start)}`,
      endsSoon: false
    };
  }

  return { active: false, text: timeStr, endsSoon: false };
}

function buildLimitedOfferPopup(offer, timeStr) {
  let html = `<div class="popup-card">`;
  html += `<div class="popup-body">`;
  html += `<div class="popup-body-header">`;
  html += `<h3 class="popup-venue-name">${escapeHtml(offer.name)}</h3>`;
  if (offer.instagram) {
    html += `<a class="popup-ig-link" href="${escapeHtml(offer.instagram)}" target="_blank" rel="noopener" title="Instagram">${IG_SVG}</a>`;
  }
  html += `</div>`;
  if (offer.description) {
    html += `<p class="popup-description">${escapeHtml(offer.description)}</p>`;
  }
  html += `</div>`;

  const timeStatus = getLimitedOfferTimeStatus(timeStr);
  html += `<div class="popup-footer">`;
  html += `<div class="popup-footer-actions">`;
  if (offer.link) {
    html += `<a class="popup-menu-icon" href="${escapeHtml(offer.link)}" target="_blank" rel="noopener" title="Link">${MENU_SVG}</a>`;
  }
  html += `</div>`;
  html += `<div class="popup-time-status ${timeStatus.active ? 'popup-time-status--active' : ''} ${timeStatus.endsSoon ? 'popup-time-status--soon' : ''}">`;
  html += `<span>${escapeHtml(timeStatus.text)}</span>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function buildEventPopup(venue, timeStr, dateKey) {
  const notes = venue.notes ? venue.notes.trim() : '';
  const titleLine = `${venue.name}${notes ? ` - ${notes}` : ''}`;
  const timeStatus = getEventTimeStatus(timeStr, dateKey);

  let html = `<div class="popup-card">`;
  html += `<div class="popup-body">`;
  html += `<div class="popup-event-line">${escapeHtml(titleLine)}</div>`;
  html += `<ul class="popup-list">`;
  if (venue.menuUrl) {
    html += `<li><a href="${escapeHtml(venue.menuUrl)}" target="_blank" rel="noopener">see full menu</a></li>`;
  } else {
    html += `<li>see full menu</li>`;
  }
  html += `<li class="${timeStatus.endsSoon ? 'popup-time-status--soon' : ''}">${escapeHtml(timeStatus.text)}</li>`;
  html += `</ul>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function buildSuperLimitedPopup(offer, timeStr, dateKey) {
  let html = `<div class="popup-card">`;
  html += `<div class="popup-body">`;
  html += `<div class="popup-body-header">`;
  html += `<h3 class="popup-venue-name">${escapeHtml(offer.name)}</h3>`;
  if (offer.instagram) {
    html += `<a class="popup-ig-link" href="${escapeHtml(offer.instagram)}" target="_blank" rel="noopener" title="Instagram">${IG_SVG}</a>`;
  }
  html += `</div>`;
  if (offer.description) {
    html += `<p class="popup-description">${escapeHtml(offer.description)}</p>`;
  }
  html += `</div>`;

  const dateLabel = formatDateLabel(dateKey);
  const windowLabel = formatTimeWindowAP(timeStr);
  const timeLabel = windowLabel ? `${dateLabel} · ${windowLabel}` : dateLabel;
  html += `<div class="popup-footer">`;
  html += `<div class="popup-footer-actions">`;
  if (offer.link) {
    html += `<a class="popup-menu-icon" href="${escapeHtml(offer.link)}" target="_blank" rel="noopener" title="Link">${MENU_SVG}</a>`;
  }
  html += `</div>`;
  html += `<div class="popup-time-status">`;
  html += `<span>${escapeHtml(timeLabel)}</span>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function ensureOffersLayer() {
  if (!map) return;
  if (!map.getStyle || !map.getStyle()) return;
  ensureOfferIcons();
  if (!map.getSource(OFFERS_SOURCE_ID)) {
    try {
      map.addSource(OFFERS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    } catch (err) {
      if (!offersLayerRetry) {
        offersLayerRetry = setTimeout(() => {
          offersLayerRetry = null;
          ensureOffersLayer();
        }, 500);
      }
      return;
    }
  }
  if (!map.getLayer('offers-debug')) {
    try {
      map.addLayer({
        id: 'offers-debug',
        type: 'circle',
        source: OFFERS_SOURCE_ID,
        paint: {
          'circle-color': '#00ffff',
          'circle-radius': 4,
          'circle-opacity': 0.8
        }
      });
    } catch (err) {
      if (!offersLayerRetry) {
        offersLayerRetry = setTimeout(() => {
          offersLayerRetry = null;
          ensureOffersLayer();
        }, 500);
      }
      return;
    }
  }
  if (!map.getLayer(OFFERS_LAYER_ID)) {
    try {
      map.addLayer({
        id: OFFERS_LAYER_ID,
        type: 'circle',
        source: OFFERS_SOURCE_ID,
        paint: {
          'circle-color': ['coalesce', ['get', 'color'], ORANGE_COLOR],
          'circle-opacity': ['coalesce', ['get', 'opacity'], 1],
          'circle-radius': [
            '+',
            8,
            0
          ],
          'circle-blur': [
            '+',
            0.05,
            0
          ],
          'circle-translate': [0, -2],
          'circle-translate-anchor': 'viewport',
          'circle-stroke-color': ['coalesce', ['get', 'strokeColor'], ORANGE_STROKE],
          'circle-stroke-width': 1.4,
          'circle-stroke-opacity': 0.8
        }
      });

      map.addLayer({
        id: OFFERS_ICON_ID,
        type: 'symbol',
        source: OFFERS_SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.36,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      map.addLayer({
        id: OFFERS_LABEL_ID,
        type: 'symbol',
        source: OFFERS_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-anchor': 'left',
          'text-offset': [0.9, -0.05],
          'text-allow-overlap': true,
          'text-optional': true
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], ORANGE_COLOR],
          'text-halo-color': 'rgba(7, 9, 15, 0.85)',
          'text-halo-width': 1.6,
          'text-halo-blur': 0.6,
          'text-opacity': 0.9
        }
      });
    } catch (err) {
      if (!offersLayerRetry) {
        offersLayerRetry = setTimeout(() => {
          offersLayerRetry = null;
          ensureOffersLayer();
        }, 500);
      }
      return;
    }
    map.on('mouseenter', OFFERS_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', OFFERS_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', OFFERS_LAYER_ID, (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      const { popupType, promoType, index, timeStr, dateKey } = feature.properties || {};
      const coords = feature.geometry.coordinates.slice();
      let html = '';
      if (popupType === 'event') {
        html = buildEventPopup(currentVenues[index], timeStr, dateKey);
      } else if (popupType === 'super') {
        html = buildSuperLimitedPopup(currentLimitedOffers[index], timeStr, dateKey);
      } else if (popupType === 'limited') {
        html = buildLimitedOfferPopup(currentLimitedOffers[index], timeStr);
      } else {
        html = buildPopupContent(currentVenues[index], promoType);
      }
      if (openPopup) openPopup.remove();
      openPopup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: true,
        maxWidth: '320px',
        className: 'venue-popup'
      }).setLngLat(coords).setHTML(html).addTo(map);
      const popupEl = openPopup.getElement();
      if (popupEl) {
        const statusEl = popupEl.querySelector('.popup-time-status--soon');
        if (statusEl) {
          statusEl.classList.remove('popup-time-status--alert');
          void statusEl.offsetWidth;
          statusEl.classList.add('popup-time-status--alert');
        }
      }
    });
  }

  if (!offerPulseHandle) {
    const animate = (t) => {
      if (!map || !map.getLayer(OFFERS_LAYER_ID)) {
        offerPulseHandle = null;
        return;
      }
      const pulse = (Math.sin(t / 350) + 1) / 2; // 0..1
      map.setPaintProperty(OFFERS_LAYER_ID, 'circle-radius', [
        '+',
        8,
        0
      ]);
      map.setPaintProperty(OFFERS_LAYER_ID, 'circle-blur', [
        '+',
        0.05,
        0
      ]);
      map.setPaintProperty(OFFERS_LAYER_ID, 'circle-opacity', [
        '*',
        ['coalesce', ['get', 'opacity'], 1],
        0.85 + 0.15 * pulse
      ]);
      offerPulseHandle = requestAnimationFrame(animate);
    };
    offerPulseHandle = requestAnimationFrame(animate);
  }
}

function ensureDebugPanel() {
  if (debugPanel) return debugPanel;
  debugPanel = document.createElement('div');
  debugPanel.id = 'offers-debug-panel';
  debugPanel.style.position = 'fixed';
  debugPanel.style.left = '14px';
  debugPanel.style.top = '14px';
  debugPanel.style.zIndex = '1000';
  debugPanel.style.padding = '8px 10px';
  debugPanel.style.borderRadius = '10px';
  debugPanel.style.background = 'rgba(0,0,0,0.6)';
  debugPanel.style.color = '#f26b2d';
  debugPanel.style.fontFamily = 'SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace';
  debugPanel.style.fontSize = '12px';
  debugPanel.style.letterSpacing = '0.04em';
  debugPanel.style.textTransform = 'uppercase';
  document.body.appendChild(debugPanel);
  return debugPanel;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatNotesForDisplay(notes) {
  if (!notes || typeof notes !== 'string') return '';

  const emojiLabels = [
    { re: /🍺|🍻/u, label: 'Beer' },
    { re: /🥃/u, label: 'Spirits' },
    { re: /🍷/u, label: 'Wine' },
    { re: /🍸|🍹/u, label: 'Cocktails' }
  ];

  const pairRegex = /(\$\s*\d+(?:\.\d+)?(?:\s*-\s*\$?\d+(?:\.\d+)?)?).*?(🍺|🍻|🥃|🍷|🍸|🍹)/gu;
  const extracted = [];
  let match;
  while ((match = pairRegex.exec(notes)) !== null) {
    const price = match[1] ? match[1].replace(/\s+/g, '') : '';
    const emoji = match[2];
    const labelEntry = emojiLabels.find(e => e.re.test(emoji));
    if (labelEntry && price) {
      extracted.push(`${labelEntry.label} ${price}`);
    }
  }
  if (extracted.length >= 2) {
    return extracted.join(' · ');
  }

  const chunks = notes.split(',').map(s => s.trim()).filter(Boolean);
  if (chunks.length < 2) return notes;

  const formatted = [];
  let parsedCount = 0;
  for (const chunk of chunks) {
    const priceMatch = chunk.match(/\$\s*\d+(?:\.\d+)?(?:\s*-\s*\$?\d+(?:\.\d+)?)?/);
    const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : '';
    const labelEntry = emojiLabels.find(e => e.re.test(chunk));
    if (labelEntry && price) {
      formatted.push(`${labelEntry.label} ${price}`);
      parsedCount += 1;
    }
  }

  if (parsedCount >= 2 && parsedCount === formatted.length) {
    return formatted.join(' · ');
  }

  return notes;
}

function extractUrl(str) {
  if (!str) return '';
  const match = str.match(/https?:\/\/[^\s)"]+/i);
  return match ? match[0] : '';
}

function setupMapAtmosphere() {
  if (!map || !map.isStyleLoaded()) return;

  if (map.getLayer('sky')) {
    return;
  }

  try {
    map.setFog({
      range: [0.8, 8],
      color: 'rgba(10, 12, 20, 0.85)',
      'horizon-blend': 0.08,
      'high-color': 'rgba(50, 120, 180, 0.6)',
      'space-color': 'rgba(8, 10, 16, 0.9)',
      'star-intensity': 0.15
    });
  } catch (err) {
    // setFog can fail on older styles; safe to ignore.
  }

  try {
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 6
      }
    });
  } catch (err) {
    // Some styles don't support sky layers; safe to ignore.
  }
}

function stylizeBaseLayers() {
  if (!map) return;
  const style = map.getStyle();
  if (!style || !style.layers) return;

  const suppressed = [];
  for (const layer of style.layers) {
    try {
      const id = layer.id.toLowerCase();

      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#07090f');
      }

      const iconImage = layer.layout && layer.layout['icon-image'];
      const iconImageStr = typeof iconImage === 'string' ? iconImage : JSON.stringify(iconImage || '');
      const textField = layer.layout && layer.layout['text-field'];
      const textFieldStr = typeof textField === 'string' ? textField : JSON.stringify(textField || '');
      const sourceLayer = (layer['source-layer'] || '').toLowerCase();
      const hasShieldIcon = iconImageStr.includes('shield') || iconImageStr.includes('route') || iconImageStr.includes('motorway') || iconImageStr.includes('interstate');
      const hasRouteText = textFieldStr.includes('ref') || textFieldStr.includes('route') || textFieldStr.includes('shield') || textFieldStr.includes('motorway');
      const isShield = (
        id.includes('shield') || id.includes('route') || id.includes('road-number') || id.includes('road_number') ||
        id.includes('road-number-shield') || id.includes('route-number') || id.includes('number-shield') ||
        id.includes('interstate') || id.includes('motorway-number') || id.includes('motorway') ||
        id.includes('junction') || id.includes('ref') || id.includes('road-shield') ||
        sourceLayer.includes('road_label') || (sourceLayer.includes('road') && hasRouteText) ||
        hasShieldIcon || hasRouteText
      );
      if (isShield) {
        suppressed.push(layer.id);
        try {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (err) {
          // ignore
        }
        if (layer.type === 'symbol') {
          map.setPaintProperty(layer.id, 'text-opacity', 0);
          map.setPaintProperty(layer.id, 'icon-opacity', 0);
        } else if (layer.type === 'circle') {
          map.setPaintProperty(layer.id, 'circle-opacity', 0);
        } else if (layer.type === 'line') {
          map.setPaintProperty(layer.id, 'line-opacity', 0);
        } else if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-opacity', 0);
        }
        continue;
      }

      if (layer.type === 'fill' && id.includes('water')) {
        map.setPaintProperty(layer.id, 'fill-color', '#08131f');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.9);
      }

      if (layer.type === 'line' && (id.includes('road') || id.includes('street'))) {
        map.setPaintProperty(layer.id, 'line-color', '#141a23');
        map.setPaintProperty(layer.id, 'line-opacity', 0.7);
      }

      if (layer.type === 'line' && id.includes('road') && id.includes('motorway')) {
        map.setPaintProperty(layer.id, 'line-color', '#1a2a3a');
        map.setPaintProperty(layer.id, 'line-opacity', 0.9);
      }

      if (layer.type === 'symbol' && id.includes('label')) {
        map.setPaintProperty(layer.id, 'text-color', '#8ec9b2');
        map.setPaintProperty(layer.id, 'text-halo-color', '#07090f');
        map.setPaintProperty(layer.id, 'text-halo-width', 1.4);
        map.setPaintProperty(layer.id, 'text-opacity', 0.7);
      }

      if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'icon-opacity', 0);
      }

      if (layer.id === OFFERS_LAYER_ID || layer.id === OFFERS_ICON_ID || layer.id === OFFERS_LABEL_ID || layer.id === 'offers-debug' || layer.id === ENERGY_LAYER_ID) {
        continue;
      }

      if (layer.type === 'circle') {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        map.setPaintProperty(layer.id, 'circle-opacity', 0);
        map.setPaintProperty(layer.id, 'circle-stroke-opacity', 0);
        map.setPaintProperty(layer.id, 'circle-radius', 0);
      }

      // Hide POI/marker fill layers (the gray circles)
      if (layer.type === 'fill' && (id.includes('poi') || id.includes('marker') || id.includes('point') || id.includes('place') || id.includes('transit'))) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        map.setPaintProperty(layer.id, 'fill-opacity', 0);
      }

      // Hide any symbol layer backgrounds
      if (layer.type === 'symbol') {
        try {
          map.setLayoutProperty(layer.id, 'icon-allow-overlap', false);
        } catch (e) {}
      }

      if (layer.type === 'symbol' && (id.includes('poi') || id.includes('transit'))) {
        map.setPaintProperty(layer.id, 'text-opacity', 0);
        map.setPaintProperty(layer.id, 'icon-opacity', 0);
      }

      if (layer.type === 'symbol' && id.includes('road') && id.includes('label')) {
        map.setPaintProperty(layer.id, 'text-opacity', 0);
        map.setPaintProperty(layer.id, 'icon-opacity', 0);
      }

      if (layer.type === 'symbol' && (
        id.includes('shield') ||
        id.includes('route') ||
        id.includes('road-number') ||
        id.includes('road-shield') ||
        id.includes('interstate') ||
        id.includes('motorway-number') ||
        id.includes('ref') ||
        id.includes('road_number') ||
        id.includes('road-number-shield') ||
        id.includes('route-number') ||
        id.includes('number-shield') ||
        id.includes('junction')
      )) {
        try {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (err) {
          // ignore
        }
        map.setPaintProperty(layer.id, 'text-opacity', 0);
        map.setPaintProperty(layer.id, 'icon-opacity', 0);
      }
    } catch (err) {
      // Some layers don't support these properties; safe to ignore.
    }
  }

}

function ensureEnergyTrails() {
  if (!map || map.getSource(ENERGY_SOURCE_ID)) return;

  map.addSource(ENERGY_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: ENERGY_LAYER_ID,
    type: 'line',
    source: ENERGY_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#3dd1ff',
      'line-width': 1.4,
      'line-opacity': 0.35,
      'line-blur': 0.6,
      'line-dasharray': [0.1, 2.0]
    }
  });
}

function updateEnergyTrails(venues) {
  if (!map) return;
  const src = map.getSource(ENERGY_SOURCE_ID);
  if (!src) return;

  const features = [];
  for (const venue of venues) {
    const baseLng = venue.lng;
    const baseLat = venue.lat;
    if (isNaN(baseLng) || isNaN(baseLat)) continue;

    const segments = 3;
    for (let i = 0; i < segments; i++) {
      const offsetLng = baseLng + (Math.random() - 0.5) * 0.004;
      const offsetLat = baseLat + (Math.random() - 0.5) * 0.004;
      const midLng = (baseLng + offsetLng) / 2 + (Math.random() - 0.5) * 0.002;
      const midLat = (baseLat + offsetLat) / 2 + (Math.random() - 0.5) * 0.002;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [baseLng, baseLat],
            [midLng, midLat],
            [offsetLng, offsetLat]
          ]
        }
      });
    }
  }

  src.setData({
    type: 'FeatureCollection',
    features
  });
}

function startEnergyAnimation() {
  if (!map || energyAnimationHandle) return;

  const animate = (t) => {
    if (!map || !map.getLayer(ENERGY_LAYER_ID)) {
      energyAnimationHandle = null;
      return;
    }

    const phase = (t % 1800) / 1800; // 0..1
    const dash = 0.2 + 1.6 * phase;
    map.setPaintProperty(ENERGY_LAYER_ID, 'line-dasharray', [0.1, dash]);
    energyAnimationHandle = requestAnimationFrame(animate);
  };

  energyAnimationHandle = requestAnimationFrame(animate);
}

/**
 * Render markers on the map for the given (filtered) venues.
 */
export function renderMarkers(venues, filters, limitedOffers = []) {
  currentVenues = venues;
  currentLimitedOffers = limitedOffers;
  clearMarkers();
  updateEnergyTrails(venues);

  const features = [];
  lastVenueCount = venues.length;
  lastPromoCount = 0;
  lastLimitedCount = limitedOffers.length;
  lastSuperCount = 0;
  lastSuperShown = 0;

  const now = new Date();
  const todayKey = getDateKey(now);
  const todayKeyPad = getDateKey(now, true);

  for (let i = 0; i < venues.length; i += 1) {
    const venue = venues[i];
    const times = venue.times || {};
    const timeStr = times[todayKey] || times[todayKeyPad] || '';
    if (!timeStr) continue;

    const state = getEventLifecycleState(timeStr);
    if (!state) continue;

    const promoType = (venue.promotionType || '').toLowerCase();
    let icon = 'icon-menu';
    let color = ORANGE_COLOR;
    let strokeColor = ORANGE_STROKE;
    if (promoType.includes('happy')) {
      icon = 'icon-happy';
      color = ORANGE_COLOR;
      strokeColor = ORANGE_STROKE;
    } else if (promoType.includes('special')) {
      icon = 'icon-special';
      color = SPECIAL_COLOR;
      strokeColor = SPECIAL_STROKE;
    } else if (promoType.includes('pop')) {
      icon = 'icon-popup';
      color = POPUP_COLOR;
      strokeColor = POPUP_STROKE;
    } else if (promoType.includes('distinct')) {
      icon = 'icon-menu';
      color = ORANGE_COLOR;
      strokeColor = ORANGE_STROKE;
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [venue.lng, venue.lat] },
      properties: {
        opacity: state.opacity,
        glow: state.glow,
        pulse: state.pulse,
        color,
        strokeColor,
        popupType: 'event',
        label: venue.name,
        icon,
        index: i,
        timeStr,
        dateKey: todayKey
      }
    });
  }

  if (!map) return;
  lastVisibleCount = features.length;

  const setOfferData = (items) => {
    ensureOffersLayer();
    const src = map.getSource(OFFERS_SOURCE_ID);
    if (!src) return false;
    src.setData({ type: 'FeatureCollection', features: items });
    pendingOfferFeatures = items;
    lastOfferFeatureCount = items.length;
    updateDebugPanel();
    return true;
  };

  if (!map.isStyleLoaded()) {
    pendingOfferFeatures = features;
    const trySet = () => {
      if (!map) return;
      if (!map.isStyleLoaded()) {
        map.once('styledata', trySet);
        return;
      }
      if (setOfferData(pendingOfferFeatures || [])) {
        pendingOfferFeatures = null;
      }
    };
    map.once('styledata', trySet);
    return;
  }

  setOfferData(features);
  updateDebugPanel();
}

function updateDebugPanel() {
  if (!map) return;
  ensureDebugPanel();

  const hasSource = !!map.getSource(OFFERS_SOURCE_ID);
  const hasLayer = !!map.getLayer(OFFERS_LAYER_ID);
  const hasDebug = !!map.getLayer('offers-debug');
  const styleLoaded = map.isStyleLoaded();

  debugPanel.textContent = `offers: ${lastOfferFeatureCount} · visible ${lastVisibleCount} · venues ${lastVenueCount} · promos ${lastPromoCount} · limited ${lastLimitedCount} · super ${lastSuperShown}/${lastSuperCount} · source ${hasSource ? 'yes' : 'no'} · layer ${hasLayer ? 'yes' : 'no'} · debug ${hasDebug ? 'yes' : 'no'} · style ${styleLoaded ? 'ok' : 'wait'}`;
}

/**
 * Fit map bounds to show all given venues.
 */
export function fitToVenues(venues) {
  if (!venues.length) return;

  const bounds = new mapboxgl.LngLatBounds();
  for (const v of venues) {
    if (!isNaN(v.lat) && !isNaN(v.lng)) {
      bounds.extend([v.lng, v.lat]);
    }
  }

  map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
}
