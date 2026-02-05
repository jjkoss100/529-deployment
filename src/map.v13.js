import { getCurrentDayName, parseTimeRange, formatTimeNoPeriod, getPreviousDayName } from './utils.js?v=13';

const LNG_OFFSET = 0.00012; // Offset for dual markers side by side

let map = null;
let markers = [];
let openPopup = null;
let energyAnimationHandle = null;
let debugPanel = null;

const ENERGY_SOURCE_ID = 'energy-trails';
const ENERGY_LAYER_ID = 'energy-trails-line';

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

  map = new mapboxgl.Map({
    container: containerId,
    style: 'mapbox://styles/mapbox/navigation-night-v1',
    center: [-118.469, 33.989],
    zoom: 14,
    minZoom: 12,
    maxZoom: 18
  });

  // Expose map for debugging (use _map to avoid collision with div#map)
  window._map = map;

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  map.on('load', () => {
    setupMapAtmosphere();
    stylizeBaseLayers();
    ensureEnergyTrails();
    startEnergyAnimation();
  });

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
  for (const m of markers) {
    m.remove();
  }
  markers = [];
  openPopup = null;
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
      return {
        size: MAX_SIZE,
        opacity: parseFloat(opacity.toFixed(2)),
        phase: 'active',
        endingSoon: remaining <= 45,
        glow: parseFloat(glow.toFixed(2))
      };
    }

    // Check if in preshow window (30min before start)
    if (currentMinutes >= preshowStart && currentMinutes < range.start) {
      // Preshow: constant size with vibration animation
      return { size: MAX_SIZE, opacity: 0.8, phase: 'preshow', endingSoon: false, glow: 0 };
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
      return {
        size: MAX_SIZE,
        opacity: parseFloat(opacity.toFixed(2)),
        phase: 'active',
        endingSoon: remaining <= 45,
        glow: parseFloat(glow.toFixed(2))
      };
    }
  }

  // No range is active or in preshow window
  return null;
}

/**
 * Create an HTML element for a marker.
 * For HH markers: size and opacity come from getHHMarkerState().
 * For special markers: uses fixed active/inactive sizes.
 */
