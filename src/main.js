import { fetchVenues, updateAllVenueStatuses } from './data.js?v=13';
import { initMap, getMap, renderMarkers, fitToVenues } from './map.v13.js?v=35';

// --- Configuration ---
// Replace with your published Google Sheet CSV URL
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQpj4lehM7ElDgkUxZHkQ_ZrZhGX4HwIkK-pBuA-siErJ0YG0ahpfYYJqSqoAq5-Fpj8tL6j0DyK-by/pub?gid=0&single=true&output=csv';

// Replace with your Mapbox access token
const MAPBOX_TOKEN = 'pk.eyJ1Ijoiamprb3NzMTAiLCJhIjoiY21rdWp1YWFhMjJ1djNjcTJjcjRpYWNhZSJ9.ExODQ-GDFl9NHFl7NE9IxQ';

const REFRESH_INTERVAL = 30000; // 30 seconds — frequent for smooth marker lifecycle
const WEATHER_COORDS = { lat: 33.994975, lng: -118.466552 };
const WEATHER_TIMEZONE = 'America/Los_Angeles';
const WEATHER_REFRESH_MS = 15 * 60 * 1000; // 15 minutes

// --- State ---
let allVenues = [];

/**
 * Main app initialization.
 */
async function init() {
  try {
  ensureCovertOverlay();
  // Initialize map
  console.log('Initializing map...');
  const map = initMap('map', MAPBOX_TOKEN);
  console.log('Map initialized');

  // Fetch and parse venue data
  allVenues = await fetchVenues(CSV_URL);

  if (allVenues.length === 0) {
    console.warn('No venues loaded. Check CSV URL.');
    return;
  }

  console.log(`Loaded ${allVenues.length} venues`);

  // Default filter state (no panel, show all active)
  const defaultFilters = {
    activeOnly: false,
    promotionType: 'all',
    selectedDay: 'today',
    neighborhoods: [],
    menuCategories: [],
    hasWeekendHours: false
  };

  // Initial render — show all venues
  renderMarkers(allVenues, defaultFilters);

  // Fit map to show all venues once loaded
  if (map.loaded()) {
    fitToVenues(allVenues);
  } else {
    map.on('load', () => fitToVenues(allVenues));
  }

  // Start auto-refresh timer
  startAutoRefresh();

  // Setup geolocation button
  setupGeolocation();

  // Start weather widget
  setupWeather();

  // Soften the covert overlay once the UI is live
  const overlay = document.getElementById('covert-overlay');
  if (overlay) {
    requestAnimationFrame(() => {
      setTimeout(() => overlay.classList.add('covert-overlay--hide'), 900);
    });
    overlay.addEventListener('animationend', () => {
      overlay.remove();
    }, { once: true });
  }

  } catch (err) {
    console.error('Init error:', err);
    document.body.style.background = 'white';
    document.body.style.color = 'black';
    document.body.innerHTML = `<pre style="padding:20px">Error: ${err.message}\n\n${err.stack}</pre>`;
  }
}


/**
 * Auto-refresh venue statuses every 60 seconds.
 */
function startAutoRefresh() {
  const defaultFilters = {
    activeOnly: false,
    promotionType: 'all',
    selectedDay: 'today',
    neighborhoods: [],
    menuCategories: [],
    hasWeekendHours: false
  };
  setInterval(() => {
    updateAllVenueStatuses(allVenues);
    renderMarkers(allVenues, defaultFilters);
  }, REFRESH_INTERVAL);
}

/**
 * Setup geolocation "near me" button.
 */
function setupGeolocation() {
  const btn = document.getElementById('geo-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      btn.title = 'Geolocation not supported';
      return;
    }

    btn.classList.add('geo-btn--loading');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        getMap().flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15
        });
        btn.classList.remove('geo-btn--loading');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        btn.classList.remove('geo-btn--loading');
        btn.title = 'Location access denied';
      }
    );
  });
}

