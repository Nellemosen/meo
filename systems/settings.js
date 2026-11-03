/* ==========================================================================
   systems/settings.js – Player settings: graphics, gameplay, interface, access.
   One JSON blob in localStorage ('meo.settings.v1') holds all values and the
   keybinds that differ from the defaults. Audio keeps its own store (audio.js).
   Add a setting: put it in DEFS and handle it in apply() (or read it with get()).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const KEY = 'meo.settings.v1';

  /** key → { def, tab, label, type: 'toggle'|'select'|'range', options|min/max/step, help } */
  const DEFS = {
    'gfx.engine': { def: 'three', tab: 'graphics', label: 'Graphics engine', type: 'select', options: [['three', 'three.js – PBR lighting (new)'], ['classic', 'Classic']], help: 'three.js gives physically based lighting, soft sun shadows and tone mapping, and can load glTF models. Classic is the old renderer.' },
    'gfx.quality': { def: 'high', tab: 'graphics', label: 'Render resolution', type: 'select', options: [['low', 'Low (50%)'], ['med', 'Medium (75%)'], ['high', 'High (100%)']], help: 'Lower is faster on weak graphics cards.' },
    'gfx.adaptive': { def: true, tab: 'graphics', label: 'Lower resolution automatically when slow', type: 'toggle' },
    'gfx.viewDist': { def: 'normal', tab: 'graphics', label: 'View distance', type: 'select', options: [['near', 'Near'], ['normal', 'Normal'], ['far', 'Far']] },
    'gfx.fov': { def: 53, tab: 'graphics', label: 'Field of view', type: 'range', min: 40, max: 80, step: 1, unit: '°' },
    'gfx.shadows': { def: 'on', tab: 'graphics', label: 'Shadows', type: 'select', options: [['off', 'Off'], ['on', 'On'], ['high', 'High quality']], help: 'Sun shadows from trees, buildings and characters.' },
    'gfx.post': { def: true, tab: 'graphics', label: 'Cinematic look (anti-aliasing, glow, colour grading)', type: 'toggle' },
    'gfx.effects': { def: 'full', tab: 'graphics', label: 'Particle effects', type: 'select', options: [['full', 'Full'], ['reduced', 'Reduced'], ['min', 'Minimal']] },
    'game.camSens': { def: 1, tab: 'gameplay', label: 'Camera sensitivity', type: 'range', min: 0.4, max: 2.5, step: 0.1, unit: '×' },
    'game.invertY': { def: false, tab: 'gameplay', label: 'Invert camera vertical axis', type: 'toggle' },
    'game.autoLoot': { def: false, tab: 'gameplay', label: 'Auto-loot everything', type: 'toggle', help: 'Pressing the interact key on a corpse takes all items at once.' },
    'game.difficulty': { def: 'adventure', tab: 'gameplay', label: 'Difficulty', type: 'select', options: [['story', 'Story – gentle'], ['adventure', 'Adventure (recommended)'], ['heroic', 'Heroic – a real challenge']], help: 'Enemy health and damage. Enemies also grow tougher with the size of your party, so fights are meant to be won together. Applies to newly spawned enemies.' },
    'game.pace': { def: 'calm', tab: 'gameplay', label: 'Game pace', type: 'select', options: [['calm', 'Calm (recommended)'], ['normal', 'Normal'], ['fast', 'Fast']], help: 'Monster speed, aggro range, attack rate and respawn time.' },
    'vo.enabled': { def: true, tab: 'gameplay', label: 'Voice-over for quests', type: 'toggle', help: 'Quest texts are read aloud (recorded files or the browser voice).' },
    'vo.volume': { def: 1, tab: 'gameplay', label: 'Voice-over volume', type: 'range', min: 0, max: 1, step: 0.05, unit: '' },
    'vo.lines': { def: true, tab: 'gameplay', label: 'Voice-over for idle NPC lines', type: 'toggle' },
    'game.hint': { def: true, tab: 'interface', label: 'Show key hint bar', type: 'toggle' },
    'game.combatText': { def: true, tab: 'interface', label: 'Floating combat text', type: 'toggle' },
    'game.nameplates': { def: 'all', tab: 'interface', label: 'Nameplates', type: 'select', options: [['all', 'Always'], ['combat', 'Target and combat only'], ['off', 'Off']] },
    'ui.scale': { def: 1, tab: 'interface', label: 'Interface scale', type: 'range', min: 0.75, max: 1.4, step: 0.05, unit: '×' },
    'a11y.reduceMotion': { def: false, tab: 'access', label: 'Reduce motion (no banner and warning animations)', type: 'toggle' },
    'a11y.contrast': { def: false, tab: 'access', label: 'High contrast interface', type: 'toggle' },
    'a11y.largeText': { def: false, tab: 'access', label: 'Larger text', type: 'toggle' }
  };

  const FOG = { near: 0.013, normal: 0.0085, far: 0.0052 };
  const FX_SCALE = { full: 1, reduced: 0.5, min: 0.2 };

  const Settings = (MEO.Settings = {
    DEFS: DEFS,
    values: {},
    _t: 0,

    init() {
      const q = /[?&]q=(low|med|high)/.exec(location.search);
      Settings.values = {};
      Object.keys(DEFS).forEach(function (k) {
        Settings.values[k] = DEFS[k].def;
      });
      let saved = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      } catch (err) { /* ignore */ }
      if (saved && saved.values) {
        Object.keys(saved.values).forEach(function (k) {
          if (DEFS[k] && typeof saved.values[k] === typeof DEFS[k].def) Settings.values[k] = saved.values[k];
        });
      }
      if (q) Settings.values['gfx.quality'] = q[1];
      MEO.Input.loadBinds(saved && saved.binds);
      Settings.applyAll();
      Events.emit('binds:change');
    },

    get(key) {
      return Settings.values[key];
    },

    set(key, val) {
      if (!DEFS[key]) return;
      Settings.values[key] = val;
      Settings.apply(key);
      Settings.save();
      Events.emit('settings:change', key);
    },

    save() {
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ v: 1, values: Settings.values, binds: MEO.Input.diffBinds() }));
      } catch (err) { /* ignore */ }
    },

    resetAll() {
      Object.keys(DEFS).forEach(function (k) {
        Settings.values[k] = DEFS[k].def;
      });
      Settings.applyAll();
      Settings.save();
      Events.emit('settings:change', '*');
    },

    applyAll() {
      Object.keys(DEFS).forEach(Settings.apply);
    },

    /** Turn one setting into behaviour. */
    apply(key) {
      const v = Settings.values[key];
      const R = MEO.Renderer;
      const body = document.body;
      switch (key) {
        case 'gfx.quality':
          if (R) {
            R.scale = v === 'low' ? 0.5 : v === 'med' ? 0.75 : 1;
            R._userScale = R.scale;
            if (R.canvas && R.resize) R.resize();
          }
          break;
        case 'gfx.viewDist':
          if (R) R.fogDen = FOG[v] || FOG.normal;
          break;
        case 'gfx.fov':
          if (R) R.camera.fov = (v * Math.PI) / 180;
          break;
        case 'ui.scale': {
          const hud = document.getElementById('hud');
          if (hud) {
            hud.style.transformOrigin = '0 0';
            hud.style.transform = v === 1 ? '' : 'scale(' + v + ')';
            hud.style.width = v === 1 ? '' : 100 / v + '%';
            hud.style.height = v === 1 ? '' : 100 / v + '%';
          }
          break;
        }
        case 'a11y.reduceMotion':
          body.classList.toggle('reduce-motion', !!v);
          break;
        case 'a11y.contrast':
          body.classList.toggle('hi-contrast', !!v);
          break;
        case 'a11y.largeText':
          body.classList.toggle('large-text', !!v);
          break;
        case 'game.hint': {
          const h = document.getElementById('hud-hint');
          if (h) h.style.display = v ? '' : 'none';
          break;
        }
        default:
          break;
      }
    },

    fxScale() {
      return FX_SCALE[Settings.values['gfx.effects']] || 1;
    }
  });

  // The HUD (hint bar) is created after init: re-apply interface settings once it exists
  Events.on('hud:ready', function () {
    Settings.apply('game.hint');
    Settings.apply('ui.scale');
  });
})();
