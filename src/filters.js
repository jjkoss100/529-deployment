import { getCurrentDayName, getDayNames, getDayShortNames, hasHoursOnDay, isPromotionActiveForDayTime } from './utils.js?v=12';
import { getNeighborhoods, getAllMenuCategories } from './data.js';

const filterState = {
  activeOnly: true,
  promotionType: 'all',       // 'all', 'happy-hour', 'special'
  selectedDay: 'today',       // 'today' or a day name
  neighborhoods: [],           // empty = all
  menuCategories: [],          // empty = all
  hasWeekendHours: false
};

let onFilterChangeCallback = null;

/**
 * Get the current effective day name for filtering.
 */
function getEffectiveDay() {
  return filterState.selectedDay === 'today' ? getCurrentDayName() : filterState.selectedDay;
}

/**
 * Initialize the filter UI and populate dynamic options.
 */
export function initFilterUI(venues, onChange) {
  onFilterChangeCallback = onChange;

  const neighborhoods = getNeighborhoods(venues);
  const categories = getAllMenuCategories(venues);

  buildFilterPanel(neighborhoods, categories);
  attachEventListeners();

  // Trigger initial render
  onChange(filterState);
}

/**
 * Get the current filter state.
 */
export function getFilterState() {
  return { ...filterState };
}

/**
 * Apply filters to venues and return the filtered list.
 */
export function applyFilters(venues) {
  const effectiveDay = getEffectiveDay();

  return venues.filter(venue => {
    // Promotion type filter
    const hasHH = venue.happyHours.length > 0;
    const hasSp = venue.specials.length > 0;

    if (filterState.promotionType === 'happy-hour' && !hasHH) return false;
    if (filterState.promotionType === 'special' && !hasSp) return false;

    // Active only filter
    if (filterState.activeOnly) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentDay = getCurrentDayName();

      // When "Active Now" is on AND selectedDay is 'today', filter to currently active
      if (filterState.selectedDay === 'today') {
        let isActive = false;

        if (filterState.promotionType !== 'special') {
          isActive = isActive || venue.happyHours.some(hh =>
            isPromotionActiveForDayTime(hh.hours, currentDay, currentMinutes)
          );
        }
        if (filterState.promotionType !== 'happy-hour') {
          isActive = isActive || venue.specials.some(sp =>
            isPromotionActiveForDayTime(sp.hours, currentDay, currentMinutes)
          );
        }

        if (!isActive) return false;
      } else {
        // When a specific day is selected with "Active Now", show venues that have hours on that day
        let hasHoursOnSelectedDay = false;

        if (filterState.promotionType !== 'special') {
          hasHoursOnSelectedDay = hasHoursOnSelectedDay || venue.happyHours.some(hh =>
            hasHoursOnDay(hh.hours, effectiveDay)
          );
        }
        if (filterState.promotionType !== 'happy-hour') {
          hasHoursOnSelectedDay = hasHoursOnSelectedDay || venue.specials.some(sp =>
            hasHoursOnDay(sp.hours, effectiveDay)
          );
        }

        if (!hasHoursOnSelectedDay) return false;
      }
    }

    // Neighborhood filter
    if (filterState.neighborhoods.length > 0) {
      if (!filterState.neighborhoods.includes(venue.area)) return false;
    }

    // Menu category filter
    if (filterState.menuCategories.length > 0) {
      const hasMatchingCategory = filterState.menuCategories.some(cat =>
        venue.allMenuCategories.includes(cat)
      );
      if (!hasMatchingCategory) return false;
    }

    // Weekend hours filter
    if (filterState.hasWeekendHours) {
      if (!venue.hasWeekendHappyHour && !venue.hasWeekendSpecial) return false;
    }

    return true;
  });
}

/**
 * Build the filter panel DOM.
 */
