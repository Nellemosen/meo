/* ==========================================================================
   ui/traits-ui.js – Trait window (key T). Three trees side by side.
   Left-click a node: spend a point. Right-click: take a point back.
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

  const UI = (MEO.TraitsUI = {
    els: {},

    init() {
      const E = UI.els;
      const root = document.getElementById('hud');
      E.win = el('div', 'frame win', root);
      E.win.id = 'win-traits';
      E.win.hidden = true;
      const h = el('div', 'win-head', E.win);
      E.title = el('span', '', h, 'Traits');
      const x = el('button', 'win-x', h, '×');
      x.type = 'button';
      x.addEventListener('click', function () { UI.toggle(false); });
      E.info = el('div', 'tr-info', E.win);
      E.trees = el('div', 'tr-trees', E.win);
      E.msg = el('div', 'tr-msg', E.win);
      const foot = el('div', 'tr-foot', E.win);
      E.reset = el('button', 'win-btn', foot, 'Reset all points');
      E.reset.type = 'button';
      E.reset.addEventListener('click', function () {
        const p = MEO.Game.player;
        if (!MEO.Traits.reset(p)) UI._msg('Cannot reset in combat');
      });
      el('div', 'win-hint', E.win, 'Left-click: spend a point · Right-click: take a point back · Hybrid: your main tree is free, only 5 points may go elsewhere (tiers 1–2).');
      E.win.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      E.win.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      Events.on('traits:change', function () { UI.refresh(); });
      Events.on('class:change', function () { UI.refresh(); });
    },

    toggle(force) {
      if (MEO.Game.state !== 'playing' && force !== false) return;
      const E = UI.els;
      const open = force === undefined ? E.win.hidden : !!force;
      E.win.hidden = !open;
      if (open) UI.refresh();
    },

    closeTop() {
      if (!UI.els.win.hidden) {
        UI.toggle(false);
        return true;
      }
      return false;
    },

    _msg(t) {
      UI.els.msg.textContent = t || '';
    },

    refresh() {
      const E = UI.els;
      const p = MEO.Game && MEO.Game.player;
      if (!p || !E.win || E.win.hidden) return;
      const T = MEO.Traits;
      const cls = MEO.Classes[p.classId];
      const main = T.main(p, p.traits || {});
      let other = 0;
      T.trees(p.classId).forEach(function (t) {
        if (!main || t.id !== main.id) other += T.spent(p, t.id);
      });
      E.title.textContent = 'Traits – ' + cls.name + (main ? ' (' + main.name + ')' : '');
      E.info.textContent = 'Points left: ' + T.free(p) + ' / ' + T.total(p) + '   ·   Outside main tree: ' + other + ' / ' + T.HYBRID_MAX;
      E.trees.textContent = '';
      T.trees(p.classId).forEach(function (t) {
        const col = el('div', 'tr-tree' + (main && main.id === t.id ? ' main' : ''), E.trees);
        el('div', 'tr-name', col, t.name + ' – ' + MEO.ARCH_NAMES[t.role] + ' (' + T.spent(p, t.id) + ')');
        el('div', 'tr-desc', col, t.desc);
        for (let tier = 1; tier <= 4; tier++) {
          const row = el('div', 'tr-row', col);
          t.nodes.filter(function (n) { return n.tier === tier; }).forEach(function (n) {
            const r = T.rank(p, n.id);
            const why = r < n.max ? T.canAdd(p, n.id) : 'Maximum rank';
            const b = el('button', 'tr-node' + (r > 0 ? ' on' : '') + (why && r === 0 ? ' locked' : ''), row);
            b.type = 'button';
            el('span', 'tr-ico', b, n.icon);
            el('span', 'tr-nm', b, n.name);
            el('span', 'tr-rk', b, r + '/' + n.max);
            b.title = n.name + ' (rank ' + r + '/' + n.max + ')\nPer rank: ' + T.describe(n) + (why && r < n.max ? '\n— ' + why : '');
            b.addEventListener('click', function () {
              if (T.add(p, n.id)) UI._msg('');
              else UI._msg(why || '');
            });
            b.addEventListener('contextmenu', function (ev) {
              ev.preventDefault();
              if (!T.remove(p, n.id)) UI._msg('Cannot remove: other traits depend on it');
              else UI._msg('');
            });
          });
        }
      });
    }
  });
})();
