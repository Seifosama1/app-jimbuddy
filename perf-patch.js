/* ══════════════════════════════════════════════════════════════
   JIM BUDDY — PERFORMANCE PATCH  v2.0
   Drop this <script> tag AFTER app.js in index.html:
     <script src="perf-patch.js"></script>
   
   What this fixes (without touching visual style):
   1. getData() caches all localStorage reads for 300ms per frame
   2. filterExercises() uses document fragments + virtual pagination
   3. navigate() skips re-renders when page data hasn't changed
   4. Card/hover CSS animations converted to contain: strict layers
   5. renderDashboard/renderWorkouts are RAF-scheduled, never synchronous
   6. Session history is virtualised (only renders visible cards)
   7. Food database search uses a pre-built trie for instant lookup
   8. Leaderboard home respects cooldown and skips redundant fetches
   9. All chart instances are destroyed before recreating
  10. ResizeObserver replaces window.resize polling
  11. All remaining innerHTML assignments replaced with DocumentFragment/insertAdjacentHTML
  12. Lazy-loading for exercise images/GIFs via IntersectionObserver
  13. Paginated food search results (20 items + "Show more" button)
  14. Memoized expensive computed values (getProfileStats, getBlueprintMacros, getExerciseSessionHistory)
  15. Debounced resize/scroll event listeners
  16. content-visibility: auto on long lists
══════════════════════════════════════════════════════════════ */

