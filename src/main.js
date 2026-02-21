// --- Configuration ---
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQpj4lehM7ElDgkUxZHkQ_ZrZhGX4HwIkK-pBuA-siErJ0YG0ahpfYYJqSqoAq5-Fpj8tL6j0DyK-by/pub?gid=6430153&single=true&output=csv';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoiamprb3NzMTAiLCJhIjoiY21sZnl3NnN3MDZoNTNlb2s1MnczMWVwbSJ9.HDXt8N0fEOpSvSGhKp6jRg';
const MAP_CENTER = [-118.469, 33.989];
const MAP_ZOOM = 14;
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const SOURCE_ID = 'venues';
const LAYER_ID = 'venue-markers';
const LNG_OFFSET = 0.00022;
const GLOW_LAYER_ID = 'venue-glow';
const REFRESH_INTERVAL = 60000; // re-filter every 60s

// --- Weather Configuration ---
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=33.989&longitude=-118.469&current=weather_code,temperature_2m,wind_speed_10m,cloud_cover,is_day&timezone=America/Los_Angeles';
const WEATHER_REFRESH_MS = 10 * 60 * 1000; // refresh weather every 10 min
const FOG_TRANSITION_MS = 2000;             // 2s smooth fog transition
const FOG_TRANSITION_STEPS = 40;            // frames per transition

// Weather profiles keyed by WMO code — { fog, particles }
const WEATHER_PROFILES = {
  clear:        { fog: { range: [-1, 9],    hb: 0.2,  color: '#1a3a5c', high: '#0f2540', space: '#071828', stars: 0.0  }, particles: { type: 'none' } },
  mainlyClear:  { fog: { range: [-1, 8],    hb: 0.25, color: '#162e4a', high: '#0d1f35', space: '#060f1c', stars: 0.0  }, particles: { type: 'none' } },
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

// --- Onboarding: shared map+venue refs for tooltip positioning ---
let _onboardingMap = null;
let _onboardingVenues = null;
let activePopup = null;

// --- Weather state ---
let currentFogState = null;
let fogTransitionTimer = null;
let waterOpacityBase = 0.5;
let waterOpacitySwing = 0.2;

// --- Check if a deal should be shown today ---
// Show if: hasn't ended yet (upcoming or currently active). Hide once it ends.
// Deals with no liveWindow are always shown.
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
      // e.g. 22:00-02:00
      // Active or upcoming: now >= start OR now <= end
      // Before start today: still upcoming, show it
      if (nowMin >= start || nowMin <= end) return true;
      if (nowMin < start) return true;
    } else {
      // e.g. 15:00-18:00
      // Show if we haven't passed the end time yet
      if (nowMin <= end) return true;
    }
  }

  return false;
}

