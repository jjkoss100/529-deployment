// --- Configuration ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQpj4lehM7ElDgkUxZHkQ_ZrZhGX4HwIkK-pBuA-siErJ0YG0ahpfYYJqSqoAq5-Fpj8tL6j0DyK-by/pub?gid=6430153&single=true&output=csv';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoiamprb3NzMTAiLCJhIjoiY21sZnl3NnN3MDZoNTNlb2s1MnczMWVwbSJ9.HDXt8N0fEOpSvSGhKp6jRg';
const MAP_CENTER = [-118.469, 33.989];
const MAP_ZOOM = 14;
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const SOURCE_ID = 'venues';
const LAYER_ID = 'venue-markers';
const LNG_OFFSET = 0.00012;
const GLOW_LAYER_ID = 'venue-glow';
const PRESHOW_HOURS = 5;
const REFRESH_INTERVAL = 60000; // re-filter every 60s

// --- Get current time in LA timezone as minutes since midnight ---
function getLAMinutes() {
  const now = new Date();
  const laTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return laTime.getHours() * 60 + laTime.getMinutes();
}

// --- Parse "HH:MM" to minutes since midnight ---
function parseMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

// --- Toggle state (persisted across refreshes) ---
let currentMode = localStorage.getItem('529-mode') || 'now';

// --- Check if a deal is currently active (NOW mode) ---
// Active = current LA time falls within the live window (start ≤ now ≤ end).
// Deals with no liveWindow are always shown in NOW mode.
function isDealActiveNow(deal) {
  if (!deal.liveWindow) return true;

  const nowMin = getLAMinutes();
  const ranges = deal.liveWindow.split(',');

  for (const range of ranges) {
    const parts = range.trim().split('-');
    if (parts.length !== 2) continue;

    const start = parseMinutes(parts[0].trim());
    const end = parseMinutes(parts[1].trim());
    if (start === null || end === null) continue;

    const crossesMidnight = end <= start;

    if (crossesMidnight) {
      // e.g. 22:00-02:00 — active if now >= start OR now <= end
      if (nowMin >= start || nowMin <= end) return true;
    } else {
      // e.g. 15:00-18:00 — active if start <= now <= end
      if (nowMin >= start && nowMin <= end) return true;
    }
  }

  return false;
}

// --- Check if a deal is coming soon (SOON mode) ---
// Coming soon = starts within the next 5 hours AND is NOT currently active.
// Deals with no liveWindow are never shown in SOON mode.
function isDealComingSoon(deal) {
  if (!deal.liveWindow) return false;
  if (isDealActiveNow(deal)) return false;

  const nowMin = getLAMinutes();
  const ranges = deal.liveWindow.split(',');

  for (const range of ranges) {
    const parts = range.trim().split('-');
    if (parts.length !== 2) continue;

    const start = parseMinutes(parts[0].trim());
    if (start === null) continue;

    // Minutes until start (handles midnight wrap)
    let minsUntilStart = start - nowMin;
    if (minsUntilStart < 0) minsUntilStart += 1440; // wrap to next day

    if (minsUntilStart <= PRESHOW_HOURS * 60) return true;
  }

  return false;
}

// --- Check if a deal's start time is still ahead of now (hasn't started yet) ---
function isDealStillAhead(deal) {
  if (!deal.liveWindow) return false;

  const nowMin = getLAMinutes();
  const ranges = deal.liveWindow.split(',');

  for (const range of ranges) {
    const parts = range.trim().split('-');
    if (parts.length !== 2) continue;

    const start = parseMinutes(parts[0].trim());
    if (start === null) continue;

    // Deal is still ahead if start > now (same day)
    // or if start is small (early morning tomorrow, e.g. 01:00) and now is evening
    if (start > nowMin) return true;
    if (start < 6 * 60 && nowMin > 12 * 60) return true; // early morning = tomorrow
  }

  return false;
}

