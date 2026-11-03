/* ==========================================================================
   systems/fellowship.js – Runs Fellowship manoeuvres (data/fellowship.js).
   Triggers: ability with `fm` (needs an enemy target), or random in tough
   fights. One manoeuvre at a time, shared cooldown. UI: ui/fellowship-ui.js.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const Events = MEO.Events;

  const WINDOW = 9;        // seconds to decide
  const COOLDOWN = 28;     // between manoeuvres
  const RANDOM_CHANCE = 0.05; // per second in a tough fight, once the cooldown is over

  const FM = (MEO.Fm = {
    active: null,          // { id, def, target, start, end, choice }
    lastEnd: -999,
    enabled: true,

    /** Start a manoeuvre. Returns true if it started. */
    start(id, target) {
      const p = MEO.Game.player;
      const now = MEO.Engine.time;
      if (!FM.enabled || FM.active || !p.alive || now - FM.lastEnd < COOLDOWN) return false;
      if (!MEO.Party.active || MEO.Party.members.filter(function (m) { return m.alive; }).length < 1) return false;
      if (!target || !target.alive) return false;
      const keys = Object.keys(MEO.FELLOWSHIP);
      if (!id || !MEO.FELLOWSHIP[id]) id = keys[Math.floor(Math.random() * keys.length)];
      FM.active = { id: id, def: MEO.FELLOWSHIP[id], target: target, start: now, end: now + WINDOW, choice: null };
      MEO.log('Fellowship manoeuvre: ' + FM.active.def.name + ' – ' + FM.active.def.hint, 'hint');
      Events.emit('fm:start', FM.active);
      return true;
    },

    /** The player answers (or the time ran out: choice = null). */
    choose(choice) {
      const a = FM.active;
      if (!a || a.choice) return false;
      if (!MEO.FM_CHOICES[choice]) return false;
      a.choice = choice;
      FM._resolve(a);
      return true;
    },

    _resolve(a) {
      const P = MEO.Party;
      const p = MEO.Game.player;
      const C = MEO.Combat;
      const group = [p].concat(P.members.filter(function (m) { return m.alive; }));
      const t = a.target && a.target.alive ? a.target : p.target;
      const perfect = a.choice === a.def.best;
      const used = {};

      // Companions answer too: tank guards, healer and support rally, damage dealers strike
      P.members.forEach(function (m) {
        if (!m.alive) return;
        const arch = MEO.Classes[m.classId].arch;
        const pick = arch === 'tank' ? 'guard' : arch === 'dps' ? 'strike' : 'rally';
        used[pick] = true;
        FM._apply(pick, m, group, t, false);
      });
      if (a.choice) {
        used[a.choice] = true;
        FM._apply(a.choice, p, group, t, perfect);
      }

      const kinds = Object.keys(used).length;
      let msg;
      if (!a.choice) msg = 'The moment passes. Only your companions react.';
      else if (perfect) msg = 'Perfect! ' + MEO.FM_CHOICES[a.choice].name + ' was exactly right.';
      else msg = 'You chose ' + MEO.FM_CHOICES[a.choice].name + '. It helps, but it was not the best answer.';
      if (a.choice && kinds === 3) msg += ' The whole company works together!';
      MEO.log('Fellowship manoeuvre: ' + msg, 'levelup');
      if (MEO.CombatText) MEO.CombatText.text(p, a.choice ? (perfect ? 'Perfect!' : MEO.FM_CHOICES[a.choice].name) : 'Missed', perfect ? '#ffe58a' : '#c8c8d0', { size: 18, up: 1.1, life: 1.6 });
      if (a.choice && kinds === 3) FM._bonusAll(group, p);
      FM.lastEnd = MEO.Engine.time;
      Events.emit('fm:end', { manoeuvre: a, perfect: perfect });
      FM.active = null;
    },

    /** One entity answers. `big` = full-strength version (player, perfect read). */
    _apply(choice, who, group, t, big) {
      const C = MEO.Combat;
      if (choice === 'strike') {
        if (t && t.alive) C.hit(who, t, { base: big ? 24 : 8, coef: big ? 2.2 : 0.8, school: 'physical', noCrit: false, threatMult: 0.5 });
        if (who === MEO.Game.player) group.forEach(function (m) { MEO.Buffs.apply(m, big ? 'fm_strike_big' : 'fm_strike', who); });
      } else if (choice === 'guard') {
        const pct = big ? 0.35 : 0.1;
        group.forEach(function (m) {
          C.heal(who, m, { base: m.stats.maxHp * pct, coef: 0, noCrit: true });
          if (who === MEO.Game.player) MEO.Buffs.apply(m, big ? 'fm_guard_big' : 'fm_guard', who);
        });
      } else if (choice === 'rally') {
        const pct = big ? 0.5 : 0.15;
        group.forEach(function (m) {
          const s = m.stats;
          if (s.resType === 'fury') s.res = Math.min(s.maxRes, s.res + (big ? 40 : 12));
          else if (s.maxRes) s.res = Math.min(s.maxRes, s.res + s.maxRes * pct);
          if (who === MEO.Game.player) MEO.Buffs.apply(m, big ? 'fm_rally_big' : 'fm_rally', who);
        });
      }
    },

    /** Everybody picked something different: a little extra for the group. */
    _bonusAll(group, p) {
      group.forEach(function (m) {
        MEO.Combat.heal(p, m, { base: m.stats.maxHp * 0.1, coef: 0, noCrit: true });
      });
    },

    // ---- per frame -------------------------------------------------------------------
    update(dt) {
      const p = MEO.Game.player;
      const now = MEO.Engine.time;
      const a = FM.active;
      if (a) {
        if (!p.alive || !a.target.alive && !p.target) {
          FM.active = null;
          FM.lastEnd = now;
          Events.emit('fm:end', { manoeuvre: a, cancelled: true });
          return;
        }
        const I = MEO.Input;
        if (I.wasPressed('fm1')) FM.choose('strike');
        else if (I.wasPressed('fm2')) FM.choose('guard');
        else if (I.wasPressed('fm3')) FM.choose('rally');
        else if (now >= a.end) {
          a.choice = null;
          FM._resolve(a);
        }
        return;
      }
      // random trigger in a real fight
      if (!p.inCombat || now - FM.lastEnd < COOLDOWN || !p.alive) return;
      const t = p.target;
      if (t && t.alive && t.type === 'mob' && t.def && !t.isStatic && (t.rank === 'boss' || t.rank === 'rare' || t.level >= p.level - 1 || t.stats.maxHp > p.stats.maxHp)) {
        if (Math.random() < RANDOM_CHANCE * dt) FM.start(null, t);
      }
    }
  });

  Events.on('ability:used', function (e) {
    if (e.entity === MEO.Game.player && e.def.fm && e.target && e.target.type === 'mob') FM.start(e.def.fm, e.target);
  });
  // fm abilities with a friendly/self target use the current enemy
  Events.on('ability:used', function (e) {
    const p = MEO.Game.player;
    if (e.entity === p && e.def.fm && !(e.target && e.target.type === 'mob') && p.target && p.target.type === 'mob') FM.start(e.def.fm, p.target);
  });
  Events.on('class:change', function () {
    FM.active = null;
    FM.lastEnd = -999;
  });
})();
