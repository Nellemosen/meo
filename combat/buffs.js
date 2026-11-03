/* ==========================================================================
   combat/buffs.js – Buffs and debuffs: duration, stacks, DoT/HoT ticks,
   absorb shields, crowd control flags and dispel.
   Definitions live in MEO.BUFFS (data/abilities-data.js).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const Buffs = (MEO.Buffs = {
    /** Apply a buff/debuff. Reapplying from the same source refreshes the duration. */
    apply(target, id, source, opts) {
      const def = MEO.BUFFS[id];
      if (!def || !target || !target.alive) return null;
      // Bosses cannot be stunned, rooted, slept or slowed
      if (target.rank === 'boss' && def.harmful && def.flags && (def.flags.indexOf('stun') >= 0 || def.flags.indexOf('root') >= 0 || def.flags.indexOf('incapacitate') >= 0)) {
        MEO.Events.emit('buff:immune', { target: target, buff: def });
        return null;
      }
      opts = opts || {};
      const now = MEO.Engine.time;
      const dur = opts.duration || def.duration;
      const power = source ? MEO.Combat.stat(source, 'power') : 0;

      let inst = null;
      for (let i = 0; i < target.buffs.length; i++) {
        const b = target.buffs[i];
        if (b.id === id && (!def.harmful || b.source === source)) {
          inst = b;
          break;
        }
      }

      if (inst) {
        inst.start = now;
        inst.end = now + dur;
        const max = def.maxStacks || 1;
        if (max > 1) inst.stacks = Math.min(max, inst.stacks + 1);
        if (def.absorb) inst.shield = def.absorb.base + def.absorb.coef * power;
        if (def.tickEffect) inst.tickAmt = def.tickEffect.base + def.tickEffect.coef * power;
        Events.emit('buff:refresh', { target: target, buff: inst, source: source });
        return inst;
      }

      inst = {
        id: id, def: def, source: source || null, stacks: 1,
        start: now, end: now + dur,
        nextTick: def.tick ? now + def.tick : Infinity,
        tickAmt: def.tickEffect ? def.tickEffect.base + def.tickEffect.coef * power : 0,
        shield: def.absorb ? def.absorb.base + def.absorb.coef * power : 0
      };
      target.buffs.push(inst);

      if (def.harmful && source) MEO.Combat.engage(source, target);
      Events.emit('buff:apply', { target: target, buff: inst, source: source });
      return inst;
    },

    remove(target, inst, reason) {
      const i = target.buffs.indexOf(inst);
      if (i < 0) return;
      target.buffs.splice(i, 1);
      Events.emit('buff:remove', { target: target, buff: inst, reason: reason || 'expire' });
    },

    removeById(target, id) {
      for (let i = target.buffs.length - 1; i >= 0; i--) {
        if (target.buffs[i].id === id) Buffs.remove(target, target.buffs[i], 'removed');
      }
    },

    clear(e) {
      for (let i = e.buffs.length - 1; i >= 0; i--) Buffs.remove(e, e.buffs[i], 'clear');
    },

    has(e, flag) {
      const b = e.buffs;
      for (let i = 0; i < b.length; i++) {
        const f = b[i].def.flags;
        if (f && f.indexOf(flag) >= 0) return true;
      }
      return false;
    },

    hasId(e, id) {
      for (let i = 0; i < e.buffs.length; i++) if (e.buffs[i].id === id) return true;
      return false;
    },

    /** Absorb shields eat damage (oldest first). Returns the damage that gets through. */
    absorb(target, amount) {
      const b = target.buffs;
      for (let i = 0; i < b.length && amount > 0; i++) {
        const s = b[i];
        if (!(s.shield > 0)) continue;
        const take = Math.min(s.shield, amount);
        s.shield -= take;
        amount -= take;
        if (s.shield <= 0.01) {
          Buffs.remove(target, s, 'absorbed');
          i--;
        }
      }
      return amount;
    },

    breakOnDamage(e) {
      for (let i = e.buffs.length - 1; i >= 0; i--) {
        if (e.buffs[i].def.breakOnDamage) Buffs.remove(e, e.buffs[i], 'broken');
      }
    },

    /** Remove up to "count" effects of the given kinds. harmful=true removes debuffs. */
    dispel(target, kinds, count, harmful) {
      let removed = 0;
      for (let i = target.buffs.length - 1; i >= 0 && removed < count; i--) {
        const b = target.buffs[i];
        if (!!b.def.harmful !== !!harmful) continue;
        if (!b.def.dispel || kinds.indexOf(b.def.dispel) < 0) continue;
        Buffs.remove(target, b, 'dispel');
        removed++;
      }
      return removed;
    },

    update() {
      const now = MEO.Engine.time;
      const list = MEO.Entities.list;
      for (let n = 0; n < list.length; n++) {
        const e = list[n];
        if (!e.alive || !e.buffs.length) continue;
        for (let i = e.buffs.length - 1; i >= 0; i--) {
          const b = e.buffs[i];
          if (!b) continue;

          let guard = 0;
          while (b.def.tick && now >= b.nextTick && now <= b.end + 0.001 && guard++ < 4) {
            b.nextTick += b.def.tick;
            Buffs._tick(e, b);
            if (!e.alive) break;
          }
          if (!e.alive) break;
          if (now >= b.end) Buffs.remove(e, b, 'expire');
        }
      }
    },

    _tick(e, b) {
      const te = b.def.tickEffect;
      if (!te) return;
      const src = b.source || e;
      if (te.type === 'damage') {
        MEO.Combat.hit(src, e, { base: b.tickAmt, coef: 0, school: te.school, dot: true, noCrit: true, threatMult: 1 });
      } else if (te.type === 'heal') {
        MEO.Combat.heal(src, e, { base: b.tickAmt, coef: 0, noCrit: true, hot: true });
      }
    }
  });
})();