function buildFilterPanel(neighborhoods, categories) {
  const panel = document.getElementById('filter-panel');
  if (!panel) return;

  const days = getDayNames();
  const dayShort = getDayShortNames();
  const todayIndex = new Date().getDay();

  panel.innerHTML = `
    <div class="sheet-handle" id="sheet-handle"></div>
    <div class="mobile-summary">
      <span>Venice Happy Hours</span>
      <span class="mobile-summary-count" id="mobile-active-count">Loading...</span>
    </div>
    <div class="filter-header">
      <h1 class="filter-title">Venice Happy Hours</h1>
      <div class="filter-clock" id="filter-clock"></div>
    </div>

    <div class="filter-section">
      <div class="filter-toggle-row">
        <label class="toggle-label" for="active-toggle">Active Now</label>
        <label class="toggle-switch">
          <input type="checkbox" id="active-toggle" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-section-label">Type</div>
      <div class="filter-pills" id="promo-type-pills">
        <button class="pill pill--active" data-value="all">All</button>
        <button class="pill" data-value="happy-hour">Happy Hours</button>
        <button class="pill" data-value="special">Specials</button>
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-section-label">Day</div>
      <div class="filter-pills filter-pills--scroll" id="day-pills">
        <button class="pill pill--active" data-value="today">Today</button>
        ${days.map((day, i) => `
          <button class="pill${i === todayIndex ? ' pill--today' : ''}" data-value="${day}">${dayShort[i]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-section-label">Neighborhood</div>
      <div class="filter-checkboxes" id="neighborhood-checks">
        ${neighborhoods.map(n => `
          <label class="checkbox-label">
            <input type="checkbox" value="${escapeAttr(n)}" class="neighborhood-check">
            <span>${escapeHtml(n)}</span>
          </label>
        `).join('')}
      </div>
    </div>

    ${categories.length > 0 ? `
    <div class="filter-section">
      <div class="filter-section-label">Menu</div>
      <div class="filter-chips" id="category-chips">
        ${categories.map(c => `
          <button class="chip" data-value="${escapeAttr(c)}">${escapeHtml(c)}</button>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="filter-section">
      <div class="filter-toggle-row">
        <label class="toggle-label" for="weekend-toggle">Weekend Hours</label>
        <label class="toggle-switch">
          <input type="checkbox" id="weekend-toggle">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="filter-results" id="filter-results">
      Showing all venues
    </div>
  `;
}

/**
 * Attach event listeners to filter controls.
 */
function attachEventListeners() {
  // Active toggle
  const activeToggle = document.getElementById('active-toggle');
  if (activeToggle) {
    activeToggle.addEventListener('change', () => {
      filterState.activeOnly = activeToggle.checked;
      triggerChange();
    });
  }

  // Promotion type pills
  const promoTypePills = document.getElementById('promo-type-pills');
  if (promoTypePills) {
    promoTypePills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      promoTypePills.querySelectorAll('.pill').forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');
      filterState.promotionType = pill.dataset.value;
      triggerChange();
    });
  }

  // Day pills
  const dayPills = document.getElementById('day-pills');
  if (dayPills) {
    dayPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      dayPills.querySelectorAll('.pill').forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');
      filterState.selectedDay = pill.dataset.value;
      triggerChange();
    });
  }

  // Neighborhood checkboxes
  document.querySelectorAll('.neighborhood-check').forEach(cb => {
    cb.addEventListener('change', () => {
      filterState.neighborhoods = Array.from(
        document.querySelectorAll('.neighborhood-check:checked')
      ).map(el => el.value);
      triggerChange();
    });
  });

  // Category chips
  document.querySelectorAll('#category-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('chip--active');
      filterState.menuCategories = Array.from(
        document.querySelectorAll('#category-chips .chip--active')
      ).map(el => el.dataset.value);
      triggerChange();
    });
  });

  // Weekend toggle
  const weekendToggle = document.getElementById('weekend-toggle');
  if (weekendToggle) {
    weekendToggle.addEventListener('change', () => {
      filterState.hasWeekendHours = weekendToggle.checked;
      triggerChange();
    });
  }
}

function triggerChange() {
  if (onFilterChangeCallback) {
    onFilterChangeCallback(filterState);
  }
}

/**
 * Update the results count display.
 */
export function updateResultsCount(filtered, total) {
  const el = document.getElementById('filter-results');
  if (el) {
    el.textContent = `Showing ${filtered} of ${total} venues`;
  }
}

/**
 * Initialize the mobile bottom sheet behavior.
 */
export function initBottomSheet() {
  const sheet = document.getElementById('filter-panel');
  const handle = document.getElementById('sheet-handle');
  if (!sheet || !handle) return;

  let startY = 0;
  let startHeight = 0;

  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    startHeight = sheet.offsetHeight;
    sheet.style.transition = 'none';
  });

  handle.addEventListener('touchmove', (e) => {
    const deltaY = startY - e.touches[0].clientY;
    const newHeight = Math.min(Math.max(60, startHeight + deltaY), window.innerHeight * 0.85);
    sheet.style.height = newHeight + 'px';
  });

  handle.addEventListener('touchend', () => {
    sheet.style.transition = '';
    const height = sheet.offsetHeight;
    const viewH = window.innerHeight;

    // Snap to collapsed (60px) or expanded (60vh)
    if (height < viewH * 0.25) {
      sheet.classList.remove('sheet--expanded');
      sheet.style.height = '';
    } else {
      sheet.classList.add('sheet--expanded');
      sheet.style.height = '';
    }
  });

  // Toggle on handle click
  handle.addEventListener('click', () => {
    sheet.classList.toggle('sheet--expanded');
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