function setupWeather() {
  const widget = ensureWeatherWidget();
  if (!widget) return;
  fetchWeather();
  setInterval(fetchWeather, WEATHER_REFRESH_MS);
}

async function fetchWeather() {
  const widget = ensureWeatherWidget();
  if (!widget) return;

  const { lat, lng } = WEATHER_COORDS;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=sunrise,sunset` +
    `&forecast_hours=24&timezone=${encodeURIComponent(WEATHER_TIMEZONE)}` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
    `&current=wave_height,wave_period,sea_surface_temperature` +
    `&hourly=wave_height,wave_period,sea_surface_temperature` +
    `&temperature_unit=fahrenheit&timezone=${encodeURIComponent(WEATHER_TIMEZONE)}`;

  try {
    const [response, marineResponse] = await Promise.all([fetch(url), fetch(marineUrl)]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const marineData = marineResponse.ok ? await marineResponse.json() : null;
    updateWeatherWidget(data, marineData);
  } catch (err) {
    console.warn('Weather fetch failed:', err);
    renderWeatherError();
  }
}

function ensureUiLayer() {
  let layer = document.getElementById('ui-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'ui-layer';
  document.body.appendChild(layer);
  return layer;
}

function ensureWeatherWidget() {
  const layer = ensureUiLayer();
  let widget = document.getElementById('weather-widget');
  if (widget) {
    widget.style.position = 'fixed';
    widget.style.top = '16px';
    widget.style.left = '16px';
    widget.style.zIndex = '9999';
    return widget;
  }

  widget = document.createElement('div');
  widget.id = 'weather-widget';
  widget.className = 'weather-widget';
  widget.innerHTML = `
    <div class="weather-title">VENICE BEACH <span class="weather-title-sup">529</span></div>
    <div class="weather-current">
      <div class="weather-temp" id="weather-temp">--°</div>
      <div class="weather-meta">
        <div class="weather-summary" id="weather-summary">Loading...</div>
        <div class="weather-details" id="weather-details"></div>
      </div>
    </div>
    <div class="weather-third">
      <div class="weather-tonight" id="weather-tonight"></div>
      <div class="weather-extras">
        <div class="weather-extra-row" id="sun-times"></div>
        <div class="weather-extra-row" id="moon-phase"></div>
        <div class="weather-extra-row" id="astro-tidbit"></div>
        <div class="weather-extra-row" id="surf-conditions"></div>
      </div>
    </div>
  `;

  layer.appendChild(widget);
  widget.style.position = 'fixed';
  widget.style.top = '16px';
  widget.style.left = '16px';
  widget.style.zIndex = '9999';
  return widget;
}

function ensureCovertOverlay() {
  if (document.getElementById('covert-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'covert-overlay';
  overlay.className = 'covert-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="covert-overlay__inner">
      <div class="covert-overlay__tag covert-overlay__tag--headline">SCANNING LOCAL DEALS...</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateWeatherWidget(data, marineData) {
  const tempEl = document.getElementById('weather-temp');
  const summaryEl = document.getElementById('weather-summary');
  const detailsEl = document.getElementById('weather-details');
  const tonightEl = document.getElementById('weather-tonight');
  const sunEl = document.getElementById('sun-times');
  const moonEl = document.getElementById('moon-phase');
  const astroEl = document.getElementById('astro-tidbit');
  const surfEl = document.getElementById('surf-conditions');
  if (!tempEl || !summaryEl || !detailsEl || !tonightEl) return;

  const current = data.current;
  if (!current) {
    renderWeatherError();
    return;
  }

  const currentTemp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const wind = Math.round(current.wind_speed_10m);
  const currentLabel = getWeatherLabel(current.weather_code);

  tempEl.textContent = `${currentTemp}°`;
  summaryEl.textContent = currentLabel;
  detailsEl.textContent = `Feels like ${feelsLike}°F • Wind ${wind} mph`;

  const tonight = buildTonightOutlook(data);
  if (tonight) {
    tonightEl.textContent = `Tonight: ${tonight}`;
  } else {
    tonightEl.textContent = '';
  }

  const sunTimes = getSunTimes(data);
  if (sunEl) sunEl.textContent = sunTimes || '';

  const moonInfo = getMoonInfo();
  if (moonEl) moonEl.textContent = moonInfo.phaseText;
  if (astroEl) astroEl.textContent = moonInfo.astroText;

  if (surfEl) {
    const surf = getSurfConditions(marineData);
    surfEl.textContent = surf || '';
  }
}

function renderWeatherError() {
  const summaryEl = document.getElementById('weather-summary');
  const detailsEl = document.getElementById('weather-details');
  const tonightEl = document.getElementById('weather-tonight');
  const tempEl = document.getElementById('weather-temp');
  if (summaryEl) summaryEl.textContent = 'Weather unavailable';
  if (detailsEl) detailsEl.textContent = 'Check connection';
  if (tonightEl) tonightEl.textContent = '';
  if (tempEl) tempEl.textContent = '--°';
  const sunEl = document.getElementById('sun-times');
  const moonEl = document.getElementById('moon-phase');
  const astroEl = document.getElementById('astro-tidbit');
  const surfEl = document.getElementById('surf-conditions');
  if (sunEl) sunEl.textContent = '';
  if (moonEl) moonEl.textContent = '';
  if (astroEl) astroEl.textContent = '';
  if (surfEl) surfEl.textContent = '';
}

function buildTonightOutlook(data) {
  const hourly = data.hourly;
  if (!hourly || !hourly.time || hourly.time.length === 0) return null;

  const now = new Date();
  const start = new Date(now);
  if (start.getHours() < 18) {
    start.setHours(18, 0, 0, 0);
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(2, 0, 0, 0);

  const times = hourly.time;
  const temps = hourly.temperature_2m || [];
  const precip = hourly.precipitation_probability || [];
  const codes = hourly.weather_code || [];

  const window = [];
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= start && t <= end) {
      window.push({
        temp: temps[i],
        precip: precip[i],
        code: codes[i]
      });
    }
  }

  if (window.length === 0) return null;

  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let maxPrecip = 0;
  const codeCounts = new Map();

  for (const entry of window) {
    if (typeof entry.temp === 'number') {
      minTemp = Math.min(minTemp, entry.temp);
      maxTemp = Math.max(maxTemp, entry.temp);
    }
    if (typeof entry.precip === 'number') {
      maxPrecip = Math.max(maxPrecip, entry.precip);
    }
    if (typeof entry.code === 'number') {
      codeCounts.set(entry.code, (codeCounts.get(entry.code) || 0) + 1);
    }
  }

  const dominantCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const label = getWeatherLabel(dominantCode);
  const tempRange = `${Math.round(minTemp)}–${Math.round(maxTemp)}°F`;
  const precipText = maxPrecip ? `${Math.round(maxPrecip)}% precip` : 'Low precip';

  return `${label} • ${tempRange} • ${precipText}`;
}

function getWeatherLabel(code) {
  if (code === undefined || code === null) return 'Weather';
  const mapping = new Map([
    [0, 'Clear'],
    [1, 'Mostly clear'],
    [2, 'Partly cloudy'],
    [3, 'Overcast'],
    [45, 'Fog'],
    [48, 'Rime fog'],
    [51, 'Light drizzle'],
    [53, 'Drizzle'],
    [55, 'Heavy drizzle'],
    [56, 'Light freezing drizzle'],
    [57, 'Freezing drizzle'],
    [61, 'Light rain'],
    [63, 'Rain'],
    [65, 'Heavy rain'],
    [66, 'Light freezing rain'],
    [67, 'Freezing rain'],
    [71, 'Light snow'],
    [73, 'Snow'],
    [75, 'Heavy snow'],
    [77, 'Snow grains'],
    [80, 'Light showers'],
    [81, 'Showers'],
    [82, 'Heavy showers'],
    [85, 'Light snow showers'],
    [86, 'Snow showers'],
    [95, 'Thunderstorm'],
    [96, 'Thunderstorm with hail'],
    [99, 'Thunderstorm with heavy hail']
  ]);

  return mapping.get(code) || 'Weather';
}

function getSunTimes(data) {
  const daily = data.daily;
  if (!daily || !daily.sunrise || !daily.sunset) return '';
  const sunrise = daily.sunrise[0];
  const sunset = daily.sunset[0];
  if (!sunrise || !sunset) return '';
  return `Sunrise: ${formatTimeShort(sunrise)} • Sunset: ${formatTimeShort(sunset)}`;
}

function formatTimeShort(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function getMoonInfo(date = new Date()) {
  const phase = getMoonPhaseFraction(date);
  const phaseName = getMoonPhaseName(phase);
  const illumination = Math.round(getMoonIllumination(phase) * 100);
  const astro = getAstroTidbit(phaseName);
  return {
    phaseText: `Moon: ${phaseName} • ${illumination}%`,
    astroText: astro
  };
}

function getMoonPhaseFraction(date) {
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodicMonth = 29.53058867;
  const days = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = (days % synodicMonth) / synodicMonth;
  return (phase + 1) % 1;
}

function getMoonIllumination(phase) {
  return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
}

function getMoonPhaseName(phase) {
  const phases = [
    { name: 'New', start: 0.00, end: 0.03 },
    { name: 'Waxing crescent', start: 0.03, end: 0.24 },
    { name: 'First quarter', start: 0.24, end: 0.28 },
    { name: 'Waxing gibbous', start: 0.28, end: 0.49 },
    { name: 'Full', start: 0.49, end: 0.53 },
    { name: 'Waning gibbous', start: 0.53, end: 0.74 },
    { name: 'Last quarter', start: 0.74, end: 0.78 },
    { name: 'Waning crescent', start: 0.78, end: 1.00 }
  ];
  return phases.find(p => phase >= p.start && phase < p.end)?.name || 'New';
}

function getAstroTidbit(phaseName) {
  const map = {
    New: 'Astro: set intentions',
    'Waxing crescent': 'Astro: build momentum',
    'First quarter': 'Astro: take action',
    'Waxing gibbous': 'Astro: refine and commit',
    Full: 'Astro: spotlight and release',
    'Waning gibbous': 'Astro: share the wins',
    'Last quarter': 'Astro: recalibrate',
    'Waning crescent': 'Astro: rest and reset'
  };
  return map[phaseName] || 'Astro: reset and recalibrate';
}

function getSurfConditions(marineData) {
  if (!marineData) return '';
  const current = marineData.current;
  let waveHeight = current?.wave_height;
  let wavePeriod = current?.wave_period;
  let seaTemp = current?.sea_surface_temperature;

  if (waveHeight === undefined || wavePeriod === undefined || seaTemp === undefined) {
    const hourly = marineData.hourly;
    if (hourly && hourly.time && hourly.time.length > 0) {
      waveHeight = hourly.wave_height?.[0];
      wavePeriod = hourly.wave_period?.[0];
      seaTemp = hourly.sea_surface_temperature?.[0];
    }
  }

  if (waveHeight === undefined || wavePeriod === undefined || seaTemp === undefined) return '';
  const waveFt = Math.round(waveHeight * 3.28084 * 10) / 10;
  const period = Math.round(wavePeriod);
  const temp = Math.round(seaTemp);
  return `Surf: ${waveFt}ft @ ${period}s • Sea ${temp}°F`;
}

// --- Weather toggle for mobile ---
function setupWeatherToggle() {
  const toggle = document.getElementById('weather-toggle');
  const widget = document.getElementById('weather-widget');
  if (!toggle || !widget) return;

  toggle.addEventListener('click', () => {
    widget.classList.toggle('expanded');
  });
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupWeatherToggle();
});
