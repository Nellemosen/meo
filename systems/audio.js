/* ==========================================================================
   systems/audio.js – All sound is synthesized with the Web Audio API (no files)
   - SFX: hits per damage school, crits, heals, casts, deaths, loot, level-up, quests, UI, boss
   - Music: procedural pad + pulse. Modes: explore, combat, boss (chosen from game state)
   - Volume (master/sfx/music) and mute live in the pause menu; saved in localStorage.
   The AudioContext is created on the first click or key press (browser rule).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const KEY = 'meo.audio.v1';

  const A2 = 110;
  const hz = function (semi) {
    return A2 * Math.pow(2, semi / 12);
  };
  // chord roots (semitones from A2) and minor/major triads
  const PROG = [0, -4, 3, -2];
  const MINOR = [0, 3, 7];
  const MAJOR = [0, 4, 7];
  const QUAL = [MINOR, MAJOR, MAJOR, MAJOR];
  const PENT = [0, 3, 5, 7, 10, 12, 15, 17];

  const Audio = (MEO.Audio = {
    ctx: null,
    vol: { master: 0.7, sfx: 0.8, music: 0.5 },
    muted: false,
    mode: 'explore',
    _t: {},          // per-sfx throttle
    _next: 0,        // next bar start (audio time)
    _bar: 0,
    _noiseBuf: null,

    // ---- Setup -------------------------------------------------------------------
    load() {
      try {
        const d = JSON.parse(window.localStorage.getItem(KEY) || 'null');
        if (d) {
          ['master', 'sfx', 'music'].forEach(function (k) {
            if (typeof d[k] === 'number') Audio.vol[k] = Math.max(0, Math.min(1, d[k]));
          });
          Audio.muted = !!d.muted;
        }
      } catch (err) { /* ignore */ }
    },

    save() {
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ master: Audio.vol.master, sfx: Audio.vol.sfx, music: Audio.vol.music, muted: Audio.muted }));
      } catch (err) { /* ignore */ }
    },

    /** Create the audio graph (needs a user gesture). Safe to call repeatedly. */
    ensure() {
      if (Audio.ctx) {
        if (Audio.ctx.state === 'suspended' && !MEO.Engine.paused) Audio.ctx.resume();
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        const c = (Audio.ctx = new AC());
        Audio.master = c.createGain();
        Audio.sfxG = c.createGain();
        Audio.musG = c.createGain();
        const comp = c.createDynamicsCompressor();
        Audio.sfxG.connect(Audio.master);
        Audio.musG.connect(Audio.master);
        Audio.master.connect(comp);
        comp.connect(c.destination);
        const len = c.sampleRate;
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        Audio._noiseBuf = buf;
        Audio._apply();
        Audio._next = c.currentTime + 0.1;
        return true;
      } catch (err) {
        Audio.ctx = null;
        return false;
      }
    },

    _apply() {
      if (!Audio.ctx) return;
      const t = Audio.ctx.currentTime;
      Audio.master.gain.setTargetAtTime(Audio.muted ? 0 : Audio.vol.master, t, 0.03);
      Audio.sfxG.gain.setTargetAtTime(Audio.vol.sfx, t, 0.03);
      Audio.musG.gain.setTargetAtTime(Audio.vol.music * 0.5, t, 0.03);
    },

    setVol(kind, v) {
      Audio.vol[kind] = Math.max(0, Math.min(1, v));
      Audio._apply();
      Audio.save();
    },

    setMuted(m) {
      Audio.muted = !!m;
      Audio._apply();
      Audio.save();
    },

    // ---- Building blocks -----------------------------------------------------------
    tone(f, dur, type, vol, o) {
      const c = Audio.ctx;
      o = o || {};
      const t0 = (o.at || c.currentTime) + 0.005;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(f, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
      const a = o.attack || 0.01;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node = osc;
      if (o.lp) {
        const f2 = c.createBiquadFilter();
        f2.type = 'lowpass';
        f2.frequency.value = o.lp;
        osc.connect(f2);
        node = f2;
      }
      node.connect(g);
      g.connect(o.dest || Audio.sfxG);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },

    noise(dur, vol, o) {
      const c = Audio.ctx;
      o = o || {};
      const t0 = (o.at || c.currentTime) + 0.005;
      const src = c.createBufferSource();
      src.buffer = Audio._noiseBuf;
      const f = c.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 1500, t0);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.dest || Audio.sfxG);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    },

    /** Play a named effect (throttled so crowded fights do not turn into noise). */
    sfx(name, o) {
      if (!Audio.ensure() || Audio.muted) return;
      const c = Audio.ctx;
      const now = c.currentTime;
      const gap = { hit: 0.05, heal: 0.12, miss: 0.1, cast: 0.15 }[name] || 0.03;
      if (now - (Audio._t[name] || 0) < gap) return;
      Audio._t[name] = now;
      const S = Audio.SFX[name];
      if (S) S(o || {});
    },

    SFX: {
      hit(o) {
        const big = o.crit ? 1.5 : 1;
        switch (o.school) {
          case 'fire':
            Audio.noise(0.28, 0.35 * big, { freq: 2200, to: 400, q: 0.7 });
            Audio.tone(180, 0.2, 'sawtooth', 0.12 * big, { to: 70, lp: 900 });
            break;
          case 'frost':
            Audio.tone(1500, 0.18, 'triangle', 0.15 * big, { to: 700 });
            Audio.noise(0.12, 0.2, { type: 'highpass', freq: 5000 });
            break;
          case 'arcane': case 'magic': case 'shadow': case 'holy':
            Audio.tone(520, 0.22, 'sine', 0.2 * big, { to: 220 });
            Audio.tone(780, 0.18, 'triangle', 0.1 * big, { to: 330 });
            break;
          default:
            Audio.noise(0.09, 0.4 * big, { freq: 900, to: 300, q: 0.8 });
            Audio.tone(140, 0.12, 'square', 0.12 * big, { to: 60, lp: 700 });
        }
        if (o.crit) Audio.tone(900, 0.12, 'triangle', 0.12, { to: 1400 });
      },
      miss() {
        Audio.noise(0.12, 0.12, { type: 'highpass', freq: 2500, to: 900 });
      },
      heal() {
        const t = Audio.ctx.currentTime;
        Audio.tone(660, 0.35, 'sine', 0.14, { at: t });
        Audio.tone(990, 0.4, 'sine', 0.1, { at: t + 0.07 });
      },
      cast() {
        Audio.tone(300, 0.25, 'triangle', 0.06, { to: 520 });
      },
      death(o) {
        Audio.tone(o.big ? 90 : 160, o.big ? 1.1 : 0.5, 'sawtooth', 0.22, { to: 40, lp: 500 });
        Audio.noise(o.big ? 0.8 : 0.3, 0.2, { freq: 600, to: 120 });
      },
      loot() {
        const t = Audio.ctx.currentTime;
        Audio.tone(1200, 0.1, 'square', 0.07, { at: t, lp: 3000 });
        Audio.tone(1700, 0.14, 'square', 0.07, { at: t + 0.07, lp: 3000 });
      },
      levelup() {
        const t = Audio.ctx.currentTime;
        [0, 4, 7, 12, 16].forEach(function (s, i) {
          Audio.tone(hz(s + 12), 0.9, 'triangle', 0.16, { at: t + i * 0.11, attack: 0.02 });
        });
      },
      quest() {
        const t = Audio.ctx.currentTime;
        Audio.tone(hz(7 + 12), 0.5, 'triangle', 0.16, { at: t });
        Audio.tone(hz(12 + 12), 0.8, 'triangle', 0.16, { at: t + 0.16 });
      },
      click() {
        Audio.tone(700, 0.05, 'square', 0.05, { lp: 2500 });
      },
      warn() {
        const t = Audio.ctx.currentTime;
        Audio.tone(440, 0.2, 'sawtooth', 0.12, { at: t, lp: 1200 });
        Audio.tone(330, 0.3, 'sawtooth', 0.12, { at: t + 0.18, lp: 1200 });
      },
      boom() {
        Audio.tone(110, 0.7, 'sine', 0.5, { to: 35 });
        Audio.noise(0.6, 0.45, { freq: 500, to: 80, type: 'lowpass' });
      },
      roar() {
        Audio.tone(120, 1.2, 'sawtooth', 0.28, { to: 55, lp: 600, attack: 0.15 });
        Audio.noise(1.0, 0.25, { freq: 400, to: 150, q: 2 });
      }
    },

    // ---- Music -------------------------------------------------------------------
    _mode() {
      if (MEO.Boss && MEO.Boss.current) return 'boss';
      if (MEO.Party && MEO.Party.anyInCombat()) return 'combat';
      return 'explore';
    },

    /** Called every logic step: pick a mode and schedule the next music bars. */
    update() {
      const c = Audio.ctx;
      if (!c || c.state !== 'running') return;
      Audio.mode = Audio._mode();
      const lead = Audio.mode === 'explore' ? 1.5 : 0.5;
      let guard = 0;
      while (Audio._next < c.currentTime + lead && guard++ < 4) Audio._scheduleBar(Audio._next);
    },

    _scheduleBar(t) {
      const m = Audio.mode;
      const bar = Audio._bar++;
      const chord = bar % PROG.length;
      const root = PROG[chord] + (m === 'boss' ? -2 : 0);
      const tri = m === 'boss' ? MINOR : QUAL[chord];
      const len = m === 'explore' ? 7 : m === 'combat' ? 2.4 : 2.0;
      const G = Audio.musG;
      // pad
      tri.forEach(function (s, i) {
        Audio.tone(hz(root + s + (i === 0 ? -12 : 0)), len * 1.15, m === 'boss' ? 'sawtooth' : 'triangle', m === 'explore' ? 0.22 : 0.16,
          { at: t, attack: len * 0.35, dest: G, lp: m === 'boss' ? 700 : 1400 });
      });
      if (m === 'explore') {
        // sparse pentatonic melody
        for (let k = 0; k < 4; k++) {
          if (Math.random() < 0.55) {
            const n = PENT[Math.floor(Math.random() * PENT.length)];
            Audio.tone(hz(n + 12), 1.6, 'sine', 0.12, { at: t + k * (len / 4) + Math.random() * 0.3, dest: G, attack: 0.03 });
          }
        }
      } else {
        const beat = len / 4;
        for (let k = 0; k < 4; k++) {
          // drum: kick on every beat, snare noise on 2 and 4
          Audio.tone(95, 0.22, 'sine', m === 'boss' ? 0.5 : 0.35, { at: t + k * beat, to: 40, dest: G });
          if (k % 2) Audio.noise(0.15, m === 'boss' ? 0.28 : 0.18, { at: t + k * beat, freq: 1800, dest: G });
          // bass pulse on the off-beat
          Audio.tone(hz(root - 12), beat * 0.45, 'sawtooth', 0.14, { at: t + k * beat + beat * 0.5, dest: G, lp: 500 });
        }
        if (m === 'boss') {
          // brass-like stabs on the first beat of every bar
          [0, 7].forEach(function (s) {
            Audio.tone(hz(root + s + 12), beat * 1.4, 'sawtooth', 0.1, { at: t, dest: G, lp: 1100, attack: 0.04 });
          });
        }
      }
      Audio._next = t + len;
    }
  });

  // ---- Wiring ----------------------------------------------------------------------
  Audio.load();
  const unlock = function () {
    Audio.ensure();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const mine = function (e) {
    return e && (e.type === 'player' || e.type === 'party');
  };

  Events.on('damage', function (d) {
    if (!d.src || !d.tgt) return;
    if (!mine(d.src) && !mine(d.tgt)) return;
    Audio.sfx('hit', { school: d.school, crit: d.crit });
  });
  Events.on('miss', function (d) {
    if (mine(d.src) || mine(d.tgt)) Audio.sfx('miss');
  });
  Events.on('heal', function (d) {
    if (mine(d.tgt) && d.effective > 0) Audio.sfx('heal');
  });
  Events.on('cast:start', function (d) {
    const e = d && (d.entity || d.caster || d.src);
    if (!e || e.type === 'player') Audio.sfx('cast');
  });
  Events.on('death', function (d) {
    const e = d.entity;
    if (!e) return;
    const big = e.rank === 'boss';
    if (e.type === 'mob' || mine(e)) Audio.sfx('death', { big: big });
  });
  Events.on('loot:open', function () { Audio.sfx('loot'); });
  Events.on('item:equip', function () { Audio.sfx('click'); });
  Events.on('item:buy', function () { Audio.sfx('loot'); });
  Events.on('item:sell', function () { Audio.sfx('loot'); });
  Events.on('player:levelup', function () { Audio.sfx('levelup'); });
  Events.on('quest:complete', function () { Audio.sfx('quest'); });
  Events.on('npc:interact', function () { Audio.sfx('click'); });
  Events.on('boss:engage', function () { Audio.sfx('roar'); });
  Events.on('boss:say', function (d) { if (d.warn) Audio.sfx('warn'); });
  Events.on('hazard:burst', function () { Audio.sfx('boom'); });
  Events.on('boss:phase', function () { Audio.sfx('roar'); });
  Events.on('engine:pause', function (p) {
    const c = Audio.ctx;
    if (!c) return;
    if (p) c.suspend();
    else c.resume();
  });
})();
