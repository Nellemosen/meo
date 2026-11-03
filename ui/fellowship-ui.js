/* ==========================================================================
   ui/fellowship-ui.js – Panel for Fellowship manoeuvres: hint, timer and
   three answer buttons (keys Z / X / H by default, or click).
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

  const UI = (MEO.FellowshipUI = {
    els: {},
    init() {
      const E = UI.els;
      E.box = el('div', 'frame', document.getElementById('hud'));
      E.box.id = 'fm-panel';
      E.box.hidden = true;
      E.title = el('div', 'fm-title', E.box);
      E.hint = el('div', 'fm-hint', E.box);
      const bar = el('div', 'fm-bar', E.box);
      E.fill = el('div', 'fm-fill', bar);
      E.btns = el('div', 'fm-btns', E.box);
      E.box.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      Events.on('fm:start', function (a) { UI._show(a); });
      Events.on('fm:end', function () { E.box.hidden = true; });
      MEO.Engine.addRender(function () { UI._tick(); }, 50);
    },

    _show(a) {
      const E = UI.els;
      const kl = function (act) {
        return MEO.Input.keyLabel((MEO.Input.binds[act] || [])[0]) || '';
      };
      E.title.textContent = 'Fellowship manoeuvre: ' + a.def.name;
      E.hint.textContent = a.def.hint;
      E.btns.textContent = '';
      ['strike', 'guard', 'rally'].forEach(function (c, i) {
        const info = MEO.FM_CHOICES[c];
        const b = el('button', 'fm-btn', E.btns);
        b.type = 'button';
        b.style.borderColor = info.color;
        el('span', 'fm-ico', b, info.icon);
        el('span', 'fm-nm', b, a.def.names[c]);
        el('span', 'fm-key', b, kl('fm' + (i + 1)));
        b.title = info.name + ': ' + info.desc;
        b.addEventListener('click', function () { MEO.Fm.choose(c); });
      });
      E.box.hidden = false;
    },

    _tick() {
      const a = MEO.Fm && MEO.Fm.active;
      if (!a || UI.els.box.hidden) return;
      const f = Math.max(0, Math.min(1, (a.end - MEO.Engine.time) / (a.end - a.start)));
      UI.els.fill.style.width = f * 100 + '%';
    }
  });
})();