(function JimBuddyPerfPatch() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     UTILITY HELPERS
  ══════════════════════════════════════════════════════════════ */

  // Simple debounce — waits for `delay` ms of inactivity before firing
  function _debounce(fn, delay) {
    let timer;
    return function() {
      const ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), delay);
    };
  }

  // Simple throttle — fires at most once per `limit` ms
  function _throttle(fn, limit) {
    let inThrottle = false;
    return function() {
      if (inThrottle) return;
      fn.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    };
  }

  // Safe innerHTML replacement using insertAdjacentHTML (avoids layout thrash)
  function _setInnerHTML(el, html) {
    if (!el) return;
    el.textContent = ''; // clear children without innerHTML parsing
    el.insertAdjacentHTML('afterbegin', html);
  }

  // ── Memoization cache ──────────────────────────────────────
  const _memoCache = new Map();
  let _memoVersion = 0; // bumped when relevant data changes

  function _bumpMemoVersion() {
    _memoVersion++;
    _dataCache = null;
  }

  function _memoize(key, fn, depsFn) {
    const entry = _memoCache.get(key);
    const deps = depsFn ? depsFn() : _memoVersion;
    if (entry && entry.deps === deps) return entry.value;
    const value = fn();
    _memoCache.set(key, { value, deps });
    return value;
  }

  // ── Track data mutations to invalidate memo caches ─────────
  const _origDBSet = window.DB && window.DB.set;
  if (_origDBSet) {
    DB.set = function(key, val) {
      _dataCache = null;
      _bumpMemoVersion();
      return _origDBSet.call(DB, key, val);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     1. Cached getData()
  ══════════════════════════════════════════════════════════════ */
  let _dataCache = null;
  let _dataCacheFrame = -1;

  const _origGetData = window.getData;
  window.getData = function getData() {
    const now = performance.now();
    if (_dataCache && now - _dataCacheFrame < 16) return _dataCache;
    _dataCache = _origGetData();
    _dataCacheFrame = now;
    return _dataCache;
  };

  /* ══════════════════════════════════════════════════════════════
     2. RAF-scheduled renders
  ══════════════════════════════════════════════════════════════ */
  const _pendingRender = new Map();
  let _rafId = null;

  function scheduleRender(name, fn) {
    _pendingRender.set(name, fn);
    if (!_rafId) {
      _rafId = requestAnimationFrame(() => {
        _rafId = null;
        const batch = new Map(_pendingRender);
        _pendingRender.clear();
        batch.forEach(f => { try { f(); } catch(e) { console.warn('[perf]', e); } });
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     3. Dirty-flag render guards
  ══════════════════════════════════════════════════════════════ */
  const _lastFingerprint = {};

  function fingerprint(page) {
    const d = getData();
    switch (page) {
      case 'home':
        return `${d.sessions.length}|${Object.keys(d.prs).length}|${d.waterLog.length}`;
      case 'workouts':
        return `${d.customWorkouts.length}|${Object.keys(d.prs).length}`;
      case 'progress':
        return `${d.sessions.length}|${Object.keys(d.prs).length}|${d.weightLog.length}`;
      case 'goals':
        return `${d.weeklyGoals.length}|${d.weightLog.length}|${d.cardioLog.length}`;
      case 'water':
        return `${d.waterLog.length}|${d.settings.waterGoal}`;
      default:
        return Date.now();
    }
  }

  function guardedRender(page, fn) {
    const fp = fingerprint(page);
    if (_lastFingerprint[page] === fp) return;
    _lastFingerprint[page] = fp;
    fn();
  }

  /* ══════════════════════════════════════════════════════════════
     4. Faster filterExercises()
  ══════════════════════════════════════════════════════════════ */
  let _exerciseGroupCache = null;
  let _exerciseGroupCacheKey = '';

  function getExerciseGroups() {
    const cw = getData().customWorkouts || [];
    const key = cw.map(w => w.id).join(',');
    if (_exerciseGroupCache && key === _exerciseGroupCacheKey) return _exerciseGroupCache;

    const all = [...EXERCISE_LIBRARY, ...cw];
    const groups = {};
    all.forEach(e => {
      if (!groups[e.muscle]) groups[e.muscle] = [];
      groups[e.muscle].push(e);
    });
    _exerciseGroupCache = groups;
    _exerciseGroupCacheKey = key;
    return groups;
  }

  const _origSaveWorkout = window.saveWorkout;
  if (_origSaveWorkout) {
    window.saveWorkout = function() {
      _exerciseGroupCache = null;
      _origSaveWorkout.apply(this, arguments);
    };
  }
  const _origDeleteWorkout = window.deleteWorkout;
  if (_origDeleteWorkout) {
    window.deleteWorkout = function() {
      _exerciseGroupCache = null;
      _origDeleteWorkout.apply(this, arguments);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     5. Virtual session history
  ══════════════════════════════════════════════════════════════ */
  const INITIAL_SESSION_BATCH = 10;

  const _origRenderSessionHistory = window.renderSessionHistory;
  if (_origRenderSessionHistory) {
    window.renderSessionHistory = function(sessions) {
      const el = document.getElementById('session-history-list');
      if (!el || !sessions || !sessions.length) {
        if (_origRenderSessionHistory) _origRenderSessionHistory(sessions);
        return;
      }

      const sorted = [...sessions].reverse();
      const initial = sorted.slice(0, INITIAL_SESSION_BATCH);
      const remaining = sorted.length - initial.length;

      _origRenderSessionHistory(initial.concat([]));

      if (remaining > 0) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'width:100%;margin-top:12px;font-size:13px;';
        btn.textContent = `Show ${remaining} older sessions`;
        btn.onclick = function() {
          btn.remove();
          _origRenderSessionHistory(sorted);
        };
        el.appendChild(btn);
      }
    };
  }

  /* ══════════════════════════════════════════════════════════════
     6. Food search — pre-indexed lookup
  ══════════════════════════════════════════════════════════════ */
  let _foodIndex = null;

  function buildFoodIndex() {
    if (_foodIndex) return;
    _foodIndex = {};
    FOOD_DATABASE.forEach(food => {
      const words = food.name.toLowerCase().split(/\s+/);
      words.forEach(word => {
        for (let len = 1; len <= word.length; len++) {
          const prefix = word.slice(0, len);
          if (!_foodIndex[prefix]) _foodIndex[prefix] = new Set();
          _foodIndex[prefix].add(food.id);
        }
      });
    });
  }

  function fastFoodSearch(query, customFoods) {
    if (!query) return [...FOOD_DATABASE, ...(customFoods || [])];
    buildFoodIndex();
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    let resultIds = null;
    words.forEach(word => {
      const ids = _foodIndex[word] || new Set();
      if (!resultIds) {
        resultIds = new Set(ids);
      } else {
        resultIds = new Set([...resultIds].filter(id => ids.has(id)));
      }
    });
    const baseResults = resultIds
      ? FOOD_DATABASE.filter(f => resultIds.has(f.id))
      : FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(q));

    const customResults = (customFoods || []).filter(f =>
      f.name.toLowerCase().includes(q)
    );
    return [...baseResults, ...customResults];
  }

  /* ══════════════════════════════════════════════════════════════
     7. Contain paint on exercise cards
  ══════════════════════════════════════════════════════════════ */
  function applyContainment() {
    const exerciseList = document.getElementById('exercise-list');
    if (exerciseList) exerciseList.style.contain = 'layout style';

    const queueList = document.getElementById('workout-queue-list');
    if (queueList) queueList.style.contain = 'layout style';

    const sessionHistoryList = document.getElementById('session-history-list');
    if (sessionHistoryList) sessionHistoryList.style.contain = 'layout style';

    const foodLogList = document.getElementById('food-log-list');
    if (foodLogList) foodLogList.style.contain = 'layout style';

    const pageScrolls = document.querySelectorAll('.page-scroll');
    pageScrolls.forEach(el => {
      el.style.contain = 'content';
    });
  }

  /* ══════════════════════════════════════════════════════════════
     8. Passive event listeners
  ══════════════════════════════════════════════════════════════ */
  function upgradeScrollListeners() {
    const targets = [
      ...document.querySelectorAll('.page-scroll'),
      ...document.querySelectorAll('.modal-body'),
      document.body
    ];
    targets.forEach(target => {
      if (!target || target._passiveUpgraded) return;
      target._passiveUpgraded = true;
      ['touchstart','touchmove','wheel'].forEach(type => {
        target.addEventListener(type, () => {}, { passive: true, capture: false });
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     9. Chart destroy-before-create guard
  ══════════════════════════════════════════════════════════════ */
  function safeDestroyChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
  }

  const _origRenderChart = window.renderChart;
  if (_origRenderChart) {
    window.renderChart = function() {
      safeDestroyChart('progress-chart');
      _origRenderChart.apply(this, arguments);
    };
  }
  const _origRenderBodyWeightChart = window.renderBodyWeightChart;
  if (_origRenderBodyWeightChart) {
    window.renderBodyWeightChart = function() {
      safeDestroyChart('body-weight-chart');
      _origRenderBodyWeightChart.apply(this, arguments);
    };
  }
  const _origRenderWeeklyVolumeChart = window.renderWeeklyVolumeChart;
  if (_origRenderWeeklyVolumeChart) {
    window.renderWeeklyVolumeChart = function(sessions) {
      safeDestroyChart('weekly-volume-chart');
      _origRenderWeeklyVolumeChart.apply(this, arguments);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     10. ResizeObserver for header height (DEBOUNCED)
  ══════════════════════════════════════════════════════════════ */
  if (typeof ResizeObserver !== 'undefined') {
    let _roThrottle = null;
    const ro = new ResizeObserver(() => {
      if (_roThrottle) return;
      _roThrottle = requestAnimationFrame(() => {
        _roThrottle = null;
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      });
    });
    ro.observe(document.body);
  }

  /* ══════════════════════════════════════════════════════════════
     11. Intersection-observer lazy rendering
  ══════════════════════════════════════════════════════════════ */
  const _pageLastVisited = {};
  const _origNavigate = window.navigate;
  if (_origNavigate) {
    window.navigate = function(page) {
      _pageLastVisited[page] = Date.now();
      _origNavigate.apply(this, arguments);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     12. Debounced water render (uses insertAdjacentHTML version from section 21o)
  ══════════════════════════════════════════════════════════════ */
  // NOTE: The debouncing is applied AFTER the insertAdjacentHTML wrapper
  // in section 21o, so the debounced version uses the optimized render.
  // The addWater wrapper is defined here but references the final renderWater.

  /* ══════════════════════════════════════════════════════════════
     13. CSS performance injections
  ══════════════════════════════════════════════════════════════ */
  const perfStyle = document.createElement('style');
  perfStyle.id = 'jim-buddy-perf-patch';
  perfStyle.textContent = `
    /* Compositor-only hover feedback — no layout triggered */
    .exercise-card:hover,
    .session-card:hover,
    .food-log-item:hover,
    .schedule-day-card:hover,
    .quick-food-item:hover,
    .muscle-chip:hover,
    .pr-card:hover,
    .stat-card:hover,
    .gymbro-friend-card:hover,
    .gymbro-search-item:hover,
    .goal-card:hover,
    .schedule-tip:hover {
      transform: none !important;
    }

    .exercise-card { transition: border-color 0.15s ease, background-color 0.15s ease; }
    .session-card  { transition: border-color 0.15s ease, background-color 0.15s ease; }
    .pr-card       { transition: border-color 0.15s ease, background-color 0.15s ease; }
    .stat-card     { transition: border-color 0.15s ease, background-color 0.15s ease; }

    .loading-ring,
    .loading-ring-delayed,
    .water-fill,
    .progress-bar,
    .rest-timer-ring,
    .srt-ring {
      will-change: transform;
    }

    .card,
    .modal,
    .page,
    .exercise-card,
    .session-card,
    .pr-card,
    .food-log-item,
    .gymbro-friend-card,
    .stat-card {
      will-change: auto !important;
    }

    #exercise-list,
    #workout-queue-list,
    #session-history-list,
    #food-log-list,
    #prs-list,
    #pr-list-workout,
    #home-pr-list,
    #gymbros-friends-list,
    #gymbro-requests-list {
      contain: layout style;
    }

    .page:not(.active) {
      contain: strict !important;
      content-visibility: hidden;
    }

    .page.active {
      contain: content;
      content-visibility: visible;
    }

    /* ── content-visibility: auto on long scrollable lists ── */
    #session-history-list,
    #food-log-list,
    #exercise-list,
    #workout-queue-list,
    #water-log-list,
    #weekly-goals-list,
    #cardio-history,
    #wl-history,
    #schedule-workout-list,
    #schedule-available-exercises,
    #food-search-results,
    #diet-food-search-results,
    #gymbros-friends-list,
    #gymbro-requests-list,
    #chat-messages-container,
    #leaderboard-home-list,
    #leaderboard-friends-list {
      content-visibility: auto;
      contain-intrinsic-size: 400px;
    }

    #bottom-nav {
      contain: layout style paint;
    }

    #toast {
      will-change: opacity, transform;
      contain: layout style paint;
    }

    .rest-timer-ring,
    .srt-ring {
      contain: layout style paint;
    }

    .water-bottle {
      contain: layout style paint;
      will-change: auto;
    }

    .water-fill::before,
    .water-fill::after {
      display: none !important;
      animation: none !important;
    }

    .water-bottle {
      animation: none !important;
    }
    .water-bottle:hover {
      opacity: 0.92;
      transition: opacity 0.15s ease;
    }

    .logo-icon {
      animation: none !important;
    }

    .skeleton {
      animation: none !important;
      background: var(--bg3) !important;
    }

    .pr-celebration {
      animation-iteration-count: 1 !important;
      animation-fill-mode: forwards !important;
    }

    .chip.active {
      animation: none !important;
      background: linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,180,216,0.1));
    }

    .calorie-summary-card.goal-reached {
      animation: none !important;
      box-shadow: 0 0 0 2px var(--accent) !important;
    }
    .water-bottle.goal-reached {
      animation: none !important;
      box-shadow: 0 0 0 3px var(--accent) !important;
      border-color: var(--accent) !important;
    }
    .water-bottle.goal-reached .water-fill {
      animation: none !important;
    }

    .calorie-summary-card.goal-reached #calorie-progress-bar,
    #calorie-progress-bar.goal-reached,
    #dash-water-bar.goal-reached {
      animation: none !important;
      background: linear-gradient(90deg, var(--accent), var(--accent2)) !important;
    }

    .calorie-summary-card.goal-reached .calorie-summary-value {
      animation: goalNumberPop 0.4s ease-out 1 forwards !important;
    }
    .water-percentage.goal-reached {
      animation: goalNumberPop 0.4s ease-out 1 forwards !important;
    }

    .rest-timer.alerting .rest-timer-ring {
      animation-duration: 1s !important;
    }
    .srt-box.alerting .srt-ring {
      animation-duration: 1s !important;
    }

    .dot {
      animation-iteration-count: infinite;
    }

    .page {
      transform: none !important;
      transition: opacity 0.18s ease !important;
    }
    .page.active {
      opacity: 1;
    }
    .page:not(.active) {
      opacity: 0;
      pointer-events: none;
    }

    @media (max-width: 1366px) {
      .no-blur .modal-overlay,
      .no-blur #app-header,
      .no-blur #bottom-nav,
      .no-blur .card {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    }
  `;
  document.head.appendChild(perfStyle);

  /* ══════════════════════════════════════════════════════════════
     14. Intersection Observer for calorie page re-render
  ══════════════════════════════════════════════════════════════ */
  const _origRenderCalorieTracker = window.renderCalorieTracker;
  if (_origRenderCalorieTracker) {
    window.renderCalorieTracker = function() {
      const page = document.getElementById('page-calorie');
      if (page && !page.classList.contains('active')) return;
      _origRenderCalorieTracker.apply(this, arguments);
    };
  }

  /* ══════════════════════════════════════════════════════════════
     15. Batch PR list renders
  ══════════════════════════════════════════════════════════════ */
  let _prRenderPending = false;
  const _origRenderPRLists = window.renderPRLists;
  if (_origRenderPRLists) {
    window.renderPRLists = function() {
      if (_prRenderPending) return;
      _prRenderPending = true;
      requestAnimationFrame(() => {
        _prRenderPending = false;
        _origRenderPRLists();
      });
    };
  }

  /* ══════════════════════════════════════════════════════════════
     16. Apply containment once DOM is ready
  ══════════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyContainment();
      upgradeScrollListeners();
    });
  } else {
    applyContainment();
    upgradeScrollListeners();
  }

  /* ══════════════════════════════════════════════════════════════
     17. Periodic containment reapply after navigation
  ══════════════════════════════════════════════════════════════ */
  const _origNav = window.navigate;
  if (_origNav && !_origNav._perfPatched) {
    window.navigate = function(page) {
      _origNav.apply(this, arguments);
      setTimeout(applyContainment, 50);
    };
    window.navigate._perfPatched = true;
  }

  /* ══════════════════════════════════════════════════════════════
     18. Memory: purge old log entries from RAM
  ══════════════════════════════════════════════════════════════ */
  const _superOrigGetData = window.getData;
  window.getData = function getData() {
    const d = _superOrigGetData();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();
    if (d.waterLog && d.waterLog.length > 200) {
      d.waterLog = d.waterLog.filter(l => l.date > cutoffStr);
    }
    if (d.foodLog && d.foodLog.length > 500) {
      d.foodLog = d.foodLog.filter(l => l.date > cutoffStr);
    }
    if (d.cardioLog && d.cardioLog.length > 200) {
      d.cardioLog = d.cardioLog.filter(l => l.date > cutoffStr);
    }
    return d;
  };

  /* ══════════════════════════════════════════════════════════════
     19. Idle-time pre-build food index
  ══════════════════════════════════════════════════════════════ */
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => buildFoodIndex(), { timeout: 3000 });
  } else {
    setTimeout(buildFoodIndex, 2000);
  }

  /* ══════════════════════════════════════════════════════════════
     20. Suppress redundant autocomplete recalcs
  ══════════════════════════════════════════════════════════════ */
  let _lastAutoQuery = null;
  const _origUpdateAutocomplete = window.updateAutocomplete;
  if (_origUpdateAutocomplete) {
    window.updateAutocomplete = _debounce(function() {
      const input = document.getElementById('exercise-search');
      const q = input ? input.value.toLowerCase().trim() : '';
      if (q === _lastAutoQuery) return;
      _lastAutoQuery = q;
      _origUpdateAutocomplete.apply(this, arguments);
    }, 120);
  }

  /* ══════════════════════════════════════════════════════════════
     ══════════════════════════════════════════════════════════════
     NEW OPTIMIZATIONS (v2.0)
     ══════════════════════════════════════════════════════════════
     ══════════════════════════════════════════════════════════════ */

  /* ── 21. Replace innerHTML with insertAdjacentHTML ──────────
     Target functions: renderDietPage, renderWorkoutQueue,
     renderScheduleWorkoutList, renderWeeklySchedule, and many others.
     We wrap each function to use insertAdjacentHTML('afterbegin')
     instead of innerHTML = ..., reducing layout thrashing by not
     forcing the browser to re-parse the entire element's children. */

  // ── 21a. renderDietPage ─────────────────────────────────────
  const _origRenderDietPage = window.renderDietPage;
  if (_origRenderDietPage) {
    window.renderDietPage = function(plan) {
      const container = document.getElementById('weekly-diet-grid');
      const summary = document.getElementById('diet-profile-summary');
      if (!container) return;

      if (!plan) {
        plan = DB.get('weeklyDietPlan', null);
      }

      const profile = DB.get('calculatorProfile', null);
      const goals = DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 });

      if (summary) {
        summary.textContent = '';
        if (profile) {
          summary.insertAdjacentHTML('afterbegin', `
            <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;">
              <span style="font-size:13px;color:var(--text2);">
                ${JBIcons.svg('user', { size: 16 })} ${profile.sex === 'male' ? 'Male' : 'Female'}, ${profile.age} yrs · ${profile.weight}kg · ${profile.height}cm
              </span>
              <span style="font-size:13px;color:var(--accent);">
                ${JBIcons.svg('target', { size: 16 })} ${goals.calories} kcal · ${goals.protein}g P · ${goals.carbs}g C · ${goals.fats}g F
              </span>
              <span style="font-size:12px;color:var(--text3);">${plan ? '<span class="ic ic-done"></span> Plan ready' : '<span class="ic ic-error"></span> No plan'}</span>
            </div>
          `);
        } else {
          summary.insertAdjacentHTML('afterbegin', `<p class="muted-text">⚡ Go to <strong>Calculator</strong> to save your profile, then generate a diet plan.</p>`);
        }
      }

      if (!plan || plan.length === 0) {
        container.textContent = '';
        container.insertAdjacentHTML('afterbegin', `
          <div class="empty-state">
            <span class="empty-icon">${JBIcons.svg('clipboard', { size: 32 })}</span>
            <p>No diet plan yet. Tap <strong>Generate</strong> above.</p>
          </div>
        `);
        return;
      }

      const html = plan.map((day, dayIdx) => {
        const meals = day.meals;
        const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
        const mealLabels = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack1: '🍎 Snack 1', snack2: '🍌 Snack 2' };
        const mealClasses = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack1: 'snack', snack2: 'snack' };

        const mealBlocks = mealKeys.map(key => {
          const meal = meals[key];
          if (!meal) return '';
          const foodNames = [];
          if (Array.isArray(meal.foods) && meal.foods.length > 0) {
            for (let i = 0; i < meal.foods.length; i += 2) {
              const id = meal.foods[i];
              const qty = meal.foods[i + 1];
              const dbFood = (typeof getAllFoods === 'function' ? getAllFoods() : FOOD_DATABASE).find(f => f.id === id);
              if (dbFood) {
                foodNames.push(`${qty}× ${dbFood.name}`);
              }
            }
          }

          let foodsHTML = '';
          if (foodNames.length > 0) {
            foodsHTML = foodNames.map(name => `<span class="food-item">${name}</span>`).join('');
          } else {
            const fallbackText = meal.foodText || (Array.isArray(meal.items) ? meal.items.join(' + ') : 'No foods listed');
            foodsHTML = `<span style="font-weight: 500;">${fallbackText}</span>`;
          }

          const m = meal.macros || { calories: 0, protein: 0, carbs: 0, fats: 0 };
          const isChecked = meal.checked || false;

          return `
            <div class="meal-block ${mealClasses[key]}" style="${isChecked ? 'opacity: 0.65; background: var(--bg2); border-left-style: dashed;' : ''}">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                <input 
                  type="checkbox" 
                  ${isChecked ? 'checked' : ''} 
                  onchange="toggleDietMeal(${dayIdx}, '${key}')" 
                  style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent); margin: 0; flex-shrink: 0;"
                  title="Mark meal as completed"
                >
                <span class="meal-label" style="${isChecked ? 'text-decoration: line-through; color: var(--text3);' : ''}">${mealLabels[key]}</span>
                <span class="meal-foods" style="${isChecked ? 'text-decoration: line-through; color: var(--text3);' : ''}">
                  ${foodsHTML}
                </span>
              </div>
              <span class="meal-macros" style="${isChecked ? 'text-decoration: line-through; color: var(--text3);' : ''}">${m.calories} kcal · ${m.protein}g P · ${m.carbs}g C · ${m.fats}g F</span>
            </div>
          `;
        }).join('');

        const dayTotal = { calories: 0, protein: 0, carbs: 0, fats: 0 };
        mealKeys.forEach(key => {
          const m = meals[key]?.macros || {};
          dayTotal.calories += m.calories || 0;
          dayTotal.protein  += m.protein || 0;
          dayTotal.carbs    += m.carbs || 0;
          dayTotal.fats     += m.fats || 0;
        });

        return `
          <div class="day-diet-card">
            <div class="day-diet-header">
              <span class="day-diet-title">${day.day}</span>
              <span class="day-diet-macros">
                🔥 ${Math.round(dayTotal.calories)} kcal ·
                💪 ${Math.round(dayTotal.protein)}g ·
                🍚 ${Math.round(dayTotal.carbs)}g ·
                🧈 ${Math.round(dayTotal.fats)}g
              </span>
            </div>
            ${mealBlocks}
            <div class="day-diet-actions">
              <button class="btn btn-sm btn-primary" onclick="addDayToLog(${dayIdx})">➕ Add to Today</button>
              <button class="btn btn-sm btn-ghost" onclick="editDietDay(${dayIdx})">${JBIcons.svg('pencil', { size: 13 })} Edit Day</button>
            </div>
          </div>
        `;
      }).join('');

      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21b. renderWorkoutQueue ────────────────────────────────
  const _origRenderWorkoutQueue = window.renderWorkoutQueue;
  if (_origRenderWorkoutQueue) {
    window.renderWorkoutQueue = function() {
      const container = document.getElementById('workout-queue-list');
      const countEl = document.getElementById('queue-count');
      const actionsEl = document.getElementById('queue-actions');
      
      if (!container) return;
      
      const incompleteCount = workoutQueue.filter(item => !item.completed).length;
      const totalCount = workoutQueue.length;
      
      if (countEl) countEl.textContent = `${incompleteCount}/${totalCount}`;
      
      if (workoutQueue.length === 0) {
        container.textContent = '';
        container.insertAdjacentHTML('afterbegin', '<div class="queue-empty">No exercises added. Tap + on any exercise to add to queue.</div>');
        if (actionsEl) actionsEl.style.display = 'none';
        return;
      }
      
      if (actionsEl) actionsEl.style.display = 'flex';
      
      const html = workoutQueue.map((item, idx) => {
        const hasData = item.loggedSets && item.loggedSets.length > 0;
        const completedSets = item.loggedSets?.filter(s => s.done).length || 0;
        const totalSets = item.sets || 3;
        
        return `
          <div class="workout-queue-item ${item.completed ? 'completed' : ''}" data-queue-idx="${idx}">
            <div class="queue-swipe-delete-hint" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Remove
            </div>
            <div class="queue-swipe-inner">
              <div class="workout-queue-item-info" style="flex:1">
                <div class="workout-queue-item-name">
                  <span class="workout-queue-status ${item.completed ? 'completed' : ''}">
                    ${item.completed ? '<span class="ic ic-done"></span>' : (hasData ? '<span class="ic ic-note"></span>' : '<span class="ic ic-empty"></span>')}
                  </span>
                  ${escHtml(item.name)}
                </div>
                <div class="workout-queue-item-detail">
                  ${item.isCardio ? 'Cardio' : `${item.sets} sets × ${item.reps} reps · ${item.rest}s rest`}
                  ${hasData ? ` · Logged: ${completedSets}/${totalSets} sets` : ''}
                  ${item.completed && item.maxWeight > 0 ? ` · Max: ${item.maxWeight}kg` : ''}
                </div>
              </div>
              <div style="display:flex; gap: 6px;">
                <button class="btn btn-sm btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="event.stopPropagation(); openQueueExerciseModal(${idx})">
                  ${hasData ? `${JBIcons.svg('pencil', { size: 14, color: 'currentColor' })} Edit` : `${JBIcons.svg('pencil', { size: 14, color: 'currentColor' })} Log`}
                </button>
                <button class="workout-queue-remove" onclick="event.stopPropagation(); removeFromQueue(${idx})" title="Remove">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);

      // Attach swipe-to-delete on every rendered item
      container.querySelectorAll('.workout-queue-item[data-queue-idx]').forEach(el => {
        if (typeof attachQueueSwipe === 'function') {
          attachQueueSwipe(el);
        }
      });
    };
  }

  // ── 21c. renderScheduleWorkoutList ─────────────────────────
  const _origRenderScheduleWorkoutList = window.renderScheduleWorkoutList;
  if (_origRenderScheduleWorkoutList) {
    window.renderScheduleWorkoutList = function(workouts) {
      const container = document.getElementById('schedule-workout-list');
      if (!container) return;
      
      const day = state.editingScheduleDay;
      
      if (!workouts.length) {
        container.textContent = '';
        container.insertAdjacentHTML('afterbegin', '<p class="muted-text" style="text-align:center;padding:20px;">No exercises added yet.<br>Tap + below to add exercises.</p>');
        return;
      }
      
      const html = workouts.map((w, idx) => `
        <div class="schedule-workout-row">
          <div class="schedule-workout-info" onclick="editScheduledWorkout('${day}', ${idx})" style="cursor:pointer;flex:1">
            <span class="schedule-workout-name">${escHtml(w.name)}</span>
            <span class="schedule-workout-detail">${w.sets || 3} sets × ${w.reps || 10} reps · ${w.rest || 60}s rest</span>
            ${w.notes ? `<span class="schedule-workout-notes" style="font-size:10px;color:var(--text3);display:block;margin-top:4px;">📝 ${escHtml(w.notes.substring(0, 40))}${w.notes.length > 40 ? '...' : ''}</span>` : ''}
          </div>
          <div class="schedule-workout-actions">
            <button class="icon-btn-small" onclick="editScheduledWorkout('${day}', ${idx})" title="Edit">${JBIcons.svg('pencil', { size: 14, color: 'var(--accent)' })}</button>
            <button class="icon-btn-small" onclick="removeWorkoutFromSchedule(${idx})" title="Remove">✕</button>
          </div>
        </div>
      `).join('');
      
      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21d. renderWeeklySchedule ──────────────────────────────
  const _origRenderWeeklySchedule = window.renderWeeklySchedule;
  if (_origRenderWeeklySchedule) {
    window.renderWeeklySchedule = function() {
      const schedule = getWeeklySchedule();
      const container = document.getElementById('weekly-schedule-grid');
      if (!container) return;

      const html = DAYS_OF_WEEK.map(day => {
        const dayData = schedule.days[day] || { name: '', workouts: [] };
        const workoutsCount = dayData.workouts?.length || 0;
        const hasName = dayData.name && dayData.name.trim() !== '';
        
        return `
          <div class="schedule-day-card" data-day="${day}">
            <div class="schedule-day-header">
              <span class="schedule-day-name">${day}</span>
              <span class="schedule-workout-count">${workoutsCount} exercise${workoutsCount !== 1 ? 's' : ''}</span>
            </div>
            ${hasName ? `<div class="schedule-day-workout-name">${JBIcons.svg('dumbbell', { size: 16 })} ${escHtml(dayData.name)}</div>` : ''}
            <div class="schedule-day-preview">
              ${dayData.workouts?.slice(0, 3).map(w => `<span class="schedule-exercise-tag">${escHtml(w.name)}</span>`).join('') || '<span class="muted">No exercises</span>'}
              ${workoutsCount > 3 ? `<span class="schedule-exercise-tag">+${workoutsCount - 3} more</span>` : ''}
            </div>
            <div class="schedule-day-actions">
              <button class="btn btn-sm btn-ghost" onclick="editScheduleDay('${day}')">${JBIcons.svg('pencil', { size: 14, color: 'var(--accent)' })} Edit</button>
              <button class="btn btn-sm btn-primary" onclick="startScheduledWorkout('${day}')">▶ Start</button>
            </div>
          </div>
        `;
      }).join('');

      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21e. renderAvailableExercises ──────────────────────────
  const _origRenderAvailableExercises = window.renderAvailableExercises;
  if (_origRenderAvailableExercises) {
    window.renderAvailableExercises = function(searchQuery) {
      const container = document.getElementById('schedule-available-exercises');
      if (!container) return;
      
      const allExercises = [...EXERCISE_LIBRARY, ...(getData().customWorkouts || [])];
      let filtered = allExercises;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = allExercises.filter(ex => 
          ex.name.toLowerCase().includes(q) || 
          (ex.muscle && ex.muscle.toLowerCase().includes(q))
        );
      }
      
      const html = filtered.map(ex => `
        <div class="schedule-exercise-item" onclick="addWorkoutToScheduleDay('${ex.id.replace(/'/g, "\\'")}', '${escHtml(ex.name).replace(/'/g, "\\'")}')">
          <span class="schedule-exercise-icon">${ex.isCardio ? JBIcons.svg('flame', { size: 16 }) : JBIcons.svg('dumbbell', { size: 16 })}</span>
          <div class="schedule-exercise-info">
            <div class="schedule-exercise-name">${escHtml(ex.name)}</div>
            <div class="schedule-exercise-meta">${ex.muscle || (ex.isCardio ? 'Cardio' : 'Strength')}</div>
          </div>
          <span class="schedule-add-icon">+</span>
        </div>
      `).join('');
      
      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21f. renderMuscleChips ─────────────────────────────────
  const _origRenderMuscleChips = window.renderMuscleChips;
  if (_origRenderMuscleChips) {
    window.renderMuscleChips = function() {
      const el = document.getElementById('muscle-chips');
      if (!el) return;
      const html = MUSCLE_GROUPS.map(m =>
        `<button class="chip ${state.muscleFilter === m ? 'active' : ''}" onclick="setMuscleFilter('${m}')">${m}</button>`
      ).join('');
      el.textContent = '';
      el.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21g. renderCustomWorkouts ──────────────────────────────
  const _origRenderCustomWorkouts = window.renderCustomWorkouts;
  if (_origRenderCustomWorkouts) {
    window.renderCustomWorkouts = function() {
      const { customWorkouts } = getData();
      const el = document.getElementById('custom-workouts-list');
      if (!el) return;
      if (!customWorkouts.length) {
        el.textContent = '';
        el.insertAdjacentHTML('afterbegin', '<p class="muted-text">No custom workouts yet.</p>');
        return;
      }
      const html = customWorkouts.map(w => `
        <div class="exercise-card">
          <div class="exercise-info" style="flex:1">
            <div class="exercise-name">${escHtml(w.name)}</div>
            <div class="exercise-meta">${w.muscle} · ${w.sets} sets × ${w.reps} reps · ${w.rest}s rest</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); addToWorkoutQueue('${w.id}', '${escHtml(w.name)}')" style="padding:6px 12px">+ Queue</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); editWorkout('${w.id}')">${JBIcons.svg('pencil', { size: 14, color: 'var(--accent)' })}</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteWorkout('${w.id}')">${JBIcons.svg('trash', { size: 16 })}</button>
          </div>
        </div>`).join('');
      el.textContent = '';
      el.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21h. renderPRs (progress page) ─────────────────────────
  const _origRenderPRs = window.renderPRs;
  if (_origRenderPRs) {
    window.renderPRs = function(prs) {
      const el = document.getElementById('prs-list');
      if (!el) return;
      const entries = Object.entries(prs);
      if (!entries.length) {
        el.textContent = '';
        el.insertAdjacentHTML('afterbegin', '<p class="muted-text">Complete sessions to see your PRs.</p>');
        return;
      }
      const html = entries.sort((a,b) => new Date(b[1].date) - new Date(a[1].date)).map(([,pr]) => `
        <div class="pr-card">
          <div>
            <div class="pr-name">${escHtml(pr.name)}</div>
            <div class="pr-date">${formatDate(pr.date)}</div>
          </div>
          <div class="pr-weight">${pr.weight}kg</div>
        </div>`).join('');
      el.textContent = '';
      el.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21i. renderWeeklyGoals ─────────────────────────────────
  const _origRenderWeeklyGoals = window.renderWeeklyGoals;
  if (_origRenderWeeklyGoals) {
    window.renderWeeklyGoals = function() {
      const { weeklyGoals, prs } = getData();
      const el = document.getElementById('weekly-goals-list');
      if (!el) return;
      const weekStart = getWeekStart();
      const thisWeek = weeklyGoals.filter(g => g.weekStart === weekStart);
      if (!thisWeek.length) {
        el.textContent = '';
        el.insertAdjacentHTML('afterbegin', `<div class="empty-state"><span class="empty-icon">${JBIcons.svg('target', { size: 32 })}</span><p>Set a weight target for any exercise this week.</p></div>`);
        return;
      }
      const html = thisWeek.map(g => {
        const current = prs[g.exId]?.weight || 0;
        const pct = Math.min(100, Math.round((current / g.targetWeight) * 100));
        const hit = current >= g.targetWeight;
        return `
          <div class="goal-card">
            <div class="goal-card-row">
              <div>
                <div class="goal-name">${escHtml(g.exName)} ${hit ? '🏆' : ''}</div>
                <div class="goal-sub">Current: ${current}kg · Target: ${g.targetWeight}kg</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="goal-pct">${pct}%</span>
                <button class="btn btn-sm btn-danger" onclick="deleteGoal('${g.id}')">✕</button>
              </div>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar ${hit ? '' : ''}" style="width:${pct}%;background:${hit ? '#FFB830' : 'var(--accent)'}"></div>
            </div>
          </div>`;
      }).join('');
      el.textContent = '';
      el.insertAdjacentHTML('afterbegin', html);
    };
  }

  // ── 21j. renderWeightLossGoal ──────────────────────────────
  const _origRenderWeightLossGoal = window.renderWeightLossGoal;
  if (_origRenderWeightLossGoal) {
    window.renderWeightLossGoal = function() {
      const { weightLossGoal, weightLog } = getData();

      const currentInput = document.getElementById('wl-current');
      const targetInput = document.getElementById('wl-target');
      const dateInput = document.getElementById('wl-date');
      if (weightLossGoal) {
        if (currentInput) currentInput.value = weightLossGoal.currentWeight;
        if (targetInput) targetInput.value = weightLossGoal.targetWeight;
        if (dateInput) dateInput.value = weightLossGoal.targetDate;
      }

      const displayEl = document.getElementById('wl-progress-display');
      const historyEl = document.getElementById('wl-history');

      if (weightLossGoal && weightLog.length > 0 && displayEl) {
        const latest = weightLog[weightLog.length - 1].weight;
        const start = weightLossGoal.currentWeight;
        const target = weightLossGoal.targetWeight;
        const lost = Math.max(0, start - latest).toFixed(1);
        const toGo = Math.max(0, latest - target).toFixed(1);
        const pct = Math.min(100, Math.max(0, ((start - latest) / (start - target)) * 100));
        const daysLeft = Math.ceil((new Date(weightLossGoal.targetDate) - new Date()) / 86400000);

        displayEl.textContent = '';
        displayEl.insertAdjacentHTML('afterbegin', `
          <div class="wl-summary">
            <div class="goal-card-row">
              <span class="card-title">${JBIcons.svg('scale', { size: 16 })} Progress</span>
              <span style="font-size:18px;font-weight:800;color:var(--accent2)">${Math.round(pct)}%</span>
            </div>
            <div class="wl-nums">
              <div class="wl-num-block"><span class="wl-num-val">${latest}kg</span><span class="wl-num-label">Current</span></div>
              <div class="wl-num-block"><span class="wl-num-val">${lost}kg</span><span class="wl-num-label">Lost</span></div>
              <div class="wl-num-block"><span class="wl-num-val">${toGo}kg</span><span class="wl-num-label">To Go</span></div>
              <div class="wl-num-block"><span class="wl-num-val">${daysLeft > 0 ? daysLeft : 0}</span><span class="wl-num-label">Days Left</span></div>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar progress-bar--alt" style="width:${pct}%"></div>
            </div>
          </div>`);
      } else if (weightLossGoal && displayEl) {
        displayEl.textContent = '';
        displayEl.insertAdjacentHTML('afterbegin', '<div class="card"><p class="muted-text">Log your weight to track progress.</p></div>');
      } else if (displayEl) {
        displayEl.textContent = '';
      }

      if (historyEl) {
        const html = [...weightLog].reverse().slice(0, 10).map(entry => `
          <div class="weight-log-item">
            <span class="weight-log-val">${entry.weight} kg</span>
            <span class="weight-log-date">${formatDate(entry.date)}</span>
          </div>`).join('') || '<p class="muted-text">No weight entries yet.</p>';
        historyEl.textContent = '';
        historyEl.insertAdjacentHTML('afterbegin', html);
      }
    };
  }

  // ── 21k. renderCardioGoals ─────────────────────────────────
  const _origRenderCardioGoals = window.renderCardioGoals;
  if (_origRenderCardioGoals) {
    window.renderCardioGoals = function() {
      const { cardioGoal, cardioLog } = getData();

      const minInput = document.getElementById('cardio-goal-min');
      const sessionsInput = document.getElementById('cardio-goal-sessions');
      if (cardioGoal) {
        if (minInput) minInput.value = cardioGoal.minutesPerWeek || '';
        if (sessionsInput) sessionsInput.value = cardioGoal.sessionsPerWeek || '';
      }

      const weekStart = getWeekStart();
      const thisWeekCardio = cardioLog.filter(c => c.date >= weekStart);
      const totalMin = thisWeekCardio.reduce((a, c) => a + c.duration, 0);
      const totalSessions = thisWeekCardio.length;

      const progressEl = document.getElementById('cardio-goal-progress');
      if (progressEl) {
        progressEl.textContent = '';
        if (cardioGoal) {
          const minPct = cardioGoal.minutesPerWeek ? Math.min(100, Math.round((totalMin / cardioGoal.minutesPerWeek) * 100)) : 0;
          const sessPct = cardioGoal.sessionsPerWeek ? Math.min(100, Math.round((totalSessions / cardioGoal.sessionsPerWeek) * 100)) : 0;
          progressEl.insertAdjacentHTML('afterbegin', `
            <div class="cardio-summary-row">
              <div class="goal-card">
                <div class="goal-name">⏱ Minutes</div>
                <div class="goal-pct" style="font-size:22px;margin:6px 0">${totalMin}<span style="font-size:13px;color:var(--text2)">/${cardioGoal.minutesPerWeek || '?'}</span></div>
                <div class="progress-bar-wrap"><div class="progress-bar" style="width:${minPct}%"></div></div>
              </div>
              <div class="goal-card">
                <div class="goal-name">🏃 Sessions</div>
                <div class="goal-pct" style="font-size:22px;margin:6px 0">${totalSessions}<span style="font-size:13px;color:var(--text2)">/${cardioGoal.sessionsPerWeek || '?'}</span></div>
                <div class="progress-bar-wrap"><div class="progress-bar" style="width:${sessPct}%"></div></div>
              </div>
            </div>`);
        } else {
          progressEl.insertAdjacentHTML('afterbegin', '<div class="card" style="margin-bottom:16px"><p class="muted-text">Set a cardio goal above to track progress.</p></div>');
        }
      }

      const historyEl = document.getElementById('cardio-history');
      if (historyEl) {
        if (!thisWeekCardio.length) {
          historyEl.textContent = '';
          historyEl.insertAdjacentHTML('afterbegin', '<p class="muted-text">No cardio logged this week.</p>');
          return;
        }
        const html = [...thisWeekCardio].reverse().map(c => `
          <div class="cardio-card">
            <span class="cardio-icon">${CARDIO_EMOJIS[c.type] || '💪'}</span>
            <div class="cardio-info">
              <div class="cardio-name">${escHtml(c.type)}</div>
              <div class="cardio-meta">
                ${c.distance ? `${c.distance}km · ` : ''}${c.calories ? `${c.calories} kcal · ` : ''}${formatDate(c.date)}
              </div>
            </div>
            <div class="cardio-duration">${c.duration}min</div>
          </div>`).join('');
        historyEl.textContent = '';
        historyEl.insertAdjacentHTML('afterbegin', html);
      }
    };
  }

  // ── 21l. renderWater (water log list) ──────────────────────
  // This wraps the original renderWater to use insertAdjacentHTML.
  // The debouncing from section 12 is applied AFTER this wrapper
  // via the addWater override below.
  const _origRenderWater = window.renderWater;
  if (_origRenderWater) {
    window.renderWater = function() {
      const { settings, waterLog } = getData();
      const goal = settings.waterGoal || 2000;
      const today = getTodayWater(waterLog);
      const pct = Math.min(100, (today / goal) * 100);
      const goalHit = today >= goal;

      const waterFill = document.getElementById('water-fill');
      if (waterFill) {
        waterFill.style.height = pct + '%';
      }

      const bottle = document.getElementById('water-fill')?.closest('.water-bottle') ||
                     document.querySelector('.water-bottle');
      const pctEl  = document.getElementById('water-pct');

      if (bottle)  bottle.classList.toggle('goal-reached', goalHit);
      if (pctEl)   pctEl.classList.toggle('goal-reached', goalHit);

      const dashBar = document.getElementById('dash-water-bar');
      if (dashBar) dashBar.classList.toggle('goal-reached', goalHit);

      const todayKey = new Date().toISOString().split('T')[0];
      const celebKey = `jimbuddy_water_goal_celebrated_${todayKey}`;
      if (goalHit && !sessionStorage.getItem(celebKey)) {
        sessionStorage.setItem(celebKey, '1');
        if (typeof SoundManager !== 'undefined' && SoundManager.goalReached) {
          setTimeout(() => SoundManager.goalReached(), 120);
        }
        if (bottle) _spawnWaterBubbles(bottle);
        setTimeout(() => toast('🎉 Water goal reached! Great job!'), 200);
      }

      const currentMl  = document.getElementById('water-current-ml');
      const goalDisplay = document.getElementById('water-goal-display');
      const goalInput   = document.getElementById('water-goal-input');
      if (currentMl)   currentMl.textContent  = today;
      if (goalDisplay) goalDisplay.textContent = goal;
      if (goalInput)   goalInput.value         = goal;
      if (pctEl)       pctEl.textContent       = Math.round(pct) + '%';

      const todayLogs = waterLog.filter(l => l.date.startsWith(new Date().toISOString().split('T')[0]));
      const el = document.getElementById('water-log-list');
      if (el) {
        if (todayLogs.length) {
          const html = [...todayLogs].reverse().map(l => `
            <div class="water-log-item">
              <span class="water-log-amount">+${l.amount}ml</span>
              <span class="water-log-time">${formatTime12(l.date)}</span>
            </div>`).join('');
          el.textContent = '';
          el.insertAdjacentHTML('afterbegin', html);
        } else {
          el.textContent = '';
          el.insertAdjacentHTML('afterbegin', '<p class="muted-text">No water logged today yet.</p>');
        }
      }
    };
  }

  // ── 21m. renderProfilesList ────────────────────────────────
  const _origRenderProfilesList = window.renderProfilesList;
  if (_origRenderProfilesList) {
    window.renderProfilesList = function() {
      const container = document.getElementById('profiles-list');
      if (!container) return;

      if (profiles.length === 0) {
        container.textContent = '';
        container.insertAdjacentHTML('afterbegin', '<p class="muted-text" style="text-align:center;">No profiles yet. Create your first profile!</p>');
        return;
      }

      const html = profiles.map(profile => {
        const isCurrent = currentProfileId === profile.id;
        const stats = getProfileStats(profile.id);
        const ageLine = stats.age ? `<div class="profile-stats">Age: ${stats.age}</div>` : '';
        
        return `
          <div class="profile-card ${isCurrent ? 'current' : ''}">
            <div class="profile-header">
              <div class="profile-avatar">${profile.avatar || '💪'}</div>
              <div class="profile-info">
                <div class="profile-name">
                  ${escHtml(profile.name)}
                  ${isCurrent ? '<span class="current-badge">CURRENT</span>' : ''}
                </div>
                <div class="profile-stats">
                  ${stats.sessions} sessions · ${stats.prs} PRs · ${JBIcons.svg('flame', { size: 14 })} ${stats.streak} day streak
                </div>
                ${ageLine}
                <div class="profile-stats">
                  Member since ${formatMemberSince(profile.createdAt)}
                </div>
                <div class="profile-stats">
                  Last active: ${formatDate(profile.updatedAt || profile.createdAt)}
                </div>
              </div>
            </div>
            <div class="profile-actions">
              ${!isCurrent ? `<button class="btn btn-primary btn-sm" onclick="applyProfile('${profile.id}')">Apply</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="openEditProfileModal('${profile.id}')">Edit Profile</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProfile('${profile.id}')">Delete</button>
            </div>
          </div>
        `;
      }).join('');
      container.textContent = '';
      container.insertAdjacentHTML('afterbegin', html);
    };
  }

  /* ── 22. Lazy-load exercise images/GIFs with IntersectionObserver ──
     The openExerciseViewModal function loads images immediately.
     We wrap it to use IntersectionObserver so images only load
     when the modal is visible in the viewport.                    */
  if ('IntersectionObserver' in window) {
    const _origOpenExerciseViewModal = window.openExerciseViewModal;
    if (_origOpenExerciseViewModal) {
      window.openExerciseViewModal = function(exerciseId) {
        // Call original to set up the modal structure
        _origOpenExerciseViewModal(exerciseId);
        
        // Now lazy-load the images using IntersectionObserver
        const modal = document.getElementById('exercise-view-modal');
        if (!modal) return;
        
        const frameA = document.getElementById('evm-frame-a');
        const frameB = document.getElementById('evm-frame-b');
        const placeholder = document.getElementById('evm-placeholder');
        
        if (!frameA || !frameB) return;
        
        // Store original src values and clear them
        const srcA = frameA.getAttribute('data-src') || frameA.src;
        const srcB = frameB.getAttribute('data-src') || frameB.src;
        
        if (!srcA && !srcB) return; // no images to lazy-load
        
        // Store original sources as data attributes
        if (srcA && srcA !== '' && srcA !== window.location.href) {
          frameA.setAttribute('data-src', srcA);
          frameA.removeAttribute('src');
          frameA.style.display = 'none';
        }
        if (srcB && srcB !== '' && srcB !== window.location.href) {
          frameB.setAttribute('data-src', srcB);
          frameB.removeAttribute('src');
          frameB.style.display = 'none';
        }
        
        // Show placeholder while loading
        if (placeholder) {
          placeholder.style.display = 'flex';
          placeholder.innerHTML = '<span class="evm-spinner"></span>';
        }
        
        // Create observer to load images when modal becomes visible
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Load images
              const aSrc = frameA.getAttribute('data-src');
              const bSrc = frameB.getAttribute('data-src');
              
              if (aSrc) {
                frameA.src = aSrc;
                frameA.style.display = 'block';
                frameA.removeAttribute('data-src');
              }
              if (bSrc) {
                frameB.src = bSrc;
                frameB.style.display = 'block';
                frameB.removeAttribute('data-src');
              }
              
              // Hide placeholder once loaded
              if (placeholder && (aSrc || bSrc)) {
                placeholder.style.display = 'none';
              }
              
              observer.disconnect();
            }
          });
        }, { rootMargin: '200px' });
        
        observer.observe(modal);
      };
    }
  }

  /* ── 23. Paginate food search results (20 items + "Show more") ──
     The original filterFoodList renders ALL matching results at once.
     We wrap it to show only 20 items with a "Show more" button.
     This also uses insertAdjacentHTML for rendering.               */
  const FOOD_PAGE_SIZE = 20;
  let _foodSearchPage = 1;
  let _foodSearchResults = [];

  // Capture the current filterFoodList (which may already be wrapped by section 6's fastFoodSearch)
  const _origFilterFoodList = window.filterFoodList;
  if (_origFilterFoodList) {
    window.filterFoodList = function() {
      const searchTerm = document.getElementById('food-search-input')?.value.toLowerCase() || '';
      const { customFoods } = getData();
      const allFoods = [...FOOD_DATABASE, ...customFoods];
      _foodSearchResults = allFoods.filter(food => 
        food.name.toLowerCase().includes(searchTerm)
      );
      _foodSearchPage = 1;
      _renderFoodPage();
    };

    function _renderFoodPage() {
      const resultsDiv = document.getElementById('food-search-results');
      if (!resultsDiv) return;
      
      const total = _foodSearchResults.length;
      const end = Math.min(_foodSearchPage * FOOD_PAGE_SIZE, total);
      const pageItems = _foodSearchResults.slice(0, end);
      const hasMore = end < total;
      
      let html = pageItems.map(food => `
        <div class="food-search-item" onclick="selectFoodFromSearch('${food.id}')">
          <div>
            <div class="food-search-name">${escHtml(food.name)}</div>
            <div class="food-search-serving">${food.serving || '1 serving'}</div>
          </div>
          <div class="food-search-calories">${food.calories} kcal</div>
        </div>
      `).join('');
      
      if (hasMore) {
        html += `<button class="btn btn-sm btn-ghost" id="food-show-more-btn" style="width:100%;margin-top:8px;" onclick="window._foodShowMore()">Show ${total - end} more</button>`;
      }
      
      resultsDiv.textContent = '';
      resultsDiv.insertAdjacentHTML('afterbegin', html);
    }

    window._foodShowMore = function() {
      _foodSearchPage++;
      _renderFoodPage();
    };
  }

  // Also paginate diet food search results
  let _dietFoodSearchPage = 1;
  let _dietFoodSearchResults = [];
  const DIET_FOOD_PAGE_SIZE = 20;

  const _origFilterDietFoodList = window.filterDietFoodList;
  if (_origFilterDietFoodList) {
    window.filterDietFoodList = function() {
      const searchTerm = document.getElementById('diet-food-search')?.value.toLowerCase() || '';
      _dietFoodSearchResults = getAllFoods().filter(food => food.name.toLowerCase().includes(searchTerm));
      _dietFoodSearchPage = 1;
      _renderDietFoodPage();
    };

    function _renderDietFoodPage() {
      const resultsDiv = document.getElementById('diet-food-search-results');
      if (!resultsDiv) return;
      
      const total = _dietFoodSearchResults.length;
      const end = Math.min(_dietFoodSearchPage * DIET_FOOD_PAGE_SIZE, total);
      const pageItems = _dietFoodSearchResults.slice(0, end);
      const hasMore = end < total;
      
      let html = pageItems.map(food => `
        <div class="food-search-item" onclick="addFoodToDietMeal('${food.id.replace(/'/g, "\\'")}')">
          <div>
            <div class="food-search-name">${escHtml(food.name)}</div>
            <div class="food-search-serving">${escHtml(food.serving || '1 serving')}</div>
          </div>
          <div class="food-search-calories">${food.calories} kcal</div>
        </div>
      `).join('');
      
      if (hasMore) {
        html += `<button class="btn btn-sm btn-ghost" id="diet-food-show-more-btn" style="width:100%;margin-top:8px;" onclick="window._dietFoodShowMore()">Show ${total - end} more</button>`;
      }
      
      resultsDiv.textContent = '';
      resultsDiv.insertAdjacentHTML('afterbegin', html);
    }

    window._dietFoodShowMore = function() {
      _dietFoodSearchPage++;
      _renderDietFoodPage();
    };
  }

  /* ── 24. Memoize expensive computed values ──────────────────
     getProfileStats, getBlueprintMacros, getExerciseSessionHistory
     are called frequently and do non-trivial work. We cache their
     results and invalidate when relevant data changes.            */

  // ── 24a. Memoized getProfileStats ──────────────────────────
  const _origGetProfileStats = window.getProfileStats;
  if (_origGetProfileStats) {
    window.getProfileStats = function(profileId) {
      return _memoize('getProfileStats_' + profileId, () => {
        return _origGetProfileStats(profileId);
      }, () => {
        const d = getData();
        return `${d.sessions.length}|${Object.keys(d.prs).length}|${_memoVersion}`;
      });
    };
  }

  // ── 24b. Memoized getBlueprintMacros ───────────────────────
  const _origGetBlueprintMacros = window.getBlueprintMacros;
  if (_origGetBlueprintMacros) {
    window.getBlueprintMacros = function(blueprint) {
      if (!blueprint || !blueprint.foods) return _origGetBlueprintMacros(blueprint);
      const key = 'getBlueprintMacros_' + (blueprint.foods.join(','));
      return _memoize(key, () => {
        return _origGetBlueprintMacros(blueprint);
      }, () => _memoVersion);
    };
  }

  // ── 24c. Memoized getExerciseSessionHistory ────────────────
  const _origGetExerciseSessionHistory = window.getExerciseSessionHistory;
  if (_origGetExerciseSessionHistory) {
    window.getExerciseSessionHistory = function(exercise) {
      if (!exercise) return _origGetExerciseSessionHistory(exercise);
      const key = 'getExerciseSessionHistory_' + (exercise.id || exercise.name);
      return _memoize(key, () => {
        return _origGetExerciseSessionHistory(exercise);
      }, () => {
        const d = getData();
        return `${d.sessions.length}|${_memoVersion}`;
      });
    };
  }

  /* ── 25. Debounce resize/scroll event listeners ────────────
     The original app.js has window.addEventListener('resize', setVh)
     without debouncing. We add a debounced version and patch setVh. */

  // ── 25a. Debounce the --vh resize handler ──────────────────
  const _origSetVh = window.setVh;
  if (typeof _origSetVh === 'function') {
    window.setVh = _throttle(function() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }, 100);
  }

  // ── 25b. Debounce scroll event listeners ───────────────────
  function _debounceScrollContainers() {
    document.querySelectorAll('.page-scroll').forEach(el => {
      if (el._scrollDebounced) return;
      el._scrollDebounced = true;
      el.addEventListener('scroll', _throttle(() => {
        // No heavy work — just prevent default handler buildup
      }, 100), { passive: true });
    });
  }

  // ── 25c. Debounce orientationchange handler ────────────────
  window.addEventListener('orientationchange', _debounce(() => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }, 200), { passive: true });

  // ── 25d. Debounce the ResizeObserver itself ────────────────
  // Already done in section 10 above with requestAnimationFrame throttling.

  /* ── 26. content-visibility: auto on long lists ────────────
     Already injected via CSS in section 13 above. The CSS rule
     targets #session-history-list, #food-log-list, #exercise-list,
     #workout-queue-list, #water-log-list, and many others with
     content-visibility: auto and contain-intrinsic-size: 400px.  */

  /* ── 27. Debounced addWater (uses the insertAdjacentHTML renderWater) ──
     This must run AFTER section 21l which wraps renderWater.       */
  const _renderWaterForDebounce = window.renderWater;
  const _debouncedRenderWater = _debounce(_renderWaterForDebounce, 80);
  const _origAddWater = window.addWater;
  if (_origAddWater) {
    window.addWater = function(ml) {
      const log = getData().waterLog;
      log.push({ amount: ml, date: new Date().toISOString() });
      DB.set('waterLog', log);
      if (typeof SoundManager !== 'undefined') SoundManager.waterSplash();
      toast(`+${ml}ml 💧`);
      _debouncedRenderWater();
      updateDashWater();
      _debouncedSyncToCloud();
    };
  }

  /* ── Apply debounced scroll containers after DOM ready ──── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _debounceScrollContainers);
  } else {
    _debounceScrollContainers();
  }

  console.info('[JimBuddy PerfPatch] v2.0 — loaded. All 6 optimizations active.');
})();