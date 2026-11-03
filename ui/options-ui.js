/* ==========================================================================
   ui/options-ui.js – Options window: Controls (keybinds), Graphics, Audio,
   Gameplay, Interface and Accessibility. Opened from the pause menu, the start
   screen or with the 'toggleOptions' key (default O).
   Settings live in systems/settings.js, key handling in core/input.js.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const TABS = [
    ['controls', 'Controls'], ['graphics', 'Graphics'], ['audio', 'Audio'],
    ['gameplay', 'Gameplay'], ['interface', 'Interface'], ['access', 'Accessibility']
  ];

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const UI = (MEO.OptionsUI = {
    root: null,
    body: null,
    note: null,
    tab: 'controls',
    capturing: null,

    init() {
      const r = (UI.root = el('div', 'overlay options', document.body));
      r.id = 'options-screen';
      r.hidden = true;
      const card = el('div', 'card opt-card', r);
      const head = el('div', 'opt-head', card);
      el('h2', '', head, 'Options');
      const x = el('button', 'win-x', head, '×');
      x.type = 'button';
      x.addEventListener('click', UI.toggle);
      UI.tabs = el('div', 'opt-tabs', card);
      TABS.forEach(function (t) {
        const b = el('button', 'opt-tab', UI.tabs, t[1]);
        b.type = 'button';
        b.dataset.tab = t[0];
        b.addEventListener('click', function () {
          UI.show(t[0]);
        });
      });
      UI.note = el('div', 'opt-note', card, '');
      UI.body = el('div', 'opt-body', card);
      const foot = el('div', 'opt-foot', card);
      const reset = el('button', 'btn secondary', foot, 'Reset this tab');
      reset.type = 'button';
      reset.addEventListener('click', UI.resetTab);
      const done = el('button', 'btn', foot, 'Close');
      done.type = 'button';
      done.addEventListener('click', UI.toggle);
      UI.show('controls');
    },

    toggle() {
      const open = UI.root.hidden;
      if (!open && UI.capturing) UI.cancelCapture();
      if (open && MEO.Game.state === 'playing') MEO.Game.togglePause();
      UI.root.hidden = !open;
      if (open) UI.show(UI.tab);
    },

    closeTop() {
      if (!UI.root || UI.root.hidden) return false;
      UI.toggle();
      return true;
    },

    setNote(text, bad) {
      UI.note.textContent = text || '';
      UI.note.classList.toggle('bad', !!bad);
    },

    show(tab) {
      UI.tab = tab;
      UI.setNote('');
      Array.prototype.forEach.call(UI.tabs.children, function (b) {
        b.classList.toggle('on', b.dataset.tab === tab);
      });
      UI.body.textContent = '';
      if (tab === 'controls') UI._controls();
      else if (tab === 'audio') UI._audio();
      else UI._settings(tab);
    },

    // ---- Controls -----------------------------------------------------------
    _controls() {
      const I = MEO.Input;
      el('p', 'opt-help', UI.body, 'Click a key box, then press the new key (Shift/Ctrl/Alt combinations work). Backspace clears a box, Esc cancels. A key that is already used is moved to the new action.');
      I.ACTIONS.forEach(function (g) {
        el('h3', 'opt-group', UI.body, g[0]);
        g[1].forEach(function (a) {
          const row = el('div', 'opt-row', UI.body);
          el('span', 'opt-label', row, a[1]);
          const keys = el('span', 'opt-keys', row);
          for (let slot = 0; slot < 2; slot++) {
            const code = (I.binds[a[0]] || [])[slot];
            const b = el('button', 'opt-key' + (code ? '' : ' empty'), keys, code ? I.keyLabel(code) : '—');
            b.type = 'button';
            b.addEventListener('click', function () {
              UI.startCapture(a[0], slot, b);
            });
          }
          const r = el('button', 'opt-reset', row, '↺');
          r.type = 'button';
          r.title = 'Reset to default';
          r.addEventListener('click', function () {
            I.resetAction(a[0]);
            UI._bindsChanged();
            UI.show('controls');
          });
        });
      });
    },

    startCapture(action, slot, btn) {
      if (UI.capturing) UI.cancelCapture();
      UI.capturing = btn;
      btn.textContent = 'Press a key…';
      btn.classList.add('wait');
      MEO.Input.capture(function (code) {
        UI.capturing = null;
        if (code === null) {
          UI.show('controls');
          return;
        }
        const I = MEO.Input;
        if (code === 'Backspace' || code === 'Delete') {
          I.clearSlot(action, slot);
          UI.show('controls');
          UI._bindsChanged();
          UI.setNote('Key cleared.');
          return;
        }
        const moved = I.bindKey(action, slot, code);
        UI._bindsChanged();
        UI.show('controls');
        const names = moved.map(UI._actionLabel);
        UI.setNote(I.keyLabel(code) + ' bound.' + (names.length ? ' Removed from: ' + names.join(', ') + '.' : ''), names.length > 0);
      });
    },

    cancelCapture() {
      MEO.Input._cap = null;
      UI.capturing = null;
    },

    _actionLabel(id) {
      let out = id;
      MEO.Input.ACTIONS.forEach(function (g) {
        g[1].forEach(function (a) {
          if (a[0] === id) out = a[1];
        });
      });
      return out;
    },

    _bindsChanged() {
      MEO.Settings.save();
      Events.emit('binds:change');
      if (MEO.HUD && MEO.HUD.refreshBar) MEO.HUD.refreshBar();
    },

    // ---- Audio -----------------------------------------------------------------
    _audio() {
      const A = MEO.Audio;
      [['master', 'Master volume'], ['sfx', 'Effects volume'], ['music', 'Music volume']].forEach(function (p) {
        const row = el('div', 'opt-row', UI.body);
        el('span', 'opt-label', row, p[1]);
        const val = el('span', 'opt-val', row, Math.round(A.vol[p[0]] * 100) + '%');
        const inp = el('input', 'opt-range', row);
        inp.type = 'range';
        inp.min = 0;
        inp.max = 100;
        inp.value = Math.round(A.vol[p[0]] * 100);
        inp.addEventListener('input', function () {
          A.ensure();
          A.setVol(p[0], inp.value / 100);
          val.textContent = inp.value + '%';
        });
        inp.addEventListener('change', function () {
          A.sfx('click');
        });
      });
      const row = el('label', 'opt-row opt-toggle', UI.body);
      el('span', 'opt-label', row, 'Mute all sound');
      const cb = el('input', '', row);
      cb.type = 'checkbox';
      cb.checked = A.muted;
      cb.addEventListener('change', function () {
        A.setMuted(cb.checked);
      });
    },

    // ---- Generic settings tabs ------------------------------------------------
    _settings(tab) {
      const S = MEO.Settings;
      Object.keys(S.DEFS).forEach(function (key) {
        const d = S.DEFS[key];
        if (d.tab !== tab) return;
        const row = el(d.type === 'toggle' ? 'label' : 'div', 'opt-row' + (d.type === 'toggle' ? ' opt-toggle' : ''), UI.body);
        el('span', 'opt-label', row, d.label);
        if (d.type === 'toggle') {
          const cb = el('input', '', row);
          cb.type = 'checkbox';
          cb.checked = !!S.get(key);
          cb.addEventListener('change', function () {
            S.set(key, cb.checked);
          });
        } else if (d.type === 'select') {
          const sel = el('select', 'opt-select', row);
          d.options.forEach(function (o) {
            const op = el('option', '', sel, o[1]);
            op.value = o[0];
          });
          sel.value = S.get(key);
          sel.addEventListener('change', function () {
            S.set(key, sel.value);
          });
        } else {
          const val = el('span', 'opt-val', row, S.get(key) + (d.unit || ''));
          const inp = el('input', 'opt-range', row);
          inp.type = 'range';
          inp.min = d.min;
          inp.max = d.max;
          inp.step = d.step;
          inp.value = S.get(key);
          inp.addEventListener('input', function () {
            val.textContent = inp.value + (d.unit || '');
          });
          inp.addEventListener('change', function () {
            S.set(key, Number(inp.value));
          });
        }
        if (d.help) el('div', 'opt-sub', UI.body, d.help);
      });
    },

    resetTab() {
      const S = MEO.Settings;
      if (UI.tab === 'controls') {
        MEO.Input.resetBinds();
        UI._bindsChanged();
      } else if (UI.tab === 'audio') {
        MEO.Audio.setVol('master', 0.7);
        MEO.Audio.setVol('sfx', 0.8);
        MEO.Audio.setVol('music', 0.5);
        MEO.Audio.setMuted(false);
      } else {
        Object.keys(S.DEFS).forEach(function (k) {
          if (S.DEFS[k].tab === UI.tab) S.set(k, S.DEFS[k].def);
        });
      }
      UI.show(UI.tab);
      UI.setNote('Reset to defaults.');
    }
  });
})();
