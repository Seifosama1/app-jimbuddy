const JBIcons = (() => {
  const PATHS = {
    trophy: `<path d="M8 3h8v7a4 4 0 0 1-8 0V3z"/><path d="M8 5H5a2 2 0 0 0 0 4h3"/><path d="M16 5h3a2 2 0 0 1 0 4h-3"/><line x1="12" y1="14" x2="12" y2="18"/><rect x="8" y="18" width="8" height="2.5" rx="1"/>`,
    dumbbell: `<line x1="8.5" y1="12" x2="15.5" y2="12"/><rect x="5.5" y="9.5" width="2" height="5" rx="0.5"/><rect x="3" y="8" width="2.5" height="8" rx="0.5"/><rect x="16.5" y="9.5" width="2" height="5" rx="0.5"/><rect x="18.5" y="8" width="2.5" height="8" rx="0.5"/>`,
    flame: `<path d="M12 2c0 0-5 5-5 10.5a5 5 0 0 0 10 0C17 7 12 2 12 2z"/><path d="M12 14c0 0-2-2-2-3.5a2 2 0 0 1 4 0c0 1.5-2 3.5-2 3.5z"/>`,
    droplet: `<path d="M12 3c3.6 4.6 6 7.8 6 11a6 6 0 0 1-12 0C6 10.8 8.4 7.6 12 3z"/>`,
    scale: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/><line x1="5" y1="8" x2="19" y2="8"/><line x1="6" y1="8" x2="6" y2="12"/><path d="M3.5 12h5"/><line x1="18" y1="8" x2="18" y2="12"/><path d="M15.5 12h5"/>`,
    'chart-bar': `<line x1="4" y1="4" x2="4" y2="20"/><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="14" width="3.5" height="6" rx="1"/><rect x="11.3" y="10" width="3.5" height="10" rx="1"/><rect x="16.5" y="6" width="3.5" height="14" rx="1"/>`,
    'chart-line': `<line x1="4" y1="4" x2="4" y2="20"/><line x1="4" y1="20" x2="20" y2="20"/><polyline points="5,17 9,12 13,15 19,7"/><circle cx="19" cy="7" r="1.5" fill="currentColor"/>`,
    target: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>`,
    medal: `<path d="M10 7L8 3"/><path d="M14 7L16 3"/><circle cx="12" cy="14" r="6"/><path d="M12 10.5l1 2.5 2.5 0-2 1.8.8 2.7-2.3-1.5-2.3 1.5.8-2.7-2-1.8 2.5 0z"/>`,
    user: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>`,
    users: `<circle cx="8.5" cy="7.5" r="2.5"/><path d="M3.5 19c0-2.9 2.2-4.8 5-4.8"/><circle cx="17" cy="9" r="2"/><path d="M14.3 19c0-2.2 1.4-3.7 3.2-3.7s3.2 1.5 3.2 3.7"/>`,
    timer: `<circle cx="12" cy="13" r="8"/><line x1="12" y1="5" x2="12" y2="3"/><line x1="9.5" y1="3" x2="14.5" y2="3"/><line x1="12" y1="13" x2="9" y2="10"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><circle cx="8" cy="13" r="0.8" fill="currentColor"/><circle cx="12" cy="13" r="0.8" fill="currentColor"/><circle cx="16" cy="13" r="0.8" fill="currentColor"/><circle cx="8" cy="17" r="0.8" fill="currentColor"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/><circle cx="16" cy="17" r="0.8" fill="currentColor"/>`,
    clipboard: `<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>`,
    trash: `<line x1="4" y1="7" x2="20" y2="7"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><rect x="6" y="7" width="12" height="14" rx="2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
    save: `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><rect x="9" y="3" width="6" height="5" rx="0.5"/><rect x="6" y="14" width="12" height="5" rx="0.5"/>`,
    calculator: `<rect x="5" y="2" width="14" height="20" rx="3"/><rect x="8" y="5" width="8" height="4" rx="1"/><rect x="8" y="12" width="2.5" height="2" rx="0.5"/><rect x="11.8" y="12" width="2.5" height="2" rx="0.5"/><rect x="15.5" y="12" width="1.5" height="2" rx="0.5"/><rect x="8" y="15.5" width="2.5" height="2" rx="0.5"/><rect x="11.8" y="15.5" width="2.5" height="2" rx="0.5"/><rect x="15.5" y="15.5" width="1.5" height="2" rx="0.5"/>`,
    bicep: `<path d="M6 18c0 0 1-3 3-4l1-1c1-1 1-3 0-4"/><path d="M10 9c-1-2 0-5 3-5 2 0 5 1 5 4 0 2-2 3-3 3"/><path d="M15 11c1 1 2 2 2 4 0 2-1 3-2 3H9"/>`,
    bulb: `<path d="M12 2a7 7 0 0 1 4 12.8V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.2A7 7 0 0 1 12 2z" fill="currentColor" stroke="none"/><rect x="9" y="18" width="6" height="1.5" rx="0.75" fill="currentColor" stroke="none"/><rect x="10" y="20" width="4" height="1.5" rx="0.75" fill="currentColor" stroke="none"/>`,
    bell: `<path d="M18 16H6l2-5V8a4 4 0 0 1 8 0v3l2 5z" fill="currentColor" stroke="none"/><path d="M10 19a2 2 0 0 0 4 0" fill="currentColor" stroke="none"/>`,
    clock: `<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><line x1="12" y1="7" x2="12" y2="12" stroke="var(--bg)" stroke-width="1.8" stroke-linecap="round"/><line x1="12" y1="12" x2="15.5" y2="14" stroke="var(--bg)" stroke-width="1.8" stroke-linecap="round"/>`,
    wave: `<path d="M8.5 4.5c.4-1 1.6-1.4 2.5-.8l.3.2c1 .8 1 2.2 0 3L6 12c-1 .8-1 2.2 0 3l.3.2c.9.6 2.1.2 2.5-.8l3-6c.4-1 1.6-1.4 2.5-.8l.3.2c1 .8 1 2.2 0 3L11 16c-.5.6-.4 1.5.2 2 .6.4 1.4.3 1.8-.3l2-2.7c.8-1 2.2-1 3 0l.2.3c.6.9.4 2.1-.5 2.7C15.3 20 12 21 9 19.5 6 18 4 15 4 12c0-2 .8-3.8 2-5.1L8.5 4.5z" fill="currentColor" stroke="none"/>`,
  };

  // ── Stickman muscle-group icons ─────────────────────────────────────────────
  // Each icon is a stickman where the target muscle is drawn in teal (#00E5A0)
  // and the rest of the skeleton is a dim muted color.
  //
  // Stickman anatomy (24×24 viewBox):
  //   Head:      circle cx=12 cy=3 r=1.8
  //   Neck:      12,4.8 → 12,6.5
  //   Shoulders: 6,8    → 18,8        (horizontal shoulder bar)
  //   Torso:     12,6.5 → 12,14
  //   L-Arm:     6,8    → 4,13
  //   R-Arm:     18,8   → 20,13
  //   L-Forearm: 4,13   → 5,17
  //   R-Forearm: 20,13  → 19,17
  //   Hips:      9,14   → 15,14       (horizontal hip bar)
  //   L-Thigh:   9,14   → 7,19
  //   R-Thigh:   15,14  → 17,19
  //   L-Shin:    7,19   → 7,23
  //   R-Shin:    17,19  → 17,23

  const TEAL   = '#00E5A0';
  const DIM    = 'rgba(255,255,255,0.25)';
  const SW_DIM = '1.4';
  const SW_HI  = '2.2';
  const LC     = 'round';

  const _c = (cx, cy, r, col, sw) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${col}" stroke-width="${sw}" fill="none"/>`;
  const _l = (x1, y1, x2, y2, col, sw) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="${LC}"/>`;

  function _stickman({ head, neck, shoulders, torso, lArm, rArm, lForearm, rForearm, hips, lThigh, rThigh, lShin, rShin } = {}) {
    return [
      _c(12, 3,   1.8, head      ? TEAL : DIM, head      ? SW_HI : SW_DIM),
      _l(12, 4.8, 12,  6.5,      neck      ? TEAL : DIM, neck      ? SW_HI : SW_DIM),
      _l(6,  8,   18,  8,        shoulders ? TEAL : DIM, shoulders ? SW_HI : SW_DIM),
      _l(12, 6.5, 12,  14,       torso     ? TEAL : DIM, torso     ? SW_HI : SW_DIM),
      _l(6,  8,   4,   13,       lArm      ? TEAL : DIM, lArm      ? SW_HI : SW_DIM),
      _l(18, 8,   20,  13,       rArm      ? TEAL : DIM, rArm      ? SW_HI : SW_DIM),
      _l(4,  13,  5,   17,       lForearm  ? TEAL : DIM, lForearm  ? SW_HI : SW_DIM),
      _l(20, 13,  19,  17,       rForearm  ? TEAL : DIM, rForearm  ? SW_HI : SW_DIM),
      _l(9,  14,  15,  14,       hips      ? TEAL : DIM, hips      ? SW_HI : SW_DIM),
      _l(9,  14,  7,   19,       lThigh    ? TEAL : DIM, lThigh    ? SW_HI : SW_DIM),
      _l(15, 14,  17,  19,       rThigh    ? TEAL : DIM, rThigh    ? SW_HI : SW_DIM),
      _l(7,  19,  7,   23,       lShin     ? TEAL : DIM, lShin     ? SW_HI : SW_DIM),
      _l(17, 19,  17,  23,       rShin     ? TEAL : DIM, rShin     ? SW_HI : SW_DIM),
    ].join('');
  }

  const MUSCLE_STICKMEN = {
    Chest:      () => _stickman({ shoulders: true, torso: true }),
    Back:       () => _stickman({ neck: true, shoulders: true, torso: true }),
    Shoulders:  () => {
      const base = _stickman({});
      const dot  = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="2.2" fill="${TEAL}" stroke="none"/>`;
      return base + dot(6, 8) + dot(18, 8);
    },
    Legs:       () => _stickman({ hips: true, lThigh: true, rThigh: true, lShin: true, rShin: true }),
    Arms:       () => _stickman({ lArm: true, rArm: true, lForearm: true, rForearm: true }),
    Core:       () => _stickman({ torso: true, hips: true }),
    Cardio:     () => {
      const heart =
        `<path d="M12 14.5C12 14.5 6.5 10.5 6.5 7.5A3 3 0 0 1 12 6.8A3 3 0 0 1 17.5 7.5C17.5 10.5 12 14.5 12 14.5Z"` +
        ` fill="${TEAL}" stroke="none"/>`;
      const pulse =
        `<polyline points="4,19.5 7.5,19.5 8.8,17.5 10.2,21.5 12,16.5 13.8,21.5 15.2,17.5 16.5,19.5 20,19.5"` +
        ` stroke="${TEAL}" stroke-width="${SW_HI}" fill="none" stroke-linecap="${LC}" stroke-linejoin="${LC}"/>`;
      return heart + pulse;
    },
    'Full Body':() => _stickman({ head: true, neck: true, shoulders: true, torso: true,
                                  lArm: true, rArm: true, lForearm: true, rForearm: true,
                                  hips: true, lThigh: true, rThigh: true, lShin: true, rShin: true }),
  };

  /**
   * Returns a two-tone stickman SVG with the target muscle group highlighted in teal.
   * @param {string} muscleGroup  e.g. 'Chest', 'Legs', 'Core'
   * @param {number} [size=28]    pixel dimensions of the SVG
   */
  function muscleIcon(muscleGroup, size = 28) {
    const render = MUSCLE_STICKMEN[muscleGroup];
    const body   = render ? render() : _stickman({});
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="jb-muscle-icon" aria-hidden="true">${body}</svg>`;
  }

  function svg(name, opts = {}) {
    const paths = PATHS[name];
    if (!paths) { console.warn(`[JBIcons] Unknown icon: "${name}"`); return ''; }
    const size  = opts.size  || 18;
    const cls   = opts.class ? ` class="jb-icon ${opts.class}"` : ' class="jb-icon"';
    const color = opts.color ? ` style="color:${opts.color};stroke:${opts.color}"` : '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${cls}${color} aria-hidden="true">${paths}</svg>`;
  }

  return { svg, muscleIcon, PATHS };
})();

window.JBIcons = JBIcons;