// --- Debug panel ---
function updateDebugPanel(venues) {
  const el = document.getElementById('debug-panel');
  if (!el) return;

  const now = new Date();
  const laStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();

  // Count deals that are NOT active and NOT coming soon (more than 5h out, still waiting)
  const queued = venues.filter(v => v.liveWindow && !isDealActiveNow(v) && !isDealComingSoon(v) && isDealStillAhead(v));
  const active = venues.filter(v => v.liveWindow && isDealActiveNow(v));

  if (queued.length > 0) {
    el.style.display = '';
    el.textContent = `${queued.length} deal${queued.length !== 1 ? 's' : ''} still coming later today...`;
  } else if (active.length > 0) {
    el.style.display = 'none';
  } else {
    // Today is over — show tomorrow's deal count
    const total = venues.filter(v => v.liveWindow).length;
    el.style.display = '';
    el.textContent = `${total} deal${total !== 1 ? 's' : ''} loading for tomorrow...`;
  }
}

// --- Time formatting: 24h → 12h ---
function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return timeStr;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`;
}

function formatLiveWindow(liveWindow) {
  if (!liveWindow) return '';
  return liveWindow.split(',').map(range => {
    const parts = range.trim().split('-');
    if (parts.length !== 2) return range.trim();
    return `${formatTime12h(parts[0].trim())} – ${formatTime12h(parts[1].trim())}`;
  }).join(', ');
}

// --- Popup HTML builder ---
function buildPopupHTML(props) {
  const name = props.name || '';
  const notes = props.notes || '';
  const time = formatLiveWindow(props.liveWindow);
  const link = props.link || '';
  const instagram = props.instagram || '';

  let html = `<div class="venue-popup">`;
  if (instagram) {
    html += `<a class="venue-popup__name venue-popup__name--link" href="${instagram}" target="_blank" rel="noopener noreferrer">${name}</a>`;
  } else {
    html += `<div class="venue-popup__name">${name}</div>`;
  }
  if (notes) html += `<div class="venue-popup__notes">${notes}</div>`;
  if (time) html += `<div class="venue-popup__time">${time}</div>`;
  if (link) {
    html += `<a class="venue-popup__link" href="${link}" target="_blank" rel="noopener noreferrer">`;
    html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    html += `</a>`;
  }
  html += `</div>`;
  return html;
}

// --- SVG Marker Icons ---
const MARKER_SVGS = {
  'Special': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path fill="#3b82f6" d="M32 4 L39.5 24.5 L60 24.5 L43 38 L49 58 L32 46 L15 58 L21 38 L4 24.5 L24.5 24.5 Z"/>
  </svg>`,

  'Happy Hour': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="18" fill="none" stroke="#f97316" stroke-width="8"/>
  </svg>`,

  'Distinct Menu': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="22" fill="#f97316"/>
  </svg>`,

  'Limited': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path fill="#a855f7" d="M32 6 L58 32 L32 58 L6 32 Z"/>
  </svg>`,

  'Pop-up': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path fill="#ef4444" d="M32 6 L58 56 L6 56 Z"/>
  </svg>`,
};

