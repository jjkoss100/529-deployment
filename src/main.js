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

// --- Weather Configuration ---
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=33.989&longitude=-118.469&current=weather_code,temperature_2m,wind_speed_10m,cloud_cover,is_day&timezone=America/Los_Angeles';
const WEATHER_REFRESH_MS = 10 * 60 * 1000; // refresh weather every 10 min
const FOG_TRANSITION_MS = 2000;             // 2s smooth fog transition
const FOG_TRANSITION_STEPS = 40;            // frames per transition

// Weather profiles keyed by WMO code — { fog, particles }
const WEATHER_PROFILES = {
  clear:        { fog: { range: [-1, 8],    hb: 0.3,  color: '#1a1a2e', high: '#0f1419', space: '#050810', stars: 0.8  }, particles: { type: 'none' } },
  mainlyClear:  { fog: { range: [-1, 7],    hb: 0.35, color: '#1a1a2e', high: '#0f1419', space: '#050810', stars: 0.5  }, particles: { type: 'none' } },
  partlyCloudy: { fog: { range: [-0.5, 6],  hb: 0.4,  color: '#1e1e30', high: '#111620', space: '#070a12', stars: 0.25 }, particles: { type: 'none' } },
  overcast:     { fog: { range: [0, 5],     hb: 0.5,  color: '#222236', high: '#151a24', space: '#0a0d16', stars: 0.05 }, particles: { type: 'none' } },
  fog:          { fog: { range: [0.5, 3],   hb: 0.7,  color: '#2a2a3e', high: '#1a1f2a', space: '#0e1118', stars: 0.0  }, particles: { type: 'none' } },
  drizzleLight: { fog: { range: [0, 5.5],   hb: 0.45, color: '#1e1e32', high: '#121722', space: '#080b14', stars: 0.1  }, particles: { type: 'rain', count: 40,  speedMin: 4,  speedMax: 6,  baseAngle: 75, opacity: 0.15, sizeMin: 6,  sizeMax: 10 } },
  drizzleMod:   { fog: { range: [0, 5],     hb: 0.5,  color: '#202034', high: '#131824', space: '#090c15', stars: 0.05 }, particles: { type: 'rain', count: 80,  speedMin: 5,  speedMax: 7,  baseAngle: 75, opacity: 0.2,  sizeMin: 8,  sizeMax: 12 } },
  drizzleDense: { fog: { range: [0.5, 4.5], hb: 0.55, color: '#222236', high: '#141a26', space: '#0a0d16', stars: 0.0  }, particles: { type: 'rain', count: 120, speedMin: 6,  speedMax: 8,  baseAngle: 75, opacity: 0.25, sizeMin: 10, sizeMax: 14 } },
  rainSlight:   { fog: { range: [0, 5],     hb: 0.5,  color: '#1c1c30', high: '#111620', space: '#080b14', stars: 0.05 }, particles: { type: 'rain', count: 100, speedMin: 8,  speedMax: 12, baseAngle: 78, opacity: 0.25, sizeMin: 12, sizeMax: 18 } },
  rainMod:      { fog: { range: [0.5, 4],   hb: 0.55, color: '#1e1e32', high: '#121722', space: '#090c15', stars: 0.0  }, particles: { type: 'rain', count: 200, speedMin: 10, speedMax: 15, baseAngle: 78, opacity: 0.3,  sizeMin: 14, sizeMax: 22 } },
  rainHeavy:    { fog: { range: [1, 3],     hb: 0.65, color: '#222238', high: '#151a28', space: '#0a0e18', stars: 0.0  }, particles: { type: 'rain', count: 350, speedMin: 14, speedMax: 20, baseAngle: 80, opacity: 0.35, sizeMin: 18, sizeMax: 28 } },
  snowSlight:   { fog: { range: [0, 5],     hb: 0.5,  color: '#202038', high: '#141a2e', space: '#0a0e1a', stars: 0.1  }, particles: { type: 'snow', count: 50,  speedMin: 1,  speedMax: 2,  baseAngle: 90, opacity: 0.4,  sizeMin: 1.5, sizeMax: 3 } },
  snowMod:      { fog: { range: [0.5, 4],   hb: 0.55, color: '#22223c', high: '#161c30', space: '#0c101c', stars: 0.05 }, particles: { type: 'snow', count: 120, speedMin: 1.5, speedMax: 2.5, baseAngle: 90, opacity: 0.5, sizeMin: 2,   sizeMax: 3.5 } },
  snowHeavy:    { fog: { range: [1, 3],     hb: 0.65, color: '#24243e', high: '#181e32', space: '#0e121e', stars: 0.0  }, particles: { type: 'snow', count: 220, speedMin: 2,  speedMax: 3,  baseAngle: 90, opacity: 0.55, sizeMin: 2.5, sizeMax: 4 } },
  thunderstorm: { fog: { range: [0.5, 3.5], hb: 0.6,  color: '#1a1a30', high: '#101520', space: '#080b14', stars: 0.0  }, particles: { type: 'rain', count: 300, speedMin: 14, speedMax: 20, baseAngle: 80, opacity: 0.35, sizeMin: 18, sizeMax: 28, flash: true } },
};

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

