/* ==========================================================================
   combat/abilities.js – Ability engine: GCD, cooldowns, cast time, range,
   line of sight, resources, effects and a short queue (spell queue).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;
  const Events = MEO.Events;

  const RES_NAMES = { fury: 'fury', mana: 'mana', focus: 'focus' };

  const Abilities = (MEO.Abilities = {
    GCD: 1.5,
    QUEUE_WINDOW: 0.3,

    // ---- Setting up a class on an entity -------------------------------------
    /** Base stats of a class at level L+1 (without gear). */
    _applyStats(e, cls, L) {
      const b = cls.base;
      const g = cls.growth;
      const s = e.stats;
      s.maxHp = Math.round(b.maxHp + g.maxHp * L);
      s.maxRes = Math.round(b.maxRes + g.maxRes * L);
      s.resType = cls.resType;
      s.power = b.power + g.power * L;
      s.armor = b.armor + g.armor * L;
      s.crit = b.crit + g.crit * L;
      s.resist = b.resist + g.resist * L;
    },

    /** Level change that keeps buffs, cooldowns and the class. Returns the abilities that were unlocked. */
    setLevel(e, level) {
      const cls = MEO.Classes[e.classId];
      const before = e.bar.slice();
      const hpPct = e.stats.maxHp ? e.stats.hp / e.stats.maxHp : 1;
      Abilities._applyStats(e, cls, level - 1);
      e.level = level;
      e.stats.hp = Math.max(1, Math.round(e.stats.maxHp * hpPct));
      e.stats.res = Math.min(e.stats.res || 0, e.stats.maxRes);
      e.bar = cls.abilities.filter(function (id) {
        return MEO.ABILITIES[id].level <= level;
      });
      return e.bar.filter(function (id) {
        return before.indexOf(id) < 0;
      });
    },

    setupClass(e, classId, level) {
      const cls = MEO.Classes[classId];
      if (!cls) throw new Error('Unknown class: ' + classId);
      level = level || 1;
      const L = level - 1;

      e.classId = classId;
      e.level = level;
      e.color = cls.color;
      e.trim = cls.trim;
      e.hair = cls.hair;
      e.weapon = !!cls.weapon;
      e.threatMod = cls.threatMod || 1;
      e.regen = cls.regen;

      Abilities._applyStats(e, cls, L);
      e.stats.hp = e.stats.maxHp;
      e.stats.res = cls.resType === 'fury' ? 0 : e.stats.maxRes;

      e.abilityIds = cls.abilities.slice();
      e.bar = cls.abilities.filter(function (id) {
        return MEO.ABILITIES[id].level <= level;
      });
      e.auto = { on: false, next: 0, cfg: cls.auto };
      e.cast = null;
      e.cd = {};
      e.gcdEnd = 0;
      e.queued = null;
      MEO.Buffs.clear(e);
      Events.emit('class:change', e);
    },

    // ---- Queries for the UI ------------------------------------------------------
    cooldownLeft(e, id) {
      return Math.max(0, (e.cd[id] || 0) - MEO.Engine.time);
    },

    gcdLeft(e) {
      return Math.max(0, e.gcdEnd - MEO.Engine.time);
    },

    resName(e) {
      return RES_NAMES[e.stats.resType] || 'resource';
    },

    /** Which target would the ability hit? (null = no valid target) */
    resolveTarget(e, def, opts) {
      const C = MEO.Combat;
      if (def.target === 'self') return e;
      const t = (opts && opts.target) || e.target;
      if (def.target === 'enemy') return t && t.alive && C.isEnemy(e, t) ? t : null;
      if (def.target === 'friend') return t && t.alive && C.isFriendly(e, t) ? t : e;
      return e;
    },

    /** Returns an error text, or null if everything is OK. */
    check(e, def, t) {
      if (t !== e && (def.target === 'enemy' || def.target === 'friend')) {
        const d = Math.hypot(t.x - e.x, t.y - e.y) - t.radius;
        if (d > def.range) return 'Out of range';
        const w = MEO.Entities.world;
        if (w && !w.lineOfSight(e.x, e.y, t.x, t.y)) return 'Out of line of sight';
      }
      if (def.cost > 0 && e.stats.res < Abilities.costOf(e, def)) return 'Not enough ' + Abilities.resName(e);
      return null;
    },

    /** Resource cost / cooldown after trait changes (players only). */
    costOf(e, def) {
      if (def.cost <= 0 || !e.abMods) return def.cost;
      return Math.max(1, Math.round(def.cost * (1 + MEO.Traits.ab(e, def.id, 'cost'))));
    },
    cdOf(e, def) {
      if (def.cd <= 0 || !e.abMods) return def.cd;
      return Math.max(0.5, Math.round(def.cd * (1 + MEO.Traits.ab(e, def.id, 'cd')) * 10) / 10);
    },

    /** State of an action bar button. */
    slotState(e, id) {
      const def = MEO.ABILITIES[id];
      const cdLeft = Abilities.cooldownLeft(e, id);
      const gcdLeft = def.gcd ? Abilities.gcdLeft(e) : 0;
      let noRes = def.cost > 0 && e.stats.res < Abilities.costOf(e, def);
      let oor = false;
      if (def.target === 'enemy') {
        const t = e.target;
        if (t && t.alive && MEO.Combat.isEnemy(e, t)) oor = Math.hypot(t.x - e.x, t.y - e.y) - t.radius > def.range;
      }
      return { def: def, cdLeft: cdLeft, cdTotal: Abilities.cdOf(e, def), gcdLeft: gcdLeft, noRes: noRes, oor: oor, casting: !!(e.cast && e.cast.def === def) };
    },

    /** Readable description for the tooltip. */
    describe(def, e) {
      const parts = [];
      if (def.cost > 0) parts.push((e ? Abilities.costOf(e, def) : def.cost) + ' ' + (e ? Abilities.resName(e) : 'resource'));
      else if (def.cost < 0) parts.push('Grants ' + -def.cost + ' ' + (e ? Abilities.resName(e) : 'resource'));
      if (def.range && def.target !== 'self') parts.push(Math.round(def.range / 32 * 10) / 10 + ' m');
      parts.push(def.cast > 0 ? def.cast.toFixed(1) + ' sec cast' : 'Instant');
      if (def.cd > 0) parts.push((e ? Abilities.cdOf(e, def) : def.cd) + ' sec cooldown');

      let value = '';
      if (e) {
        const power = MEO.Combat.stat(e, 'power');
        for (let i = 0; i < def.effects.length; i++) {
          const f = def.effects[i];
          if (f.type === 'damage' || f.type === 'heal') {
            const v = Math.round(f.base + f.coef * power);
            value = (f.type === 'damage' ? 'Damage approx. ' : 'Healing approx. ') + v;
            break;
          }
        }
      }
      return { meta: parts.join(' · '), value: value };
    },

    // ---- Using an ability -------------------------------------------------------------
    _fail(e, def, reason) {
      Events.emit('ability:fail', { entity: e, def: def, reason: reason });
      return false;
    },

    /** Attempt to use an ability. Returnerer true / 'queued' / false. */
    use(e, id, opts) {
      opts = opts || {};
      const def = MEO.ABILITIES[id];
      if (!def) return false;
      const C = MEO.Combat;
      const now = MEO.Engine.time;

      if (!e.alive) return false;
      if (!C.canAct(e)) return Abilities._fail(e, def, 'You cannot act');
      if (e.abilityIds.indexOf(id) < 0) return false;
      if (e.cast) return Abilities._fail(e, def, 'You are already busy');

      const cdLeft = (e.cd[id] || 0) - now;
      const gcdLeft = def.gcd ? e.gcdEnd - now : 0;
      const wait = Math.max(cdLeft, gcdLeft);
      if (wait > 0) {
        if (wait <= Abilities.QUEUE_WINDOW && opts.queue !== false) {
          e.queued = { id: id, target: opts.target || null, expires: now + Abilities.QUEUE_WINDOW };
          return 'queued';
        }
        return Abilities._fail(e, def, 'Not ready yet');
      }

      const t = Abilities.resolveTarget(e, def, opts);
      if (!t) return Abilities._fail(e, def, def.target === 'enemy' ? 'You have no enemy targeted' : 'No valid target');

      const err = Abilities.check(e, def, t);
      if (err) return Abilities._fail(e, def, err);

      if (t !== e) e.facing = Math.atan2(t.y - e.y, t.x - e.x);
      if (def.gcd) e.gcdEnd = now + Abilities.GCD * ((e.type === 'player' && MEO.EnemyAI) ? MEO.EnemyAI.pace().gcd || 1 : 1);
      e.queued = null;

      if (def.cast > 0) {
        e.cast = { def: def, target: t, start: now, end: now + def.cast };
        Events.emit('cast:start', { entity: e, cast: e.cast });
        return true;
      }
      Abilities._execute(e, def, t);
      return true;
    },

    interrupt(e, reason, silent) {
      if (!e.cast) return false;
      const c = e.cast;
      e.cast = null;
      Events.emit('cast:stop', { entity: e, cast: c, interrupted: true, reason: reason || 'Interrupted', silent: !!silent });
      return true;
    },

    // ---- Execution ---------------------------------------------------------------------
    _execute(e, def, t) {
      const now = MEO.Engine.time;
      const s = e.stats;

      if (def.cost > 0) {
        const cost = Abilities.costOf(e, def);
        if (s.res < cost) return Abilities._fail(e, def, 'Not enough ' + Abilities.resName(e));
        s.res -= cost;
      } else if (def.cost < 0) {
        s.res = Math.min(s.maxRes, s.res - def.cost);
      }
      if (def.cd > 0) e.cd[def.id] = now + Abilities.cdOf(e, def);

      // Abilities that deal damage start auto-attack (control effects like Polymorph do not)
      if (def.target === 'enemy' && e.type === 'player' && e.auto && !e.auto.on &&
          def.effects.some(function (f) { return f.type === 'damage'; })) {
        MEO.Combat.startAuto(e);
      }

      Abilities._fx(e, def, t);

      for (let i = 0; i < def.effects.length; i++) {
        const eff = def.effects[i];
        const targets = Abilities._gather(e, t, eff);
        for (let j = 0; j < targets.length; j++) {
          if (!targets[j].alive) continue;
          Abilities._applyEffect(e, def, targets[j], eff);
        }
      }
      Events.emit('ability:used', { entity: e, def: def, target: t });
    },

    _fx(e, def, t) {
      const f = def.fx;
      if (!f || f.kind === 'none') return;
      if (f.kind === 'ring') {
        const center = def.effects.some(function (x) { return x.aoe && x.aoe.around === 'target'; }) ? t : (def.target === 'enemy' ? t : e);
        Events.emit('fx', { kind: 'ring', color: f.color, x: center.x, y: center.y, radius: f.radius || 40 });
      } else {
        Events.emit('fx', { kind: f.kind, color: f.color, src: e, tgt: t });
      }
    },

    /** Finds the entities an effect hits. */
    _gather(caster, target, eff) {
      const a = eff.aoe;
      if (!a) return [eff.to === 'self' ? caster : target];
      const C = MEO.Combat;
      const center = a.around === 'target' ? target : caster;
      const wantFriends = a.affects === 'friends';
      const out = [];
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const x = list[i];
        if (!x.alive) continue;
        if (wantFriends ? !C.isFriendly(caster, x) : !C.isEnemy(caster, x)) continue;
        const d = Math.hypot(x.x - center.x, x.y - center.y) - x.radius;
        if (d <= a.radius) out.push({ e: x, d: d });
      }
      out.sort(function (p, q) {
        return p.d - q.d;
      });
      return out.slice(0, a.max || 8).map(function (o) {
        return o.e;
      });
    },

    _applyEffect(caster, def, t, eff) {
      const C = MEO.Combat;
      switch (eff.type) {
        case 'damage': {
          const school = eff.school || 'physical';
          let mult = caster.abMods ? 1 + MEO.Traits.ab(caster, def.id, 'dmg') : 1;
          if (eff.executeBelow && t.stats.hp / t.stats.maxHp <= eff.executeBelow) mult *= eff.executeMult || 2;
          C.hit(caster, t, {
            base: eff.base, coef: eff.coef, school: school, canMiss: school === 'physical',
            threatMult: eff.threatMult == null ? 1 : eff.threatMult, mult: mult, critBonus: eff.critBonus, ability: def
          });
          break;
        }
        case 'heal':
          C.heal(caster, t, { base: eff.base, coef: eff.coef, ability: def, mult: caster.abMods ? 1 + MEO.Traits.ab(caster, def.id, 'heal') : 1 });
          break;
        case 'buff':
          MEO.Buffs.apply(t, eff.buff, caster, eff.duration ? { duration: eff.duration } : undefined);
          break;
        case 'dispel':
          MEO.Buffs.dispel(t, eff.kinds, eff.count || 1, !!eff.harmful);
          break;
        case 'taunt':
          MEO.Threat.taunt(t, caster, eff.duration);
          break;
        case 'interrupt':
          Abilities.interrupt(t, 'Interrupted');
          break;
        case 'dash': {
          let ang = caster.facing;
          if (eff.dir === 'back') {
            const tg = caster.target;
            ang = tg && tg.alive ? Math.atan2(caster.y - tg.y, caster.x - tg.x) : caster.facing + Math.PI;
          }
          Events.emit('fx', { kind: 'blink', color: def.color, x: caster.x, y: caster.y });
          Abilities.dash(caster, ang, eff.dist);
          Events.emit('fx', { kind: 'blink', color: def.color, x: caster.x, y: caster.y });
          break;
        }
        default:
          break;
      }
    },

    /** Moves an entity in a direction with collision (stops at walls). */
    dash(e, angle, dist) {
      const step = 6;
      const n = Math.ceil(dist / step);
      const dx = Math.cos(angle) * step;
      const dy = Math.sin(angle) * step;
      for (let i = 0; i < n; i++) {
        const px = e.x;
        const py = e.y;
        e.moveBy(dx, dy);
        if (Math.hypot(e.x - px, e.y - py) < step * 0.4) break;
      }
      e.prevX = e.x;
      e.prevY = e.y;
    },

    // ---- Runs every logic step ---------------------------------------------------------------
    update() {
      const now = MEO.Engine.time;
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;

        const c = e.cast;
        if (c) {
          if (!MEO.Combat.canAct(e)) {
            Abilities.interrupt(e, 'Interrupted');
          } else if (e.moving && !c.def.castMoving) {
            Abilities.interrupt(e, 'Interrupted');
          } else if (c.target !== e && !c.target.alive) {
            Abilities.interrupt(e, 'Target is gone');
          } else if (now >= c.end) {
            e.cast = null;
            const err = Abilities.check(e, c.def, c.target);
            if (err) {
              Events.emit('cast:stop', { entity: e, cast: c, interrupted: true, reason: err });
              Abilities._fail(e, c.def, err);
            } else {
              Events.emit('cast:stop', { entity: e, cast: c, interrupted: false });
              if (c.target !== e) e.facing = Math.atan2(c.target.y - e.y, c.target.x - e.x);
              Abilities._execute(e, c.def, c.target);
            }
          }
        }

        const q = e.queued;
        if (q && !e.cast) {
          if (now > q.expires) {
            e.queued = null;
          } else {
            const def = MEO.ABILITIES[q.id];
            const wait = Math.max((e.cd[q.id] || 0) - now, def.gcd ? e.gcdEnd - now : 0);
            if (wait <= 0) {
              e.queued = null;
              Abilities.use(e, q.id, { target: q.target || undefined, queue: false });
            }
          }
        }
      }
    }
  });
})();
