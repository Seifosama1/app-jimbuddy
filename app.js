// Sound effects (after DB constant)
// Sound Manager is loaded from sounds.js

/* ══════════════════════════════════════════
   JIM BUDDY — App Logic (Complete)
══════════════════════════════════════════ */

/* ══════════════════════════════════════════
   VIEWPORT HEIGHT FIX (Android WebView)
   Android has a known bug where 100dvh includes the on-screen navigation bar height,
   causing the bottom nav to be partially hidden. We calculate the real height using
   window.innerHeight and store it in the --vh CSS variable used by #app.
══════════════════════════════════════════ */
(function fixViewportHeight() {
  function setVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  setVh();
  window.addEventListener('resize', setVh);
  // Also update on orientation change (landscape/portrait toggle)
  window.addEventListener('orientationchange', () => setTimeout(setVh, 100));
})();



/* ══════════════════════════════════════════
   LOADING SCREEN
══════════════════════════════════════════ */

// Android WebView on some Samsung devices can miss the first GPU composite when
// backdrop-filter layers are active during launch.
(function markAndroidWebView() {
  const isAndroidWebView =
    /Android/i.test(navigator.userAgent) &&
    (window.Capacitor || /wv\)/i.test(navigator.userAgent));

  if (isAndroidWebView) {
    document.documentElement.classList.add('android-webview');

    // Override Android system font scaling — prevents user's font size
    // setting from enlarging the app UI in the WebView
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    try {
      // Force root font size to 16px regardless of system font scale
      document.documentElement.style.setProperty('font-size', '16px', 'important');

      // Re-apply on any resize (orientation change, etc.)
      window.addEventListener('resize', () => {
        document.documentElement.style.setProperty('font-size', '16px', 'important');
      }, { passive: true });
    } catch(e) {}
  }
})();

// Hide loading screen after page loads
function afterCommittedFrames(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function invalidateAndroidWebViewSurface() {
  const app = document.getElementById('app');
  const activePage = document.querySelector('.page.active');
  const target = activePage || app || document.body;
  if (!target) return;

  target.style.transform = 'translateZ(0)';
  target.getBoundingClientRect();

  requestAnimationFrame(() => {
    target.style.transform = '';
    document.documentElement.style.setProperty('--surface-flush-tick', String(Date.now()));
  });
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    // Add a slight delay to show the animation
    setTimeout(() => {
      loadingScreen.classList.add('hide');

      // Hide Capacitor native splash screen if running inside the Android wrapper
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
        afterCommittedFrames(() => {
          invalidateAndroidWebViewSurface();
          window.Capacitor.Plugins.SplashScreen.hide().catch(err => {
            console.warn('[Capacitor] Failed to hide splash screen:', err);
          });
        });
      }

      // Hide all inactive pages from the layout tree to prevent GPU memory leaks
      document.querySelectorAll('.page:not(.active)').forEach(p => {
        p.style.display = 'none';
      });

      // STAGE 3 — After loading screen fully fades (600ms), hard-reset the
      // active page with a display:none → display:block cycle.
      // This is functionally identical to what lock/unlock does at the OS level:
      // it forces the WebView to completely destroy and rebuild the element's
      // compositor layer, which flushes all pending tile uploads and produces
      // a 100% fresh, fully-rasterized paint.
      setTimeout(() => {
        if (loadingScreen && loadingScreen.parentNode) {
          loadingScreen.style.display = 'none';
        }

        const activePage = document.querySelector('.page.active');
        if (activePage) {
          // display:none removes the element from the render tree entirely —
          // the GPU compositor discards all its layers.
          activePage.style.display = 'none';
          // getBoundingClientRect() forces a synchronous reflow so the 'none'
          // state is committed before the next line runs.
          activePage.getBoundingClientRect();
          // display:block re-adds it — the compositor creates brand-new layers
          // and immediately rasterizes all visible tiles from scratch.
          activePage.style.display = 'block';
          invalidateAndroidWebViewSurface();
        }
      }, 600);
    }, 2000); // Show loading screen for 2 seconds
  }
}

// Ensure loading screen hides even if DOM loads super fast
window.addEventListener('load', hideLoadingScreen);

// Fallback: hide after 4 seconds max
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen && !loadingScreen.classList.contains('hide')) {
    hideLoadingScreen();
  }
}, 4000);

// ─── Data Layer ───────────────────────────────────────────
const DB = {
  get: (key, def = null) => {
    try { const v = localStorage.getItem('jimbuddy_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set: (key, val) => { try { localStorage.setItem('jimbuddy_' + key, JSON.stringify(val)); } catch {} },
};

// ─── Performance Optimizations ────────────────────────────

// Detect low‑end devices
const isLowEnd = () => {
  if ('deviceMemory' in navigator && navigator.deviceMemory < 4) return true;
  if ('hardwareConcurrency' in navigator && navigator.hardwareConcurrency < 4) return true;
  return false;
};

// Broader check: catches mid-range Android (Samsung A-series, Redmi, etc.)
// that report 4-6GB RAM but GPU can't sustain 20+ simultaneous backdrop-filter layers.
// backdrop-filter on every .card + 20 modal overlays = compositor layer explosion on Android.
// iOS and desktop handle this fine; Android does not.
const isNoBlur = () => {
  const ua = navigator.userAgent || '';
  if (!/android/i.test(ua)) return false; // iOS and desktop — keep blur
  const mem = navigator.deviceMemory;
  if (mem !== undefined && mem > 6) return false; // flagship Android (8GB+) — keep blur
  return true; // all other Android — strip blur
};

if (isLowEnd()) {
  document.body.classList.add('low-end');
  document.body.classList.add('performance-mode');
}
if (isNoBlur()) {
  document.body.classList.add('no-blur');
}

// Throttle wrapper – limits function calls to once per `delay` ms
function throttle(fn, delay = 300) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}


// Debounce wrapper – waits for idle before executing
function debounce(fn, delay = 250) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Performance: debounced wrappers ──────────────────────
// Coalesces all rapid syncUserDataToCloud calls (26 sites) into ONE
// network request after 1.5s of inactivity. Critical for mobile battery.
const _debouncedSyncToCloud = debounce(function _doSync() {
  // Call the real async function without awaiting — fire-and-forget
  syncUserDataToCloud();
}, 1500);

// Debounced search handlers – fire only after user pauses typing (200ms)
const _debouncedFilterFood     = debounce(function() { filterFoodList(); }, 200);
const _debouncedFilterDietFood = debounce(function() { filterDietFoodList(); }, 200);
const _debouncedFilterSchedule = debounce(function() { filterScheduleExercises(); }, 200);


const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Food Database ───────────────────────────────────────
const FOOD_DATABASE = [
  { id: 'apple', name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fats: 0.3, serving: '1 medium' },
  { id: 'banana', name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.4, serving: '1 medium' },
  { id: 'chicken-breast', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats: 3.6, serving: '100g' },
  { id: 'rice', name: '100gm White Rice', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, serving: '100g' },
  { id: 'egg', name: 'Egg', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, serving: '1 large' },
  { id: 'oatmeal', name: 'Oatmeal', calories: 158, protein: 5.5, carbs: 27, fats: 3.2, serving: '1 cup cooked' },
  { id: 'salmon', name: 'Salmon', calories: 208, protein: 22, carbs: 0, fats: 13, serving: '100g' },
  { id: 'broccoli', name: 'Broccoli', calories: 34, protein: 2.8, carbs: 7, fats: 0.4, serving: '100g' },
  { id: 'sweet-potato', name: 'Sweet Potato', calories: 90, protein: 2, carbs: 21, fats: 0.1, serving: '100g' },
  { id: 'greek-yogurt', name: 'Greek Yogurt', calories: 59, protein: 10, carbs: 3.6, fats: 0.4, serving: '100g' },
  { id: 'protein-shake', name: 'Whey Protein', calories: 120, protein: 24, carbs: 3, fats: 1.5, serving: '1 scoop' },
  { id: 'avocado', name: 'Avocado', calories: 160, protein: 2, carbs: 8.5, fats: 15, serving: '100g' },
  { id: 'bread', name: 'Whole Wheat Bread', calories: 79, protein: 4, carbs: 13, fats: 1, serving: '1 slice' },
  { id: 'pasta', name: '100gm Pasta', calories: 158, protein: 5.8, carbs: 31, fats: 1.1, serving: '100g' },
  { id: 'cheese', name: 'Cheddar Cheese', calories: 404, protein: 25, carbs: 1.3, fats: 33, serving: '100g' },
  { id: 'milk', name: 'cup of Milk', calories: 122, protein: 8, carbs: 12, fats: 5, serving: '1 cup' },
  { id: 'almonds', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fats: 49, serving: '100g' },
  { id: 'coffee', name: 'Black Coffee', calories: 2, protein: 0, carbs: 0, fats: 0, serving: '1 cup' },
  { id: 'pizza', name: 'Pizza Slice', calories: 285, protein: 12, carbs: 36, fats: 10, serving: '1 slice' },
  { id: 'burger', name: 'Hamburger', calories: 354, protein: 17, carbs: 29, fats: 19, serving: '1 burger' },
  { id: 'ful-mudammas', name: 'Ful Mudammas (Fava Beans)', calories: 110, protein: 7.5, carbs: 20, fats: 0.8, serving: '100g' },
    { id: 'koshary', name: 'Egyptian Koshary', calories: 350, protein: 11, carbs: 70, fats: 2.5, serving: '1 medium bowl' },
    { id: 'baladi-bread', name: 'Aish Baladi (Whole Wheat)', calories: 250, protein: 9, carbs: 53, fats: 1.2, serving: '1 loaf' },
    { id: 'taameya', name: 'Taameya (Egyptian Falafel)', calories: 333, protein: 13.2, carbs: 31.8, fats: 17.5, serving: '100g' },
{ id: 'hawawshi', name: 'Hawawshi', calories: 285, protein: 14.5, carbs: 24.2, fats: 14.8, serving: '100g' },
{ id: 'molokhia', name: 'Molokhia Soup (Plain)', calories: 48, protein: 3.1, carbs: 5.8, fats: 1.6, serving: '100g' },
{ id: 'mahshi-enab', name: 'Mahshi Wara Enab (Stuffed Grape Leaves)', calories: 142, protein: 3.4, carbs: 21.8, fats: 4.6, serving: '100g' },
{ id: 'mahshi-kromb', name: 'Mahshi Kromb (Stuffed Cabbage Leaves)', calories: 125, protein: 2.8, carbs: 19.5, fats: 3.9, serving: '100g' },
{ id: 'mesakaa', name: 'Egyptian Mesakaa (Eggplant)', calories: 134, protein: 2.1, carbs: 9.4, fats: 9.8, serving: '100g' },
{ id: 'baba-ganoush', name: 'Baba Ganoush', calories: 92, protein: 1.5, carbs: 6.2, fats: 7.1, serving: '100g' },
{ id: 'roz-bel-laban', name: 'Roz Bel Laban (Egyptian Rice Pudding)', calories: 122, protein: 3.5, carbs: 22.4, fats: 2.5, serving: '100g' },
{ id: 'steak', name: 'Beef Steak (Grilled)', calories: 250, protein: 26.1, carbs: 0, fats: 15.4, serving: '100g' },
{ id: 'macarona-bechamel', name: 'Macarona Bechamel', calories: 149, protein: 7, carbs: 20, fats: 3.7, serving: '100g' },
{ id: 'egyptian-fattah', name: 'Egyptian Fattah (with Meat)', calories: 208, protein: 8.6, carbs: 5, fats: 17.2, serving: '100g' },
{ id: 'shish-taouk', name: 'Shish Taouk (Grilled Chicken Skewers)', calories: 127, protein: 14, carbs: 2.2, fats: 7, serving: '100g' },
{ id: 'kofta', name: 'Egyptian Grilled Kofta', calories: 254, protein: 17.2, carbs: 1.5, fats: 20.1, serving: '100g' },
{ id: 'kebab', name: 'Grilled Lamb Kebab', calories: 223, protein: 21.5, carbs: 0, fats: 15.2, serving: '100g' },
{ id: 'roqaq', name: 'Egyptian Roqaq (with Minced Meat)', calories: 290, protein: 11, carbs: 28, fats: 14.5, serving: '100g' },
{ id: 'alexandrian-liver', name: 'Kebda Eskandarani (Alexandrian Liver)', calories: 165, protein: 20.3, carbs: 3.8, fats: 7.5, serving: '100g' },// --- Famous Global Restaurant Items ---
{ id: 'mcdonalds-big-mac', name: 'McDonald\'s Big Mac', calories: 580, protein: 25, carbs: 45, fats: 34, serving: '1 burger' },
{ id: 'burgerking-whopper', name: 'Burger King Whopper', calories: 670, protein: 31.5, carbs: 54, fats: 41, serving: '1 burger' },
{ id: 'kfc-zinger', name: 'KFC Zinger Burger', calories: 450, protein: 26.4, carbs: 43.8, fats: 18.8, serving: '1 burger' },
{ id: 'starbucks-croissant', name: 'Starbucks Butter Croissant', calories: 260, protein: 5, carbs: 28, fats: 15, serving: '1 piece' },
{ id: 'pizza-hut-pepperoni', name: 'Pizza Hut Pepperoni Slice (Pan)', calories: 280, protein: 11, carbs: 28, fats: 13, serving: '1 slice' },
{ id: 'sushi-salmon-roll', name: 'Japanese Salmon Avocado Roll', calories: 304, protein: 13, carbs: 42, fats: 8.5, serving: '8 pieces' },
{ id: 'taco-beef', name: 'Mexican Beef Taco (Hard Shell)', calories: 179, protein: 10, carbs: 14, fats: 10, serving: '1 taco' },
{ id: 'italian-pizza-margherita', name: 'Italian Pizza Margherita', calories: 234, protein: 10.3, carbs: 30.2, fats: 7.9, serving: '100g' },
{ id: 'chicken-shawarma-wrap', name: 'Middle Eastern Chicken Shawarma Wrap', calories: 430, protein: 28, carbs: 38, fats: 18, serving: '1 wrap' },
// --- Missing Everyday Staples & Proteins ---
{ id: 'tuna-canned', name: 'Canned Tuna (in Water)', calories: 116, protein: 26, carbs: 0, fats: 1, serving: '100g' },
{ id: 'turkey-breast', name: 'Turkey Breast (Deli Slices)', calories: 104, protein: 17, carbs: 1.1, fats: 2, serving: '100g' },
{ id: 'white-fish', name: 'Tilapia / White Fish (Grilled)', calories: 128, protein: 26, carbs: 0, fats: 2.7, serving: '100g' },
{ id: 'shrimp', name: 'Shrimp (Grilled or Boiled)', calories: 99, protein: 24, carbs: 0.2, fats: 0.3, serving: '100g' },
{ id: 'basmati-rice', name: '100gm Basmati Rice', calories: 121, protein: 3.5, carbs: 26, fats: 0.4, serving: '100g' },

// --- More Global & Local Restaurant Icons ---
{ id: 'mcdonalds-nuggets', name: 'McDonald\'s Chicken McNuggets', calories: 420, protein: 24, carbs: 25, fats: 25, serving: '9 pieces' },
{ id: 'dominos-margherita', name: 'Domino\'s Classic Margherita Pizza', calories: 205, protein: 8.5, carbs: 24, fats: 7.9, serving: '1 slice (Medium)' },
{ id: 'cinnabon-classic', name: 'Cinnabon Classic Roll', calories: 880, protein: 13, carbs: 127, fats: 37, serving: '1 roll' },
{ id: 'buffaloburger-oldschool', name: 'Buffalo Burger Old School (150g)', calories: 510, protein: 34, carbs: 41, fats: 22, serving: '1 burger' },
{ id: 'kfc-twister', name: 'KFC Twister Wrap', calories: 480, protein: 21, carbs: 42, fats: 24, serving: '1 wrap' },// --- Missing Local Egyptian Favorites & Fast Food ---
{ id: 'bazooka-sniper', name: 'Bazooka Sniper Sandwich', calories: 840, protein: 36, carbs: 64, fats: 48, serving: '1 sandwich' },
{ id: 'prego-grilled-chicken', name: 'Prego Grilled Chicken Breast Meal', calories: 410, protein: 44, carbs: 12, fats: 19, serving: '1 meal' },
{ id: 'gad-rezo', name: 'Gad Rizo Rice with Chicken', calories: 450, protein: 18, carbs: 68, fats: 11, serving: '1 bowl' },
{ id: 'el-tahrir-koshary-mega', name: 'Koshary El Tahrir (Mega Box)', calories: 710, protein: 22, carbs: 142, fats: 5, serving: '1 box' },
{ id: 'feteer-meshaltet', name: 'Feteer Meshaltet (Plain)', calories: 415, protein: 6.5, carbs: 49, fats: 21.5, serving: '100g' },

// --- Healthy Proteins, Grains & Snacks ---
{ id: 'cottage-cheese', name: 'Cottage Cheese / Jebna Quraish', calories: 98, protein: 11, carbs: 3.4, fats: 4.3, serving: '100g' },
{ id: 'brown-rice', name: '100gm Brown Rice ', calories: 112, protein: 2.6, carbs: 23.5, fats: 0.9, serving: '100g' },
{ id: 'peanut-butter', name: 'Peanut Butter (Natural)', calories: 588, protein: 25, carbs: 20, fats: 50, serving: '100g' },
{ id: 'boiled-potato', name: 'Boiled Potato (Without Skin)', calories: 87, protein: 1.9, carbs: 20.1, fats: 0.1, serving: '100g' },

// --- More World-Famous Items ---
{ id: 'starbucks-iced-latte', name: 'Starbucks Iced Caffè Latte (Grande/2%)', calories: 130, protein: 8, carbs: 13, fats: 4.5, serving: '1 glass' },
{ id: 'popeyes-chicken-sandwich', name: 'Popeyes Classic Chicken Sandwich', calories: 700, protein: 28, carbs: 50, fats: 42, serving: '1 sandwich' },
{ id: 'krispy-kreme-glazed', name: 'Krispy Kreme Original Glazed Donut', calories: 190, protein: 2, carbs: 22, fats: 10, serving: '1 donut' },// --- Missing Fast-Food & Everyday Essentials ---
{ id: 'french-fries-fastfood', name: 'Fast Food French Fries', calories: 312, protein: 3.4, carbs: 41, fats: 15, serving: '100g' },
{ id: 'french-fries-homemade', name: 'Homemade French Fries (Fried)', calories: 274, protein: 3.5, carbs: 36, fats: 13, serving: '100g' },
{ id: 'sweet-potato-fries', name: 'Sweet Potato Fries (Baked)', calories: 154, protein: 2, carbs: 24, fats: 5, serving: '100g' },
{ id: 'mcdonalds-fries-medium', name: 'McDonald\'s French Fries (Medium)', calories: 320, protein: 4, carbs: 43, fats: 15, serving: '1 medium box' },
// --- Fruits ---
{ id: 'apple-green',       name: 'Green Apple',         calories: 52,  protein: 0.3, carbs: 14,   fats: 0.2, serving: '100g' },
{ id: 'strawberries',      name: 'Strawberries',        calories: 32,  protein: 0.7, carbs: 7.7,  fats: 0.3, serving: '100g' },
{ id: 'blueberries',       name: 'Blueberries',         calories: 57,  protein: 0.7, carbs: 14,   fats: 0.3, serving: '100g' },
{ id: 'orange',            name: 'Orange',              calories: 47,  protein: 0.9, carbs: 11.8, fats: 0.1, serving: '100g' },
{ id: 'watermelon',        name: 'Watermelon',          calories: 30,  protein: 0.6, carbs: 7.6,  fats: 0.2, serving: '100g' },
{ id: 'mango-egyptian',    name: 'Egyptian Mango',      calories: 60,  protein: 0.8, carbs: 15,   fats: 0.4, serving: '100g' },
{ id: 'dates-dry',         name: 'Dates (Dry / Tamr)',  calories: 277, protein: 1.8, carbs: 75,   fats: 0.2, serving: '100g' },
{ id: 'dates-fresh',       name: 'Dates (Fresh / Balah)',calories: 142, protein: 0.9, carbs: 37,   fats: 0.1, serving: '100g' },
{ id: 'grapes',            name: 'Grapes',              calories: 69,  protein: 0.7, carbs: 18,   fats: 0.2, serving: '100g' },
{ id: 'peach',             name: 'Peach',               calories: 39,  protein: 0.9, carbs: 9.5,  fats: 0.3, serving: '100g' },

// --- Vegetables ---
{ id: 'cucumber',          name: 'Cucumber (With Skin)',calories: 15,  protein: 0.7, carbs: 3.6,  fats: 0.1, serving: '100g' },
{ id: 'tomato',            name: 'Tomato',              calories: 18,  protein: 0.9, carbs: 3.9,  fats: 0.2, serving: '100g' },
{ id: 'spinach',           name: 'Spinach (Raw)',       calories: 23,  protein: 2.9, carbs: 3.6,  fats: 0.4, serving: '100g' },
{ id: 'bell-pepper',       name: 'Bell Pepper (Mixed)', calories: 20,  protein: 0.9, carbs: 4.6,  fats: 0.2, serving: '100g' },
{ id: 'carrots',           name: 'Carrots',             calories: 41,  protein: 0.9, carbs: 9.6,  fats: 0.2, serving: '100g' },
{ id: 'onion',             name: 'Onion',               calories: 40,  protein: 1.1, carbs: 9.3,  fats: 0.1, serving: '100g' },
{ id: 'garlic',            name: 'Garlic',              calories: 149, protein: 6.4, carbs: 33,   fats: 0.5, serving: '100g' },
{ id: 'lettuce',           name: 'Lettuce (Romaine)',   calories: 17,  protein: 1.2, carbs: 3.3,  fats: 0.3, serving: '100g' },
{ id: 'zucchini',          name: 'Zucchini / Kousa',    calories: 17,  protein: 1.2, carbs: 3.1,  fats: 0.3, serving: '100g' },
// --- Traditional Egyptian Vegetable Dishes ---
{ id: 'bamya-plain',       name: 'Bamya (Okra Stew - Plain)',   calories: 65,  protein: 2.5, carbs: 11,   fats: 2.1, serving: '100g' },
{ id: 'bamya-with-meat',   name: 'Bamya bel Lahma (with Beef)', calories: 145, protein: 11.2, carbs: 8.5,  fats: 7.8, serving: '100g' },
{ id: 'okra-raw',          name: 'Okra (Raw / Fresh)',          calories: 33,  protein: 1.9, carbs: 7.5,  fats: 0.2, serving: '100g' },// --- Chocolates ---
{ id: 'cadbury-dairy-milk',name: 'Cadbury Dairy Milk (Standard)',calories: 534, protein: 7.3, carbs: 57,   fats: 30,   serving: '100g' },
{ id: 'galaxy-smooth-milk',name: 'Galaxy Smooth Milk',         calories: 546, protein: 7,   carbs: 56,   fats: 32.4, serving: '100g' },
{ id: 'kitkat-4finger',    name: 'KitKat (4 Finger Bar)',       calories: 209, protein: 2.7, carbs: 24.3, fats: 11.2, serving: '1 bar' },
{ id: 'snickers',          name: 'Snickers Bar',                calories: 250, protein: 4.3, carbs: 33,   fats: 12,   serving: '1 bar (48g)' },
{ id: 'dark-chocolate-70', name: 'Dark Chocolate (70-85% Cacao)',calories: 598, protein: 7.8, carbs: 46,   fats: 43,   serving: '100g' },
{ id: 'corona-chocolate',  name: 'Corona Milk Chocolate (Local)',calories: 520, protein: 6.5, carbs: 58,   fats: 29,   serving: '100g' },

// --- Candies & Sweets ---
{ id: 'gummy-bears',       name: 'Haribo Gummy Bears',          calories: 343, protein: 6.9, carbs: 77,   fats: 0.1,  serving: '100g' },
{ id: 'skittles-original', name: 'Skittles (Original)',         calories: 405, protein: 0,   carbs: 90.7, fats: 4.4,  serving: '100g' },
{ id: 'mms-peanut',        name: 'M&M\'s Peanut',               calories: 511, protein: 9.7, carbs: 58.9, fats: 25.3, serving: '100g' },

// --- Chips & Savory Snacks ---
{ id: 'chipsy-egypt',      name: 'Chipsy (Salt - Egyptian)',    calories: 532, protein: 6.5, carbs: 53,   fats: 32.5, serving: '100g' },
{ id: 'doritos-flaminhot', name: 'Doritos Flamin\' Hot',         calories: 515, protein: 6.1, carbs: 58.1, fats: 27.2, serving: '100g' },
{ id: 'pringles-original', name: 'Pringles Original',           calories: 534, protein: 4,   carbs: 53,   fats: 33,   serving: '100g' },
{ id: 'popcorn-air-popped',name: 'Popcorn (Air-Popped)',        calories: 387, protein: 12.9,carbs: 78,   fats: 4.5,  serving: '100g' },
{ id: 'popcorn-oil-salted',name: 'Popcorn (Oil-Popped & Salted)',calories: 500, protein: 9,   carbs: 58,   fats: 28,   serving: '100g' },
{ id: 'bake-stix',         name: 'Bake Stix (Flavored)',        calories: 430, protein: 9.5, carbs: 72,   fats: 11,   serving: '100g' },// --- Imported & Local Biscuits ---
{ id: 'oreos',             name: 'Oreo Biscuits',               calories: 471, protein: 4.3, carbs: 70,   fats: 20,   serving: '100g' },
{ id: 'digestive-plain',   name: 'McVitie\'s Digestive (Plain)',calories: 478, protein: 7.2, carbs: 62.2, fats: 21.3, serving: '100g' },
{ id: 'digestive-choco',   name: 'McVitie\'s Chocolate Digestive',calories: 493, protein: 6.7, carbs: 62.5, fats: 23.3, serving: '100g' },
{ id: 'lotus-biscoff',     name: 'Lotus Biscoff Biscuits',      calories: 484, protein: 4.9, carbs: 72.6, fats: 19,   serving: '100g' },
{ id: 'borio',             name: 'Borio Biscuits (Local)',      calories: 465, protein: 4.5, carbs: 69,   fats: 19.5, serving: '100g' },
{ id: 'biskrem',           name: 'Biskrem (Chocolate Filled)',  calories: 490, protein: 5.5, carbs: 65,   fats: 23,   serving: '100g' },
{ id: 'ulker-gandour',     name: 'Ulker Gandour Biscuits',      calories: 440, protein: 7,   carbs: 75,   fats: 12,   serving: '100g' },
{ id: 'kahk-plain',        name: 'Egyptian Kahk (Plain Eid)',   calories: 520, protein: 5.8, carbs: 55,   fats: 31,   serving: '100g' },
{ id: 'nashader-biscuits', name: 'Egyptian Biscuit (Nashader)', calories: 460, protein: 6.5, carbs: 68,   fats: 17.5, serving: '100g' },// --- Spreads, Jams & Creams ---
{ id: 'nutella',           name: 'Nutella (Hazelnut Spread)',   calories: 539, protein: 6.3, carbs: 57.5, fats: 30.9, serving: '100g' },
{ id: 'strawberry-jam',    name: 'Strawberry Jam (Vitrac)',     calories: 275, protein: 0.5, carbs: 68,   fats: 0.1,  serving: '100g' },
{ id: 'diet-jam',          name: 'Diet Strawberry Jam (Hero)',  calories: 35,  protein: 0.3, carbs: 7.5,  fats: 0.1,  serving: '100g' },
{ id: 'lotus-spread',      name: 'Lotus Biscoff Cookie Butter', calories: 584, protein: 2.9, carbs: 57,   fats: 38.1, serving: '100g' },
{ id: 'halawa-plain',      name: 'Egyptian Halawa (Plain)',     calories: 512, protein: 12,  carbs: 53,   fats: 28,   serving: '100g' },
{ id: 'halawa-spread',     name: 'Halawa Spread (El Rashidi)',  calories: 495, protein: 10.5,carbs: 56,   fats: 25.5, serving: '100g' },
{ id: 'clotted-cream',     name: 'Egyptian Eshta (Baladi)',     calories: 345, protein: 2,   carbs: 2.8,  fats: 37,   serving: '100g' },
{ id: 'honey-white',       name: '1 spoon Honey',            calories: 304, protein: 0.3, carbs: 82.4, fats: 0,    serving: '100g' },
{ id: 'molasses-black',    name: 'Egyptian Black Honey (Asal)', calories: 290, protein: 0,   carbs: 75,   fats: 0,    serving: '100g' },// --- Egyptian & International Cheeses ---
{ id: 'rumi-cheese',       name: 'Egyptian Rumi Cheese (Old)',  calories: 390, protein: 26,   carbs: 2,    fats: 31,   serving: '100g' },
{ id: 'domiaty-cheese',    name: 'Domiaty White Cheese (Feta)', calories: 250, protein: 14,   carbs: 4,    fats: 20,   serving: '100g' },
{ id: 'baramily-cheese',   name: 'Egyptian Baramily Cheese',    calories: 265, protein: 13.5, carbs: 3.5,  fats: 22,   serving: '100g' },
{ id: 'quresh-cheese',     name: 'Kareiish Cheese (Quraish)',   calories: 98,  protein: 11,   carbs: 3.4,  fats: 4.3,  serving: '100g' },
{ id: 'mozzarella-local',  name: 'Mozzarella Cheese (Local)',   calories: 280, protein: 22,   carbs: 2.2,  fats: 20,   serving: '100g' },
{ id: 'cheddar-slices',    name: 'Processed Cheddar Slices',    calories: 330, protein: 16,   carbs: 6,    fats: 27,   serving: '100g' },
{ id: 'kiri-square',       name: 'Kiri Cream Cheese Square',    calories: 52,  protein: 0.9,  carbs: 0.7,  fats: 5.1,  serving: '1 square (18g)' },
{ id: 'la-vache-qu-rit',   name: 'Triangle Cheese (La Vache)',  calories: 40,  protein: 1.3,  carbs: 0.9,  fats: 3.5,  serving: '1 triangle (15g)' },
{ id: 'parmesan',          name: 'Parmesan Cheese',             calories: 431, protein: 38,   carbs: 4.1,  fats: 29,   serving: '100g' },
{ id: 'sausage-beef', name: 'Beef Sausage (Grilled)', calories: 301, protein: 14.3, carbs: 1.2, fats: 26.8, serving: '100g' },
{ id: 'sausage-chicken', name: 'Chicken Sausage', calories: 172, protein: 15.2, carbs: 1.5, fats: 11.4, serving: '100g' },
{ id: 'sausage-egyptian', name: 'Sogoq (Egyptian Sausage)', calories: 340, protein: 13.5, carbs: 4.2, fats: 29.5, serving: '100g' },
{ id: 'creatine-monohydrate', name: 'Creatine Monohydrate', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 scoop (5g)' },
{ id: 'bcaa-powder', name: 'BCAA Powder', calories: 20, protein: 4.5, carbs: 0.5, fats: 0, serving: '1 scoop' },
{ id: 'casein-protein', name: 'Casein Protein Powder', calories: 110, protein: 25, carbs: 1, fats: 0.5, serving: '1 scoop' },
{ id: 'pre-workout', name: 'Pre-Workout Supplement', calories: 15, protein: 0, carbs: 3, fats: 0, serving: '1 scoop' },{ id: 'sting-energy-red', name: 'Sting Energy Drink (Strawberry)', calories: 142, protein: 0, carbs: 35.5, fats: 0, serving: '1 bottle (250ml)' },
{ id: 'red-bull', name: 'Red Bull Energy Drink', calories: 112, protein: 1, carbs: 26, fats: 0, serving: '1 can (250ml)' },
{ id: 'monster-energy-zero', name: 'Monster Energy Ultra (Zero Sugar)', calories: 10, protein: 0, carbs: 2, fats: 0, serving: '1 can (500ml)' },
{ id: 'fayrouz-pineapple', name: 'Fayrouz (Pineapple)', calories: 96, protein: 0, carbs: 24, fats: 0, serving: '1 can (330ml)' },
{ id: 'pepsi-diet', name: 'Diet Pepsi / Pepsi Zero', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 can (330ml)' },
{ id: 'pepsi-regular', name: 'Pepsi (Regular)', calories: 145, protein: 0, carbs: 39, fats: 0, serving: '1 can (330ml)' },
{ id: 'sugar-cane-juice', name: 'Asab (Egyptian Sugar Cane Juice)', calories: 130, protein: 0.5, carbs: 32, fats: 0, serving: '1 glass (250ml)' },{ id: 'stuffed-pigeon-hamam', name: 'Hamam Mahshi (Stuffed Pigeon with Freek/Rice)', calories: 625, protein: 33, carbs: 48, fats: 31, serving: '1 pigeon (~300g)' },
{ id: 'roz-meammar-beef', name: 'Roz Meammar (Egyptian Baked Rice with Cream & Beef)', calories: 350, protein: 12, carbs: 38, fats: 16, serving: '100g' },
{ id: 'stuffed-pigeon-hamam', name: 'Hamam Mahshi (Stuffed Pigeon with Freek/Rice)', calories: 625, protein: 33, carbs: 48, fats: 31, serving: '1 pigeon (~300g)' },{ id: 'basbousa-plain', name: 'Basbousa (Semolina Cake with Syrup)', calories: 340, protein: 4, carbs: 54, fats: 12, serving: '100g' },
  { id: 'kunafa-cream', name: 'Kunafa with Cream (Eshta)', calories: 375, protein: 4.5, carbs: 49, fats: 18, serving: '100g' },
  { id: 'om-ali-nuts', name: 'Om Ali (Egyptian Bread Pudding with Cream & Nuts)', calories: 280, protein: 6, carbs: 36, fats: 12.5, serving: '100g' },
  { id: 'balah-el-sham', name: 'Balah El Sham (Choux Pastry Deep Fried in Syrup)', calories: 425, protein: 4.8, carbs: 61, fats: 18, serving: '100g' },
  { id: 'roz-bel-laban', name: 'Roz Bel Laban (Egyptian Rice Pudding)', calories: 115, protein: 3.2, carbs: 21, fats: 2, serving: '100g' },
  { id: 'granola-plain-rolled', name: 'Granola (Classic Honey Oat, Homemade)', calories: 471, protein: 10, carbs: 64, fats: 20, serving: '100g' },{ id: 'indomie-chicken-regular', name: 'Indomie Instant Noodles (Chicken Flavor)', calories: 350, protein: 7, carbs: 48, fats: 14, serving: '1 pack (75g)' },
  { id: 'indomie-beef-flavor', name: 'Indomie Instant Noodles (Beef Flavor)', calories: 340, protein: 7, carbs: 47, fats: 13.5, serving: '1 pack (75g)' },// ─── Diet Products & Supplements ──────────────────────────────────────
{ id: 'protein-bar-quest', name: 'Quest Protein Bar (Cookie Dough)', calories: 190, protein: 21, carbs: 23, fats: 7, serving: '1 bar (60g)' },
{ id: 'protein-bar-barebells', name: 'Barebells Protein Bar (Salty Peanut)', calories: 200, protein: 20, carbs: 15, fats: 9, serving: '1 bar (55g)' },
{ id: 'collagen-peptides', name: 'Hydrolyzed Collagen Peptides', calories: 35, protein: 9, carbs: 0, fats: 0, serving: '1 scoop (10g)' },
{ id: 'glutamine', name: 'L-Glutamine Powder', calories: 4, protein: 1, carbs: 0, fats: 0, serving: '1 scoop (5g)' },
{ id: 'omega-3-fish-oil', name: 'Omega-3 Fish Oil Capsules', calories: 45, protein: 0, carbs: 0, fats: 5, serving: '2 capsules' },
{ id: 'multivitamin', name: 'Multivitamin (Daily)', calories: 5, protein: 0, carbs: 1, fats: 0, serving: '1 tablet' },
{ id: 'electrolyte-powder', name: 'Electrolyte Powder (Zero Sugar)', calories: 10, protein: 0, carbs: 2, fats: 0, serving: '1 sachet' },
{ id: 'meal-replacement-huel', name: 'Huel Powder (Vanilla)', calories: 400, protein: 30, carbs: 42, fats: 14, serving: '1 serving (100g)' },
{ id: 'low-carb-wrap', name: 'Low-Carb Tortilla Wrap', calories: 70, protein: 5, carbs: 15, fats: 1.5, serving: '1 wrap' },
{ id: 'shirataki-noodles', name: 'Shirataki Konjac Noodles', calories: 10, protein: 0.5, carbs: 3, fats: 0, serving: '100g' },
{ id: 'almond-flour', name: 'Almond Flour (Blanched)', calories: 580, protein: 20, carbs: 22, fats: 50, serving: '100g' },
{ id: 'coconut-flour', name: 'Coconut Flour', calories: 440, protein: 20, carbs: 38, fats: 9, serving: '100g' },
{ id: 'erythritol', name: 'Erythritol (Zero-Calorie Sweetener)', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '100g' },
{ id: 'stevia-drops', name: 'Stevia Liquid Drops', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 dropper' },
{ id: 'sugar-free-syrup', name: 'Sugar-Free Maple Syrup', calories: 15, protein: 0, carbs: 5, fats: 0, serving: '2 tbsp (30ml)' },
{ id: 'sugar-free-ketchup', name: 'Sugar-Free Tomato Ketchup', calories: 10, protein: 0.5, carbs: 2, fats: 0, serving: '1 tbsp' },
{ id: 'light-mayo', name: 'Light Mayonnaise', calories: 35, protein: 0, carbs: 1, fats: 3.5, serving: '1 tbsp (15g)' },
{ id: 'fat-free-greek-yogurt', name: 'Fat-Free Greek Yogurt (Plain)', calories: 59, protein: 10, carbs: 4, fats: 0.2, serving: '100g' },
{ id: 'low-fat-cheese-slices', name: 'Low-Fat Cheese Slices (30% less fat)', calories: 70, protein: 7, carbs: 1, fats: 4.5, serving: '1 slice (20g)' },
{ id: 'low-calorie-ice-cream', name: 'Low-Calorie Ice Cream (Halo Top style)', calories: 280, protein: 20, carbs: 40, fats: 6, serving: '1 pint (473ml)' },
{ id: 'protein-pudding', name: 'Protein Pudding (Chocolate)', calories: 150, protein: 20, carbs: 12, fats: 2, serving: '1 pot (150g)' },
{ id: 'nutritional-yeast', name: 'Nutritional Yeast Flakes (Nooch)', calories: 35, protein: 5, carbs: 3, fats: 0.5, serving: '1 tbsp (8g)' },
{ id: 'plant-based-mince', name: 'Plant-Based Meat Mince (TVP/Soy)', calories: 130, protein: 18, carbs: 10, fats: 1.5, serving: '100g' },
{ id: 'vegan-sausages', name: 'Plant-Based Sausages', calories: 180, protein: 16, carbs: 8, fats: 10, serving: '2 sausages' },
{ id: 'tempeh', name: 'Tempeh (Fermented Soy)', calories: 193, protein: 20, carbs: 9, fats: 11, serving: '100g' },
{ id: 'spirulina', name: 'Spirulina Powder', calories: 25, protein: 4, carbs: 2, fats: 0.5, serving: '1 tsp (5g)' },
{ id: 'mct-oil', name: 'MCT Oil (Medium-Chain Triglycerides)', calories: 115, protein: 0, carbs: 0, fats: 14, serving: '1 tbsp (15ml)' },
{ id: 'ghee', name: 'Clarified Butter (Ghee)', calories: 120, protein: 0, carbs: 0, fats: 14, serving: '1 tbsp (15g)' },
{ id: 'bone-broth', name: 'Beef Bone Broth (Protein Rich)', calories: 45, protein: 10, carbs: 0, fats: 0.5, serving: '1 cup (240ml)' },
{ id: 'zero-sugar-soda', name: 'Zero Sugar Cola', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 can (330ml)' },
{ id: 'caffeine-pills', name: 'Caffeine Tablet (200mg)', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 tablet' },// ─── New Additions ────────────────────────────────────────────────────────
{ id: 'almond-milk', name: 'cup of Almond Milk', calories: 17, protein: 0.6, carbs: 0.8, fats: 1.5, serving: '100ml' },
{ id: 'oat-milk', name: 'Oat Milk (Barista)', calories: 54, protein: 1.0, carbs: 8.0, fats: 1.8, serving: '100ml' },
{ id: 'lean-beef-mince', name: 'Lean Beef Mince (5% fat)', calories: 151, protein: 21.5, carbs: 0, fats: 6.8, serving: '100g' },
{ id: 'chicken-thigh', name: 'Chicken Thigh', calories: 177, protein: 20.0, carbs: 0, fats: 10.3, serving: '100g' },
{ id: 'firm-tofu', name: 'Firm Tofu', calories: 144, protein: 15.8, carbs: 2.5, fats: 8.0, serving: '100g' },
{ id: 'hummus', name: 'Classic Hummus', calories: 166, protein: 4.9, carbs: 14.3, fats: 10.5, serving: '100g' },
{ id: 'tahini', name: 'Tahini (Sesame Paste)', calories: 595, protein: 17.0, carbs: 21.0, fats: 53.0, serving: '100g' },
{ id: 'sourdough-bread', name: 'Sourdough Bread', calories: 266, protein: 9.0, carbs: 50.0, fats: 1.0, serving: '100g' },
{ id: 'rice-cakes', name: 'Plain Rice Cakes', calories: 386, protein: 8.0, carbs: 82.0, fats: 3.0, serving: '100g' },
{ id: 'walnuts', name: 'Walnuts', calories: 654, protein: 15.0, carbs: 14.0, fats: 65.0, serving: '100g' },
{ id: 'cashews', name: 'Cashew Nuts', calories: 553, protein: 18.0, carbs: 30.0, fats: 44.0, serving: '100g' },
{ id: 'chia-seeds', name: 'Chia Seeds', calories: 486, protein: 17.0, carbs: 42.0, fats: 31.0, serving: '100g' },
{ id: 'flaxseed', name: 'Ground Flaxseed', calories: 534, protein: 18.0, carbs: 29.0, fats: 42.0, serving: '100g' },
{ id: 'olive-oil', name: 'Extra Virgin Olive Oil', calories: 884, protein: 0, carbs: 0, fats: 100.0, serving: '100ml' },
{ id: 'coconut-oil', name: 'Coconut Oil', calories: 862, protein: 0, carbs: 0, fats: 100.0, serving: '100ml' },
{ id: 'greek-yogurt-fat-free', name: 'Greek Yogurt (0% Fat)', calories: 59, protein: 10.0, carbs: 3.6, fats: 0.2, serving: '100g' },
{ id: 'whole-egg', name: 'Whole Egg (Large)', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, serving: '1 large' },
{ id: 'egg-whites', name: 'Liquid Egg Whites', calories: 52, protein: 11.0, carbs: 0, fats: 0, serving: '100g' },
{ id: 'gebna-beyda', name: 'Gebna Beyda (White Cheese / Domiati)', calories: 240, protein: 14.0, carbs: 2.5, fats: 19.0, serving: '100g' },
{ id: 'fino-bread', name: 'Eish Fino (Egyptian White Roll)', calories: 310, protein: 11.0, carbs: 55.0, fats: 5.0, serving: '100g' },{ id: 'whey-isolate', name: 'Whey Protein Isolate', calories: 110, protein: 26, carbs: 0.5, fats: 0, serving: '1 scoop (~30g)' },
{ id: 'mass-gainer-powder', name: 'Mass Gainer Powder', calories: 380, protein: 25, carbs: 65, fats: 3, serving: '100g' },
{ id: 'eaa-powder', name: 'EAA (Essential Amino Acids) Powder', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 scoop' },
{ id: 'beta-alanine', name: 'Beta-Alanine Powder', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 scoop (3g)' },
{ id: 'citrulline-malate', name: 'Citrulline Malate Powder', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 scoop (5g)' },
{ id: 'l-carnitine-liquid', name: 'L-Carnitine Liquid', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 tbsp (15ml)' },
{ id: 'ashwagandha-capsules', name: 'Ashwagandha Extract', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 capsule' },
{ id: 'vitamin-d3-k2', name: 'Vitamin D3 + K2 Supplement', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '1 capsule' },
{ id: 'zma-supplement', name: 'ZMA (Zinc, Magnesium, B6)', calories: 0, protein: 0, carbs: 0, fats: 0, serving: '3 capsules' },
{ id: 'psyllium-husk-powder', name: 'Psyllium Husk Powder (Fiber)', calories: 30, protein: 0, carbs: 8, fats: 0, serving: '1 tbsp (9g)' },
{ id: 'celsius-energy-drink', name: 'Celsius / C4 Fit Energy Drink', calories: 10, protein: 0, carbs: 0, fats: 0, serving: '1 can (355ml)' },
// --- Crepe Variations ---
{ id: 'crepe-crunchy-chicken', name: 'Egyptian Chicken Crunchy Crepe (Koki/Strips)', calories: 680, protein: 28, carbs: 75, fats: 26, serving: '1 crepe' },
{ id: 'crepe-chicken-shawarma', name: 'Chicken Shawarma Crepe', calories: 620, protein: 32, carbs: 68, fats: 22, serving: '1 crepe' },
{ id: 'crepe-shish-taouk', name: 'Shish Taouk Crepe', calories: 590, protein: 30, carbs: 67, fats: 19, serving: '1 crepe' },
{ id: 'crepe-mix-chicken', name: 'Mix Chicken Crepe (Strips + Shawarma + Panne)', calories: 740, protein: 34, carbs: 76, fats: 30, serving: '1 crepe' },
{ id: 'crepe-sogoq', name: 'Egyptian Sausage Crepe (Sogoq)', calories: 650, protein: 24, carbs: 66, fats: 29, serving: '1 crepe' },
{ id: 'crepe-mix-meat', name: 'Mix Meat Crepe (Sogoq + Burger + Kofta)', calories: 790, protein: 31, carbs: 68, fats: 36, serving: '1 crepe' },
{ id: 'crepe-mix-cheese', name: 'Mix Cheese Crepe (Rumi + Cheddar + Mozzarella)', calories: 580, protein: 22, carbs: 64, fats: 24, serving: '1 crepe' },
{ id: 'crepe-french-fries', name: 'French Fries Crepe (Batates Regular)', calories: 510, protein: 11, carbs: 78, fats: 16, serving: '1 crepe' },
{ id: 'crepe-nutella-banana', name: 'Sweet Crepe with Nutella & Banana', calories: 540, protein: 8, carbs: 82, fats: 20, serving: '1 crepe' },
{ id: 'crepe-plain-sheet', name: 'Plain Crepe Sheet (No Fillings)', calories: 180, protein: 5, carbs: 32, fats: 3.2, serving: '1 sheet' },{ id: 'macarona-bechamel-chicken', name: 'Macarona Bechamel (with Chicken/Negresco)', calories: 158, protein: 8.5, carbs: 18.5, fats: 5.6, serving: '100g' },
{ id: 'macarona-red-sauce-plain', name: 'Macarona bel Salssa (Pasta with Red Sauce - Plain)', calories: 120, protein: 3.5, carbs: 24, fats: 1.1, serving: '100g' },
{ id: 'macarona-red-sauce-meat', name: 'Macarona bel Lahma Mofroma (Pasta with Red Sauce & Minced Meat)', calories: 148, protein: 7.8, carbs: 21, fats: 3.6, serving: '100g' },
{ id: 'macarona-tagen-kebda', name: 'Tagen Macarona bel Kebda (Egyptian Pasta Baked with Liver)', calories: 155, protein: 9.5, carbs: 22, fats: 3.2, serving: '100g' },
{ id: 'macarona-tagen-lahma', name: 'Tagen Macarona bel Lahma (Egyptian Pasta Baked with Meat)', calories: 162, protein: 9.0, carbs: 22.5, fats: 4.0, serving: '100g' },
{ id: 'macarona-moubakkara-beef', name: 'Macarona Moubakkara (Libyan/Egyptian Bedouin One-Pot Pasta with Beef)', calories: 175, protein: 10.5, carbs: 19.5, fats: 6.2, serving: '100g' },
{ id: 'pasta-white-sauce-plain', name: 'White Sauce Pasta (Plain Alfredo Style)', calories: 168, protein: 4.2, carbs: 21, fats: 7.5, serving: '100g' },
{ id: 'pasta-white-sauce-chicken', name: 'White Sauce Pasta with Chicken', calories: 182, protein: 11.5, carbs: 18.2, fats: 7.0, serving: '100g' },
{ id: 'pasta-pink-sauce', name: 'Pink Sauce Pasta (Rose Sauce)', calories: 145, protein: 3.8, carbs: 22, fats: 4.6, serving: '100g' },
{ id: 'pasta-bolognese', name: 'Pasta Bolognese (Global Style)', calories: 132, protein: 6.8, carbs: 18.5, fats: 3.4, serving: '100g' },
{ id: 'mac-and-cheese', name: 'Macaroni and Cheese (Classic Baked)', calories: 210, protein: 9.0, carbs: 24, fats: 8.5, serving: '100g' },
{ id: 'tortilla', name: 'Flour Tortilla', calories: 144, protein: 4.0, carbs: 24, fats: 4.0, serving: '1 medium' },
{ id: 'spaghetti', name: '100gm Macaroni/Spaghetti', calories: 220, protein: 8.1, carbs: 43, fats: 1.3, serving: '1 cup' },
];

// ─── Diet Plan Blueprints ──────────────────────────────

// Each blueprint: [foodId, quantity, foodId, quantity, ...]
// Quantity is in "servings" (e.g., 1 = 1 serving as defined in DB)
const MEAL_BLUEPRINTS = {
  breakfast: [
    { foods: ['oatmeal', 1.2, 'banana', 1, 'protein-shake', 0.5], label: 'Oatmeal + Banana + Whey' },
    { foods: ['egg', 3, 'bread', 2, 'cheese', 1], label: 'Eggs on Toast + Cheese' },
    { foods: ['greek-yogurt', 1.5, 'strawberries', 1.5, 'almonds', 0.3], label: 'Greek Yogurt + Berries + Almonds' },
    { foods: ['milk', 1, 'oatmeal', 1, 'banana', 1], label: 'Overnight Oats' },
    { foods: ['ful-mudammas', 1.5, 'baladi-bread', 1, 'tomato', 0.5], label: 'Ful + Baladi Bread' },
  ],
  lunch: [
    { foods: ['chicken-breast', 1.5, 'rice', 1.2, 'broccoli', 1.5], label: 'Grilled Chicken + Rice + Broccoli' },
    { foods: ['salmon', 1.2, 'sweet-potato', 1.5, 'spinach', 1], label: 'Salmon + Sweet Potato + Spinach' },
    { foods: ['tuna-canned', 1.5, 'pasta', 1.2, 'tomato', 1], label: 'Tuna Pasta Salad' },
    { foods: ['koshary', 1.5, 'molokhia', 1], label: 'Koshary + Molokhia' },
    { foods: ['shish-taouk', 1.5, 'rice', 1, 'cucumber', 1], label: 'Shish Taouk + Rice' },
  ],
  dinner: [
    { foods: ['steak', 1.2, 'boiled-potato', 1.5, 'broccoli', 1.5], label: 'Steak + Potato + Broccoli' },
    { foods: ['white-fish', 1.5, 'basmati-rice', 1.2, 'zucchini', 1], label: 'Grilled Fish + Basmati + Zucchini' },
    { foods: ['eggs', 3, 'baladi-bread', 1, 'avocado', 0.5], label: 'Avocado Egg Toast' },
    { foods: ['macarona-bechamel', 1.5, 'salad', 1], label: 'Macarona Bechamel + Salad' },
    { foods: ['kofta', 1.5, 'rice', 1, 'tomato', 1], label: 'Kofta + Rice' },
  ],
  snack: [
    { foods: ['protein-shake', 1, 'banana', 1], label: 'Protein Shake + Banana' },
    { foods: ['greek-yogurt', 1, 'blueberries', 1], label: 'Greek Yogurt + Berries' },
    { foods: ['almonds', 0.5, 'apple', 1], label: 'Apple + Almonds' },
    { foods: ['peanut-butter', 0.2, 'bread', 2], label: 'Peanut Butter Toast' },
    { foods: ['cottage-cheese', 1, 'grapes', 1], label: 'Cottage Cheese + Grapes' },
    { foods: ['dates-dry', 0.5, 'milk', 1], label: 'Dates + Milk' },
  ]
};

function getBlueprintMacros(blueprint) {
  const foods = blueprint.foods;
  let total = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (let i = 0; i < foods.length; i += 2) {
    const id = foods[i];
    const qty = foods[i + 1];
    const dbFood = FOOD_DATABASE.find(f => f.id === id);
    if (dbFood) {
      total.calories += dbFood.calories * qty;
      total.protein  += (dbFood.protein || 0) * qty;
      total.carbs    += (dbFood.carbs || 0) * qty;
      total.fats     += (dbFood.fats || 0) * qty;
    }
  }
  return total;
}

function generateDailyDietPlan(targetCal, targetP, targetC, targetF) {
  // Calculate target macro ratios
  const targetRatioP = targetCal > 0 ? (targetP * 4) / targetCal : 0.30; // protein is 4 kcal/g
  const targetRatioC = targetCal > 0 ? (targetC * 4) / targetCal : 0.45; // carbs is 4 kcal/g
  const targetRatioF = targetCal > 0 ? (targetF * 9) / targetCal : 0.25; // fats is 9 kcal/g

  // Helper to score a blueprint based on macro ratio similarity
  function scoreBlueprint(bp) {
    const macros = getBlueprintMacros(bp);
    if (macros.calories === 0) return 999;
    
    const bpRatioP = (macros.protein * 4) / macros.calories;
    const bpRatioC = (macros.carbs * 4) / macros.calories;
    const bpRatioF = (macros.fats * 9) / macros.calories;
    
    // Sum of squared errors to penalize large deviations
    return Math.pow(bpRatioP - targetRatioP, 2) + 
           Math.pow(bpRatioC - targetRatioC, 2) + 
           Math.pow(bpRatioF - targetRatioF, 2);
  }

  // Get ranked list of blueprints for each meal type
  function getRankedBlueprints(category) {
    const list = MEAL_BLUEPRINTS[category] || [];
    return list.map(bp => ({
      bp,
      score: scoreBlueprint(bp)
    })).sort((a, b) => a.score - b.score);
  }

  const breakfastRanked = getRankedBlueprints('breakfast');
  const lunchRanked = getRankedBlueprints('lunch');
  const dinnerRanked = getRankedBlueprints('dinner');
  const snackRanked = getRankedBlueprints('snack');

  // To introduce variety but still prioritize good matches, we randomly pick from the top 3 matches
  function pickMeal(rankedList) {
    const topCandidates = rankedList.slice(0, 3);
    const idx = Math.floor(Math.random() * topCandidates.length);
    return topCandidates[idx]?.bp;
  }

  const selected = {
    breakfast: pickMeal(breakfastRanked) || MEAL_BLUEPRINTS.breakfast[0],
    lunch: pickMeal(lunchRanked) || MEAL_BLUEPRINTS.lunch[0],
    dinner: pickMeal(dinnerRanked) || MEAL_BLUEPRINTS.dinner[0],
    snack1: snackRanked[0]?.bp || MEAL_BLUEPRINTS.snack[0],
    snack2: snackRanked[1]?.bp || MEAL_BLUEPRINTS.snack[1] || MEAL_BLUEPRINTS.snack[0]
  };

  // Calculate total macros of the selected plan
  let total = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  const planMacros = {};
  
  mealKeys.forEach(key => {
    const bp = selected[key];
    const macros = getBlueprintMacros(bp);
    planMacros[key] = macros;
    total.calories += macros.calories;
    total.protein  += macros.protein;
    total.carbs    += macros.carbs;
    total.fats     += macros.fats;
  });

  // Scale all meals proportionally to hit the calorie target
  const scaleFactor = total.calories > 0 ? targetCal / total.calories : 1;
  
  // Apply scaling to each meal's blueprint
  const scaledPlan = {};
  mealKeys.forEach(key => {
    const bp = selected[key];
    const baseMacros = planMacros[key];
    // Scale the quantities in the blueprint
    const scaledFoods = [];
    for (let i = 0; i < bp.foods.length; i += 2) {
      const id = bp.foods[i];
      const qty = bp.foods[i + 1] * scaleFactor;
      scaledFoods.push(id, Math.round(qty * 10) / 10); // keep 1 decimal
    }
    scaledPlan[key] = {
      label: bp.label,
      foods: scaledFoods,
      macros: {
        calories: Math.round(baseMacros.calories * scaleFactor),
        protein:  Math.round(baseMacros.protein * scaleFactor * 10) / 10,
        carbs:    Math.round(baseMacros.carbs * scaleFactor * 10) / 10,
        fats:     Math.round(baseMacros.fats * scaleFactor * 10) / 10,
      }
    };
  });

  return scaledPlan;
}

async function generateDietPlanFromAI(targetCal, targetP, targetC, targetF, daysCount = 7) {
  let data;
  try {
    const res = await fetch('/api/generate-diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCal,
        targetP,
        targetC,
        targetF,
        days: daysCount
      })
    });

    if (res.status === 404) {
      throw new Error('404');
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    data = await res.json();
  } catch (err) {
    if (err.message === '404' || err.message.includes('404')) {
      console.warn('API endpoint not found (404). Falling back to direct Groq client-side request...');
      toast('🔌 Local API missing. Fetching directly from Grok AI...');
      
const apiKey = GROK_API_KEY;
           const prompt = `Create a 7-day healthy meal plan for someone eating exactly ${targetCal} kcal per day.

FOOD SELECTION RULES :
- Build the plan almost entirely around plain, everyday staple foods that ordinary people eat daily like these foods : chicken breasts or panne or chicken thighs and all chicken variations, eggs and its variations like ommlete and scrambled, oats and granola , white/basmati rice, bread (toast ,fino , tortilla , etc), potatoes and mashed potatoes and sweet potatos, pasta or macaroni variations, milk, yogurt or greek yoghurt, cheese variations, common fruit (banana, apple, orange, avocado like 1 - 2 times a week), common vegetables (broccoli, spinach, bamya, cucumber, salad), peanut butter, beans(only beans no green beans), nuts and cashew variations.
- Chicken breast should be the DEFAULT protein for most lunches/dinners. Fish (salmon, tuna, etc.) may appear in AT MOST 1 meal across the entire plan - do not use fish repeatedly or as a frequent staple.
- Red meat (beef, lamb ,steak ,etc) may appear occasionally (max 1-2 times across the whole plan), not as a daily staple.
- Do NOT use rare, festive, restaurant-style, or heavy/greasy dishes (e.g.Om ali, quinao, koshary, shish taouk, feteer, mahshi, kunafa, fried foods, fast food, sugary desserts) - this is a clean everyday diet plan, not a treat/cheat plan.
- Favor whole, minimally processed foods over processed ones. Avoid excessive added sugar, deep-fried items, and overly complex recipes.
- Each day has 3-5 meals: breakfast, lunch, dinner, snack1 (3-5 times a week), snack2(optional (add it onlyyy 2 times a week)).but complete the kcal goal
- Do NOT leave any day or meal empty except snack 2 as we said. Fully generate all 7 days.
- Each meal should be represented by a short label and a list of food items with realistic quantities.
- feel free to add supplements especially at snack meals and add diet related products and make the quantities logical for each food and avoid foods like (mixed vegetables or steamed vegetable) be more direct and clear.
- feel free to add what you want to add (70% from the foods i suggested , 30% from foods you suggest).
- Avoid adding (quinao) and (hummus) to lunch and tomatoes and carrots to snack because nobody eats them replace them you can replace quinao with whey protien scoop and replace tomatoes with nuts and cashew as snack meal to get fats.
- Last thing make sure that friday ,saturday and sunday are complete because sometimes you generate them uncomplete

**HIGHEST PRIORITY: CALORIE TARGET**
- Every single day must total **close to ${targetCal} kcal** (minimum ${targetCal-200}, ideally ${targetCal}).
- Use **generous, realistic portions** of rice, chicken, oats, pasta, potatoes, etc. to reach the target.
- Do not make small/light meals. Make breakfast, lunch, and dinner filling.

FOOD SELECTION RULES (strict):
- Build the plan almost entirely around plain, everyday staple foods that ordinary people eat daily like these foods : chicken breasts or panne or chicken thighs and all chicken variations, eggs and its variations like ommlete and scrambled, oats and granola , white/basmati rice, bread (toast ,fino , tortilla , etc), potatoes and mashed potatoes and sweet potatos, pasta or macaroni variations, milk, yogurt or greek yoghurt, cheese variations, common fruit (banana, apple, orange, avocado like 1 - 2 times a week), common vegetables (broccoli, spinach, bamya, cucumber, salad), peanut butter, beans(only beans no green beans), nuts and cashew variations.
- Chicken breast should be the DEFAULT protein for most lunches/dinners. Fish (salmon, tuna, etc.) may appear in AT MOST 1 meal across the entire plan.
- Red meat may appear occasionally (max 1-2 times across the whole plan).
- Do NOT use rare, festive, restaurant-style, or heavy/greasy dishes.
- Each day has 3-5 meals: breakfast, lunch, dinner, snack1 (3-5 times a week), snack2 (optional, max 2 times a week).
- Fully generate all 7 days with complete meals.

**VERY STRICT FORMATTING RULES - NO MULTIPLIERS EVER:**

- Rice, pasta, chicken, potatoes, broccoli, spinach → **always in grams** ("140 grams cooked white rice", "300 grams grilled chicken breast")
- Milk → **always in cups** ("1 cup milk (2%)", "2 cups milk")
- Honey, peanut butter, butter → **always in spoons** ("2 spoons natural peanut butter")
- Bread → "2 slices fino bread"
- Eggs → "2 medium eggs" or "4 medium eggs"
- Banana, apple → "1 large banana", "2 medium apples"

**Never** use "1x", "1.6x" or any multiplier.

Return **ONLY** valid compact JSON matching this shape:

{
  "days": [
    {
      "day": "Monday",
      "meals": {
        "breakfast": {
          "label": "Oatmeal Breakfast",
          "items": ["150 grams cooked oats", "1 large banana", "30 grams whey protein", "1 cup milk (2%)"]
        },
        ...
      }
    }
  ]
}

Make sure each day's total calories/macros roughly sum to the targets above at any cost even if the sunday will be  missing .`;


      const clientRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: "json_object" }
        })
      });

      if (!clientRes.ok) {
        const errText = await clientRes.text();
        throw new Error(`Groq direct API error! status: ${clientRes.status}, detail: ${errText}`);
      }

      const clientData = await clientRes.json();
      const rawText = clientData?.choices?.[0]?.message?.content || '';
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      data = JSON.parse(cleaned);
    } else {
      throw err;
    }
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data.days.map((dayData) => {
    const meals = {};
    const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
    
    // Step 1: Resolve foods and calculate raw base macros for each meal
    const baseMeals = {};
    let totalBaseCalories = 0;

    mealKeys.forEach(key => {
      const grokMeal = dayData.meals[key];
      if (!grokMeal) {
        baseMeals[key] = { label: 'Empty Meal', foods: [], macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
        return;
      }

      const foods = [];
      let baseCalories = 0;
      let baseProtein = 0;
      let baseCarbs = 0;
      let baseFats = 0;

      const items = Array.isArray(grokMeal.items) ? grokMeal.items : [];
      items.forEach(item => {
        // Support both object format {name, quantity, calories, protein, carbs, fats} and plain string format
        const itemName = typeof item === 'string' ? item : (item.name || '');
        const itemQty = typeof item === 'string' ? 1 : (parseFloat(item.quantity) || 1);
        const itemCalories = typeof item === 'string' ? null : (item.calories || null);
        const itemProtein = typeof item === 'string' ? null : (item.protein || null);
        const itemCarbs = typeof item === 'string' ? null : (item.carbs || null);
        const itemFats = typeof item === 'string' ? null : (item.fats || null);

        if (!itemName) return;

        let dbFood = FOOD_DATABASE.find(f => f.name.toLowerCase() === itemName.toLowerCase() || f.id === itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        if (!dbFood) {
          dbFood = FOOD_DATABASE.find(f => itemName.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(itemName.toLowerCase()));
        }

        const qty = itemQty;
        if (!dbFood) {
          const customId = 'ai-' + itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          dbFood = FOOD_DATABASE.find(f => f.id === customId);
          if (!dbFood) {
            dbFood = {
              id: customId,
              name: itemName,
              calories: itemCalories !== null ? itemCalories : 100,
              protein: itemProtein !== null ? itemProtein : 5,
              carbs: itemCarbs !== null ? itemCarbs : 15,
              fats: itemFats !== null ? itemFats : 2,
              serving: '1 serving'
            };
            FOOD_DATABASE.push(dbFood);
          }
        }
        foods.push(dbFood.id, qty);
        
        baseCalories += (dbFood.calories || 0) * qty;
        baseProtein  += (dbFood.protein || 0) * qty;
        baseCarbs    += (dbFood.carbs || 0) * qty;
        baseFats     += (dbFood.fats || 0) * qty;
      });

      baseMeals[key] = {
        label: grokMeal.label || key.charAt(0).toUpperCase() + key.slice(1),
        foods: foods,
        macros: {
          calories: baseCalories,
          protein: baseProtein,
          carbs: baseCarbs,
          fats: baseFats
        }
      };

      totalBaseCalories += baseCalories;
    });

    // Step 2: Scale all quantities and macros to hit targetCal
    const scaleFactor = totalBaseCalories > 0 ? targetCal / totalBaseCalories : 1;

    mealKeys.forEach(key => {
      const meal = baseMeals[key];
      if (meal.foods.length === 0) {
        meals[key] = meal;
        return;
      }

      

      // Scale quantities
      const scaledFoods = [];
      for (let i = 0; i < meal.foods.length; i += 2) {
        const foodId = meal.foods[i];
        const baseQty = meal.foods[i + 1];
        scaledFoods.push(foodId, Math.max(0.1, Math.round(baseQty * scaleFactor * 10) / 10));
      }

      meals[key] = {
        label: meal.label,
        foods: meal.foods,
        macros: meal.macros
      };
    });

    const dayCal = Math.round(Object.values(meals).reduce((sum, m) => sum + (m.macros?.calories || 0), 0));
    const dayP = Math.round(Object.values(meals).reduce((sum, m) => sum + (m.macros?.protein || 0), 0));
    const dayC = Math.round(Object.values(meals).reduce((sum, m) => sum + (m.macros?.carbs || 0), 0));
    const dayF = Math.round(Object.values(meals).reduce((sum, m) => sum + (m.macros?.fats || 0), 0));

    return {
      day: dayData.day,
      meals,
      target: { calories: dayCal, protein: dayP, carbs: dayC, fats: dayF }
    };
  });
}

async function generateWeeklyDietPlan() {
  const profile = DB.get('calculatorProfile', null);
  const goals = DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 });

  if (!profile) {
    toast('⚠️ Please save your profile first.');
    navigate('calculator');
    return;
  }

  const targetCal = goals.calories || 2000;

  const genBtn = document.querySelector('#diet-modal .modal-body button[onclick*="generateWeeklyDietPlan"]');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '⏳ Generating...';
  }

  toast('🤖 Asking Grok for your diet plan...');

  try {
  let weekPlan = await generateDietPlanFromAI(targetCal, goals.protein || 150, goals.carbs || 200, goals.fats || 55, 7);

    // Scale quantities (1.5x)
    weekPlan = scaleUpDietPlan(weekPlan, targetCal);

    DB.set('weeklyDietPlan', weekPlan);
    renderDietPage(weekPlan);
    toast('✅ Grok generated your diet plan!');
  } catch (err) {
    console.error(err);
    toast('❌ Failed to generate plan', 'error');
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = '🔄 Generate';
    }
  }
}

async function editMealText(mealKey, element) {
  const currentText = element.textContent.trim();
  const newText = prompt(`Edit ${mealKey} (natural language, e.g. "300g Chicken Breast + 2 cups Rice")`, currentText);
  
  if (newText === null || newText === currentText) return;

  const plan = DB.get('weeklyDietPlan', null);
  const dayIndex = state.editingDietDayIndex;
  if (!plan || dayIndex == null) return;

  const day = plan[dayIndex];
  if (!day.meals[mealKey]) day.meals[mealKey] = { macros: {} };

  try {
    toast('🤖 Asking Grok to recalculate...');
    
    const res = await fetch('/api/recalc-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [newText] })
    });

    if (!res.ok) throw new Error('Failed');

    const result = await res.json();

    day.meals[mealKey].foodText = newText;
    day.meals[mealKey].macros = {
      calories: Math.round(result.calories || 0),
      protein: Math.round(result.protein || 0),
      carbs: Math.round(result.carbs || 0),
      fats: Math.round(result.fats || 0)
    };

    DB.set('weeklyDietPlan', plan);
    renderDietPage(plan);           // refresh main view
    renderDietDayEditModal();       // refresh edit modal if open
    toast('✅ Updated!');
  } catch (e) {
    console.error(e);
    toast('❌ Could not recalculate. Try again.', 'error');
  }
}
window.editMealText = editMealText;


// Updated renderDietPage - uses natural language
function renderDietPage(plan) {
  const container = document.getElementById('weekly-diet-grid');
  const summary = document.getElementById('diet-profile-summary');
  if (!container) return;

  if (!plan) plan = DB.get('weeklyDietPlan', null);

  // Summary (unchanged)
  if (summary) {
    const profile = DB.get('calculatorProfile', null);
    const goals = DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 });
    if (profile) {
      summary.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;">
          <span style="font-size:13px;color:var(--text2);">
            ${JBIcons.svg('user', { size: 16 })} ${profile.sex === 'male' ? 'Male' : 'Female'}, ${profile.age} yrs · ${profile.weight}kg · ${profile.height}cm
          </span>
          <span style="font-size:13px;color:var(--accent);">
            ${JBIcons.svg('target', { size: 16 })} ${goals.calories} kcal · ${goals.protein}g P · ${goals.carbs}g C · ${goals.fats}g F
          </span>
          <span style="font-size:12px;color:var(--text3);">${plan ? '✅ Plan ready' : '❌ No plan'}</span>
        </div>
      `;
    } else {
      summary.innerHTML = `<p class="muted-text">Go to Calculator to set profile first.</p>`;
    }
  }

  if (!plan || !plan.length) {
    container.innerHTML = `<div class="empty-state"><p>No diet plan yet. Tap Generate.</p></div>`;
    return;
  }

  container.innerHTML = plan.map((day, dayIdx) => {
    const meals = day.meals || {};
    const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
    const mealLabels = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack1: '🍎 Snack 1', snack2: '🍌 Snack 2' };

    const mealBlocks = mealKeys.map(key => {
      const meal = meals[key];
      if (!meal) return '';

      // NEW: Use natural language text if available
      let foodText = meal.foodText;
      if (!foodText) {
        // Fallback for old plans
        foodText = Array.isArray(meal.items) ? meal.items.join(' + ') : 'No foods listed';
      }

      const m = meal.macros || { calories: 0, protein: 0, carbs: 0, fats: 0 };

      return `
        <div class="meal-block ${key}">
          <span class="meal-label">${mealLabels[key]}</span>
          <span class="meal-foods" ondblclick="editMealText('${key}', this)" style="cursor:text;font-weight:500;">${foodText}</span>
          <span class="meal-macros">${m.calories} kcal · ${m.protein}g P · ${m.carbs}g C · ${m.fats}g F</span>
        </div>
      `;
    }).join('');

    const dayTotal = getDietDayTotals(meals);

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
          <button class="btn btn-sm btn-ghost" onclick="editDietDay(${dayIdx})">✏️ Edit</button>
        </div>
      </div>
    `;
  }).join('');
}



function scaleUpDietPlan(weekPlan, targetCal) {
  if (!weekPlan || !weekPlan.length) return weekPlan;

  return weekPlan.map(day => {
    const meals = day.meals || {};
    let dayTotal = 0;

    Object.keys(meals).forEach(key => {
      const meal = meals[key];
      if (meal && meal.macros) {
        dayTotal += meal.macros.calories || 0;
      }
    });

    if (dayTotal < targetCal * 0.8 && dayTotal > 0) {
      const scaleFactor = Math.max(1.5, targetCal / dayTotal);

      Object.keys(meals).forEach(key => {
        const meal = meals[key];
        if (!meal) return;

        if (meal.macros) {
          meal.macros.calories = Math.round(meal.macros.calories * scaleFactor);
          meal.macros.protein = Math.round(meal.macros.protein * scaleFactor * 10) / 10;
          meal.macros.carbs   = Math.round(meal.macros.carbs * scaleFactor * 10) / 10;
          meal.macros.fats    = Math.round(meal.macros.fats * scaleFactor * 10) / 10;
        }

        if (Array.isArray(meal.items)) {
          meal.items = meal.items.map(item => {
            return item.replace(/(\d+)\s*(grams?|g|cup|cups?|spoon|spoons?|slice|slices?)/gi, 
              (match, num, unit) => {
                const newNum = Math.round(parseInt(num) * scaleFactor);
                return newNum + ' ' + unit;
              });
          });
        }
      });
    }

    return day;
  });
}

function addDayToLog(dayIndex) {
  const plan = DB.get('weeklyDietPlan', null);
  if (!plan || !plan[dayIndex]) {
    toast('Plan not found');
    return;
  }

  const day = plan[dayIndex];
  const meals = day.meals;
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  const foodLog = getData().foodLog;
  const now = new Date().toISOString();

  mealKeys.forEach(key => {
    const meal = meals[key];
    if (!meal) return;
    for (let i = 0; i < meal.foods.length; i += 2) {
      const id = meal.foods[i];
      const qty = meal.foods[i + 1];
      const dbFood = FOOD_DATABASE.find(f => f.id === id);
      if (dbFood) {
        foodLog.push({
          id: 'food_' + Date.now() + '_' + Math.random(),
          name: dbFood.name,
          calories: dbFood.calories,
          protein: dbFood.protein || 0,
          carbs: dbFood.carbs || 0,
          fats: dbFood.fats || 0,
          serving: dbFood.serving || '1 serving',
          quantity: qty,
          date: now
        });
      }
    }
  });

  DB.set('foodLog', foodLog);
  renderCalorieTracker();
  toast(`✅ Added ${day.day}'s meals to today's log!`);
  if (getAuthUser()) syncUserDataToCloud();
}

async function regenerateDay(dayIndex) {
  const plan = DB.get('weeklyDietPlan', null);
  if (!plan || !plan[dayIndex]) return;

  const profile = DB.get('calculatorProfile', null);
  const goals = DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 });
  if (!profile) { toast('Profile missing'); return; }

  const targetCal = goals.calories || 2000;
  const targetP = goals.protein || 150;
  const targetC = goals.carbs || 200;
  const targetF = goals.fats || 55;

  const variation = 0.95 + (Math.random() * 0.1);
  const dayCal = Math.round(targetCal * variation);
  const dayP = Math.round(targetP * variation);
  const dayC = Math.round(targetC * variation);
  const dayF = Math.round(targetF * variation);

  toast('🔌 Connecting to Grok AI...');

  try {
    const dailyPlans = await generateDietPlanFromAI(dayCal, dayP, dayC, dayF, 1);
    if (dailyPlans && dailyPlans[0]) {
      plan[dayIndex].meals = dailyPlans[0].meals;
      plan[dayIndex].target = dailyPlans[0].target;
      
      DB.set('weeklyDietPlan', plan);
      renderDietPage(plan);
      toast(`✅ Connected! Grok regenerated ${plan[dayIndex].day}`);
      if (getAuthUser()) {
        setTimeout(() => syncUserDataToCloud(), 300);
      }
    } else {
      throw new Error('No plan returned from AI');
    }
  } catch (err) {
    console.error('[Regenerate Day Error]', err);
    toast('❌ Groq connection failed: ' + err.message);
  }
}

// New: Edit meal as free text → Grok recalculates

function getAllFoods() {
  return [...FOOD_DATABASE, ...(getData().customFoods || [])];
}

function calculateMacrosFromFoods(foods) {
  let total = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (let i = 0; i < foods.length; i += 2) {
    const id = foods[i];
    const qty = foods[i + 1];
    const dbFood = getAllFoods().find(f => f.id === id);
    if (dbFood) {
      total.calories += dbFood.calories * qty;
      total.protein  += (dbFood.protein || 0) * qty;
      total.carbs    += (dbFood.carbs || 0) * qty;
      total.fats     += (dbFood.fats || 0) * qty;
    }
  }
  return {
    calories: Math.round(total.calories),
    protein:  Math.round(total.protein * 10) / 10,
    carbs:    Math.round(total.carbs * 10) / 10,
    fats:     Math.round(total.fats * 10) / 10,
  };
}

function buildMealLabelFromFoods(foods) {
  const names = [];
  for (let i = 0; i < foods.length; i += 2) {
    const dbFood = getAllFoods().find(f => f.id === foods[i]);
    if (dbFood) names.push(dbFood.name);
  }
  return names.length ? names.join(' + ') : 'Empty meal';
}

function getDietDayTotals(meals) {
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  const total = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  mealKeys.forEach(key => {
    const m = meals[key]?.macros || {};
    total.calories += m.calories || 0;
    total.protein  += m.protein || 0;
    total.carbs    += m.carbs || 0;
    total.fats     += m.fats || 0;
  });
  return total;
}

function recalculateDietMeal(meal) {
  if (!meal) return;
  meal.macros = calculateMacrosFromFoods(meal.foods || []);
  meal.label = buildMealLabelFromFoods(meal.foods || []);
}

function editDietDay(dayIndex) {
  const plan = DB.get('weeklyDietPlan', null);
  if (!plan || !plan[dayIndex]) {
    toast('Plan not found');
    return;
  }
  state.editingDietDayIndex = dayIndex;
  state.dietDaySnapshot = JSON.stringify(plan[dayIndex]);
  const searchInput = document.getElementById('diet-food-search');
  if (searchInput) searchInput.value = '';
  renderDietDayEditModal();
  openModal('diet-day-modal');
}

function renderDietDayEditModal() {
  const dayIndex = state.editingDietDayIndex;
  const plan = DB.get('weeklyDietPlan', null);
  if (dayIndex == null || !plan || !plan[dayIndex]) return;

  const day = plan[dayIndex];
  const meals = day.meals || {};
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
  const mealLabels = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack1: '🍎 Snack 1', snack2: '🍌 Snack 2' };

  const titleEl = document.getElementById('diet-day-modal-title');
  if (titleEl) titleEl.textContent = `Edit ${day.day}`;

  const dayTotal = getDietDayTotals(meals);
  const totalsEl = document.getElementById('diet-day-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="diet-day-totals-inner">
        <span class="diet-day-totals-label">Day Total</span>
        <span class="diet-day-totals-values">
          🔥 ${Math.round(dayTotal.calories)} kcal ·
          💪 ${Math.round(dayTotal.protein)}g P ·
          🍚 ${Math.round(dayTotal.carbs)}g C ·
          🧈 ${Math.round(dayTotal.fats)}g F
        </span>
      </div>
    `;
  }

  const mealsEl = document.getElementById('diet-day-meals');
  if (mealsEl) {
    mealsEl.innerHTML = mealKeys.map(key => {
      const meal = meals[key] || { label: '', foods: [], macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
      const m = meal.macros || { calories: 0, protein: 0, carbs: 0, fats: 0 };
      const foodRows = [];
      for (let i = 0; i < (meal.foods || []).length; i += 2) {
        const foodId = meal.foods[i];
        const qty = meal.foods[i + 1];
        const foodIdx = i / 2;
        const dbFood = getAllFoods().find(f => f.id === foodId);
        if (!dbFood) continue;
        foodRows.push(`
          <div class="diet-food-row">
            <div class="diet-food-info">
              <span class="diet-food-name">${escHtml(dbFood.name)}</span>
              <span class="diet-food-serving">${escHtml(dbFood.serving || '1 serving')}</span>
            </div>
            <input type="number" class="form-input diet-qty-input" value="${qty}" step="0.1" min="0.1"
              inputmode="decimal" onchange="updateDietFoodQuantity('${key}', ${foodIdx}, this.value)" />
            <button class="icon-btn-small" onclick="removeDietFoodFromMeal('${key}', ${foodIdx})" title="Remove">✕</button>
          </div>
        `);
      }
      return `
        <div class="diet-meal-section">
          <div class="diet-meal-header">
            <span class="diet-meal-title">${mealLabels[key]}</span>
            <span class="diet-meal-macros">${m.calories} kcal · ${m.protein}g P · ${m.carbs}g C · ${m.fats}g F</span>
          </div>
          <div class="diet-food-list">
            ${foodRows.length ? foodRows.join('') : '<p class="muted-text diet-empty-meal">No foods yet — search below to add.</p>'}
          </div>
        </div>
      `;
    }).join('');
  }

  filterDietFoodList();
}

function filterDietFoodList() {
  const searchTerm = document.getElementById('diet-food-search')?.value.toLowerCase() || '';
  const filtered = getAllFoods().filter(food => food.name.toLowerCase().includes(searchTerm));
  const resultsDiv = document.getElementById('diet-food-search-results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = filtered.slice(0, 30).map(food => `
    <div class="food-search-item" onclick="addFoodToDietMeal('${food.id.replace(/'/g, "\\'")}')">
      <div>
        <div class="food-search-name">${escHtml(food.name)}</div>
        <div class="food-search-serving">${escHtml(food.serving || '1 serving')}</div>
      </div>
      <div class="food-search-calories">${food.calories} kcal</div>
    </div>
  `).join('');
}

function updateDietFoodQuantity(mealKey, foodIndex, newQty) {
  const plan = DB.get('weeklyDietPlan', null);
  const day = plan?.[state.editingDietDayIndex];
  if (!day?.meals?.[mealKey]) return;
  const qty = Math.max(0.1, parseFloat(newQty) || 0.1);
  const qtyIdx = foodIndex * 2 + 1;
  day.meals[mealKey].foods[qtyIdx] = Math.round(qty * 10) / 10;
  recalculateDietMeal(day.meals[mealKey]);
  DB.set('weeklyDietPlan', plan);
  renderDietDayEditModal();
}

function removeDietFoodFromMeal(mealKey, foodIndex) {
  const plan = DB.get('weeklyDietPlan', null);
  const day = plan?.[state.editingDietDayIndex];
  if (!day?.meals?.[mealKey]) return;
  day.meals[mealKey].foods.splice(foodIndex * 2, 2);
  recalculateDietMeal(day.meals[mealKey]);
  DB.set('weeklyDietPlan', plan);
  renderDietDayEditModal();
}

function addFoodToDietMeal(foodId) {
  const plan = DB.get('weeklyDietPlan', null);
  const day = plan?.[state.editingDietDayIndex];
  if (!day) return;
  const mealKey = document.getElementById('diet-add-meal-select')?.value || 'breakfast';
  if (!day.meals[mealKey]) {
    day.meals[mealKey] = { label: '', foods: [], macros: { calories: 0, protein: 0, carbs: 0, fats: 0 } };
  }
  const dbFood = getAllFoods().find(f => f.id === foodId);
  if (!dbFood) return;
  day.meals[mealKey].foods.push(foodId, 1);
  recalculateDietMeal(day.meals[mealKey]);
  DB.set('weeklyDietPlan', plan);
  renderDietDayEditModal();
  toast(`Added ${dbFood.name}`);
}

async function regenerateEditingDietDay() {
  const dayIndex = state.editingDietDayIndex;
  const plan = DB.get('weeklyDietPlan', null);
  if (dayIndex == null || !plan || !plan[dayIndex]) return;

  const profile = DB.get('calculatorProfile', null);
  const goals = DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 });
  if (!profile) { toast('Profile missing'); return; }

  const targetCal = goals.calories || 2000;
  const targetP = goals.protein || 150;
  const targetC = goals.carbs || 200;
  const targetF = goals.fats || 55;
  const variation = 0.95 + (Math.random() * 0.1);
  const dayCal = Math.round(targetCal * variation);
  const dayP = Math.round(targetP * variation);
  const dayC = Math.round(targetC * variation);
  const dayF = Math.round(targetF * variation);

  toast('🔌 Connecting to Grok AI...');

  try {
    const dailyPlans = await generateDietPlanFromAI(dayCal, dayP, dayC, dayF, 1);
    if (dailyPlans && dailyPlans[0]) {
      plan[dayIndex].meals = dailyPlans[0].meals;
      plan[dayIndex].target = dailyPlans[0].target;
      
      DB.set('weeklyDietPlan', plan);
      renderDietDayEditModal();
      toast(`✅ Connected! Grok regenerated ${plan[dayIndex].day}`);
    } else {
      throw new Error('No plan returned from AI');
    }
  } catch (err) {
    console.error('[Regenerate Day Error]', err);
    toast('❌ Groq connection failed: ' + err.message);
  }
}

function saveDietDayEdit() {
  const plan = DB.get('weeklyDietPlan', null);
  if (state.editingDietDayIndex == null || !plan) return;
  const dayName = plan[state.editingDietDayIndex].day;
  DB.set('weeklyDietPlan', plan);
  renderDietPage(plan);
  closeModal('diet-day-modal');
  state.editingDietDayIndex = null;
  state.dietDaySnapshot = null;
  toast(`✅ Saved ${dayName}`);
  if (getAuthUser()) setTimeout(() => syncUserDataToCloud(), 300);
}

function cancelDietDayEdit() {
  if (state.dietDaySnapshot != null && state.editingDietDayIndex != null) {
    const plan = DB.get('weeklyDietPlan', null);
    if (plan) {
      plan[state.editingDietDayIndex] = JSON.parse(state.dietDaySnapshot);
      DB.set('weeklyDietPlan', plan);
      renderDietPage(plan);
    }
  }
  closeModal('diet-day-modal');
  state.editingDietDayIndex = null;
  state.dietDaySnapshot = null;
}

// ─── State ────────────────────────────────────────────────
let state = {
  currentPage: 'home',
  muscleFilter: 'All',
  editingWorkoutId: null,
  activeSession: null,
  restTimer: null,
  chart: null,
  editingScheduleDay: null,
  editingScheduleWorkoutIndex: null,
  editingDietDayIndex: null,
  dietDaySnapshot: null,
  scheduledSession: null,
  scheduledCurrentIndex: null,
  selectedFoodId: null,
  scannedFood: null,
  foodScanner: null,
  foodScannerActive: false,
  activeQueueIndex: null,
  lastCalculation: null,
  weightUnit: DB.get('weightUnit', 'kg') || 'kg'
};

// ─── Helper Functions ────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Lightweight count-up for stat numbers ─────────────────
// Uses requestAnimationFrame — zero layout cost, compositor only
function countUp(el, target, duration = 600, suffix = '') {
  if (!el) return;
  const isFloat = String(target).includes('.');
  const start = performance.now();
  const from = 0;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    const val = from + (target - from) * eased;
    el.textContent = isFloat ? val.toFixed(1) + suffix : Math.round(val) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime12(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatKg(weight) {
  const n = Number(weight) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

let _cachedAllExercises = null;
function getAllExercises() {
  if (!_cachedAllExercises) {
    _cachedAllExercises = [...EXERCISE_LIBRARY, ...(getData().customWorkouts || [])];
  }
  return _cachedAllExercises;
}
// Invalidate when custom workouts change:
function invalidateExerciseCache() {
  _cachedAllExercises = null;
}
// Call invalidateExerciseCache() after saving/deleting custom workouts.

let autocompleteSelectedIndex = -1;

const updateAutocomplete = debounce(function() {
  const input = document.getElementById('exercise-search');
  const list = document.getElementById('autocomplete-list');
  const query = input.value.toLowerCase().trim();

  if (!query || query.length < 1) {
    list.style.display = 'none';
    filterExercises('');
    return;
  }

  const allEx = getAllExercises();
  const matches = allEx.filter(ex =>
    ex.name.toLowerCase().includes(query) ||
    (ex.muscle && ex.muscle.toLowerCase().includes(query))
  ).slice(0, 8); // Reduced from 10 to 8

  if (matches.length === 0) {
    list.style.display = 'none';
    filterExercises(query);
    return;
  }

  list.innerHTML = matches.map((ex, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-id="${ex.id}">
      <span class="item-name">${highlightMatch(ex.name, query)}</span>
      <span class="item-muscle">${ex.muscle || 'General'}</span>
    </div>
  `).join('');

  list.style.display = 'block';
  autocompleteSelectedIndex = -1;

  list.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('click', function() {
      const id = this.dataset.id;
      const allEx2 = getAllExercises();
      const selected = allEx2.find(e => e.id === id);
      if (selected) {
        input.value = selected.name;
        list.style.display = 'none';
        filterExercises(selected.name);
        input.focus();
      }
    });
  });

  filterExercises(query);
}, 180);

// Helper to bold matched text
function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) +
         `<strong style="color:var(--accent);">${text.slice(idx, idx + query.length)}</strong>` +
         text.slice(idx + query.length);
}


// ─── Keyboard navigation for autocomplete ───
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('exercise-search');
  const list = document.getElementById('autocomplete-list');

  if (input) {
    // Debounce autocomplete: fire only after 150ms pause in typing
    const _debouncedAutocomplete = debounce(updateAutocomplete, 150);
    input.addEventListener('input', _debouncedAutocomplete);

    input.addEventListener('keydown', function(e) {
      const items = list.querySelectorAll('.autocomplete-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, items.length - 1);
        updateAutocompleteActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, -1);
        updateAutocompleteActive(items);
      } else if (e.key === 'Enter') {
        if (autocompleteSelectedIndex >= 0 && autocompleteSelectedIndex < items.length) {
          items[autocompleteSelectedIndex].click();
        } else if (items.length > 0) {
          // If nothing selected, choose the first one
          items[0].click();
        }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        list.style.display = 'none';
        input.blur();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-wrap')) {
        list.style.display = 'none';
      }
    });

    // On focus, show suggestions if there's a value
    input.addEventListener('focus', function() {
      if (this.value.trim().length > 0) {
        updateAutocomplete();
      }
    });
  }
  const clearBtn = document.getElementById('search-clear-btn');
if (clearBtn && input) {
  input.addEventListener('input', function() {
    clearBtn.style.display = this.value.length > 0 ? 'block' : 'none';
  });
  clearBtn.addEventListener('click', function() {
    input.value = '';
    input.focus();
    updateAutocomplete();
    clearBtn.style.display = 'none';
  });
}

// ══════════════════════════════════════════
// ONBOARDING TOUR
// ══════════════════════════════════════════



// ─── Spotlight pulse animation ───
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spotlightPulse {
    0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 2px var(--accent); }
    50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 4px var(--accent), 0 0 20px rgba(0,229,160,0.3); }
  }
`;
document.head.appendChild(styleSheet);

// ─── Auto-start on load ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Ensure other inits run first, then start tour
  setTimeout(() => {
    TourManager.init();
  }, 800);
});

});



function updateAutocompleteActive(items) {
  items.forEach((el, idx) => {
    el.classList.toggle('active', idx === autocompleteSelectedIndex);
  });
}

function setSessionSaveMode(mode) {
  const btn = document.getElementById('session-save-btn');
  if (!btn) return;
  btn.textContent = mode === 'queue' ? 'Save Exercise' : 'Save Session';
  btn.onclick = mode === 'queue' ? saveQueuedExercise : saveSession;
}

function getWeekStart() {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString();
}

function openModal(id) { 
  document.getElementById(id).classList.add('open');
  if (typeof SoundManager !== 'undefined') SoundManager.modalOpen();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'split-modal') {
    const splitOverlay = document.getElementById('split-modal');
    if (splitOverlay) splitOverlay.style.zIndex = '';
    const editModal = document.getElementById('edit-profile-modal');
    if (editModal?.classList.contains('open') && editingProfileId) {
      populateEditProfileModal(editingProfileId);
    }
  }
}

// ─── Exercise View Modal ──────────────────────────────────

// Image cache: url → HTMLImageElement (already loaded)
const _evmImageCache = {};

function _preloadImage(url) {
  return new Promise((resolve) => {
    if (_evmImageCache[url]) { resolve(_evmImageCache[url]); return; }
    const img = new Image();
    img.onload = () => { _evmImageCache[url] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function startAnimationViewer(images, intervalMs = 800) {
  stopAnimationViewer();
  const frameA = document.getElementById('evm-frame-a');
  const frameB = document.getElementById('evm-frame-b');
  const placeholder = document.getElementById('evm-placeholder');
  if (!frameA || !frameB) return;

  // Hide frames, show loading state
  frameA.style.display = 'none';
  frameB.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.innerHTML = '<span class="evm-spinner"></span>';

  // Preload both images first
  Promise.all([_preloadImage(images[0]), _preloadImage(images[1])]).then(() => {
    placeholder.style.display = 'none';
    frameA.style.display = 'block';
    frameB.style.display = 'block';
    frameA.src = images[0];
    frameB.src = images[1];
    frameA.style.opacity = '1';
    frameB.style.opacity = '0';
    _evmFrameIdx = 0;
    _evmInterval = setInterval(() => {
      if (_evmFrameIdx === 0) {
        frameA.style.opacity = '0';
        frameB.style.opacity = '1';
        _evmFrameIdx = 1;
      } else {
        frameA.style.opacity = '1';
        frameB.style.opacity = '0';
        _evmFrameIdx = 0;
      }
    }, intervalMs);
  });
}

function stopAnimationViewer() {
  if (_evmInterval) {
    clearInterval(_evmInterval);
    _evmInterval = null;
  }
}

function openExerciseViewModal(exerciseId) {
  // Search built-in library + custom workouts
  const allExercises = [
    ...(typeof EXERCISE_LIBRARY !== 'undefined' ? EXERCISE_LIBRARY : []),
    ...(JSON.parse(localStorage.getItem('customWorkouts') || '[]'))
  ];
  const ex = allExercises.find(e => e.id === exerciseId);
  if (!ex) { showToast('Exercise not found'); return; }

  // Title
  document.getElementById('evm-title').textContent = ex.name || 'Exercise';

  // Description
  const descEl = document.getElementById('evm-description');
  descEl.textContent = ex.description || '';
  descEl.style.display = ex.description ? 'block' : 'none';

  // Equipment
  const eqSec = document.getElementById('evm-equipment-section');
  const eqEl = document.getElementById('evm-equipment');
  if (ex.equipment) {
    eqEl.textContent = ex.equipment;
    eqSec.style.display = 'block';
  } else {
    eqSec.style.display = 'none';
  }

  // Notes
  const notesSec = document.getElementById('evm-notes-section');
  const notesEl = document.getElementById('evm-notes');
  if (ex.equipmentNotes) {
    notesEl.textContent = ex.equipmentNotes;
    notesSec.style.display = 'block';
  } else {
    notesSec.style.display = 'none';
  }

  // Instructions
  const instrSec = document.getElementById('evm-instructions-section');
  const instrEl = document.getElementById('evm-instructions');
  if (ex.instructions && ex.instructions.length > 0) {
    instrEl.innerHTML = ex.instructions.map(step => `<li>${step}</li>`).join('');
    instrSec.style.display = 'block';
  } else {
    instrSec.style.display = 'none';
  }

  // Animation viewer
  const placeholder = document.getElementById('evm-placeholder');
  const frameA = document.getElementById('evm-frame-a');
  const frameB = document.getElementById('evm-frame-b');

  if (ex.images && ex.images.length >= 2) {
    placeholder.style.display = 'none';
    frameA.style.display = 'block';
    frameB.style.display = 'block';
    startAnimationViewer(ex.images);
  } else {
    frameA.style.display = 'none';
    frameB.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<span>🏋️</span><p>No preview available</p>';
    stopAnimationViewer();
  }

  // Set Add to Queue button click handler
  const addBtn = document.getElementById('evm-add-queue-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      addToWorkoutQueue(ex.id, ex.name);
      closeExerciseViewModal();
    };
  }

  openModal('exercise-view-modal');
}

function closeExerciseViewModal() {
  stopAnimationViewer();
  closeModal('exercise-view-modal');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Data Access ─────────────────────────────────────────
function getData() {
  return {
    customWorkouts: DB.get('customWorkouts', []),
    sessions: DB.get('sessions', []),
    weeklyGoals: DB.get('weeklyGoals', []),
    waterLog: DB.get('waterLog', []),
    weightLog: DB.get('weightLog', []),
    weightLossGoal: DB.get('weightLossGoal', null),
    cardioLog: DB.get('cardioLog', []),
    cardioGoal: DB.get('cardioGoal', null),
    settings: DB.get('settings', { waterGoal: 2000 }),
    prs: DB.get('prs', {}),
    weeklySchedule: DB.get('weeklySchedule', { days: {} }),
    foodLog: DB.get('foodLog', []),
    calorieGoals: DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 }),
    customFoods: DB.get('customFoods', [])
  };
}

// ─── Gymbros (Friends) ────────────────────────────────

function getGymbros() {
  return DB.get('gymbros', []);
}

function saveGymbros(list) {
  DB.set('gymbros', list);
}

function addGymbro() {
  const input = document.getElementById('gymbro-username-input');
  if (input) {
    const username = input.value.trim();
    if (username) {
      handleAddFriend(username);
    } else {
      toast('Please enter a username');
    }
  }
}

function removeGymbro(username) {
  // Handled via Supabase database relations
}

function viewGymbroProfile(username) {
  const nameEl = document.getElementById('gymbro-profile-name');
  const bodyEl = document.getElementById('gymbro-profile-body');
  if (nameEl) nameEl.textContent = `${username}`;
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;">${JBIcons.svg('dumbbell', { size: 48 })}</div>
        <h4 style="margin:12px 0 4px;">${username}</h4>
        <p class="muted-text">Active Gymbro</p>
      </div>
    `;
  }
  openModal('gymbro-profile-modal');
}

function renderGymbros() {
  renderGymbrosSocial();
}

// ═══════════════════════════════════════════════════════════
// NEW: 1 REP MAX CALCULATOR & PR RECORDER
// ═══════════════════════════════════════════════════════════

function calculate1RM(weight, reps) {
  if (!weight || reps < 1) return 0;
  // Epley formula: 1RM = weight * (1 + reps/30)
  return Math.round(weight * (1 + reps / 30));
}

function openRMModal() {
  document.getElementById('rm-exercise-name').value = '';
  document.getElementById('rm-weight').value = '';
  document.getElementById('rm-reps').value = '';
  document.getElementById('rm-result').innerHTML = '';
  openModal('rm-modal');
}

function calculateAndSavePR() {
  const exerciseName = document.getElementById('rm-exercise-name').value.trim();
  const weight = parseFloat(document.getElementById('rm-weight').value);
  const reps = parseInt(document.getElementById('rm-reps').value);
  
  if (!exerciseName) {
    toast('Please enter an exercise name');
    return;
  }
  if (!weight || weight <= 0) {
    toast('Please enter a valid weight');
    return;
  }
  if (!reps || reps < 1 || reps > 10) {
    toast('Please enter valid reps (1-10)');
    return;
  }
  
  const oneRM = calculate1RM(weight, reps);
  const prs = getData().prs;
  const exerciseId = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const existing = prs[exerciseId];
  
  const resultDiv = document.getElementById('rm-result');
  
  if (!existing || oneRM > existing.weight) {
    resultDiv.innerHTML = `
      <div style="background:var(--accent-dim); padding:16px; border-radius:12px; text-align:center;">
        <div style="font-size:32px; font-weight:900; color:var(--accent);">${oneRM} kg</div>
        <div style="font-size:12px; color:var(--text2); margin:8px 0;">Estimated 1 Rep Max</div>
        <button class="btn btn-primary" style="margin-top:8px;" onclick="savePRToRecords('${exerciseName.replace(/'/g, "\\'")}', ${oneRM})">${JBIcons.svg('trophy', { size: 16 })} Save as Personal Record</button>
      </div>
    `;
  } else {
    resultDiv.innerHTML = `
      <div style="background:rgba(255,71,87,0.15); padding:16px; border-radius:12px; text-align:center;">
        <div style="font-size:14px; color:var(--danger);">Current PR for ${exerciseName} is ${existing.weight} kg</div>
        <div style="font-size:18px; margin:8px 0;">Estimated 1RM: ${oneRM} kg</div>
        <div style="font-size:12px; color:var(--text2);">You need ${oneRM > existing.weight ? (oneRM - existing.weight).toFixed(1) : (existing.weight - oneRM).toFixed(1)} kg to beat your PR!</div>
      </div>
    `;
  }
}

function savePRToRecords(exerciseName, oneRM) {
  const prs = getData().prs;
  const exerciseId = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  prs[exerciseId] = {
    name: exerciseName,
    weight: oneRM,
    date: new Date().toISOString(),
    oneRM: true
  };
  
  DB.set('prs', prs);
  toast(`🏆 New PR for ${exerciseName}: ${oneRM}kg!`);
  closeModal('rm-modal');
  renderPRLists();
  renderDashboard();
}

function renderPRLists() {
  const prs = getData().prs;
  const entries = Object.values(prs).sort((a, b) => b.weight - a.weight);
  
  // Workout page PR list
  const workoutContainer = document.getElementById('pr-list-workout');
  if (workoutContainer) {
    if (entries.length === 0) {
      workoutContainer.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text2);">No PRs yet. Complete workouts or use 1RM calculator!</div>';
    } else {
      workoutContainer.innerHTML = entries.slice(0, 8).map(pr => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--card-border);">
          <div>
            <span style="font-weight:700;">${JBIcons.svg('trophy', { size: 16 })} ${escHtml(pr.name)}</span>
            ${pr.oneRM ? '<span style="font-size:9px; background:var(--accent-dim); padding:2px 6px; border-radius:10px; margin-left:6px;">1RM</span>' : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px; font-weight:800; color:var(--accent);">${pr.weight} kg</span>
            <button class="btn btn-sm btn-ghost" style="padding:4px 8px; font-size:10px;" onclick="editPR('${pr.name.replace(/'/g, "\\'")}', ${pr.weight})">${JBIcons.svg('pencil', { size: 14, color: 'var(--accent)' })}</button>
          </div>
        </div>
      `).join('');
    }
  }
  
  // Home page PR list (under weight goal)
  const homeContainer = document.getElementById('home-pr-list');
  if (homeContainer) {
    if (entries.length === 0) {
      homeContainer.innerHTML = '<p class="muted-text" style="text-align:center;">No PRs yet. Complete workouts or use 1RM calculator!</p>';
    } else {
      homeContainer.innerHTML = entries.slice(0, 5).map(pr => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--card-border);">
          <span style="font-size:13px; font-weight:500;">${JBIcons.svg('trophy', { size: 16 })} ${escHtml(pr.name)}</span>
          <span style="font-size:15px; font-weight:800; color:var(--accent);">${pr.weight} kg</span>
        </div>
      `).join('');
    }
  }
  
  // Progress page PR list
  const progressContainer = document.getElementById('prs-list');
  if (progressContainer && entries.length > 0) {
    progressContainer.innerHTML = entries.map(pr => `
      <div class="pr-card">
        <div>
          <div class="pr-name">${escHtml(pr.name)} ${pr.oneRM ? '<span style="font-size:10px;">(1RM)</span>' : ''}</div>
          <div class="pr-date">${formatDate(pr.date)}</div>
        </div>
        <div class="pr-weight">${pr.weight}kg</div>
      </div>
    `).join('');
  }
}

function editPR(exerciseName, currentWeight) {
  const newWeight = prompt(`Edit PR for ${exerciseName}\nCurrent PR: ${currentWeight}kg\nEnter new weight (kg):`, currentWeight);
  if (newWeight === null) return;
  const weightNum = parseFloat(newWeight);
  if (isNaN(weightNum) || weightNum <= 0) {
    toast('Invalid weight');
    return;
  }
  
  const prs = getData().prs;
  const exerciseId = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (prs[exerciseId]) {
    prs[exerciseId].weight = weightNum;
    prs[exerciseId].date = new Date().toISOString();
    DB.set('prs', prs);
    toast(`Updated PR for ${exerciseName}: ${weightNum}kg`);
    renderPRLists();
    renderDashboard();
  }
}

// ─── Calorie Tracker Functions ───────────────────────────
function getExerciseSessionHistory(exercise) {
  const sessions = getData().sessions || [];
  const id = exercise?.id;
  const name = (exercise?.name || '').toLowerCase();

  return sessions
    .flatMap(session => (session.exercises || []).map(ex => ({ session, ex })))
    .filter(({ ex }) => {
      const exName = (ex.name || '').toLowerCase();
      return (id && ex.id === id) || (name && exName === name);
    })
    .map(({ session, ex }) => {
      const doneSets = (ex.sets || []).filter(set => set.done && ((set.reps || 0) > 0 || (set.weight || 0) > 0));
      if (!doneSets.length) return null;
      const bestSet = doneSets.reduce((best, set) => {
        const setWeight = Number(set.weight) || 0;
        const bestWeight = Number(best.weight) || 0;
        if (setWeight !== bestWeight) return setWeight > bestWeight ? set : best;
        return (Number(set.reps) || 0) > (Number(best.reps) || 0) ? set : best;
      }, doneSets[0]);
      return {
        date: session.date,
        set: {
          weight: Number(bestSet.weight) || 0,
          reps: Number(bestSet.reps) || 0
        }
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getProgressionSuggestion(exercise) {
  if (!exercise || exercise.isCardio) return null;
  const history = getExerciseSessionHistory(exercise);
  if (!history.length) return null;

  const targetReps = Number(exercise.reps) || 10;
  const recent = history.slice(0, 3);
  const last = recent[0].set;
  const consistentHits = recent.length >= 2 && recent.slice(0, 2).every(item => (item.set.reps || 0) >= targetReps);
  const lastText = last.weight > 0
    ? `Last time: ${formatKg(last.weight)}kg × ${last.reps} reps`
    : `Last time: bodyweight × ${last.reps} reps`;

  if (consistentHits) {
    if (last.weight > 0) {
      const jump = last.weight >= 40 ? 2.5 : 1;
      return `${lastText} → Try ${formatKg(last.weight + jump)}kg today.`;
    }
    return `${lastText} → Try ${last.reps + 2} reps today.`;
  }

  if (last.reps < targetReps) return `${lastText} → Aim for ${targetReps} reps.`;
  if (last.weight > 0) return `${lastText} → Repeat it clean today.`;
  return `${lastText} → Match it today.`;
}

function progressionHintHTML(exercise) {
  const hint = getProgressionSuggestion(exercise);
  return hint ? `<div class="progression-hint">${escHtml(hint)}</div>` : '';
}

function getTodayFoodLog() {
  const { foodLog } = getData();
  const today = new Date().toISOString().split('T')[0];
  return foodLog.filter(item => item.date.startsWith(today));
}

function getDailyTotals() {
  const todayLog = getTodayFoodLog();
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  todayLog.forEach(item => {
    totals.calories += item.calories * item.quantity;
    totals.protein += (item.protein || 0) * item.quantity;
    totals.carbs += (item.carbs || 0) * item.quantity;
    totals.fats += (item.fats || 0) * item.quantity;
  });
  return totals;
}

// ══════════════════════════════════════════
// AI FOOD SCANNER (Gemini Vision proxy)
// ══════════════════════════════════════════

let _foodScanImageBase64 = null;
let _foodScanMimeType    = 'image/jpeg';

function onFoodScanImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  _foodScanMimeType = file.type || 'image/jpeg';

  const reader = new FileReader();
  reader.onload = (e) => {
    _foodScanImageBase64 = e.target.result.split(',')[1]; // strip data URI prefix

    // Show preview
    const preview = document.getElementById('food-scan-preview');
    const previewWrap = document.getElementById('food-scanner-preview-wrap');
    const placeholder = document.getElementById('food-scanner-placeholder');
    const scanBtn = document.getElementById('food-scan-btn');
    const resultEl = document.getElementById('food-scan-result');

    if (preview) preview.src = e.target.result;
    if (previewWrap) previewWrap.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (scanBtn) scanBtn.style.display = 'block';
    if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
  };
  reader.readAsDataURL(file);
}
window.onFoodScanImageSelected = onFoodScanImageSelected;

function clearFoodScan() {
  _foodScanImageBase64 = null;
  const previewWrap = document.getElementById('food-scanner-preview-wrap');
  const placeholder = document.getElementById('food-scanner-placeholder');
  const scanBtn     = document.getElementById('food-scan-btn');
  const resultEl    = document.getElementById('food-scan-result');
  const input       = document.getElementById('food-scan-input');
  if (previewWrap) previewWrap.style.display = 'none';
  if (placeholder) placeholder.style.display = '';
  if (scanBtn)     scanBtn.style.display = 'none';
  if (resultEl)    { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
  if (input)       input.value = '';
}
window.clearFoodScan = clearFoodScan;

async function runFoodScan() {
  if (!_foodScanImageBase64) { toast('Please select a photo first'); return; }

  const loadingEl = document.getElementById('food-scan-loading');
  const resultEl  = document.getElementById('food-scan-result');
  const scanBtn   = document.getElementById('food-scan-btn');

  if (loadingEl) loadingEl.style.display = 'block';
  if (scanBtn)   scanBtn.disabled = true;
  if (resultEl)  { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }

  try {
    const res = await fetch('/api/scan-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: _foodScanImageBase64, mimeType: _foodScanMimeType })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Scan failed: ' + res.status);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderFoodScanResult(data);
  } catch (err) {
    console.error('[FoodScan]', err);
    toast('Could not analyse photo. Try again.');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div class="food-scan-error">⚠️ ${escHtml(err.message)}</div>`;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (scanBtn)   scanBtn.disabled = false;
  }
}
window.runFoodScan = runFoodScan;

function renderFoodScanResult(data) {
  const resultEl = document.getElementById('food-scan-result');
  if (!resultEl) return;

  const confidenceColor = data.confidence === 'high' ? 'var(--accent)' : data.confidence === 'medium' ? 'var(--warn)' : 'var(--danger)';

  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="food-scan-result-card">
      <div class="food-scan-result-header">
        <div class="food-scan-result-name">${escHtml(data.name || 'Unknown Food')}</div>
        ${data.confidence ? `<span class="food-scan-confidence" style="color:${confidenceColor}">${data.confidence} confidence</span>` : ''}
      </div>
      ${data.servingSize ? `<div class="food-scan-serving">Serving: ${escHtml(data.servingSize)}</div>` : ''}
      <div class="food-scan-macros">
        <div class="food-scan-macro">
          <span class="food-scan-macro-val" style="color:var(--warn)">${data.calories ?? '—'}</span>
          <span class="food-scan-macro-label">kcal</span>
        </div>
        <div class="food-scan-macro">
          <span class="food-scan-macro-val" style="color:var(--accent)">${data.protein ?? '—'}g</span>
          <span class="food-scan-macro-label">Protein</span>
        </div>
        <div class="food-scan-macro">
          <span class="food-scan-macro-val" style="color:#00b4d8">${data.carbs ?? '—'}g</span>
          <span class="food-scan-macro-label">Carbs</span>
        </div>
        <div class="food-scan-macro">
          <span class="food-scan-macro-val" style="color:#ff6b9d">${data.fats ?? '—'}g</span>
          <span class="food-scan-macro-label">Fats</span>
        </div>
        ${data.fiber != null ? `<div class="food-scan-macro">
          <span class="food-scan-macro-val" style="color:var(--text2)">${data.fiber}g</span>
          <span class="food-scan-macro-label">Fiber</span>
        </div>` : ''}
      </div>
      ${data.notes ? `<div class="food-scan-notes">${escHtml(data.notes)}</div>` : ''}
      <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="logFoodScanResult(${JSON.stringify(data).replace(/"/g, '&quot;')})">
        + Log to Today
      </button>
    </div>`;
}

function logFoodScanResult(data) {
  // Add to food log using the existing system
  const foodLog = DB.get('foodLog', []);
  const entry = {
    id: 'scan_' + Date.now(),
    name: data.name || 'Scanned Food',
    calories: Math.round(data.calories || 0),
    protein:  Math.round((data.protein  || 0) * 10) / 10,
    carbs:    Math.round((data.carbs    || 0) * 10) / 10,
    fats:     Math.round((data.fats     || 0) * 10) / 10,
    quantity: 1,
    unit: 'serving',
    date: new Date().toISOString(),
    source: 'ai-scan'
  };
  foodLog.push(entry);
  DB.set('foodLog', foodLog);
  renderCalorieTracker();
  toast(`✅ Logged: ${entry.name}`);
  clearFoodScan();
  _debouncedSyncToCloud();
}
window.logFoodScanResult = logFoodScanResult;

// ══════════════════════════════════════════
// END AI FOOD SCANNER
// ══════════════════════════════════════════

function renderCalorieTracker() {
  const { calorieGoals, customFoods, cardioLog } = getData();
  const totals = getDailyTotals();
  const todayLog = getTodayFoodLog();
  const burntToday = getTodayBurntCalories(cardioLog);
  const netCalories = Math.max(0, Math.round(totals.calories) - burntToday);
  const goalCal = calorieGoals?.calories || 2000;

  // ── Net / Eaten / Burnt elements ─────────────────────────────────
  const calNetEl    = document.getElementById('calorie-net');
  const calEatenEl  = document.getElementById('calorie-eaten');
  const calBurntEl  = document.getElementById('calorie-burnt');
  const calTotalEl  = document.getElementById('calorie-total'); // legacy support
  if (calNetEl)   calNetEl.textContent   = netCalories;
  if (calTotalEl) calTotalEl.textContent = netCalories; // keep legacy id working
  if (calEatenEl) calEatenEl.textContent = `${Math.round(totals.calories)} kcal`;
  if (calBurntEl) calBurntEl.textContent = `-${burntToday} kcal`;

  // ── Goal & progress ring ─────────────────────────────────────────
  const goalTextEl = document.getElementById('calorie-goal-text');
  if (goalTextEl) goalTextEl.textContent = goalCal;
  const percent  = Math.min(100, (netCalories / goalCal) * 100);
  const goalHitC = netCalories >= goalCal;
  
  // Circumference of radius 52 circle = 2 * PI * 52 = 326.73
  const ringFill = document.getElementById('calorie-ring-fill');
  if (ringFill) {
    const offset = 326.73 - (326.73 * (percent / 100));
    ringFill.style.strokeDashoffset = offset;
    ringFill.classList.toggle('goal-reached', goalHitC);
  }

  // ── Calorie card glow ─────────────────────────────────────────
  const summaryCard = document.querySelector('.calorie-summary-card');
  if (summaryCard) summaryCard.classList.toggle('goal-reached', goalHitC);

  // ── Play fanfare once per goal crossing ───────────────────────
  const todayKeyC  = new Date().toISOString().split('T')[0];
  const celebKeyC  = `jimbuddy_cal_goal_celebrated_${todayKeyC}`;
  if (goalHitC && !sessionStorage.getItem(celebKeyC)) {
    sessionStorage.setItem(celebKeyC, '1');
    if (typeof SoundManager !== 'undefined' && SoundManager.goalReached) {
      setTimeout(() => SoundManager.goalReached(), 120);
    }
    setTimeout(() => toast('🎉 Calorie goal reached! Well done!'), 200);
  }
  
  // ── Macros ──────────────────────────────────────────────────────
  const proteinEl = document.getElementById('protein-total');
  const carbsEl   = document.getElementById('carbs-total');
  const fatsEl    = document.getElementById('fats-total');
  if (proteinEl) proteinEl.textContent = Math.round(totals.protein);
  if (carbsEl)   carbsEl.textContent   = Math.round(totals.carbs);
  if (fatsEl)    fatsEl.textContent    = Math.round(totals.fats);
  
  // ── Quick food grid ─────────────────────────────────────────────
  const quickFoods = FOOD_DATABASE.slice(0, 9);
  const quickGrid = document.getElementById('quick-food-grid');
  if (quickGrid) {
    quickGrid.innerHTML = quickFoods.map(food => `
      <div class="quick-food-item" onclick="quickAddFood('${food.id}')">
        <span class="quick-food-name">${escHtml(food.name)}</span>
        <span class="quick-food-calories">${food.calories} kcal</span>
      </div>
    `).join('');
  }
  
  // ── Food log list ───────────────────────────────────────────────
  const logContainer = document.getElementById('food-log-list');
  if (logContainer) {
    if (todayLog.length === 0) {
      logContainer.innerHTML = '<p class="muted-text">No food logged today. Add your meals above!</p>';
    } else {
      logContainer.innerHTML = todayLog.map((item, idx) => `
        <div class="food-log-item">
          <div class="food-log-info">
            <div class="food-log-name">
              ${escHtml(item.name)}
              <span class="food-log-serving">${item.serving || '1 serving'} × ${item.quantity}</span>
            </div>
            <div class="food-log-nutrition">
              <span>🔥 ${Math.round(item.calories * item.quantity)} kcal</span>
              <span>💪 ${(item.protein || 0) * item.quantity}g protein</span>
              <span>🍚 ${(item.carbs || 0) * item.quantity}g carbs</span>
              <span>🧈 ${(item.fats || 0) * item.quantity}g fats</span>
            </div>
          </div>
          <div class="food-log-actions">
            <button class="food-delete-btn" onclick="deleteFoodEntry(${idx})">${JBIcons.svg('trash', { size: 16 })}</button>
          </div>
        </div>
      `).join('');
    }
  }
  
  // ── Meal suggestions ────────────────────────────────────────────
  const mealGrid = document.getElementById('meal-suggestions-grid');
  if (mealGrid) {
    const meals = [
      { name: '🍳 Breakfast: Eggs + Oats', foods: ['egg', 'oatmeal'] },
      { name: '🥗 Lunch: Chicken + Rice', foods: ['chicken-breast', 'rice', 'broccoli'] },
      { name: '🍌 Snack: Banana + Protein', foods: ['banana', 'protein-shake'] },
      { name: '🐟 Dinner: Salmon + Veggies', foods: ['salmon', 'sweet-potato', 'broccoli'] }
    ];
    mealGrid.innerHTML = meals.map(meal => `
      <div class="meal-suggestion" onclick="addMealSuggestion('${meal.foods.join(',')}')">
        <span class="meal-suggestion-name">${meal.name}</span>
      </div>
    `).join('');
  }
}

function quickAddFood(foodId) {
  const food = FOOD_DATABASE.find(f => f.id === foodId);
  if (food) {
    state.selectedFoodId = foodId;
    const quantityInput = document.getElementById('food-quantity');
    if (quantityInput) quantityInput.value = 1;
    openAddFoodModal();
  }
}

function openAddFoodModal() {
  const searchInput = document.getElementById('food-search-input');
  if (searchInput) searchInput.value = '';
  const customName = document.getElementById('custom-food-name');
  if (customName) customName.value = '';
  const customCal = document.getElementById('custom-calories');
  if (customCal) customCal.value = '';
  const customProtein = document.getElementById('custom-protein');
  if (customProtein) customProtein.value = '';
  const customCarbs = document.getElementById('custom-carbs');
  if (customCarbs) customCarbs.value = '';
  const customFats = document.getElementById('custom-fats');
  if (customFats) customFats.value = '';
  const customServing = document.getElementById('custom-serving');
  if (customServing) customServing.value = '1 serving';
  const quantityInput = document.getElementById('food-quantity');
  if (quantityInput) quantityInput.value = 1;
  filterFoodList();
  openModal('add-food-modal');
}

function filterFoodList() {
  const searchTerm = document.getElementById('food-search-input')?.value.toLowerCase() || '';
  const { customFoods } = getData();
  const allFoods = [...FOOD_DATABASE, ...customFoods];
  const filtered = allFoods.filter(food => 
    food.name.toLowerCase().includes(searchTerm)
  );
  
  const resultsDiv = document.getElementById('food-search-results');
  if (resultsDiv) {
    resultsDiv.innerHTML = filtered.map(food => `
      <div class="food-search-item" onclick="selectFoodFromSearch('${food.id}')">
        <div>
          <div class="food-search-name">${escHtml(food.name)}</div>
          <div class="food-search-serving">${food.serving || '1 serving'}</div>
        </div>
        <div class="food-search-calories">${food.calories} kcal</div>
      </div>
    `).join('');
  }
}

function selectFoodFromSearch(foodId) {
  state.selectedFoodId = foodId;
  const allFoods = [...FOOD_DATABASE, ...(getData().customFoods || [])];
  const food = allFoods.find(f => f.id === foodId);
  if (food) {
    const quantityInput = document.getElementById('food-quantity');
    if (quantityInput) quantityInput.focus();
  }
}

function addFoodToLog() {
  const allFoods = [...FOOD_DATABASE, ...(getData().customFoods || [])];
  let food = null;
  
  // Check if custom food
  const customName = document.getElementById('custom-food-name')?.value.trim() || '';
  if (customName) {
    const calories = parseFloat(document.getElementById('custom-calories')?.value || 0);
    const protein = parseFloat(document.getElementById('custom-protein')?.value || 0);
    const carbs = parseFloat(document.getElementById('custom-carbs')?.value || 0);
    const fats = parseFloat(document.getElementById('custom-fats')?.value || 0);
    const serving = document.getElementById('custom-serving')?.value.trim() || '1 serving';
    
    if (!calories) {
      toast('Please enter calories for custom food');
      return;
    }
    
    food = {
      id: 'custom_' + Date.now(),
      name: customName,
      calories: calories,
      protein: protein,
      carbs: carbs,
      fats: fats,
      serving: serving
    };
    
    // Save custom food
    const { customFoods } = getData();
    customFoods.push(food);
    DB.set('customFoods', customFoods);
  } else if (state.selectedFoodId) {
    food = allFoods.find(f => f.id === state.selectedFoodId);
  }
  
  if (!food) {
    toast('Please select or create a food');
    return;
  }
  
  const quantity = parseFloat(document.getElementById('food-quantity')?.value) || 1;
  
  const foodLog = getData().foodLog;
  foodLog.push({
    id: 'food_' + Date.now(),
    name: food.name,
    calories: food.calories,
    protein: food.protein || 0,
    carbs: food.carbs || 0,
    fats: food.fats || 0,
    serving: food.serving || '1 serving',
    quantity: quantity,
    date: new Date().toISOString()
  });
  
  DB.set('foodLog', foodLog);
  closeModal('add-food-modal');
  renderCalorieTracker();
  toast(`Added ${quantity} × ${food.name}`);
  if (getAuthUser()) syncUserDataToCloud();
}

function deleteFoodEntry(index) {
  const foodLog = getData().foodLog;
  const todayLog = getTodayFoodLog();
  const actualEntry = todayLog[index];
  if (actualEntry) {
    const actualIndex = foodLog.findIndex(item => item.id === actualEntry.id);
    if (actualIndex !== -1) {
      foodLog.splice(actualIndex, 1);
      DB.set('foodLog', foodLog);
      renderCalorieTracker();
      toast('Entry removed');
      if (getAuthUser()) syncUserDataToCloud();
    }
  }
}

function resetTodayFood() {
  if (confirm('Reset all food entries for today?')) {
    const today = new Date().toISOString().split('T')[0];
    const foodLog = getData().foodLog.filter(item => !item.date.startsWith(today));
    DB.set('foodLog', foodLog);
    renderCalorieTracker();
    toast('Today\'s food log reset');
    if (getAuthUser()) syncUserDataToCloud();
  }
}

function addMealSuggestion(foodIds) {
  const ids = foodIds.split(',');
  ids.forEach(id => {
    const food = FOOD_DATABASE.find(f => f.id === id);
    if (food) {
      const foodLog = getData().foodLog;
      foodLog.push({
        id: 'food_' + Date.now() + '_' + Math.random(),
        name: food.name,
        calories: food.calories,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fats: food.fats || 0,
        serving: food.serving || '1 serving',
        quantity: 1,
        date: new Date().toISOString()
      });
      DB.set('foodLog', foodLog);
    }
  });
  renderCalorieTracker();
  toast('Meal added!');
}

function openCalorieGoalModal() {
  const { calorieGoals } = getData();
  const goalInput = document.getElementById('calorie-goal-input');
  const proteinInput = document.getElementById('protein-goal-input');
  const carbsInput = document.getElementById('carbs-goal-input');
  const fatsInput = document.getElementById('fats-goal-input');
  if (goalInput) goalInput.value = calorieGoals?.calories || 2000;
  if (proteinInput) proteinInput.value = calorieGoals?.protein || 150;
  if (carbsInput) carbsInput.value = calorieGoals?.carbs || 200;
  if (fatsInput) fatsInput.value = calorieGoals?.fats || 55;
  openModal('calorie-goal-modal');
}

function saveCalorieGoals() {
  const goals = {
    calories: parseInt(document.getElementById('calorie-goal-input')?.value) || 2000,
    protein: parseInt(document.getElementById('protein-goal-input')?.value) || 150,
    carbs: parseInt(document.getElementById('carbs-goal-input')?.value) || 200,
    fats: parseInt(document.getElementById('fats-goal-input')?.value) || 55
  };
  DB.set('calorieGoals', goals);
  closeModal('calorie-goal-modal');
  renderCalorieTracker();
  toast('Goals updated!');
}

// ─── Weekly Schedule Functions ───────────────────────────
function getWeeklySchedule() {
  const schedule = DB.get('weeklySchedule', null);
  if (!schedule || !schedule.days) {
    return { 
      days: {
        Monday: { name: '', workouts: [] },
        Tuesday: { name: '', workouts: [] },
        Wednesday: { name: '', workouts: [] },
        Thursday: { name: '', workouts: [] },
        Friday: { name: '', workouts: [] },
        Saturday: { name: '', workouts: [] },
        Sunday: { name: '', workouts: [] }
      },
      active: true
    };
  }
  return schedule;
}

function saveWeeklySchedule(schedule) {
  DB.set('weeklySchedule', schedule);
    syncUserDataToCloud();

}

function renderWeeklySchedule() {
  const schedule = getWeeklySchedule();
  const container = document.getElementById('weekly-schedule-grid');
  if (!container) return;

  container.innerHTML = DAYS_OF_WEEK.map(day => {
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
  _debouncedSyncToCloud();

}

function editScheduleDay(day) {
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day] || { name: '', workouts: [] };
  
  state.editingScheduleDay = day;
  
  const dayNameInput = document.getElementById('schedule-day-name');
  if (dayNameInput) {
    dayNameInput.value = dayData.name || '';
  }
  
  renderScheduleWorkoutList(dayData.workouts || []);
  renderAvailableExercises('');
  
  openModal('schedule-modal');
  _debouncedSyncToCloud();

}

function renderScheduleWorkoutList(workouts) {
  const container = document.getElementById('schedule-workout-list');
  if (!container) return;
  
  const day = state.editingScheduleDay;
  
  if (!workouts.length) {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:20px;">No exercises added yet.<br>Tap + below to add exercises.</p>';
    return;
  }
  
  container.innerHTML = workouts.map((w, idx) => `
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
}

function renderAvailableExercises(searchQuery = '') {
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
  
  container.innerHTML = filtered.map(ex => `
    <div class="schedule-exercise-item" onclick="addWorkoutToScheduleDay('${ex.id.replace(/'/g, "\\'")}', '${escHtml(ex.name).replace(/'/g, "\\'")}')">
      <span class="schedule-exercise-icon">${ex.isCardio ? JBIcons.svg('flame', { size: 16 }) : JBIcons.svg('dumbbell', { size: 16 })}</span>
      <div class="schedule-exercise-info">
        <div class="schedule-exercise-name">${escHtml(ex.name)}</div>
        <div class="schedule-exercise-meta">${ex.muscle || (ex.isCardio ? 'Cardio' : 'Strength')}</div>
      </div>
      <span class="schedule-add-icon">+</span>
    </div>
  `).join('');
}

function filterScheduleExercises() {
  const query = document.getElementById('schedule-exercise-search')?.value || '';
  renderAvailableExercises(query);
}

function addWorkoutToScheduleDay(exerciseId, exerciseName) {
  const allExercises = [...EXERCISE_LIBRARY, ...(getData().customWorkouts || [])];
  const exercise = allExercises.find(e => e.id === exerciseId);
  if (!exercise) return;
  
  const schedule = getWeeklySchedule();
  const day = state.editingScheduleDay;
  
  if (!day) {
    toast('Please select a day first');
    return;
  }
  
  if (!schedule.days[day]) {
    schedule.days[day] = { name: '', workouts: [] };
  }
  
  schedule.days[day].workouts.push({
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets || 3,
    reps: exercise.reps || 10,
    rest: exercise.rest || 60,
    isCardio: exercise.isCardio || false,
    muscle: exercise.muscle || 'General',
    notes: ''
  });
  
  saveWeeklySchedule(schedule);
  renderScheduleWorkoutList(schedule.days[day].workouts);
  toast(`Added ${exercise.name} to ${day}`);
}

function removeWorkoutFromSchedule(index) {
  const schedule = getWeeklySchedule();
  const day = state.editingScheduleDay;
  if (schedule.days[day] && schedule.days[day].workouts[index]) {
    const removed = schedule.days[day].workouts[index];
    schedule.days[day].workouts.splice(index, 1);
    saveWeeklySchedule(schedule);
    renderScheduleWorkoutList(schedule.days[day].workouts);
    renderWeeklySchedule();
    toast(`Removed ${removed.name}`);
  }
}

function saveScheduleDay() {
  const schedule = getWeeklySchedule();
  const day = state.editingScheduleDay;
  const dayNameInput = document.getElementById('schedule-day-name');
  const dayName = dayNameInput ? dayNameInput.value.trim() : '';
  
  if (!schedule.days[day]) {
    schedule.days[day] = { name: '', workouts: [] };
  }
  
  schedule.days[day].name = dayName;
  saveWeeklySchedule(schedule);
  closeModal('schedule-modal');
  renderWeeklySchedule();
  toast(`${day} workout saved!`);
}

function resetWeeklySchedule() {
  if (confirm('Reset your entire weekly schedule? This cannot be undone.')) {
    const emptySchedule = {
      days: {
        Monday: { name: '', workouts: [] },
        Tuesday: { name: '', workouts: [] },
        Wednesday: { name: '', workouts: [] },
        Thursday: { name: '', workouts: [] },
        Friday: { name: '', workouts: [] },
        Saturday: { name: '', workouts: [] },
        Sunday: { name: '', workouts: [] }
      },
      active: true
    };
    saveWeeklySchedule(emptySchedule);
    renderWeeklySchedule();
    toast('Schedule reset!');
  }
}

// ─── Edit Scheduled Workout Functions ────────────────────
function editScheduledWorkout(day, workoutIndex) {
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day];
  
  if (!dayData || !dayData.workouts[workoutIndex]) {
    toast('Workout not found');
    return;
  }
  
  const workout = dayData.workouts[workoutIndex];
  
  state.editingScheduleDay = day;
  state.editingScheduleWorkoutIndex = workoutIndex;
  
  const setsInput = document.getElementById('edit-workout-sets');
  const repsInput = document.getElementById('edit-workout-reps');
  const restInput = document.getElementById('edit-workout-rest');
  const notesInput = document.getElementById('edit-workout-notes');
  
  if (setsInput) setsInput.value = workout.sets || 3;
  if (repsInput) repsInput.value = workout.reps || 10;
  if (restInput) restInput.value = workout.rest || 60;
  if (notesInput) notesInput.value = workout.notes || '';
  
  const headerEl = document.getElementById('edit-workout-header');
  if (headerEl) {
    headerEl.innerHTML = `
      <div class="edit-workout-icon">${workout.isCardio ? JBIcons.svg('flame', { size: 20 }) : JBIcons.svg('dumbbell', { size: 20 })}</div>
      <div class="edit-workout-title">
        <h4>${escHtml(workout.name)}</h4>
        <p>${workout.muscle || (workout.isCardio ? 'Cardio' : 'Strength')}</p>
      </div>
    `;
  }
  
  openModal('edit-schedule-workout-modal');
}

function saveScheduleWorkoutEdit() {
  const day = state.editingScheduleDay;
  const workoutIndex = state.editingScheduleWorkoutIndex;
  
  if (!day || workoutIndex === null) {
    toast('Error: No workout selected');
    closeModal('edit-schedule-workout-modal');
    return;
  }
  
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day];
  
  if (!dayData || !dayData.workouts[workoutIndex]) {
    toast('Workout not found');
    closeModal('edit-schedule-workout-modal');
    return;
  }
  
  const newSets = parseInt(document.getElementById('edit-workout-sets')?.value) || 3;
  const newReps = parseInt(document.getElementById('edit-workout-reps')?.value) || 10;
  const newRest = parseInt(document.getElementById('edit-workout-rest')?.value) || 60;
  const newNotes = document.getElementById('edit-workout-notes')?.value.trim() || '';
  
  dayData.workouts[workoutIndex] = {
    ...dayData.workouts[workoutIndex],
    sets: newSets,
    reps: newReps,
    rest: newRest,
    notes: newNotes
  };
  
  saveWeeklySchedule(schedule);
  renderScheduleWorkoutList(dayData.workouts);
  renderWeeklySchedule();
  
  closeModal('edit-schedule-workout-modal');
  toast(`Updated ${dayData.workouts[workoutIndex].name}`);
}

function deleteScheduledWorkout() {
  const day = state.editingScheduleDay;
  const workoutIndex = state.editingScheduleWorkoutIndex;
  
  if (!day || workoutIndex === null) return;
  
  if (!confirm('Remove this exercise from your schedule?')) return;
  
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day];
  
  if (dayData && dayData.workouts[workoutIndex]) {
    const removedName = dayData.workouts[workoutIndex].name;
    dayData.workouts.splice(workoutIndex, 1);
    saveWeeklySchedule(schedule);
    
    renderScheduleWorkoutList(dayData.workouts);
    renderWeeklySchedule();
    
    closeModal('edit-schedule-workout-modal');
    toast(`Removed ${removedName} from schedule`);
  }
}

// ─── Start Scheduled Workout ─────────────────────────────
function startScheduledWorkout(day) {
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day];
  
  if (!dayData.workouts || dayData.workouts.length === 0) {
    toast(`No exercises scheduled for ${day}. Edit the day to add exercises.`);
    return;
  }
  
  state.scheduledSession = {
    day: day,
    name: dayData.name || `${day} Workout`,
    workouts: dayData.workouts,
    currentIndex: 0
  };
  
  startScheduledExercise(0);
}

function startScheduledExercise(index) {
  const session = state.scheduledSession;
  if (!session || index >= session.workouts.length) {
    toast("🎉 Great workout! All exercises completed!");
    closeModal('session-modal');
    state.scheduledSession = null;
    return;
  }
  
  const exercise = session.workouts[index];
  state.scheduledCurrentIndex = index;
  
  openScheduledSessionModal(exercise);
}

function openScheduledSessionModal(exercise) {
  state.activeSession = { 
    exercise, 
    sets: [], 
    isScheduled: true, 
    scheduledIndex: state.scheduledCurrentIndex 
  };
  
  const titleEl = document.getElementById('session-modal-title');
  if (titleEl) {
    titleEl.textContent = `${exercise.name} (${state.scheduledSession?.day || 'Workout'})`;
  }
  
  const body = document.getElementById('session-modal-body');
  const sets = exercise.sets || 3;
  const isCardio = exercise.isCardio;
  
  const total = state.scheduledSession.workouts.length;
  const current = (state.scheduledCurrentIndex || 0) + 1;
  
  body.innerHTML = `
    <div class="session-progress">
      <div class="session-progress-bar" style="width: ${(current/total)*100}%"></div>
      <div class="session-progress-text">Exercise ${current} of ${total}</div>
    </div>
    <div class="session-exercise-title">
      <span>${escHtml(exercise.name)}</span>
    </div>
    ${isCardio ? renderCardioSessionInputs(exercise) : renderStrengthSessionInputs(exercise, sets)}
    ${restTimerMarkup()}
  `;
  
  openModal('session-modal');
}

// ─── Split Templates ─────────────────────────────────────
function getExercisesByNames(names) {
  const allExercises = [...EXERCISE_LIBRARY, ...(getData().customWorkouts || [])];
  return names.map(name => {
    const ex = allExercises.find(e => e.name === name);
    if (ex) {
      return {
        id: ex.id,
        name: ex.name,
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        rest: ex.rest || 60,
        isCardio: ex.isCardio || false,
        muscle: ex.muscle || 'General',
        notes: ''
      };
    }
    return null;
  }).filter(Boolean);
}

function applySplitTemplate(template) {
  const schedule = getWeeklySchedule();
  
  switch(template) {
    case 'push-pull-legs':
      schedule.days = {
        Monday: { name: 'Push Day', workouts: getExercisesByNames(['Bench Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown']) },
        Tuesday: { name: 'Pull Day', workouts: getExercisesByNames(['Pull-Up', 'Barbell Row', 'Face Pull', 'Barbell Curl']) },
        Wednesday: { name: 'Legs Day', workouts: getExercisesByNames(['Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise']) },
        Thursday: { name: 'Push Day', workouts: getExercisesByNames(['Incline Bench Press', 'Dumbbell Fly', 'Arnold Press', 'Skull Crusher']) },
        Friday: { name: 'Pull Day', workouts: getExercisesByNames(['Deadlift', 'Lat Pulldown', 'Seated Cable Row', 'Hammer Curl']) },
        Saturday: { name: 'Legs Day', workouts: getExercisesByNames(['Leg Curl', 'Leg Extension', 'Lunges', 'Hack Squat']) },
        Sunday: { name: 'Rest Day', workouts: [] }
      };
      break;
    case 'upper-lower':
      schedule.days = {
        Monday: { name: 'Upper A', workouts: getExercisesByNames(['Bench Press', 'Pull-Up', 'Overhead Press', 'Barbell Row', 'Tricep Pushdown', 'Barbell Curl']) },
        Tuesday: { name: 'Lower A', workouts: getExercisesByNames(['Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise']) },
        Wednesday: { name: 'Rest', workouts: [] },
        Thursday: { name: 'Upper B', workouts: getExercisesByNames(['Incline Bench Press', 'Lat Pulldown', 'Lateral Raise', 'Dumbbell Row', 'Skull Crusher', 'Hammer Curl']) },
        Friday: { name: 'Lower B', workouts: getExercisesByNames(['Deadlift', 'Leg Curl', 'Leg Extension', 'Lunges']) },
        Saturday: { name: 'Cardio/Core', workouts: getExercisesByNames(['Treadmill Run', 'Plank', 'Crunches']) },
        Sunday: { name: 'Rest', workouts: [] }
      };
      break;
    case 'bro-split':
      schedule.days = {
        Monday: { name: 'Chest Day', workouts: getExercisesByNames(['Bench Press', 'Incline Bench Press', 'Dumbbell Fly', 'Push-Up', 'Cable Crossover']) },
        Tuesday: { name: 'Back Day', workouts: getExercisesByNames(['Deadlift', 'Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row']) },
        Wednesday: { name: 'Shoulders Day', workouts: getExercisesByNames(['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Arnold Press']) },
        Thursday: { name: 'Legs Day', workouts: getExercisesByNames(['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raise']) },
        Friday: { name: 'Arms Day', workouts: getExercisesByNames(['Barbell Curl', 'Tricep Pushdown', 'Hammer Curl', 'Skull Crusher', 'Preacher Curl']) },
        Saturday: { name: 'Cardio/Abs', workouts: getExercisesByNames(['Treadmill Run', 'Plank', 'Russian Twist', 'Hanging Leg Raise']) },
        Sunday: { name: 'Rest Day', workouts: [] }
      };
      break;
    case 'full-body':
      schedule.days = {
        Monday: { name: 'Full Body A', workouts: getExercisesByNames(['Squat', 'Bench Press', 'Pull-Up', 'Overhead Press', 'Deadlift']) },
        Tuesday: { name: 'Rest', workouts: [] },
        Wednesday: { name: 'Full Body B', workouts: getExercisesByNames(['Leg Press', 'Incline Bench', 'Barbell Row', 'Lateral Raise', 'Romanian Deadlift']) },
        Thursday: { name: 'Rest', workouts: [] },
        Friday: { name: 'Full Body C', workouts: getExercisesByNames(['Hack Squat', 'Dumbbell Fly', 'Lat Pulldown', 'Arnold Press', 'Leg Curl']) },
        Saturday: { name: 'Cardio/Core', workouts: getExercisesByNames(['Jump Rope', 'Plank', 'Crunches', 'Leg Raise']) },
        Sunday: { name: 'Rest', workouts: [] }
      };
      break;case 'arnold-split':
  schedule.days = {
    Monday: {
      name: 'Chest & Back (Heavy)',
      workouts: getExercisesByNames([
        'Bench Press',
        'Incline Dumbbell Press',
        'Pull-Up',
        'Barbell Row',
        'Deadlift'
      ])
    },
    Tuesday: {
      name: 'Shoulders & Arms (Heavy)',
      workouts: getExercisesByNames([
        'Overhead Press',
        'Lateral Raise',
        'Barbell Curl',
        'Tricep Pushdown',
        'Dips'
      ])
    },
    Wednesday: {
      name: 'Legs (Heavy)',
      workouts: getExercisesByNames([
        'Squat',
        'Leg Press',
        'Romanian Deadlift',
        'Leg Curl',
        'Calf Raise'
      ])
    },
    Thursday: {
      name: 'Chest & Back (Light)',
      workouts: getExercisesByNames([
        'Dumbbell Fly',
        'Cable Crossover',
        'Lat Pulldown',
        'Seated Cable Row'
      ])
    },
    Friday: {
      name: 'Shoulders & Arms (Light)',
      workouts: getExercisesByNames([
        'Arnold Press',
        'Front Raise',
        'Hammer Curl',
        'Skull Crusher'
      ])
    },
    Saturday: {
      name: 'Legs (Light)',
      workouts: getExercisesByNames([
        'Leg Extension',
        'Lunge',
        'Hack Squat',
        'Lying Leg Curl'
      ])
    },
    Sunday: {
      name: 'Rest Day',
      workouts: []
    }
  };
  break;case 'phul':
  schedule.days = {
    Monday: {
      name: 'Power Upper',
      workouts: getExercisesByNames([
        'Bench Press',
        'Barbell Row',
        'Overhead Press',
        'Pull-Up'
      ])
    },
    Tuesday: {
      name: 'Power Lower',
      workouts: getExercisesByNames([
        'Squat',
        'Deadlift',
        'Leg Press',
        'Calf Raise'
      ])
    },
    Wednesday: {
      name: 'Rest / Active Recovery',
      workouts: []
    },
    Thursday: {
      name: 'Hypertrophy Upper',
      workouts: getExercisesByNames([
        'Incline Dumbbell Press',
        'Lat Pulldown',
        'Dumbbell Fly',
        'Seated Cable Row',
        'Lateral Raise',
        'Tricep Pushdown',
        'Barbell Curl'
      ])
    },
    Friday: {
      name: 'Hypertrophy Lower',
      workouts: getExercisesByNames([
        'Leg Extension',
        'Romanian Deadlift',
        'Lunge',
        'Leg Curl',
        'Calf Raise'
      ])
    },
    Saturday: {
      name: 'Rest',
      workouts: []
    },
    Sunday: {
      name: 'Rest',
      workouts: []
    }
  };
  break;
  }
  
  saveWeeklySchedule(schedule);
  renderWeeklySchedule();
  toast(`${template.replace('-', ' ').toUpperCase()} template applied!`);
}

function copyScheduleToClipboard() {
  const schedule = getWeeklySchedule();
  const dayEmojis = { Monday: '💪', Tuesday: '🔥', Wednesday: '⚡', Thursday: '🏋️', Friday: '💥', Saturday: '🌟', Sunday: '😴' };

  const lines = ['📅 My Weekly Workout Schedule', '═'.repeat(32), ''];

  DAYS_OF_WEEK.forEach(day => {
    const dayData = schedule.days[day] || { name: '', workouts: [] };
    const emoji = dayEmojis[day] || '🗓';
    const label = dayData.name ? `${day} — ${dayData.name}` : day;
    lines.push(`${emoji} ${label}`);

    if (dayData.workouts && dayData.workouts.length > 0) {
      dayData.workouts.forEach((w, i) => {
        const setsReps = w.isCardio
          ? `${w.duration || w.sets || 1} sets`
          : `${w.sets || 3} sets × ${w.reps || 10} reps`;
        lines.push(`   ${i + 1}. ${w.name} — ${setsReps} (${w.rest || 60}s rest)`);
        if (w.notes) lines.push(`      📝 ${w.notes}`);
      });
    } else {
      lines.push('   Rest Day 😴');
    }
    lines.push('');
  });

  lines.push('─'.repeat(32));
  lines.push('Made with Jim Buddy 💪');

  const text = lines.join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      toast('Schedule copied to clipboard! 📋');
      const btn = document.getElementById('copy-schedule-btn');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="ic ic-done"></span> Copied!';
        btn.disabled = true;
        setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
      }
    }).catch(() => {
      toast('Could not copy. Try again!', 'error');
    });
  } else {
    // Fallback for older browsers
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Schedule copied to clipboard! 📋');
    } catch {
      toast('Copy not supported on this browser.', 'error');
    }
  }
}

function navigate(page) {
  if (typeof SoundManager !== 'undefined') SoundManager.tap();

  // Redirect 'goals' to the merged stats page (Goals tab)
  if (page === 'goals') {
    navigate('progress');
    setTimeout(() => switchStatsTab('goals'), 50);
    return;
  }

  // Use requestAnimationFrame to batch DOM updates
  requestAnimationFrame(() => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    let targetPageId = 'page-' + page;
    let targetBtnPage = page;

    if (page === 'calculator') {
      targetPageId = 'page-calorie';
      targetBtnPage = 'calorie';
    }

    // gymbros has no nav-btn now — handled via header icon
    if (page === 'gymbros') {
      targetBtnPage = null;
    }

    const targetPage = document.getElementById(targetPageId);
    if (targetPage) {
      targetPage.style.display = 'block'; // Make visible before transition
      // Force reflow
      targetPage.getBoundingClientRect();
      targetPage.classList.add('active');
    }

    if (targetBtnPage) {
      const targetBtn = document.querySelector(`.nav-btn[data-page="${targetBtnPage}"]`);
      if (targetBtn) targetBtn.classList.add('active');
    }

    // Update gymbros header icon highlight
    const gymbrosHeaderBtn = document.getElementById('gymbros-header-btn');
    if (gymbrosHeaderBtn) {
      gymbrosHeaderBtn.style.color = page === 'gymbros' ? 'var(--accent)' : '';
    }

    // Completely remove inactive pages from layout tree after transition finishes
    setTimeout(() => {
      document.querySelectorAll('.page:not(.active)').forEach(p => {
        p.style.display = 'none';
      });
    }, 300);

    state.currentPage = page;

    // Lazy‑render only if needed (deferred to next tick to let navigation paint transition run unblocked)
    setTimeout(() => {
      if (page === 'home') renderDashboard();
      if (page === 'workouts') renderWorkouts();
      if (page === 'progress') renderProgress();
      if (page === 'water') renderWater();
      if (page === 'schedule') renderWeeklySchedule();
      if (page === 'calorie') {
        renderCalorieTracker();
        const scrollContainer = document.querySelector('#page-calorie .page-scroll');
        if (scrollContainer) scrollContainer.scrollTop = 0;
      }
      if (page === 'calculator') {
        renderCalorieTracker();
        displaySavedProfile();
        loadSavedProfile();
        setTimeout(() => {
          const targetEl = document.getElementById('calorie-calculator-section');
          const scrollContainer = document.querySelector('#page-calorie .page-scroll');
          if (scrollContainer && targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 50);
      }
      if (page === 'diet') renderDietPage();
      if (page === 'gymbros') renderGymbros();
      afterCommittedFrames(invalidateAndroidWebViewSurface);
    }, 0);
  });
}

// ─── Stats page tab switcher (Progress / Goals / InBody) ─
function switchStatsTab(tab) {
  const progressPane = document.getElementById('stats-pane-progress');
  const goalsPane    = document.getElementById('stats-pane-goals');
  const inbodyPane   = document.getElementById('stats-pane-inbody');
  const progressBtn  = document.getElementById('stats-tab-progress');
  const goalsBtn     = document.getElementById('stats-tab-goals');
  const inbodyBtn    = document.getElementById('stats-tab-inbody');
  if (!progressPane || !goalsPane) return;

  [progressPane, goalsPane, inbodyPane].forEach(p => p && p.classList.remove('active'));
  [progressBtn, goalsBtn, inbodyBtn].forEach(b => b && b.classList.remove('active'));

  if (tab === 'progress') {
    progressPane.classList.add('active');
    progressBtn.classList.add('active');
    renderProgress();
  } else if (tab === 'inbody') {
    inbodyPane && inbodyPane.classList.add('active');
    inbodyBtn  && inbodyBtn.classList.add('active');
    renderInbodyList();
  } else {
    goalsPane.classList.add('active');
    goalsBtn.classList.add('active');
    renderGoals();
  }
}
window.switchStatsTab = switchStatsTab;


// ══════════════════════════════════════════
// INBODY SYSTEM
// ══════════════════════════════════════════

let _editingInbodyId = null;

function getInbodyLog() { return DB.get('inbodyLog', []); }
function setInbodyLog(log) { DB.set('inbodyLog', log); }

// ── Rating logic ─────────────────────────────────────────
function rateInbody(entry) {
  const scores = [];

  // Body Fat % — lower is better for fitness
  if (entry.bodyfat != null) {
    const bf = entry.bodyfat;
    if (bf < 10) scores.push({ label: 'Body Fat', rating: 'Elite', color: '#00e5a0', score: 5 });
    else if (bf < 15) scores.push({ label: 'Body Fat', rating: 'Athletic', color: '#00b4d8', score: 4 });
    else if (bf < 20) scores.push({ label: 'Body Fat', rating: 'Fit', color: '#00b4d8', score: 3 });
    else if (bf < 25) scores.push({ label: 'Body Fat', rating: 'Average', color: '#ffb830', score: 2 });
    else scores.push({ label: 'Body Fat', rating: 'High', color: '#ff4757', score: 1 });
  }

  // BMI
  if (entry.bmi != null) {
    const bmi = entry.bmi;
    if (bmi >= 18.5 && bmi < 25) scores.push({ label: 'BMI', rating: 'Normal', color: '#00e5a0', score: 5 });
    else if (bmi >= 25 && bmi < 27) scores.push({ label: 'BMI', rating: 'Slightly High', color: '#ffb830', score: 3 });
    else if (bmi >= 27 && bmi < 30) scores.push({ label: 'BMI', rating: 'Overweight', color: '#ff4757', score: 2 });
    else if (bmi >= 30) scores.push({ label: 'BMI', rating: 'Obese', color: '#ff4757', score: 1 });
    else scores.push({ label: 'BMI', rating: 'Underweight', color: '#ffb830', score: 2 });
  }

  // Visceral Fat — lower is better
  if (entry.visceral != null) {
    const vf = entry.visceral;
    if (vf <= 5) scores.push({ label: 'Visceral Fat', rating: 'Excellent', color: '#00e5a0', score: 5 });
    else if (vf <= 9) scores.push({ label: 'Visceral Fat', rating: 'Good', color: '#00b4d8', score: 4 });
    else if (vf <= 12) scores.push({ label: 'Visceral Fat', rating: 'Borderline', color: '#ffb830', score: 2 });
    else scores.push({ label: 'Visceral Fat', rating: 'High Risk', color: '#ff4757', score: 1 });
  }

  if (!scores.length) return null;
  const avg = scores.reduce((s, x) => s + x.score, 0) / scores.length;
  let overall, overallColor;
  if (avg >= 4.5) { overall = 'Elite 🏆'; overallColor = '#00e5a0'; }
  else if (avg >= 3.5) { overall = 'Athletic 💪'; overallColor = '#00b4d8'; }
  else if (avg >= 2.5) { overall = 'Fit ✅'; overallColor = '#00b4d8'; }
  else if (avg >= 1.5) { overall = 'Average ⚠️'; overallColor = '#ffb830'; }
  else { overall = 'Needs Work 🔴'; overallColor = '#ff4757'; }

  return { scores, overall, overallColor };
}

// ── Trend chart ───────────────────────────────────────────
let _inbodyChartInstance = null;

function renderInbodyChart() {
  const canvas  = document.getElementById('inbody-trend-chart');
  const emptyEl = document.getElementById('inbody-chart-empty');
  const wrapEl  = document.getElementById('inbody-chart-wrap');
  if (!canvas) return;

  if (_inbodyChartInstance) { _inbodyChartInstance.destroy(); _inbodyChartInstance = null; }

  const metric = document.getElementById('inbody-chart-metric')?.value || 'weight';
  const log = getInbodyLog()
    .filter(e => e[metric] != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (log.length < 2) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (wrapEl)  wrapEl.style.display  = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (wrapEl)  wrapEl.style.display  = '';

  const labels = log.map(e => new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const values = log.map(e => e[metric]);

  _inbodyChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#00e5a0',
        backgroundColor: 'rgba(0,229,160,0.08)',
        borderWidth: 2,
        pointBackgroundColor: values.map((v, i) => {
          if (i === values.length - 1) return '#00e5a0';
          return '#00b4d8';
        }),
        pointRadius: 4,
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(17,17,24,0.95)',
        titleColor: '#f0f0f5',
        bodyColor: '#00e5a0',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        callbacks: { label: ctx => ' ' + ctx.parsed.y }
      }},
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } }
      }
    }
  });
}
window.renderInbodyChart = renderInbodyChart;

// ── Render list ───────────────────────────────────────────
function renderInbodyList() {
  renderInbodyChart();
  const container = document.getElementById('inbody-list');
  if (!container) return;
  const log = getInbodyLog().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!log.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" style="font-size:36px;">🧬</span>
        <p>No InBody records yet.</p>
        <button class="btn btn-primary" onclick="openInbodyModal()">+ Add First Record</button>
      </div>`;
    return;
  }

  container.innerHTML = log.map(entry => {
    const rating = rateInbody(entry);
    const dateStr = new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return `
      <div class="inbody-card" onclick="openInbodyDetail('${entry.id}')">
        <div class="inbody-card-top">
          <div>
            <div class="inbody-card-date">${dateStr}</div>
            ${entry.weight != null ? `<div class="inbody-card-weight">${entry.weight} kg</div>` : ''}
          </div>
          ${rating ? `<div class="inbody-card-rating" style="color:${rating.overallColor}">${rating.overall}</div>` : ''}
        </div>
        <div class="inbody-card-stats">
          ${entry.bodyfat  != null ? `<span class="inbody-stat-chip">Fat ${entry.bodyfat}%</span>` : ''}
          ${entry.muscle   != null ? `<span class="inbody-stat-chip">Muscle ${entry.muscle}kg</span>` : ''}
          ${entry.bmi      != null ? `<span class="inbody-stat-chip">BMI ${entry.bmi}</span>` : ''}
          ${entry.visceral != null ? `<span class="inbody-stat-chip">VF ${entry.visceral}</span>` : ''}
        </div>
        <div class="inbody-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost" onclick="openInbodyModal('${entry.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInbody('${entry.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// ── Open add/edit modal ───────────────────────────────────
function openInbodyModal(id = null) {
  _editingInbodyId = id;
  const title = document.getElementById('inbody-modal-title');
  if (title) title.textContent = id ? 'Edit InBody' : 'Add InBody';

  const fields = ['date','weight','bodyfat','muscle','bmi','visceral','water','protein','minerals','fatmass','lean','notes'];
  // Clear all
  fields.forEach(f => {
    const el = document.getElementById('ib-' + f);
    if (el) el.value = '';
  });

  if (id) {
    const entry = getInbodyLog().find(e => e.id === id);
    if (entry) {
      fields.forEach(f => {
        const el = document.getElementById('ib-' + f);
        if (el && entry[f] != null) el.value = f === 'date' ? entry[f].split('T')[0] : entry[f];
      });
    }
  } else {
    const dateEl = document.getElementById('ib-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  }

  openModal('inbody-modal');
}
window.openInbodyModal = openInbodyModal;

// ── Save ──────────────────────────────────────────────────
function saveInbody() {
  const dateVal = document.getElementById('ib-date')?.value;
  if (!dateVal) { toast('Please select a date'); return; }

  const num = id => { const v = document.getElementById('ib-' + id)?.value; return v !== '' && v != null ? parseFloat(v) : null; };
  const entry = {
    id:       _editingInbodyId || ('ib_' + Date.now()),
    date:     dateVal,
    weight:   num('weight'),
    bodyfat:  num('bodyfat'),
    muscle:   num('muscle'),
    bmi:      num('bmi'),
    visceral: num('visceral'),
    water:    num('water'),
    protein:  num('protein'),
    minerals: num('minerals'),
    fatmass:  num('fatmass'),
    lean:     num('lean'),
    notes:    document.getElementById('ib-notes')?.value.trim() || null,
  };

  const log = getInbodyLog();
  if (_editingInbodyId) {
    const idx = log.findIndex(e => e.id === _editingInbodyId);
    if (idx !== -1) log[idx] = entry;
  } else {
    log.push(entry);
  }
  setInbodyLog(log);
  closeModal('inbody-modal');
  renderInbodyList();
  toast(_editingInbodyId ? 'InBody updated ✅' : 'InBody saved ✅');
  _editingInbodyId = null;
  _debouncedSyncToCloud();
}
window.saveInbody = saveInbody;

// ── Delete ────────────────────────────────────────────────
function deleteInbody(id) {
  if (!confirm('Delete this InBody record?')) return;
  setInbodyLog(getInbodyLog().filter(e => e.id !== id));
  renderInbodyList();
  toast('Record deleted');
}
window.deleteInbody = deleteInbody;

// ── Detail view ───────────────────────────────────────────
function openInbodyDetail(id) {
  const entry = getInbodyLog().find(e => e.id === id);
  if (!entry) return;

  const rating = rateInbody(entry);
  const dateStr = new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const titleEl = document.getElementById('ibd-title');
  if (titleEl) titleEl.textContent = `InBody — ${dateStr}`;

  const row = (label, value, unit = '') => value != null
    ? `<div class="ibd-row"><span class="ibd-label">${label}</span><span class="ibd-value">${value}${unit}</span></div>`
    : '';

  const ratingSection = rating ? `
    <div class="ibd-rating-section">
      <div class="ibd-overall" style="color:${rating.overallColor}">${rating.overall}</div>
      <div class="ibd-scores">
        ${rating.scores.map(s => `
          <div class="ibd-score-row">
            <span>${s.label}</span>
            <span class="ibd-score-badge" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}44">${s.rating}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  const body = document.getElementById('ibd-body');
  if (body) body.innerHTML = `
    ${ratingSection}
    <div class="ibd-grid">
      ${row('Weight', entry.weight, ' kg')}
      ${row('Body Fat', entry.bodyfat, '%')}
      ${row('Skeletal Muscle', entry.muscle, ' kg')}
      ${row('BMI', entry.bmi)}
      ${row('Visceral Fat Level', entry.visceral)}
      ${row('Total Body Water', entry.water, ' L')}
      ${row('Protein', entry.protein, ' kg')}
      ${row('Minerals', entry.minerals, ' kg')}
      ${row('Body Fat Mass', entry.fatmass, ' kg')}
      ${row('Lean Body Mass', entry.lean, ' kg')}
    </div>
    ${entry.notes ? `<div class="ibd-notes">${escHtml(entry.notes)}</div>` : ''}`;

  openModal('inbody-detail-modal');
}
window.openInbodyDetail = openInbodyDetail;

// ══════════════════════════════════════════
// END INBODY SYSTEM
// ══════════════════════════════════════════

function updateGreeting() {
  const h = new Date().getHours();
  const waveIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="jb-icon" style="vertical-align:middle;margin-left:2px;"><path d="M8.5 4.5c.4-1 1.6-1.4 2.5-.8l.3.2c1 .8 1 2.2 0 3L6 12c-1 .8-1 2.2 0 3l.3.2c.9.6 2.1.2 2.5-.8l3-6c.4-1 1.6-1.4 2.5-.8l.3.2c1 .8 1 2.2 0 3L11 16c-.5.6-.4 1.5.2 2 .6.4 1.4.3 1.8-.3l2-2.7c.8-1 2.2-1 3 0l.2.3c.6.9.4 2.1-.5 2.7C15.3 20 12 21 9 19.5 6 18 4 15 4 12c0-2 .8-3.8 2-5.1L8.5 4.5z" fill="currentColor" stroke="none"/></svg>`;
  const g = h < 12 ? `welcome back 👋` : h < 17 ? `welcome back, champion 👋` : `welcome back, champion 👋`;
  const greetingEl = document.getElementById('greeting-title');
  if (greetingEl) greetingEl.innerHTML = g;
}

function calcStreak(sessions) {
  if (!sessions || !sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => s.date?.split('T')[0]).filter(Boolean))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  let streak = 0, check = today;
  for (const d of dates) {
    if (d === check) { streak++; check = prevDay(check); }
    else if (d < check) break;
  }
  return streak;
}

// Gather sessions from every stored profile + currently active sessions
function getAllProfilesSessions(activeSessions) {
  const profilesData = DB.get('profilesData', {});
  const seen = new Set();
  const merged = [];

  // Start with current active sessions
  (activeSessions || []).forEach(s => {
    if (s.id && !seen.has(s.id)) { seen.add(s.id); merged.push(s); }
  });

  // Add sessions from every profile snapshot
  Object.values(profilesData).forEach(pd => {
    (pd?.data?.sessions || []).forEach(s => {
      if (s.id && !seen.has(s.id)) { seen.add(s.id); merged.push(s); }
    });
  });

  return merged;
}

function prevDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function sessionCardHTML(s) {
  const exerciseCount = s.exercises?.length || 0;
  const totalSets = s.totalSets || s.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
  
  return `
    <div class="session-card" onclick="viewSessionDetailsFromDashboard('${s.id}')">
      <div class="session-card-header">
        <span class="session-card-name">${escHtml(s.name || 'Workout Session')}</span>
        <span class="session-card-date">${formatDate(s.date)}</span>
      </div>
      <div class="session-card-detail">${exerciseCount} exercise(s) · ${totalSets} sets</div>
      <div class="session-card-sets">
        ${s.exercises?.slice(0, 4).map(e => `<span class="session-set-tag">${escHtml(e.name)}</span>`).join('')}
        ${exerciseCount > 4 ? `<span class="session-set-tag">+${exerciseCount - 4} more</span>` : ''}
      </div>
    </div>`;
}

// Add this function to view from dashboard by ID
function viewSessionDetailsFromDashboard(sessionId) {
  const { sessions } = getData();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex !== -1) {
    viewSessionDetails(sessionIndex);
  }
}

function getTodayWater(waterLog) {
  const today = new Date().toISOString().split('T')[0];
  return waterLog.filter(l => l.date.startsWith(today)).reduce((a, l) => a + l.amount, 0);
}

function calculateCardioCalories(exerciseName, durationMinutes, distanceKm) {
  const weightLog = DB.get('weightLog', []);
  const weight = weightLog.length > 0 ? weightLog[weightLog.length - 1].weight : 70; // Default to 70kg if no weight logged

  const name = exerciseName.toLowerCase();
  let met = 6.0; // Default MET value for general cardio

  if (name.includes('treadmill') || name.includes('run')) {
    if (distanceKm && durationMinutes > 0) {
      // Calculate speed in km/h: distance / (duration / 60)
      const speedKmH = distanceKm / (durationMinutes / 60);
      const speedMph = speedKmH * 0.621371;
      
      if (speedMph < 4) met = 3.5;       // Walking
      else if (speedMph < 5) met = 6.0;  // Light jogging
      else if (speedMph < 6) met = 8.3;  // Jogging
      else if (speedMph < 7) met = 9.8;  // Running (6 mph)
      else if (speedMph < 8) met = 11.0; // Running (7 mph)
      else if (speedMph < 9) met = 11.8; // Running (8 mph)
      else met = 12.8;                   // Fast running
    } else {
      met = 9.8; // Default running
    }
  } else if (name.includes('walk')) {
    met = 3.5;
  } else if (name.includes('cycle') || name.includes('bike') || name.includes('spin')) {
    if (distanceKm && durationMinutes > 0) {
      const speedKmH = distanceKm / (durationMinutes / 60);
      if (speedKmH < 15) met = 4.0;
      else if (speedKmH < 20) met = 6.8;
      else if (speedKmH < 25) met = 8.0;
      else met = 10.0;
    } else {
      met = 7.5;
    }
  } else if (name.includes('row')) {
    met = 7.0;
  } else if (name.includes('elliptical')) {
    met = 5.0;
  } else if (name.includes('swim')) {
    met = 8.0;
  } else if (name.includes('rope') || name.includes('jump')) {
    met = 11.0;
  } else if (name.includes('stair') || name.includes('stepper')) {
    met = 9.0;
  }

  // Formula: MET * 3.5 * weight * duration / 200
  return Math.round(met * 3.5 * weight * durationMinutes / 200);
}

function getTodayBurntCalories(cardioLog) {
  const today = new Date().toISOString().split('T')[0];
  return (cardioLog || []).filter(c => c.date.startsWith(today)).reduce((sum, c) => sum + (c.calories || 0), 0);
}

function renderDashboard() {
  updateGreeting();
  const { sessions, prs, settings, waterLog, weightLog, weightLossGoal } = getData();

  const streak = calcStreak(sessions);
  const sessionsEl = document.getElementById('stat-sessions');
  const prsEl = document.getElementById('stat-prs');
  const streakEl = document.getElementById('stat-streak');
  const streakCountEl = document.getElementById('streak-count');
  if (sessionsEl) sessionsEl.textContent = sessions.length;
  if (prsEl) prsEl.textContent = Object.keys(prs).length;
  if (streakEl) streakEl.textContent = streak;
  if (streakCountEl) streakCountEl.textContent = streak;

  const todayWater = getTodayWater(waterLog);
  const goal = settings.waterGoal || 2000;
  const waterTextEl = document.getElementById('dash-water-text');
  const waterBarEl = document.getElementById('dash-water-bar');
  if (waterTextEl) waterTextEl.textContent = `${todayWater} / ${goal} ml`;
  if (waterBarEl) {
    waterBarEl.style.width = Math.min(100, (todayWater / goal) * 100) + '%';
    waterBarEl.classList.toggle('goal-reached', todayWater >= goal);
  }

  const wlTextEl = document.getElementById('dash-wl-text');
  const wlBarEl = document.getElementById('dash-wl-bar');
  if (weightLossGoal && weightLog.length > 0) {
    const latest = weightLog[weightLog.length - 1].weight;
    const start = weightLossGoal.currentWeight;
    const target = weightLossGoal.targetWeight;
    const lost = start - latest;
    const toGo = latest - target;
    const pct = Math.min(100, Math.max(0, ((start - latest) / (start - target)) * 100));
    if (wlTextEl) wlTextEl.textContent = `${latest}kg → ${target}kg (${toGo > 0 ? toGo.toFixed(1) + 'kg to go' : '🎉 Goal reached!'})`;
    if (wlBarEl) wlBarEl.style.width = pct + '%';
  } else if (weightLossGoal) {
    if (wlTextEl) wlTextEl.textContent = `Goal: ${weightLossGoal.targetWeight}kg`;
  } else {
    if (wlTextEl) wlTextEl.textContent = 'Not set';
  }

  const recentEl = document.getElementById('recent-sessions-list');
  if (recentEl) {
    if (sessions.length === 0) {
      recentEl.innerHTML = `<div class="empty-state"><span class="empty-icon">${JBIcons.svg('dumbbell', { size: 32 })}</span><p>No sessions yet. Start your first workout!</p><button class="btn btn-primary" onclick="navigate('workouts')">Browse Workouts</button></div>`;
    } else {
      recentEl.innerHTML = sessions.slice(-3).reverse().map(s => sessionCardHTML(s)).join('');
    }
  }

  const grid = document.getElementById('quick-muscle-grid');
  if (grid) {
    grid.innerHTML = MUSCLE_GROUPS.filter(m => m !== 'All').map(m => `
      <div class="muscle-chip" onclick="navigate('workouts'); setMuscleFilter('${m}')">
        <span class="muscle-chip-icon">${(MUSCLE_EMOJIS[m] ? MUSCLE_EMOJIS[m](28) : JBIcons.svg('dumbbell', { size: 28 }))}</span>
        <span>${m}</span>
      </div>`).join('');
  }
  
  // Render PR lists on dashboard
  renderPRLists();
}

// ─── Workouts ────────────────────────────────────────────
function renderWorkouts() {
  renderMuscleChips();
  filterExercises();
  renderCustomWorkouts();
  renderWorkoutQueue();
  renderPRLists(); // Make sure PRs show in workouts tab
}

function renderMuscleChips() {
  const el = document.getElementById('muscle-chips');
  if (!el) return;
  el.innerHTML = MUSCLE_GROUPS.map(m =>
    `<button class="chip ${state.muscleFilter === m ? 'active' : ''}" onclick="setMuscleFilter('${m}')">${m}</button>`
  ).join('');
}

function setMuscleFilter(m) {
  state.muscleFilter = m;
  document.getElementById('exercise-search').value = ''; // clears search
  document.getElementById('autocomplete-list').style.display = 'none';
  expandedExerciseGroups.clear(); // fresh view: collapse all groups back to the first 4
  renderMuscleChips();
  filterExercises('');
}

// ─── Per-muscle-group pagination (performance: avoid rendering 50+ cards at once on phones) ───
const EXERCISE_GROUP_PREVIEW_COUNT = 4;
let expandedExerciseGroups = new Set();

// ─── Exercise View Modal state ────────────────────────────
let _evmInterval = null;
let _evmFrameIdx = 0;

function toggleExerciseGroupExpand(muscle) {
  expandedExerciseGroups.add(muscle);
  filterExercises();
}

function filterExercises() {
  const q = document.getElementById('exercise-search')?.value.toLowerCase() || '';
  const { prs } = getData();
  let exercises = EXERCISE_LIBRARY;
  if (state.muscleFilter !== 'All') exercises = exercises.filter(e => e.muscle === state.muscleFilter);
  if (q) exercises = exercises.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));

  const groups = {};
  exercises.forEach(e => { if (!groups[e.muscle]) groups[e.muscle] = []; groups[e.muscle].push(e); });

  const el = document.getElementById('exercise-list');
  if (!el) return;
  if (exercises.length === 0) { el.innerHTML = '<p class="muted-text">No exercises found.</p>'; return; }

  el.innerHTML = Object.entries(groups).map(([muscle, exs]) => {
    const isExpanded = expandedExerciseGroups.has(muscle);
    const visible = isExpanded ? exs : exs.slice(0, EXERCISE_GROUP_PREVIEW_COUNT);
    const remaining = exs.length - visible.length;
    const muscleKey = muscle.replace(/'/g, "\\'");

    return `
    <div class="exercise-group">
      <div class="exercise-group-title">${(MUSCLE_EMOJIS[muscle] ? MUSCLE_EMOJIS[muscle](16) : '')} ${muscle}</div>
      ${visible.map(e => `
        <div class="exercise-card" style="border-left: 3px solid ${MUSCLE_COLORS[muscle] || 'var(--accent)'}; cursor:pointer;" onclick="openExerciseViewModal('${e.id}')">
          <div class="exercise-info" style="flex:1">
            <div class="exercise-name">${escHtml(e.name)}</div>
            <div class="exercise-meta">${e.isCardio ? 'Cardio' : `${e.sets} sets × ${e.reps} reps · ${e.rest}s rest`}</div>
            ${prs[e.id] ? `<div class="exercise-pr">PR: ${prs[e.id].weight}kg</div>` : ''}
          </div>
          <button class="btn btn-primary exercise-add-btn" onclick="event.stopPropagation(); addToWorkoutQueue('${e.id}', '${escHtml(e.name)}')">+</button>
        </div>`).join('')}
      ${remaining > 0 ? `
        <button class="btn btn-sm btn-ghost load-more-exercises-btn" onclick="toggleExerciseGroupExpand('${muscleKey}')">
          ⬇ Load ${remaining} more ${escHtml(muscle)} exercise${remaining !== 1 ? 's' : ''}
        </button>` : ''}
    </div>`;
  }).join('');
}

function renderCustomWorkouts() {
  const { customWorkouts } = getData();
  const el = document.getElementById('custom-workouts-list');
  if (!el) return;
  if (!customWorkouts.length) { el.innerHTML = '<p class="muted-text">No custom workouts yet.</p>'; return; }
  el.innerHTML = customWorkouts.map(w => `
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
}

// Create / Edit Workout
document.getElementById('create-workout-btn').onclick = () => {
  state.editingWorkoutId = null;
  const titleEl = document.getElementById('workout-modal-title');
  if (titleEl) titleEl.textContent = 'Create Workout';
  ['wm-name','wm-sets','wm-reps','wm-rest','wm-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const muscleSelect = document.getElementById('wm-muscle');
  if (muscleSelect) muscleSelect.value = 'Chest';
  openModal('workout-modal');
};

function editWorkout(id) {
  const { customWorkouts } = getData();
  const w = customWorkouts.find(x => x.id === id);
  if (!w) return;
  state.editingWorkoutId = id;
  const titleEl = document.getElementById('workout-modal-title');
  if (titleEl) titleEl.textContent = 'Edit Workout';
  const nameEl = document.getElementById('wm-name');
  const muscleEl = document.getElementById('wm-muscle');
  const setsEl = document.getElementById('wm-sets');
  const repsEl = document.getElementById('wm-reps');
  const restEl = document.getElementById('wm-rest');
  const notesEl = document.getElementById('wm-notes');
  if (nameEl) nameEl.value = w.name;
  if (muscleEl) muscleEl.value = w.muscle;
  if (setsEl) setsEl.value = w.sets;
  if (repsEl) repsEl.value = w.reps;
  if (restEl) restEl.value = w.rest;
  if (notesEl) notesEl.value = w.notes || '';
  openModal('workout-modal');
}

function saveWorkout() {
  const name = document.getElementById('wm-name')?.value.trim();
  if (!name) { toast('Please enter a workout name'); return; }
  const w = {
    id: state.editingWorkoutId || 'cw_' + Date.now(),
    name,
    muscle: document.getElementById('wm-muscle')?.value || 'Full Body',
    sets: parseInt(document.getElementById('wm-sets')?.value) || 3,
    reps: parseInt(document.getElementById('wm-reps')?.value) || 10,
    rest: parseInt(document.getElementById('wm-rest')?.value) || 60,
    notes: document.getElementById('wm-notes')?.value.trim() || '',
  };
  let cw = getData().customWorkouts;
  if (state.editingWorkoutId) { cw = cw.map(x => x.id === state.editingWorkoutId ? w : x); }
  else { cw.push(w); }
  DB.set('customWorkouts', cw);
  closeModal('workout-modal');
  toast(state.editingWorkoutId ? 'Workout updated!' : 'Workout saved!');
  renderCustomWorkouts();
}

function deleteWorkout(id) {
  if (!confirm('Delete this workout?')) return;
  let cw = getData().customWorkouts.filter(x => x.id !== id);
  DB.set('customWorkouts', cw);
  toast('Workout deleted');
  renderCustomWorkouts();
}

// ─── Session Logging ─────────────────────────────────────
function startSessionForExercise(id) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === id);
  if (!ex) return;
  openSessionModal(ex);
}

function startSessionForCustom(id) {
  const { customWorkouts } = getData();
  const w = customWorkouts.find(x => x.id === id);
  if (!w) return;
  openSessionModal({ ...w, id: w.id });
}

function openSessionModal(exercise) {
  state.activeSession = { exercise, sets: [] };
  const titleEl = document.getElementById('session-modal-title');
  if (titleEl) titleEl.textContent = exercise.name;
  const body = document.getElementById('session-modal-body');
  const sets = exercise.sets || 3;
  const isCardio = exercise.isCardio;

  body.innerHTML = `
    <div class="session-exercise-title">
      <span>${escHtml(exercise.name)}</span>
    </div>
    ${isCardio ? renderCardioSessionInputs(exercise) : renderStrengthSessionInputs(exercise, sets)}
    ${restTimerMarkup()}
  `;

  openModal('session-modal');
}

// ─── Add an extra set row to the currently open session/queue modal ──────
// This only affects the current logging session — it does NOT change the
// exercise's stored `sets` count in the workout library or custom workouts.
function addSessionSetRow() {
  const container = document.getElementById('session-modal-body');
  if (!container) return;
  const rows = container.querySelectorAll('.set-row[id^="set-row-"]');
  const nextIndex = rows.length;
  const exercise = state.activeSession?.exercise;
  if (!exercise) return;

  const isQueued = !!state.activeSession.isQueued;
  const placeholder = (exercise.id === 'push-up' || exercise.id === 'pull-up') ? 'BW' : '0';
  const repsPlaceholder = exercise.reps || 10;
  const checkHandler = isQueued
    ? `toggleQueuedSetCheck(${nextIndex})`
    : `toggleSetCheck(${nextIndex}, ${exercise.rest || 60})`;

  const rowHtml = `
    <div class="set-row" id="set-row-${nextIndex}">
      <div class="set-num" id="set-num-${nextIndex}">${nextIndex + 1}</div>
      <input class="set-input" type="number" inputmode="decimal" pattern="[0-9]*" id="set-weight-${nextIndex}" placeholder="${placeholder}" step="0.5" />
      <input class="set-input" type="number" inputmode="numeric" pattern="[0-9]*" id="set-reps-${nextIndex}" placeholder="${repsPlaceholder}" />
      <div class="set-check" id="set-check-${nextIndex}" onclick="${checkHandler}"></div>
    </div>`;

  if (rows.length) {
    rows[rows.length - 1].insertAdjacentHTML('afterend', rowHtml);
  } else {
    const labels = container.querySelector('.set-labels');
    if (labels) labels.insertAdjacentHTML('afterend', rowHtml);
    else container.insertAdjacentHTML('afterbegin', rowHtml);
  }

  if (typeof SoundManager !== 'undefined') SoundManager.tap();
  toast('Set added ➕');
}
window.addSessionSetRow = addSessionSetRow;

function buildProgressiveOverloadTip(exercise) {
  if (!exercise || exercise.isCardio) return '';
  const history = getExerciseSessionHistory(exercise);
  if (!history.length) return '';

  const last = history[0].set;
  const targetReps = Number(exercise.reps) || 10;

  let tip = '';
  let icon = JBIcons.svg('chart-line', { size: 16 });

  if (last.weight > 0 && last.reps >= targetReps) {
    const jump = last.weight >= 40 ? 2.5 : 1;
    tip = `Last: ${formatKg(last.weight)}kg × ${last.reps} reps — try <strong>${formatKg(last.weight + jump)}kg</strong> today`;
    icon = '⬆️';
  } else if (last.weight > 0 && last.reps < targetReps) {
    tip = `Last: ${formatKg(last.weight)}kg × ${last.reps} reps — aim for <strong>${targetReps} reps</strong> today`;
    icon = JBIcons.svg('target', { size: 16 });
  } else if (last.weight === 0 && last.reps > 0) {
    tip = `Last: bodyweight × ${last.reps} reps — aim for <strong>${last.reps + 2} reps</strong> today`;
    icon = JBIcons.svg('target', { size: 16 });
  } else {
    return '';
  }

  return `
    <div class="overload-tip-card">
      <span class="overload-tip-icon">${icon}</span>
      <span class="overload-tip-text">${tip}</span>
    </div>
  `;
}

function renderStrengthSessionInputs(exercise, sets) {
  const isLb = state.weightUnit === 'lb';
  return `
    <div style="display:flex;justify-content:center;margin:6px 0 4px;">
      <button class="btn btn-sm add-set-btn" onclick="addSessionSetRow()" style="width:30%;">+ Add Set</button>
    </div>
    <div class="set-labels">
      <span>Set</span>
      <span style="display:flex;align-items:center;gap:6px;justify-content:center">
        Weight
        <button class="unit-toggle-btn" id="unit-toggle" onclick="toggleWeightUnit()" title="Switch unit">
          <span class="unit-option ${!isLb ? 'active' : ''}">kg</span>
          <span class="unit-sep">/</span>
          <span class="unit-option ${isLb ? 'active' : ''}">lb</span>
        </button>
      </span>
      <span>Reps</span>
      <span>
        <button class="check-all-btn" onclick="checkAllSets(${sets}, ${exercise.rest})" title="Mark all sets done">✓ All</button>
      </span>
    </div>
    ${Array.from({length: sets}, (_, i) => `
      <div class="set-row" id="set-row-${i}">
        <div class="set-num" id="set-num-${i}">${i+1}</div>
        <input class="set-input" type="number" inputmode="decimal" pattern="[0-9]*" id="set-weight-${i}" placeholder="${exercise.id === 'push-up' || exercise.id === 'pull-up' ? 'BW' : '0'}" step="0.5" />
        <input class="set-input" type="number" inputmode="numeric" pattern="[0-9]*" id="set-reps-${i}" placeholder="${exercise.reps}" />
        <div class="set-check" id="set-check-${i}" onclick="toggleSetCheck(${i}, ${exercise.rest})"></div>
      </div>`).join('')}
    <div style="margin-top:4px;font-size:12px;color:var(--text3)">Tap ✓ to mark set done · rest timer starts automatically</div>
    ${buildProgressiveOverloadTip(exercise)}
  `;
}

function toggleWeightUnit() {
  state.weightUnit = state.weightUnit === 'lb' ? 'kg' : 'lb';
  DB.set('weightUnit', state.weightUnit);
  const isLb = state.weightUnit === 'lb';

  // Update toggle button UI
  const btn = document.getElementById('unit-toggle');
  if (btn) {
    const opts = btn.querySelectorAll('.unit-option');
    if (opts[0]) opts[0].classList.toggle('active', !isLb); // kg
    if (opts[1]) opts[1].classList.toggle('active', isLb);  // lb
  }

  // Convert existing values in inputs
  const KG_TO_LB = 2.20462;
  const LB_TO_KG = 0.453592;
  let i = 0;
  while (true) {
    const input = document.getElementById('set-weight-' + i);
    if (!input) break;
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) {
      const converted = isLb ? (val * KG_TO_LB) : (val * LB_TO_KG);
      input.value = Math.round(converted * 4) / 4; // round to nearest 0.25
    }
    i++;
  }

  toast(`Switched to ${state.weightUnit}`);
}

function renderCardioSessionInputs(exercise) {
  return `
    <div class="form-group" style="margin-top:8px">
      <label class="form-label">Duration (minutes)</label>
      <input class="set-input" type="number" inputmode="numeric" pattern="[0-9]*" id="cardio-session-duration" placeholder="30" style="width:100%" />
    </div>
    <div class="form-group">
      <label class="form-label">Distance (km, optional)</label>
      <input class="set-input" type="number" inputmode="decimal" pattern="[0-9]*" id="cardio-session-distance" placeholder="5" step="0.1" style="width:100%" />
    </div>
    <div class="form-group">
      <label class="form-label">Intensity (1-10, optional)</label>
      <input class="set-input" type="number" inputmode="numeric" pattern="[0-9]*" id="cardio-session-intensity" placeholder="7" min="1" max="10" style="width:100%" />
    </div>
  `;
}

function toggleSetCheck(i, rest) {
  const check = document.getElementById('set-check-' + i);
  const num = document.getElementById('set-num-' + i);
  const isDone = check.classList.toggle('checked');
  num.classList.toggle('done', isDone);
  isDone ? (typeof SoundManager !== 'undefined' && SoundManager.check()) : (typeof SoundManager !== 'undefined' && SoundManager.uncheck());
  if (isDone && rest > 0) startRestTimer(rest);
}

function checkAllSets(totalSets, rest) {
  const rowCount = document.querySelectorAll('#session-modal-body .set-row[id^="set-row-"]').length || totalSets;
  for (let i = 0; i < rowCount; i++) {
    const check = document.getElementById('set-check-' + i);
    const num   = document.getElementById('set-num-' + i);
    if (check && !check.classList.contains('checked')) {
      check.classList.add('checked');
      if (num) num.classList.add('done');
    }
  }
  if (typeof SoundManager !== 'undefined') SoundManager.check();
  toast('All sets marked done ✅');
}

function checkAllQueuedSets(totalSets) {
  const rowCount = document.querySelectorAll('#session-modal-body .set-row[id^="set-row-"]').length || totalSets;
  for (let i = 0; i < rowCount; i++) {
    const check = document.getElementById('set-check-' + i);
    const num   = document.getElementById('set-num-' + i);
    if (check && !check.classList.contains('checked')) {
      check.classList.add('checked');
      if (num) num.classList.add('done');
    }
  }
  if (typeof SoundManager !== 'undefined') SoundManager.check();
  toast('All sets marked done ✅');
}

// ─── Rest Timer (ring + spinning loop + ticks + alarm) ───────────────
function restTimerMarkup() {
  return `
    <div class="rest-timer" id="rest-timer-box">
      <div class="rest-timer-ring" id="timer-ring" style="--progress:100">
        <div class="timer-display" id="timer-display">0:00</div>
      </div>
      <div class="timer-label" id="timer-label">REST · tap Skip to cut it short</div>
      <div class="rest-timer-actions">
        <button class="btn btn-sm btn-ghost" id="timer-skip-btn" onclick="skipTimer()">Skip</button>
        <button class="btn btn-sm btn-primary timer-finish-btn" id="timer-finish-btn" onclick="finishRestTimer()" style="display:none">🔇 Finish</button>
      </div>
    </div>
  `;
}

let timerInterval;
let timerAlarmInterval;
let timerTotalSeconds = 0;

function startRestTimer(seconds) {
  const box     = document.getElementById('rest-timer-box');
  const display = document.getElementById('timer-display');
  const ring    = document.getElementById('timer-ring');
  const label   = document.getElementById('timer-label');
  const skipBtn = document.getElementById('timer-skip-btn');
  const finishBtn = document.getElementById('timer-finish-btn');
  if (!box || !display) return;

  // Cancel any existing timer/alarm before starting a fresh one
  if (timerInterval) clearInterval(timerInterval);
  if (timerAlarmInterval) clearInterval(timerAlarmInterval);

  box.classList.remove('alerting');
  box.classList.add('active');
  if (label) label.textContent = 'REST · tap Skip to cut it short';
  if (skipBtn) skipBtn.style.display = '';
  if (finishBtn) finishBtn.style.display = 'none';

  timerTotalSeconds = seconds;
  let remaining = seconds;
  display.textContent = formatTime(remaining);
  if (ring) ring.style.setProperty('--progress', 100);

  timerInterval = setInterval(() => {
    remaining--;
    display.textContent = formatTime(Math.max(0, remaining));
    if (ring) ring.style.setProperty('--progress', Math.max(0, (remaining / timerTotalSeconds) * 100));
    bumpTimerTick();

    if (remaining > 0) {
      if (typeof SoundManager !== 'undefined') {
        remaining <= 3 ? SoundManager.timerTickWarn() : SoundManager.timerTick();
      }
    } else {
      clearInterval(timerInterval);
      startTimerAlarm();
    }
  }, 1000);
}

// Quick visual "tic" pulse on the digits, restarted every second to match the tick sound
function bumpTimerTick() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  display.classList.remove('tick-bump');
  void display.offsetWidth; // force reflow so the animation can restart
  display.classList.add('tick-bump');
}

// Rest period is over — flash + beep on a loop until the user taps Finish
function startTimerAlarm() {
  const box       = document.getElementById('rest-timer-box');
  const label     = document.getElementById('timer-label');
  const skipBtn   = document.getElementById('timer-skip-btn');
  const finishBtn = document.getElementById('timer-finish-btn');
  if (!box) return;

  box.classList.add('alerting');
  if (label) label.textContent = '⏰ Rest done — let\'s go!';
  if (skipBtn) skipBtn.style.display = 'none';
  if (finishBtn) finishBtn.style.display = '';

  if (typeof SoundManager !== 'undefined') SoundManager.timerDone();

  if (timerAlarmInterval) clearInterval(timerAlarmInterval);
  timerAlarmInterval = setInterval(() => {
    if (typeof SoundManager !== 'undefined') SoundManager.alarmBeep();
  }, 900);
}

// Stops the beeping alarm once the lifter is ready for the next set
function finishRestTimer() {
  if (timerAlarmInterval) { clearInterval(timerAlarmInterval); timerAlarmInterval = null; }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const box = document.getElementById('rest-timer-box');
  if (box) box.classList.remove('active', 'alerting');
  toast('💪 Back to it!');
}

function skipTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (timerAlarmInterval) { clearInterval(timerAlarmInterval); timerAlarmInterval = null; }
  document.getElementById('rest-timer-box')?.classList.remove('active', 'alerting');
}

function formatTime(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// ─── Standalone Rest Timer (Workouts page) ───────────────
let srtInterval = null;
let srtAlarmInterval = null;
let srtTotalSeconds = 0;
let srtRemaining = 0;
let srtPaused = false;

function srtStart(seconds) {
  // Clear any running timer first
  if (srtInterval) clearInterval(srtInterval);
  if (srtAlarmInterval) clearInterval(srtAlarmInterval);

  srtTotalSeconds = seconds;
  srtRemaining = seconds;
  srtPaused = false;

  const box       = document.getElementById('srt-box');
  const display   = document.getElementById('srt-display');
  const label     = document.getElementById('srt-label');
  const ring      = document.getElementById('srt-ring');
  const pauseBtn  = document.getElementById('srt-pause-btn');
  const finishBtn = document.getElementById('srt-finish-btn');

  if (!box || !display) return;

  box.style.display = '';
  box.classList.remove('alerting');
  if (label)     label.textContent   = 'resting…';
  if (pauseBtn)  { pauseBtn.style.display = ''; pauseBtn.textContent = '⏸ Pause'; }
  if (finishBtn) finishBtn.style.display = 'none';
  if (ring)      ring.style.setProperty('--progress', 100);
  display.textContent = formatTime(srtRemaining);

  if (typeof SoundManager !== 'undefined') SoundManager.tap();

  srtInterval = setInterval(() => {
    if (srtPaused) return;
    srtRemaining--;
    const pct = Math.max(0, (srtRemaining / srtTotalSeconds) * 100);
    display.textContent = formatTime(Math.max(0, srtRemaining));
    if (ring) ring.style.setProperty('--progress', pct);

    if (typeof SoundManager !== 'undefined') {
      srtRemaining <= 3 && srtRemaining > 0 ? SoundManager.timerTickWarn() : SoundManager.timerTick();
    }

    if (srtRemaining <= 0) {
      clearInterval(srtInterval);
      srtInterval = null;
      _srtStartAlarm();
    }
  }, 1000);
}

function srtStartCustom() {
  const val = parseInt(document.getElementById('srt-custom-input')?.value);
  if (!val || val < 1) { toast('Enter a valid duration in seconds'); return; }
  srtStart(val);
}

function _srtStartAlarm() {
  const box       = document.getElementById('srt-box');
  const label     = document.getElementById('srt-label');
  const pauseBtn  = document.getElementById('srt-pause-btn');
  const finishBtn = document.getElementById('srt-finish-btn');

  if (box) box.classList.add('alerting');
  if (label)     label.textContent    = '⏰ Rest done — let\'s go!';
  if (pauseBtn)  pauseBtn.style.display  = 'none';
  if (finishBtn) finishBtn.style.display = '';

  if (typeof SoundManager !== 'undefined') SoundManager.timerDone();

  if (srtAlarmInterval) clearInterval(srtAlarmInterval);
  srtAlarmInterval = setInterval(() => {
    if (typeof SoundManager !== 'undefined') SoundManager.alarmBeep();
  }, 900);
}

function srtSkip() {
  if (srtInterval)      { clearInterval(srtInterval);      srtInterval = null; }
  if (srtAlarmInterval) { clearInterval(srtAlarmInterval); srtAlarmInterval = null; }
  srtPaused = false;
  const box = document.getElementById('srt-box');
  if (box) { box.style.display = 'none'; box.classList.remove('alerting'); }
}

function srtTogglePause() {
  const btn = document.getElementById('srt-pause-btn');
  srtPaused = !srtPaused;
  if (btn) btn.textContent = srtPaused ? '▶ Resume' : '⏸ Pause';
}

function srtFinish() {
  if (srtAlarmInterval) { clearInterval(srtAlarmInterval); srtAlarmInterval = null; }
  if (srtInterval)      { clearInterval(srtInterval);      srtInterval = null; }
  srtPaused = false;
  const box = document.getElementById('srt-box');
  if (box) { box.style.display = 'none'; box.classList.remove('alerting'); }
  toast('💪 Back to it!');
}
// ─── End Standalone Rest Timer ───────────────────────────

function saveSession() {
  const ex = state.activeSession?.exercise;
  if (!ex) return;
  
  const isCardio = ex.isCardio;
  let sessionData;
  
  if (isCardio) {
    const duration = parseInt(document.getElementById('cardio-session-duration')?.value) || 0;
    const distance = parseFloat(document.getElementById('cardio-session-distance')?.value) || null;
    const intensity = parseInt(document.getElementById('cardio-session-intensity')?.value) || null;
    if (!duration) { toast('Please enter a duration'); return; }
    
    const calories = calculateCardioCalories(ex.name, duration, distance);
    
    sessionData = {
      id: 'sess_' + Date.now(),
      name: ex.name, date: new Date().toISOString(),
      type: 'cardio',
      exercises: [{ name: ex.name, duration, distance, intensity, calories }],
      totalSets: 1,
    };
    const cardioLog = getData().cardioLog;
    cardioLog.push({ type: ex.name, duration, distance, calories, date: new Date().toISOString() });
    DB.set('cardioLog', cardioLog);
    renderCalorieTracker();
    _debouncedSyncToCloud();
  } else {
    const sets = document.querySelectorAll('#session-modal-body .set-row[id^="set-row-"]').length || (ex.sets || 3);
    const loggedSets = [];
    let maxWeight = 0;
    const LB_TO_KG_S = 0.453592;
    const isLbS = state.weightUnit === 'lb';
    for (let i = 0; i < sets; i++) {
      let w = parseFloat(document.getElementById('set-weight-' + i)?.value) || 0;
      const r = parseInt(document.getElementById('set-reps-' + i)?.value) || 0;
      const done = document.getElementById('set-check-' + i)?.classList.contains('checked');
      // Always store in kg
      if (isLbS && w > 0) w = Math.round(w * LB_TO_KG_S * 100) / 100;
      loggedSets.push({ weight: w, reps: r, done });
      if (w > maxWeight) maxWeight = w;
    }
    const doneSets = loggedSets.filter(s => s.done).length;
    if (doneSets === 0) { toast('Complete at least one set!'); return; }
    
    const prs = getData().prs;
    if (!prs[ex.id] || maxWeight > prs[ex.id].weight) {
      prs[ex.id] = { weight: maxWeight, date: new Date().toISOString(), name: ex.name };
      DB.set('prs', prs);
      toast('🏆 New PR! ' + maxWeight + 'kg');
      renderPRLists();
    }
    
    sessionData = {
      id: 'sess_' + Date.now(),
      name: ex.name, date: new Date().toISOString(),
      type: 'strength',
      exercises: [{ id: ex.id, name: ex.name, sets: loggedSets }],
      totalSets: doneSets,
      maxWeight,
    };
  }
  
  const sessions = getData().sessions;
  sessions.push(sessionData);
  DB.set('sessions', sessions);
  skipTimer();
  closeModal('session-modal');
  toast('Session saved! 💪');
  
  if (state.activeSession?.isScheduled && state.scheduledSession) {
    const nextIndex = (state.scheduledCurrentIndex || 0) + 1;
    if (nextIndex < state.scheduledSession.workouts.length) {
      toast(`Next exercise: ${state.scheduledSession.workouts[nextIndex].name}`);
      startScheduledExercise(nextIndex);
    } else {
      toast("🎉 Complete! You finished your scheduled workout!");
      state.scheduledSession = null;
    }
  }
  
  if (state.currentPage === 'progress') renderProgress();
  if (state.currentPage === 'home') renderDashboard();
  if (state.currentPage === 'schedule') renderWeeklySchedule();


  
}

// ─── Progress ────────────────────────────────────────────
function renderProgress() {
  const { sessions, prs, weightLog } = getData();

  // ── Summary stats ──────────────────────────────────────
  const totalVolume = sessions.reduce((sum, s) => {
    (s.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(set => {
        if (set.done) sum += (set.weight || 0) * (set.reps || 1);
      });
    });
    return sum;
  }, 0);

  const totalSessEl = document.getElementById('prog-total-sessions');
  const totalVolEl  = document.getElementById('prog-total-volume');
  const totalPrsEl  = document.getElementById('prog-total-prs');
  if (totalSessEl) countUp(totalSessEl, sessions.length, 500);
  if (totalVolEl)  totalVolume >= 1000
    ? countUp(totalVolEl, totalVolume / 1000, 600, 'k')
    : countUp(totalVolEl, Math.round(totalVolume), 600);
  if (totalPrsEl)  countUp(totalPrsEl, Object.keys(prs).length, 400);

  populateChartSelect(sessions);
  renderChart();
  renderBodyWeightChart();
  renderWeeklyVolumeChart(sessions);
  renderPRs(prs);
  renderSessionHistory(sessions);
}

function populateChartSelect(sessions) {
  const select = document.getElementById('chart-exercise-select');
  if (!select) return;

  // Gather all exercise ids from ALL session types (full_session + strength)
  const exerciseMap = {};
  sessions.forEach(s => {
    (s.exercises || []).forEach(e => {
      if (!e.isCardio) {
        const key = e.id || e.name;
        exerciseMap[key] = e.name;
      }
    });
  });

  const ids = Object.keys(exerciseMap);
  const prev = select.value;

  const noData = document.getElementById('chart-no-data');
  const chartWrap = document.getElementById('chart-wrap');

  if (!ids.length) {
    select.innerHTML = '<option value="">No strength sessions yet</option>';
    if (noData) noData.style.display = 'block';
    if (chartWrap) chartWrap.style.display = 'none';
    return;
  }

  if (noData) noData.style.display = 'none';
  if (chartWrap) chartWrap.style.display = 'block';

  select.innerHTML = ids.map(id => `<option value="${id}">${escHtml(exerciseMap[id] || id)}</option>`).join('');
  if (prev && ids.includes(prev)) select.value = prev;
}

// ─── Exercise Max-Weight Chart ────────────────────────────
let chartInstance = null;
function renderChart() {
  const select = document.getElementById('chart-exercise-select');
  if (!select) return;
  const exId = select.value;
  const { sessions } = getData();
  const canvas = document.getElementById('progress-chart');
  if (!canvas) return;

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (!exId) return;

  const dataPoints = [];

  

  sessions.forEach(s => {
    (s.exercises || []).forEach(e => {
      if ((e.id || e.name) === exId && !e.isCardio) {
        const sets = e.sets || [];
        const maxW = sets.length ? Math.max(...sets.map(st => st.weight || 0).filter(w => w > 0)) : 0;
        if (maxW > 0) dataPoints.push({ x: formatDate(s.date), y: maxW, date: s.date });
      }
    });
  });

  // Sort by date
  dataPoints.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!dataPoints.length) {
    const noData = document.getElementById('chart-no-data');
    const chartWrap = document.getElementById('chart-wrap');
    if (noData) noData.style.display = 'block';
    if (chartWrap) chartWrap.style.display = 'none';
    return;
  }

  const noData = document.getElementById('chart-no-data');
  const chartWrap = document.getElementById('chart-wrap');
  if (noData) noData.style.display = 'none';
  if (chartWrap) chartWrap.style.display = 'block';

  // Find PR point index
  const maxVal = Math.max(...dataPoints.map(d => d.y));
  const pointColors = dataPoints.map(d => d.y === maxVal ? '#FFB830' : '#00E5A0');
  const pointSizes  = dataPoints.map(d => d.y === maxVal ? 8 : 5);

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dataPoints.map(d => d.x),
      datasets: [{
        label: 'Max Weight (kg)',
        data: dataPoints.map(d => d.y),
        borderColor: '#00E5A0',
        backgroundColor: 'rgba(0,229,160,0.08)',
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: pointSizes,
        pointHoverRadius: 8,
        tension: 0.35,
        fill: true,
        borderWidth: 2,
      }]
    },
    options: {  
      responsive: true,
      maintainAspectRatio: false,
      animation: {
    duration: isLowEnd() ? 0 : 500 // Disable animations on low‑end
  },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,24,0.95)',
          titleColor: '#8888A0',
          bodyColor: '#F0F0F5',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: ctx => `Max: ${ctx.parsed.y} kg`,
            afterLabel: ctx => ctx.parsed.y === maxVal ? '🏆 Personal Record!' : ''
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8888A0', font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#8888A0', font: { size: 10 }, callback: v => v + ' kg' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });


  
}

// ─── Body Weight Chart ────────────────────────────────────
let bodyWeightChartInstance = null;
function renderBodyWeightChart() {
  const canvas  = document.getElementById('body-weight-chart');
  const emptyEl = document.getElementById('body-weight-empty');
  const wrapEl  = document.getElementById('body-weight-chart-wrap');
  if (!canvas) return;

  const weightLog = DB.get('weightLog', []);
  if (bodyWeightChartInstance) { bodyWeightChartInstance.destroy(); bodyWeightChartInstance = null; }

  if (!weightLog.length) {
    if (wrapEl)  wrapEl.style.display  = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (wrapEl)  wrapEl.style.display  = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  const sorted = [...weightLog].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(e => formatDate(e.date));
  const values = sorted.map(e => e.weight);
  const minW   = Math.min(...values);
  const maxW   = Math.max(...values);
  const pointColors = values.map((v, i) => i === values.lastIndexOf(Math.min(...values)) ? '#00E5A0' : '#FF6B6B');

  bodyWeightChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Body Weight (kg)',
        data: values,
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255,107,107,0.07)',
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,24,0.95)',
          titleColor: '#8888A0',
          bodyColor: '#F0F0F5',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: { label: ctx => `Weight: ${ctx.parsed.y} kg` }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8888A0', font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#8888A0', font: { size: 10 }, callback: v => v + ' kg' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          suggestedMin: minW - 2,
          suggestedMax: maxW + 2,
        }
      }
    }
  });
}

// ─── Weekly Volume Bar Chart ──────────────────────────────
let weeklyChartInstance = null;
function renderWeeklyVolumeChart(sessions) {
  const canvas   = document.getElementById('weekly-volume-chart');
  const emptyEl  = document.getElementById('weekly-volume-empty');
  const wrapEl   = document.getElementById('weekly-chart-wrap');
  if (!canvas) return;

  if (weeklyChartInstance) { weeklyChartInstance.destroy(); weeklyChartInstance = null; }

  // Build last 8 weeks of data
  const weeks = {};
  const now = new Date();
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    // Week label: Mon of that week
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = mon.toISOString().split('T')[0];
    weeks[key] = { label: mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), volume: 0, sessions: 0 };
  }

  sessions.forEach(s => {
    const date = new Date(s.date);
    const day = date.getDay();
    const mon = new Date(date);
    mon.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const key = mon.toISOString().split('T')[0];
    if (weeks[key]) {
      weeks[key].sessions++;
      (s.exercises || []).forEach(ex => {
        (ex.sets || []).forEach(set => {
          if (set.done) weeks[key].volume += (set.weight || 0) * (set.reps || 1);
        });
      });
    }
  });

  const entries = Object.values(weeks);
  const hasData = entries.some(e => e.volume > 0 || e.sessions > 0);

  if (!hasData) {
    if (wrapEl)  wrapEl.style.display  = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (wrapEl)  wrapEl.style.display  = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  const maxVol = Math.max(...entries.map(e => e.volume));
  const barColors = entries.map(e => {
    if (e.volume === 0) return 'rgba(255,255,255,0.05)';
    if (e.volume === maxVol) return 'rgba(255,184,48,0.8)';
    return 'rgba(0,229,160,0.6)';
  });

  weeklyChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: entries.map(e => e.label),
      datasets: [{
        label: 'Volume (kg)',
        data: entries.map(e => e.volume),
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace('0.6', '1').replace('0.8', '1').replace('0.05', '0.1')),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,24,0.95)',
          titleColor: '#8888A0',
          bodyColor: '#F0F0F5',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const e = entries[ctx.dataIndex];
              return [`Volume: ${Math.round(ctx.parsed.y).toLocaleString()} kg`, `Sessions: ${e.sessions}`];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8888A0', font: { size: 9 }, maxRotation: 0 },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#8888A0', font: { size: 10 }, callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v },
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: true,
        }
      }
    }
  });
}

function renderPRs(prs) {
  const el = document.getElementById('prs-list');
  if (!el) return;
  const entries = Object.entries(prs);
  if (!entries.length) { el.innerHTML = '<p class="muted-text">Complete sessions to see your PRs.</p>'; return; }
  el.innerHTML = entries.sort((a,b) => new Date(b[1].date) - new Date(a[1].date)).map(([,pr]) => `
    <div class="pr-card">
      <div>
        <div class="pr-name">${escHtml(pr.name)}</div>
        <div class="pr-date">${formatDate(pr.date)}</div>
      </div>
      <div class="pr-weight">${pr.weight}kg</div>
    </div>`).join('');
}

function renderSessionHistory(sessions) {
  const el = document.getElementById('session-history-list');
  if (!el) return;
  if (!sessions.length) { 
    el.innerHTML = '<p class="muted-text">No sessions logged yet.</p>'; 
    return; 
  }
  
  // Sort sessions by date (newest first)
  const sortedSessions = [...sessions].reverse();
  
  el.innerHTML = sortedSessions.map((session, idx) => {
    // Count total exercises in this session
    const exerciseCount = session.exercises?.length || 0;
    const totalSets = session.totalSets || session.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
    
    return `
      <div class="session-card" onclick="viewSessionDetails(${sessions.length - 1 - idx})">
        <div class="session-card-header">
          <span class="session-card-name">${escHtml(session.name || 'Workout Session')}</span>
          <span class="session-card-date">${formatDate(session.date)}</span>
        </div>
        <div class="session-card-detail">${exerciseCount} exercise(s) · ${totalSets} sets</div>
        <div class="session-card-sets">
          ${session.exercises?.slice(0, 4).map(e => `<span class="session-set-tag">${escHtml(e.name)}</span>`).join('')}
          ${exerciseCount > 4 ? `<span class="session-set-tag">+${exerciseCount - 4} more</span>` : ''}
        </div>
        <button class="btn btn-sm btn-ghost" style="margin-top:8px;width:100%" onclick="event.stopPropagation(); viewSessionDetails(${sessions.length - 1 - idx})">
          ${JBIcons.svg('eye', { size: 14 })} View Full Session
        </button>
      </div>
    `;
  }).join('');
}

// ─── Goals ───────────────────────────────────────────────
function renderGoals() {
  renderWeeklyGoals();
  renderWeightLossGoal();
  renderCardioGoals();
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// Weekly Goals
document.getElementById('add-goal-btn').onclick = () => {
  const allEx = [...EXERCISE_LIBRARY, ...getData().customWorkouts];
  const select = document.getElementById('gm-exercise');
  if (select) {
    select.innerHTML = allEx.map(e => `<option value="${e.id}">${escHtml(e.name)}</option>`).join('');
  }
  const weightInput = document.getElementById('gm-weight');
  if (weightInput) weightInput.value = '';
  openModal('goal-modal');
};

function saveGoal() {
  const exId = document.getElementById('gm-exercise')?.value;
  const weight = parseFloat(document.getElementById('gm-weight')?.value);
  if (!weight) { toast('Enter a target weight'); return; }
  const allEx = [...EXERCISE_LIBRARY, ...getData().customWorkouts];
  const ex = allEx.find(e => e.id === exId);
  const goals = getData().weeklyGoals;
  const weekStart = getWeekStart();
  const existing = goals.findIndex(g => g.exId === exId && g.weekStart === weekStart);
  const goal = { id: 'goal_' + Date.now(), exId, exName: ex?.name || exId, targetWeight: weight, weekStart, createdAt: new Date().toISOString() };
  if (existing >= 0) goals[existing] = goal;
  else goals.push(goal);
  DB.set('weeklyGoals', goals);
  closeModal('goal-modal');
  toast('Goal set!');
  renderWeeklyGoals();
  _debouncedSyncToCloud();

}

function renderWeeklyGoals() {
  const { weeklyGoals, prs } = getData();
  const el = document.getElementById('weekly-goals-list');
  if (!el) return;
  const weekStart = getWeekStart();
  const thisWeek = weeklyGoals.filter(g => g.weekStart === weekStart);
  if (!thisWeek.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">${JBIcons.svg('target', { size: 32 })}</span><p>Set a weight target for any exercise this week.</p></div>`;
    return;
  }
  el.innerHTML = thisWeek.map(g => {
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
}

function deleteGoal(id) {
  DB.set('weeklyGoals', getData().weeklyGoals.filter(g => g.id !== id));
  toast('Goal removed');
  renderWeeklyGoals();
  _debouncedSyncToCloud();

}

// Weight Loss Goal
function saveWeightLossGoal() {
  const current = parseFloat(document.getElementById('wl-current')?.value);
  const target = parseFloat(document.getElementById('wl-target')?.value);
  const date = document.getElementById('wl-date')?.value;
  if (!current || !target || !date) { toast('Fill in all fields'); return; }
  if (target >= current) { toast('Target should be less than current weight'); return; }
  DB.set('weightLossGoal', { currentWeight: current, targetWeight: target, targetDate: date, createdAt: new Date().toISOString() });
  toast('Weight loss goal saved!');
  renderWeightLossGoal();
  _debouncedSyncToCloud();

}

function logWeight() {
  const w = parseFloat(document.getElementById('wl-log-weight')?.value);
  if (!w) { toast('Enter a weight'); return; }
  const log = getData().weightLog;
  log.push({ weight: w, date: new Date().toISOString() });
  DB.set('weightLog', log);
  const weightInput = document.getElementById('wl-log-weight');
  if (weightInput) weightInput.value = '';
  toast('Weight logged!');
  renderWeightLossGoal();
  renderDashboard();
  _debouncedSyncToCloud();

}

function renderWeightLossGoal() {
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

    displayEl.innerHTML = `
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
      </div>`;
  } else if (weightLossGoal && displayEl) {
    displayEl.innerHTML = `<div class="card"><p class="muted-text">Log your weight to track progress.</p></div>`;
  } else if (displayEl) {
    displayEl.innerHTML = '';
  }

  if (historyEl) {
    historyEl.innerHTML = [...weightLog].reverse().slice(0, 10).map(entry => `
      <div class="weight-log-item">
        <span class="weight-log-val">${entry.weight} kg</span>
        <span class="weight-log-date">${formatDate(entry.date)}</span>
      </div>`).join('') || '<p class="muted-text">No weight entries yet.</p>';
  }
}

// Cardio Goals
function saveCardioGoal() {
  const minutes = parseInt(document.getElementById('cardio-goal-min')?.value) || 0;
  const sessions = parseInt(document.getElementById('cardio-goal-sessions')?.value) || 0;
  if (!minutes && !sessions) { toast('Enter at least one goal'); return; }
  DB.set('cardioGoal', { minutesPerWeek: minutes, sessionsPerWeek: sessions, createdAt: new Date().toISOString() });
  toast('Cardio goal saved!');
  renderCardioGoals();
  _debouncedSyncToCloud();

}

function logCardio() {
  const type     = document.getElementById('cardio-log-type')?.value || 'Other';
  const duration = parseInt(document.getElementById('cardio-log-duration')?.value)   || 0;
  const distance = parseFloat(document.getElementById('cardio-log-distance')?.value) || null;
  // Use manually entered calories OR auto-calculate using MET formula
  const manualCalories = parseInt(document.getElementById('cardio-log-calories')?.value) || 0;
  const calories = manualCalories > 0 ? manualCalories : calculateCardioCalories(type, duration, distance);
  if (!duration) { toast('Enter duration'); return; }
  const log = getData().cardioLog;
  log.push({ type, duration, distance, calories, date: new Date().toISOString() });
  DB.set('cardioLog', log);
  const durationInput = document.getElementById('cardio-log-duration');
  const distanceInput = document.getElementById('cardio-log-distance');
  const caloriesInput = document.getElementById('cardio-log-calories');
  if (durationInput) durationInput.value = '';
  if (distanceInput) distanceInput.value = '';
  if (caloriesInput) caloriesInput.value = '';
  toast(`Cardio logged! 🏃 ~${calories} kcal burned`);
  renderCardioGoals();
  renderCalorieTracker();
  if (getAuthUser()) _debouncedSyncToCloud();
}

function renderCardioGoals() {
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
    if (cardioGoal) {
      const minPct = cardioGoal.minutesPerWeek ? Math.min(100, Math.round((totalMin / cardioGoal.minutesPerWeek) * 100)) : 0;
      const sessPct = cardioGoal.sessionsPerWeek ? Math.min(100, Math.round((totalSessions / cardioGoal.sessionsPerWeek) * 100)) : 0;
      progressEl.innerHTML = `
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
        </div>`;
    } else {
      progressEl.innerHTML = `<div class="card" style="margin-bottom:16px"><p class="muted-text">Set a cardio goal above to track progress.</p></div>`;
    }
  }

  const historyEl = document.getElementById('cardio-history');
  if (historyEl) {
    if (!thisWeekCardio.length) {
      historyEl.innerHTML = '<p class="muted-text">No cardio logged this week.</p>';
      return;
    }
    historyEl.innerHTML = [...thisWeekCardio].reverse().map(c => `
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
  }
}

// ─── Water ────────────────────────────────────────────────
function renderWater() {
  const { settings, waterLog } = getData();
  const goal = settings.waterGoal || 2000;
  const today = getTodayWater(waterLog);
  const pct = Math.min(100, (today / goal) * 100);
  const goalHit = today >= goal;

  // Fix: Water fill should be height from bottom
  const waterFill = document.getElementById('water-fill');
  if (waterFill) {
    waterFill.style.height = pct + '%';
  }

  // ── Goal-reached glow ──────────────────────────────────────
  const bottle = document.getElementById('water-fill')?.closest('.water-bottle') ||
                 document.querySelector('.water-bottle');
  const pctEl  = document.getElementById('water-pct');

  if (bottle)  bottle.classList.toggle('goal-reached', goalHit);
  if (pctEl)   pctEl.classList.toggle('goal-reached', goalHit);

  // ── Dashboard water bar glow ───────────────────────────────
  const dashBar = document.getElementById('dash-water-bar');
  if (dashBar) dashBar.classList.toggle('goal-reached', goalHit);

  // ── Play fanfare once per goal crossing ────────────────────
  const todayKey = new Date().toISOString().split('T')[0];
  const celebKey = `jimbuddy_water_goal_celebrated_${todayKey}`;
  if (goalHit && !sessionStorage.getItem(celebKey)) {
    sessionStorage.setItem(celebKey, '1');
    if (typeof SoundManager !== 'undefined' && SoundManager.goalReached) {
      setTimeout(() => SoundManager.goalReached(), 120);
    }
    // Spawn bubble particles inside the bottle
    if (bottle) _spawnWaterBubbles(bottle);
    setTimeout(() => toast('🎉 Water goal reached! Great job!'), 200);
  }

  // ── Text fields ────────────────────────────────────────────
  const currentMl  = document.getElementById('water-current-ml');
  const goalDisplay = document.getElementById('water-goal-display');
  const goalInput   = document.getElementById('water-goal-input');
  if (currentMl)   currentMl.textContent  = today;
  if (goalDisplay) goalDisplay.textContent = goal;
  if (goalInput)   goalInput.value         = goal;
  if (pctEl)       pctEl.textContent       = Math.round(pct) + '%';

  // Log
  const todayLogs = waterLog.filter(l => l.date.startsWith(new Date().toISOString().split('T')[0]));
  const el = document.getElementById('water-log-list');
  if (el) {
    el.innerHTML = todayLogs.length
      ? [...todayLogs].reverse().map(l => `
          <div class="water-log-item">
            <span class="water-log-amount">+${l.amount}ml</span>
            <span class="water-log-time">${formatTime12(l.date)}</span>
          </div>`).join('')
      : '<p class="muted-text">No water logged today yet.</p>';
  }
}

// ─── Bubble particle burst inside the water bottle on goal hit ───
function _spawnWaterBubbles(bottleEl) {
  // Skip on low-end devices or reduced-motion
  if (document.body.classList.contains('low-end') ||
      document.body.classList.contains('performance-mode') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const count = 8;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const b = document.createElement('div');
      b.className = 'water-goal-bubble';
      b.style.left = (15 + Math.random() * 70) + '%';
      b.style.width  = (4 + Math.random() * 5) + 'px';
      b.style.height = b.style.width;
      b.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
      b.style.animationDelay   = (Math.random() * 0.2) + 's';
      bottleEl.appendChild(b);
      // Remove after animation completes
      setTimeout(() => b.remove(), 1600);
    }, i * 60);
  }
}

function addWater(ml) {
  const log = getData().waterLog;
  log.push({ amount: ml, date: new Date().toISOString() });
  DB.set('waterLog', log);
  if (typeof SoundManager !== 'undefined') SoundManager.waterSplash();
  toast(`+${ml}ml 💧`);
  renderWater();
  updateDashWater();
  _debouncedSyncToCloud();

}

function addWaterCustom() {
  const val = parseInt(document.getElementById('water-custom-amount')?.value);
  if (!val || val <= 0) { toast('Enter a valid amount'); return; }
  const customInput = document.getElementById('water-custom-amount');
  if (customInput) customInput.value = '';
  addWater(val);
  _debouncedSyncToCloud();

}

function setWaterGoal() {
  const goal = parseInt(document.getElementById('water-goal-input')?.value);
  if (!goal || goal <= 0) { toast('Enter a valid goal'); return; }
  const settings = getData().settings;
  settings.waterGoal = goal;
  DB.set('settings', settings);
  toast('Water goal updated!');
  renderWater();
}

function resetWater() {
  if (!confirm('Reset today\'s water intake?')) return;
  const today = new Date().toISOString().split('T')[0];
  const log = getData().waterLog.filter(l => !l.date.startsWith(today));
  DB.set('waterLog', log);
  toast('Water reset');
  renderWater();
    syncUserDataToCloud();

}

function updateDashWater() {
  if (state.currentPage === 'home') renderDashboard();
}

// ─── Calorie Calculator Functions ─────────────────────────

let selectedSex = 'male';

function selectSex(sex) {
  selectedSex = sex;
  document.querySelectorAll('.sex-btn').forEach(btn => {
    if (btn.dataset.sex === sex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function calculateCalories() {
  // Get values
  const age = parseInt(document.getElementById('calc-age')?.value);
  const weight = parseFloat(document.getElementById('calc-weight')?.value);
  const height = parseFloat(document.getElementById('calc-height')?.value);
  const activity = parseFloat(document.getElementById('calc-activity')?.value);
  const goal = document.getElementById('calc-goal')?.value;
  
  // Validation
  if (!age || !weight || !height) {
    toast('Please fill in all fields');
    return;
  }
  
  if (age < 15 || age > 120) {
    toast('Please enter a valid age (15-120)');
    return;
  }
  
  if (weight < 30 || weight > 300) {
    toast('Please enter a valid weight (30-300 kg)');
    return;
  }
  
  if (height < 100 || height > 250) {
    toast('Please enter a valid height (100-250 cm)');
    return;
  }
  
  // Calculate BMR using Mifflin-St Jeor Formula
  let bmr;
  if (selectedSex === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  
  // Calculate maintenance calories
  const maintenance = Math.round(bmr * activity);
  
  // Calculate goal calories
  let goalCalories = maintenance;
  let goalText = '';
  
  switch(goal) {
    case 'maintain':
      goalCalories = maintenance;
      goalText = 'Maintain weight';
      break;
    case 'lose':
      goalCalories = maintenance - 500;
      goalText = 'Lose weight (0.5kg/week)';
      break;
    case 'lose-aggressive':
      goalCalories = maintenance - 1000;
      goalText = 'Lose weight fast (1kg/week)';
      break;
    case 'gain':
      goalCalories = maintenance + 300;
      goalText = 'Gain weight (slow bulk)';
      break;
    case 'gain-aggressive':
      goalCalories = maintenance + 500;
      goalText = 'Gain muscle (lean bulk)';
      break;
  }
  
  // Ensure minimum calories
  if (goalCalories < 1200) {
    goalCalories = 1200;
    toast('Minimum recommended calories is 1200 per day');
  }
  
  // Calculate BMI
  const heightM = height / 100;
  const bmi = (weight / (heightM * heightM)).toFixed(1);
  let bmiCategory = '';
  if (bmi < 18.5) bmiCategory = 'Underweight';
  else if (bmi < 25) bmiCategory = 'Normal weight';
  else if (bmi < 30) bmiCategory = 'Overweight';
  else bmiCategory = 'Obese';
  
  // Calculate macros
  const proteinG = Math.round(weight * 1.8);
  const fatG = Math.round(goalCalories * 0.25 / 9);
  const carbsG = Math.round((goalCalories - (proteinG * 4) - (fatG * 9)) / 4);
  
  // Display results
  const bmrEl = document.getElementById('result-bmr');
  const maintenanceEl = document.getElementById('result-maintenance');
  const goalEl = document.getElementById('result-goal');
  const bmiDisplay = document.getElementById('bmi-display');
  const macroEl = document.getElementById('macro-recommendation');
  
  if (bmrEl) bmrEl.textContent = Math.round(bmr);
  if (maintenanceEl) maintenanceEl.textContent = maintenance;
  if (goalEl) goalEl.textContent = goalCalories;
  
  if (bmiDisplay) {
    bmiDisplay.innerHTML = `
      <span class="bmi-value">BMI: ${bmi}</span>
      <span class="bmi-category">(${bmiCategory})</span>
    `;
  }
  
  if (macroEl) {
    macroEl.innerHTML = `
      <div class="macro-row"><span class="macro-name">💪 Protein</span><span class="macro-value">${proteinG}g (${Math.round(proteinG * 4)} kcal)</span></div>
      <div class="macro-row"><span class="macro-name">🍚 Carbs</span><span class="macro-value">${carbsG}g (${Math.round(carbsG * 4)} kcal)</span></div>
      <div class="macro-row"><span class="macro-name">🧈 Fats</span><span class="macro-value">${fatG}g (${Math.round(fatG * 9)} kcal)</span></div>
      <div class="macro-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--card-border);">
        <span class="macro-name">🎯 Goal</span>
        <span class="macro-value">${goalText}</span>
      </div>
    `;
  }
  
  // Store calculation results
  state.lastCalculation = {
    calories: goalCalories,
    protein: proteinG,
    carbs: carbsG,
    fats: fatG,
    bmr: Math.round(bmr),
    maintenance: maintenance
  };
  
  // Show results
  const resultsDiv = document.getElementById('calculator-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  
  // Scroll to results
  if (resultsDiv) resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  toast('Calculation complete!');
}

function saveCalculatorProfile() {
  const age = document.getElementById('calc-age')?.value;
  const weight = document.getElementById('calc-weight')?.value;
  const height = document.getElementById('calc-height')?.value;
  const activitySelect = document.getElementById('calc-activity');
  const activity = activitySelect?.options[activitySelect.selectedIndex]?.text;
  const goalSelect = document.getElementById('calc-goal');
  const goal = goalSelect?.options[goalSelect.selectedIndex]?.text;
  
  if (!age || !weight || !height) {
    toast('Please calculate your calories first');
    return;
  }
  
  const profile = {
    age: parseInt(age),
    weight: parseFloat(weight),
    height: parseFloat(height),
    sex: selectedSex,
    activity: activity,
    goal: goal,
    savedAt: new Date().toISOString()
  };
  
  DB.set('calculatorProfile', profile);
  
  if (state.lastCalculation) {
    DB.set('lastCalculation', state.lastCalculation);
  }
  
  displaySavedProfile();
  toast('Profile saved!');
    syncUserDataToCloud();

}

function displaySavedProfile() {
  const profile = DB.get('calculatorProfile', null);
  const lastCalc = DB.get('lastCalculation', null);
  const savedProfileDiv = document.getElementById('saved-profile');
  const savedInfoDiv = document.getElementById('saved-profile-info');
  
  if (profile && savedProfileDiv && savedInfoDiv) {
    savedProfileDiv.style.display = 'block';
    savedInfoDiv.innerHTML = `
      <div>${JBIcons.svg('user', { size: 16 })} ${profile.sex === 'male' ? 'Male' : 'Female'}, ${profile.age} years</div>
      <div>${JBIcons.svg('scale', { size: 16 })} ${profile.weight} kg · 📏 ${profile.height} cm</div>
      <div>🏃 ${profile.activity}</div>
      <div>${JBIcons.svg('target', { size: 16 })} ${profile.goal}</div>
      ${lastCalc ? `<div style="margin-top:8px;color:var(--accent)">${JBIcons.svg('flame', { size: 16 })} ${lastCalc.calories} kcal/day</div>` : ''}
    `;
  } else if (savedProfileDiv) {
    savedProfileDiv.style.display = 'none';
  }
}

function clearSavedProfile() {
  if (confirm('Clear your saved profile?')) {
    DB.set('calculatorProfile', null);
    DB.set('lastCalculation', null);
    displaySavedProfile();
    toast('Profile cleared');
  }
}

function loadSavedProfile() {
  const profile = DB.get('calculatorProfile', null);
  if (profile) {
    const ageInput = document.getElementById('calc-age');
    const weightInput = document.getElementById('calc-weight');
    const heightInput = document.getElementById('calc-height');
    if (ageInput) ageInput.value = profile.age;
    if (weightInput) weightInput.value = profile.weight;
    if (heightInput) heightInput.value = profile.height;
    selectSex(profile.sex);
    
    const activitySelect = document.getElementById('calc-activity');
    if (activitySelect) {
      for (let i = 0; i < activitySelect.options.length; i++) {
        if (activitySelect.options[i].text === profile.activity) {
          activitySelect.selectedIndex = i;
          break;
        }
      }
    }
    
    const goalSelect = document.getElementById('calc-goal');
    if (goalSelect) {
      for (let i = 0; i < goalSelect.options.length; i++) {
        if (goalSelect.options[i].text === profile.goal) {
          goalSelect.selectedIndex = i;
          break;
        }
      }
    }
    
    toast('Profile loaded!');
  } else {
    toast('No saved profile found');
  }
}

function applyToCalorieTracker() {
  if (!state.lastCalculation) {
    toast('Please calculate your calories first');
    return;
  }
  
  const goals = {
    calories: state.lastCalculation.calories,
    protein: state.lastCalculation.protein,
    carbs: state.lastCalculation.carbs,
    fats: state.lastCalculation.fats
  };
  
  DB.set('calorieGoals', goals);
  renderCalorieTracker();
  toast(`Calorie goal set to ${goals.calories} kcal!`);
  
  // Navigate to calorie tracker
  navigate('calorie');
}

// Force numeric keyboard on mobile devices
function setupNumericInputs() {
  // Select all number inputs without inputmode
  document.querySelectorAll('input[type="number"]').forEach(input => {
    if (!input.hasAttribute('inputmode')) {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9]*');
    }
  });
}

// ─── Workout Queue System ───────────────────────────────────

let workoutQueue = [];

// Load queue from localStorage
function loadWorkoutQueue() {
  const saved = DB.get('workoutQueue', []);
  workoutQueue = saved;
  renderWorkoutQueue();
}

// Save queue to localStorage
function saveWorkoutQueue() {
  DB.set('workoutQueue', workoutQueue);
  renderWorkoutQueue();
}

// Add exercise to queue
function addToWorkoutQueue(exerciseId, exerciseName) {
  // Find the exercise data
  const allExercises = [...EXERCISE_LIBRARY, ...(getData().customWorkouts || [])];
  const exercise = allExercises.find(e => e.id === exerciseId);
  if (!exercise) return;
  
  // Check if already in queue
  if (workoutQueue.some(item => item.id === exerciseId)) {
    toast(`${exercise.name} is already in your queue`);
    return;
  }
  
  // Add to queue
  workoutQueue.push({
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets || 3,
    reps: exercise.reps || 10,
    rest: exercise.rest || 60,
    isCardio: exercise.isCardio || false,
    muscle: exercise.muscle || 'General',
    completed: false,
    loggedSets: [],
    maxWeight: 0
  });
  
  saveWorkoutQueue();
  toast(`➕ Added ${exercise.name} to queue`);
  
  if (typeof SoundManager !== 'undefined') SoundManager.success();
}

// Remove exercise from queue
function removeFromQueue(index) {
  const removed = workoutQueue[index];
  workoutQueue.splice(index, 1);
  saveWorkoutQueue();
  toast(`Removed ${removed.name} from queue`);
  if (typeof SoundManager !== 'undefined') SoundManager.error();
}

// Clear entire queue
function clearWorkoutQueue() {
  if (confirm('Clear your entire workout queue?')) {
    workoutQueue = [];
    saveWorkoutQueue();
    toast('Queue cleared');
  }
}

// Render queue list
function renderWorkoutQueue() {
  const container = document.getElementById('workout-queue-list');
  const countEl = document.getElementById('queue-count');
  const actionsEl = document.getElementById('queue-actions');
  
  if (!container) return;
  
  const incompleteCount = workoutQueue.filter(item => !item.completed).length;
  const totalCount = workoutQueue.length;
  
  if (countEl) countEl.textContent = `${incompleteCount}/${totalCount}`;
  
  if (workoutQueue.length === 0) {
    container.innerHTML = '<div class="queue-empty">No exercises added. Tap + on any exercise to add to queue.</div>';
    if (actionsEl) actionsEl.style.display = 'none';
    return;
  }
  
  if (actionsEl) actionsEl.style.display = 'flex';
  
  container.innerHTML = workoutQueue.map((item, idx) => {
    // Calculate how many sets have data
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

  // Attach swipe-to-delete on every rendered item
  container.querySelectorAll('.workout-queue-item[data-queue-idx]').forEach(el => {
    attachQueueSwipe(el);
  });
}

// ─── Swipe-to-delete for queue items (touch + mouse) ──────────────────────────
function attachQueueSwipe(el) {
  const DELETE_THRESHOLD = 80; // px left-drag before delete fires
  const inner = el.querySelector('.queue-swipe-inner');
  const hint  = el.querySelector('.queue-swipe-delete-hint');

  let startX   = 0;
  let startY   = 0;
  let curX     = 0;
  let active   = false; // a drag is in progress
  let axisLocked = false; // confirmed horizontal
  let isTouch  = false;

  // Prevent browser native drag-and-drop behavior
  el.addEventListener('dragstart', e => {
    e.preventDefault();
  });

  // ── helpers ────────────────────────────────────────────────
  function begin(clientX, clientY, touch = false) {
    startX     = clientX;
    startY     = clientY;
    curX       = 0;
    active     = true;
    axisLocked = false;
    isTouch    = touch;
    if (inner) inner.style.transition = 'none';
    el.style.transition = 'none';
    console.log("[SwipeDiag] Drag began:", { startX, startY, isTouch, el });
  }

  function move(clientX, clientY) {
    if (!active) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    // Decide axis on first 6px of movement
    if (!axisLocked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // too early
      if (isTouch && Math.abs(dy) >= Math.abs(dx)) {
        console.log("[SwipeDiag] Vertical scroll detected; cancelling drag.", { dx, dy });
        // vertical — cancel and let the scroll handle it
        active = false;
        snap(true);
        return;
      }
      axisLocked = true;
      console.log("[SwipeDiag] Horizontal drag locked.");
    }

    // Only left swipe
    curX = Math.min(0, dx);
    const maxSwipe = el.offsetWidth || 300;
    const pct = Math.min(1, -curX / maxSwipe);
    const deletePct = Math.min(1, -curX / DELETE_THRESHOLD);

    if (inner) inner.style.transform = `translateX(${curX}px)`;

    // Dynamic red background transition
    el.style.background  = `rgba(255, 71, 87, ${Math.min(1, pct * 2).toFixed(3)})`;
    el.style.borderColor = deletePct > 0.15
      ? `rgba(255, 71, 87, ${(0.3 + deletePct * 0.7).toFixed(3)})`
      : '';

    if (hint) hint.style.opacity = deletePct.toFixed(3);
    console.log("[SwipeDiag] Drag moving:", { dx, curX, pct: pct.toFixed(2), deletePct: deletePct.toFixed(2) });
  }

  function end() {
    if (!active) return;
    console.log("[SwipeDiag] Drag ended at:", curX, "Threshold:", DELETE_THRESHOLD);
    active     = false;
    axisLocked = false;

    if (-curX >= DELETE_THRESHOLD) {
      deleteItem();
    } else {
      snap(true);
    }
  }

  function snap(animate) {
    console.log("[SwipeDiag] Snapping item back to origin.");
    if (inner) {
      inner.style.transition = animate
        ? 'transform 0.28s cubic-bezier(0.34,1.2,0.64,1)'
        : 'none';
      inner.style.transform = '';
    }
    el.style.transition = animate
      ? 'background 0.2s ease, border-color 0.2s ease'
      : 'none';
    el.style.background  = '';
    el.style.borderColor = '';
    if (hint) hint.style.opacity = '0';
  }

  function deleteItem() {
    console.log("[SwipeDiag] Triggering item delete animations.");
    // 1. slide inner fully off
    if (inner) {
      inner.style.transition = 'transform 0.22s ease-in';
      inner.style.transform  = 'translateX(-105%)';
    }
    // 2. collapse the row height after inner slides out
    setTimeout(() => {
      const h = el.offsetHeight;
      el.style.overflow   = 'hidden';
      el.style.maxHeight  = h + 'px';
      el.style.transition = 'max-height 0.25s ease, opacity 0.2s ease, padding 0.25s ease';
      requestAnimationFrame(() => {
        el.style.maxHeight    = '0';
        el.style.paddingTop   = '0';
        el.style.paddingBottom = '0';
        el.style.opacity      = '0';
      });
      // 3. actually remove from data after collapse finishes
      setTimeout(() => {
        console.log("[SwipeDiag] Row collapsed. Removing index from data queue:", el.dataset.queueIdx);
        removeFromQueue(parseInt(el.dataset.queueIdx, 10));
      }, 270);
    }, 200);
  }

  // ── Touch ──────────────────────────────────────────────────
  el.addEventListener('touchstart', e => {
    // don't hijack button taps
    if (e.target.closest('button')) return;
    begin(e.touches[0].clientX, e.touches[0].clientY, true);
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!active) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    // only prevent scroll once we're confident it's a horizontal drag
    if (axisLocked || dx > dy) e.preventDefault();
    move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  el.addEventListener('touchend',    () => end());
  el.addEventListener('touchcancel', () => { active = false; snap(true); });

  // ── Mouse ──────────────────────────────────────────────────
  // Use the list CONTAINER's mousedown so it doesn't get blocked by buttons
  // We store a flag on the element so we only wire this once
  if (el._swipeMouseBound) return;
  el._swipeMouseBound = true;

  el.addEventListener('mousedown', e => {
    // ignore button clicks — let them fire normally
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault(); // prevent text selection while dragging

    begin(e.clientX, e.clientY, false);

    const onMove = ev => move(ev.clientX, ev.clientY);
    const onUp   = () => {
      end();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}


// Open modal to log sets for a queued exercise
function openQueueExerciseModal(queueIndex) {
  const exercise = workoutQueue[queueIndex];
  if (!exercise) return;
  
  state.activeQueueIndex = queueIndex;
  state.activeSession = { 
    exercise: exercise, 
    sets: exercise.loggedSets || [],
    isQueued: true 
  };
  
  const titleEl = document.getElementById('session-modal-title');
  if (titleEl) titleEl.textContent = `Log: ${exercise.name}`;
  const body = document.getElementById('session-modal-body');
  const sets = exercise.sets || 3;
  const isCardio = exercise.isCardio;
  
  // Pre-fill existing logged sets
  let setsHtml = '';
  if (!isCardio) {
    const isLb = state.weightUnit === 'lb';
    const KG_TO_LB = 2.20462;
    setsHtml = `
      <div style="display:flex;justify-content:center;margin:6px 0 4px;">
        <button class="btn btn-sm add-set-btn" onclick="addSessionSetRow()" style="width:30%;">+ Add Set</button>
      </div>
      <div class="set-labels">
        <span>Set</span>
        <span style="display:flex;align-items:center;gap:6px;justify-content:center">
          Weight
          <button class="unit-toggle-btn" id="unit-toggle" onclick="toggleWeightUnit()" title="Switch unit">
            <span class="unit-option ${!isLb ? 'active' : ''}">kg</span>
            <span class="unit-sep">/</span>
            <span class="unit-option ${isLb ? 'active' : ''}">lb</span>
          </button>
        </span>
        <span>Reps</span>
        <span>
          <button class="check-all-btn" onclick="checkAllQueuedSets(${sets})" title="Mark all sets done">✓ All</button>
        </span>
      </div>
      ${Array.from({length: sets}, (_, i) => {
        const existingSet = exercise.loggedSets && exercise.loggedSets[i];
        const isDone = existingSet?.done || false;
        let rawWeight = (existingSet?.weight !== undefined && existingSet?.weight !== null) ? existingSet.weight : '';
        // Convert stored kg value to lb for display if needed
        if (rawWeight !== '' && isLb) rawWeight = Math.round(parseFloat(rawWeight) * KG_TO_LB * 4) / 4;
        const repsValue = (existingSet?.reps !== undefined && existingSet?.reps !== null) ? existingSet.reps : '';
        return `
          <div class="set-row" id="set-row-${i}">
            <div class="set-num ${isDone ? 'done' : ''}" id="set-num-${i}">${i+1}</div>
            <input class="set-input" type="number" inputmode="decimal" id="set-weight-${i}" value="${rawWeight}" placeholder="0" step="0.5" />
            <input class="set-input" type="number" inputmode="numeric" id="set-reps-${i}" value="${repsValue}" placeholder="${exercise.reps || 10}" />
            <div class="set-check ${isDone ? 'checked' : ''}" id="set-check-${i}" onclick="toggleQueuedSetCheck(${i})"></div>
          </div>`;
      }).join('')}
      <div style="margin-top:8px; font-size:12px; color:var(--text3); text-align:center;">
        💡 Enter weight & reps, tap ✓ to mark set done. Press "Save Exercise" to save.
      </div>
    `;
  } else {
    const existingSet = exercise.loggedSets && exercise.loggedSets[0];
    setsHtml = `
      <div class="form-group" style="margin-top:8px">
        <label class="form-label">Duration (minutes)</label>
        <input class="set-input" type="number" inputmode="numeric" id="cardio-session-duration" value="${existingSet?.duration || ''}" placeholder="30" style="width:100%" />
      </div>
      <div class="form-group">
        <label class="form-label">Distance (km, optional)</label>
        <input class="set-input" type="number" inputmode="decimal" id="cardio-session-distance" value="${existingSet?.distance || ''}" placeholder="5" step="0.1" style="width:100%" />
      </div>
      <div class="form-group">
        <label class="form-label">Intensity (1-10, optional)</label>
        <input class="set-input" type="number" inputmode="numeric" id="cardio-session-intensity" value="${existingSet?.intensity || ''}" placeholder="7" min="1" max="10" style="width:100%" />
      </div>
    `;
  }
  
  body.innerHTML = `
    <div class="session-exercise-title">
      <span>${escHtml(exercise.name)}</span>
    </div>
    ${setsHtml}
    ${!isCardio ? buildProgressiveOverloadTip(exercise) : ''}
    ${restTimerMarkup()}
  `;
  
  openModal('session-modal');
}

// Toggle set check for queued exercise
function toggleQueuedSetCheck(setIndex) {
  const check = document.getElementById('set-check-' + setIndex);
  const num = document.getElementById('set-num-' + setIndex);
  const isDone = check.classList.toggle('checked');
  num.classList.toggle('done', isDone);
  
  if (isDone && typeof SoundManager !== 'undefined') SoundManager.check();
}

// Save current exercise's logged sets to queue
function saveQueuedExercise() {
  const queueIndex = state.activeQueueIndex;
  const exercise = workoutQueue[queueIndex];
  if (!exercise) return;
  
  const isCardio = exercise.isCardio;
  
  if (isCardio) {
    const duration = parseInt(document.getElementById('cardio-session-duration')?.value) || 0;
    const distance = parseFloat(document.getElementById('cardio-session-distance')?.value) || null;
    const intensity = parseInt(document.getElementById('cardio-session-intensity')?.value) || null;
    
    if (!duration) { 
      toast('Please enter a duration'); 
      return; 
    }
    
    exercise.loggedSets = [{ duration, distance, intensity, done: true }];
    exercise.completed = true;
    exercise.maxWeight = 0;
    saveWorkoutQueue();
    toast(`✅ Saved ${exercise.name}: ${duration} minutes`);
    
  } else {
    const sets = document.querySelectorAll('#session-modal-body .set-row[id^="set-row-"]').length || (exercise.sets || 3);
    const loggedSets = [];
    let maxWeight = 0;
    let allCompleted = true;
    
    const LB_TO_KG = 0.453592;
    const isLb = state.weightUnit === 'lb';

    // Get ALL values from inputs (even if not marked done)
    for (let i = 0; i < sets; i++) {
      const weightInput = document.getElementById('set-weight-' + i);
      const repsInput = document.getElementById('set-reps-' + i);
      const checkBox = document.getElementById('set-check-' + i);
      
      let w = 0;
      let r = 0;
      let done = false;
      
      if (weightInput) w = parseFloat(weightInput.value) || 0;
      if (repsInput) r = parseInt(repsInput.value) || 0;
      if (checkBox) done = checkBox.classList.contains('checked');

      // Always store in kg
      if (isLb && w > 0) w = Math.round(w * LB_TO_KG * 100) / 100;
      
      loggedSets.push({ weight: w, reps: r, done: done });
      if (w > maxWeight) maxWeight = w;
      if (!done) allCompleted = false;
    }
    
    // Save ALL entered data (including empty ones)
    exercise.loggedSets = loggedSets;
    exercise.maxWeight = maxWeight;
    exercise.completed = allCompleted;
    
    // Save to localStorage
    saveWorkoutQueue();
    
    const completedCount = loggedSets.filter(s => s.done).length;
    const weightDisplay = maxWeight > 0 ? `${maxWeight}kg` : 'Bodyweight';
    toast(`✅ Saved ${exercise.name}: ${completedCount}/${sets} sets, max ${weightDisplay}`);
    
    // Update PR
    if (maxWeight > 0) {
      const prs = getData().prs;
      if (!prs[exercise.id] || maxWeight > prs[exercise.id].weight) {
        prs[exercise.id] = { weight: maxWeight, date: new Date().toISOString(), name: exercise.name };
        DB.set('prs', prs);
        setTimeout(() => toast('🏆 New PR! ' + maxWeight + 'kg'), 1000);
        renderPRLists();
        if (typeof SoundManager !== 'undefined') SoundManager.success();
      }
    }
  }
  
  closeModal('session-modal');
  if (typeof SoundManager !== 'undefined') SoundManager.success();
}


// Save entire session to history
function saveFullSession() {
  const completedExercises = workoutQueue.filter(item => item.completed);
  const incompleteExercises = workoutQueue.filter(item => !item.completed);
  
  if (completedExercises.length === 0) {
    toast('Complete at least one exercise before saving');
    return;
  }
  
  if (incompleteExercises.length > 0) {
    if (!confirm(`${incompleteExercises.length} exercise(s) not completed. Save only completed ones?`)) return;
  }
  
  // Calculate total sets
  const totalSets = completedExercises.reduce((sum, ex) => {
    return sum + (ex.loggedSets?.filter(set => set.done).length || 0);
  }, 0);
  
  // Create ONE session with ALL completed exercises
  const sessionData = {
    id: 'sess_' + Date.now(),
    date: new Date().toISOString(),
    name: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} Workout`,
    type: 'full_session',
    exercises: completedExercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      isCardio: ex.isCardio || false,
      sets: ex.loggedSets || [],
      maxWeight: ex.maxWeight || 0
    })),
    totalExercises: completedExercises.length,
    totalSets: totalSets
  };
  
  // Save to sessions
  const sessions = getData().sessions;
  sessions.push(sessionData);
  DB.set('sessions', sessions);
  
  // Also log cardio separately — auto-calculate calories burned
  completedExercises.filter(ex => ex.isCardio).forEach(ex => {
    const cardioLog = getData().cardioLog;
    const set = ex.loggedSets?.[0] || {};
    const duration  = set?.duration  || 0;
    const distance  = set?.distance  || null;
    const calories  = calculateCardioCalories(ex.name, duration, distance);
    cardioLog.push({
      type: ex.name,
      duration,
      distance,
      calories,
      date: new Date().toISOString()
    });
    DB.set('cardioLog', cardioLog);
  });
  renderCalorieTracker();
  
  // Update PRs for all exercises
  completedExercises.forEach(ex => {
    if (ex.maxWeight > 0 && !ex.isCardio) {
      const prs = getData().prs;
      if (!prs[ex.id] || ex.maxWeight > prs[ex.id].weight) {
        prs[ex.id] = { weight: ex.maxWeight, date: new Date().toISOString(), name: ex.name };
        DB.set('prs', prs);
      }
    }
  });
  
  // Clear completed exercises from queue
  workoutQueue = workoutQueue.filter(item => !item.completed);
  saveWorkoutQueue();
  
  if (typeof SoundManager !== 'undefined') SoundManager.timerDone();
  toast(`🎉 Session saved! ${completedExercises.length} exercises, ${totalSets} sets completed`);
  
  renderPRLists();
  renderDashboard();
  
  // Refresh UI
  if (state.currentPage === 'progress') renderProgress();
  if (state.currentPage === 'home') renderDashboard();

// Add to the end of saveFullSession function
if (getAuthUser()) {
  setTimeout(() => syncUserDataToCloud(), 500);
}

}

// Periodic auto-sync (every 5 minutes) — created ONCE at module load,
// not inside saveFullSession(). Previously this setInterval lived inside
// saveFullSession() itself, so every saved session spawned ANOTHER
// permanent interval that was never cleared — after a few workouts in
// one sitting you'd have several parallel sync loops running forever,
// adding needless background CPU/network load (worse on weaker Android
// devices).
setInterval(() => {
  if (getAuthUser()) {
    syncUserDataToCloud();
  }
}, 5 * 60 * 1000);

// Quick toggle exercise completion (for testing)
function quickCompleteExercise(index) {
  const exercise = workoutQueue[index];
  if (!exercise) return;
  
  if (!exercise.completed) {
    // Auto-fill with realistic default values based on exercise
    const sets = exercise.sets || 3;
    const loggedSets = [];
    let defaultWeight = 0;
    let defaultReps = exercise.reps || 10;
    
    // Set different default weights based on exercise name
    const exerciseName = exercise.name.toLowerCase();
    
    if (exerciseName.includes('pull') || exerciseName.includes('chin')) {
      defaultWeight = 0; // Bodyweight
      defaultReps = 8;
    } else if (exerciseName.includes('push-up')) {
      defaultWeight = 0; // Bodyweight
      defaultReps = 20;
    } else if (exerciseName.includes('squat')) {
      defaultWeight = 100;
    } else if (exerciseName.includes('deadlift')) {
      defaultWeight = 140;
    } else if (exerciseName.includes('bench')) {
      defaultWeight = 80;
    } else if (exerciseName.includes('press') && exerciseName.includes('overhead')) {
      defaultWeight = 50;
    } else if (exerciseName.includes('curl')) {
      defaultWeight = 30;
    } else if (exerciseName.includes('tricep')) {
      defaultWeight = 30;
    } else if (exerciseName.includes('row')) {
      defaultWeight = 60;
    } else if (exerciseName.includes('leg press')) {
      defaultWeight = 150;
    } else if (exerciseName.includes('lat pulldown')) {
      defaultWeight = 60;
    } else {
      defaultWeight = 40;
    }
    
    for (let i = 0; i < sets; i++) {
      loggedSets.push({ 
        weight: defaultWeight, 
        reps: defaultReps, 
        done: true 
      });
    }
    
    exercise.loggedSets = loggedSets;
    exercise.maxWeight = defaultWeight;
    exercise.completed = true;
    saveWorkoutQueue();
    
    const weightDisplay = defaultWeight === 0 ? 'Bodyweight' : `${defaultWeight}kg`;
    toast(`✅ Marked ${exercise.name} as completed (${weightDisplay} × ${defaultReps} reps)`);
  } else {
    exercise.completed = false;
    exercise.loggedSets = [];
    exercise.maxWeight = 0;
    saveWorkoutQueue();
    toast(`⭕ Unmarked ${exercise.name}`);
  }
}

// View full session details modal
function viewSessionDetails(sessionIndex) {
  const { sessions } = getData();
  const session = sessions[sessionIndex];
  if (!session) return;
  
  const modalBody = document.getElementById('session-modal-body');
  const modalTitle = document.getElementById('session-modal-title');
  
  if (modalTitle) modalTitle.textContent = `${formatDate(session.date)} - Workout Details`;
  
  // Calculate totals
  let totalSets = 0;
  let totalWeight = 0;
  
  session.exercises?.forEach(ex => {
    if (!ex.isCardio && ex.sets) {
      ex.sets.forEach(set => {
        if (set.done) {
          totalSets++;
          totalWeight += (set.weight || 0);
        }
      });
    } else if (ex.isCardio) {
      totalSets++;
    }
  });
  
  // Build exercises list
  let exercisesHtml = `
    <div class="session-summary">
      <div class="session-summary-item">
        <span class="session-summary-label">📅 Date & Time</span>
        <span class="session-summary-value">${new Date(session.date).toLocaleString()}</span>
      </div>
      <div class="session-summary-item">
        <span class="session-summary-label">💪 Exercises</span>
        <span class="session-summary-value">${session.exercises?.length || 0}</span>
      </div>
      <div class="session-summary-item">
        <span class="session-summary-label">🔢 Total Sets</span>
        <span class="session-summary-value">${session.totalSets || totalSets}</span>
      </div>
      ${totalWeight > 0 ? `<div class="session-summary-item">
        <span class="session-summary-label">🏋️ Total Volume</span>
        <span class="session-summary-value">${totalWeight} kg</span>
      </div>` : ''}
    </div>
  `;
  
  // Add each exercise with its sets
  session.exercises?.forEach((exercise, exIdx) => {
    const isCardio = exercise.isCardio;
    const maxWeight = exercise.maxWeight || 0;
    const completedSets = exercise.sets?.filter(s => s.done).length || 0;
    const totalExerciseSets = exercise.sets?.length || 0;
    
    exercisesHtml += `
      <div class="exercise-group" style="margin-top: 20px;">
        <div class="exercise-group-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>${isCardio ? '🏃' : '💪'} ${escHtml(exercise.name)}</span>
          <span style="font-size: 11px; color: var(--accent);">${completedSets}/${totalExerciseSets} sets done</span>
        </div>
        <div style="background: var(--bg3); border-radius: var(--radius-sm); padding: 8px;">
    `;
    
    if (isCardio) {
      const set = exercise.sets?.[0] || {};
      exercisesHtml += `
        <div style="padding: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>⏱ Duration</span>
            <span style="font-weight: 700; color: var(--accent);">${set.duration || 0} minutes</span>
          </div>
          ${set.distance ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>📏 Distance</span>
            <span style="font-weight: 700;">${set.distance} km</span>
          </div>` : ''}
          ${set.intensity ? `<div style="display: flex; justify-content: space-between;">
            <span>⚡ Intensity</span>
            <span style="font-weight: 700;">${set.intensity}/10</span>
          </div>` : ''}
        </div>
      `;
    } else {
      if (exercise.sets && exercise.sets.length > 0) {
        exercisesHtml += `
          <div class="set-labels" style="padding: 0 8px; margin-bottom: 8px; display: grid; grid-template-columns: 40px 1fr 1fr 40px; gap: 8px;">
            <span>Set</span><span>Weight (kg)</span><span>Reps</span><span>✓</span>
          </div>
        `;
        
        exercise.sets.forEach((set, setIdx) => {
          const isDone = set.done;
          exercisesHtml += `
            <div class="set-row" style="opacity: ${isDone ? 1 : 0.5}; padding: 4px 8px;">
              <div class="set-num ${isDone ? 'done' : ''}" style="width: 32px; height: 32px; font-size: 12px;">${setIdx + 1}</div>
              <div style="text-align: center; font-weight: 600;">${set.weight || 0}</div>
              <div style="text-align: center; font-weight: 600;">${set.reps || 0}</div>
              <div class="set-check ${isDone ? 'checked' : ''}" style="pointer-events: none; width: 24px; height: 24px;"></div>
            </div>
          `;
        });
        
        if (maxWeight > 0) {
          exercisesHtml += `
            <div style="margin-top: 12px; padding: 10px; text-align: center; background: var(--accent-dim); border-radius: var(--radius-sm);">
              🏆 Max Weight: <strong style="color: var(--accent); font-size: 16px;">${maxWeight} kg</strong>
            </div>
          `;
        }
      } else {
        exercisesHtml += `
          <div style="padding: 20px; text-align: center; color: var(--text3);">
            No sets recorded for this exercise
          </div>
        `;
      }
    }
    
    exercisesHtml += `</div></div>`;
  });
  
  if (modalBody) modalBody.innerHTML = exercisesHtml;
  openModal('session-modal');
}

// ─── Load from Schedule into Queue ──────────────────────

function openLoadFromScheduleModal() {
  const schedule = getWeeklySchedule();
  const container = document.getElementById('schedule-day-picker');
  if (!container) return;

  // Get today's day name to highlight it
  const todayName = DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  container.innerHTML = DAYS_OF_WEEK.map(day => {
    const dayData = schedule.days[day] || { name: '', workouts: [] };
    const count = dayData.workouts?.length || 0;
    const isToday = day === todayName;
    const isEmpty = count === 0;

    return `
      <div class="schedule-picker-card ${isEmpty ? 'empty' : ''} ${isToday ? 'today' : ''}" 
           onclick="${isEmpty ? '' : `loadDayIntoQueue('${day}')`}"
           style="cursor:${isEmpty ? 'default' : 'pointer'}">
        <div class="schedule-picker-header">
          <div>
            <span class="schedule-picker-day">${day} ${isToday ? '<span class="today-badge">Today</span>' : ''}</span>
            ${dayData.name ? `<span class="schedule-picker-name">${escHtml(dayData.name)}</span>` : ''}
          </div>
          <span class="schedule-picker-count">${count} exercise${count !== 1 ? 's' : ''}</span>
        </div>
        ${count > 0 ? `
          <div class="schedule-picker-exercises">
            ${dayData.workouts.slice(0, 4).map(w => `<span class="schedule-picker-tag">${escHtml(w.name)}</span>`).join('')}
            ${count > 4 ? `<span class="schedule-picker-tag">+${count - 4} more</span>` : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:10px" onclick="event.stopPropagation();loadDayIntoQueue('${day}')">
            ➕ Load ${day}${dayData.name ? ' — ' + escHtml(dayData.name) : ''}
          </button>
        ` : `<p style="font-size:12px;color:var(--text3);margin-top:6px;">No exercises scheduled</p>`}
      </div>
    `;
  }).join('');

  openModal('load-schedule-modal');
}

function loadDayIntoQueue(day) {
  const schedule = getWeeklySchedule();
  const dayData = schedule.days[day];

  if (!dayData || !dayData.workouts || dayData.workouts.length === 0) {
    toast(`No exercises scheduled for ${day}`);
    return;
  }

  const existingIds = new Set(workoutQueue.map(item => item.id));
  let added = 0;
  let skipped = 0;

  dayData.workouts.forEach(ex => {
    if (existingIds.has(ex.id)) {
      skipped++;
      return;
    }
    workoutQueue.push({
      id: ex.id,
      name: ex.name,
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      rest: ex.rest || 60,
      isCardio: ex.isCardio || false,
      muscle: ex.muscle || 'General',
      completed: false,
      loggedSets: [],
      maxWeight: 0
    });
    added++;
  });

  saveWorkoutQueue();
  closeModal('load-schedule-modal');

  if (added === 0) {
    toast(`All exercises from ${day} already in queue`);
  } else if (skipped > 0) {
    toast(`✅ Added ${added} exercise${added !== 1 ? 's' : ''} (${skipped} already in queue)`);
  } else {
    toast(`✅ Loaded ${added} exercise${added !== 1 ? 's' : ''} from ${day}!`);
  }

  if (typeof SoundManager !== 'undefined') SoundManager.success();
}

// Quick log with prompt (⚡ button)
function quickLogExercise(index) {
  const exercise = workoutQueue[index];
  if (!exercise) return;
  
  const isCardio = exercise.isCardio;
  
  if (isCardio) {
    const duration = prompt(`Enter duration for ${exercise.name} (minutes):`, "30");
    if (duration === null) return;
    
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      toast('Please enter a valid duration');
      return;
    }
    
    exercise.loggedSets = [{ duration: durationNum, distance: null, intensity: null, done: true }];
    exercise.completed = true;
    exercise.maxWeight = 0;
    saveWorkoutQueue();
    toast(`✅ Completed ${exercise.name}: ${durationNum} minutes`);
    
  } else {
    const weight = prompt(`Enter weight for ${exercise.name} (kg):`, "60");
    if (weight === null) return;
    
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) {
      toast('Please enter a valid weight');
      return;
    }
    
    const reps = prompt(`Enter reps for ${exercise.name}:`, exercise.reps || "10");
    if (reps === null) return;
    
    const repsNum = parseInt(reps);
    if (isNaN(repsNum)) {
      toast('Please enter valid reps');
      return;
    }
    
    const sets = exercise.sets || 3;
    const loggedSets = [];
    for (let i = 0; i < sets; i++) {
      loggedSets.push({ weight: weightNum, reps: repsNum, done: true });
    }
    
    exercise.loggedSets = loggedSets;
    exercise.maxWeight = weightNum;
    exercise.completed = true;
    saveWorkoutQueue();
    
    const weightDisplay = weightNum === 0 ? 'Bodyweight' : `${weightNum}kg`;
    toast(`✅ Completed ${exercise.name}: ${weightDisplay} × ${repsNum} reps`);
    
    // Update PR
    if (weightNum > 0) {
      const prs = getData().prs;
      if (!prs[exercise.id] || weightNum > prs[exercise.id].weight) {
        prs[exercise.id] = { weight: weightNum, date: new Date().toISOString(), name: exercise.name };
        DB.set('prs', prs);
        setTimeout(() => toast('🏆 New PR! ' + weightNum + 'kg'), 1000);
        renderPRLists();
      }
    }
  }
  
  if (typeof SoundManager !== 'undefined') SoundManager.success();
}

// Call this after any dynamic content is loaded
// Add to your render functions where new inputs are created

// Update navigate function to include calculator
// Add to the navigate function:
// if (page === 'calculator') { 
//   renderCalorieTracker();
//   displaySavedProfile();
//   loadSavedProfile();
// }

// ─── Initialize ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  const useDeferredPageRendering = document.body.classList.contains('performance-mode');
  
  renderDashboard();

  if (!useDeferredPageRendering) {
    renderWorkouts();
    renderCalorieTracker();
    renderProgress();
    renderGoals();
    renderWater();
    renderWeeklySchedule();
    renderDietPage();
    renderGymbros();
  }

  displaySavedProfile();
  loadSavedProfile();
  loadWorkoutQueue();

  // Dynamic inputmode setup for inputs requiring numeric keyboards (Capacitor/Mobile UX)
  function applyNumericKeyboardModes() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
      if (input.hasAttribute('inputmode')) return;
      const step = input.getAttribute('step') || '';
      if (step.includes('.') || step === 'any') {
        input.setAttribute('inputmode', 'decimal');
      } else {
        input.setAttribute('inputmode', 'numeric');
      }
    });
  }
  applyNumericKeyboardModes();
  // Target dynamically rendered inputs in future modals
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      if (!e.target.hasAttribute('inputmode')) {
        const step = e.target.getAttribute('step') || '';
        e.target.setAttribute('inputmode', (step.includes('.') || step === 'any') ? 'decimal' : 'numeric');
      }
    }
  });

  // ── STAGE 1 + 2: GPU Tile Warmup (runs DURING the splash screen) ────────
  // Problem: Android WebView uses lazy tile rasterization. On cold start,
  // the GPU raster thread hasn't finished converting the DOM paint records
  // into GPU textures by the time the loading screen fades away, so the
  // user sees blank/black sections on first reveal.
  //
  // Solution: While the loading screen is still covering everything (the user
  // sees nothing), we:
  //   Stage 1 — promote the active page scroll container to its own GPU layer
  //             via translateZ(0), which schedules an immediate raster job.
  //   Stage 2 — run 45 requestAnimationFrame cycles (~750ms) that keep reading
  //             layout metrics, keeping the raster threads fully occupied until
  //             all tiles for the visible content are uploaded to the GPU.
  // By the time the loading screen starts to fade at 1500ms, all GPU tiles
  // are pre-baked and the reveal is instant and complete.
  if (!useDeferredPageRendering) setTimeout(() => {
    const activePage = document.querySelector('.page.active');
    const scrollEl = activePage ? activePage.querySelector('.page-scroll') : null;
    if (!scrollEl) return;

    // Stage 1: GPU layer promotion
    scrollEl.style.willChange = 'transform';
    scrollEl.style.transform = 'translateZ(0)';
    scrollEl.getBoundingClientRect(); // sync reflow to commit promotion

    // Stage 2: Sustained raster pressure over 45 frames (~750ms)
    let warmupFrame = 0;
    function runWarmupFrame() {
      // Force layout read — keeps the compositor and raster thread awake
      scrollEl.getBoundingClientRect();
      // Every 8 frames, nudge scroll by 1px and back to force the raster
      // thread to rasterize the content just below the viewport edge
      if (warmupFrame % 8 === 0 && warmupFrame > 0) {
        scrollEl.scrollTop = (scrollEl.scrollTop === 0) ? 1 : 0;
      }
      warmupFrame++;
      if (warmupFrame < 45) {
        requestAnimationFrame(runWarmupFrame);
      } else {
        // Cleanup — remove the temporary GPU hints
        scrollEl.style.willChange = 'auto';
        scrollEl.style.transform = '';
      }
    }
    requestAnimationFrame(runWarmupFrame);
  }, 150); // Start 150ms after DOM is ready (after all renders complete)
  // ────────────────────────────────────────────────────────────────────────

  // ── Auto-save current profile data every 30 seconds ──────────────────
  setInterval(() => {
    if (currentProfileId) saveCurrentProfileData(currentProfileId);
  }, 30000);

  // ── Also save when the user switches tabs / minimises the app ─────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentProfileId) {
      saveCurrentProfileData(currentProfileId);
    }
  });

  // ── Save before the page unloads (browser close / refresh) ────────────
  window.addEventListener('beforeunload', () => {
    if (currentProfileId) saveCurrentProfileData(currentProfileId);
  });

  const deleteBtn = document.getElementById('delete-schedule-workout-btn');
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteScheduledWorkout();
  }
  
  const goalDisplay = document.querySelector('.calorie-goal-display');
  if (goalDisplay) {
    goalDisplay.onclick = () => openCalorieGoalModal();
  }
  
  // Make PR functions globally available
  window.calculate1RM = calculate1RM;
  window.openRMModal = openRMModal;
  window.calculateAndSavePR = calculateAndSavePR;
  window.savePRToRecords = savePRToRecords;
  window.renderPRLists = renderPRLists;
  window.editPR = editPR;
 
    // ══════════════════════════════════════════
  // PERFORMANCE OPTIMIZATIONS
  // ══════════════════════════════════════════

  // Throttle scroll events (reduce event firing)
  const scrollContainer = document.querySelector('.page-scroll');
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', throttle(() => {
      // No heavy work – just let the browser breathe
    }, 200), { passive: true });
  }

  // Debounce input events (exercise-search handled by DOMContentLoaded listener)
  // Food/schedule search debounced via _debouncedFilterFood / _debouncedFilterSchedule

  // Batch DOM updates using requestAnimationFrame
  window.batchUpdate = function(updateFn) {
    requestAnimationFrame(updateFn);
  };

  // NOTE: renderWorkouts and renderDashboard are NOT re-wrapped here.
  // navigate() already schedules all render calls inside a single RAF,
  // so wrapping them again would double-defer updates and cause visible
  // lag on low-end Android (two frame delays instead of one).

// Render gymbros if that page is active
if (document.getElementById('page-gymbros').classList.contains('active')) {
  renderGymbros();
}

  // Throttle toast notifications (reduce UI thrashing)
  let toastQueue = [];
  let isProcessingToast = false;
  
  window.toast = function(msg) {
    toastQueue.push(msg);
    if (!isProcessingToast) {
      processToastQueue();
    }
  };
  
  function processToastQueue() {
    if (toastQueue.length === 0) {
      isProcessingToast = false;
      return;
    }
    isProcessingToast = true;
    const msg = toastQueue.shift();
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(processToastQueue, 300);
      }, 2000);
    } else {
      // Element not found — stop processing to avoid infinite recursion
      isProcessingToast = false;
    }
  }

  // Disable smooth scrolling on all elements for low-end
  document.querySelectorAll('.page-scroll').forEach(el => {
    el.style.scrollBehavior = 'auto';
  });

  console.log('Performance optimizations enabled for low-end devices');

});

// ══════════════════════════════════════════
// SERVICE WORKER REGISTRATION (Offline Support)
// ══════════════════════════════════════════

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').then(function(registration) {
      console.log('Service Worker registered successfully:', registration.scope);
    }).catch(function(error) {
      console.log('Service Worker registration failed:', error);
    });
  });
}

// ══════════════════════════════════════════
// PROFILE MANAGEMENT SYSTEM
// ══════════════════════════════════════════

let profiles = DB.get('profiles', []);
let currentProfileId = DB.get('currentProfileId', null);
let selectedAvatar = '💪';
let editingProfileId = null;
let editProfileAvatar = '💪';

function getProfileSnapshotData(profileId) {
  if (profileId === currentProfileId) {
    const profilesData = DB.get('profilesData', {});
    const savedUserProfile = profilesData[profileId]?.data?.userProfile || {};
    return {
      sessions: DB.get('sessions', []),
      prs: DB.get('prs', {}),
      weeklySchedule: DB.get('weeklySchedule', { days: {} }),
      userProfile: savedUserProfile
    };
  }
  const profilesData = DB.get('profilesData', {});
  const profileData = profilesData[profileId];
  if (profileData && profileData.data) {
    return {
      sessions: profileData.data.sessions || [],
      prs: profileData.data.prs || {},
      weeklySchedule: profileData.data.weeklySchedule || { days: {} },
      userProfile: profileData.data.userProfile || {}
    };
  }
  return { sessions: [], prs: {}, weeklySchedule: { days: {} }, userProfile: {} };
}

function getLastPR(prs) {
  const entries = Object.values(prs || {});
  if (!entries.length) return null;
  return entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
}

function getSplitSummary(schedule) {
  const days = schedule?.days || {};
  const named = DAYS_OF_WEEK.map(d => days[d]?.name).filter(n => n && n.trim());
  if (!named.length) {
    const withExercises = DAYS_OF_WEEK.filter(d => (days[d]?.workouts?.length || 0) > 0);
    if (!withExercises.length) return 'No split configured';
    return `${withExercises.length} training day${withExercises.length !== 1 ? 's' : ''} planned`;
  }
  const unique = [...new Set(named)];
  if (unique.length <= 3) return unique.join(' · ');
  return `${unique.slice(0, 3).join(' · ')} +${unique.length - 3} more`;
}

function formatMemberSince(dateStr) {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function selectEditProfileAvatar(avatar) {
  editProfileAvatar = avatar;
  document.querySelectorAll('.edit-avatar-option').forEach(opt => {
    opt.classList.toggle('selected', opt.getAttribute('data-avatar') === avatar);
  });
  const avatarDisplay = document.getElementById('edit-profile-avatar-display');
  if (avatarDisplay) avatarDisplay.textContent = avatar;
}

function populateEditProfileModal(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;

  const data = getProfileSnapshotData(profileId);
  const userProfile = data.userProfile || {};
  const streak = calcStreak(data.sessions);
  const prCount = Object.keys(data.prs || {}).length;
  const lastPR = getLastPR(data.prs);
  const calcProfile = profileId === currentProfileId ? DB.get('calculatorProfile', null) : null;
  const age = userProfile.age ?? calcProfile?.age ?? '';

  editProfileAvatar = profile.avatar || '💪';

  const avatarDisplay = document.getElementById('edit-profile-avatar-display');
  const nameInput = document.getElementById('edit-profile-name-input');
  const streakEl = document.getElementById('edit-profile-streak');
  const sessionsEl = document.getElementById('edit-profile-sessions');
  const prsEl = document.getElementById('edit-profile-prs');
  const lastPrEl = document.getElementById('edit-profile-last-pr');
  const ageInput = document.getElementById('edit-profile-age-input');
  const splitSummaryEl = document.getElementById('edit-profile-split-summary');
  const memberSinceEl = document.getElementById('edit-profile-member-since');
  const splitDetailsEl = document.getElementById('edit-profile-split-details');

  if (avatarDisplay) avatarDisplay.textContent = editProfileAvatar;
  if (nameInput) nameInput.value = profile.name || '';
  if (streakEl) streakEl.textContent = streak;
  if (sessionsEl) sessionsEl.textContent = data.sessions.length;
  if (prsEl) prsEl.textContent = prCount;
  if (lastPrEl) {
    lastPrEl.textContent = lastPR
      ? `${lastPR.name} — ${lastPR.weight} kg (${formatDate(lastPR.date)})`
      : 'No PRs yet';
  }
  if (ageInput) ageInput.value = age !== '' && age != null ? age : '';
  if (splitSummaryEl) splitSummaryEl.textContent = getSplitSummary(data.weeklySchedule);
  if (memberSinceEl) memberSinceEl.textContent = formatMemberSince(profile.createdAt);
  if (splitDetailsEl) {
    splitDetailsEl.style.display = 'none';
    splitDetailsEl.innerHTML = '';
  }

  document.querySelectorAll('.edit-avatar-option').forEach(opt => {
    opt.classList.toggle('selected', opt.getAttribute('data-avatar') === editProfileAvatar);
  });
}

function renderEditProfileSplitDetails(profileId) {
  const container = document.getElementById('edit-profile-split-details');
  if (!container) return;

  const data = getProfileSnapshotData(profileId);
  const schedule = data.weeklySchedule?.days ? data.weeklySchedule : getWeeklySchedule();

  container.innerHTML = DAYS_OF_WEEK.map(day => {
    const dayData = schedule.days[day] || { name: '', workouts: [] };
    const workoutName = dayData.name?.trim();
    const exercises = dayData.workouts || [];
    const exerciseNames = exercises.map(w => w.name).filter(Boolean);

    return `
      <div class="edit-profile-split-day">
        <div class="edit-profile-split-day-name">${day}</div>
        ${workoutName ? `<div class="edit-profile-split-day-workout">🏋️ ${escHtml(workoutName)}</div>` : ''}
        <div class="edit-profile-split-day-exercises">
          ${exerciseNames.length
            ? escHtml(exerciseNames.join(' · '))
            : '<span class="muted-text">Rest / no exercises</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function openEditProfileSplitDetails() {
  if (!editingProfileId) return;

  if (editingProfileId === currentProfileId) {
    const splitOverlay = document.getElementById('split-modal');
    if (splitOverlay) splitOverlay.style.zIndex = '110';
    openSplitModal();
    return;
  }

  const detailsEl = document.getElementById('edit-profile-split-details');
  if (!detailsEl) return;

  const isVisible = detailsEl.style.display !== 'none';
  if (isVisible) {
    detailsEl.style.display = 'none';
    return;
  }

  renderEditProfileSplitDetails(editingProfileId);
  detailsEl.style.display = 'flex';
}

async function saveEditProfileDetails() {
  if (!editingProfileId) return;

  const profileName = document.getElementById('edit-profile-name-input')?.value.trim();
  if (!profileName) {
    toast('Please enter a profile name');
    return;
  }

  const ageRaw = document.getElementById('edit-profile-age-input')?.value.trim();
  let age = null;
  if (ageRaw !== '') {
    age = parseInt(ageRaw, 10);
    if (isNaN(age) || age < 10 || age > 120) {
      toast('Please enter a valid age (10–120)');
      return;
    }
  }

  if (editingProfileId === currentProfileId) {
    saveCurrentProfileData(editingProfileId);
  }

  const index = profiles.findIndex(p => p.id === editingProfileId);
  if (index !== -1) {
    profiles[index] = {
      ...profiles[index],
      name: profileName,
      avatar: editProfileAvatar,
      updatedAt: new Date().toISOString()
    };
  }

  let profilesData = DB.get('profilesData', {});
  if (!profilesData[editingProfileId]) {
    profilesData[editingProfileId] = {
      id: editingProfileId,
      savedAt: new Date().toISOString(),
      data: {}
    };
  }
  if (!profilesData[editingProfileId].data) {
    profilesData[editingProfileId].data = {};
  }

  profilesData[editingProfileId].data.userProfile = {
    ...(profilesData[editingProfileId].data.userProfile || {}),
    age,
    updatedAt: new Date().toISOString()
  };
  profilesData[editingProfileId].savedAt = new Date().toISOString();

  DB.set('profiles', profiles);
  DB.set('profilesData', profilesData);

  if (editingProfileId === currentProfileId) {
    saveCurrentProfileData(editingProfileId);
  }

  closeModal('edit-profile-modal');
  renderProfilesList();
  updateProfileBadge();
  renderDashboard();

  const user = getAuthUser();
  if (!user) {
    toast(`Profile "${profileName}" saved locally. Log in to sync.`);
    return;
  }

  toast('Saving profile to cloud...');

  // ── 1. Sync workout/profile data blob ──────────────────────
  const dataSync = syncUserDataToCloud();

  // ── 2. If this is the auth-linked account profile, also update
  //       user_metadata.username in Supabase Auth so the name
  //       survives a page refresh (that's what restoreAuthSession reads).
  const editedProfile = profiles.find(p => p.id === editingProfileId);
  const isAuthProfile = editedProfile?.isAccount === true;

  let authSync = Promise.resolve(true);
  if (isAuthProfile) {
    const session = getAuthSession();
    if (session?.access_token) {
      authSync = fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ data: { username: profileName } })
      })
        .then(async res => {
          if (res.ok) {
            const updated = await res.json();
            // Patch the local session cache so the new name is read on refresh
            const currentSession = getAuthSession();
            if (currentSession) {
              currentSession.user = {
                ...(currentSession.user || {}),
                user_metadata: {
                  ...(currentSession.user?.user_metadata || {}),
                  username: profileName
                }
              };
              setAuthSession(currentSession);
            }
            return true;
          }
          console.error('[Profile] Auth username update failed:', await res.text());
          return false;
        })
        .catch(e => { console.error('[Profile] Auth username update error:', e); return false; });
    }
  }

  // ── 3. Sync leaderboard row so username shows correctly on scoreboard ──
  const lbSync = _syncLeaderboardInternal
    ? _syncLeaderboardInternal()
    : syncLeaderboard();

  const [dataSynced, authSynced, lbSynced] = await Promise.all([dataSync, authSync, lbSync]);

  if (dataSynced) {
    toast(`✅ Profile "${profileName}" saved to database`);
  } else {
    toast(`⚠️ Profile "${profileName}" saved locally, but cloud sync failed`);
  }
}

function selectAvatar(avatar) {
  selectedAvatar = avatar;
  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.classList.remove('selected');
    if (opt.getAttribute('data-avatar') === avatar) {
      opt.classList.add('selected');
    }
  });
  const hiddenInput = document.getElementById('selected-avatar');
  if (hiddenInput) hiddenInput.value = avatar;
}

function openProfileModal() {
  renderProfilesList();
  openModal('profile-modal');
}

function openCreateProfileModal() {
  editingProfileId = null;
  selectedAvatar = '💪';
  const titleEl = document.getElementById('create-profile-title');
  if (titleEl) titleEl.textContent = 'Create New Profile';
  const nameInput = document.getElementById('profile-name-input');
  if (nameInput) nameInput.value = '';
  const hiddenInput = document.getElementById('selected-avatar');
  if (hiddenInput) hiddenInput.value = '💪';
  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.classList.remove('selected');
    if (opt.getAttribute('data-avatar') === '💪') {
      opt.classList.add('selected');
    }
  });
  openModal('create-profile-modal');
}

function openEditProfileModal(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;

  if (profileId === currentProfileId) {
    saveCurrentProfileData(profileId);
  }

  editingProfileId = profileId;
  populateEditProfileModal(profileId);
  closeModal('profile-modal');
  openModal('edit-profile-modal');
}

function saveCurrentProfile() {
  const profileName = document.getElementById('profile-name-input')?.value.trim();
  if (!profileName) {
    toast('Please enter a profile name');
    return;
  }

  const avatar = document.getElementById('selected-avatar')?.value || '💪';

  if (editingProfileId) {
    // EDITING existing profile - update name/avatar only, keep data
    const index = profiles.findIndex(p => p.id === editingProfileId);
    if (index !== -1) {
      // Save current data to old profile before updating
      if (currentProfileId === editingProfileId) {
        saveCurrentProfileData(editingProfileId);
      }
      
      profiles[index] = {
        ...profiles[index],
        name: profileName,
        avatar: avatar,
        updatedAt: new Date().toISOString()
      };
      toast(`Profile "${profileName}" updated!`);
    }
  } else {
    // CREATING new profile - create FRESH empty data
    const newProfileId = 'profile_' + Date.now();
    const newProfile = {
      id: newProfileId,
      name: profileName,
      avatar: avatar,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    profiles.push(newProfile);
    
    // Create EMPTY data for the new profile (not copying current)
    const emptyProfileData = {
      id: newProfileId,
      savedAt: new Date().toISOString(),
      data: {
        sessions: [],
        prs: {},
        weightLog: [],
        weightLossGoal: null,
        cardioLog: [],
        cardioGoal: null,
        waterLog: [],
        settings: { waterGoal: 2000 },
        weeklySchedule: { days: {} },
        foodLog: [],
        calorieGoals: { calories: 2000, protein: 150, carbs: 200, fats: 55 },
        customFoods: [],
        customWorkouts: [],
        weeklyGoals: [],
        userProfile: {}
      }
    };
    
    let profilesData = DB.get('profilesData', {});
    profilesData[newProfileId] = emptyProfileData;
    DB.set('profilesData', profilesData);
    
    toast(`Profile "${profileName}" created!`);
  }

  DB.set('profiles', profiles);
  closeModal('create-profile-modal');
  renderProfilesList();
  updateProfileBadge();
}

function applyProfile(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;

  // Save current profile data before switching
  if (currentProfileId) {
    saveCurrentProfileData(currentProfileId);
  }

  // Switch to new profile
  currentProfileId = profileId;
  DB.set('currentProfileId', currentProfileId);
  
  // Load the selected profile's data
  loadProfileData(profileId);

  toast(`Switched to profile: ${profile.name}`);
  closeModal('profile-modal');
  
  // Refresh all UI
  renderDashboard();
  renderWorkouts();
  renderProgress();
  renderWeeklySchedule();
  renderCalorieTracker();
  renderWater();
  renderGoals();
  renderPRLists();
  updateProfileBadge();
}

function saveCurrentProfileData(profileId) {
  if (!profileId) return;

  const existingSnapshot = DB.get('profilesData', {})[profileId]?.data || {};

  const profileData = {
    id: profileId,
    savedAt: new Date().toISOString(),
    data: {
      sessions:       DB.get('sessions', []),
      prs:            DB.get('prs', {}),
      weightLog:      DB.get('weightLog', []),
      weightLossGoal: DB.get('weightLossGoal', null),
      cardioLog:      DB.get('cardioLog', []),
      cardioGoal:     DB.get('cardioGoal', null),
      waterLog:       DB.get('waterLog', []),
      settings:       DB.get('settings', { waterGoal: 2000 }),
      weeklySchedule: DB.get('weeklySchedule', { days: {} }),
      foodLog:        DB.get('foodLog', []),
      calorieGoals:   DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 }),
      customFoods:    DB.get('customFoods', []),
      customWorkouts: DB.get('customWorkouts', []),
      weeklyGoals:    DB.get('weeklyGoals', []),
      weeklyDietPlan: DB.get('weeklyDietPlan', null),
      userProfile:    existingSnapshot.userProfile || {}
    }
  };

  let profilesData = DB.get('profilesData', {});
  profilesData[profileId] = profileData;
  DB.set('profilesData', profilesData);
}

function loadProfileData(profileId) {
  const profilesData = DB.get('profilesData', {});
  const profileData = profilesData[profileId];

  if (profileData && profileData.data) {
    const data = profileData.data;
    // Clean load — each profile is fully isolated.
    // saveCurrentProfileData() already saved the outgoing profile's data
    // so we never lose anything; we just restore this profile's own snapshot.
    DB.set('sessions',       data.sessions       || []);
    DB.set('prs',            data.prs            || {});
    DB.set('weightLog',      data.weightLog      || []);
    DB.set('weightLossGoal', data.weightLossGoal || null);
    DB.set('cardioLog',      data.cardioLog      || []);
    DB.set('cardioGoal',     data.cardioGoal     || null);
    DB.set('waterLog',       data.waterLog       || []);
    DB.set('settings',       data.settings       || { waterGoal: 2000 });
    DB.set('weeklySchedule', data.weeklySchedule || { days: {} });
    DB.set('foodLog',        data.foodLog        || []);
    DB.set('calorieGoals',   data.calorieGoals   || { calories: 2000, protein: 150, carbs: 200, fats: 55 });
    DB.set('customFoods',    data.customFoods    || []);
    DB.set('customWorkouts', data.customWorkouts || []);
    DB.set('weeklyGoals',    data.weeklyGoals    || []);
        DB.set('weeklyDietPlan', data.weeklyDietPlan || null);

  }
}

function deleteProfile(profileId) {
  if (profiles.length === 1) {
    toast('Cannot delete the last profile. Create another profile first.');
    return;
  }

  if (!confirm('Delete this profile? All its data will be lost.')) return;

  const profile = profiles.find(p => p.id === profileId);
  profiles = profiles.filter(p => p.id !== profileId);
  DB.set('profiles', profiles);

  const profilesData = DB.get('profilesData', {});
  delete profilesData[profileId];
  DB.set('profilesData', profilesData);

  if (currentProfileId === profileId && profiles.length > 0) {
    currentProfileId = profiles[0].id;
    DB.set('currentProfileId', currentProfileId);
    loadProfileData(currentProfileId);
    toast(`Switched to profile: ${profiles[0].name}`);
    renderDashboard();
    renderWorkouts();
    renderProgress();
    renderWeeklySchedule();
    renderCalorieTracker();
    renderWater();
    renderGoals();
    renderPRLists();
  }

  toast(`Profile "${profile.name}" deleted`);
  renderProfilesList();
  updateProfileBadge();
}

function renderProfilesList() {
  const container = document.getElementById('profiles-list');
  if (!container) return;

  if (profiles.length === 0) {
    container.innerHTML = '<p class="muted-text" style="text-align:center;">No profiles yet. Create your first profile!</p>';
    return;
  }

  container.innerHTML = profiles.map(profile => {
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
}

function getProfileStats(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  const data = getProfileSnapshotData(profileId);
  const userProfile = data.userProfile || {};
  const calcProfile = profileId === currentProfileId ? DB.get('calculatorProfile', null) : null;
  const age = userProfile.age ?? calcProfile?.age ?? null;

  return {
    sessions: data.sessions.length,
    prs: Object.keys(data.prs || {}).length,
    streak: calcStreak(data.sessions),
    age
  };
}

function updateProfileBadge() {
  const currentProfile = profiles.find(p => p.id === currentProfileId);
  const badgeBtn = document.getElementById('profile-badge-btn');
  if (badgeBtn && currentProfile) {
    badgeBtn.innerHTML = `${currentProfile.avatar || JBIcons.svg('user', { size: 18 })}`;
    badgeBtn.title = `Profile: ${currentProfile.name}`;
  } else if (badgeBtn) {
    badgeBtn.innerHTML = JBIcons.svg('user', { size: 18 });
    badgeBtn.title = `Profiles`;
  }
}

function initProfiles() {
  if (profiles.length === 0) {
    const defaultProfileId = 'profile_default';
    const defaultProfile = {
      id: defaultProfileId,
      name: 'My Profile',
      avatar: '💪',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    profiles = [defaultProfile];
    DB.set('profiles', profiles);
    
    // Carry over any existing live data into the default profile
    const defaultProfileData = {
      id: defaultProfileId,
      savedAt: new Date().toISOString(),
      data: {
        sessions:       DB.get('sessions', []),
        prs:            DB.get('prs', {}),
        weightLog:      DB.get('weightLog', []),
        weightLossGoal: DB.get('weightLossGoal', null),
        cardioLog:      DB.get('cardioLog', []),
        cardioGoal:     DB.get('cardioGoal', null),
        waterLog:       DB.get('waterLog', []),
        settings:       DB.get('settings', { waterGoal: 2000 }),
        weeklySchedule: DB.get('weeklySchedule', { days: {} }),
        foodLog:        DB.get('foodLog', []),
        calorieGoals:   DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 }),
        customFoods:    DB.get('customFoods', []),
        customWorkouts: DB.get('customWorkouts', []),
        weeklyGoals:    DB.get('weeklyGoals', []),
        userProfile:    {}
      }
    };
    
    let profilesData = DB.get('profilesData', {});
    profilesData[defaultProfileId] = defaultProfileData;
    DB.set('profilesData', profilesData);
    
    if (!currentProfileId) {
      currentProfileId = defaultProfileId;
      DB.set('currentProfileId', currentProfileId);
    }
  }
  
  // Make sure current profile data is loaded (merges live data in)
  if (currentProfileId) {
    loadProfileData(currentProfileId);
  }
  
  updateProfileBadge();
}

// Initialize profiles
initProfiles();

// Make profile functions global
window.openProfileModal = openProfileModal;
window.openCreateProfileModal = openCreateProfileModal;
window.openEditProfileModal = openEditProfileModal;
window.saveEditProfileDetails = saveEditProfileDetails;
window.selectEditProfileAvatar = selectEditProfileAvatar;
window.openEditProfileSplitDetails = openEditProfileSplitDetails;
window.saveCurrentProfile = saveCurrentProfile;
window.applyProfile = applyProfile;
window.deleteProfile = deleteProfile;
window.selectAvatar = selectAvatar;

// Performance mode toggle
let performanceMode = localStorage.getItem('performanceMode') === 'true';

function togglePerformanceMode() {
  performanceMode = !performanceMode;
  localStorage.setItem('performanceMode', performanceMode);
  
  if (performanceMode) {
    document.body.classList.add('performance-mode');
    toast('⚡ Performance mode ON - Reduced animations');
  } else {
    document.body.classList.remove('performance-mode');
    toast('✨ Full animations restored');
  }

}

// Apply performance mode on load
if (performanceMode) {
  document.body.classList.add('performance-mode');
}

// ══════════════════════════════════════════
// HYDRATION REMINDERS SYSTEM (COMPLETE)
// ══════════════════════════════════════════

let hydrationInterval = null;

// ─── Hydration interval options (value = seconds) ──────────
// The select <option value="X"> stores seconds.
// We compare elapsed seconds since last reminder against this value.
// This makes 10-second testing trivial and all other intervals exact.
const HYDRATION_INTERVAL_OPTIONS = [
  { value: 10,    label: '🧪 Every 10 seconds (TEST ONLY)' },
  { value: 600,   label: 'Every 10 minutes' },
  { value: 1800,  label: 'Every 30 minutes' },
  { value: 3600,  label: 'Every hour' },
  { value: 5400,  label: 'Every 90 minutes' },
  { value: 7200,  label: 'Every 2 hours' },
  { value: 21600, label: 'Every 6 hours' },
];

// The ticker runs every 5 seconds when a short interval is set,
// every 30 seconds otherwise. This ensures <10s option fires on time
// without hammering the CPU for normal usage.
const HYDRATION_TICK_SHORT_MS = 5_000;   // used when intervalSeconds <= 60
const HYDRATION_TICK_NORMAL_MS = 30_000; // used for all other intervals

function openHydrationReminderModal() {
  const settings = DB.get('hydrationReminders', {
    enabled: false,
    startTime: '08:00',
    endTime: '22:00',
    intervalSeconds: 3600, // default: 1 hour
    message: '💧 Time to hydrate! Drink some water.'
  });

  // Back-compat: old saves stored `interval` in minutes → convert
  if (settings.interval !== undefined && settings.intervalSeconds === undefined) {
    settings.intervalSeconds = Math.round(settings.interval * 60);
    delete settings.interval;
  }

  const enabledCheck   = document.getElementById('reminder-enabled');
  const startTime      = document.getElementById('reminder-start-time');
  const endTime        = document.getElementById('reminder-end-time');
  const intervalSelect = document.getElementById('reminder-interval');
  const messageInput   = document.getElementById('reminder-message');

  if (enabledCheck)   enabledCheck.checked    = settings.enabled;
  if (startTime)      startTime.value         = settings.startTime;
  if (endTime)        endTime.value           = settings.endTime;
  if (messageInput)   messageInput.value      = settings.message;

  // Rebuild <select> options from the canonical list
  if (intervalSelect) {
    intervalSelect.innerHTML = HYDRATION_INTERVAL_OPTIONS.map(opt =>
      `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
    // Try to match the saved value; fall back to 3600 (1 hour)
    const savedSec = settings.intervalSeconds || 3600;
    const match = HYDRATION_INTERVAL_OPTIONS.find(o => o.value === savedSec);
    intervalSelect.value = match ? savedSec : 3600;
  }

  toggleReminderSettings();

  // Show live notification permission status
  const statusEl = document.getElementById('notif-permission-status');
  if (statusEl && 'Notification' in window) {
    const p = Notification.permission;
    if (p === 'granted') {
      statusEl.style.background = 'rgba(0,229,160,0.12)';
      statusEl.style.border = '1px solid rgba(0,229,160,0.3)';
      statusEl.style.color = 'var(--accent)';
      statusEl.innerHTML = '🔔 Notifications: Allowed <span class="ic ic-done"></span>';
    } else if (p === 'denied') {
      statusEl.style.background = 'rgba(255,71,87,0.1)';
      statusEl.style.border = '1px solid rgba(255,71,87,0.3)';
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = '🔕 Notifications: Blocked — enable in browser site settings';
    } else {
      statusEl.style.background = 'rgba(255,184,48,0.1)';
      statusEl.style.border = '1px solid rgba(255,184,48,0.3)';
      statusEl.style.color = 'var(--warn)';
      statusEl.textContent = '⚠️ Notifications: Not yet allowed — tap Save to grant permission';
    }
  }

  openModal('hydration-reminder-modal');
}

function toggleReminderSettings() {
  const enabled = document.getElementById('reminder-enabled')?.checked || false;
  const settingsDiv = document.getElementById('reminder-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}

async function saveHydrationReminderSettings() {
  const intervalSeconds = parseInt(document.getElementById('reminder-interval')?.value) || 3600;
  const settings = {
    enabled:         document.getElementById('reminder-enabled')?.checked || false,
    startTime:       document.getElementById('reminder-start-time')?.value  || '08:00',
    endTime:         document.getElementById('reminder-end-time')?.value    || '22:00',
    intervalSeconds: intervalSeconds,
    message:         document.getElementById('reminder-message')?.value     || '💧 Time to hydrate!'
  };

  DB.set('hydrationReminders', settings);

  if (hydrationInterval) clearInterval(hydrationInterval);

  const b = window.AndroidNotificationBridge;
  if (settings.enabled) {
    // Request permission now — we're inside a button-click handler (user gesture)
    await requestNotificationPermission();

    if (b && typeof b.setupBackgroundReminders === 'function') {
      try {
        b.setupBackgroundReminders('💧 Jim Buddy', settings.message, intervalSeconds, settings.startTime, settings.endTime);
        console.log('[NotificationBridge] Native background reminder scheduled successfully');

        // Android 12+: check if exact-alarm permission is granted
        // Without it, alarms may drift up to ~15 min on Doze mode
        if (typeof b.canScheduleExactAlarms === 'function' && !b.canScheduleExactAlarms()) {
          setTimeout(() => {
            toast('⚠️ For precise reminders, grant "Alarms & Reminders" permission in the next screen');
            setTimeout(() => {
              if (typeof b.openExactAlarmSettings === 'function') {
                b.openExactAlarmSettings();
              }
            }, 2000);
          }, 500);
        }
      } catch (e) {
        console.warn('[NotificationBridge] Failed to schedule native background reminder:', e);
      }
    }

    startHydrationReminders(intervalSeconds);
  } else {
    if (b && typeof b.cancelBackgroundReminders === 'function') {
      try {
        b.cancelBackgroundReminders();
        console.log('[NotificationBridge] Native background reminders cancelled');
      } catch (e) {
        console.warn('[NotificationBridge] Failed to cancel native background reminders:', e);
      }
    }
  }

  const label = HYDRATION_INTERVAL_OPTIONS.find(o => o.value === intervalSeconds)?.label || `${intervalSeconds}s`;
  toast(`💧 Reminders saved! (${label})`);
  closeModal('hydration-reminder-modal');
}

function startHydrationReminders(intervalSeconds) {
  if (hydrationInterval) clearInterval(hydrationInterval);

  // Resolve interval from saved settings if not passed directly
  if (intervalSeconds === undefined) {
    const s = DB.get('hydrationReminders');
    intervalSeconds = s?.intervalSeconds ?? (s?.interval ? s.interval * 60 : 3600);
  }

  // Choose tick frequency: fast for short intervals (≤60 s), normal otherwise
  const tickMs = intervalSeconds <= 60 ? HYDRATION_TICK_SHORT_MS : HYDRATION_TICK_NORMAL_MS;

  hydrationInterval = setInterval(() => {
    checkAndSendReminder();
  }, tickMs);

  // Sync native scheduler configuration on startup if running inside Android WebView
  const b = window.AndroidNotificationBridge;
  const s = DB.get('hydrationReminders');
  if (s && s.enabled && b && typeof b.setupBackgroundReminders === 'function') {
    try {
      b.setupBackgroundReminders('💧 Jim Buddy', s.message || '💧 Time to hydrate!', intervalSeconds, s.startTime || '08:00', s.endTime || '22:00');
    } catch(e) {}
  }
}

function checkAndSendReminder() {
  const settings = DB.get('hydrationReminders');
  if (!settings || !settings.enabled) return;

  // Back-compat: convert old minute-based setting on the fly
  let intervalSec = settings.intervalSeconds;
  if (intervalSec === undefined) {
    intervalSec = (settings.interval || 60) * 60;
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  if (currentTime < settings.startTime || currentTime > settings.endTime) return;

  const lastReminder = DB.get('lastHydrationReminder');
  if (lastReminder) {
    const secondsSinceLast = (now - new Date(lastReminder)) / 1000;
    if (secondsSinceLast < intervalSec) return;
  }

  sendHydrationNotification(settings.message);
  DB.set('lastHydrationReminder', now.toISOString());
}

// ─── Rich notification system ─────────────────────────────
// Mirrors what Instagram does:
//   • Goes through the Service Worker so it appears in the system tray
//     even when the screen is off or the tab is backgrounded.
//   • App icon + badge, vibration pattern, two action buttons.
//   • Falls back gracefully when SW / Notification API is unavailable.

// ── Get (or wait for) an active SW registration ───────────



// ─── Chat Notification System ─────────────────────────────
// Cache of friendId → { username, avatar } for fast notification labeling
const _chatNotifNameCache = {};

function _cacheFriendName(friendId, username, avatar) {
  if (friendId && username) {
    _chatNotifNameCache[friendId] = { username, avatar: avatar || '💪' };
  }
}

async function sendChatNotification(senderId, content, chatId) {
  // Don't notify if the chat with this person is currently open
  const chatModal = document.getElementById('chat-modal');
  const modalOpen = chatModal && chatModal.classList.contains('open');
  if (modalOpen && activeChatFriendId === senderId) return;

  // Don't notify if permission not granted
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Get sender name from cache or fallback
  const senderInfo = _chatNotifNameCache[senderId];
  const senderName = senderInfo?.username || 'Your Gymbro';
  const senderAvatar = senderInfo?.avatar || '💪';

  // Truncate long messages
  const body = content.length > 80 ? content.substring(0, 77) + '...' : content;

  const title = `${senderAvatar} ${senderName}`;
  const options = {
    body,
    tag: `chat-${senderId}`,
    renotify: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 200],
    silent: false,
    requireInteraction: false,
    timestamp: Date.now(),
    actions: [
      { action: 'open_chat', title: '💬 Open Chat' },
      { action: 'dismiss_chat', title: '✕ Dismiss' }
    ],
    data: {
      type: 'chat',
      friendId: senderId,
      chatId: chatId,
      action_url: '/?tab=gymbros'
    }
  };

  // Try via Service Worker first (works in background / Android)
  const reg = await _getSwReg();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return;
    } catch (e) {
      console.warn('[ChatNotif] SW notification failed, trying direct:', e);
    }
  }

  // Fallback: direct Notification API
  try {
    new Notification(title, options);
  } catch (e) {
    console.warn('[ChatNotif] All notification methods failed:', e);
  }
}

async function requestChatNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (e) {
    return false;
  }
}

async function enableChatNotifications() {
  const granted = await requestChatNotificationPermission();
  const banner = document.getElementById('chat-notif-banner');
  if (granted) {
    if (banner) banner.style.display = 'none';
    toast('🔔 Chat notifications enabled!');
    // Subscribe to push and save to DB
    await setupPushNotifications();
  } else {
    toast('🔕 Permission denied. Enable notifications in your browser settings.');
  }
}
window.enableChatNotifications = enableChatNotifications;

// Handle chat notification click from SW message
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'CHAT_NOTIFICATION_CLICK') {
      navigate('gymbros');
      // Open specific chat if friendId is known
      if (event.data.friendId && typeof openChat === 'function') {
        setTimeout(() => openChat(event.data.friendId), 500);
      }
    }
  });
}

async function _getSwReg() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // 1. Already registered?
    let reg = await navigator.serviceWorker.getRegistration('/');

    // 2. If the SW exists but is still installing/waiting, wait for it to activate
    if (reg && !reg.active) {
      await new Promise(resolve => {
        const sw = reg.installing || reg.waiting;
        if (!sw) { resolve(); return; }
        sw.addEventListener('statechange', function handler() {
          if (sw.state === 'activated') { sw.removeEventListener('statechange', handler); resolve(); }
        });
        // Safety timeout — don't wait more than 3 s
        setTimeout(resolve, 3000);
      });
      reg = await navigator.serviceWorker.getRegistration('/');
    }

    return reg || null;
  } catch (e) {
    console.warn('[SW] getRegistration failed:', e);
    return null;
  }
}

async function sendHydrationNotification(message) {
  // 1. Always show in-app toast + sound
  toast(message);
  if (typeof SoundManager !== 'undefined') SoundManager.waterSplash();

  // 2. Need permission
  if (!('Notification' in window)) return;

  // Request permission on the fly if not decided yet
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission().catch(() => 'denied');
    if (result !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  // 3. Build rich payload
  const todayWater = getTodayWater(getData().waterLog);
  const waterGoal  = getData().settings?.waterGoal || 2000;
  const pct        = Math.min(100, Math.round((todayWater / waterGoal) * 100));

  const title   = '💧 Jim Buddy';
  const body    = `${message}\n${todayWater} ml of ${waterGoal} ml (${pct}% done)`;
  const options = {
    body,
    tag:       'jimbuddy-hydration', // collapses duplicates
    renotify:  true,                 // re-buzz even if same tag showing
    icon:      '/icons/icon-192.png',
    badge:     '/icons/icon-72.png',
    vibrate:   [0, 100, 80, 100, 80, 200],
    silent:    false,
    requireInteraction: false,
    timestamp: Date.now(),
    actions: [
      { action: 'log_water', title: '💧 Log 250 ml' },
      { action: 'dismiss',   title: '✕ Dismiss'     },
    ],
    data: { action_url: '/?tab=water' },
  };

  // 4. ✅ PRIMARY: reg.showNotification() — works even when tab is in background.
  //    This is the CORRECT way; new Notification() is unreliable on Android Chrome.
  const reg = await _getSwReg();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      console.log('[Notification] Fired via SW registration ✅');
      return;
    } catch (e) {
      console.warn('[Notification] reg.showNotification failed, trying direct API:', e);
    }
  }

  // 5. Fallback: direct Notification() — works when tab is focused (desktop mainly)
  try {
    new Notification(title, options);
    console.log('[Notification] Fired via direct API ✅');
  } catch (e) {
    console.warn('[Notification] All methods failed:', e);
  }
}

function testHydrationReminder() {
  const message = document.getElementById('reminder-message')?.value || '💧 Time to hydrate!';
  sendHydrationNotification(message);
}

// ── Permission request ─────────────────────────────────────
// Called from saveHydrationReminderSettings() so it's triggered by
// a real user gesture (button tap) — browsers require this.
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    toast('❌ This browser does not support notifications');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    toast('🔕 Notifications are blocked. Enable them in browser site settings.');
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      toast('🔔 Notifications allowed! You\'ll get hydration reminders.');
      return true;
    } else {
      toast('🔕 Notifications denied. Reminders will only show as toasts.');
      return false;
    }
  } catch (e) {
    return false;
  }
}

// ── Listen for actions tapped in system notification ──────
// When user taps "💧 Log 250 ml" the SW posts a message back to the page.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'NOTIFICATION_ACTION') {
      const { action } = event.data;
      if (action === 'log_water') {
        addWater(250);
        navigate('water');
        toast('💧 +250 ml logged!');
      }
    }
  });
}

// Start reminders on load (resolve interval from saved settings)
const reminderSettings = DB.get('hydrationReminders');
if (reminderSettings && reminderSettings.enabled) {
  const _bootIntervalSec = reminderSettings.intervalSeconds ??
    ((reminderSettings.interval || 60) * 60);
  startHydrationReminders(_bootIntervalSec);
}

window.openHydrationReminderModal = openHydrationReminderModal;
window.saveHydrationReminderSettings = saveHydrationReminderSettings;
window.toggleReminderSettings = toggleReminderSettings;
window.testHydrationReminder = testHydrationReminder;

// ══════════════════════════════════════════
// CUSTOM BACKGROUND SYSTEM (COMPLETE)
// ══════════════════════════════════════════

function openBackgroundModal() {
  const settings = DB.get('backgroundSettings', { type: 'default', cardOpacity: 0.9 });
  
  document.getElementById('bg-type').value = settings.type;
  document.getElementById('card-opacity').value = settings.cardOpacity || 0.9;
  
  if (settings.type === 'gradient') {
    document.getElementById('gradient-style').value = settings.gradient || 'midnight';
  }
  if (settings.type === 'solid') {
    document.getElementById('solid-color').value = settings.color || '#0A0A0F';
  }
  if (settings.type === 'image') {
    document.getElementById('custom-image-url').value = settings.imageUrl || '';
    document.getElementById('bg-overlay').value = settings.overlay || 40;
    document.getElementById('overlay-value').textContent = (settings.overlay || 40) + '%';
  }
  
  toggleBgType();
  openModal('background-modal');
}

function toggleBgType() {
  const type = document.getElementById('bg-type').value;
  document.getElementById('bg-gradient-settings').style.display = type === 'gradient' ? 'block' : 'none';
  document.getElementById('bg-solid-settings').style.display = type === 'solid' ? 'block' : 'none';
  document.getElementById('bg-image-settings').style.display = type === 'image' ? 'block' : 'none';
}

function applyBgPreview() {
  const type = document.getElementById('bg-type').value;
  const cardOpacity = document.getElementById('card-opacity').value;
  document.documentElement.style.setProperty('--card-bg-opacity', cardOpacity);
  
  document.body.classList.remove('bg-sunset', 'bg-ocean', 'bg-forest', 'bg-midnight', 'bg-custom');
  
  if (type === 'gradient') {
    const gradient = document.getElementById('gradient-style').value;
    document.body.classList.add(`bg-${gradient}`);
  } else if (type === 'solid') {
    const color = document.getElementById('solid-color').value;
    document.body.style.backgroundColor = color;
  } else if (type === 'image') {
    const imageUrl = document.getElementById('custom-image-url').value;
    const overlay = document.getElementById('bg-overlay').value;
    if (imageUrl) {
      document.body.classList.add('bg-custom');
      document.body.style.backgroundImage = `url(${imageUrl})`;
      document.documentElement.style.setProperty('--bg-overlay', overlay / 100);
    }
  } else {
    document.body.style.backgroundColor = '#0A0A0F';
    document.body.style.backgroundImage = '';
  }
}

function previewBgImage() {
  const imageUrl = document.getElementById('custom-image-url').value;
  if (imageUrl) {
    document.body.classList.add('bg-custom');
    document.body.style.backgroundImage = `url(${imageUrl})`;
    toast('Preview applied');
  } else {
    toast('Enter an image URL');
  }
}

function uploadBgImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('custom-image-url').value = e.target.result;
      document.body.classList.add('bg-custom');
      document.body.style.backgroundImage = `url(${e.target.result})`;
      toast('Image loaded! Click Save to keep.');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function saveBgSettings() {
  const settings = {
    type: document.getElementById('bg-type').value,
    cardOpacity: parseFloat(document.getElementById('card-opacity').value)
  };
  
  if (settings.type === 'gradient') {
    settings.gradient = document.getElementById('gradient-style').value;
  } else if (settings.type === 'solid') {
    settings.color = document.getElementById('solid-color').value;
  } else if (settings.type === 'image') {
    settings.imageUrl = document.getElementById('custom-image-url').value;
    settings.overlay = parseInt(document.getElementById('bg-overlay').value);
  }
  
  DB.set('backgroundSettings', settings);
  toast('🎨 Background saved!');
  closeModal('background-modal');
}

function resetBg() {
  if (confirm('Reset to default dark background?')) {
    DB.set('backgroundSettings', { type: 'default', cardOpacity: 0.9 });
    document.body.classList.remove('bg-sunset', 'bg-ocean', 'bg-forest', 'bg-midnight', 'bg-custom');
    document.body.style.backgroundColor = '#0A0A0F';
    document.body.style.backgroundImage = '';
    document.documentElement.style.setProperty('--card-bg-opacity', 0.9);
    toast('Background reset');
    closeModal('background-modal');
  }
}

function loadSavedBackground() {
  const settings = DB.get('backgroundSettings');
  if (settings && settings.type !== 'default') {
    if (settings.type === 'gradient') {
      document.body.classList.add(`bg-${settings.gradient}`);
    } else if (settings.type === 'solid') {
      document.body.style.backgroundColor = settings.color;
    } else if (settings.type === 'image' && settings.imageUrl) {
      document.body.classList.add('bg-custom');
      document.body.style.backgroundImage = `url(${settings.imageUrl})`;
      document.documentElement.style.setProperty('--bg-overlay', (settings.overlay || 40) / 100);
    }
    document.documentElement.style.setProperty('--card-bg-opacity', settings.cardOpacity || 0.9);
  }
}

loadSavedBackground();

window.openBackgroundModal = openBackgroundModal;
window.toggleBgType = toggleBgType;
window.applyBgPreview = applyBgPreview;
window.previewBgImage = previewBgImage;
window.uploadBgImage = uploadBgImage;
window.saveBgSettings = saveBgSettings;
window.resetBg = resetBg;


// ══════════════════════════════════════════
// SETTINGS MODAL & HELPER FUNCTIONS
// ══════════════════════════════════════════

function openSettingsModal() {
  updateSettingsButtonStates();

  // Account section — show only when logged in
  const user    = getAuthUser();
  const section = document.getElementById('settings-account-section');
  if (section) {
    if (user) {
      const uname  = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
      const uemail = user.email || '';
      section.style.display = '';
      const nameEl   = document.getElementById('settings-account-name');
      const emailEl  = document.getElementById('settings-account-email');
      const avatarEl = document.getElementById('settings-account-avatar');
      if (nameEl)   nameEl.textContent   = uname;
      if (emailEl)  emailEl.textContent  = uemail;
      if (avatarEl) avatarEl.textContent = getAvatarForUsername(uname);
    } else {
      section.style.display = 'none';
    }
  }

  openModal('settings-modal');
}

function updateSettingsButtonStates() {
  // Update sound button
  const soundBtn = document.getElementById('settings-sound-btn');
  if (soundBtn && typeof SoundManager !== 'undefined') {
    const isEnabled = SoundManager.isEnabled ? SoundManager.isEnabled() : true;
    soundBtn.textContent = isEnabled ? '🔊 On' : '🔇 Off';
    soundBtn.style.background = isEnabled ? 'var(--accent-dim)' : 'var(--danger-dim)';
  }
  
  // Update performance button
  const perfBtn = document.getElementById('settings-performance-btn');
  if (perfBtn) {
    const isPerfMode = document.body.classList.contains('performance-mode');
    perfBtn.textContent = isPerfMode ? '⚡ On' : '⚡ Off';
    perfBtn.style.background = isPerfMode ? 'var(--accent-dim)' : 'var(--card)';
  }
}

function togglePerformanceModeFromSettings() {
  togglePerformanceMode();
  updateSettingsButtonStates();
}

// Update SoundManager toggle to work with settings
if (typeof SoundManager !== 'undefined' && SoundManager.toggle) {
  const originalToggle = SoundManager.toggle;
  SoundManager.toggle = function() {
    originalToggle();
    updateSettingsButtonStates();
  };
}

// ─── Data Management Functions ───────────────────────────

function exportAllData() {
  const data = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    profiles: DB.get('profiles', []),
    currentProfileId: DB.get('currentProfileId', null),
    profilesData: DB.get('profilesData', {}),
    backgroundSettings: DB.get('backgroundSettings', null),
    hydrationReminders: DB.get('hydrationReminders', null),
    weightUnit: DB.get('weightUnit', 'kg')
  };
  
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jimbuddy-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📁 Data exported successfully!');
}

function importDataFromFile() {
  document.getElementById('import-file-input').click();
}

function importAllData(input) {
  if (!input.files || !input.files[0]) return;
  
  const file = input.files[0];
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      if (confirm('Importing will overwrite ALL current data. Continue?')) {
        // Restore all data
        if (importedData.profiles) DB.set('profiles', importedData.profiles);
        if (importedData.currentProfileId) DB.set('currentProfileId', importedData.currentProfileId);
        if (importedData.profilesData) DB.set('profilesData', importedData.profilesData);
        if (importedData.backgroundSettings) DB.set('backgroundSettings', importedData.backgroundSettings);
        if (importedData.hydrationReminders) DB.set('hydrationReminders', importedData.hydrationReminders);
        if (importedData.weightUnit) DB.set('weightUnit', importedData.weightUnit);
        
        toast('✅ Data imported successfully! Reloading...');
        setTimeout(() => location.reload(), 1500);
      }
    } catch (err) {
      toast('❌ Invalid backup file');
    }
  };
  
  reader.readAsText(file);
  input.value = '';
}

function clearAllData() {
  if (confirm('⚠️ WARNING: This will delete ALL your data (profiles, workouts, PRs, etc.). This cannot be undone! Continue?')) {
    if (confirm('Are you ABSOLUTELY sure? Type "DELETE" to confirm.')) {
      const confirmation = prompt('Type "DELETE" to confirm:');
      if (confirmation === 'DELETE') {
        localStorage.clear();
        toast('All data cleared. Reloading...');
        setTimeout(() => location.reload(), 1500);
      } else {
        toast('Cancelled');
      }
    }
  }
}

// Update updateProfileBadge function to handle the new button
const originalUpdateProfileBadge = updateProfileBadge;
window.updateProfileBadge = function() {
  if (originalUpdateProfileBadge) originalUpdateProfileBadge();
  
  const currentProfile = profiles?.find(p => p.id === currentProfileId);
  const badgeBtn = document.getElementById('profile-badge-btn');
  if (badgeBtn && currentProfile) {
    badgeBtn.innerHTML = `${currentProfile.avatar || JBIcons.svg('user', { size: 18 })}`;
    badgeBtn.title = `Profile: ${currentProfile.name}`;
  }
};

// Make settings functions global
window.openSettingsModal = openSettingsModal;
window.togglePerformanceModeFromSettings = togglePerformanceModeFromSettings;
window.exportAllData = exportAllData;
window.importDataFromFile = importDataFromFile;
window.importAllData = importAllData;
window.clearAllData = clearAllData;

// ─── Change Password (Supabase) ───────────────────────────
function openChangePasswordModal() {
  const pwInput  = document.getElementById('cp-new-password');
  const cfInput  = document.getElementById('cp-confirm-password');
  const msgEl    = document.getElementById('cp-message');
  if (pwInput)  pwInput.value  = '';
  if (cfInput)  cfInput.value  = '';
  if (msgEl)  { msgEl.style.display = 'none'; msgEl.textContent = ''; }
  // reset eye buttons
  document.querySelectorAll('#change-password-modal .auth-eye-btn').forEach(b => { b.innerHTML = _eyeIconShow; });
  document.querySelectorAll('#change-password-modal .auth-pw-input').forEach(i => { i.type = 'password'; });
  openModal('change-password-modal');
}

async function submitChangePassword() {
  const newPw  = document.getElementById('cp-new-password')?.value  || '';
  const cfmPw  = document.getElementById('cp-confirm-password')?.value || '';
  const msgEl  = document.getElementById('cp-message');

  function showCpMsg(text, type = 'error') {
    if (!msgEl) return;
    msgEl.textContent = text; msgEl.className = 'auth-message ' + type; msgEl.style.display = 'block';
  }

  if (newPw.length < 6)   { showCpMsg('Password must be at least 6 characters.'); return; }
  if (newPw !== cfmPw)    { showCpMsg('Passwords do not match.'); return; }

  const session = getAuthSession();
  if (!session?.access_token) { showCpMsg('You must be logged in to change your password.'); return; }

  showCpMsg('Updating password…', 'loading');

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ password: newPw })
    });
    const data = await res.json();

    if (data.error) {
      showCpMsg(data.error.message || 'Failed to update password.');
    } else {
      showCpMsg('✅ Password updated successfully!', 'success');
      setTimeout(() => closeModal('change-password-modal'), 1500);
    }
  } catch (err) {
    showCpMsg('Network error. Please try again.');
  }
}

window.openChangePasswordModal = openChangePasswordModal;
window.submitChangePassword    = submitChangePassword;

// ══════════════════════════════════════════
// AUTH SYSTEM — Supabase backend for accounts
// Workout/profile data stays in localStorage.
// Only sign-up / sign-in / session uses Supabase.
// ══════════════════════════════════════════

const SUPABASE_URL  = 'https://ntgjqeixzmajkefkrhhy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50Z2pxZWl4em1hamtlZmtyaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTg3MDAsImV4cCI6MjA5NzEzNDcwMH0.RZxAsWw8bzQJ7Mwq5Mvqtk3jNUT6rEi3Ah9ZEG7rLM0';
const AUTH_SESSION_KEY = 'jimbuddy_sb_session';

async function isUsernameTaken(username) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leaderboard?username=eq.${encodeURIComponent(username)}&select=username`,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`
        }
      }
    );
    if (!res.ok) return false; // assume not taken if error
    const data = await res.json();
    return data.length > 0;
  } catch {
    return false; // fallback: let sign-up proceed (network issue)
  }
}


// ─── Cloud Sync Functions ───────────────────────────────────────────

async function syncUserDataToCloud() {
  const user = getAuthUser();
  if (!user) return false;

  // Gather all user data
  const data = {
    sessions: DB.get('sessions', []),
    prs: DB.get('prs', {}),
    weightLog: DB.get('weightLog', []),
    weightLossGoal: DB.get('weightLossGoal', null),
    cardioLog: DB.get('cardioLog', []),
    cardioGoal: DB.get('cardioGoal', null),
    waterLog: DB.get('waterLog', []),
    settings: DB.get('settings', { waterGoal: 2000 }),
    weeklySchedule: DB.get('weeklySchedule', { days: {} }),
    foodLog: DB.get('foodLog', []),
    calorieGoals: DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 }),
    customFoods: DB.get('customFoods', []),
    customWorkouts: DB.get('customWorkouts', []),
    weeklyGoals: DB.get('weeklyGoals', []),
    weeklyDietPlan: DB.get('weeklyDietPlan', null),
    profiles: DB.get('profiles', []),
    profilesData: DB.get('profilesData', {}),
    currentProfileId: DB.get('currentProfileId', null),
    calculatorProfile: DB.get('calculatorProfile', null),
    inbodyLog: DB.get('inbodyLog', [])
  };

  const session = getAuthSession();
  if (!session?.access_token) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${session.access_token}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        user_id: user.id,
        data: data,
        updated_at: new Date().toISOString()
      })
    });

    if (res.ok) {
      console.log('[Sync] Data synced to cloud ✅');
      return true;
    } else {
      console.error('[Sync] Failed:', await res.text());
      return false;
    }
  } catch (e) {
    console.error('[Sync] Network error:', e);
    return false;
  }
}

async function loadUserDataFromCloud() {
  const user = getAuthUser();
  if (!user) return false;

  const session = getAuthSession();
  if (!session?.access_token) return false;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${user.id}&select=data`,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    );

    if (res.ok) {
      const result = await res.json();
      if (result && result.length > 0 && result[0].data) {
        const data = result[0].data;
        
        // Restore all data
        DB.set('sessions', data.sessions || []);
        DB.set('prs', data.prs || {});
        DB.set('weightLog', data.weightLog || []);
        DB.set('weightLossGoal', data.weightLossGoal || null);
        DB.set('cardioLog', data.cardioLog || []);
        DB.set('cardioGoal', data.cardioGoal || null);
        DB.set('waterLog', data.waterLog || []);
        DB.set('settings', data.settings || { waterGoal: 2000 });
        DB.set('weeklySchedule', data.weeklySchedule || { days: {} });
        DB.set('foodLog', data.foodLog || []);
        DB.set('calorieGoals', data.calorieGoals || { calories: 2000, protein: 150, carbs: 200, fats: 55 });
        DB.set('customFoods', data.customFoods || []);
        DB.set('customWorkouts', data.customWorkouts || []);
        DB.set('weeklyGoals', data.weeklyGoals || []);
        DB.set('weeklyDietPlan', data.weeklyDietPlan || null);
        if (data.inbodyLog) DB.set('inbodyLog', data.inbodyLog);
        if (data.profiles) DB.set('profiles', data.profiles);
        if (data.profilesData) DB.set('profilesData', data.profilesData);
        if (data.currentProfileId) DB.set('currentProfileId', data.currentProfileId);
        if (data.calculatorProfile) DB.set('calculatorProfile', data.calculatorProfile);

        
        console.log('[Sync] Data loaded from cloud ✅');
        return true;
      }
    }
    console.log('[Sync] No cloud data found');
    return false;
  } catch (e) {
    console.error('[Sync] Load error:', e);
    return false;
  }
}


// ─── Supabase REST helpers ────────────────────────────────
async function sbSignUp(email, password, username) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password, data: { username } })
  });
  return res.json();
}

async function sbSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function sbSignOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${accessToken}` }
  });
}

async function sbRefreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  return res.json();
}

// ─── Session helpers ──────────────────────────────────────
function getAuthSession() {
  try { const r = localStorage.getItem(AUTH_SESSION_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function setAuthSession(session) {
  if (session) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(AUTH_SESSION_KEY);
}
function getAuthUser() {
  const s = getAuthSession();
  return s ? s.user : null;
}

// ─── Build a stable profile-id from a Supabase user id ───
function profileIdFromEmail(email) {
  return 'acct_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// ─── Pick an emoji avatar from username initial ───────────
function getAvatarForUsername(name) {
  if (!name) return '👤';
  const list = ['💪','🏋️','🔥','🥇','⚡','🎯','🚀','🦾'];
  return list[name.charCodeAt(0) % list.length];
}

function activateAccountProfile(username, email) {
  const profileId = profileIdFromEmail(email);
  const avatar = getAvatarForUsername(username);

  // Save outgoing profile data
  if (currentProfileId && currentProfileId !== profileId) {
    saveCurrentProfileData(currentProfileId);
  }

  const exists = profiles.find(p => p.id === profileId);
  if (!exists) {
    profiles.push({
      id: profileId, name: username, avatar, isAccount: true, email,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    DB.set('profiles', profiles);

    // Create empty profile data initially
    const pd = DB.get('profilesData', {});
    pd[profileId] = {
      id: profileId, savedAt: new Date().toISOString(),
      data: {
        sessions: [], prs: {}, weightLog: [], weightLossGoal: null,
        cardioLog: [], cardioGoal: null, waterLog: [],
        settings: { waterGoal: 2000 }, weeklySchedule: { days: {} },
        foodLog: [], calorieGoals: { calories: 2000, protein: 150, carbs: 200, fats: 55 },
        customFoods: [], customWorkouts: [], weeklyGoals: [], userProfile: {}
      }
    };
    DB.set('profilesData', pd);
  } else {
    exists.name = username;
    exists.avatar = avatar;
    exists.updatedAt = new Date().toISOString();
    DB.set('profiles', profiles);
  }

  currentProfileId = profileId;
  DB.set('currentProfileId', currentProfileId);

  // Load profile data and then sync from cloud
  loadProfileData(profileId);
  
  // Try to load from cloud
  loadUserDataFromCloud().then((cloudLoaded) => {
    if (cloudLoaded) {
      // Update local profile data with cloud data
      const pd = DB.get('profilesData', {});
      if (pd[profileId]) {
        pd[profileId].data = {
          sessions: DB.get('sessions', []),
          prs: DB.get('prs', {}),
          weightLog: DB.get('weightLog', []),
          weightLossGoal: DB.get('weightLossGoal', null),
          cardioLog: DB.get('cardioLog', []),
          cardioGoal: DB.get('cardioGoal', null),
          waterLog: DB.get('waterLog', []),
          settings: DB.get('settings', { waterGoal: 2000 }),
          weeklySchedule: DB.get('weeklySchedule', { days: {} }),
          foodLog: DB.get('foodLog', []),
          calorieGoals: DB.get('calorieGoals', { calories: 2000, protein: 150, carbs: 200, fats: 55 }),
          customFoods: DB.get('customFoods', []),
          customWorkouts: DB.get('customWorkouts', []),
          weeklyGoals: DB.get('weeklyGoals', []),
          inbodyLog: DB.get('inbodyLog', [])
        };
        pd[profileId].savedAt = new Date().toISOString();
        DB.set('profilesData', pd);
      }
      toast('☁️ Data synced from cloud!');
    }
    
    updateProfileBadge();
    renderProfilesList();
    renderDashboard();
    renderWorkouts();
    renderProgress();
    renderWeeklySchedule();
    renderCalorieTracker();
    renderWater();
    renderGoals();
    renderPRLists();
  });
}

// ─── Switch back to first guest profile on logout ─────────
function deactivateAccountProfile() {
  if (currentProfileId) saveCurrentProfileData(currentProfileId);
  const guest = profiles.find(p => !p.isAccount);
  if (guest) {
    currentProfileId = guest.id;
    DB.set('currentProfileId', currentProfileId);
    loadProfileData(guest.id);
  }
  updateProfileBadge(); renderProfilesList(); renderDashboard();
  renderWorkouts(); renderProgress(); renderWeeklySchedule();
  renderCalorieTracker(); renderWater(); renderGoals(); renderPRLists();
}

// ─── Tab switching ────────────────────────────────────────
function switchAuthTab(tab) {
  const loginForm  = document.getElementById('auth-form-login');
  const signupForm = document.getElementById('auth-form-signup');
  const loginTab   = document.getElementById('auth-tab-login');
  const signupTab  = document.getElementById('auth-tab-signup');
  const msg        = document.getElementById('auth-message');
  if (!loginForm || !signupForm) return;
  if (tab === 'login') {
    loginForm.style.display = ''; signupForm.style.display = 'none';
    loginTab.classList.add('active'); signupTab.classList.remove('active');
  } else {
    loginForm.style.display = 'none'; signupForm.style.display = '';
    loginTab.classList.remove('active'); signupTab.classList.add('active');
  }
  if (msg) { msg.style.display = 'none'; msg.className = 'auth-message'; msg.textContent = ''; }
}

// ─── Show/hide password toggle ────────────────────────────
const _eyeIconShow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _eyeIconHide = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function toggleAuthPassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text'; btn.innerHTML = _eyeIconHide;
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password'; btn.innerHTML = _eyeIconShow;
    btn.setAttribute('aria-label', 'Show password');
  }
}

// ─── Message helpers ──────────────────────────────────────
function showAuthMessage(text, type = 'error') {
  const msg = document.getElementById('auth-message');
  if (!msg) return;
  msg.textContent = text; msg.className = 'auth-message ' + type; msg.style.display = 'block';
}
function hideAuthMessage() {
  const msg = document.getElementById('auth-message');
  if (msg) { msg.style.display = 'none'; msg.textContent = ''; msg.className = 'auth-message'; }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

// ─── Sign Up (Supabase) ───────────────────────────────────
async function authSignUp() {
  const username = document.getElementById('auth-signup-username')?.value.trim();
  const email    = document.getElementById('auth-signup-email')?.value.trim();
  const password = document.getElementById('auth-signup-password')?.value;

  // ─── Basic validation ──────────────────────────────
  if (!username || username.length < 2) {
    showAuthMessage('Please enter a username (at least 2 characters).');
    return;
  }
  if (!isValidEmail(email)) {
    showAuthMessage('Please enter a valid email address.');
    return;
  }
  if (!password || password.length < 6) {
    showAuthMessage('Password must be at least 6 characters.');
    return;
  }

  // ─── NEW: Check if username is already taken ──────
  showAuthMessage('Checking username availability...', 'loading');
  const taken = await isUsernameTaken(username);
  if (taken) {
    showAuthMessage('❌ Username "' + username + '" is already taken. Please choose another.');
    return;
  }

  // ─── Proceed with sign‑up ──────────────────────────
  showAuthMessage('Creating account…', 'loading');
  try {
    const data = await sbSignUp(email, password, username);

    if (data.error) {
      const msg = data.error.message || data.msg || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        showAuthMessage('An account with this email already exists. Please log in.');
      } else {
        showAuthMessage(msg || 'Sign-up failed. Please try again.');
      }
      return;
    }

    const session = data.session || null;
    const user    = data.user || (session && session.user) || null;
    const uname   = user?.user_metadata?.username || username;
    const uemail  = user?.email || email;

    if (session) {
      setAuthSession({ ...session, user: { ...session.user, user_metadata: { username: uname } } });
    }

    activateAccountProfile(uname, uemail);

    // ─── NEW: Sync leaderboard immediately ──────────
    if (getAuthUser()) {
      setTimeout(() => syncLeaderboard(), 1500);
    }

    if (session) {
      showAuthMessage('Account created! Welcome, ' + uname + ' 🎉', 'success');
      setTimeout(() => {
        renderAuthState();
        closeModal('profile-modal');
        toast('🎉 Welcome, ' + uname + '!');
      }, 900);
    } else {
      // Email confirmation required
      showAuthMessage('✅ Account created! Check your email to confirm, then log in below.', 'success');
      setTimeout(() => {
        const signupPassword = document.getElementById('auth-signup-password')?.value || '';
        switchAuthTab('login');
        const loginEmailInput = document.getElementById('auth-login-email');
        if (loginEmailInput) loginEmailInput.value = email;
        const loginPwInput = document.getElementById('auth-login-password');
        if (loginPwInput) { loginPwInput.value = signupPassword; loginPwInput.focus(); }
        showAuthMessage('✅ Account created! Hit Log In to continue.', 'success');
      }, 1500);
    }
  } catch (err) {
    showAuthMessage('Network error. Check your connection and try again.');
    console.error('authSignUp error:', err);
  }
}

// ─── Log In (Supabase) ────────────────────────────────────
async function authLogin() {
  console.log('🔐 Attempting login...');
  console.log('Supabase URL:', SUPABASE_URL);
  
  const email = document.getElementById('auth-login-email')?.value.trim();
  const password = document.getElementById('auth-login-password')?.value;

  if (!isValidEmail(email)) { 
    showAuthMessage('Please enter a valid email address.'); 
    return; 
  }
  if (!password) { 
    showAuthMessage('Please enter your password.'); 
    return; 
  }

  showAuthMessage('Logging in…', 'loading');

  try {
    // Add timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': SUPABASE_ANON,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok) {
      console.error('Login error:', data);
      const msg = data.error?.message || data.msg || 'Login failed';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        showAuthMessage('Incorrect email or password.');
      } else if (msg.toLowerCase().includes('confirm')) {
        showAuthMessage('Please confirm your email address first.');
      } else if (msg.toLowerCase().includes('network')) {
        showAuthMessage('Network error. Check your connection.');
      } else {
        showAuthMessage(msg || 'Login failed. Please try again.');
      }
      return;
    }

    // ✅ SUCCESS: Process the login
    const uname = data.user?.user_metadata?.username || data.user?.email?.split('@')[0] || 'User';
    const uemail = data.user?.email || email;

    // Save session
    setAuthSession(data);
    
    // Activate the account profile
    activateAccountProfile(uname, uemail);

    showAuthMessage('Welcome back, ' + uname + '! 💪', 'success');
    
    // Close modal and refresh UI after a short delay
    setTimeout(() => { 
      renderAuthState(); 
      closeModal('profile-modal'); 
      toast('👋 Welcome back, ' + uname + '!');
      // Refresh dashboard and other views
      renderDashboard();
      renderWorkouts();
      renderProgress();
      renderWeeklySchedule();
      renderCalorieTracker();
      renderWater();
      renderGoals();
      renderPRLists();
    }, 800);

  } catch (err) {
    console.error('Login error:', err);
    if (err.name === 'AbortError') {
      showAuthMessage('Request timed out. Check your internet connection.');
    } else {
      showAuthMessage('Network error. Check your connection and try again.');
    }
  }
}

// ─── Log Out ──────────────────────────────────────────────
async function authLogout() {
  if (!confirm('Log out of your account? You\'ll be switched back to guest mode.')) return;
  const session = getAuthSession();
  if (session?.access_token) {
    try { await sbSignOut(session.access_token); } catch (e) { /* ignore */ }
  }
  setAuthSession(null);
  deactivateAccountProfile();
  renderAuthState();
  toast('Logged out — switched to guest profile');
}

// ─── Render auth UI ───────────────────────────────────────
function renderAuthState() {
  const user         = getAuthUser();
  const authCard     = document.getElementById('auth-card');
  const loggedinCard = document.getElementById('auth-loggedin-card');
  if (!authCard || !loggedinCard) return;

  if (user) {
    authCard.style.display     = 'none';
    loggedinCard.style.display = '';
    const uname = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
    const nameEl   = document.getElementById('auth-loggedin-name');
    const emailEl  = document.getElementById('auth-loggedin-email');
    const avatarEl = document.getElementById('auth-loggedin-avatar');
    if (nameEl)   nameEl.textContent   = uname;
    if (emailEl)  emailEl.textContent  = user.email || '';
    if (avatarEl) avatarEl.textContent = getAvatarForUsername(uname);
    
    // Start social status updates
    if (typeof startStatusHeartbeat === 'function') {
      startStatusHeartbeat();
    }

    // Request notification permission for chat notifications (silently if already decided)
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay slightly so it doesn't fire immediately on login — feels more natural
      setTimeout(() => requestChatNotificationPermission(), 3000);
    }
  } else {
    authCard.style.display     = '';
    loggedinCard.style.display = 'none';
    hideAuthMessage();
    switchAuthTab('login');
    ['auth-login-email','auth-login-password',
     'auth-signup-username','auth-signup-email','auth-signup-password'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('.auth-eye-btn').forEach(btn => { btn.innerHTML = _eyeIconShow; });
    document.querySelectorAll('.auth-pw-input').forEach(inp => { inp.type = 'password'; });
    
    // Stop social status updates
    if (typeof stopStatusHeartbeat === 'function') {
      stopStatusHeartbeat();
    }
  }
}

// ─── Hook openProfileModal ────────────────────────────────
const _origOpenProfileModal = window.openProfileModal;
window.openProfileModal = function() {
  if (_origOpenProfileModal) _origOpenProfileModal();
  renderAuthState();
};

// ─── On app start — restore Supabase session ─────────────
(async function restoreAuthSession() {
  const session = getAuthSession();
  if (!session) return;

  // Try to refresh the token silently so it stays valid
  if (session.refresh_token) {
    try {
      const refreshed = await sbRefreshSession(session.refresh_token);
      if (refreshed.access_token) {
        setAuthSession(refreshed);
        const uname  = refreshed.user?.user_metadata?.username || refreshed.user?.email?.split('@')[0] || 'User';
        const uemail = refreshed.user?.email || '';
        activateAccountProfile(uname, uemail);
        updateProfileBadge();
        renderAuthState();
        return;
      }
    } catch (e) { /* network offline — fall through to cached user */ }
  }

  // Use cached session (offline / refresh failed)
  const user = session.user || session;
  if (user?.email) {
    const uname  = user.user_metadata?.username || user.email.split('@')[0] || 'User';
    const uemail = user.email;
    const profileId = profileIdFromEmail(uemail);
    const exists = profiles.find(p => p.id === profileId);
    if (exists && currentProfileId !== profileId) {
      currentProfileId = profileId;
      DB.set('currentProfileId', currentProfileId);
      loadProfileData(profileId);
      updateProfileBadge();
    } else if (!exists) {
      activateAccountProfile(uname, uemail);
    }
    renderAuthState();
  }
})();

// ─── Expose globals ───────────────────────────────────────
window.switchAuthTab      = switchAuthTab;
window.toggleAuthPassword = toggleAuthPassword;
window.authSignUp         = authSignUp;
window.authLogin          = authLogin;
window.authLogout         = authLogout;
window.renderAuthState    = renderAuthState;

// ─── Init ─────────────────────────────────────────────────

// ══════════════════════════════════════════
// ONBOARDING TOUR
// ══════════════════════════════════════════

const TourManager = {
  steps: [],
  currentStep: 0,
  isRunning: false,

  init() {
    const hasOnboarded = DB.get('hasOnboarded', false);
    if (hasOnboarded) return;

    const profiles = DB.get('profiles', []);
    const calorieGoals = DB.get('calorieGoals', null);
    const schedule = DB.get('weeklySchedule', null);

    if (profiles.length > 0 && calorieGoals && schedule?.days) {
      const hasExercises = Object.values(schedule.days).some(d => d.workouts?.length > 0);
      if (hasExercises) {
        DB.set('hasOnboarded', true);
        return;
      }
    }

    this.steps = [
      {
        target: '#profile-badge-btn',
        title: '👤 Create Your Profile',
        desc: 'Tap the profile icon to create your first profile. This stores all your progress, PRs, and history.',
        arrow: 'bottom'
      },
      {
        target: '#settings-btn',
        title: '⚙️ Set Your Goals',
        desc: 'Open Settings, then go to "Calorie & Weight Calculator". Enter your age, weight, height, and activity level to get your daily targets.',
        arrow: 'bottom'
      },
      {
        target: '[data-page="water"]',
        title: '💧 Set Water Goal',
        desc: 'Navigate to the Water tab and set your daily hydration goal (default is 2000ml). Stay hydrated!',
        arrow: 'top'
      },
      {
        target: '[data-page="schedule"]',
        title: '📅 Plan Your Week',
        desc: 'Go to Schedule and tap a day to add exercises. Or use a Quick Template (Push/Pull/Legs, Upper/Lower, etc.) to get started instantly.',
        arrow: 'top'
      }
    ];

    this.isRunning = true;
    this.currentStep = 0;
    this.showStep(0);
  },

  showStep(index) {
    const step = this.steps[index];
    if (!step) { this.finish(); return; }

    const overlay = document.getElementById('tour-overlay');
    const spotlight = document.getElementById('tour-spotlight');
    const tooltip = document.getElementById('tour-tooltip');
    const counter = document.getElementById('tour-step-counter');
    const title = document.getElementById('tour-title');
    const desc = document.getElementById('tour-description');
    const nextBtn = document.getElementById('tour-next-btn');
    const skipBtn = document.getElementById('tour-skip-btn');

    overlay.style.display = 'block';
    counter.textContent = `${index + 1} / ${this.steps.length}`;
    title.textContent = step.title;
    desc.textContent = step.desc;
    nextBtn.textContent = index === this.steps.length - 1 ? '🎉 Finish' : 'Next →';

    const target = document.querySelector(step.target);
    if (!target) {
      spotlight.style.display = 'none';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.dataset.arrow = 'top';
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 12;
    spotlight.style.display = 'block';
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = (rect.height + padding * 2) + 'px';

    let left, top, arrow;
    if (step.arrow === 'bottom') {
      top = rect.bottom + 16;
      left = rect.left + rect.width / 2 - 170;
      arrow = 'top';
      if (top + 220 > window.innerHeight - 20) {
        top = rect.top - 220 - 16;
        arrow = 'bottom';
      }
      if (left < 10) left = 10;
      if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 340 - 10;
    } else {
      top = rect.top - 220 - 16;
      arrow = 'bottom';
      if (top < 20) {
        top = rect.bottom + 16;
        arrow = 'top';
      }
      left = rect.left + rect.width / 2 - 170;
      if (left < 10) left = 10;
      if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 340 - 10;
    }

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.dataset.arrow = arrow;

    const newNext = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    const newSkip = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkip, skipBtn);

    newNext.addEventListener('click', () => {
      if (index === this.steps.length - 1) this.finish();
      else { this.currentStep++; this.showStep(this.currentStep); }
    });
    newSkip.addEventListener('click', () => this.finish());

    spotlight.style.animation = 'none';
    spotlight.offsetHeight;
    spotlight.style.animation = 'spotlightPulse 2s ease-in-out infinite';
  },

  finish() {
    document.getElementById('tour-overlay').style.display = 'none';
    document.getElementById('tour-spotlight').style.display = 'none';
    this.isRunning = false;
    DB.set('hasOnboarded', true);
    toast('🎉 You\'re all set! Welcome to Jim Buddy.');
  }
};

// Auto‑start after page loads — TourManager.init() is already called
// inside the autocomplete DOMContentLoaded block above with the same 800ms delay.

document.addEventListener('DOMContentLoaded', () => {
  renderAuthState();
});

// ─── Leaderboard timing fix ────────────────────────────────
// Single call after page load — the cooldown guard in renderLeaderboardHome
// prevents any duplicate or rapid-fire executions.
window.addEventListener('load', () => {
  setTimeout(() => renderLeaderboardHome(), 2000);
});
// ══════════════════════════════════════════
// LEADERBOARD SYSTEM
// Uses Supabase table: leaderboard
// Columns: user_id (text PK), username (text),
//          avatar (text), streak (int),
//          pr_count (int), total_volume (int),
//          top_pr_name (text), top_pr_weight (int),
//          updated_at (timestamptz)
// Enable RLS: select for all anon, insert/update for auth users only.
// ══════════════════════════════════════════

const LB_TABLE = 'leaderboard';
let _lbCurrentTab = 'streak';
let _lbCache = null;
let _lbCacheTime = 0;
const LB_CACHE_MS = 60_000; // re-fetch at most once per minute

// ─── Helpers ───────────────────────────────────────────────

function lbHeaders(withAuth = false) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON,
    'Prefer': 'return=minimal'
  };
  if (withAuth) {
    const s = getAuthSession();
    if (s?.access_token) h['Authorization'] = `Bearer ${s.access_token}`;
  }
  return h;
}

// Build the current user's stats object from localStorage
function buildMyStats() {
  const user = getAuthUser();
  if (!user) return null;

  const sessions  = DB.get('sessions', []);
  const prs       = DB.get('prs', {});
  const streak    = calcStreak(sessions);
  const prEntries = Object.values(prs);
  const prCount   = prEntries.length;

  // Total volume: sum of weight × reps across all sessions
  let totalVolume = 0;
  sessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(set => {
        if (set.done) totalVolume += (set.weight || 0) * (set.reps || 1);
      });
    });
  });

  // Top PR
  let topPrName = null, topPrWeight = 0;
  prEntries.forEach(pr => {
    if ((pr.weight || 0) > topPrWeight) {
      topPrWeight = pr.weight;
      topPrName   = pr.name;
    }
  });

  const uname  = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
  const avatar  = getAvatarForUsername(uname);

  // Snapshot the current weekly schedule for display on other users' profile views
  const weeklySchedule = DB.get('weeklySchedule', { days: {} });

  return {
    user_id:       user.id,
    username:      uname,
    avatar:        avatar,
    streak:        streak,
    pr_count:      prCount,
    total_volume:  Math.round(totalVolume),
    top_pr_name:   topPrName || '—',
    top_pr_weight: Math.round(parseFloat(topPrWeight) || 0),
    weekly_split:  weeklySchedule,
    updated_at:    new Date().toISOString()
  };
}

// ─── Sync (upsert) current user's stats ────────────────────

async function syncLeaderboard() {
  const user = getAuthUser();
  if (!user) return false;

  const stats = buildMyStats();
  if (!stats) return false;

  const session = getAuthSession();
  if (!session?.access_token) {
    console.warn('[Leaderboard] No access token — user not fully logged in');
    return false;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${LB_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(stats)
      }
    );

    const responseText = await res.text();
    console.log(`[Leaderboard] Sync → ${res.status}`, responseText || '(empty)');

    if (!res.ok) {
      if (responseText.includes('does not exist') || responseText.includes('42P01')) {
        console.error('[Leaderboard] Table "leaderboard" does not exist in Supabase. Run the setup SQL.');
        lbShowSetupWarning();
      } else if (res.status === 401 || res.status === 403) {
        console.error('[Leaderboard] Auth error — RLS policy may be blocking insert/upsert.');
      } else {
        console.error('[Leaderboard] Sync failed:', responseText);
      }
      return false;
    }

    _lbCache = null; // invalidate cache so next fetch is fresh
    return true;
  } catch (e) {
    console.error('[Leaderboard] Sync network error:', e);
    return false;
  }
}

// ─── Fetch all rows ────────────────────────────────────────

async function fetchLeaderboard() {
  if (_lbCache && (Date.now() - _lbCacheTime) < LB_CACHE_MS) return _lbCache;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${LB_TABLE}?select=*&order=streak.desc&limit=100`,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json'
        }
      }
    );

    const responseText = await res.text();
    console.log(`[Leaderboard] Fetch → ${res.status}`, responseText.slice(0, 200));

    if (!res.ok) {
      if (responseText.includes('does not exist') || responseText.includes('42P01')) {
        console.error('[Leaderboard] Table "leaderboard" does not exist. Run setup SQL in Supabase.');
        return 'NO_TABLE';
      }
      if (res.status === 401 || res.status === 403) {
        console.error('[Leaderboard] Access denied — check RLS policies (anon select policy missing?)');
        return 'NO_ACCESS';
      }
      return null;
    }

    let data;
    try { data = JSON.parse(responseText); } catch { return null; }
    _lbCache = Array.isArray(data) ? data : null;
    _lbCacheTime = Date.now();
    return _lbCache;
  } catch (e) {
    console.error('[Leaderboard] Fetch network error:', e);
    return null;
  }
}

// ─── Setup warning in UI ────────────────────────────────────
function lbShowSetupWarning() {
  const containers = ['leaderboard-home-list', 'leaderboard-modal-list'];
  const html = `
    <div style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);border-radius:10px;padding:14px;margin:8px 0;">
      <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:6px;">⚠️ Leaderboard table missing</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">
        Run this SQL in your <strong>Supabase SQL Editor</strong>:<br><br>
        <code style="font-size:10px;display:block;background:var(--bg3);padding:8px;border-radius:6px;overflow-x:auto;white-space:pre;">create table leaderboard (
  user_id text primary key,
  username text not null,
  avatar text,
  streak integer default 0,
  pr_count integer default 0,
  total_volume integer default 0,
  top_pr_name text,
  top_pr_weight integer default 0,
  updated_at timestamptz default now()
);
alter table leaderboard enable row level security;
create policy "read all" on leaderboard
  for select using (true);
create policy "own row" on leaderboard
  for all using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);</code>
      </div>
    </div>`;
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

// ─── Sort rows by current tab ──────────────────────────────

function lbSort(rows, tab) {
  const key = tab === 'streak' ? 'streak' : tab === 'prs' ? 'pr_count' : 'total_volume';
  return [...rows].sort((a, b) => (b[key] || 0) - (a[key] || 0));
}

// ─── Medal emoji ───────────────────────────────────────────

function lbMedal(rank) {
  if (rank === 1) return JBIcons.svg('medal', { size: 16, color: '#FFD700' });
  if (rank === 2) return JBIcons.svg('medal', { size: 16, color: '#C0C0C0' });
  if (rank === 3) return JBIcons.svg('medal', { size: 16, color: '#CD7F32' });
  return null;
}

function lbRankClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-other';
}

// ─── Render home card (top 3 compact) ──────────────────────

let _lbHomeRunning = false;
let _lbHomeLastRun = 0;
const LB_HOME_COOLDOWN = 30_000; // 30s minimum between full refreshes

async function renderLeaderboardHome() {
  // Prevent concurrent executions and rapid re-calls
  if (_lbHomeRunning) return;
  const now = Date.now();
  if (now - _lbHomeLastRun < LB_HOME_COOLDOWN) return;

  _lbHomeRunning = true;
  _lbHomeLastRun = now;

  const card = document.getElementById('leaderboard-home-card');
  if (!card) { _lbHomeRunning = false; return; }

  // Wait up to 3 seconds for auth to be ready
  let user = getAuthUser();
  if (!user) {
    let waited = 0;
    while (!user && waited < 3000) {
      await new Promise(r => setTimeout(r, 300));
      waited += 300;
      user = getAuthUser();
    }
  }

  // Hide if still no user
  if (!user) { card.style.display = 'none'; _lbHomeRunning = false; return; }

  // Show the card
  card.style.display = '';

  const subtitleEl = document.getElementById('leaderboard-subtitle');
  if (subtitleEl) subtitleEl.textContent = 'Top gym athletes';

  const container = document.getElementById('leaderboard-home-list');
  if (!container) { _lbHomeRunning = false; return; }
  container.innerHTML = '<div class="leaderboard-loading"><span class="muted-text">Loading…</span></div>';

  // Sync (use internal fn directly — never window.syncLeaderboard which is the button handler)
  try {
    await Promise.race([
      _syncLeaderboardInternal(),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
  } catch(e) { console.warn('[LB] sync failed:', e); }

  let rows = null;
  try {
    rows = await Promise.race([
      fetchLeaderboard(),
      new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]);
  } catch(e) { console.warn('[LB] fetch failed:', e); }

  _lbHomeRunning = false;

  // Handle error states
  if (rows === 'NO_TABLE') {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:8px;font-size:11px;">⚠️ Leaderboard table not set up in Supabase yet.</p>';
    return;
  }
  if (rows === 'NO_ACCESS') {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:8px;">⚠️ RLS policy missing — check Supabase.</p>';
    return;
  }
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:8px;">Be the first on the leaderboard! ' + JBIcons.svg('dumbbell', { size: 16 }) + '</p>';
    return;
  }

  const sorted = lbSort(rows, 'streak');
  const top3   = sorted.slice(0, 3);
  const myId   = user.id;

  const valueLabel = (r) => `${JBIcons.svg('flame', { size: 14 })} ${r.streak || 0} day${r.streak !== 1 ? 's' : ''}`;

  container.innerHTML = top3.map((r, i) => {
    const rank = i + 1;
    const isMe = r.user_id === myId;
    return `
      <div class="lb-home-row" ${!isMe ? `onclick="openUserProfile('${r.user_id}')" style="cursor:pointer;"` : ''}>
        <span class="lb-home-medal">${lbMedal(rank)}</span>
        <span class="lb-home-avatar">${r.avatar || '💪'}</span>
        <span class="lb-home-name">${escHtml(r.username)}${isMe ? ' <span class="lb-you-badge">YOU</span>' : ''}</span>
        <span class="lb-home-value">${valueLabel(r)}</span>
      </div>
    `;
  }).join('');
}

// ─── Open full modal ────────────────────────────────────────

function openLeaderboardModal() {
  _lbCurrentTab = 'streak';
  // Reset tab buttons
  ['streak','prs','volume'].forEach(t => {
    const btn = document.getElementById('lb-tab-' + t);
    if (btn) btn.classList.toggle('active', t === 'streak');
  });
  openModal('leaderboard-modal');
  renderLeaderboardModal();
}

function switchLeaderboardTab(tab) {
  _lbCurrentTab = tab;
  ['streak','prs','volume'].forEach(t => {
    const btn = document.getElementById('lb-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  renderLeaderboardModal();
}

async function renderLeaderboardModal() {
  const container = document.getElementById('leaderboard-modal-list');
  if (!container) return;
  container.innerHTML = '<div class="leaderboard-loading"><span class="muted-text">Loading…</span></div>';

  // Use internal sync fn to avoid going through the button handler
  await _syncLeaderboardInternal();
  const rows = await fetchLeaderboard();
  const user = getAuthUser();
  const myId = user?.id;

  if (rows === 'NO_TABLE') { lbShowSetupWarning(); return; }
  if (rows === 'NO_ACCESS') {
    container.innerHTML = '<p class="muted-text" style="text-align:center;padding:16px;">⚠️ RLS policy blocking read. Add anon select policy in Supabase.</p>';
    return;
  }
  if (!rows || rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${JBIcons.svg('trophy', { size: 32 })}</span>
        <p>No athletes yet — you're first! 🎉</p>
        <p style="font-size:12px;color:var(--text3);">Make sure the leaderboard table exists and you're logged in.</p>
      </div>`;
    return;
  }

  const sorted = lbSort(rows, _lbCurrentTab);
  const top3   = sorted.slice(0, 3);
  const rest   = sorted.slice(3);

  const valueFn = (r) => {
    if (_lbCurrentTab === 'streak')  return { v: r.streak || 0,        unit: 'days' };
    if (_lbCurrentTab === 'prs')     return { v: r.pr_count || 0,      unit: 'PRs'  };
    return                                   { v: r.total_volume || 0,  unit: 'kg×reps' };
  };

  const subFn = (r) => {
    if (_lbCurrentTab === 'streak')
      return `${JBIcons.svg('trophy', { size: 14 })} ${r.pr_count || 0} PRs · Top: ${r.top_pr_name || '—'} ${r.top_pr_weight ? r.top_pr_weight + 'kg' : ''}`;
    if (_lbCurrentTab === 'prs')
      return `${JBIcons.svg('flame', { size: 14 })} ${r.streak || 0} day streak · Top: ${r.top_pr_name || '—'} ${r.top_pr_weight ? r.top_pr_weight + 'kg' : ''}`;
    return `${JBIcons.svg('flame', { size: 14 })} ${r.streak || 0} day streak · ${JBIcons.svg('trophy', { size: 14 })} ${r.pr_count || 0} PRs`;
  };

  const rowHtml = (r, rank) => {
    const isMe   = r.user_id === myId;
    const medal  = lbMedal(rank);
    const rc     = lbRankClass(rank);
    const { v, unit } = valueFn(r);
    return `
      <div class="lb-row ${rc}${isMe ? ' lb-me' : ''}" ${!isMe ? `onclick="openUserProfile('${r.user_id}')" style="cursor:pointer;"` : ''}>
        ${medal
          ? `<span class="lb-medal">${medal}</span>`
          : `<span class="lb-rank-num">#${rank}</span>`}
        <div class="lb-avatar">${r.avatar || '💪'}</div>
        <div class="lb-info">
          <div class="lb-name">
            ${escHtml(r.username)}
            ${isMe ? '<span class="lb-you-badge">YOU</span>' : ''}
          </div>
          <div class="lb-sub">${subFn(r)}</div>
        </div>
        <div>
          <div class="lb-value">${v}</div>
          <div class="lb-unit">${unit}</div>
        </div>
      </div>
    `;
  };

  // Find where current user ranks (if not in top3)
  let myRankHtml = '';
  if (myId) {
    const myIdx = sorted.findIndex(r => r.user_id === myId);
    if (myIdx >= 3) {
      const myRow = sorted[myIdx];
      myRankHtml = `
        <div class="lb-divider">· · · · · · · · · ·</div>
        ${rowHtml(myRow, myIdx + 1)}
      `;
    }
  }

  container.innerHTML =
    top3.map((r, i) => rowHtml(r, i + 1)).join('') +
    (rest.length ? `<div class="lb-divider" style="margin:12px 0 8px;">─── All Athletes ───</div>` : '') +
    rest.map((r, i) => rowHtml(r, i + 4)).join('') +
    myRankHtml;
}

// ─── Auto-sync on login / session restore ──────────────────
const _origActivateAccountProfile = activateAccountProfile;
window.activateAccountProfile = function(uname, uemail) {
  _origActivateAccountProfile(uname, uemail);
  // Don't call renderLeaderboardHome here — restoreAuthSession already
  // schedules it, and the cooldown guard prevents duplicate runs anyway.
};

// ─── Auto-sync after saving a full session ──────────────────
// Patch saveFullSession to also sync the leaderboard.
// We store the original reference immediately and re-assign window.saveFullSession
// so the global inline onclick="saveFullSession()" picks up the patched version.
const _origSaveFullSessionFn = saveFullSession;
window.saveFullSession = function() {
  _origSaveFullSessionFn();
  if (getAuthUser()) setTimeout(() => renderLeaderboardHome(), 800);
};

// Note: renderDashboard hook removed — it caused infinite recursion because
// the leaderboard wrapping ran after the performance-optimization wrapper
// already captured renderDashboard. renderLeaderboardHome is called explicitly
// from restoreAuthSession and window.load instead.

// ─── Public sync button handler ─────────────────────────────
// Keep a direct reference to the internal syncLeaderboard function
// BEFORE we expose window.syncLeaderboard (which points here),
// so calling _syncLeaderboardInternal() never recurses.
const _syncLeaderboardInternal = syncLeaderboard;

async function syncLeaderboardBtn() {
  toast('🔄 Syncing...');
  const ok = await _syncLeaderboardInternal();
  if (ok) {
    _lbCache = null;
    toast('✅ Leaderboard synced!');
    renderLeaderboardModal();
    renderLeaderboardHome();
  } else {
    toast('❌ Sync failed — check console for details');
  }
}

// Expose globals
window.openLeaderboardModal    = openLeaderboardModal;
window.switchLeaderboardTab    = switchLeaderboardTab;
window.syncLeaderboard         = syncLeaderboardBtn;
window.renderLeaderboardHome   = renderLeaderboardHome;

// ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════
// END LEADERBOARD SYSTEM
//
// SUPABASE SETUP (one-time):
// Run this SQL in Supabase SQL editor:
//
// create table if not exists leaderboard (
//   user_id       text primary key,
//   username      text not null,
//   avatar        text,
//   streak        integer default 0,
//   pr_count      integer default 0,
//   total_volume  integer default 0,
//   top_pr_name   text,
//   top_pr_weight integer default 0,
//   weekly_split  jsonb,
//   updated_at    timestamptz default now()
// );
// alter table leaderboard enable row level security;
// create policy "anyone can read" on leaderboard for select using (true);
// create policy "users manage own row" on leaderboard for all
//   using (auth.uid()::text = user_id)
//   with check (auth.uid()::text = user_id);
//
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// VIEW USER PROFILE SYSTEM
// ══════════════════════════════════════════

/**
 * Opens the View Profile modal for any user by their leaderboard user_id.
 * Works from the Gymbros page (friend cards) and the Leaderboard modal.
 */
async function openUserProfile(userId) {
  if (!userId) return;

  const currentUser = getAuthUser();
  if (!currentUser) {
    toast('Log in to view profiles.');
    return;
  }

  // Don't open self-profile — they have their own edit modal
  if (userId === currentUser.id || userId === currentUser.id?.toString()) {
    toast("That's you! Use the profile button to edit your profile.");
    return;
  }

  // Show modal immediately in loading state
  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;
  openModal('user-profile-modal');
  _renderUserProfileLoading();

  try {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Supabase not available');

    // ── Fetch target user's leaderboard row ──────────────
    const { data: rows, error } = await client
      .from('leaderboard')
      .select('user_id, username, avatar, streak, pr_count, total_volume, top_pr_name, top_pr_weight, weekly_split, updated_at')
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      _renderUserProfileError('User profile not found.');
      return;
    }

    const profile = rows[0];

    // ── Check friendship status ───────────────────────────
    // Check if already friends
    const { data: friendRows } = await client
      .from('friends')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('friend_id', userId)
      .limit(1);

    const isFriend = friendRows && friendRows.length > 0;

    // Check if a pending request exists (either direction)
    let pendingStatus = null; // null | 'sent' | 'received'
    if (!isFriend) {
      const { data: reqRows } = await client
        .from('friend_requests')
        .select('id, sender_id, status')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
        .eq('status', 'pending')
        .limit(1);

      if (reqRows && reqRows.length > 0) {
        pendingStatus = reqRows[0].sender_id === currentUser.id ? 'sent' : 'received';
      }
    }

    // ── Render the full profile ───────────────────────────
    _renderUserProfileContent(profile, isFriend, pendingStatus);

  } catch (err) {
    console.error('[UserProfile] Error:', err);
    _renderUserProfileError('Failed to load profile. Please try again.');
  }
}

function _renderUserProfileLoading() {
  const body = document.getElementById('user-profile-body');
  if (body) body.innerHTML = `
    <div style="text-align:center;padding:40px 0;">
      <div style="font-size:36px;margin-bottom:12px;">⏳</div>
      <p class="muted-text">Loading profile…</p>
    </div>
  `;
}

function _renderUserProfileError(msg) {
  const body = document.getElementById('user-profile-body');
  if (body) body.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">😕</span>
      <p>${escHtml(msg)}</p>
    </div>
  `;
}

function _renderUserProfileContent(profile, isFriend, pendingStatus) {
  const body = document.getElementById('user-profile-body');
  if (!body) return;

  // ── Friend action button ─────────────────────────────
  let friendBtnHtml = '';
  if (isFriend) {
    friendBtnHtml = `
      <div class="up-friend-status up-gymbros">
        <span>🤝</span> <span>Gymbros</span>
      </div>`;
  } else if (pendingStatus === 'sent') {
    friendBtnHtml = `
      <div class="up-friend-status up-pending">
        <span>⏳</span> <span>Request Pending</span>
      </div>`;
  } else if (pendingStatus === 'received') {
    friendBtnHtml = `
      <button class="btn btn-primary" onclick="handleAddFriendFromProfile('${escHtml(profile.user_id)}', '${escHtml(profile.username)}')">
        📨 Accept Request
      </button>`;
  } else {
    friendBtnHtml = `
      <button class="btn btn-primary" id="up-add-btn" onclick="handleAddFriendFromProfile('${escHtml(profile.user_id)}', '${escHtml(profile.username)}')">
        ➕ Add Gymbro
      </button>`;
  }

  // ── Stats ────────────────────────────────────────────
  const volume = profile.total_volume >= 1000
    ? (profile.total_volume / 1000).toFixed(1) + 'k'
    : (profile.total_volume || 0);

  // ── Weekly Split ─────────────────────────────────────
  const split = profile.weekly_split;
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  let splitHtml = '';
  let hasSplit = false;

  if (split && split.days) {
    const splitRows = DAYS.map(day => {
      const d = split.days[day];
      if (!d) return null;
      const name = d.name?.trim() || '';
      const exercises = (d.workouts || []).map(w => w.name).filter(Boolean);
      if (!name && exercises.length === 0) return null;
      hasSplit = true;
      return { day, name, exercises };
    }).filter(Boolean);

    if (splitRows.length > 0) {
      splitHtml = `
        <div class="up-split-list">
          ${splitRows.map(row => `
            <div class="up-split-day">
              <div class="up-split-day-header">
                <span class="up-split-day-name">${escHtml(row.day)}</span>
                ${row.name ? `<span class="up-split-day-label">${escHtml(row.name)}</span>` : ''}
              </div>
              ${row.exercises.length > 0
                ? `<div class="up-split-exercises">${row.exercises.map(e => `<span class="up-split-exercise-chip">${escHtml(e)}</span>`).join('')}</div>`
                : '<div class="up-split-exercises"><span class="muted-text" style="font-size:11px;">Rest / No exercises listed</span></div>'
              }
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // Copy split button — only show when there's actual data
  const copySplitBtnHtml = hasSplit ? `
    <button class="btn btn-ghost btn-sm" onclick="copyUserSplit()" style="margin-top:12px;width:100%;">
      📋 Copy Workout Split to My Schedule
    </button>
  ` : '';

  // Store the split on the modal element so the copy fn can access it
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.dataset.splitJson = JSON.stringify(split || {});

  body.innerHTML = `
    <!-- Avatar + name -->
    <div class="up-hero">
      <div class="up-hero-avatar">${escHtml(profile.avatar || '💪')}</div>
      <div class="up-hero-info">
        <div class="up-hero-name">${escHtml(profile.username)}</div>
        <div class="up-hero-sub">
          ${profile.top_pr_name && profile.top_pr_name !== '—'
            ? `🏆 Top PR: ${escHtml(profile.top_pr_name)} ${profile.top_pr_weight ? profile.top_pr_weight + ' kg' : ''}`
            : ''}
        </div>
      </div>
      <div class="up-hero-action">
        ${friendBtnHtml}
      </div>
    </div>

    <!-- Stats row -->
    <div class="up-stats-row">
      <div class="up-stat">
        <span class="up-stat-val">🔥 ${profile.streak || 0}</span>
        <span class="up-stat-label">Day Streak</span>
      </div>
      <div class="up-stat">
        <span class="up-stat-val">🏆 ${profile.pr_count || 0}</span>
        <span class="up-stat-label">PRs</span>
      </div>
      <div class="up-stat">
        <span class="up-stat-val">🏋️ ${volume}</span>
        <span class="up-stat-label">Total kg</span>
      </div>
    </div>

    <!-- Weekly split -->
    <div class="up-section-header">📅 Weekly Workout Split</div>
    ${hasSplit
      ? splitHtml + copySplitBtnHtml
      : '<p class="muted-text" style="text-align:center;padding:16px 0;font-size:13px;">This user hasn\'t synced their split yet.</p>'
    }
  `;
}

/**
 * Send a friend request directly from the view-profile modal using the userId.
 */
async function handleAddFriendFromProfile(userId, username) {
  const btn = document.getElementById('up-add-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }

  const success = await sendFriendRequest(username);
  if (success) {
    // Replace button with pending badge
    const heroAction = document.querySelector('.up-hero-action');
    if (heroAction) {
      heroAction.innerHTML = `
        <div class="up-friend-status up-pending">
          <span>⏳</span> <span>Request Pending</span>
        </div>`;
    }
    await loadAndRenderFriendRequests();
  } else if (btn) {
    btn.disabled = false;
    btn.textContent = '➕ Add Gymbro';
  }
}

/**
 * Copies the viewed user's weekly split into the current user's schedule.
 */
function copyUserSplit() {
  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;

  let split;
  try { split = JSON.parse(modal.dataset.splitJson || '{}'); } catch { split = {}; }

  if (!split || !split.days || Object.keys(split.days).length === 0) {
    toast('No split data to copy.');
    return;
  }

  if (!confirm('This will overwrite your current weekly schedule with this user\'s split. Continue?')) return;

  DB.set('weeklySchedule', split);
  renderWeeklySchedule();
  toast('✅ Workout split copied to your schedule!');
  closeModal('user-profile-modal');
  navigate('workouts'); // jump to workouts so they can see it
}

window.openUserProfile             = openUserProfile;
window.handleAddFriendFromProfile  = handleAddFriendFromProfile;
window.copyUserSplit               = copyUserSplit;

// ══════════════════════════════════════════
// END VIEW USER PROFILE SYSTEM
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// PLATE CALCULATOR SYSTEM EXECUTIONS
// ══════════════════════════════════════════
function calculateBarbellPlates() {
  const targetInput = document.getElementById('plate-target-weight');
  const resultsContainer = document.getElementById('plate-calculator-results');
  const visualStack = document.getElementById('plate-visual-stack');
  const textBreakdown = document.getElementById('plate-text-breakdown');
  const weightPerSideLabel = document.getElementById('weight-per-side-text');

  if (!targetInput || !resultsContainer) return;

  const totalWeight = parseFloat(targetInput.value) || 0;
  
  if (totalWeight < 20) {
    if (window.SoundManager && typeof window.SoundManager.error === 'function') window.SoundManager.error();
    alert('Target weight must be at least 20kg (the weight of the barbell itself).');
    resultsContainer.style.display = 'none';
    return;
  }

  if (window.SoundManager && typeof window.SoundManager.tap === 'function') window.SoundManager.tap();

  const weightToBars = totalWeight - 20;
  const targetPerSide = weightToBars / 2;
  weightPerSideLabel.innerText = `${targetPerSide % 1 === 0 ? targetPerSide : targetPerSide.toFixed(2)} kg`;

  // Available standard plates in descending order
  const availablePlates = [
    { value: 20, class: 'plate-20', label: '20' },
    { value: 15, class: 'plate-15', label: '15' },
    { value: 10, class: 'plate-10', label: '10' },
    { value: 5,  class: 'plate-5',  label: '5' },
    { value: 2.5, class: 'plate-2_5', label: '2.5' },
    { value: 1.25, class: 'plate-1_25', label: '1.2' }
  ];

  let remaining = targetPerSide;
  const plateCounts = {};
  const visualPlatesArray = [];

  // Calculation logic loops
  availablePlates.forEach(plate => {
    const count = Math.floor(remaining / plate.value);
    if (count > 0) {
      plateCounts[plate.value] = count;
      remaining -= count * plate.value;
      
      // Keep structural queue for visual generation (render largest closest to collar inside)
      for (let i = 0; i < count; i++) {
        visualPlatesArray.push(plate);
      }
    }
  });

  // Render UI visual nodes
  visualStack.innerHTML = '';
  if (visualPlatesArray.length === 0) {
    visualStack.innerHTML = '<span style="font-size: 11px; color: var(--text3)">Empty Bar</span>';
  } else {
    visualPlatesArray.forEach(plate => {
      const plateEl = document.createElement('div');
      plateEl.className = `barbell-plate ${plate.class}`;
      plateEl.innerText = plate.label;
      plateEl.title = `${plate.value} kg Plate`;
      visualStack.appendChild(plateEl);
    });
  }

  // Render Descriptive Output text lines
  textBreakdown.innerHTML = '';
  if (Object.keys(plateCounts).length === 0) {
    textBreakdown.innerHTML = '<div style="text-align: center; font-size:12px;">No weights needed on either side.</div>';
  } else {
    for (const [weight, qty] of Object.entries(plateCounts)) {
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.justifyContent = 'between';
      line.style.justifyContent = 'space-between';
      line.innerHTML = `<span>⚖️ <strong>${weight} kg</strong> plate</span> <span>x${qty} ${qty > 1 ? 'pieces' : 'piece'} per side</span>`;
      textBreakdown.appendChild(line);
    }
  }

  // Handle reminder notification for fractions if any
  if (remaining > 0) {
    const leftoverEl = document.createElement('div');
    leftoverEl.style.fontSize = '11px';
    leftoverEl.style.color = 'var(--warn)';
    leftoverEl.style.marginTop = '4px';
    leftoverEl.style.textAlign = 'center';
    leftoverEl.innerText = `⚠️ Remainder of ${remaining.toFixed(2)} kg cannot be completely built with selected plates.`;
    textBreakdown.appendChild(leftoverEl);
  }

  resultsContainer.style.display = 'block';
}

// Attach directly onto global environment reference
window.calculateBarbellPlates = calculateBarbellPlates;


async function manualSync() {
  toast('🔄 Syncing...');
  const result = await syncUserDataToCloud();
  if (result) {
    toast('✅ Data synced to cloud!');
  } else {
    toast('❌ Sync failed - check console');
  }
}
window.manualSync = manualSync;

// ─── Contact Us (WhatsApp) ───────────────────────────────
function sendContactMessage() {
  const input = document.getElementById('contact-us-message');
  const msg = input?.value.trim();

  if (!msg) {
    toast('Please type a message first');
    input?.focus();
    return;
  }

  const WHATSAPP_NUMBER = '201288894721'; // 01288894721 in international format (Egypt +20)
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  window.open(url, '_blank', 'noopener');

  input.value = '';
  toast('Opening WhatsApp... 💬');
}
window.sendContactMessage = sendContactMessage;

// ─── Download App (APK) ──────────────────────────────────
function downloadApkFile() {
  const link = document.createElement('a');
  link.href = 'app-debug.apk';
  link.download = 'app-debug.apk';
  document.body.appendChild(link);
  link.click();
  link.remove();
  toast('⬇ Downloading Jim Buddy APK...');
}
window.downloadApkFile = downloadApkFile;

// ─── First-Visit "Download App" Prompt ───────────────────
// Shown once, the very first time someone opens the app. Persists via
// localStorage (DB) so it never reappears once the person has chosen
// either "Download App" or "No Thanks".
function maybeShowDownloadAppPrompt() {
  return; // disabled
}

function downloadApkFromPrompt() {
  downloadApkFile();
  DB.set('downloadPromptShown', true);
  closeModal('download-app-modal');
}

function dismissDownloadPrompt() {
  DB.set('downloadPromptShown', true);
  closeModal('download-app-modal');
  toast('No problem — you can grab it anytime from Settings 👍');
}

window.downloadApkFromPrompt = downloadApkFromPrompt;
window.dismissDownloadPrompt = dismissDownloadPrompt;

document.addEventListener('DOMContentLoaded', maybeShowDownloadAppPrompt);

function resetUserData() {
  if (!confirm('⚠️ This will delete ALL your progress data (sessions, PRs, logs, custom exercises). Your settings and account will stay.\n\nContinue?')) return;
  if (!confirm('Are you absolutely sure? Type "RESET" to confirm.')) return;
  const confirmation = prompt('Type "RESET" to confirm:');
  if (confirmation !==  'RESET') { toast('Cancelled'); return; }

  // Reset all tracking data
  DB.set('sessions', []);
  DB.set('prs', {});
  DB.set('weightLog', []);
  DB.set('weightLossGoal', null);
  DB.set('cardioLog', []);
  DB.set('cardioGoal', null);
  DB.set('waterLog', []);
  DB.set('foodLog', []);
  DB.set('weeklyGoals', []);
  DB.set('weeklyDietPlan', null);
  DB.set('customWorkouts', []);
  DB.set('customFoods', []);
  DB.set('workoutQueue', []);
  DB.set('lastHydrationReminder', null); // reset reminder state

  // Also update the current profile's snapshot so switching profiles works correctly
  const currentId = DB.get('currentProfileId');
  if (currentId) {
    let profilesData = DB.get('profilesData', {});
    if (profilesData[currentId]) {
      profilesData[currentId].data.sessions = [];
      profilesData[currentId].data.prs = {};
      profilesData[currentId].data.weightLog = [];
      profilesData[currentId].data.weightLossGoal = null;
      profilesData[currentId].data.cardioLog = [];
      profilesData[currentId].data.cardioGoal = null;
      profilesData[currentId].data.waterLog = [];
      profilesData[currentId].data.foodLog = [];
      profilesData[currentId].data.weeklyGoals = [];
      profilesData[currentId].data.weeklyDietPlan = null;
      profilesData[currentId].data.customWorkouts = [];
      profilesData[currentId].data.customFoods = [];
      profilesData[currentId].savedAt = new Date().toISOString();
      DB.set('profilesData', profilesData);
    }
  }

  // Invalidate exercise cache
  if (window.invalidateExerciseCache) window.invalidateExerciseCache();

  toast('✅ All progress data has been reset!');
  // Refresh UI
  renderDashboard();
  renderWorkouts();
  renderProgress();
  renderWeeklySchedule();
  renderCalorieTracker();
  renderWater();
  renderGoals();
  renderPRLists();
  loadWorkoutQueue();
  // Maybe show a welcome back state
  _debouncedSyncToCloud();

}
window.resetUserData = resetUserData;

// ─── Gymbro Social Page & Real-time Chat Implementation ───

// Active social state variables
let activeChatId = null;
let activeChatFriendId = null;
let activeChatSubscription = null;
let activeChatReadSubscription = null;
let activeFriendStatusSubscription = null;
let activeUnreadChatsSubscription = null;
let activeIncomingMsgsSubscription = null;
let gymbrosListenersSet = false;
let statusHeartbeatInterval = null;

// Dynamic check and UI update of the gymbros tab notification dot
async function updateGymbrosTabBadge() {
  // Update both header badge (new) and any legacy tab badge (compat)
  const headerBadge = document.getElementById('gymbros-header-badge');
  const tabBadge    = document.getElementById('gymbros-tab-badge');

  const count = await checkUnreadChatsCount();
  [headerBadge, tabBadge].forEach(badge => {
    if (!badge) return;
    badge.style.display = count > 0 ? 'block' : 'none';
  });
}
window.updateGymbrosTabBadge = updateGymbrosTabBadge;


// Initial navigation and render wrapper
async function renderGymbrosSocial() {
  const currentUser = getAuthUser();
  const friendsListContainer = document.getElementById('gymbros-friends-list');
  const requestsListContainer = document.getElementById('gymbro-requests-list');
  const searchResultsContainer = document.getElementById('gymbro-search-results');
  const reqBadge = document.getElementById('request-count-badge');
  const friendBadge = document.getElementById('friend-count-badge');

  // Show/hide chat notification permission banner
  const notifBanner = document.getElementById('chat-notif-banner');
  if (notifBanner && 'Notification' in window) {
    if (Notification.permission === 'default' && currentUser) {
      notifBanner.style.display = 'flex';
    } else {
      notifBanner.style.display = 'none';
    }
  }
  
  if (!currentUser) {
    if (friendsListContainer) {
      friendsListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🤝</span>
          <p>Sign in to connect with other Gymbros!</p>
          <button class="btn btn-primary" style="margin-top:12px;" onclick="openProfileModal()">Sign In / Sign Up</button>
        </div>
      `;
    }
    if (requestsListContainer) {
      requestsListContainer.innerHTML = '<p class="muted-text">Please log in to view requests.</p>';
    }
    if (searchResultsContainer) searchResultsContainer.style.display = 'none';
    if (reqBadge) reqBadge.style.display = 'none';
    if (friendBadge) friendBadge.textContent = '0';
    return;
  }

  // Setup event handlers once
  setupGymbrosEventListeners();

  // Pull fresh lists concurrently
  await Promise.all([
    loadAndRenderFriendRequests(),
    loadAndRenderFriendsList()
  ]);
}
window.renderGymbrosSocial = renderGymbrosSocial;

function setupGymbrosEventListeners() {
  if (gymbrosListenersSet) return;

  const searchBtn = document.getElementById('gymbro-search-btn');
  const searchInput = document.getElementById('gymbro-search-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatMessageInput = document.getElementById('chat-message-input');

  if (searchBtn) {
    searchBtn.addEventListener('click', performGymbroSearch);
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performGymbroSearch();
    });
  }

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', handleSendChatMessage);
  }
  if (chatMessageInput) {
    chatMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSendChatMessage();
    });
  }

  gymbrosListenersSet = true;
}

// User search
async function performGymbroSearch() {
  const input = document.getElementById('gymbro-search-input');
  if (!input) return;

  const query = input.value.trim();
  if (!query) {
    toast('Please enter a username to search');
    return;
  }

  const resultsContainer = document.getElementById('gymbro-search-results');
  if (!resultsContainer) return;

  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = '<p class="muted-text">🔍 Searching...</p>';

  const users = await searchUsers(query);
  if (!users || users.length === 0) {
    resultsContainer.innerHTML = '<p class="muted-text">❌ No users found.</p>';
    return;
  }

  resultsContainer.innerHTML = users.map(user => `
    <div class="gymbro-search-item">
      <div class="gymbro-search-item-info" onclick="openUserProfile('${user.user_id}')" style="cursor:pointer;">
        <div class="gymbro-search-item-avatar">${escHtml(user.avatar || '👤')}</div>
        <div>
          <div class="gymbro-search-item-name">${escHtml(user.username)}</div>
          <div class="gymbro-search-item-streak">${JBIcons.svg('flame', { size: 14 })} ${user.streak || 0} day streak</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn btn-sm btn-ghost" onclick="openUserProfile('${user.user_id}')">👤</button>
        <button class="btn btn-sm btn-primary" onclick="handleAddFriend('${escHtml(user.username)}')">Add</button>
      </div>
    </div>
  `).join('');
}
window.performGymbroSearch = performGymbroSearch;

// Friend request sending
async function handleAddFriend(username) {
  const success = await sendFriendRequest(username);
  if (success) {
    const input = document.getElementById('gymbro-search-input');
    if (input) input.value = '';
    
    const resultsContainer = document.getElementById('gymbro-search-results');
    if (resultsContainer) resultsContainer.style.display = 'none';

    // Reload friend list & requests
    await Promise.all([
      loadAndRenderFriendRequests(),
      loadAndRenderFriendsList()
    ]);
  }
}
window.handleAddFriend = handleAddFriend;

// Friend requests rendering
async function loadAndRenderFriendRequests() {
  const requests = await getFriendRequests();
  const badge = document.getElementById('request-count-badge');
  const container = document.getElementById('gymbro-requests-list');

  if (requests && requests.length > 0) {
    if (badge) {
      badge.textContent = requests.length;
      badge.style.display = 'inline-flex';
    }
    if (container) {
      container.innerHTML = requests.map(req => `
        <div class="gymbro-request-card">
          <div class="gymbro-request-card-info">
            <div class="gymbro-request-card-avatar">${escHtml(req.sender.avatar || '👤')}</div>
            <div>
              <div class="gymbro-request-card-name">${escHtml(req.sender.username)}</div>
              <div class="gymbro-request-card-sub">wants to be gymbros</div>
            </div>
          </div>
          <div class="gymbro-request-card-actions">
            <button class="btn btn-sm btn-primary" onclick="handleAcceptFriendRequest('${req.id}')">Accept</button>
            <button class="btn btn-sm btn-ghost" onclick="handleDeclineFriendRequest('${req.id}')">Decline</button>
          </div>
        </div>
      `).join('');
    }
  } else {
    if (badge) badge.style.display = 'none';
    if (container) {
      container.innerHTML = '<p class="muted-text">No pending requests.</p>';
    }
  }
}
window.loadAndRenderFriendRequests = loadAndRenderFriendRequests;

// Accept request handler
async function handleAcceptFriendRequest(requestId) {
  const success = await acceptFriendRequest(requestId);
  if (success) {
    await Promise.all([
      loadAndRenderFriendRequests(),
      loadAndRenderFriendsList()
    ]);
  }
}
window.handleAcceptFriendRequest = handleAcceptFriendRequest;

// Decline request handler
async function handleDeclineFriendRequest(requestId) {
  const success = await declineFriendRequest(requestId);
  if (success) {
    await loadAndRenderFriendRequests();
  }
}
window.handleDeclineFriendRequest = handleDeclineFriendRequest;

// Friends rendering
async function loadAndRenderFriendsList() {
  const friends = await getFriends();
  const countBadge = document.getElementById('friend-count-badge');
  if (countBadge) countBadge.textContent = friends.length;

  const container = document.getElementById('gymbros-friends-list');
  if (!container) return;

  if (friends && friends.length > 0) {
    // Store friend data in a Map so onclick can look it up safely (avoids inline param escaping issues)
    window._gymbroFriendMap = {};
    friends.forEach(f => {
      window._gymbroFriendMap[f.friend_id] = f;
      // Cache name for chat notifications
      _cacheFriendName(f.friend_id, f.username, f.avatar);
    });

    container.innerHTML = friends.map(friend => {
      const statusClass = friend.is_online ? 'online' : 'offline';
      const formattedVolume = friend.total_volume >= 1000
        ? (friend.total_volume / 1000).toFixed(1) + 'k'
        : friend.total_volume;

      return `
        <div class="gymbro-friend-card gymbro-open-chat" id="friend-card-${friend.friend_id}" data-friend-id="${friend.friend_id}" style="cursor:pointer;">
          <div class="gymbro-friend-card-info">
            <div class="gymbro-friend-card-avatar-wrap" onclick="event.stopPropagation();openUserProfile('${friend.friend_id}')" style="cursor:pointer;" title="View profile">
              <div class="gymbro-friend-card-avatar">${escHtml(friend.avatar)}</div>
              <div class="gymbro-friend-card-status-badge ${statusClass}" id="status-badge-${friend.friend_id}"></div>
            </div>
            <div class="gymbro-friend-card-details">
              <div class="gymbro-friend-card-name">${escHtml(friend.username)}</div>
              <div class="gymbro-friend-card-stats">🔥 ${friend.streak} streak · 🏆 ${friend.pr_count} PRs · 🏋️ ${formattedVolume} kg</div>
            </div>
          </div>
          <div class="gymbro-unread-dot" id="unread-dot-${friend.friend_id}" style="display:none;"></div>
        </div>
      `;
    }).join('');

    // Attach event listeners using delegation — avoids any inline-onclick attribute escaping issues
    container.querySelectorAll('.gymbro-open-chat').forEach(el => {
      el.addEventListener('click', (e) => {
        const friendId = el.dataset.friendId;
        const friend = window._gymbroFriendMap && window._gymbroFriendMap[friendId];
        if (friend) {
          openChat(friend.friend_id, friend.username, friend.avatar, friend.is_online);
        }
      });
    });
    // Setup real-time status listeners
    if (activeFriendStatusSubscription && supabaseClient) {
      supabaseClient.removeChannel(activeFriendStatusSubscription);
    }
    const friendIds = friends.map(f => f.friend_id);
    activeFriendStatusSubscription = subscribeToUserStatus(friendIds, (statusUpdate) => {
      const badge = document.getElementById(`status-badge-${statusUpdate.user_id}`);
      if (badge) {
        badge.className = `gymbro-friend-card-status-badge ${statusUpdate.is_online ? 'online' : 'offline'}`;
      }

      // Update active Chat header status if matching
      if (activeChatFriendId === statusUpdate.user_id) {
        const chatStatus = document.getElementById('chat-friend-status');
        if (chatStatus) {
          chatStatus.innerHTML = statusUpdate.is_online
            ? `<span class="status-dot online"></span> Online`
            : `<span class="status-dot offline"></span> Offline`;
        }
      }

      // Also update the stored map entry
      if (window._gymbroFriendMap && window._gymbroFriendMap[statusUpdate.user_id]) {
        window._gymbroFriendMap[statusUpdate.user_id].is_online = statusUpdate.is_online;
      }
    });

    // Mark cards that have unread messages
    updateUnreadFriendCards();
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <p>Add your first gymbro to get started!</p>
      </div>
    `;
  }
}
window.loadAndRenderFriendsList = loadAndRenderFriendsList;

// Mark friend cards that have unread messages with .has-unread
async function updateUnreadFriendCards() {
  if (typeof getUnreadSenderIds !== 'function') return;
  const senderIds = await getUnreadSenderIds();
  const senderSet = new Set(senderIds);
  document.querySelectorAll('.gymbro-friend-card').forEach(card => {
    const friendId = card.id.replace('friend-card-', '');
    const dot = document.getElementById(`unread-dot-${friendId}`);
    if (senderSet.has(friendId)) {
      card.classList.add('has-unread');
      if (dot) dot.style.display = 'block';
    } else {
      card.classList.remove('has-unread');
      if (dot) dot.style.display = 'none';
    }
  });
}
window.updateUnreadFriendCards = updateUnreadFriendCards;

// Open Chat
async function openChat(friendId, username, avatar, isOnline) {
  try {
    // Clean up existing chat subscription
    if (activeChatSubscription && supabaseClient) {
      supabaseClient.removeChannel(activeChatSubscription);
    }

    activeChatFriendId = friendId;

    // Cache friend name for notifications
    if (username) _cacheFriendName(friendId, username, avatar);

    // Clear unread indicator on this friend's card immediately
    const friendCard = document.getElementById(`friend-card-${friendId}`);
    if (friendCard) friendCard.classList.remove('has-unread');

    // Set chat details
    const nameEl = document.getElementById('chat-friend-name');
    const avatarEl = document.getElementById('chat-friend-avatar');
    const statusEl = document.getElementById('chat-friend-status');
    const messagesContainer = document.getElementById('chat-messages-container');

    if (nameEl) nameEl.textContent = username;
    if (avatarEl) avatarEl.textContent = avatar;
    if (statusEl) {
      statusEl.innerHTML = isOnline 
        ? `<span class="status-dot online"></span> Online` 
        : `<span class="status-dot offline"></span> Offline`;
    }

    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="chat-messages-empty">
          <div class="chat-messages-empty-icon">💬</div>
          <div class="chat-messages-empty-text">Loading chat history...</div>
        </div>
      `;
    }

    openModal('chat-modal');

    // Load chat session from Supabase
    const chat = await getOrCreateChat(friendId);
    if (!chat) {
      closeChatModal();
      return;
    }

    activeChatId = chat.id;

    // Fetch past messages
    const messages = await getMessages(chat.id);
    renderMessages(messages);
    
    // Sync the tab badge because unread messages in this chat are now read
    updateGymbrosTabBadge();

    // Subscribe to real-time updates
    activeChatSubscription = subscribeToMessages(chat.id, (newMsg) => {
      appendChatMessage(newMsg);
      // Badge update for incoming messages in the active chat
      if (newMsg.sender_id !== getAuthUser()?.id) {
        updateGymbrosTabBadge();
      }
    });

    // Also listen for UPDATE events (read_at changes) on this chat to refresh seen indicator
    activeChatReadSubscription = subscribeToMessageUpdates(chat.id, (updatedMsg) => {
      updateSeenIndicator(updatedMsg);
    });
  } catch (err) {
    console.error('[Gymbro] openChat error:', err);
    toast('Could not open chat. Please try again.');
    closeChatModal();
  }
}
window.openChat = openChat;

// Click-outside-to-close for chat modal overlay
(function() {
  const chatOverlay = document.getElementById('chat-modal');
  if (chatOverlay) {
    chatOverlay.addEventListener('click', function(e) {
      // Only close if the click was directly on the overlay (not on the modal content)
      if (e.target === chatOverlay) {
        closeChatModal();
      }
    });
  }
})();

// Close Chat
function closeChatModal() {
  if (activeChatSubscription && supabaseClient) {
    supabaseClient.removeChannel(activeChatSubscription);
    activeChatSubscription = null;
  }
  if (activeChatReadSubscription && supabaseClient) {
    supabaseClient.removeChannel(activeChatReadSubscription);
    activeChatReadSubscription = null;
  }
  dismissContextMenu();
  activeChatId = null;
  activeChatFriendId = null;

  const input = document.getElementById('chat-message-input');
  if (input) input.value = '';

  closeModal('chat-modal');
}
window.closeChatModal = closeChatModal;

// Render Messages helper
function renderMessages(messages) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="chat-messages-empty">
        <div class="chat-messages-empty-icon">🤝</div>
        <div class="chat-messages-empty-text">Send a message to start the conversation!</div>
      </div>
    `;
    return;
  }

  const currentUser = getAuthUser();
  // Find the last sent message index for seen indicator
  let lastSentIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === currentUser.id) { lastSentIdx = i; break; }
  }

  container.innerHTML = messages.map((msg, idx) => buildMessageRowHTML(msg, currentUser, idx === lastSentIdx)).join('');

  scrollToBottom();

  // Attach long-press handlers after render
  attachLongPressHandlers(container);
}

// Build a single message row HTML string
function buildMessageRowHTML(msg, currentUser, isLastSent) {
  const isSent = msg.sender_id === currentUser.id;
  const dateStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rowClass = isSent ? 'sent' : 'received';
  const msgId = msg.id || '';

  const deleteBtn = isSent
    ? `<button class="msg-delete-btn" title="Delete message" onclick="handleDeleteMessage('${msgId}', this)" aria-label="Delete message">🗑</button>`
    : '';

  const splitBtn = (!isSent && typeof msg.content === 'string' && msg.content.startsWith('📅 My Weekly Split:'))
    ? `<button class="copy-split-btn" onclick="handleCopySplitToMySchedule(this)">📋 Copy to my splits</button>`
    : '';

  const isInvite = typeof msg.content === 'string' && msg.content.startsWith('🏋️ Gym Invitation:');
  let inviteButtons = '';
  if (isInvite) {
    const savedResponse = DB.get('invite_resp_' + msgId, null);
    if (savedResponse === 'accepted') {
      inviteButtons = `<div style="margin-top: 6px; font-weight: bold; color: var(--accent);">Accepted ✅</div>`;
    } else if (savedResponse === 'declined') {
      inviteButtons = `<div style="margin-top: 6px; font-weight: bold; color: var(--danger);">Declined ❌</div>`;
    } else if (!isSent) {
      inviteButtons = `
        <div class="invite-actions" style="margin-top: 8px; display: flex; gap: 8px;">
          <button class="btn btn-sm btn-primary invite-accept-btn" style="padding: 4px 8px; font-size: 11px;" onclick="handleInviteResponse('${msgId}', true, \`${msg.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">Accept</button>
          <button class="btn btn-sm btn-ghost invite-decline-btn" style="padding: 4px 8px; font-size: 11px; color: var(--text2);" onclick="handleInviteResponse('${msgId}', false, \`${msg.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">Decline</button>
        </div>
      `;
    } else {
      inviteButtons = `<div style="margin-top: 6px; font-size: 11px; color: var(--text3);">Sent invitation</div>`;
    }
  }

  const seenLabel = (isSent && isLastSent && msg.read_at)
    ? `<div class="chat-seen-label" data-msg-id="${msgId}">${formatSeenLabel(msg.read_at)}</div>`
    : (isSent && isLastSent ? `<div class="chat-seen-label" data-msg-id="${msgId}" style="visibility:hidden;">Seen</div>` : '');

  return `
    <div class="chat-message-row ${rowClass}" data-msg-id="${msgId}">
      <div class="message-bubble" style="position:relative;">
        ${deleteBtn}
        <div class="message-content">${escHtml(msg.content)}</div>
        ${splitBtn}
        ${inviteButtons}
        <div class="message-meta">
          <span class="message-time">${dateStr}</span>
        </div>
      </div>
    </div>
    ${seenLabel}
  `;
}


// Format seen label text from a read_at timestamp string
function formatSeenLabel(readAt) {
  if (!readAt) return '';
  const diff = Date.now() - new Date(readAt).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Seen just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Seen ${mins}m ago`;
  return 'Seen';
}

// Update the seen indicator label for the last sent message in the container
function updateSeenIndicator(updatedMsg) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;
  const currentUser = getAuthUser();
  if (!currentUser || updatedMsg.sender_id !== currentUser.id) return;

  // Find all sent rows to determine if this is the last sent message
  const rows = container.querySelectorAll('.chat-message-row.sent');
  if (!rows.length) return;
  const lastRow = rows[rows.length - 1];
  if (lastRow.dataset.msgId !== String(updatedMsg.id)) return;

  // Update or show the seen label after the last sent row
  let seenEl = lastRow.nextElementSibling;
  if (seenEl && seenEl.classList.contains('chat-seen-label')) {
    if (updatedMsg.read_at) {
      seenEl.textContent = formatSeenLabel(updatedMsg.read_at);
      seenEl.style.visibility = '';
    }
  }
}

// Append Chat Message helper (used by realtime subscriptions)
function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  // Clear placeholder if present
  const placeholder = container.querySelector('.chat-messages-empty');
  if (placeholder) placeholder.remove();

  const currentUser = getAuthUser();
  const isSent = msg.sender_id === currentUser.id;
  const dateStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rowClass = isSent ? 'sent' : 'received';
  const msgId = msg.id || '';

  // Avoid duplicate elements (in case of race conditions)
  const existingMsg = Array.from(container.querySelectorAll('.message-content'))
    .some(el => el.textContent === msg.content && el.nextElementSibling?.querySelector('.message-time')?.textContent === dateStr);
  
  if (existingMsg && isSent) return; // ignore duplicates of user's own sent messages if already rendered by luck

  // Remove old seen label from the previously-last sent message
  if (isSent) {
    const oldSeen = container.querySelector('.chat-seen-label');
    if (oldSeen) oldSeen.remove();
  }

  const deleteBtn = isSent
    ? `<button class="msg-delete-btn" title="Delete message" onclick="handleDeleteMessage('${msgId}', this)" aria-label="Delete message">🗑</button>`
    : '';

  const splitBtn = (!isSent && typeof msg.content === 'string' && msg.content.startsWith('📅 My Weekly Split:'))
    ? `<button class="copy-split-btn" onclick="handleCopySplitToMySchedule(this)">📋 Copy to my splits</button>`
    : '';

  const row = document.createElement('div');
  row.className = `chat-message-row ${rowClass}`;
  row.dataset.msgId = msgId;
  row.innerHTML = `
    <div class="message-bubble" style="position:relative;">
      ${deleteBtn}
      <div class="message-content">${escHtml(msg.content)}</div>
      ${splitBtn}
      <div class="message-meta">
        <span class="message-time">${dateStr}</span>
      </div>
    </div>
  `;
  container.appendChild(row);

  // Add seen label placeholder for sent messages
  if (isSent) {
    const seenEl = document.createElement('div');
    seenEl.className = 'chat-seen-label';
    seenEl.dataset.msgId = msgId;
    if (msg.read_at) {
      seenEl.textContent = formatSeenLabel(msg.read_at);
    } else {
      seenEl.style.visibility = 'hidden';
      seenEl.textContent = 'Seen';
    }
    container.appendChild(seenEl);
  }

  // Attach long-press handler to the new row
  attachLongPressHandlers(row);

  scrollToBottom();

  // If we are actively viewing this chat, read the message instantly in database and clear badge status
  if (!isSent && activeChatFriendId === msg.sender_id) {
    if (window.supabaseClient) {
      window.supabaseClient
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', msg.id)
        .then(() => {
          updateGymbrosTabBadge();
        });
    }
  }
}

// Send Message handler
async function handleSendChatMessage() {
  const input = document.getElementById('chat-message-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content || !activeChatId) return;

  input.value = ''; // clear immediately for latency masking
  
  // Call API to send
  await sendMessage(activeChatId, content);
}
window.handleSendChatMessage = handleSendChatMessage;

// ── Delete Message ───────────────────────────────────────
async function handleDeleteMessage(msgId, btnEl) {
  if (!msgId) return;
  if (!confirm('Delete this message?')) return;

  try {
    const client = await getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { error, count } = await client
      .from('messages')
      .delete({ count: 'exact' })
      .eq('id', msgId)
      .eq('sender_id', getAuthUser()?.id); // RLS-safe: only own messages

    if (error) throw error;

    // count === 0 means RLS blocked it or wrong id — treat as failure
    if (count === 0) {
      throw new Error('No rows deleted — check RLS policy or message ownership');
    }

    // Remove the row and its seen label from the DOM
    const container = document.getElementById('chat-messages-container');
    if (container) {
      const row = container.querySelector(`.chat-message-row[data-msg-id="${msgId}"]`);
      if (row) {
        const next = row.nextElementSibling;
        if (next && next.classList.contains('chat-seen-label')) next.remove();
        row.remove();
      }
    }

    // Update the chats table with the new last message (or clear it if no messages remain)
    if (activeChatId) {
      const { data: remaining } = await client
        .from('messages')
        .select('content, created_at')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: false })
        .limit(1);

      const newLast = remaining && remaining.length > 0 ? remaining[0] : null;
      await client
        .from('chats')
        .update({
          last_message:    newLast ? newLast.content : null,
          last_message_at: newLast ? newLast.created_at : null
        })
        .eq('id', activeChatId);
    }
  } catch (err) {
    console.error('[Chat] Delete message error:', err);
    toast('❌ Could not delete message. Please try again.');
  }
}
window.handleDeleteMessage = handleDeleteMessage;

// ── Copy Split to My Splits ──────────────────────────────
function handleCopySplitToMySchedule(btnEl) {
  const bubble = btnEl.closest('.message-bubble');
  if (!bubble) { toast('❌ Could not read split message.'); return; }
  const contentEl = bubble.querySelector('.message-content');
  if (!contentEl) { toast('❌ Could not read split message.'); return; }

  const text = contentEl.textContent || '';
  const parsed = parseSplitMessage(text);

  if (!parsed) {
    toast('❌ Could not parse the split. Try again.');
    return;
  }

  // Merge only the found days into the existing schedule
  const existing = getWeeklySchedule();
  DAYS_OF_WEEK.forEach(day => {
    if (parsed.days[day]) {
      existing.days[day] = parsed.days[day];
    }
  });

  saveWeeklySchedule(existing);
  toast('✅ Split copied to your schedule!');
}
window.handleCopySplitToMySchedule = handleCopySplitToMySchedule;

// Parse a "📅 My Weekly Split:" message into a partial weeklySchedule object
function parseSplitMessage(text) {
  try {
    const lines = text.split('\n');
    const days = {};
    // Matches lines like: "💪 Monday: Push Day — Bench Press, Squat, OHP +2"
    // The day name may be preceded by any emoji/chars
    const dayPattern = new RegExp(
      '(' + DAYS_OF_WEEK.join('|') + ')\\s*:?\\s*(.+?)\\s*[\\u2014\\-\\u2013]\\s*(.*)',
      'i'
    );

    lines.forEach(line => {
      const m = line.match(dayPattern);
      if (!m) return;
      const dayName = DAYS_OF_WEEK.find(d => d.toLowerCase() === m[1].toLowerCase());
      if (!dayName) return;

      const label = m[2].trim();
      const exercisePart = m[3].trim();

      // Skip pure rest-day lines
      if (/^rest\s*day/i.test(exercisePart)) return;

      // Strip trailing " +N" overflow indicator (e.g. "Bench Press, Squat +2")
      const cleaned = exercisePart.replace(/\s*\+\d+\s*$/, '').trim();
      if (!cleaned) return;

      // Split by comma, drop any empty or "+N" tokens
      const workouts = cleaned
        .split(',')
        .map(s => s.trim())
        .filter(s => s && !/^\+\d+/.test(s))
        .map(name => ({ name, sets: 3, reps: 10, rest: 60 }));

      if (workouts.length) {
        days[dayName] = { name: (label === 'Training' ? '' : label), workouts };
      }
    });

    if (!Object.keys(days).length) return null;
    return { days };
  } catch (e) {
    console.error('[Chat] parseSplitMessage error:', e);
    return null;
  }
}

// ── Long-press context menu ──────────────────────────────
let _ctxMenu = null;
let _longPressTimer = null;
let _longPressStartX = 0;
let _longPressStartY = 0;

function dismissContextMenu() {
  if (_ctxMenu) {
    _ctxMenu.remove();
    _ctxMenu = null;
  }
}

function showContextMenu(x, y, items) {
  dismissContextMenu();
  const menu = document.createElement('div');
  menu.className = 'chat-context-menu';
  items.forEach(item => {
    const btn = document.createElement('button');
    if (item.danger) btn.className = 'danger';
    btn.innerHTML = `${item.icon} ${item.label}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  _ctxMenu = menu;

  // Position: anchor to tap point, keep within viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 160, mh = items.length * 44;
  let left = x, top = y;
  if (left + mw > vw - 8) left = vw - mw - 8;
  if (top + mh > vh - 8) top = y - mh - 8;
  if (top < 8) top = 8;
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';

  // Dismiss on outside tap (next tick to avoid triggering on this same event)
  setTimeout(() => {
    document.addEventListener('touchstart', _ctxOutside, { once: true, passive: true });
    document.addEventListener('mousedown', _ctxOutside, { once: true });
  }, 0);
}

function _ctxOutside(e) {
  if (_ctxMenu && !_ctxMenu.contains(e.target)) dismissContextMenu();
}

function attachLongPressHandlers(root) {
  const rows = root.classList && root.classList.contains('chat-message-row')
    ? [root]
    : root.querySelectorAll('.chat-message-row');

  rows.forEach(row => {
    const bubble = row.querySelector('.message-bubble');
    if (!bubble || bubble._lpAttached) return;
    bubble._lpAttached = true;

    const isSent = row.classList.contains('sent');
    const msgId = row.dataset.msgId || '';

    bubble.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      _longPressStartX = touch.clientX;
      _longPressStartY = touch.clientY;
      _longPressTimer = setTimeout(() => {
        _longPressTimer = null;
        const contentEl = bubble.querySelector('.message-content');
        const msgText = contentEl ? contentEl.textContent : '';
        const items = [];
        if (isSent) {
          items.push({ icon: '🗑', label: 'Delete', danger: true, action: () => handleDeleteMessage(msgId, null) });
        }
        items.push({ icon: '📋', label: 'Copy', action: () => {
          navigator.clipboard.writeText(msgText).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = msgText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
          });
          toast('Copied!');
        }});
        showContextMenu(touch.clientX, touch.clientY, items);
      }, 500);
    }, { passive: true });

    bubble.addEventListener('touchmove', (e) => {
      if (_longPressTimer === null) return;
      const touch = e.touches[0];
      const dx = touch.clientX - _longPressStartX;
      const dy = touch.clientY - _longPressStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // clientX/Y are already in CSS pixels (≈dp on most devices)
      if (dist > 10) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    }, { passive: true });

    bubble.addEventListener('touchend', () => {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    }, { passive: true });

    bubble.addEventListener('touchcancel', () => {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    }, { passive: true });
  });

  // Dismiss context menu on scroll
  const scrollContainer = document.getElementById('chat-messages-container');
  if (scrollContainer && !scrollContainer._ctxScrollAttached) {
    scrollContainer._ctxScrollAttached = true;
    scrollContainer.addEventListener('scroll', dismissContextMenu, { passive: true });
  }
}

// Share Latest PR action
async function shareLatestPR() {
  const prs = DB.get('prs', {});
  const entries = Object.entries(prs);
  if (!entries.length) {
    toast('No PRs logged yet. Log a workout or set a PR first!');
    return;
  }

  // Sort and select the latest PR
  const latestPr = entries
    .map(([, pr]) => pr)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const content = `🏆 I set a new PR: ${latestPr.name} - ${latestPr.weight}kg! 💪`;
  
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = content;
    handleSendChatMessage();
  }
}
window.shareLatestPR = shareLatestPR;

// ── Quick Actions Dropdown ───────────────────────────────
function toggleChatQuickActions() {
  const dropdown = document.getElementById('chat-quick-dropdown');
  const trigger  = document.getElementById('chat-quick-trigger');
  if (!dropdown || !trigger) return;

  const isOpen = dropdown.classList.contains('open');

  if (isOpen) {
    dropdown.classList.remove('open');
    trigger.classList.remove('active');
    document.removeEventListener('click', _closeQuickActionsOutside);
  } else {
    dropdown.classList.add('open');
    trigger.classList.add('active');
    // Close when clicking anywhere outside
    setTimeout(() => {
      document.addEventListener('click', _closeQuickActionsOutside);
    }, 50);
  }
}

function _closeQuickActionsOutside(e) {
  const wrap = document.getElementById('chat-quick-actions-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dropdown = document.getElementById('chat-quick-dropdown');
    const trigger  = document.getElementById('chat-quick-trigger');
    if (dropdown) dropdown.classList.remove('open');
    if (trigger)  trigger.classList.remove('active');
    document.removeEventListener('click', _closeQuickActionsOutside);
  }
}

// Share current weekly split as a chat message
function shareSplitInChat() {
  const schedule = getWeeklySchedule();
  const dayEmojis = { Monday:'💪', Tuesday:'🔥', Wednesday:'⚡', Thursday:'🏋️', Friday:'💥', Saturday:'🌟', Sunday:'😴' };

  const parts = ['📅 My Weekly Split:'];
  DAYS_OF_WEEK.forEach(day => {
    const dayData = schedule.days[day] || { name: '', workouts: [] };
    const emoji   = dayEmojis[day] || '🗓';
    const label   = dayData.name ? dayData.name : (dayData.workouts?.length ? 'Training' : 'Rest');
    const count   = dayData.workouts?.length || 0;
    const exList  = count
      ? dayData.workouts.slice(0, 3).map(w => w.name).join(', ') + (count > 3 ? ` +${count - 3}` : '')
      : 'Rest day 😴';
    parts.push(`${emoji} ${day}: ${label} — ${exList}`);
  });
  parts.push('— Sent from Jim Buddy 💪');

  const content = parts.join('\n');
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = content;
    handleSendChatMessage();
  }
}
window.shareSplitInChat       = shareSplitInChat;
window.toggleChatQuickActions = toggleChatQuickActions;

function suggestWorkoutTime() {
  const day = prompt("Enter day for workout (e.g. Monday, Tomorrow, 07/07):", "Tomorrow");
  if (!day) return;
  const time = prompt("Enter workout time (e.g. 6:00 PM, 18:00):", "6:00 PM");
  if (!time) return;

  const content = `🏋️ Gym Invitation: Let's hit the gym on ${day} at ${time}!`;
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = content;
    handleSendChatMessage();
  }
}
window.suggestWorkoutTime = suggestWorkoutTime;

async function handleInviteResponse(msgId, accepted, originalContent) {
  DB.set('invite_resp_' + msgId, accepted ? 'accepted' : 'declined');

  // Instant local UI update
  const row = document.querySelector(`.chat-message-row[data-msg-id="${msgId}"]`);
  if (row) {
    const actions = row.querySelector('.invite-actions');
    if (actions) {
      actions.outerHTML = accepted
        ? `<div style="margin-top: 6px; font-weight: bold; color: var(--accent);">Accepted ✅</div>`
        : `<div style="margin-top: 6px; font-weight: bold; color: var(--danger);">Declined ❌</div>`;
    }
  }

  const cleanContent = originalContent.replace('🏋️ Gym Invitation: ', '').trim();
  const responseText = accepted
    ? `✅ Accepted invitation: ${cleanContent}`
    : `❌ Declined invitation: ${cleanContent}`;

  if (activeChatId) {
    await sendMessage(activeChatId, responseText);
  }
}
window.handleInviteResponse = handleInviteResponse;

// Scroll to bottom helper
function scrollToBottom() {
  const container = document.getElementById('chat-messages-container');
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

// Heartbeat online/offline status management
function startStatusHeartbeat() {
  if (statusHeartbeatInterval) clearInterval(statusHeartbeatInterval);

  // Set online immediately
  updateUserStatus(true);

  // Initial tab badge sync
  setTimeout(() => {
    updateGymbrosTabBadge();
    
    // Subscribe to new/unread messages to update badge in realtime
    if (typeof subscribeToUnreadChats === 'function' && !activeUnreadChatsSubscription) {
      activeUnreadChatsSubscription = subscribeToUnreadChats(() => {
        updateGymbrosTabBadge();
      });
    }

    // Background notification sound: fires on any incoming message even when chat is closed
    const currentUser = getAuthUser();
    if (typeof subscribeToIncomingMessages === 'function' && !activeIncomingMsgsSubscription && currentUser) {
      activeIncomingMsgsSubscription = subscribeToIncomingMessages(currentUser.id, (newMsg) => {
        // Always update the unread dot on the friend's card
        const senderCard = document.getElementById(`friend-card-${newMsg.sender_id}`);
        if (senderCard && activeChatFriendId !== newMsg.sender_id) {
          senderCard.classList.add('has-unread');
        }

        // Only play sound when the chat modal is closed or the sender isn't the active chat
        const chatModal = document.getElementById('chat-modal');
        const modalOpen = chatModal && chatModal.classList.contains('open');
        if (!modalOpen && typeof SoundManager !== 'undefined') {
          SoundManager.chatMessage();
        }
        // If modal is open but for a different friend, still play
        if (modalOpen && activeChatFriendId !== newMsg.sender_id && typeof SoundManager !== 'undefined') {
          SoundManager.chatMessage();
        }

        // Fire system notification (works on Android and web when app is backgrounded)
        sendChatNotification(newMsg.sender_id, newMsg.content || '📨 New message', newMsg.chat_id);
      });
    }
  }, 1000);

  // Periodic updates while tab is active
  statusHeartbeatInterval = setInterval(() => {
    if (getAuthUser() && document.visibilityState === 'visible') {
      updateUserStatus(true);
      updateGymbrosTabBadge();
    }
  }, 45000);
}

function stopStatusHeartbeat() {
  if (statusHeartbeatInterval) {
    clearInterval(statusHeartbeatInterval);
    statusHeartbeatInterval = null;
  }
  if (activeUnreadChatsSubscription && supabaseClient) {
    supabaseClient.removeChannel(activeUnreadChatsSubscription);
    activeUnreadChatsSubscription = null;
  }
  if (activeIncomingMsgsSubscription && supabaseClient) {
    supabaseClient.removeChannel(activeIncomingMsgsSubscription);
    activeIncomingMsgsSubscription = null;
  }
  updateUserStatus(false);
}

// Focus/Blur and unload listeners
window.addEventListener('focus', () => {
  if (getAuthUser()) updateUserStatus(true);
});

window.addEventListener('blur', () => {
  if (getAuthUser()) updateUserStatus(false);
});

document.addEventListener('visibilitychange', () => {
  if (getAuthUser()) {
    updateUserStatus(document.visibilityState === 'visible');
  }
});

window.addEventListener('beforeunload', () => {
  if (getAuthUser()) {
    updateUserStatus(false);
  }
});

// Initialize heartbeat if user starts logged in
window.addEventListener('load', () => {
  setTimeout(() => {
    if (getAuthUser()) {
      startStatusHeartbeat();
    }
  }, 2000);
});

// ══════════════════════════════════════════
// MERGED PAGE MODALS — Schedule ("Split") & Diet
// Schedule and Diet are no longer separate bottom-nav
// pages — they open as modals from the Workouts page
// (Schedule button) and Food page (Diet button), reusing
// the exact same render functions/content as before.
// ══════════════════════════════════════════

function openSplitModal() {
  renderWeeklySchedule();
  openModal('split-modal');
}
window.openSplitModal = openSplitModal;

function openDietModal() {
  renderDietPage();
  openModal('diet-modal');
}
window.openDietModal = openDietModal;