// --- Debug panel ---

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
    const startFull = formatTime12h(parts[0].trim());
    const endFull = formatTime12h(parts[1].trim());
    const startSuffix = startFull.endsWith('am') ? 'am' : 'pm';
    const endSuffix = endFull.endsWith('am') ? 'am' : 'pm';
    // If both share the same suffix, strip it from the start time
    if (startSuffix === endSuffix) {
      const startStripped = startFull.slice(0, -2);
      return `${startStripped}–${endFull}`;
    }
    return `${startFull}–${endFull}`;
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

  // At night, shift clear-sky fog to deep ocean dark tones
  const fogColor      = !weather.isDay ? '#0d1f35' : f.color;
  const fogHighColor  = !weather.isDay ? '#091525' : f.high;
  const fogSpaceColor = !weather.isDay ? '#040d18' : f.space;
  const fogRange      = !weather.isDay ? [f.range[0] - 2, f.range[1] - 1] : f.range;

  const fog = {
    range: [...fogRange],
    'horizon-blend': f.hb + (weather.cloudCover * 0.001),
    color: fogColor,
    'high-color': fogHighColor,
    'space-color': fogSpaceColor,
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
  const waterColor = isHeavy ? '#0d191d' : '#111e22';

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
    const p = {
      x: Math.random() * w,
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
    if (p.y > h || p.x > w + 50 || p.x < -50) {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
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

// --- Time-of-day map colors ---
function applyTimeOfDayColors(map, isDay) {
  try {
    if (isDay) {
      map.setPaintProperty('water', 'fill-color', '#1a2e32');
      map.setPaintProperty('road-street', 'line-color', '#e07828');
      map.setPaintProperty('road-minor-low', 'line-color', '#e07828');
      map.setPaintProperty('road-minor-case', 'line-color', '#a05020');
      map.setPaintProperty('road-secondary-tertiary', 'line-color', '#f08c38');
      map.setPaintProperty('road-primary', 'line-color', '#ffa048');
      map.setPaintProperty('building', 'fill-color', '#1e2a38');
      map.setPaintProperty('building', 'fill-opacity', 0.85);
      // Road casings — bright orange-white outlines for fractal glow
      try { map.setPaintProperty('road-street-case', 'line-color', '#ffaa58'); } catch (_) {}
      try { map.setPaintProperty('road-secondary-tertiary-case', 'line-color', '#ffba68'); } catch (_) {}
      try { map.setPaintProperty('road-primary-case', 'line-color', '#ffcc78'); } catch (_) {}
      try { map.setPaintProperty('road-motorway', 'line-color', '#ffb060'); } catch (_) {}
      try { map.setPaintProperty('road-motorway-case', 'line-color', '#ffcc80'); } catch (_) {}
      // Land/background — slightly lighter steel-blue for day
      try { map.setPaintProperty('land', 'background-color', '#131c28'); } catch (_) {}
      try { map.setPaintProperty('background', 'background-color', '#131c28'); } catch (_) {}
      try { map.setPaintProperty('landcover', 'fill-color', '#141e2a'); } catch (_) {}
      try { map.setPaintProperty('landuse', 'fill-color', '#141e2a'); } catch (_) {}
    } else {
      map.setPaintProperty('water', 'fill-color', '#0e1c20');
      map.setPaintProperty('road-street', 'line-color', '#e86820');
      map.setPaintProperty('road-minor-low', 'line-color', '#e86820');
      map.setPaintProperty('road-minor-case', 'line-color', '#b04010');
      map.setPaintProperty('road-secondary-tertiary', 'line-color', '#f57a28');
      map.setPaintProperty('road-primary', 'line-color', '#ff9035');
      map.setPaintProperty('building', 'fill-color', '#111820');
      map.setPaintProperty('building', 'fill-opacity', 0.98);
      // Road casings — bright neon orange outlines for fractal glow at night
      try { map.setPaintProperty('road-street-case', 'line-color', '#ff7830'); } catch (_) {}
      try { map.setPaintProperty('road-secondary-tertiary-case', 'line-color', '#ff8c3c'); } catch (_) {}
      try { map.setPaintProperty('road-primary-case', 'line-color', '#ffa048'); } catch (_) {}
      try { map.setPaintProperty('road-motorway', 'line-color', '#ffa048'); } catch (_) {}
      try { map.setPaintProperty('road-motorway-case', 'line-color', '#ffb85a'); } catch (_) {}
      // Land/background — force darker so roads pop
      try { map.setPaintProperty('land', 'background-color', '#0a0e14'); } catch (_) {}
      try { map.setPaintProperty('background', 'background-color', '#0a0e14'); } catch (_) {}
      try { map.setPaintProperty('landcover', 'fill-color', '#0c1018'); } catch (_) {}
      try { map.setPaintProperty('landuse', 'fill-color', '#0c1018'); } catch (_) {}
    }
  } catch (e) { /* layer may not exist */ }
}

// --- Radar grid pulse overlay ---
function createGridOverlay() {
  const canvas = document.createElement('canvas');
  canvas.id = 'grid-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:3;';
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
  window.addEventListener('resize', () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resize();
  });

  const SPACING = 40; // slightly wider cells — less dense
  const DRIFT_X = 4.5;
  const DRIFT_Y = 2.8;
  let t = 0;
  let offsetX = 0;
  let offsetY = 0;
  let last = performance.now();

  // Glitch state: randomly skip/flash individual lines
  let glitchTimer = 0;
  let glitchLines = new Set(); // indices of lines currently glitching
  let glitchBoost = 0;         // brief opacity surge on glitch frames

  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    offsetX = (offsetX + DRIFT_X * dt) % SPACING;
    offsetY = (offsetY + DRIFT_Y * dt) % SPACING;
    t += dt;

    // Glitch: every 1.5–3.5s, randomly drop/flash a few lines for ~80ms
    glitchTimer -= dt;
    if (glitchTimer <= 0) {
      glitchLines.clear();
      const lineCount = Math.ceil(w / SPACING) + Math.ceil(h / SPACING);
      const numGlitch = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < numGlitch; i++) {
        glitchLines.add(Math.floor(Math.random() * lineCount));
      }
      glitchBoost = 0.06; // brief brightness flash
      glitchTimer = 1.5 + Math.random() * 2.0;
    }
    glitchBoost = Math.max(0, glitchBoost - dt * 0.8); // decay fast

    ctx.clearRect(0, 0, w, h);

    // Base pulse: pulled down to 0.016–0.038 — subtle but present
    const pulse = 0.016 + 0.022 * ((Math.sin(t * 0.45) + 1) / 2);

    ctx.lineWidth = 0.6;

    let lineIdx = 0;

    // Vertical lines
    for (let x = -SPACING + offsetX; x < w + SPACING; x += SPACING) {
      const isGlitch = glitchLines.has(lineIdx);
      const alpha = isGlitch ? 0 : pulse + (glitchBoost * (Math.random() > 0.5 ? 1 : 0));
      ctx.strokeStyle = `rgba(255, 130, 40, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      lineIdx++;
    }
    // Horizontal lines
    for (let y = -SPACING + offsetY; y < h + SPACING; y += SPACING) {
      const isGlitch = glitchLines.has(lineIdx);
      const alpha = isGlitch ? 0 : pulse + (glitchBoost * (Math.random() > 0.5 ? 1 : 0));
      ctx.strokeStyle = `rgba(255, 130, 40, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      lineIdx++;
    }

    // Intersection dots — match reduced opacity
    const dotPulse = pulse * 1.6;
    ctx.fillStyle = `rgba(255, 155, 60, ${dotPulse})`;
    for (let x = -SPACING + offsetX; x < w + SPACING; x += SPACING) {
      for (let y = -SPACING + offsetY; y < h + SPACING; y += SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

// --- Weather: System orchestrator ---
function initWeatherSystem(map) {
  // Baseline fog state (matches Effect 1 values)
  currentFogState = {
    range: [-1, 7],
    'horizon-blend': 0.25,
    color: '#0d1f35',
    'high-color': '#091525',
    'space-color': '#040d18',
    'star-intensity': 0.7,
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

    // Time-of-day road/building colors
    applyTimeOfDayColors(map, weather.isDay);
  }

  // Initial weather check (slight delay to let map render)
  setTimeout(applyWeather, 1500);

  // Periodic refresh
  setInterval(applyWeather, WEATHER_REFRESH_MS);
}

// --- Popup HTML builder ---
function buildPopupHTML(props) {
  const name = props.name || '';
  const eventName = props.eventName || '';
  const notes = props.notes || '';
  const dealActive = isDealActiveNow({ liveWindow: props.liveWindow });
  const time = formatLiveWindow(props.liveWindow, dealActive);
  const link = props.link || '';
  const instagram = props.instagram || '';
  const promoType = props.promotionType || '';

  // Time color: red if Happy Hour/Distinct Menu near end, otherwise muted gray
  const useRed = (promoType === 'Happy Hour' || promoType === 'Distinct Menu' || promoType === 'Special') && isNearEnd(props.liveWindow);
  const timeColor = useRed ? '#FF6E7F' : '#333';

  let html = `<div class="venue-popup">`;

  // Venue name (row 1)
  if (instagram) {
    html += `<a class="venue-popup__name venue-popup__name--link" href="${instagram}" target="_blank" rel="noopener noreferrer">@${name}</a>`;
  } else {
    html += `<div class="venue-popup__name">${name}</div>`;
  }

  // Event/description subtitle (row 2)
  if (eventName) html += `<div class="venue-popup__event">${eventName}</div>`;

  // Notes — deal details (middle block)
  if (notes) html += `<div class="venue-popup__notes">${notes}</div>`;

  // Footer row: time left, link right
  const linkLabels = {
    'Special': 'see special',
    'Happy Hour': 'see drinks',
    'Distinct Menu': 'see menu',
    'Limited': 'see details',
    'Shoutout': 'see details',
  };
  const hasLink = !!link;
  const hasTime = !!time && promoType !== 'Limited' && promoType !== 'Shoutout';
  if (hasLink || hasTime) {
    html += `<div class="venue-popup__footer">`;
    if (hasTime) {
      html += `<span class="venue-popup__time" style="color:${timeColor}">${time}</span>`;
    } else {
      html += `<span></span>`;
    }
    if (hasLink) {
      const label = linkLabels[props.promotionType];
      const linkClass = promoType === 'Shoutout' ? 'venue-popup__link venue-popup__link--shoutout' : 'venue-popup__link';
      html += `<a class="${linkClass}" href="${link}" target="_blank" rel="noopener noreferrer">`;
      if (label) {
        html += label;
      } else {
        html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
      }
      html += `</a>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// --- SVG Marker Icons (keyed by Venue Type) ---
const VENUE_TYPE_SVGS = {
  'Restaurant': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><mask id="mask0_63_672" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="8" y="8" width="27" height="27"><rect x="8" y="8" width="27" height="27" fill="#D9D9D9"/></mask><g mask="url(#mask0_63_672)"><path d="M21.5 34.2125L17.7312 30.5H12.5V25.2687L8.78748 21.5L12.5 17.7312V12.5H17.7312L21.5 8.78748L25.2687 12.5H30.5V17.7312L34.2125 21.5L30.5 25.2687V30.5H25.2687L21.5 34.2125ZM21.5 31.0625L23.75 28.8125V24.65C23.2625 24.3687 22.8594 23.8953 22.5406 23.2297C22.2219 22.564 22.0625 21.8 22.0625 20.9375C22.0625 19.85 22.3062 18.9219 22.7937 18.1531C23.2812 17.3844 23.8812 17 24.5937 17C25.2875 17 25.8828 17.3844 26.3797 18.1531C26.8765 18.9219 27.125 19.85 27.125 20.9375C27.125 21.8187 26.9656 22.5922 26.6469 23.2578C26.3281 23.9234 25.925 24.3875 25.4375 24.65V28.25H28.25V24.3125L31.0625 21.5L28.25 18.6875V14.75H24.3125L21.5 11.9375L18.6875 14.75H14.75V18.6875L11.9375 21.5L14.75 24.3125V28.25H17.5625V23.75C17.075 23.6375 16.6719 23.3797 16.3531 22.9765C16.0344 22.5734 15.875 22.1094 15.875 21.5844V17H17V21.2469H17.8437V17H18.9687V21.2469H19.8125V17H20.9375V21.5844C20.9375 22.1094 20.7781 22.5734 20.4594 22.9765C20.1406 23.3797 19.7375 23.6375 19.25 23.75V28.8125L21.5 31.0625Z" fill="#1C1B1F"/></g></svg>`,

  // Remaining venue types — SVGs to be added as they are provided
  'Bar': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6111 30.3888 3.99997 21 3.99997C11.6112 3.99997 4 11.6111 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><mask id="mask0_63_698" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="9" y="9" width="24" height="24"><rect x="9" y="8.99997" width="24" height="24" fill="#D9D9D9"/></mask><g mask="url(#mask0_63_698)"><path d="M12 31V29H14V25.8C13.4167 25.6 12.9375 25.2458 12.5625 24.7375C12.1875 24.2291 12 23.65 12 23V15H18V23C18 23.65 17.8125 24.2291 17.4375 24.7375C17.0625 25.2458 16.5833 25.6 16 25.8V29H18V31H12ZM14 20H16V17H14V20ZM15 24C15.2833 24 15.5208 23.9041 15.7125 23.7125C15.9042 23.5208 16 23.2833 16 23V22H14V23C14 23.2833 14.0958 23.5208 14.2875 23.7125C14.4792 23.9041 14.7167 24 15 24ZM22 31C21.45 31 20.9792 30.8041 20.5875 30.4125C20.1958 30.0208 20 29.55 20 29V19.45C20 19.0166 20.125 18.6291 20.375 18.2875C20.625 17.9458 20.95 17.7 21.35 17.55L22.3 17.2C22.5333 17.1166 22.7083 16.9958 22.825 16.8375C22.9417 16.6791 23 16.4833 23 16.25V12C23 11.7166 23.0958 11.4791 23.2875 11.2875C23.4792 11.0958 23.7167 11 24 11H27C27.2833 11 27.5208 11.0958 27.7125 11.2875C27.9042 11.4791 28 11.7166 28 12V16.25C28 16.4833 28.0583 16.6791 28.175 16.8375C28.2917 16.9958 28.4667 17.1166 28.7 17.2L29.65 17.55C30.05 17.7 30.375 17.9458 30.625 18.2875C30.875 18.6291 31 19.0166 31 19.45V29C31 29.55 30.8042 30.0208 30.4125 30.4125C30.0208 30.8041 29.55 31 29 31H22ZM25 14H26V13H25V14ZM22 21H29V19.45L28.05 19.1C27.4167 18.8666 26.9167 18.5 26.55 18C26.1833 17.5 26 16.9333 26 16.3V16H25V16.3C25 16.9333 24.8167 17.5 24.45 18C24.0833 18.5 23.5833 18.8666 22.95 19.1L22 19.45V21ZM22 29H29V27H22V29ZM22 25H29V23H22V25Z" fill="#1C1B1F"/></g></svg>`,
  'Cafe': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><mask id="mask0_63_724" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="9" y="9" width="24" height="24"><rect x="9" y="9" width="24" height="24" fill="#D9D9D9"/></mask><g mask="url(#mask0_63_724)"><path d="M13 30V28H29V30H13ZM17 26C15.9 26 14.9583 25.6083 14.175 24.825C13.3917 24.0417 13 23.1 13 22V12H29C29.55 12 30.0208 12.1958 30.4125 12.5875C30.8042 12.9792 31 13.45 31 14V17C31 17.55 30.8042 18.0208 30.4125 18.4125C30.0208 18.8042 29.55 19 29 19H27V22C27 23.1 26.6083 24.0417 25.825 24.825C25.0417 25.6083 24.1 26 23 26H17ZM17 24H23C23.55 24 24.0208 23.8042 24.4125 23.4125C24.8042 23.0208 25 22.55 25 22V14H15V22C15 22.55 15.1958 23.0208 15.5875 23.4125C15.9792 23.8042 16.45 24 17 24ZM27 17H29V14H27V17ZM17 24H15H25H17Z" fill="#1C1B1F"/></g></svg>`,
  'Ice Cream': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 55"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/></svg>`,
  'Bakery': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 55"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/></svg>`,
  'Wellness': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6111 30.3888 3.99997 21 3.99997C11.6112 3.99997 4 11.6111 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><mask id="mask0_63_652" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="9" y="9" width="24" height="24"><rect x="9" y="8.99997" width="24" height="24" fill="#D9D9D9"/></mask><g mask="url(#mask0_63_652)"><path d="M15.8 29C15.3 29 14.875 28.825 14.525 28.475C14.175 28.125 14 27.7 14 27.2C14 26.85 14.1 26.5208 14.3 26.2125C14.5 25.9041 14.7667 25.6833 15.1 25.55L19 24V21.75C18.1 22.8 17.0542 23.6041 15.8625 24.1625C14.6708 24.7208 13.3833 25 12 25V23C13.1333 23 14.1625 22.7666 15.0875 22.3C16.0125 21.8333 16.85 21.1666 17.6 20.3L18.95 18.7C19.15 18.4666 19.3833 18.2916 19.65 18.175C19.9167 18.0583 20.2 18 20.5 18H21.5C21.8 18 22.0833 18.0583 22.35 18.175C22.6167 18.2916 22.85 18.4666 23.05 18.7L24.4 20.3C25.15 21.1666 25.9875 21.8333 26.9125 22.3C27.8375 22.7666 28.8667 23 30 23V25C28.6167 25 27.3292 24.7208 26.1375 24.1625C24.9458 23.6041 23.9 22.8 23 21.75V24L26.9 25.55C27.2333 25.6833 27.5 25.9041 27.7 26.2125C27.9 26.5208 28 26.85 28 27.2C28 27.7 27.825 28.125 27.475 28.475C27.125 28.825 26.7 29 26.2 29H19V28.5C19 28.0666 19.1417 27.7083 19.425 27.425C19.7083 27.1416 20.0667 27 20.5 27H23.5C23.65 27 23.7708 26.9541 23.8625 26.8625C23.9542 26.7708 24 26.65 24 26.5C24 26.35 23.9542 26.2291 23.8625 26.1375C23.7708 26.0458 23.65 26 23.5 26H20.5C19.8 26 19.2083 26.2416 18.725 26.725C18.2417 27.2083 18 27.8 18 28.5V29H15.8ZM19.5875 16.4125C19.1958 16.0208 19 15.55 19 15C19 14.45 19.1958 13.9791 19.5875 13.5875C19.9792 13.1958 20.45 13 21 13C21.55 13 22.0208 13.1958 22.4125 13.5875C22.8042 13.9791 23 14.45 23 15C23 15.55 22.8042 16.0208 22.4125 16.4125C22.0208 16.8041 21.55 17 21 17C20.45 17 19.9792 16.8041 19.5875 16.4125Z" fill="#1C1B1F"/></g></svg>`,
  'Run Club': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 55"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/></svg>`,
  'Music': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><svg x="11" y="11" width="20" height="20" viewBox="0 0 22 22"><path d="M3.175 19.825C2.39167 19.0417 2 18.1 2 17C2 15.9 2.39167 14.9583 3.175 14.175C3.95833 13.3917 4.9 13 6 13C6.38333 13 6.7375 13.0458 7.0625 13.1375C7.3875 13.2292 7.7 13.3667 8 13.55V5L20 3V15C20 16.1 19.6083 17.0417 18.825 17.825C18.0417 18.6083 17.1 19 16 19C14.9 19 13.9583 18.6083 13.175 17.825C12.3917 17.0417 12 16.1 12 15C12 13.9 12.3917 12.9583 13.175 12.175C13.9583 11.3917 14.9 11 16 11C16.3833 11 16.7375 11.0458 17.0625 11.1375C17.3875 11.2292 17.7 11.3667 18 11.55V7.425L10 9V17C10 18.1 9.60833 19.0417 8.825 19.825C8.04167 20.6083 7.1 21 6 21C4.9 21 3.95833 20.6083 3.175 19.825Z" fill="#1C1B1F"/></svg></svg>`,
  'Fitness': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 55"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/></svg>`,
  'Food Truck': `<svg width="42" height="55" viewBox="0 0 42 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 0C32.598 0 42 9.40202 42 21C42 22.4157 41.8599 23.7986 41.5929 25.1358C39.7394 39.1032 21.1103 55 21.1103 55C21.1103 55 5.25689 41.4717 1.34456 28.4096C0.475506 26.1054 0 23.6083 0 21C0 9.40202 9.40202 0 21 0Z" fill="#D9D9D9"/><path d="M38 21C38 11.6111 30.3888 3.99997 21 3.99997C11.6112 3.99997 4 11.6111 4 21C4 30.3888 11.6112 38 21 38C30.3888 38 38 30.3888 38 21Z" fill="white"/><path d="M12.267 28C11.6042 27.3333 11.2727 26.5238 11.2727 25.5714H9V15.2857C9 14.6571 9.22254 14.119 9.66761 13.6714C10.1127 13.2238 10.6477 13 11.2727 13H27.1818L34 19.8571V25.5714H31.7273C31.7273 26.5238 31.3958 27.3333 30.733 28C30.0701 28.6667 29.2652 29 28.3182 29C27.3712 29 26.5663 28.6667 25.9034 28C25.2405 27.3333 24.9091 26.5238 24.9091 25.5714H18.0909C18.0909 26.5238 17.7595 27.3333 17.0966 28C16.4337 28.6667 15.6288 29 14.6818 29C13.7348 29 12.9299 28.6667 12.267 28ZM24.9091 18.7143H29.4545L26.0455 15.2857H24.9091V18.7143ZM18.0909 18.7143H22.6364V15.2857H18.0909V18.7143ZM11.2727 18.7143H15.8182V15.2857H11.2727V18.7143ZM15.6903 26.5857C15.965 26.3095 16.1023 25.9714 16.1023 25.5714C16.1023 25.1714 15.965 24.8333 15.6903 24.5571C15.4157 24.281 15.0795 24.1429 14.6818 24.1429C14.2841 24.1429 13.9479 24.281 13.6733 24.5571C13.3987 24.8333 13.2614 25.1714 13.2614 25.5714C13.2614 25.9714 13.3987 26.3095 13.6733 26.5857C13.9479 26.8619 14.2841 27 14.6818 27C15.0795 27 15.4157 26.8619 15.6903 26.5857ZM29.3267 26.5857C29.6013 26.3095 29.7386 25.9714 29.7386 25.5714C29.7386 25.1714 29.6013 24.8333 29.3267 24.5571C29.0521 24.281 28.7159 24.1429 28.3182 24.1429C27.9205 24.1429 27.5843 24.281 27.3097 24.5571C27.035 24.8333 26.8977 25.1714 26.8977 25.5714C26.8977 25.9714 27.035 26.3095 27.3097 26.5857C27.5843 26.8619 27.9205 27 28.3182 27C28.7159 27 29.0521 26.8619 29.3267 26.5857ZM11.2727 23.2857H12.1818C12.5038 22.9429 12.8731 22.6667 13.2898 22.4571C13.7064 22.2476 14.1705 22.1429 14.6818 22.1429C15.1932 22.1429 15.6572 22.2476 16.0739 22.4571C16.4905 22.6667 16.8598 22.9429 17.1818 23.2857H25.8182C26.1402 22.9429 26.5095 22.6667 26.9261 22.4571C27.3428 22.2476 27.8068 22.1429 28.3182 22.1429C28.8295 22.1429 29.2936 22.2476 29.7102 22.4571C30.1269 22.6667 30.4962 22.9429 30.8182 23.2857H31.7273V21H11.2727V23.2857Z" fill="#1C1B1F"/></svg>`,
};

// --- SVG Helper ---
function makeSvgData(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- Add pink alert ring to the white circle in a marker SVG ---
function makeAlertSvg(svg) {
  // Match <path ... fill="white" ... /> ensuring the / stays with the closing >
  return svg.replace(
    /(<path\b[^/]*?fill="white"[^/]*?)(\/?>)/,
    '$1 stroke="#FF6E7F" stroke-width="2"$2'
  );
}

// --- Add gold shoutout ring to the white circle in a marker SVG ---
function makeShoutoutSvg(svg) {
  return svg.replace(
    /(<path\b[^/]*?fill="white"[^/]*?)(\/?>)/,
    '$1 stroke="#C9962A" stroke-width="2.5"$2'
  );
}

// --- Load a single marker image into Mapbox ---
function loadSingleMarkerImage(map, id, svg) {
  return new Promise((resolve) => {
    if (map.hasImage(id)) { resolve(true); return; }
    const img = new Image(63, 83);
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
      resolve(true);
    };
    img.onerror = () => {
      console.warn(`Failed to load marker image "${id}"`);
      resolve(false);
    };
    img.src = makeSvgData(svg);
  });
}

// --- Load marker images into Mapbox (normal + alert + shoutout variants) ---
function loadMarkerImages(map) {
  const entries = Object.entries(VENUE_TYPE_SVGS);
  const toLoad = [
    ...entries.map(([venueType, svg]) => ({ id: `marker-${venueType}`, svg })),
    ...entries.map(([venueType, svg]) => ({ id: `marker-${venueType}-alert`, svg: makeAlertSvg(svg) })),
    ...entries.map(([venueType, svg]) => ({ id: `marker-${venueType}-shoutout`, svg: makeShoutoutSvg(svg) })),
  ];
  return Promise.all(toLoad.map(({ id, svg }) => loadSingleMarkerImage(map, id, svg)));
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
    const venueType = (row['Venue Type'] || '').trim();
    if (!VENUE_TYPE_SVGS[venueType]) {
      console.warn(`Unknown venue type "${venueType}" for "${name}", skipping`);
      continue;
    }

    venues.push({
      name,
      lng,
      lat,
      instagram: (row['Venue Instagram'] || '').trim(),
      eventName: (row['Event Name/Description'] || '').trim(),
      promotionType: promoType,
      venueType,
      link: (row['Link'] || '').trim(),
      notes: (row['Notes'] || '').trim(),
      liveWindow: (row[timeColumnName] || '').trim(),
    });
  }

  return venues;
}

// --- Build GeoJSON from venues ---
function buildGeoJSON(venues) {
  const visible = venues.filter(isDealActiveNow);
  console.log(`Showing ${visible.length} of ${venues.length} deals`);

  // Group by coordinates to offset any markers sharing the same location
  const byCoord = new Map();
  for (const v of visible) {
    const key = `${v.lng.toFixed(5)},${v.lat.toFixed(5)}`;
    if (!byCoord.has(key)) byCoord.set(key, []);
    byCoord.get(key).push(v);
  }

  const features = [];
  for (const [coord, group] of byCoord) {
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
          venueType: v.venueType,
          icon: v.promotionType === 'Shoutout'
            ? `marker-${v.venueType}-shoutout`
            : `marker-${v.venueType}${isNearEnd(v.liveWindow) && v.promotionType !== 'Limited' ? '-alert' : ''}`,
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

const SHOUTOUT_LAYER_ID = 'venue-markers-shoutout';

// --- Add venue layer to map ---
function addVenueLayer(map, geojson) {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geojson
  });

  // Main layer — all non-Shoutout markers
  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['!=', ['get', 'promotionType'], 'Shoutout'],
    layout: {
      // Use the icon property, falling back to the base marker if the alert variant is missing
      'icon-image': [
        'coalesce',
        ['image', ['get', 'icon']],
        ['image', ['concat', 'marker-', ['get', 'venueType']]]
      ],
      'icon-size': 0.675,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 1,
    }
  });

  // Shoutout layer — separate so we can animate icon-size independently
  map.addLayer({
    id: SHOUTOUT_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['get', 'promotionType'], 'Shoutout'],
    layout: {
      'icon-image': [
        'coalesce',
        ['image', ['get', 'icon']],
        ['image', ['concat', 'marker-', ['get', 'venueType'], '-shoutout']]
      ],
      'icon-size': 0.675,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 1,
    }
  });

  // Pulse animation — gently scale Shoutout markers up and down
  const BASE_SIZE = 0.675;
  const PULSE_RANGE = 0.055; // ±8% of base size
  const PULSE_SPEED = 0.0018; // radians per ms
  let rafId = null;
  function animateShoutout(ts) {
    const size = BASE_SIZE + PULSE_RANGE * Math.sin(ts * PULSE_SPEED);
    if (map.getLayer(SHOUTOUT_LAYER_ID)) {
      map.setLayoutProperty(SHOUTOUT_LAYER_ID, 'icon-size', size);
    }
    rafId = requestAnimationFrame(animateShoutout);
  }
  rafId = requestAnimationFrame(animateShoutout);
}

// --- HTML venue name labels (uses Zalando Sans Expanded via CSS) ---
function setupVenueLabels(map) {
  const container = document.createElement('div');
  container.id = 'venue-labels';
  document.getElementById('map').appendChild(container);

  function updateLabels() {
    const features = map.queryRenderedFeatures({ layers: [LAYER_ID, SHOUTOUT_LAYER_ID] });

    // Deduplicate: one label per venue name (first marker wins for position)
    const seen = new Set();
    const unique = features.filter(f => {
      const key = f.properties.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sync DOM: build a map of existing label elements
    const existing = new Map();
    for (const el of container.children) {
      existing.set(el.dataset.key, el);
    }

    const active = new Set();

    for (const f of unique) {
      const coords = f.geometry.coordinates;
      const name = f.properties.name;
      const key = name;
      active.add(key);

      const point = map.project(coords);

      let el = existing.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'venue-label';
        el.dataset.key = key;
        el.textContent = name;
        container.appendChild(el);
      }

      // icon-anchor:'bottom' means point = pin tip. Label goes just below the tip.
      const lx = Math.round(point.x);
      const ly = Math.round(point.y + 5);
      el.style.transform = `translate(calc(${lx}px - 50%), ${ly}px)`;
    }

    // Remove stale labels
    for (const [key, el] of existing) {
      if (!active.has(key)) el.remove();
    }
  }

  map.on('render', updateLabels);
}

// --- Popup interactions (hover on desktop, click on mobile) ---
function setupPopups(map) {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'venue-mapbox-popup',
    maxWidth: '280px',
    offset: [0, -46],
  });
  activePopup = popup;

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    // Mobile: click to open, click elsewhere to close
    const onMarkerClick = (e) => {
      const feature = e.features[0];
      popup
        .setLngLat(feature.geometry.coordinates)
        .setHTML(buildPopupHTML(feature.properties))
        .addTo(map);

      const popupEl = popup.getElement();
      if (popupEl) popupEl.addEventListener('click', (ev) => ev.stopPropagation());
    };
    map.on('click', LAYER_ID, onMarkerClick);
    map.on('click', SHOUTOUT_LAYER_ID, onMarkerClick);

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID, SHOUTOUT_LAYER_ID] });
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

    const onMarkerEnter = (e) => {
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
    };
    map.on('mouseenter', LAYER_ID, onMarkerEnter);
    map.on('mouseenter', SHOUTOUT_LAYER_ID, onMarkerEnter);

    map.on('mouseleave', LAYER_ID, scheduleClose);
    map.on('mouseleave', SHOUTOUT_LAYER_ID, scheduleClose);
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

  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

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

      // Store refs for onboarding tooltip positioning
      _onboardingMap = map;
      _onboardingVenues = venues;

      const geojson = buildGeoJSON(venues);
      addVenueLayer(map, geojson);
      setupVenueLabels(map);

      // --- Effect 1: Fog & atmosphere ---
      map.setFog({
        'range': [-1, 7],
        'horizon-blend': 0.25,
        'color': '#0d1f35',
        'high-color': '#091525',
        'space-color': '#040d18',
        'star-intensity': 0.7
      });

      // --- Effect 2: Water breathing animation ---
      setInterval(() => {
        const t = (Math.sin(Date.now() / 3000) + 1) / 2;
        const opacity = waterOpacityBase + t * waterOpacitySwing;
        map.setPaintProperty('water', 'fill-opacity', opacity);
      }, 50);


      // --- Effect 4: Map texture baseline (roads/buildings updated by weather system) ---
      try {
        map.setPaintProperty('water', 'fill-color', '#0e1c20'); // baseline; overridden by applyWeather
        try { map.setPaintProperty('park', 'fill-color', '#0d2016'); } catch (_) {}
        try { map.setPaintProperty('national-park', 'fill-color', '#0d2016'); } catch (_) {}
        try { map.setPaintProperty('landuse', 'fill-color', '#0c1018'); } catch (_) {}
        try { map.setPaintProperty('landcover', 'fill-color', '#0c1018'); } catch (_) {}
        try { map.setPaintProperty('background', 'background-color', '#0a0e14'); } catch (_) {}
      } catch (e) {
        console.warn('Map texture: some layers not found', e.message);
      }

      // --- Effect 5: Hybrid weather overlay ---
      initWeatherSystem(map);

      // --- Effect 6: Radar grid pulse ---
      createGridOverlay();

      setupPopups(map);

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
        }, REFRESH_INTERVAL);
    });

    // Re-register a specific missing image on demand (e.g. after style reload)
    map.on('styleimagemissing', (e) => {
      const missingId = e.id;
      // Check if it's one of our marker images
      for (const [venueType, svg] of Object.entries(VENUE_TYPE_SVGS)) {
        const normalId = `marker-${venueType}`;
        const alertId = `marker-${venueType}-alert`;
        if (missingId === alertId) {
          // Load alert variant; if it fails, copy the normal image as fallback
          loadSingleMarkerImage(map, alertId, makeAlertSvg(svg)).then(ok => {
            if (!ok && map.hasImage(normalId) && !map.hasImage(alertId)) {
              // Fallback: alias alert to normal so marker still renders
              const canvas = document.createElement('canvas');
              canvas.width = 63; canvas.height = 83;
              const ctx = canvas.getContext('2d');
              const img = new Image(63, 83);
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
                if (!map.hasImage(alertId)) map.addImage(alertId, canvas, { pixelRatio: 2 });
              };
              img.src = makeSvgData(svg);
            }
          });
          return;
        }
        if (missingId === normalId) {
          loadSingleMarkerImage(map, normalId, svg);
          return;
        }
      }
    });

  } catch (err) {
    console.error('Init error:', err);
  }
}

