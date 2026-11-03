/* ==========================================================================
   ai/party-ai.js – Companion AI: following in formation, target choice,
   role-based ability rotations (tank / healer / ranged damage), positioning,
   kiting and crowd control. Uses the same Abilities/Combat code as the player.
   Think every ~0.18 s (decisions + abilities), move every step.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;

  const MELEE = 46;
  const SPELL = 280;

  // pref = ideal distance (edge to edge) from the target for ranged roles
  const ROLES = {
    guardian: { role: 'tank', melee: true, pref: 0 },
    warden: { role: 'tank', melee: true, pref: 0 },
    minstrel: { role: 'healer', melee: false, pref: 200 },
    runekeeper: { role: 'healer', melee: false, pref: 200 },
    hunter: { role: 'dps', melee: false, pref: 230 },
    champion: { role: 'dps', melee: true, pref: 0 },
    burglar: { role: 'dps', melee: true, pref: 0 },
    captain: { role: 'support', melee: true, pref: 0 },
    loremaster: { role: 'support', melee: false, pref: 200 }
  };

  const BACK = [70, 70, 125];
  const SIDE = [-55, 55, 0];

  const dist = function (a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  // ---- Ability helpers (no failure events, so no spam) -------------------------------
  function can(e, id, t) {
    const A = MEO.Abilities;
    const def = MEO.ABILITIES[id];
    if (!def || e.bar.indexOf(id) < 0 || e.cast) return false;
    const now = MEO.Engine.time;
    if ((e.cd[id] || 0) > now) return false;
    if (def.gcd && e.gcdEnd > now) return false;
    if (def.cost > 0 && e.stats.res < def.cost) return false;
    if (def.target !== 'self' && t && t !== e && A.check(e, def, t)) return false;
    return true;
  }

  function cast(e, id, t) {
    if (!can(e, id, t)) return false;
    return MEO.Abilities.use(e, id, { target: t, queue: false }) === true;
  }

  function incapacitated(m) {
    return MEO.Buffs.has(m, 'incapacitate');
  }

  function isVictimOf(m, e) {
    return m.victim === e;
  }

  const AI = (MEO.PartyAI = {
    THINK: 0.18,
    ROLES: ROLES,

    init(e) {
      return (e.ai = {
        think: 0, foes: [], main: null, loose: null, following: false,
        stuck: 0, side: 0, sideUntil: 0, blockT: 0, kiteUntil: 0, farT: 0, fightT: 0
      });
    },

    // =========================================================================
    step(e, dt) {
      const ai = e.ai || AI.init(e);
      const P = MEO.Party;
      const leader = P.leader;
      const now = MEO.Engine.time;
      e.moving = false;
      e.vx = 0;
      e.vy = 0;
      if (!leader) return;
      if (!MEO.Combat.canAct(e)) return;

      if (now >= ai.think) {
        ai.think = now + AI.THINK + Math.random() * 0.05;
        AI._think(e, ai, leader, now);
      }
      AI._move(e, ai, leader, dt, now);
    },

    // ---- Enemies the party is fighting -------------------------------------------------
    foesOf(e, leader) {
      const P = MEO.Party;
      const out = [];
      if (P.stance === 'passive') return out;
      const list = MEO.Entities.list;
      const focus = P.focus;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.type !== 'mob' || !m.alive || m.evading) continue;
        if (dist(m, leader) > 300) continue;
        // only enemies that are actually fighting the player or the party
        if ((m.inCombat && m.threat.size > 0) || m === focus) out.push(m);
      }
      // Aggressive: attack the nearest hostile creature near the leader
      if (!out.length && P.stance === 'aggressive' && !P.anyInCombat()) {
        const w = MEO.Entities.world;
        let best = null;
        let bd = 130;
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (m.type !== 'mob' || !m.alive || m.evading || m.isStatic) continue;
          const d = dist(m, leader);
          if (d >= bd || MEO.EnemyAI.inSafe(m)) continue;
          if (!w.lineOfSight(leader.x, leader.y, m.x, m.y)) continue;
          bd = d;
          best = m;
        }
        if (best) out.push(best);
      }
      return out;
    },

    _valid(m, foes) {
      return !!m && m.alive && foes.indexOf(m) >= 0 && !incapacitated(m);
    },

    _nearest(e, foes) {
      let best = null;
      let bd = Infinity;
      for (let i = 0; i < foes.length; i++) {
        const m = foes[i];
        if (!m.alive || incapacitated(m)) continue;
        const d = dist(e, m);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      return best;
    },

    // ---- Decisions ---------------------------------------------------------------------------
    _think(e, ai, leader, now) {
      const P = MEO.Party;
      const C = MEO.Combat;
      const role = ROLES[e.classId];
      const foes = AI.foesOf(e, leader);
      ai.foes = foes;
      ai.loose = null;

      // ----- target
      let t = null;
      const focus = P.focus;
      if (AI._valid(focus, foes)) t = focus;
      else if (role.role === 'tank') {
        // 1. enemy that is chewing on someone else
        let bd = Infinity;
        for (let i = 0; i < foes.length; i++) {
          const m = foes[i];
          if (incapacitated(m) || !m.victim || m.victim === e || !P.isMember(m.victim)) continue;
          const d = dist(e, m);
          if (d < 520 && d < bd) {
            bd = d;
            ai.loose = m;
          }
        }
        if (ai.loose) t = ai.loose;
        else if (AI._valid(leader.target, foes)) t = leader.target;
        else if (AI._valid(ai.main, foes)) t = ai.main;
        else t = AI._nearest(e, foes);
      } else {
        const tank = P.tank;
        if (AI._valid(leader.target, foes)) t = leader.target;
        else if (tank && tank.alive && tank.ai && AI._valid(tank.ai.main, foes)) t = tank.ai.main;
        else if (AI._valid(ai.main, foes)) t = ai.main;
        else t = AI._nearest(e, foes);
      }
      ai.main = t;

      const fighting = foes.length > 0;
      ai.fightT = fighting ? ai.fightT + AI.THINK : 0;

      // target + auto-attack
      if (t) {
        if (e.target !== t) e.target = t;
        if (e.auto && !e.auto.on) C.startAuto(e);
      } else {
        e.target = null;
        if (e.auto && e.auto.on) C.stopAuto(e);
      }

      // ----- abilities
      const ctx = {
        t: t, foes: foes, leader: leader, now: now, fighting: fighting,
        tank: P.tank && P.tank.alive ? P.tank : null,
        allies: P.everyone().filter(function (a) {
          return a.alive && dist(a, e) < SPELL * 1.4;
        })
      };
      AI.rotations[e.classId](e, ai, ctx);
    },

    // =========================================================================
    //  Rotations
    // =========================================================================
    rotations: {
      guardian(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        const s = e.stats;

        if (x.fighting) {
          if (ai.loose) cast(e, 'taunt', ai.loose); // does not use the global cooldown
          if (e.hpPct < 0.4) cast(e, 'shield_wall', e);
          if (x.foes.length >= 2 || (t && t.stats.maxHp > 600)) cast(e, 'berserk', e);
          if (!B.hasId(e, 'battle_shout') && s.res >= 10 && cast(e, 'battle_shout', e)) return;
        }
        if (!t) return;
        let near = 0;
        for (let i = 0; i < x.foes.length; i++) if (!incapacitated(x.foes[i]) && dist(e, x.foes[i]) < 85) near++;
        if (near >= 2 && cast(e, 'whirlwind', e)) return;
        if (t.hpPct < 0.25 && cast(e, 'execute', t)) return;
        if (s.res >= 50 && cast(e, 'shield_bash', t)) return;
        cast(e, 'slash', t);
      },

      minstrel(e, ai, x) {
        const B = MEO.Buffs;
        const A = MEO.Abilities;
        const s = e.stats;

        // stop an expensive heal when the target no longer needs it
        if (e.cast) {
          const id = e.cast.def.id;
          if ((id === 'heal' || id === 'flash_heal') && e.cast.target.hpPct > 0.96) A.interrupt(e, 'Not needed', true);
          return;
        }

        let low = null;
        let lowPct = 2;
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          const p = a.hpPct;
          if (p < lowPct) {
            lowPct = p;
            low = a;
          }
        }

        // remove poison and other cleansable effects
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          for (let k = 0; k < a.buffs.length; k++) {
            const d = a.buffs[k].def;
            if (d.harmful && (d.dispel === 'magic' || d.dispel === 'poison' || d.dispel === 'curse')) {
              if (cast(e, 'cleanse', a)) return;
              break;
            }
          }
        }

        if (low && lowPct < 0.38) {
          if (cast(e, 'flash_heal', low)) return;
          if (cast(e, 'heal', low)) return;
        }

        // ward whoever the enemies are hitting
        if (x.fighting) {
          const order = [];
          if (x.tank) order.push(x.tank);
          order.push(e);
          for (let i = 0; i < x.allies.length; i++) if (order.indexOf(x.allies[i]) < 0) order.push(x.allies[i]);
          for (let i = 0; i < order.length; i++) {
            const a = order[i];
            if (B.hasId(a, 'ward') || !a.alive) continue;
            let hit = false;
            for (let k = 0; k < x.foes.length; k++) if (isVictimOf(x.foes[k], a)) hit = true;
            if (hit && cast(e, 'ward', a)) return;
          }
        }

        if (low && lowPct < 0.65 && cast(e, 'heal', low)) return;

        // group heal
        let hurt = 0;
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          if (a.hpPct < 0.72 && dist(a, e) < 160) hurt++;
        }
        if (hurt >= 2 && cast(e, 'radiance', e)) return;

        if (low && lowPct < 0.88 && !B.hasId(low, 'renew') && cast(e, 'renew', low)) return;
        if (low && lowPct < 0.8 && cast(e, 'heal', low)) return;

        // out of combat: top everyone up
        if (!x.fighting && low && lowPct < 0.93) {
          if (!B.hasId(low, 'renew') && cast(e, 'renew', low)) return;
          if (lowPct < 0.7 && cast(e, 'heal', low)) return;
        }

        // damage only when the group is healthy and mana is plentiful
        if (x.fighting && x.t && lowPct > 0.8 && s.res > s.maxRes * 0.55) {
          if (!B.hasId(x.t, 'pain') && x.t.stats.hp > 110 && cast(e, 'pain', x.t)) return;
          cast(e, 'smite', x.t);
        }
      },

      hunter(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        const s = e.stats;
        const now = x.now;
        if (e.cast) return;

        // an enemy on top of me: slow it, jump away
        let melee = null;
        for (let i = 0; i < x.foes.length; i++) {
          const m = x.foes[i];
          if (!incapacitated(m) && isVictimOf(m, e) && dist(e, m) - m.radius < 70) {
            melee = m;
            break;
          }
        }
        if (melee) {
          if (cast(e, 'crippling', melee)) return;
          if (can(e, 'disengage', e)) {
            e.facing = Math.atan2(melee.y - e.y, melee.x - e.x);
            if (cast(e, 'disengage', e)) {
              ai.kiteUntil = now + 1.4;
              cast(e, 'swiftness', e);
              return;
            }
          }
        }
        if (!t) return;
        if (t.stats.maxHp >= 380 && !B.hasId(t, 'marked') && cast(e, 'mark', t)) return;
        if (!B.hasId(t, 'venom') && t.stats.hp > 150 && cast(e, 'serpent', t)) return;
        let near = 0;
        for (let i = 0; i < x.foes.length; i++) if (dist(x.foes[i], t) < 90) near++;
        if (near >= 3 && cast(e, 'multishot', t)) return;
        if (s.res >= 20 && cast(e, 'quick_shot', t)) return;
        cast(e, 'aimed_shot', t);
      },

      warden(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        if (x.fighting) {
          if (ai.loose) cast(e, 'challenge', ai.loose);
          if (e.hpPct < 0.4) cast(e, 'fortify', e);
          if (e.hpPct < 0.65) cast(e, 'fend', e);
          if (e.hpPct < 0.5 && cast(e, 'second_wind', e)) return;
        }
        if (!t) return;
        let near = 0;
        for (let i = 0; i < x.foes.length; i++) if (!incapacitated(x.foes[i]) && dist(e, x.foes[i]) < 85) near++;
        if (near >= 2 && cast(e, 'sweep', e)) return;
        if (!B.hasId(t, 'crippled') && t.stats.maxHp > 150 && cast(e, 'pin_down', t)) return;
        if (e.stats.res >= 25 && cast(e, 'impale', t)) return;
        cast(e, 'jab', t);
      },

      champion(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        if (x.fighting) {
          if (x.foes.length >= 2 || (t && t.stats.maxHp > 600)) {
            cast(e, 'bloodlust', e);
            cast(e, 'war_cry', e);
          }
        }
        if (!t) return;
        if (t.cast) cast(e, 'charge', t);
        if (!B.hasId(t, 'rend') && t.stats.hp > 120 && cast(e, 'rend', t)) return;
        let near = 0;
        for (let i = 0; i < x.foes.length; i++) if (!incapacitated(x.foes[i]) && dist(e, x.foes[i]) < 90) near++;
        if (near >= 3 && cast(e, 'mighty_swing', e)) return;
        if (t.hpPct < 0.3 && cast(e, 'cull', t)) return;
        cast(e, 'fell_strike', t);
      },

      burglar(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        if (x.fighting) {
          if (e.hpPct < 0.35) cast(e, 'escape', e);
          if (x.foes.length >= 2 || (t && t.stats.maxHp > 500)) cast(e, 'fools_luck', e);
        }
        if (!t) return;
        if (t.cast && cast(e, 'dirty_trick', t)) return;
        if (!B.hasId(t, 'deadly_poison') && t.stats.hp > 120 && cast(e, 'poison_blade', t)) return;
        if (t.hpPct < 0.35 && cast(e, 'cutthroat', t)) return;
        if (e.stats.res >= 20 && cast(e, 'backstab', t)) return;
        cast(e, 'stab', t);
      },

      captain(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        if (e.cast) return;
        let low = null;
        let lowPct = 2;
        let hurt = 0;
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          if (a.hpPct < lowPct) { lowPct = a.hpPct; low = a; }
          if (a.hpPct < 0.7) hurt++;
        }
        if (x.fighting) {
          if (!B.hasId(e, 'heralds_cry') && cast(e, 'heralds_cry', e)) return;
          if (low && lowPct < 0.3 && cast(e, 'final_stand', low)) return;
          if (hurt >= 2 && cast(e, 'banner', e)) return;
          if ((x.foes.length >= 2 || hurt) && !B.hasId(e, 'defensive_order') && cast(e, 'defensive_order', e)) return;
          if (low && lowPct < 0.55 && cast(e, 'inspire', low)) return;
          if (t && t.stats.maxHp >= 380 && !B.hasId(t, 'pointed') && cast(e, 'pointed_command', t)) return;
        }
        if (t) cast(e, 'rallying_strike', t);
      },

      loremaster(e, ai, x) {
        const B = MEO.Buffs;
        const t = x.t;
        const now = x.now;
        if (e.cast) return;
        const close = [];
        for (let i = 0; i < x.foes.length; i++) {
          const m = x.foes[i];
          if (!incapacitated(m) && dist(e, m) - m.radius < 100) close.push(m);
        }
        if (close.length) {
          let chased = false;
          for (let i = 0; i < close.length; i++) if (isVictimOf(close[i], e)) chased = true;
          if (chased && cast(e, 'frost_nova', e)) { ai.kiteUntil = now + 2.2; return; }
          if (chased && e.hpPct < 0.7 && cast(e, 'lore_ward', e)) return;
        }
        // buff the group
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          if (!B.hasId(a, 'insight') && cast(e, 'insight', a)) return;
        }
        if (x.fighting) {
          const order = x.tank ? [x.tank] : [];
          for (let i = 0; i < x.allies.length; i++) if (order.indexOf(x.allies[i]) < 0) order.push(x.allies[i]);
          for (let i = 0; i < order.length; i++) {
            const a = order[i];
            if (!B.hasId(a, 'lore_ward') && a.hpPct < 0.8 && cast(e, 'lore_ward', a)) return;
          }
        }
        if (!t) return;
        if (t.stats.maxHp >= 380 && !B.hasId(t, 'exposed') && cast(e, 'exposed', t)) return;
        if (t.stats.maxHp >= 300 && !B.hasId(t, 'dazzled') && cast(e, 'blinding_light', t)) return;
        if (x.foes.length >= 3 && e.stats.res > e.stats.maxRes * 0.4 && cast(e, 'embers', t)) return;
        cast(e, 'lore_bolt', t);
      },

      runekeeper(e, ai, x) {
        const B = MEO.Buffs;
        const s = e.stats;
        if (e.cast) {
          const c = e.cast;
          if (c.def.id === 'rune_mend' && c.target.hpPct > 0.96) MEO.Abilities.interrupt(e, 'Not needed', true);
          return;
        }
        let low = null;
        let lowPct = 2;
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          if (a.hpPct < lowPct) { lowPct = a.hpPct; low = a; }
        }
        for (let i = 0; i < x.allies.length; i++) {
          const a = x.allies[i];
          for (let k = 0; k < a.buffs.length; k++) {
            const d = a.buffs[k].def;
            if (d.harmful && (d.dispel === 'magic' || d.dispel === 'poison' || d.dispel === 'curse')) {
              if (cast(e, 'rune_cleanse', a)) return;
              break;
            }
          }
        }
        if (low && lowPct < 0.5 && cast(e, 'rune_mend', low)) return;
        if (x.fighting) {
          const order = x.tank ? [x.tank, e] : [e];
          for (let i = 0; i < order.length; i++) {
            const a = order[i];
            if (!a.alive || B.hasId(a, 'rune_ward')) continue;
            let hit = false;
            for (let k = 0; k < x.foes.length; k++) if (isVictimOf(x.foes[k], a)) hit = true;
            if (hit && cast(e, 'rune_ward', a)) return;
          }
        }
        if (low && lowPct < 0.85 && !B.hasId(low, 'rune_renew') && cast(e, 'rune_renew', low)) return;
        if (low && lowPct < 0.72 && cast(e, 'rune_mend', low)) return;
        if (x.fighting && x.t && lowPct > 0.8 && s.res > s.maxRes * 0.5) {
          if (!B.hasId(x.t, 'burning') && x.t.stats.hp > 110 && cast(e, 'ignite', x.t)) return;
          if (cast(e, 'fireball', x.t)) return;
          cast(e, 'frostbolt', x.t);
        }
      }
    },

    // =========================================================================
    //  Movement
    // =========================================================================
    _move(e, ai, leader, dt, now) {
      const P = MEO.Party;
      const C = MEO.Combat;
      const w = MEO.Entities.world;
      const role = ROLES[e.classId];
      const foes = ai.foes;
      const t = ai.main;
      const dL = dist(e, leader);

      // never walk while casting (moving interrupts the spell)
      if (e.cast && !e.cast.def.castMoving) {
        if (t) AI._turn(e, Math.atan2(t.y - e.y, t.x - e.x), dt);
        return;
      }

      let goal = null;
      let speedMul = 1;
      let face = null;

      // Lost the leader: catch up fast, teleport if really far away
      if (dL > 1000) ai.farT += dt;
      else ai.farT = Math.max(0, ai.farT - dt * 2);
      if (ai.farT > 2.5 || (dL > 260 && ai.blockT > 3)) {
        P.placeNear(e, leader, 90);
        ai.farT = 0;
        ai.blockT = 0;
        return;
      }

      const fighting = foes.length > 0 && dL < 380;

      if (fighting) {
        if (now < ai.kiteUntil) {
          // run away from the nearest enemy
          const n = AI._nearest(e, foes);
          if (n) {
            const a = Math.atan2(e.y - n.y, e.x - n.x);
            goal = { x: e.x + Math.cos(a) * 90, y: e.y + Math.sin(a) * 90 };
            speedMul = 1.1;
          }
        } else if (role.role === 'healer') {
          const anchor = P.tank && P.tank.alive ? P.tank : leader;
          const n = AI._nearest(e, foes);
          const dA = dist(e, anchor);
          if (n && dist(e, n) < 95) {
            const a = Math.atan2(e.y - n.y, e.x - n.x);
            goal = { x: e.x + Math.cos(a) * 80, y: e.y + Math.sin(a) * 80 };
          } else if (dA > 230 || !w.lineOfSight(e.x, e.y, anchor.x, anchor.y)) goal = anchor;
          else if (t) face = Math.atan2(t.y - e.y, t.x - e.x);
        } else if (t) {
          const dT = dist(e, t);
          const edge = dT - t.radius;
          if (role.melee) {
            if (edge > MELEE * 0.7) {
              goal = t;
              speedMul = 1.05;
            } else face = Math.atan2(t.y - e.y, t.x - e.x);
          } else {
            const los = w.lineOfSight(e.x, e.y, t.x, t.y);
            if (!los || edge > role.pref + 25) goal = t;
            else if (edge < role.pref * 0.4 && t.victim === e) {
              const a = Math.atan2(e.y - t.y, e.x - t.x);
              goal = { x: e.x + Math.cos(a) * 80, y: e.y + Math.sin(a) * 80 };
              speedMul = 1.05;
            } else face = Math.atan2(t.y - e.y, t.x - e.x);
          }
        }
        // do not stray too far from the leader while fighting
        if (dL > 520) {
          goal = leader;
          speedMul = 1.2;
        }
      } else {
        // formation behind the leader
        const h = P.heading;
        const fx = Math.cos(h);
        const fy = Math.sin(h);
        const back = BACK[e.slot % 3];
        const side = SIDE[e.slot % 3];
        const slot = {
          x: leader.x - fx * back + -fy * side,
          y: leader.y - fy * back + fx * side
        };
        const d = dist(e, slot);
        if (!ai.following && d > 50) ai.following = true;
        if (ai.following && d < 18) ai.following = false;
        if (ai.following) {
          goal = slot;
          speedMul = 1 + U.clamp((d - 90) / 260, 0, 0.5);
        } else if (dL < 36) {
          const a = Math.atan2(e.y - leader.y, e.x - leader.x);
          goal = { x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 40 };
          speedMul = 0.6;
        }
      }

      // Step out of telegraphed ground hazards (boss mechanics)
      const hz = MEO.Hazards && MEO.Hazards.dangerAt(e.x, e.y, 22);
      if (hz) {
        const ha = Math.atan2(e.y - hz.y, e.x - hz.x);
        goal = { x: e.x + Math.cos(ha) * 90, y: e.y + Math.sin(ha) * 90 };
        speedMul = 1.3;
      }

      if (!goal) {
        if (face != null) AI._turn(e, face, dt);
        ai.stuck = 0;
        ai.blockT = Math.max(0, ai.blockT - dt);
        return;
      }

      // walk toward the goal, steering around obstacles when stuck
      let tx = goal.x;
      let ty = goal.y;
      const d = Math.hypot(tx - e.x, ty - e.y);
      if (d < 3) return;
      if (now < ai.sideUntil) {
        const a = Math.atan2(ty - e.y, tx - e.x) + ai.side;
        tx = e.x + Math.cos(a) * 60;
        ty = e.y + Math.sin(a) * 60;
      }
      const mm = C.moveMult(e);
      if (mm <= 0) return;
      const sp = leader.speed * speedMul * mm * (w ? w.speedAt(e.x, e.y) : 1);
      const dx = tx - e.x;
      const dy = ty - e.y;
      const dd = Math.hypot(dx, dy) || 1;
      const step = Math.min(dd, sp * dt);
      const bx = e.x;
      const by = e.y;
      e.vx = (dx / dd) * sp;
      e.vy = (dy / dd) * sp;
      e.moveBy((dx / dd) * step, (dy / dd) * step);
      e.moving = true;
      AI._turn(e, Math.atan2(dy, dx), dt);

      const moved = Math.hypot(e.x - bx, e.y - by);
      ai.stuck = moved < step * 0.25 ? ai.stuck + dt : Math.max(0, ai.stuck - dt);
      if (ai.stuck > 0.35 && now >= ai.sideUntil) {
        ai.side = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.8);
        ai.sideUntil = now + 0.7;
        ai.stuck = 0;
      }
      ai.blockT = moved < step * 0.2 ? ai.blockT + dt : Math.max(0, ai.blockT - dt * 2);
    },

    _turn(e, want, dt) {
      const d = Math.atan2(Math.sin(want - e.facing), Math.cos(want - e.facing));
      e.facing += d * Math.min(1, dt * 12);
    }
  });
})();
