// --- Configuration ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQpj4lehM7ElDgkUxZHkQ_ZrZhGX4HwIkK-pBuA-siErJ0YG0ahpfYYJqSqoAq5-Fpj8tL6j0DyK-by/pub?gid=6430153&single=true&output=csv';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoiamprb3NzMTAiLCJhIjoiY21sZnl3NnN3MDZoNTNlb2s1MnczMWVwbSJ9.HDXt8N0fEOpSvSGhKp6jRg';
const MAP_CENTER = [-118.469, 33.989];
const MAP_ZOOM = 14;
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const SOURCE_ID = 'venues';
const LAYER_ID = 'venue-markers';
const LNG_OFFSET = 0.00012;

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
    <path fill="#22c55e" d="M32 4 L39.5 24.5 L60 24.5 L43 38 L49 58 L32 46 L15 58 L21 38 L4 24.5 L24.5 24.5 Z"/>
  </svg>`,

  'Happy Hour': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="22" fill="none" stroke="#facc15" stroke-width="8"/>
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

// --- Build GeoJSON from venues ---
function buildGeoJSON(venues) {
  // Group by venue name to offset overlapping markers
  const byName = new Map();
  for (const v of venues) {
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
      }, 200);
    };

    map.on('mouseenter', LAYER_ID, (e) => {
      cancelClose();
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      popup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(buildPopupHTML(feature.properties))
        .addTo(map);

      // Keep popup alive while hovering its content
      const el = popup.getElement();
      if (el) {
        el.addEventListener('mouseenter', cancelClose);
        el.addEventListener('mouseleave', scheduleClose);
      }
    });

    map.on('mouseleave', LAYER_ID, scheduleClose);
  }
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
      setupPopups(map);

      // Fit map to venue bounds
      const bounds = new mapboxgl.LngLatBounds();
      for (const v of venues) {
        bounds.extend([v.lng, v.lat]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
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
