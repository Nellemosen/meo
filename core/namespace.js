/* ==========================================================================
   core/namespace.js – namespace, configuration and helper functions
   Loaded FIRST. All other modules attach themselves to window.MEO.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = (window.MEO = window.MEO || {});

  MEO.VERSION = '0.26.0 (Nature and undead)';

  MEO.CONFIG = {
    TILE: 32,          // pixels per tile
    STEP: 1 / 60,      // fixed time step for game logic (seconds)
    MAX_FRAME: 0.25,   // longest frame we are willing to catch up on (avoids the "spiral of death")
    MAX_STEPS: 8,      // max logic steps per frame
    ZOOM_MIN: 0.75,
    ZOOM_MAX: 2,
    ZOOM_STEP: 0.25,
    ZOOM_DEFAULT: 1.25,
    WORLD_SEED: 20261019,
    START_LEVEL: 1,         // new characters start at level 1
    MAX_LEVEL: 15,
    DEBUG: false
  };

  const U = (MEO.util = {});

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  /** Seeded pseudo-random generator (0..1). */
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Deterministic hash of (x, y, seed) → 0..1. */
  U.hash2 = function (x, y, seed) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /** Smooth value noise (0..1). */
  U.valueNoise = function (x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = U.hash2(x0, y0, seed);
    const b = U.hash2(x0 + 1, y0, seed);
    const c = U.hash2(x0, y0 + 1, seed);
    const d = U.hash2(x0 + 1, y0 + 1, seed);
    return U.lerp(U.lerp(a, b, sx), U.lerp(c, d, sx), sy);
  };

  /** Fractal noise (multiple octaves), 0..1. */
  U.fbm = function (x, y, seed, octaves) {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < (octaves || 4); i++) {
      sum += amp * U.valueNoise(x * freq, y * freq, seed + i * 101);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };

  /** XP needed to go from level L to L+1. */
  U.xpToNext = (level) => Math.round(28 * Math.pow(level, 1.5));
})();
