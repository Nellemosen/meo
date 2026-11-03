/* ==========================================================================
   combat/threat.js – Threat tables, taunt and victim selection
   mob.threat = Map(entityId → threat). Damage gives 1 per point of damage (× ability
   multiplier × class threatMod), healing gives 0.5 per heal split among the enemies.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  const Threat = (MEO.Threat = {
    add(mob, src, amount) {
      if (!mob || !src || mob === src || !(amount > 0)) return;
      mob.threat.set(src.id, (mob.threat.get(src.id) || 0) + amount);
    },

    get(mob, src) {
      return mob.threat.get(src.id) || 0;
    },

    max(mob) {
      let m = 0;
      mob.threat.forEach(function (v) {
        if (v > m) m = v;
      });
      return m;
    },

    /** Removes dead/vanished entities from the table. */
    prune(mob) {
      const E = MEO.Entities;
      mob.threat.forEach(function (v, id) {
        const e = E.get(id);
        if (!e || !e.alive) mob.threat.delete(id);
      });
      if (mob.forced && (!mob.forced.e.alive || MEO.Engine.time >= mob.forced.until)) mob.forced = null;
    },

    /** Who is attacking the enemy right now? (taunt wins, otherwise highest threat) */
    victim(mob) {
      const now = MEO.Engine.time;
      if (mob.forced && mob.forced.e.alive && now < mob.forced.until) return mob.forced.e;
      let best = null;
      let bestV = -1;
      const E = MEO.Entities;
      mob.threat.forEach(function (v, id) {
        const e = E.get(id);
        if (e && e.alive && v > bestV) {
          best = e;
          bestV = v;
        }
      });
      return best;
    },

    /** Taunt: puts src's threat at the top and forces the enemy for duration sec. */
    taunt(mob, src, duration) {
      if (!mob || !src) return;
      const top = Threat.max(mob);
      mob.threat.set(src.id, Math.max(mob.threat.get(src.id) || 0, top) + 1);
      mob.forced = { e: src, until: MEO.Engine.time + (duration || 4) };
      MEO.Combat.engage(src, mob);
    },

    clear(mob) {
      mob.threat.clear();
      mob.forced = null;
    },

    /** Is there any living enemy that has this entity on its threat table? */
    engagedBy(entity) {
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.type === 'mob' && m.alive && m.threat.has(entity.id)) return true;
      }
      return false;
    },

    /** Sorted list for debug/UI. */
    list(mob) {
      const out = [];
      const E = MEO.Entities;
      mob.threat.forEach(function (v, id) {
        const e = E.get(id);
        if (e) out.push({ entity: e, threat: v });
      });
      out.sort(function (a, b) {
        return b.threat - a.threat;
      });
      return out;
    }
  });
})();