// --- Splash Screen & Onboarding ---
function runSplashAndOnboarding() {
  const splash = document.getElementById('splash-screen');
  const onboarding = document.getElementById('onboarding-overlay');
  const ctaBtn = document.getElementById('onboarding-cta');
  const inner = document.getElementById('onboarding-inner');
  const tooltipOverlay = document.getElementById('tooltip-overlay');
  const steps = tooltipOverlay ? tooltipOverlay.querySelectorAll('.tooltip-step') : [];

  const ONBOARDING_KEY = '529-onboarding-done';
  const onboardingDone = localStorage.getItem(ONBOARDING_KEY);

  function showStep(n) {
    steps.forEach(s => s.classList.remove('active'));
    const target = tooltipOverlay.querySelector(`.tooltip-step[data-step="${n}"]`);
    if (target) target.classList.add('active');
  }

  // t=50ms: elevator doors slide open
  setTimeout(() => {
    splash.classList.add('doors-open');
  }, 50);

  // t=300ms: logo slides up from bottom into center
  setTimeout(() => {
    splash.classList.add('logo-in');
  }, 300);

  // t=1700ms: logo slides up and exits top
  setTimeout(() => {
    splash.classList.add('logo-out');
  }, 1700);

  // t=2100ms: show onboarding card (if not done), then hide splash
  setTimeout(() => {
    if (!onboardingDone) {
      onboarding.classList.remove('hidden');
      void onboarding.offsetHeight; // force reflow so transition fires
      onboarding.classList.add('slide-in');
    }
    setTimeout(() => {
      splash.classList.add('done');
    }, 200);
  }, 2100);

  // LET'S GO: slide card down, then show tooltip steps anchored to a real marker
  // Use setTimeout instead of transitionend — transitionend is unreliable when the
  // element starts at translateY(100vh) and slide-out returns it there (no movement = no event)
  ctaBtn.addEventListener('click', () => {
    onboarding.classList.remove('slide-in');
    onboarding.classList.add('slide-out');
    setTimeout(() => {
      onboarding.style.display = 'none';
      positionAndShowTooltips(tooltipOverlay, showStep);
    }, 420); // slide-out transition is 0.4s
  });

  // Wire tooltip nav buttons
  const dismissOnboarding = () => {
    removeOnboardingSpotlight();
    tooltipOverlay.classList.add('hidden');
    localStorage.setItem(ONBOARDING_KEY, '1');
  };

  if (tooltipOverlay) {
    // Tap anywhere on the tooltip bubble to dismiss
    tooltipOverlay.querySelector('.tooltip-step[data-step="1"] .tooltip-bubble').addEventListener('click', () => {
      dismissOnboarding();
    });
  }
}