// --- Toggle state (persisted within session, resets to NOW on new visit) ---
let currentMode = sessionStorage.getItem('529-mode') || 'now';
let activePopup = null;

// --- Weather state ---
let currentFogState = null;
let fogTransitionTimer = null;
let waterOpacityBase = 0.5;
let waterOpacitySwing = 0.2;

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

function formatLiveWindow(liveWindow, active) {
  if (!liveWindow) return '';

  // If deal is active, show "ends at X" for the active range
  if (active) {
    const nowMin = getLAMinutes();
    const ranges = liveWindow.split(',');
    for (const range of ranges) {
      const parts = range.trim().split('-');
      if (parts.length !== 2) continue;
      const start = parseMinutes(parts[0].trim());
      const end = parseMinutes(parts[1].trim());
      if (start === null || end === null) continue;
      const crossesMidnight = end <= start;
      let isActive = false;
      if (crossesMidnight) {
        if (nowMin >= start || nowMin <= end) isActive = true;
      } else {
        if (nowMin >= start && nowMin <= end) isActive = true;
      }
      if (isActive) return `ends at ${formatTime12h(parts[1].trim())}`;
    }
  }

  return liveWindow.split(',').map(range => {
    const parts = range.trim().split('-');
    if (parts.length !== 2) return range.trim();
    return `${formatTime12h(parts[0].trim())} – ${formatTime12h(parts[1].trim())}`;
  }).join(', ');
}

// --- Marker color map ---
const PROMO_COLORS = {
  'Special':       '#3b82f6',
  'Happy Hour':    '#f97316',
  'Distinct Menu': '#f97316',
  'Limited':       '#a855f7',
  'Pop-up':        '#ef4444',
};

// --- Check if deal is within 45 min of ending ---
function isNearEnd(liveWindow) {
  if (!liveWindow) return false;
  const nowMin = getLAMinutes();
  const ranges = liveWindow.split(',');
  for (const range of ranges) {
    const parts = range.trim().split('-');
    if (parts.length !== 2) continue;
    const start = parseMinutes(parts[0].trim());
    const end = parseMinutes(parts[1].trim());
    if (start === null || end === null) continue;
    const crossesMidnight = end <= start;
    // Check if currently active first
    let active = false;
    if (crossesMidnight) {
      if (nowMin >= start || nowMin <= end) active = true;
    } else {
      if (nowMin >= start && nowMin <= end) active = true;
    }
    if (!active) continue;
    // Minutes until end
    let minsLeft = end - nowMin;
    if (minsLeft < 0) minsLeft += 1440;
    if (minsLeft <= 45) return true;
  }
  return false;
}

// --- Weather: Utility functions ---
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

