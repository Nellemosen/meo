/* ==========================================================================
   ui/boss-ui.js – Boss health bar (with phase markers), raid warnings and
   the ending message when the final quest is turned in.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const UI = (MEO.BossUI = {
    els: {},
    boss: null,
    _warnTimer: 0,

    init() {
      const root = document.getElementById('hud');
      const E = UI.els;
      E.frame = el('div', 'boss-frame', root);
      E.frame.hidden = true;
      E.name = el('div', 'boss-name', E.frame, '');
      const bar = el('div', 'boss-bar', E.frame);
      E.bar = bar;
      E.fill = el('div', 'boss-fill', bar);
      E.text = el('div', 'boss-hp', bar, '');
      E.marks = [];
      E.warn = el('div', 'raid-warn', root);
      E.warn.hidden = true;

      Events.on('boss:engage', function (b) {
        UI.boss = b;
        E.name.textContent = b.name + '  (' + b.level + ')  ☠';
        E.frame.hidden = false;
        E.marks.forEach(function (m) {
          m.remove();
        });
        E.marks = (b.def.boss.phases || []).map(function () {
          return el('div', 'boss-mark', E.bar);
        });
        (b.def.boss.phases || []).forEach(function (ph, i) {
          E.marks[i].style.left = ph.at * 100 + '%';
        });
      });
      const hide = function () {
        UI.boss = null;
        E.frame.hidden = true;
      };
      Events.on('boss:reset', hide);
      Events.on('boss:dead', hide);
      Events.on('boss:say', function (d) {
        if (!d.warn) return;
        UI.warn(d.text);
      });
      Events.on('quest:complete', function (q) {
        if (q.id !== 'q_warchief') return;
        MEO.log('Ostirith is silent. Tirharad is safe, for now. Thank you for playing!', 'quest');
        if (MEO.HUD) MEO.HUD.showBanner('The Tower Is Silent', 'Gorthak the Warchief has fallen');
      });
    },

    warn(text) {
      const w = UI.els.warn;
      w.textContent = text;
      w.hidden = false;
      w.classList.remove('flash');
      void w.offsetWidth;
      w.classList.add('flash');
      UI._warnTimer = 3.2;
    },

    update() {
      const E = UI.els;
      if (!E.frame) return;
      if (UI._warnTimer > 0) {
        UI._warnTimer -= 1 / 60;
        if (UI._warnTimer <= 0) E.warn.hidden = true;
      }
      const b = UI.boss;
      if (!b) return;
      const pct = Math.max(0, b.stats.hp / b.stats.maxHp);
      E.fill.style.width = pct * 100 + '%';
      E.text.textContent = Math.ceil(b.stats.hp) + ' / ' + b.stats.maxHp;
      E.frame.classList.toggle('enraged', !!(b.bs && b.bs.enraged));
    }
  });
})();