// --- SVG Helper ---
function makeSvgData(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- Load marker images into Mapbox ---
function loadMarkerImages(map) {
  return Promise.all(
    Object.entries(MARKER_SVGS).map(([promoType, svg]) => {
      return new Promise((resolve) => {
        const imageId = `marker-${promoType}`;
        if (map.hasImage(imageId)) { resolve(); return; }
        const img = new Image(64, 64);
        img.onload = () => {
          if (!map.hasImage(imageId)) {
            map.addImage(imageId, img, { pixelRatio: 2 });
          }
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load marker image for "${promoType}"`);
          resolve();
        };
        img.src = makeSvgData(svg);
      });
    })
  );
}

// --- Fetch and parse CSV ---
async function fetchAndParseCSV(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CSV fetch failed: HTTP ${response.status}`);
  const csvText = await response.text();

  // Find header row (CSV has junk rows before it)
  const lines = csvText.split('\n');
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (lines[i].includes('Venue') && lines[i].includes('Promotion Type')) {
      headerIndex = i;
      break;
    }
  }
  const cleanedCSV = lines.slice(headerIndex).join('\n');

  const parsed = Papa.parse(cleanedCSV, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  const venues = [];
  const rows = parsed.data || [];

  for (const row of rows) {
    const name = (row['Venue'] || '').trim();
    if (!name) continue;

    const lng = parseFloat(row['Long']);
    const lat = parseFloat(row['Lat']);
    if (isNaN(lng) || isNaN(lat)) continue;

    const promoType = (row['Promotion Type'] || '').trim();
    if (!MARKER_SVGS[promoType]) {
      console.warn(`Unknown promotion type "${promoType}" for "${name}", skipping`);
      continue;
    }

    venues.push({
      name,
      lng,
      lat,
      instagram: (row['Venue Instagram'] || '').trim(),
      eventName: (row['Event Name/Description'] || '').trim(),
      promotionType: promoType,
      link: (row['Link'] || '').trim(),
      notes: (row['Notes'] || '').trim(),
      liveWindow: (row['Live Window'] || '').trim(),
    });
  }

  return venues;
}

// --- Build GeoJSON from venues (filtered by current mode) ---
function buildGeoJSON(venues) {
  const filterFn = currentMode === 'now' ? isDealActiveNow : isDealComingSoon;
  const visible = venues.filter(filterFn);
  console.log(`[${currentMode.toUpperCase()}] Showing ${visible.length} of ${venues.length} deals`);

  // Group by venue name to offset overlapping markers
  const byName = new Map();
  for (const v of visible) {
    if (!byName.has(v.name)) byName.set(v.name, []);
    byName.get(v.name).push(v);
  }

  const features = [];
  for (const [name, group] of byName) {
    for (let i = 0; i < group.length; i++) {
      const v = group[i];
      const offset = group.length > 1
        ? (i - (group.length - 1) / 2) * LNG_OFFSET
        : 0;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [v.lng + offset, v.lat]
        },
        properties: {
          name: v.name,
          promotionType: v.promotionType,
          icon: `marker-${v.promotionType}`,
          eventName: v.eventName,
          liveWindow: v.liveWindow,
          notes: v.notes,
          link: v.link,
          instagram: v.instagram,
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// --- Add venue layer to map ---
function addVenueLayer(map, geojson) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 0.675,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,

      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-size': 16.5,
      'text-offset': [1.5, 0],
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-optional': true,
      'text-max-width': 12,
    },
    paint: {
      'icon-opacity': 1,
      'text-color': '#d6deeb',
      'text-halo-color': '#07090f',
      'text-halo-width': 1.2,
    }
  });
}

// --- Popup interactions (hover on desktop, click on mobile) ---
function setupPopups(map) {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'venue-mapbox-popup',
    maxWidth: '260px',
    offset: 12,
  });

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    // Mobile: click to open, click elsewhere to close
    map.on('click', LAYER_ID, (e) => {
      const feature = e.features[0];
      popup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(buildPopupHTML(feature.properties))
        .addTo(map);

      const popupEl = popup.getElement();
      if (popupEl) popupEl.addEventListener('click', (ev) => ev.stopPropagation());
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
      if (!features.length) popup.remove();
    });
  } else {
    // Desktop: hover to show, delayed hide so user can reach the popup
    let closeTimer = null;

    const cancelClose = () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    };

    const scheduleClose = () => {
      cancelClose();
      closeTimer = setTimeout(() => {
        popup.remove();
        map.getCanvas().style.cursor = '';
      }, 350);
    };

    map.on('mouseenter', LAYER_ID, (e) => {
      cancelClose();
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      popup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(buildPopupHTML(feature.properties))
        .addTo(map);

      // Keep popup alive while hovering its content & stop link clicks from hitting the map
      const el = popup.getElement();
      if (el) {
        el.addEventListener('mouseenter', cancelClose);
        el.addEventListener('mouseleave', scheduleClose);
        el.addEventListener('click', (ev) => ev.stopPropagation());
      }
    });

    map.on('mouseleave', LAYER_ID, scheduleClose);
  }
}

// --- Toggle setup ---
function setupToggle(map, venues) {
  const btns = document.querySelectorAll('.mode-toggle__btn');

  // Restore saved toggle state on load
  btns.forEach(b => {
    b.classList.toggle('mode-toggle__btn--active', b.dataset.mode === currentMode);
  });

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === currentMode) return;

      currentMode = mode;
      localStorage.setItem('529-mode', mode);

      // Update active class
      btns.forEach(b => b.classList.remove('mode-toggle__btn--active'));
      btn.classList.add('mode-toggle__btn--active');

      // Re-filter and update map
      const updated = buildGeoJSON(venues);
      map.getSource(SOURCE_ID).setData(updated);
      updateDebugPanel(venues);
    });
  });
}