// --- Weather: Fetch current conditions from Open-Meteo ---
async function fetchWeather() {
  try {
    const res = await fetch(WEATHER_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current;
    return {
      weatherCode: c.weather_code,
      temperature: c.temperature_2m,
      windSpeed: c.wind_speed_10m,
      cloudCover: c.cloud_cover,
      isDay: c.is_day === 1,
    };
  } catch (e) {
    console.warn('[Weather] fetch failed:', e.message);
    return null;
  }
}

// --- Weather: Map WMO code to profile ---
function getWeatherProfile(code) {
  if (code === 0) return WEATHER_PROFILES.clear;
  if (code === 1) return WEATHER_PROFILES.mainlyClear;
  if (code === 2) return WEATHER_PROFILES.partlyCloudy;
  if (code === 3) return WEATHER_PROFILES.overcast;
  if (code === 45 || code === 48) return WEATHER_PROFILES.fog;
  if (code === 51 || code === 56) return WEATHER_PROFILES.drizzleLight;
  if (code === 53) return WEATHER_PROFILES.drizzleMod;
  if (code === 55 || code === 57) return WEATHER_PROFILES.drizzleDense;
  if (code === 61 || code === 66 || code === 80) return WEATHER_PROFILES.rainSlight;
  if (code === 63 || code === 81) return WEATHER_PROFILES.rainMod;
  if (code === 65 || code === 67 || code === 82) return WEATHER_PROFILES.rainHeavy;
  if (code === 71 || code === 77 || code === 85) return WEATHER_PROFILES.snowSlight;
  if (code === 73) return WEATHER_PROFILES.snowMod;
  if (code === 75 || code === 86) return WEATHER_PROFILES.snowHeavy;
  if (code === 95 || code === 96 || code === 99) return WEATHER_PROFILES.thunderstorm;
  return WEATHER_PROFILES.clear;
}

function mapWeatherToEffects(weather) {
  const profile = getWeatherProfile(weather.weatherCode);
  const f = profile.fog;

  // Build fog params — modulate stars by cloud cover and day/night
  let stars = f.stars;
  stars *= (1 - weather.cloudCover / 100);
  if (weather.isDay) stars = 0;

  const fog = {
    range: [...f.range],
    'horizon-blend': f.hb + (weather.cloudCover * 0.001),
    color: f.color,
    'high-color': f.high,
    'space-color': f.space,
    'star-intensity': Math.max(0, stars),
  };

  // Build particle config — apply wind to angle
  const p = profile.particles;
  let particles;
  if (p.type === 'none') {
    particles = { type: 'none', count: 0 };
  } else {
    const windAngleOffset = Math.min(15, weather.windSpeed * 0.5);
    particles = {
      type: p.type,
      count: p.count,
      speedMin: p.speedMin,
      speedMax: p.speedMax,
      angle: p.type === 'snow' ? 90 : p.baseAngle + windAngleOffset,
      opacity: p.opacity,
      sizeMin: p.sizeMin,
      sizeMax: p.sizeMax,
      flash: p.flash || false,
    };
  }

  // Adjust water for heavy conditions
  const isHeavy = [65, 67, 82, 75, 86, 95, 96, 99].includes(weather.weatherCode);
  const waterColor = isHeavy ? '#081a28' : '#0a1e2e';

  return { fog, particles, waterColor };
}

// --- Weather: Smooth fog transition ---
function transitionFog(map, targetFog) {
  // Cancel any running transition
  if (fogTransitionTimer) {
    clearInterval(fogTransitionTimer);
    fogTransitionTimer = null;
  }

  // First call — snap to baseline
  if (!currentFogState) {
    currentFogState = { ...targetFog, range: [...targetFog.range] };
    map.setFog(targetFog);
    return;
  }

  const from = { ...currentFogState, range: [...currentFogState.range] };
  let step = 0;
  const interval = FOG_TRANSITION_MS / FOG_TRANSITION_STEPS;

  fogTransitionTimer = setInterval(() => {
    step++;
    const t = step / FOG_TRANSITION_STEPS;

    const interpolated = {
      range: [lerp(from.range[0], targetFog.range[0], t), lerp(from.range[1], targetFog.range[1], t)],
      'horizon-blend': lerp(from['horizon-blend'], targetFog['horizon-blend'], t),
      color: lerpColor(from.color, targetFog.color, t),
      'high-color': lerpColor(from['high-color'], targetFog['high-color'], t),
      'space-color': lerpColor(from['space-color'], targetFog['space-color'], t),
      'star-intensity': lerp(from['star-intensity'], targetFog['star-intensity'], t),
    };

    map.setFog(interpolated);

    if (step >= FOG_TRANSITION_STEPS) {
      clearInterval(fogTransitionTimer);
      fogTransitionTimer = null;
      currentFogState = { ...targetFog, range: [...targetFog.range] };
    } else {
      // Track current position in case we need to interrupt
      currentFogState = { ...interpolated, range: [...interpolated.range] };
    }
  }, interval);
}

// --- Weather: Canvas particle system ---
function createParticleSystem() {
  const canvas = document.createElement('canvas');
  canvas.id = 'weather-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let w = window.innerWidth;
  let h = window.innerHeight;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
  }
  resize();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale before re-applying
      resize();
      initParticles();
    }, 200);
  });

  let particles = [];
  let config = { type: 'none', count: 0 };
  let rafId = null;
  let lastTs = 0;

  function initParticles() {
    particles = [];
    if (config.type === 'none' || config.count === 0) return;
    const scaledCount = Math.round(config.count * (w / 1000));
    for (let i = 0; i < scaledCount; i++) {
      particles.push(makeParticle(true));
    }
  }

  function makeParticle(scatter) {
    const rad = (config.angle || 78) * Math.PI / 180;
    // How far right a particle drifts while falling the full screen height
    const fullDrift = Math.tan(rad - Math.PI / 2) * h;
    const p = {
      // Scatter across full width plus offset left so right-drifting particles
      // still cover the whole screen rather than exiting the right edge early
      x: scatter ? Math.random() * (w + Math.abs(fullDrift)) - Math.abs(fullDrift) : Math.random() * w,
      y: scatter ? Math.random() * h : -(Math.random() * 100),
      speed: config.speedMin + Math.random() * (config.speedMax - config.speedMin),
      length: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
      size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
      opacity: config.opacity * (0.6 + Math.random() * 0.4),
      sineOffset: Math.random() * Math.PI * 2,
      sineAmp: 0.3 + Math.random() * 0.7,
    };
    return p;
  }

  function updateRain(p, dt) {
    const rad = (config.angle || 78) * Math.PI / 180;
    p.x += Math.sin(rad) * p.speed * dt;
    p.y += Math.cos(rad) * p.speed * dt;
    if (p.y > h + 50 || p.x > w + 50 || p.x < -50) {
      const reset = makeParticle(true);
      p.x = reset.x;
      p.y = reset.y;
      p.speed = reset.speed;
      p.length = reset.length;
      p.opacity = reset.opacity;
    }
  }

  function drawRain(p) {
    const rad = (config.angle || 78) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(rad) * p.length, p.y + Math.cos(rad) * p.length);
    ctx.strokeStyle = `rgba(180,200,230,${p.opacity})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function updateSnow(p, dt) {
    p.y += p.speed * dt;
    p.sineOffset += 0.02 * dt;
    p.x += Math.sin(p.sineOffset) * p.sineAmp * dt;
    if (p.y > h) {
      p.x = Math.random() * w;
      p.y = -10;
      p.speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
    }
    if (p.x > w) p.x = 0;
    if (p.x < 0) p.x = w;
  }

  function drawSnow(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,230,245,${p.opacity})`;
    ctx.fill();
  }

  function drawFlash() {
    ctx.fillStyle = 'rgba(200,210,255,0.06)';
    ctx.fillRect(0, 0, w, h);
    setTimeout(() => {
      if (config.flash) {
        ctx.fillStyle = 'rgba(200,210,255,0.03)';
        ctx.fillRect(0, 0, w, h);
      }
    }, 80 + Math.random() * 70);
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 16.67, 3);
    lastTs = ts;

    ctx.clearRect(0, 0, w, h);

    if (config.type !== 'none' && particles.length > 0) {
      const isRain = config.type === 'rain';
      for (const p of particles) {
        if (isRain) { updateRain(p, dt); drawRain(p); }
        else { updateSnow(p, dt); drawSnow(p); }
      }
      if (config.flash && Math.random() < 0.002) drawFlash();
    }

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return {
    updateConfig(newConfig) {
      config = { ...newConfig };
      initParticles();
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      canvas.remove();
    }
  };
}