// --- Position and show tooltip overlay, anchored to the most isolated active marker ---
function positionAndShowTooltips(tooltipOverlay, showStep, attempt = 0) {
  if (!tooltipOverlay) return;

  // If map or venues not ready yet, retry up to 10 times (~3s total) before giving up
  if (!_onboardingMap || !_onboardingVenues || _onboardingVenues.length === 0) {
    if (attempt < 10) {
      setTimeout(() => positionAndShowTooltips(tooltipOverlay, showStep, attempt + 1), 300);
    }
    return;
  }

  // Collect all currently active venues
  const active = _onboardingVenues.filter(v => isDealActiveNow(v));

  // No active venues — skip tooltips entirely, mark onboarding done
  if (active.length === 0) {
    localStorage.setItem('529-onboarding-done', '1');
    return;
  }

  // Pick the most isolated venue: largest minimum distance (in degrees) to all other active venues
  // This ensures the tooltip points at a lone, easy-to-read marker
  let best = active[0];
  let bestMinDist = -1;

  for (const v of active) {
    let minDist = Infinity;
    for (const other of active) {
      if (other === v) continue;
      const dx = v.lng - other.lng;
      const dy = v.lat - other.lat;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) minDist = d;
    }
    // Single venue has no neighbours — it wins outright
    if (active.length === 1) minDist = Infinity;
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = v;
    }
  }

  const map = _onboardingMap;

  // CSS div spotlight — tracks marker body center via map.on('render')
  const spotEl = document.getElementById('onboarding-spotlight-el');

  function updateSpotlight() {
    if (!spotEl || !spotEl.classList.contains('active')) return;
    const pt = map.project({ lng: best.lng, lat: best.lat });
    // marker body center is ~22px above the pin tip (icon-anchor: bottom)
    spotEl.style.left = pt.x + 'px';
    spotEl.style.top  = (pt.y - 22) + 'px';
  }

  if (spotEl) {
    spotEl.classList.add('active');
    updateSpotlight();
    map.on('render', updateSpotlight);
    // Store the handler so we can remove it later
    spotEl._renderHandler = updateSpotlight;
  }

  // Project the marker's lng/lat to screen pixels
  // icon-anchor = 'bottom' so pin tip = point; marker body center is ~22px above tip
  const point = map.project({ lng: best.lng, lat: best.lat });

  // Position step 1 bubble: tail points down at the marker body center
  const step1 = tooltipOverlay.querySelector('.tooltip-step[data-step="1"]');
  const BUBBLE_W = 210;
  const MARGIN = 12;
  const pinX = point.x;
  const pinY = point.y - 22; // marker body center

  const left = Math.max(MARGIN, Math.min(pinX - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - MARGIN));
  // Bottom of the tooltip div sits 12px above the marker body center
  const bottomFromViewport = window.innerHeight - pinY + 12;

  step1.style.left = left + 'px';
  step1.style.bottom = bottomFromViewport + 'px';
  step1.style.top = 'auto';

  // Show overlay and activate step 1
  tooltipOverlay.classList.remove('hidden');
  showStep(1);
}

// --- Remove the CSS spotlight ring when done with step 1 ---
function removeOnboardingSpotlight() {
  const spotEl = document.getElementById('onboarding-spotlight-el');
  if (!spotEl) return;
  spotEl.classList.remove('active');
  if (_onboardingMap && spotEl._renderHandler) {
    _onboardingMap.off('render', spotEl._renderHandler);
    spotEl._renderHandler = null;
  }
}

// --- Logo badge date (LA time) ---
function updateBadgeDate() {
  const el = document.getElementById('logo-badge__date');
  if (!el) return;
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(now);
  const get = t => parts.find(p => p.type === t)?.value || '';
  el.textContent = `${get('weekday')} | ${get('month')} ${get('day')}, ${get('year')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  updateBadgeDate();
  setInterval(updateBadgeDate, 60000);
  runSplashAndOnboarding();
  init();
});