// --- Initialize Mapbox map ---
function initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    minZoom: 12,
    maxZoom: 18,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  return map;
}

// --- Main init ---
async function init() {
  try {
    const map = initMap();

    map.on('load', async () => {
      await loadMarkerImages(map);

      const venues = await fetchAndParseCSV(CSV_URL);
      console.log(`Loaded ${venues.length} venues`);

      if (venues.length === 0) {
        console.warn('No venues loaded from CSV');
        return;
      }

      const geojson = buildGeoJSON(venues);
      addVenueLayer(map, geojson);

      // --- Effect 1: Fog & atmosphere ---
      map.setFog({
        'range': [-1, 8],
        'horizon-blend': 0.3,
        'color': '#1a1a2e',
        'high-color': '#0f1419',
        'space-color': '#050810',
        'star-intensity': 0.6
      });

      // --- Effect 2: Water breathing animation ---
      setInterval(() => {
        const t = (Math.sin(Date.now() / 3000) + 1) / 2;
        const opacity = 0.5 + t * 0.2;
        map.setPaintProperty('water', 'fill-opacity', opacity);
      }, 50);

      // --- Effect 3: Pulsing glow rings behind markers ---
      map.addLayer({
        id: GLOW_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 18,
          'circle-color': [
            'match', ['get', 'promotionType'],
            'Special',       '#3b82f6',
            'Happy Hour',    '#f97316',
            'Distinct Menu', '#f97316',
            'Limited',       '#a855f7',
            'Pop-up',        '#ef4444',
            '#22c55e'
          ],
          'circle-opacity': 0.25,
          'circle-blur': 0.8,
        }
      }, LAYER_ID);

      let glowFrame = 0;
      setInterval(() => {
        glowFrame++;
        const t = (Math.sin(glowFrame * 0.06) + 1) / 2;
        map.setPaintProperty(GLOW_LAYER_ID, 'circle-radius', 16 + t * 10);
        map.setPaintProperty(GLOW_LAYER_ID, 'circle-opacity', 0.15 + t * 0.18);
      }, 50);

      setupPopups(map);
      setupToggle(map, venues);
      updateDebugPanel(venues);

      // Fit map to venue bounds
      const bounds = new mapboxgl.LngLatBounds();
      for (const v of venues) {
        bounds.extend([v.lng, v.lat]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });

      // Auto-refresh: re-filter venues as time passes
      setInterval(() => {
        const updated = buildGeoJSON(venues);
        map.getSource(SOURCE_ID).setData(updated);
        updateDebugPanel(venues);
      }, REFRESH_INTERVAL);
    });

    // Re-register images if style reloads
    map.on('styleimagemissing', () => {
      loadMarkerImages(map);
    });

  } catch (err) {
    console.error('Init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