// --- Weather: System orchestrator ---
function initWeatherSystem(map) {
  // Baseline fog state (matches Effect 1 values)
  currentFogState = {
    range: [-1, 8],
    'horizon-blend': 0.3,
    color: '#1a1a2e',
    'high-color': '#0f1419',
    'space-color': '#050810',
    'star-intensity': 0.6,
  };

  const particleSystem = createParticleSystem();

  async function applyWeather() {
    const weather = await fetchWeather();
    if (!weather) return;

    console.log(`[Weather] code=${weather.weatherCode}, cloud=${weather.cloudCover}%, wind=${weather.windSpeed}km/h, day=${weather.isDay}`);

    const effects = mapWeatherToEffects(weather);

    // Smooth fog transition
    transitionFog(map, effects.fog);

    // Update particles
    particleSystem.updateConfig(effects.particles);

    // Update water color
    try { map.setPaintProperty('water', 'fill-color', effects.waterColor); } catch (e) { /* ok */ }

    // Adjust water breathing for heavy conditions
    const isHeavy = [65, 67, 82, 75, 86, 95, 96, 99].includes(weather.weatherCode);
    waterOpacityBase = isHeavy ? 0.6 : 0.5;
    waterOpacitySwing = isHeavy ? 0.1 : 0.2;
  }

  // Initial weather check (slight delay to let map render)
  setTimeout(applyWeather, 1500);

  // Periodic refresh
  setInterval(applyWeather, WEATHER_REFRESH_MS);
}