function createMarkerElement(type, opts) {
  const container = document.createElement('div');
  container.classList.add('marker-shell');
  container.style.display = 'block';
  container.style.cursor = 'pointer';

  const el = document.createElement('img');
  el.classList.add(type === 'hh' ? 'marker-hh' : 'marker-special');
  if (opts.phase === 'preshow') {
    el.classList.add('marker-preshow');
  }
  const rawGlow = opts.glow !== undefined ? opts.glow : 0;
  const displayGlow = Math.min(1, rawGlow * 1.8);
  if (opts.endingSoon || displayGlow >= 0.5) {
    container.classList.add('marker-urgent');
  }
  container.style.setProperty('--marker-glow', displayGlow.toString());
  el.style.display = 'block';
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.transition = 'width 0.5s ease, height 0.5s ease, opacity 0.5s ease';

  const size = opts.size || MAX_SIZE;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.opacity = (opts.opacity !== undefined ? opts.opacity : 1).toString();
  const coreColor = '%23f26b2d';
  const rimColor = '%23f26b2d';
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="52" fill="${coreColor}" stroke="${rimColor}" stroke-width="6"/>
    </svg>
  `;

  el.src = 'data:image/svg+xml,' + svgContent;
  container.appendChild(el);
  return container;
}

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

function getDateKey(dateObj) {
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const year = dateObj.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
}

function parseOfferRanges(timeStr) {
  if (!timeStr) return [];
  return timeStr
    .split(',')
    .map(s => s.trim())
    .map(s => parseTimeRange(s))
    .filter(Boolean);
}

function getLimitedOfferLifecycleState(timeStr) {
  const ranges = parseOfferRanges(timeStr);
  if (!ranges.length) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
        glow: parseFloat(glow.toFixed(2))
      };
    }

    if (currentMinutes >= preshowStart && currentMinutes < range.start) {
      return { size: MAX_SIZE, opacity: 0.8, phase: 'preshow', endingSoon: false, glow: 0 };
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
  clearMarkers();
  updateEnergyTrails(venues);

  // Debug panel disabled

  for (const venue of venues) {
    const hasHH = venue.happyHours.length > 0;
    const hasSpecials = venue.specials.length > 0;

    // Only show markers when the lifecycle says preshow/active.
    let showHH = false;
    let showSp = false;
    let hhState = null;
    let spState = null;

    if (hasHH) {
      hhState = getMarkerLifecycleState(venue.happyHours);
      showHH = !!hhState;
    }
    if (hasSpecials) {
      spState = getMarkerLifecycleState(venue.specials);
      showSp = !!spState;
    }

    // Recalculate offsets after lifecycle filtering
    const bothVisible = showHH && showSp;
    const finalHHLng = bothVisible ? venue.lng - LNG_OFFSET : venue.lng;
    const finalSpLng = bothVisible ? venue.lng + LNG_OFFSET : venue.lng;

    if (showHH && hhState) {
      const el = createMarkerElement('hh', hhState);
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: true,
        maxWidth: '320px',
        className: 'venue-popup'
      }).setHTML(buildPopupContent(venue, 'hh'));
      popup.on('open', () => {
        const popupEl = popup.getElement();
        if (!popupEl) return;
        const statusEl = popupEl.querySelector('.popup-time-status--soon');
        if (!statusEl) return;
        statusEl.classList.remove('popup-time-status--alert');
        void statusEl.offsetWidth;
        statusEl.classList.add('popup-time-status--alert');
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([finalHHLng, venue.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('mouseenter', () => {
        el.title = venue.name;
      });

      markers.push(marker);
    }

    if (showSp && spState) {
      const el = createMarkerElement('special', spState);
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: true,
        maxWidth: '320px',
        className: 'venue-popup'
      }).setHTML(buildPopupContent(venue, 'special'));
      popup.on('open', () => {
        const popupEl = popup.getElement();
        if (!popupEl) return;
        const statusEl = popupEl.querySelector('.popup-time-status--soon');
        if (!statusEl) return;
        statusEl.classList.remove('popup-time-status--alert');
        void statusEl.offsetWidth;
        statusEl.classList.add('popup-time-status--alert');
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([finalSpLng, venue.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('mouseenter', () => {
        el.title = venue.name;
      });

      markers.push(marker);
    }
  }

  if (limitedOffers.length > 0) {
    const now = new Date();
    const todayKey = getDateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const prevKey = getDateKey(yesterday);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const offer of limitedOffers) {
      let timeStr = offer.times ? offer.times[todayKey] : '';
      if (!timeStr && offer.times && offer.times[prevKey]) {
        const prevRanges = parseOfferRanges(offer.times[prevKey]);
        const isPrevActive = prevRanges.some(r => r.end < r.start && currentMinutes < r.end);
        if (isPrevActive) timeStr = offer.times[prevKey];
      }
      if (!timeStr) continue;

      const offerState = getLimitedOfferLifecycleState(timeStr);
      if (!offerState) continue;

      const el = createMarkerElement('hh', offerState);
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: true,
        maxWidth: '320px',
        className: 'venue-popup'
      }).setHTML(buildLimitedOfferPopup(offer, timeStr));
      popup.on('open', () => {
        const popupEl = popup.getElement();
        if (!popupEl) return;
        const statusEl = popupEl.querySelector('.popup-time-status--soon');
        if (!statusEl) return;
        statusEl.classList.remove('popup-time-status--alert');
        void statusEl.offsetWidth;
        statusEl.classList.add('popup-time-status--alert');
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([offer.lng, offer.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('mouseenter', () => {
        el.title = offer.name;
      });

      markers.push(marker);
    }
  }
}

function updateDebugPanel() {}

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
