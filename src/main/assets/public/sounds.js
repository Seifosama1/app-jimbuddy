/* ══════════════════════════════════════════
   JIM BUDDY — Sound Manager
   Web Audio API · No external files needed
   All sounds generated programmatically
══════════════════════════════════════════ */

const SoundManager = (() => {
  let ctx = null;
  let enabled = true;

  // Lazy-init AudioContext on first user interaction
  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ─── Core synthesis helpers ──────────────────────────

  function playTone({ frequency = 440, type = 'sine', gain = 0.3, duration = 0.08, attack = 0.005, decay = 0.05, startTime = 0 }) {
    const c = getCtx();
    if (!c || !enabled) return;

    const osc = c.createOscillator();
    const gainNode = c.createGain();

    osc.connect(gainNode);
    gainNode.connect(c.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime + startTime);

    gainNode.gain.setValueAtTime(0, c.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(gain, c.currentTime + startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);

    osc.start(c.currentTime + startTime);
    osc.stop(c.currentTime + startTime + duration + 0.01);
  }

  function playNoise({ gain = 0.15, duration = 0.06, filterFreq = 800, startTime = 0 }) {
    const c = getCtx();
    if (!c || !enabled) return;

    const bufferSize = c.sampleRate * (duration + 0.05);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.5;

    const gainNode = c.createGain();
    gainNode.gain.setValueAtTime(gain, c.currentTime + startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(c.destination);

    source.start(c.currentTime + startTime);
    source.stop(c.currentTime + startTime + duration + 0.05);
  }

  // ══════════════════════════════════════════
  // SOUNDS
  // ══════════════════════════════════════════

  /**
   * Button tap — soft, airy tick
   * Used on: any nav/button press
   */
  function tap() {
    playTone({ frequency: 1200, type: 'sine', gain: 0.12, duration: 0.05, attack: 0.002, decay: 0.04 });
  }

  /**
   * Checkbox / set check — satisfying pop
   * Used on: toggleSetCheck()
   */
  function check() {
    // Two-tone pop: high then quick lower
    playTone({ frequency: 880,  type: 'sine', gain: 0.18, duration: 0.06, attack: 0.003, startTime: 0 });
    playTone({ frequency: 1320, type: 'sine', gain: 0.12, duration: 0.04, attack: 0.002, startTime: 0.04 });
  }

  /**
   * Uncheck — reversed pop
   */
  function uncheck() {
    playTone({ frequency: 660, type: 'sine', gain: 0.12, duration: 0.06, attack: 0.003, startTime: 0 });
  }

  /**
   * Rest timer tick — soft metronome click each second
   * Used on: setInterval in startRestTimer()
   */
  function timerTick() {
    playNoise({ gain: 0.08, duration: 0.02, filterFreq: 1800 });
  }

  /**
   * Rest timer warning — slightly louder ticks at last 3 seconds
   */
  function timerTickWarn() {
    playTone({ frequency: 880, type: 'sine', gain: 0.14, duration: 0.035, attack: 0.002 });
  }

  /**
   * Rest timer done — gentle two-note chime
   * Used on: when rest countdown reaches 0
   */
  function timerDone() {
    playTone({ frequency: 784, type: 'sine', gain: 0.22, duration: 0.15, attack: 0.005, startTime: 0 });
    playTone({ frequency: 1046, type: 'sine', gain: 0.18, duration: 0.2,  attack: 0.005, startTime: 0.12 });
  }

  /**
   * Rest timer alarm — sharp repeating beep
   * Used on: setInterval after rest countdown hits 0, until Finish is tapped
   */
  function alarmBeep() {
    playTone({ frequency: 1100, type: 'square', gain: 0.22, duration: 0.16, attack: 0.003 });
    playTone({ frequency: 1100, type: 'square', gain: 0.18, duration: 0.16, attack: 0.003, startTime: 0.22 });
  }

  /**
   * Water add — bubbly splash
   * Used on: addWater()
   */
  function waterSplash() {
    const c = getCtx();
    if (!c || !enabled) return;

    // Descending pitch sweep (like a drop hitting water)
    const osc = c.createOscillator();
    const gainNode = c.createGain();
    osc.connect(gainNode);
    gainNode.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.18, c.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.16);

    // Small noise burst for the "splash" texture
    playNoise({ gain: 0.07, duration: 0.06, filterFreq: 600, startTime: 0.02 });
    // Tiny bubble pop after
    playTone({ frequency: 1400, type: 'sine', gain: 0.07, duration: 0.04, attack: 0.001, startTime: 0.1 });
  }

  /**
   * Modal open — very soft whoosh
   */
  function modalOpen() {
    playNoise({ gain: 0.06, duration: 0.08, filterFreq: 1200 });
  }

  /**
   * Toast / success — quick upward ding
   */
  function success() {
    playTone({ frequency: 660,  type: 'sine', gain: 0.14, duration: 0.07, attack: 0.003, startTime: 0 });
    playTone({ frequency: 880,  type: 'sine', gain: 0.10, duration: 0.07, attack: 0.003, startTime: 0.07 });
  }

  /**
   * Error / denied — soft descending blip
   */
  function error() {
    playTone({ frequency: 440, type: 'sine', gain: 0.14, duration: 0.08, attack: 0.003, startTime: 0 });
    playTone({ frequency: 330, type: 'sine', gain: 0.10, duration: 0.08, attack: 0.003, startTime: 0.07 });
  }

  // ─── Settings persistence ────────────────────────────
  function init() {
    // Read user preference
    const stored = localStorage.getItem('jimbuddy_sounds');
    enabled = stored === null ? true : stored === 'true';
    updateToggleUI();
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem('jimbuddy_sounds', enabled);
    updateToggleUI();
    if (enabled) tap(); // confirm it's on
  }

  function isEnabled() { return enabled; }

  function updateToggleUI() {
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = enabled ? '🔊' : '🔇';
      btn.title = enabled ? 'Sound on' : 'Sound off';
    }
  }

  /**
   * Goal reached — ascending fanfare arpeggio + shimmer tail
   * Used on: water goal hit, calorie goal hit
   */
  function goalReached() {
    // Rising 5-note arpeggio (C-E-G-C-E one octave up)
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      playTone({ frequency: freq, type: 'sine', gain: 0.18 - i * 0.01, duration: 0.18, attack: 0.008, startTime: i * 0.10 });
    });
    // Sparkle shimmer tail — high-frequency noise burst
    playNoise({ gain: 0.06, duration: 0.18, filterFreq: 4000, startTime: 0.52 });
    // Final soft chime linger
    playTone({ frequency: 1047, type: 'sine', gain: 0.14, duration: 0.45, attack: 0.01, startTime: 0.60 });
    playTone({ frequency: 1319, type: 'sine', gain: 0.10, duration: 0.40, attack: 0.01, startTime: 0.72 });
  }

  // Public API
  return { tap, check, uncheck, timerTick, timerTickWarn, timerDone, alarmBeep, waterSplash, modalOpen, success, error, goalReached, toggle, isEnabled, init };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => SoundManager.init());