// --- Popup HTML builder ---
function buildPopupHTML(props) {
  const name = props.name || '';
  const notes = props.notes || '';
  const dealActive = isDealActiveNow({ liveWindow: props.liveWindow });
  const time = formatLiveWindow(props.liveWindow, dealActive);
  const link = props.link || '';
  const instagram = props.instagram || '';
  const promoType = props.promotionType || '';

  // Time color: red if Happy Hour/Distinct Menu near end, otherwise muted gray
  const useRed = (promoType === 'Happy Hour' || promoType === 'Distinct Menu' || promoType === 'Special') && isNearEnd(props.liveWindow);
  const timeColor = useRed ? '#ef4444' : '#888';

  let html = `<div class="venue-popup">`;
  if (instagram) {
    html += `<a class="venue-popup__name venue-popup__name--link" href="${instagram}" target="_blank" rel="noopener noreferrer">@${name}</a>`;
  } else {
    html += `<div class="venue-popup__name">${name}</div>`;
  }
  if (notes) html += `<div class="venue-popup__notes">${notes}</div>`;

  // Footer row: link left, time right
  const linkLabels = {
    'Special': 'see special',
    'Happy Hour': 'see drinks',
    'Distinct Menu': 'see menu',
    'Limited': 'see details',
  };
  const hasLink = !!link;
  const hasTime = !!time && promoType !== 'Limited';
  if (hasLink || hasTime) {
    html += `<div class="venue-popup__footer">`;
    if (hasLink) {
      const label = linkLabels[props.promotionType];
      html += `<a class="venue-popup__link" href="${link}" target="_blank" rel="noopener noreferrer">`;
      if (label) {
        html += label;
      } else {
        html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
      }
      html += `</a>`;
    } else {
      html += `<span></span>`;
    }
    if (hasTime) {
      html += `<span class="venue-popup__time" style="color:${timeColor}">${time}</span>`;
    }
    html += `</div>`;
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

  // Last column holds today's time windows — header changes daily (e.g. "2/16", "2/17")
  const headers = parsed.meta.fields || [];
  const timeColumnName = headers.length > 0 ? headers[headers.length - 1] : '';
  console.log(`Time column detected: "${timeColumnName}" (last column)`);

  const venues = [];
  const rows = parsed.data || [];

  for (const row of rows) {
    const name = (row['Venue'] || '').trim();
    if (!name) continue;

    const lng = parseFloat(row['Longitude']);
    const lat = parseFloat(row['Latitude']);
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
      liveWindow: (row[timeColumnName] || '').trim(),
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
    maxWidth: '280px',
    offset: 12,
  });
  activePopup = popup;

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
      sessionStorage.setItem('529-mode', mode);

      // Update active class
      btns.forEach(b => b.classList.remove('mode-toggle__btn--active'));
      btn.classList.add('mode-toggle__btn--active');

      // Close any open popup
      if (activePopup) activePopup.remove();

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
        const opacity = waterOpacityBase + t * waterOpacitySwing;
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

      // --- Effect 4: Map texture — roads, buildings, water tint ---
      try {
        map.setPaintProperty('water', 'fill-color', '#0a1e2e');
        map.setPaintProperty('road-street', 'line-color', '#1a2a3a');
        map.setPaintProperty('road-minor-low', 'line-color', '#1a2a3a');
        map.setPaintProperty('road-minor-case', 'line-color', '#0f1a25');
        map.setPaintProperty('road-secondary-tertiary', 'line-color', '#1e3040');
        map.setPaintProperty('road-primary', 'line-color', '#1e3040');
        map.setPaintProperty('building', 'fill-color', '#141e2a');
        map.setPaintProperty('building', 'fill-opacity', 0.7);
      } catch (e) {
        console.warn('Map texture: some layers not found', e.message);
      }

      // --- Effect 5: Hybrid weather overlay ---
      initWeatherSystem(map);

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
