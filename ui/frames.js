/* ==========================================================================
   ui/frames.js – Target frame, target-of-target, buff rows and cast bar
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Color by level difference (as in WoW: grey / green / yellow / orange / red). */
  function levelColor(diff) {
    if (diff <= -6) return '#9a9a9a';
    if (diff <= -3) return '#5fcf5f';
    if (diff <= 2) return '#f1d44a';
    if (diff <= 4) return '#f19a3a';
    return '#ef4a3a';
  }

  function fmtTime(s) {
    if (s >= 60) return Math.ceil(s / 60) + 'm';
    if (s >= 10) return Math.ceil(s) + '';
    return s.toFixed(1);
  }

  const Frames = (MEO.Frames = {
    els: {},
    _cache: {},
    _rows: {},

    init() {
      const root = document.getElementById('hud');
      const E = Frames.els;

      // ---- Target frame ----
      E.target = el('div', 'frame', root);
      E.target.id = 'hud-target';
      E.target.hidden = true;
      const head = el('div', 'tf-head', E.target);
      E.tName = el('span', 'tf-name', head);
      E.tLvl = el('span', 'tf-lvl', head);
      E.tHpBar = el('div', 'bar hp', E.target);
      E.tHpFill = el('div', 'fill', E.tHpBar);
      E.tHpTxt = el('div', 'txt', E.tHpBar);
      E.tResBar = el('div', 'bar res', E.target);
      E.tResFill = el('div', 'fill', E.tResBar);
      E.tResTxt = el('div', 'txt', E.tResBar);
      E.tBuffs = el('div', 'buffrow', E.target);

      E.tCast = el('div', 'tf-cast', E.target);
      E.tCast.hidden = true;
      E.tCastFill = el('div', 'fill', E.tCast);
      E.tCastTxt = el('div', 'txt', E.tCast);

      // ---- Target of target ----
      E.tot = el('div', 'frame', root);
      E.tot.id = 'hud-tot';
      E.tot.hidden = true;
      E.totName = el('div', 'tot-name', E.tot);
      E.totBar = el('div', 'bar hp thin', E.tot);
      E.totFill = el('div', 'fill', E.totBar);

      // ---- Player buffs ----
      E.pBuffs = el('div', 'buffrow', root);
      E.pBuffs.id = 'hud-pbuffs';

      // ---- Cast bar (player) ----
      E.cast = el('div', 'frame', root);
      E.cast.id = 'hud-cast';
      E.cast.hidden = true;
      E.castFill = el('div', 'fill', E.cast);
      E.castName = el('div', 'txt', E.cast);
      E.castTime = el('div', 'time', E.cast);

      // ---- Combat marker ----
      E.combat = el('div', '', root);
      E.combat.id = 'hud-combat';
      E.combat.textContent = '⚔';
      E.combat.hidden = true;
    },

    _text(key, node, text) {
      if (Frames._cache[key] !== text) {
        Frames._cache[key] = text;
        node.textContent = text;
      }
    },

    _width(key, node, pct) {
      const v = Math.round(U.clamp(pct, 0, 1) * 1000) / 10 + '%';
      if (Frames._cache[key] !== v) {
        Frames._cache[key] = v;
        node.style.width = v;
      }
    },

    /** Draws buff icons in a container; only rebuilds when the list changes. */
    _buffs(key, container, entity) {
      const buffs = entity ? entity.buffs : [];
      let sig = entity ? entity.id + ':' : '-';
      for (let i = 0; i < buffs.length; i++) sig += buffs[i].id + buffs[i].stacks + ',';
      let row = Frames._rows[key];
      if (!row || row.sig !== sig) {
        container.textContent = '';
        row = { sig: sig, items: [] };
        Frames._rows[key] = row;
        for (let i = 0; i < buffs.length; i++) {
          const b = buffs[i];
          const icon = el('div', 'buff ' + (b.def.harmful ? 'bad' : 'good'), container);
          icon.style.color = b.def.color;
          icon.title = b.def.name;
          el('span', 'g', icon, b.def.icon);
          const tm = el('span', 't', icon);
          row.items.push({ b: b, tm: tm, last: '' });
        }
      }
      const now = MEO.Engine.time;
      for (let i = 0; i < row.items.length; i++) {
        const it = row.items[i];
        const left = it.b.end - now;
        const txt = left > 0 && left < 3600 ? fmtTime(left) : '';
        if (txt !== it.last) {
          it.last = txt;
          it.tm.textContent = txt;
        }
      }
    },

    render() {
      const E = Frames.els;
      const p = MEO.Game && MEO.Game.player;
      if (!p) return;
      const T = MEO.Targeting;
      const t = T.target;

      // ---- Target frame ----
      if (!t) {
        E.target.hidden = true;
        E.tot.hidden = true;
      } else {
        E.target.hidden = false;
        const hostile = t.faction === 'hostile';
        Frames._text('tn', E.tName, t.name);
        Frames._text('tl', E.tLvl, t.alive ? String(t.level) : '☠');
        E.tLvl.style.color = hostile ? levelColor(t.level - p.level) : '#cfe8ff';
        E.tName.style.color = hostile ? '#ff9d8a' : t.faction === 'friendly' ? '#f6e7a6' : '#e8f4ff';

        const s = t.stats;
        Frames._width('thw', E.tHpFill, s.maxHp ? s.hp / s.maxHp : 0);
        Frames._text('tht', E.tHpTxt, t.alive ? Math.ceil(s.hp) + ' / ' + s.maxHp : 'Dead');

        const hasRes = s.resType && s.resType !== 'none' && s.maxRes > 0;
        E.tResBar.style.display = hasRes ? '' : 'none';
        if (hasRes) {
          if (Frames._cache.trt !== s.resType) {
            Frames._cache.trt = s.resType;
            E.tResBar.className = 'bar res ' + s.resType;
          }
          Frames._width('trw', E.tResFill, s.res / s.maxRes);
          Frames._text('trx', E.tResTxt, Math.floor(s.res) + ' / ' + s.maxRes);
        }

        Frames._buffs('target', E.tBuffs, t);

        // cast bar below the target frame
        if (t.cast) {
          E.tCast.hidden = false;
          const c = t.cast;
          Frames._width('tcw', E.tCastFill, (MEO.Engine.time - c.start) / (c.end - c.start));
          Frames._text('tcn', E.tCastTxt, c.def.name);
        } else {
          E.tCast.hidden = true;
        }

        // target of target
        const tt = T.targetOfTarget();
        if (tt && tt !== t) {
          E.tot.hidden = false;
          Frames._text('ttn', E.totName, tt.name);
          Frames._width('ttw', E.totFill, tt.stats.maxHp ? tt.stats.hp / tt.stats.maxHp : 0);
        } else {
          E.tot.hidden = true;
        }
      }

      // ---- Player buffs ----
      Frames._buffs('player', E.pBuffs, p);

      // ---- Cast bar ----
      if (p.cast) {
        const c = p.cast;
        const now = MEO.Engine.time;
        E.cast.hidden = false;
        Frames._width('cw', E.castFill, (now - c.start) / (c.end - c.start));
        Frames._text('cn', E.castName, c.def.name);
        Frames._text('ct', E.castTime, Math.max(0, c.end - now).toFixed(1));
      } else {
        E.cast.hidden = true;
      }

      E.combat.hidden = !p.inCombat;
    }
  });
})();
