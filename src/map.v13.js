import { getCurrentDayName, parseTimeRange, formatTimeNoPeriod } from './utils.js';

const LNG_OFFSET = 0.00012; // Offset for dual markers side by side

let map = null;
let markers = [];
let openPopup = null;
let energyAnimationHandle = null;
let debugPanel = null;

const ENERGY_SOURCE_ID = 'energy-trails';
const ENERGY_LAYER_ID = 'energy-trails-line';

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
const MAX_SIZE = 32;        // Consistent marker size

/**
 * Compute the visual lifecycle state of a marker based on current time.
 * Works for both HH and special promotions.
 * @param {Array} promotions - array of promotion objects (happyHours or specials)
 * Returns null if marker should be hidden, or { size, opacity, phase } where:
 *   phase: 'preshow' | 'active'
 */
function getMarkerLifecycleState(promotions) {
  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Collect all today's time ranges across all promotion entries
  const todayRanges = [];
  for (const promo of promotions) {
    const dayHours = promo.hours[dayName];
    if (dayHours && dayHours.length > 0) {
      for (const rangeStr of dayHours) {
        const range = parseTimeRange(rangeStr);
        if (range) todayRanges.push(range);
      }
    }
  }

  if (todayRanges.length === 0) return null;

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
      // Active — constant size, fade out over duration (ease-out)
      let elapsed;
      if (range.end > range.start) {
        elapsed = currentMinutes - range.start;
      } else {
        // Midnight crossing
        elapsed = currentMinutes >= range.start
          ? currentMinutes - range.start
          : (1440 - range.start) + currentMinutes;
      }
      const progress = Math.min(elapsed / duration, 1); // 0 at start, 1 at end
      const opacity = Math.max(0.02, 0.4 * (1 - progress)); // subtle fade with low floor
      return { size: MAX_SIZE, opacity: parseFloat(opacity.toFixed(2)), phase: 'active' };
    }

    // Check if in preshow window (30min before start)
    if (currentMinutes >= preshowStart && currentMinutes < range.start) {
      // Preshow: constant size with pulse animation
      return { size: MAX_SIZE, opacity: 0.4, phase: 'preshow' };
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
  const el = document.createElement('img');
  el.classList.add(type === 'hh' ? 'marker-hh' : 'marker-special');
  if (opts.phase === 'preshow') {
    el.classList.add('marker-preshow');
  }
  if (opts.opacity !== undefined && opts.opacity < 0.2) {
    el.classList.add('marker-fading');
  }
  el.style.cursor = 'pointer';
  el.style.display = 'block';
  el.style.background = 'transparent';
  el.style.border = 'none';
  el.style.transition = 'width 0.5s ease, height 0.5s ease, opacity 0.5s ease';

  let svgContent;
  if (type === 'hh') {
    const size = opts.size || MAX_SIZE;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.setProperty('--marker-opacity', (opts.opacity !== undefined ? opts.opacity : 1).toString());
    // Preshow: muted grey smiley; Active: bright yellow smiley
    const isActive = opts.phase === 'active';
    const faceColor = isActive ? '%23f9c922' : '%23777';
    const outlineColor = isActive ? '%23222' : '%23444';
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${faceColor}" stroke="${outlineColor}" stroke-width="3"/><ellipse cx="36" cy="40" rx="6" ry="9" fill="${outlineColor}"/><ellipse cx="64" cy="40" rx="6" ry="9" fill="${outlineColor}"/><path d="M28 60 Q50 82 72 60" fill="none" stroke="${outlineColor}" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  } else {
    const size = opts.size || MAX_SIZE;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.setProperty('--marker-opacity', (opts.opacity !== undefined ? opts.opacity : 1).toString());
    const isActive = opts.phase === 'active';
    // Preshow: muted grey star; Active: bold green star with dark outline
    const fillColor = isActive ? '%2315b312' : '%23666';
    const strokeColor = isActive ? '%23000' : '%23888';
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M60 6 L74 44 L114 44 L80 67 L94 108 L60 84 L26 108 L40 67 L6 44 L46 44 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="5" stroke-linejoin="round"/></svg>`;
  }

  el.src = 'data:image/svg+xml,' + svgContent;
  return el;
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
  for (const promo of promotions) {
    const dayHours = promo.hours[dayName];
    if (dayHours && dayHours.length > 0) {
      for (const rangeStr of dayHours) {
        const range = parseTimeRange(rangeStr);
        if (range) todayRanges.push(range);
      }
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
          ? (range.end - currentMinutes) <= 30
          : ((1440 - currentMinutes) + range.end) <= 30
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
  const typeLabel = isHH ? 'Happy Hour' : 'Special';
  const headerClass = isHH ? 'popup-header--hh' : 'popup-header--special';
  const igSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#405de6"/><stop offset="15%" stop-color="#5851db"/><stop offset="30%" stop-color="#833ab4"/><stop offset="45%" stop-color="#c13584"/><stop offset="60%" stop-color="#e1306c"/><stop offset="72%" stop-color="#fd1d1d"/><stop offset="82%" stop-color="#f56040"/><stop offset="90%" stop-color="#f77737"/><stop offset="96%" stop-color="#fcaf45"/><stop offset="100%" stop-color="#ffdc80"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" stroke="url(#ig-grad)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const menuSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M3 6h1M8 12h13M3 12h1M8 18h13M3 18h1"/></svg>`;

  let html = `<div class="popup-card">`;

  // Header banner
  html += `<div class="popup-header ${headerClass}">`;
  html += `<span class="popup-header-label">${typeLabel}</span>`;
  html += `<div class="popup-header-actions">`;
  html += `<button class="popup-header-close" onclick="this.closest('.mapboxgl-popup').remove()">&#215;</button>`;
  html += `</div>`;
  html += `</div>`;

  // Body
  html += `<div class="popup-body">`;

  // Venue name
  html += `<h3 class="popup-venue-name">${escapeHtml(venue.name)}</h3>`;

  // Description
  if (venue.description) {
    html += `<p class="popup-description">${escapeHtml(venue.description)}</p>`;
  }

  // Filter to only currently relevant promotions (active or in preshow)
  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const relevantPromos = promotions.filter(promo => {
    const dayHours = promo.hours[dayName];
    if (!dayHours || dayHours.length === 0) return false;
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
    return false;
  });
  const displayPromos = relevantPromos.length > 0 ? relevantPromos : promotions;

  // Specials: show notes if present
  if (type === 'special') {
    const notes = displayPromos.map(p => p.notes).find(n => n && n.trim());
    if (notes) {
      html += `<p class="popup-notes">${escapeHtml(notes)}</p>`;
    }
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
  if (venue.instagram) {
    html += `<a class="popup-ig-link" href="${escapeHtml(venue.instagram)}" target="_blank" rel="noopener">${igSvg}</a>`;
  }
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
export function renderMarkers(venues, filters) {
  clearMarkers();
  updateEnergyTrails(venues);

  const debugEnabled =
    window.location.search.includes('debug=1') ||
    window.location.search.includes('debug=true') ||
    window.location.search.includes('debug') ||
    window.location.hash.includes('debug') ||
    window.localStorage.getItem('debug') === '1';
  if (debugEnabled) {
    updateDebugPanel(venues);
  }

  for (const venue of venues) {
    const hasHH = venue.happyHours.length > 0;
    const hasSpecials = venue.specials.length > 0;

    // Should we show this venue based on promotion type filter?
    let showHH = hasHH && (filters.promotionType === 'all' || filters.promotionType === 'happy-hour');
    let showSp = hasSpecials && (filters.promotionType === 'all' || filters.promotionType === 'special');

    // When "Active Now" is on, only show markers for currently active promotions
    if (filters.activeOnly && filters.selectedDay === 'today') {
      if (showHH && !venue.hasActiveHappyHour) showHH = false;
      if (showSp && !venue.hasActiveSpecial) showSp = false;
    }

    // Apply lifecycle: only show markers in preshow/active windows
    let hhState = null;
    let spState = null;

    if (showHH) {
      hhState = getMarkerLifecycleState(venue.happyHours);
      if (!hhState) showHH = false;
    }
    if (showSp) {
      spState = getMarkerLifecycleState(venue.specials);
      if (!spState) showSp = false;
    }

    // Note: no fallback to full opacity; lifecycle controls visibility + fade.

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
}

function updateDebugPanel(venues) {
  if (!debugPanel) {
    debugPanel = document.createElement('div');
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '16px';
    debugPanel.style.left = '16px';
    debugPanel.style.zIndex = '10000';
    debugPanel.style.background = 'rgba(0,0,0,0.85)';
    debugPanel.style.color = '#00ff88';
    debugPanel.style.padding = '8px 10px';
    debugPanel.style.fontFamily = 'monospace';
    debugPanel.style.fontSize = '11px';
    debugPanel.style.border = '2px solid #ff3b30';
    debugPanel.style.whiteSpace = 'pre';
    document.body.appendChild(debugPanel);
  }

  const now = new Date();
  const dayName = getCurrentDayName();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targets = ['The Butcher\'s Daughter', '26 Beach', 'Nalu Vida'];

  const lines = [];
  lines.push(`Time: ${now.toLocaleTimeString()} (${dayName})`);
  for (const name of targets) {
    const venue = venues.find(v => v.name === name);
    if (!venue) {
      lines.push(`${name}: not found`);
      continue;
    }
    const specialsRanges = (venue.specials || []).flatMap(p => (p.hours[dayName] || []));
    const hhRanges = (venue.happyHours || []).flatMap(p => (p.hours[dayName] || []));
    lines.push(`${name}:`);
    lines.push(`  HH ranges: ${hhRanges.join(', ') || 'none'}`);
    lines.push(`  SP ranges: ${specialsRanges.join(', ') || 'none'}`);
    lines.push(`  hasActiveHH=${venue.hasActiveHappyHour} hasActiveSP=${venue.hasActiveSpecial}`);

    const computeDebug = (promotions, label) => {
      if (!promotions || promotions.length === 0) return;
      const ranges = [];
      for (const promo of promotions) {
        const dayHours = promo.hours[dayName];
        if (!dayHours || dayHours.length === 0) continue;
        for (const rangeStr of dayHours) {
          const range = parseTimeRange(rangeStr);
          if (range) ranges.push(range);
        }
      }
      if (ranges.length === 0) return;
      for (const range of ranges) {
        let isInRange = false;
        let duration;
        if (range.end > range.start) {
          isInRange = currentMinutes >= range.start && currentMinutes < range.end;
          duration = range.end - range.start;
        } else {
          isInRange = currentMinutes >= range.start || currentMinutes < range.end;
          duration = (1440 - range.start) + range.end;
        }
        if (!isInRange) continue;
        let elapsed;
        if (range.end > range.start) {
          elapsed = currentMinutes - range.start;
        } else {
          elapsed = currentMinutes >= range.start
            ? currentMinutes - range.start
            : (1440 - range.start) + currentMinutes;
        }
        const progress = Math.min(elapsed / duration, 1);
        const opacity = Math.max(0, 0.9 * (1 - progress));
        lines.push(`  ${label} active range: ${range.start}-${range.end}`);
        lines.push(`  ${label} progress=${progress.toFixed(3)} opacity=${opacity.toFixed(3)}`);
        break;
      }
    };

    computeDebug(venue.happyHours, 'HH');
    computeDebug(venue.specials, 'SP');
  }
  debugPanel.textContent = lines.join('\n');
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
