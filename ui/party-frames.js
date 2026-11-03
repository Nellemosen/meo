/* ==========================================================================
   ui/party-frames.js – Party frames (health, resource, debuffs, casting) and
   command buttons (stance, attack my target, regroup). Click a frame to target.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;

  const ROLE_ICON = { tank: '⛨', heal: '✚', dps: '⚔', support: '✦' };

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const PF = (MEO.PartyFrames = {
    root: null,
    rows: [],
    btns: {},
    _cache: {},

    init() {
      const hud = document.getElementById('hud');
      PF.root = el('div', 'party', hud);
      PF.root.id = 'hud-party';
      PF.root.hidden = true;

      const cmd = el('div', 'party-cmd', PF.root);
      PF.btns.stance = el('button', 'pc', cmd);
      PF.btns.attack = el('button', 'pc', cmd, 'Attack');
      PF.btns.regroup = el('button', 'pc', cmd, 'Regroup');
      PF.btns.attack.title = 'Companions attack your target (R)';
      PF.btns.regroup.title = 'Call your companions to your side (V)';
      PF.btns.stance.title = 'Cycle companion stance (G)';
      PF.btns.stance.type = PF.btns.attack.type = PF.btns.regroup.type = 'button';
      PF.btns.stance.addEventListener('click', function () {
        MEO.Party.cycleStance();
      });
      PF.btns.attack.addEventListener('click', function () {
        MEO.Party.attackTarget();
      });
      PF.btns.regroup.addEventListener('click', function () {
        MEO.Party.regroup();
      });
      // keep the canvas from seeing clicks on the buttons
      PF.root.addEventListener('mousedown', function (e) {
        e.stopPropagation();
      });

      MEO.Events.on('party:change', PF.rebuild);
    },

    rebuild() {
      PF.rows.forEach(function (r) {
        r.box.remove();
      });
      PF.rows = [];
      PF._cache = {};
      const members = MEO.Party.members;
      PF.root.hidden = !members.length;
      const cmd = PF.root.querySelector('.party-cmd');
      members.forEach(function (m, i) {
        const box = el('div', 'pm');
        PF.root.insertBefore(box, cmd);
        const head = el('div', 'pm-head', box);
        const icon = el('span', 'pm-icon', head, ROLE_ICON[MEO.Classes[m.classId].arch] || '?');
        icon.style.color = MEO.Classes[m.classId].color;
        const name = el('span', 'pm-name', head, m.name);
        const key = el('span', 'pm-key', head, 'F' + (i + 2));
        const state = el('span', 'pm-state', head);
        const hp = el('div', 'bar hp sm', box);
        const hpFill = el('div', 'fill', hp);
        const hpTxt = el('div', 'txt', hp);
        const res = el('div', 'bar res sm ' + (m.stats.resType === 'mana' ? 'mana' : m.stats.resType === 'focus' ? 'focus' : ''), box);
        const resFill = el('div', 'fill', res);
        const buffs = el('div', 'pm-buffs', box);
        box.style.borderLeftColor = MEO.Classes[m.classId].color;
        box.addEventListener('click', function () {
          MEO.Targeting.set(m);
        });
        PF.rows.push({ m: m, box: box, name: name, state: state, hpFill: hpFill, hpTxt: hpTxt, resFill: resFill, buffs: buffs, key: key });
        void key;
      });
    },

    _set(key, node, text) {
      if (PF._cache[key] !== text) {
        PF._cache[key] = text;
        node.textContent = text;
      }
    },

    _width(key, node, pct) {
      const v = Math.round(U.clamp(pct, 0, 1) * 1000) / 10 + '%';
      if (PF._cache[key] !== v) {
        PF._cache[key] = v;
        node.style.width = v;
      }
    },

    render() {
      const P = MEO.Party;
      if (!PF.rows.length) return;
      const tgt = MEO.Targeting.target;
      const hudHidden = MEO.Game && MEO.Game.state === 'menu';
      PF.root.style.visibility = hudHidden ? 'hidden' : 'visible';

      for (let i = 0; i < PF.rows.length; i++) {
        const r = PF.rows[i];
        const m = r.m;
        const k = 'm' + i;
        r.box.classList.toggle('dead', !m.alive);
        r.box.classList.toggle('sel', tgt === m);
        r.box.classList.toggle('combat', m.alive && m.inCombat);
        PF._width(k + 'hp', r.hpFill, m.alive ? m.hpPct : 0);
        PF._set(k + 'hpt', r.hpTxt, m.alive ? Math.round(m.stats.hp) + ' / ' + m.stats.maxHp : 'Fallen');
        PF._width(k + 'res', r.resFill, m.alive && m.stats.maxRes ? m.stats.res / m.stats.maxRes : 0);

        let st = '';
        if (!m.alive) st = 'returns in ' + Math.ceil(P.reviveIn(m)) + 's';
        else if (m.cast) st = m.cast.def.name + '…';
        else if (MEO.Buffs.has(m, 'stun')) st = 'Stunned';
        PF._set(k + 'st', r.state, st);

        // harmful effects (max 4)
        let sig = '';
        const shown = [];
        for (let b = 0; b < m.buffs.length && shown.length < 4; b++) {
          if (m.buffs[b].def.harmful) {
            shown.push(m.buffs[b]);
            sig += m.buffs[b].id + ',';
          }
        }
        if (PF._cache[k + 'bf'] !== sig) {
          PF._cache[k + 'bf'] = sig;
          r.buffs.textContent = '';
          shown.forEach(function (bf) {
            const s = el('span', 'pm-debuff', r.buffs, bf.def.icon);
            s.style.color = bf.def.color;
            s.title = bf.def.name;
          });
        }
      }

      PF._set('stance', PF.btns.stance, P.STANCE_NAMES[P.stance]);
      PF.btns.stance.title = P.STANCE_HELP[P.stance] + ' (click or G to change)';
    }
  });
})();
