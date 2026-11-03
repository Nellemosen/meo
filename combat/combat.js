/* ==========================================================================
   combat/combat.js – Damage, healing, armor/resist, crit, combat state,
   regeneration, auto-attack and death.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;
  const Events = MEO.Events;

  MEO.SCHOOLS = {
    physical: { name: 'Physical', color: '#f4f4f4' },
    fire: { name: 'Fire', color: '#ff9a4d' },
    frost: { name: 'Frost', color: '#86d8ff' },
    arcane: { name: 'Arcane', color: '#cf9bff' },
    holy: { name: 'Holy', color: '#ffe58a' },
    shadow: { name: 'Shadow', color: '#b58be0' },
    nature: { name: 'Nature', color: '#9be67a' }
  };

  const Combat = (MEO.Combat = {
    CRIT_MULT: 1.8,
    HEAL_CRIT_MULT: 1.5,
    OOC_DELAY: 5,
    ARMOR_K: 85,
    ARMOR_C: 400,
    MAX_DR: 0.75,

    now() {
      return MEO.Engine.time;
    },

    // ---- Relations ------------------------------------------------------
    _isSide(e) {
      return e.faction === 'player' || e.faction === 'party';
    },

    /** Can a and b fight each other? */
    isEnemy(a, b) {
      if (!a || !b) return false;
      const ah = a.faction === 'hostile';
      const bh = b.faction === 'hostile';
      if (ah === bh) return false;
      return Combat._isSide(ah ? b : a);
    },

    /** Is b an ally that a can heal/buff? (player + party) */
    isFriendly(a, b) {
      return !!a && !!b && Combat._isSide(a) && Combat._isSide(b);
    },

    // ---- Stats with buff modifiers --------------------------------------
    modPct(e, key) {
      let sum = 0;
      const b = e.buffs;
      for (let i = 0; i < b.length; i++) {
        const m = b[i].def.mods && b[i].def.mods[key];
        if (m && m.pct) sum += m.pct * b[i].stacks;
      }
      if (e.traitMods && e.traitMods[key]) sum += e.traitMods[key];
      return sum;
    },

    stat(e, name) {
      let flat = 0;
      let pct = 0;
      const b = e.buffs;
      for (let i = 0; i < b.length; i++) {
        const m = b[i].def.mods && b[i].def.mods[name];
        if (m) {
          flat += (m.flat || 0) * b[i].stacks;
          pct += (m.pct || 0) * b[i].stacks;
        }
      }
      return (e.stats[name] || 0) * (1 + pct) + flat;
    },

    canAct(e) {
      return e.alive && !MEO.Buffs.has(e, 'stun') && !MEO.Buffs.has(e, 'incapacitate');
    },

    moveMult(e) {
      const B = MEO.Buffs;
      if (B.has(e, 'stun') || B.has(e, 'root') || B.has(e, 'incapacitate')) return 0;
      return U.clamp(1 + Combat.modPct(e, 'speed'), 0.25, 2.5);
    },

    // ---- Damage calculation ---------------------------------------------------
    armorReduction(armor, level) {
      const dr = armor / (armor + Combat.ARMOR_K * level + Combat.ARMOR_C);
      return U.clamp(dr, 0, Combat.MAX_DR);
    },

    /** Calculates damage without applying it. */
    calcDamage(src, tgt, o) {
      const school = o.school || 'physical';
      let raw = (o.base || 0) + (o.coef || 0) * Combat.stat(src, 'power');
      raw *= 0.92 + Math.random() * 0.16;
      raw *= 1 + Combat.modPct(src, 'damageDealt');
      raw *= Math.max(0, 1 + Combat.modPct(tgt, 'damageTaken'));
      raw *= o.mult || 1;
      // Level difference: tougher enemies hit harder, and players do less against higher-level foes
      if (!o.noScale) {
        const dl = (src.level || 1) - (tgt.level || 1);
        if (src.type === 'mob' && tgt.type !== 'mob') raw *= U.clamp(1 + 0.09 * dl, 0.5, 2.0);
        else if (src.type !== 'mob' && tgt.type === 'mob' && dl < 0) raw *= U.clamp(1 + 0.05 * dl, 0.6, 1);
      }

      let crit = false;
      if (!o.noCrit) {
        const chance = Combat.stat(src, 'crit') + (o.critBonus || 0);
        if (Math.random() < chance) {
          crit = true;
          raw *= Combat.CRIT_MULT;
        }
      }

      let dr;
      if (school === 'physical') dr = Combat.armorReduction(Combat.stat(tgt, 'armor'), tgt.level);
      else dr = U.clamp(tgt.stats.resist || 0, 0, Combat.MAX_DR);

      if (school === 'fire' && tgt.raceId) raw *= 1 - MEO.raceSpecial(tgt.raceId, 'fireResist');
      return { amount: Math.max(1, Math.round(raw * (1 - dr))), crit: crit, school: school };
    },

    /** Physical attacks can miss (5% + 2% per level the target is higher). */
    rollHit(src, tgt) {
      const miss = U.clamp(0.05 + 0.02 * (tgt.level - src.level), 0.02, 0.4);
      if (tgt.raceId && Math.random() < MEO.raceSpecial(tgt.raceId, 'dodge')) return false;
      return Math.random() >= miss;
    },

    /** Full attack: miss → damage → apply. */
    hit(src, tgt, o) {
      if (!tgt || !tgt.alive) return null;
      const school = o.school || 'physical';
      if (o.fx && o.fx.kind) Events.emit('fx', { kind: o.fx.kind, color: o.fx.color, src: src, tgt: tgt });

      if (o.canMiss && school === 'physical' && !Combat.rollHit(src, tgt)) {
        Combat.engage(src, tgt);
        Events.emit('miss', { src: src, tgt: tgt });
        return { miss: true, amount: 0 };
      }
      const r = Combat.calcDamage(src, tgt, o);
      return Combat.applyDamage(src, tgt, r.amount, {
        school: school,
        crit: r.crit,
        ability: o.ability,
        threatMult: o.threatMult == null ? 1 : o.threatMult,
        dot: !!o.dot
      });
    },

    /** Subtracts health (after absorb), grants threat, resources and checks death. */
    applyDamage(src, tgt, amount, o) {
      if (!tgt.alive || tgt.evading) return null;
      o = o || {};
      const B = MEO.Buffs;
      const afterAbsorb = B.absorb(tgt, amount);
      const absorbed = amount - afterAbsorb;
      const dealt = Math.min(afterAbsorb, tgt.stats.hp);

      tgt.stats.hp -= afterAbsorb;
      if (tgt.stats.hp < 0) tgt.stats.hp = 0;
      tgt.hitTime = performance.now() / 1000;

      Combat.engage(src, tgt);

      // Resources from taking damage (Fury)
      if (tgt.stats.resType === 'fury' && tgt.regen && tgt.regen.furyPerDmg) {
        tgt.stats.res = Math.min(tgt.stats.maxRes, tgt.stats.res + Math.min(15, afterAbsorb * tgt.regen.furyPerDmg));
      }

      // Threat
      if (src && tgt.type === 'mob' && Combat.isEnemy(src, tgt)) {
        MEO.Threat.add(tgt, src, amount * (o.threatMult == null ? 1 : o.threatMult) * (src.threatMod || 1));
      }

      if (afterAbsorb > 0) B.breakOnDamage(tgt);

      Events.emit('damage', {
        src: src, tgt: tgt, amount: afterAbsorb, absorbed: absorbed,
        school: o.school || 'physical', crit: !!o.crit, dot: !!o.dot, ability: o.ability
      });

      if (tgt.stats.hp <= 0) Combat.kill(tgt, src);
      return { amount: afterAbsorb, absorbed: absorbed, crit: !!o.crit, dealt: dealt };
    },

    heal(src, tgt, o) {
      if (!tgt || !tgt.alive) return null;
      let amount = (o.base || 0) + (o.coef || 0) * (src ? Combat.stat(src, 'power') : 0);
      amount *= (0.94 + Math.random() * 0.12) * (o.mult || 1);
      let crit = false;
      if (!o.noCrit && src && Math.random() < Combat.stat(src, 'crit')) {
        crit = true;
        amount *= Combat.HEAL_CRIT_MULT;
      }
      if (tgt.raceId) amount *= 1 + MEO.raceSpecial(tgt.raceId, 'healTaken');
      amount = Math.max(1, Math.round(amount));
      const room = tgt.stats.maxHp - tgt.stats.hp;
      const effective = Math.max(0, Math.min(amount, room));
      tgt.stats.hp += effective;

      Events.emit('heal', { src: src, tgt: tgt, amount: amount, effective: effective, crit: crit, hot: !!o.hot });

      // Healing generates threat on all enemies in combat
      if (src && effective > 0) {
        const mobs = MEO.Entities.list.filter(function (m) {
          return m.type === 'mob' && m.alive && m.inCombat;
        });
        if (mobs.length) {
          const t = (0.5 * effective * (src.threatMod || 1)) / mobs.length;
          for (let i = 0; i < mobs.length; i++) MEO.Threat.add(mobs[i], src, t);
        }
        if (tgt.inCombat) Combat.enterCombat(src);
      }
      return { amount: amount, effective: effective, crit: crit };
    },

    // ---- Combat state ------------------------------------------------------
    enterCombat(e) {
      if (!e.alive) return;
      if (!e.inCombat) {
        e.inCombat = true;
        Events.emit('combat:enter', e);
      }
      e.lastCombat = Combat.now();
    },

    leaveCombat(e) {
      if (!e.inCombat) return;
      e.inCombat = false;
      Events.emit('combat:leave', e);
    },

    engage(src, tgt) {
      if (!src || !tgt || src === tgt) return;
      Combat.enterCombat(src);
      Combat.enterCombat(tgt);
      if (tgt.type === 'mob' && Combat.isEnemy(src, tgt) && !tgt.threat.has(src.id)) {
        MEO.Threat.add(tgt, src, 1);
      }
    },

    // ---- Death ------------------------------------------------------------------
    kill(e, killer) {
      if (!e.alive) return;
      e.alive = false;
      e.stats.hp = 0;
      e.moving = false;
      e.corpse = true;
      e.deathTime = Combat.now();
      if (MEO.Abilities) MEO.Abilities.interrupt(e, 'death', true);
      MEO.Buffs.clear(e);
      e.queued = null;
      if (e.auto) e.auto.on = false;
      if (e.type === 'mob') MEO.Threat.clear(e);
      Combat.leaveCombat(e);
      Events.emit('death', { entity: e, killer: killer });
    },

    // ---- Auto-attack -----------------------------------------------------------
    startAuto(e) {
      if (!e.auto || e.auto.on) return;
      e.auto.on = true;
      Events.emit('auto:change', { entity: e, on: true });
    },

    stopAuto(e) {
      if (!e.auto || !e.auto.on) return;
      e.auto.on = false;
      Events.emit('auto:change', { entity: e, on: false });
    },

    toggleAuto(e) {
      if (e.auto && e.auto.on) Combat.stopAuto(e);
      else Combat.startAuto(e);
    },

    _auto(e, now) {
      const a = e.auto;
      if (!a || !a.on) return;
      const cfg = a.cfg;
      const t = e.target;
      if (!t || !t.alive || !Combat.isEnemy(e, t)) return;
      if (!Combat.canAct(e)) return;
      if (MEO.Buffs.has(t, 'incapacitate')) return; // do not hit a polymorphed enemy
      if (now < a.next) return;
      if (cfg.ranged && e.cast) return;

      const d = Math.hypot(t.x - e.x, t.y - e.y) - t.radius;
      if (d > cfg.range) return;
      if (!MEO.Entities.world.lineOfSight(e.x, e.y, t.x, t.y)) return;

      a.next = now + cfg.interval;
      e.facing = Math.atan2(t.y - e.y, t.x - e.x);
      const r = Combat.hit(e, t, {
        base: cfg.base, coef: cfg.coef, school: cfg.school, canMiss: true,
        threatMult: 1, fx: cfg.fx, ability: { name: cfg.name }
      });
      if (r && !r.miss && cfg.resGain && e.stats.resType === 'fury') {
        e.stats.res = Math.min(e.stats.maxRes, e.stats.res + cfg.resGain);
      }
    },

    // ---- Regeneration and combat state per step ----------------------------------
    _regen(e, dt) {
      const r = e.regen;
      const s = e.stats;
      if (!r) return;
      const ooc = !e.inCombat;
      const hpRate = ooc ? r.hpOoc : r.hpCombat;
      if (hpRate && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * hpRate * dt);
      if (s.resType && s.resType !== 'none' && s.maxRes) {
        const rate = ooc ? r.resOoc : r.resCombat;
        if (rate) s.res = U.clamp(s.res + rate * dt * (e.raceId ? 1 + MEO.raceSpecial(e.raceId, 'resRegen') : 1), 0, s.maxRes);
      }
    },

    update(dt) {
      const now = Combat.now();
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        if (e.type === 'player' || e.type === 'party') {
          if (e.inCombat) {
            if (MEO.Threat.engagedBy(e)) e.lastCombat = now;
            else if (now - e.lastCombat > Combat.OOC_DELAY) Combat.leaveCombat(e);
          }
          Combat._regen(e, dt);
        }
        Combat._auto(e, now);
      }
    }
  });

  // When a target dies, auto-attack against it stops
  Events.on('death', function (d) {
    const list = MEO.Entities.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.target === d.entity && e.auto && e.auto.on) Combat.stopAuto(e);
    }
  });
})();
