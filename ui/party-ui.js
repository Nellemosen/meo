/* ==========================================================================
   ui/party-ui.js – Party window (key P). Add or dismiss companions on the go.
   Free in towns and camps; elsewhere with a short cooldown; never in combat.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const Events = MEO.Events;
  const ROLE_ICON = { tank: '🛡', heal: '✚', dps: '⚔', support: '♪' };

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const UI = (MEO.PartyUI = {
    els: {},

    init() {
      const E = UI.els;
      E.win = el('div', 'frame win', document.getElementById('hud'));
      E.win.id = 'win-party';
      E.win.hidden = true;
      const h = el('div', 'win-head', E.win);
      E.title = el('span', '', h, 'Companions');
      const x = el('button', 'win-x', h, '×');
      x.type = 'button';
      x.addEventListener('click', function () { UI.toggle(false); });
      E.info = el('div', 'pw-info', E.win);
      E.list = el('div', 'pw-list', E.win);
      E.msg = el('div', 'pw-msg', E.win);
      const foot = el('div', 'pw-foot', E.win);
      const rec = el('button', 'win-btn', foot, 'Recommended party');
      rec.type = 'button';
      rec.addEventListener('click', function () { MEO.Party.useRecommended(); UI.refresh(); });
      const none = el('button', 'win-btn secondary', foot, 'Go solo');
      none.type = 'button';
      none.addEventListener('click', function () {
        MEO.Party.members.map(function (m) { return m.classId; }).forEach(function (id) { MEO.Party.remove(id); });
        UI.refresh();
      });
      el('div', 'win-hint', E.win, 'Recruit up to ' + MEO.Party.MAX + ' companions. Changes are free in towns and camps; elsewhere there is a ' + MEO.Party.COOLDOWN + ' s cooldown, and never in combat. Enemies scale with the size of your party.');
      E.win.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      Events.on('party:change', function () { UI.refresh(); });
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
      if (!UI.els.win.hidden) { UI.toggle(false); return true; }
      return false;
    },

    refresh() {
      const E = UI.els;
      const P = MEO.Party;
      if (E.win.hidden || !P.leader) return;
      E.info.textContent = 'Party: you + ' + P.members.length + ' of ' + P.MAX + ' companions';
      const why = P.changeBlock();
      E.msg.textContent = why || 'You may change the party now.';
      E.list.textContent = '';
      MEO.CLASS_ORDER.forEach(function (id) {
        if (id === P.leader.classId) return;
        const c = MEO.Classes[id];
        const inParty = P.has(id);
        const row = el('div', 'pw-row' + (inParty ? ' on' : ''), E.list);
        const ic = el('span', 'pw-ic', row, ROLE_ICON[c.arch] || '?');
        ic.style.color = c.color;
        el('span', 'pw-name', row, MEO.Party.NAMES[id] + ' · ' + c.name);
        el('span', 'pw-role', row, MEO.Party.ROLE_NAMES[id]);
        const b = el('button', 'win-btn', row, inParty ? 'Dismiss' : 'Recruit');
        b.type = 'button';
        b.disabled = !!why || (!inParty && P.members.length >= P.MAX);
        b.addEventListener('click', function () { if (inParty) P.remove(id); else P.add(id); UI.refresh(); });
      });
    }
  });

  // keep the cooldown text fresh while the window is open
  setInterval(function () { if (UI.els.win && !UI.els.win.hidden) UI.refresh(); }, 1000);
})();
