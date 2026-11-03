/* ==========================================================================
   ai/enemy-ai.js – Enemy AI: wandering, aggro, chase, attack, specials,
   fleeing, social aggro, leash and evade.
   States: idle → wander → combat → (flee) → return → idle
   Every mob with def.speed > 0 is driven from here (Mob.update calls EnemyAI.step).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;

  const rnd = function (a, b) {
    return a + Math.random() * (b - a);
  };

  const AI = (MEO.EnemyAI = {
    THINK: 0.25,           // sec between aggro scans
    HOME_REACHED: 10,      // px
    RETURN_SPEED: 1.7,     // evade run home
    RETURN_HEAL: 0.4,      // fraction of max health per sec during evade

    init(e) {
      const now = MEO.Engine.time;
      const ai = (e.ai = {
        state: 'idle', until: now + rnd(1, 4), to: null, think: now + rnd(0, 0.25),
        fled: false, fleeUntil: 0, spCd: {}, stuck: 0, side: 0, sideUntil: 0,
        lastX: e.x, lastY: e.y, chk: now, blockT: 0
      });
      const sp = (e.def && e.def.specials) || [];
      for (let i = 0; i < sp.length; i++) ai.spCd[sp[i].name] = now + (sp[i].first || rnd(2, 5));
      return ai;
    },

    // ---- Helpers ---------------------------------------------------------
    inSafe(t) {
      const w = MEO.Entities.world;
      if (!w) return false;
      const T = w.tile;
      const a = w.areaAt(Math.floor(t.x / T), Math.floor(t.y / T));
      return !!(a && a.kind === 'town');
    },

    PACES: {
      calm:   { speed: 0.66, aggro: 0.5,  social: 0.4,  atk: 1.6,  respawn: 2.0, gcd: 1.2 },
      normal: { speed: 0.82, aggro: 0.75, social: 0.7,  atk: 1.25, respawn: 1.4, gcd: 1.1 },
      fast:   { speed: 1,    aggro: 1,    social: 1,    atk: 1,    respawn: 1,   gcd: 1 }
    },
    pace() {
      const k = MEO.Settings ? MEO.Settings.get('game.pace') : 'calm';
      return AI.PACES[k] || AI.PACES.calm;
    },

    aggroRadius(e, t) {
      const base = ((e.def && e.def.aggro) || 0) * AI.pace().aggro;
      return base * U.clamp(1 + (e.level - t.level) * 0.08, 0.5, 1.4) * (t.raceId ? 1 - MEO.raceSpecial(t.raceId, 'aggro') : 1);
    },

    /** Walk toward a point. Returns the remaining distance. */
    moveToward(e, tx, ty, speed, dt) {
      speed *= AI.pace().speed;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) return d;
      const w = MEO.Entities.world;
      const mult = w ? w.speedAt(e.x, e.y) : 1;
      const step = Math.min(d, speed * mult * dt);
      e.vx = (dx / d) * speed * mult;
      e.vy = (dy / d) * speed * mult;
      e.moveBy((dx / d) * step, (dy / d) * step);
      e.moving = true;
      return d - step;
    },

    face(e, tx, ty) {
      e.facing = Math.atan2(ty - e.y, tx - e.x);
    },

    // ---- Aggro / pull ----------------------------------------------------------
    /** The mob and everyone in the pack go into combat against t. */
    pull(e, t, social) {
      if (!e.alive || !t || !t.alive || e.evading) return;
      const T = MEO.Threat;
      const C = MEO.Combat;
      const first = !e.inCombat;
      if (!e.threat.has(t.id)) T.add(e, t, 1);
      C.enterCombat(e);
      C.enterCombat(t);
      if (e.ai) e.ai.state = 'combat';
      if (first) MEO.Events.emit('mob:aggro', { mob: e, target: t });
      if (social === false) return;
      AI.callHelp(e, t, (e.def.social || 0) * AI.pace().social);
    },

    callHelp(e, t, radius) {
      if (!(radius > 0)) return;
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m === e || m.type !== 'mob' || !m.alive || m.inCombat || m.evading) continue;
        if (!m.def || m.def.speed <= 0 || m.def.family !== e.def.family) continue;
        if (Math.hypot(m.x - e.x, m.y - e.y) > radius) continue;
        AI.pull(m, t, false);
      }
    },

    // ---- Main loop per step ----------------------------------------------------
    step(e, dt) {
      const ai = e.ai || AI.init(e);
      const now = MEO.Engine.time;
      const C = MEO.Combat;
      e.moving = false;
      e.vx = 0;
      e.vy = 0;

      if (!C.canAct(e)) return; // stunned / polymorphed

      switch (ai.state) {
        case 'combat':
          return AI._combat(e, ai, dt, now);
        case 'flee':
          return AI._flee(e, ai, dt, now);
        case 'return':
          return AI._return(e, ai, dt, now);
        default:
          return AI._passive(e, ai, dt, now);
      }
    },

    // ---- Idle and wandering ----------------------------------------------------------
    _passive(e, ai, dt, now) {
      if (e.threat.size > 0) {
        ai.state = 'combat';
        return;
      }
      const def = e.def;
      const C = MEO.Combat;

      if (now >= ai.think) {
        ai.think = now + AI.THINK + Math.random() * 0.1;
        if (def.behavior === 'aggressive') {
          const w = MEO.Entities.world;
          const list = MEO.Entities.list;
          for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t.alive || !C._isSide(t)) continue;
            const d = Math.hypot(t.x - e.x, t.y - e.y);
            if (d > AI.aggroRadius(e, t)) continue;
            if (AI.inSafe(t)) continue;
            if (!w.lineOfSight(e.x, e.y, t.x, t.y)) continue;
            AI.pull(e, t);
            return;
          }
        }
      }

      const mm = C.moveMult(e);
      if (ai.state === 'wander') {
        if (!ai.to || mm <= 0) {
          ai.state = 'idle';
          ai.until = now + rnd(2, 5);
          return;
        }
        const left = AI.moveToward(e, ai.to.x, ai.to.y, e.speed * 0.38 * mm, dt);
        AI.face(e, ai.to.x, ai.to.y);
        const moved = Math.hypot(e.x - e.prevX, e.y - e.prevY);
        ai.blockT = moved < e.speed * 0.38 * dt * 0.2 ? ai.blockT + dt : 0;
        if (left < 4 || ai.blockT > 0.6 || now > ai.until) {
          ai.state = 'idle';
          ai.to = null;
          ai.until = now + rnd(2.5, 6);
          ai.blockT = 0;
        }
      } else if (now >= ai.until && def.wander > 0) {
        const pt = AI._pickWander(e);
        if (pt) {
          ai.to = pt;
          ai.state = 'wander';
          ai.until = now + 6;
        } else ai.until = now + rnd(2, 4);
      }
    },

    _pickWander(e) {
      const w = MEO.Entities.world;
      const T = w.tile;
      const h = e.home;
      const R = e.def.wander;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = R * (0.3 + Math.random() * 0.7);
        const x = h.x + Math.cos(a) * r;
        const y = h.y + Math.sin(a) * r;
        if (w.isSolid(Math.floor(x / T), Math.floor(y / T))) continue;
        if (AI.inSafe({ x: x, y: y })) continue;
        if (!w.lineOfSight(e.x, e.y, x, y)) continue;
        return { x: x, y: y };
      }
      return null;
    },

    // ---- Combat ----------------------------------------------------------------------
    _combat(e, ai, dt, now) {
      const T = MEO.Threat;
      const C = MEO.Combat;
      const def = e.def;
      const atk = e.attack;

      T.prune(e);
      const victim = T.victim(e);
      if (!victim) {
        AI.startReturn(e);
        return;
      }
      e.victim = victim;
      C.enterCombat(e);

      // leash and safe zones
      const dHome = Math.hypot(e.x - e.home.x, e.y - e.home.y);
      if (dHome > (def.leash || 500) || AI.inSafe(victim)) {
        AI.startReturn(e);
        return;
      }

      const dist = Math.hypot(victim.x - e.x, victim.y - e.y);
      const edge = dist - e.radius - victim.radius;
      const range = atk ? atk.range : 20;
      const mm = C.moveMult(e);

      // flee at low health (only once)
      if (def.flees && !ai.fled && e.hpPct < def.flees && mm > 0) {
        ai.fled = true;
        ai.state = 'flee';
        ai.fleeUntil = now + 3.2;
        if (MEO.CombatText) MEO.CombatText.text(e, 'Fleeing!', '#ffd34d', { size: 15, up: 0.5 });
        MEO.log(e.name + ' flees in panic!', 'system');
        AI.callHelp(e, victim, 260 * AI.pace().social);
        return;
      }

      const los = !(atk && atk.ranged) || MEO.Entities.world.lineOfSight(e.x, e.y, victim.x, victim.y);
      const want = range * 0.85;

      // movement
      if (mm > 0 && (edge > want || !los)) {
        let tx = victim.x;
        let ty = victim.y;
        if (now < ai.sideUntil) {
          // go around obstacle: turn the direction
          const a = Math.atan2(ty - e.y, tx - e.x) + ai.side;
          tx = e.x + Math.cos(a) * 60;
          ty = e.y + Math.sin(a) * 60;
        }
        const bx = e.x;
        const by = e.y;
        AI.moveToward(e, tx, ty, e.speed * mm, dt);
        AI.face(e, victim.x, victim.y);

        // stuck?
        ai.stuck = Math.hypot(e.x - bx, e.y - by) < e.speed * mm * dt * 0.25 ? ai.stuck + dt : Math.max(0, ai.stuck - dt);
        if (ai.stuck > 0.35 && now >= ai.sideUntil) {
          ai.side = (Math.random() < 0.5 ? -1 : 1) * rnd(0.9, 1.7);
          ai.sideUntil = now + 0.7;
          ai.stuck = 0;
        }
        ai.blockT = ai.stuck > 0 ? ai.blockT + dt : Math.max(0, ai.blockT - dt * 2);
        if (ai.blockT > 5) {
          AI.startReturn(e);
          return;
        }
      } else {
        AI.face(e, victim.x, victim.y);
        ai.stuck = 0;
      }

      // attack
      if (!atk || edge > range + 2 || now < e.nextAttack || !los) return;
      AI._attack(e, ai, victim, edge, now);
    },

    _attack(e, ai, victim, edge, now) {
      const C = MEO.Combat;
      const B = MEO.Buffs;
      const atk = e.attack;
      const specials = e.def.specials || [];

      e.nextAttack = now + atk.interval * AI.pace().atk;

      // special ready?
      for (let i = 0; i < specials.length; i++) {
        const sp = specials[i];
        if (now < (ai.spCd[sp.name] || 0) || edge > sp.range + 2) continue;
        ai.spCd[sp.name] = now + sp.cd + rnd(0, 2);
        if (MEO.CombatText) MEO.CombatText.text(e, sp.name, '#ffd34d', { size: 14, up: 0.55 });
        if (sp.kind === 'self') {
          B.apply(e, sp.buff, e);
          MEO.log(e.name + ' uses ' + sp.name + '!', 'system');
          e.nextAttack = now + 0.6;
          return;
        }
        const mult = sp.kind === 'damage' ? sp.mult : sp.dmgMult || 1;
        const r = C.hit(e, victim, {
          base: atk.dmg * mult, coef: 0, school: 'physical', canMiss: true, fx: atk.fx, ability: { name: sp.name }
        });
        if (sp.kind === 'buff' && r && !r.miss && victim.alive) {
          B.apply(victim, sp.buff, e, sp.duration ? { duration: sp.duration } : undefined);
        }
        return;
      }

      C.hit(e, victim, { base: atk.dmg, coef: 0, school: 'physical', canMiss: true, fx: atk.fx });
    },

    // ---- Fleeing -----------------------------------------------------------------------
    _flee(e, ai, dt, now) {
      const v = e.victim;
      const mm = MEO.Combat.moveMult(e);
      if (!v || !v.alive || now >= ai.fleeUntil) {
        ai.state = 'combat';
        return;
      }
      const a = Math.atan2(e.y - v.y, e.x - v.x);
      AI.moveToward(e, e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80, e.speed * 1.05 * mm, dt);
      e.facing = a;
      // fleeing along a wall ends in combat sooner
      if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > (e.def.leash || 500) * 0.9) ai.state = 'combat';
    },

    // ---- Home (evade) -------------------------------------------------------------------
    startReturn(e) {
      const ai = e.ai || AI.init(e);
      ai.state = 'return';
      e.evading = true;
      e.victim = null;
      MEO.Threat.clear(e);
      MEO.Events.emit('mob:evade', e);
    },

    _return(e, ai, dt) {
      const C = MEO.Combat;
      e.evading = true;
      MEO.Threat.clear(e);
      const s = e.stats;
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * AI.RETURN_HEAL * dt);
      const left = AI.moveToward(e, e.home.x, e.home.y, e.speed * AI.RETURN_SPEED, dt);
      AI.face(e, e.home.x, e.home.y);
      ai.blockT = (e.moving && Math.hypot(e.x - e.prevX, e.y - e.prevY) < 0.05) ? ai.blockT + dt : 0;
      if (left < AI.HOME_REACHED || ai.blockT > 2.5) {
        if (left >= AI.HOME_REACHED) {
          // completely stuck: teleport home
          e.x = e.home.x;
          e.y = e.home.y;
        }
        MEO.Buffs.clear(e);
        s.hp = s.maxHp;
        e.evading = false;
        e.fled = false;
        ai.fled = false;
        ai.state = 'idle';
        ai.until = MEO.Engine.time + rnd(1, 3);
        ai.blockT = 0;
        C.leaveCombat(e);
      }
    }
  });
})();
