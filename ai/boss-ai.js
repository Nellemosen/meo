/* ==========================================================================
   ai/boss-ai.js – Scripted boss encounters (data: def.boss in data/mobs.js)
   Gorthak the Warchief (Fallen Tower):
     Phase 1  100–70%  Cleave (all nearby), Earthshaker (telegraphed stomp ring)
     Phase 2   70–35%  adds: his warband joins the fight
     Phase 3   35–0%   Enrage (+damage, faster) and Hellfire (fire zones under the party)
   The normal combat AI (movement, melee, threat) keeps running underneath;
   this module only adds the scripted abilities. Bosses are immune to stun,
   root and polymorph (combat/buffs.js). If the party wipes or flees, the boss
   resets: adds vanish, hazards are cleared and health is restored by the evade.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const rnd = function (a, b) {
    return a + Math.random() * (b - a);
  };

  const Boss = (MEO.Boss = {
    list: [],        // living bosses with an active state
    current: null,   // the boss the UI shows

    _state(e) {
      if (!e.bs) {
        e.bs = {
          engaged: false, phase: 0, nextCleave: 0, nextStomp: 0, nextFire: 0,
          adds: [], enraged: false, baseInterval: e.attack ? e.attack.interval : 2.4
        };
      }
      return e.bs;
    },

    say(e, text, warn) {
      MEO.log(e.name + ' says: "' + text + '"', 'npc');
      Events.emit('boss:say', { boss: e, text: text, warn: !!warn });
    },

    warn(e, text) {
      Events.emit('boss:say', { boss: e, text: text, warn: true });
    },

    // ---- Main step (called from Game.update) -------------------------------------------
    update() {
      const list = MEO.Entities.list;
      const now = MEO.Engine.time;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.type !== 'mob' || !e.def || !e.def.boss || !e.alive) continue;
        Boss._step(e, Boss._state(e), now);
      }
    },

    _step(e, s, now) {
      const C = MEO.Combat;
      if (!s.engaged) {
        if (e.inCombat && !e.evading) Boss._engage(e, s, now);
        return;
      }
      if (e.evading || !e.inCombat) {
        Boss._reset(e, s);
        return;
      }
      const victim = e.victim;
      if (!victim || !victim.alive || !C.canAct(e)) return;
      const def = e.def.boss;
      const hp = e.stats.hp / e.stats.maxHp;

      // ---- phase changes ----
      while (s.phase < def.phases.length && hp <= def.phases[s.phase].at) {
        const ph = def.phases[s.phase];
        s.phase++;
        if (ph.say) Boss.say(e, ph.say);
        if (ph.adds) Boss._summon(e, ph.adds, victim);
        if (ph.enrage) Boss._enrage(e, s, now);
        Events.emit('boss:phase', { boss: e, phase: s.phase });
        if (MEO.HUD) MEO.HUD.showBanner('Phase ' + (s.phase + 1), e.name);
      }

      // ---- Cleave ----
      if (now >= s.nextCleave) {
        const hits = Boss._near(e, 78);
        if (hits.length) {
          s.nextCleave = now + rnd(7, 10);
          if (MEO.CombatText) MEO.CombatText.text(e, 'Cleave', '#ffd34d', { size: 15, up: 0.6 });
          Events.emit('fx', { kind: 'ring', color: '#ffb070', x: e.x, y: e.y, radius: 78 });
          hits.forEach(function (t) {
            C.hit(e, t, { base: e.attack.dmg * 1.25, coef: 0, school: 'physical', canMiss: true, ability: { name: 'Cleave' } });
          });
          Events.emit('boss:cast', { boss: e, name: 'Cleave' });
        } else s.nextCleave = now + 1;
      }

      // ---- Earthshaker (stomp ring around the boss) ----
      if (now >= s.nextStomp) {
        s.nextStomp = now + (s.enraged ? 13 : 17);
        Boss.warn(e, e.name + ' strikes the ground – move away!');
        MEO.Hazards.zone({
          x: e.x, y: e.y, r: 105, delay: 1.9, dmg: Math.round(e.attack.dmg * 1.9), school: 'physical',
          color: '#ffb070', src: e, name: 'Earthshaker'
        });
        Events.emit('boss:cast', { boss: e, name: 'Earthshaker' });
      }

      // ---- Hellfire (phase 3) ----
      if (s.enraged && now >= s.nextFire) {
        s.nextFire = now + 7.5;
        const who = MEO.Party.everyone().filter(function (m) {
          return m.alive;
        });
        const n = Math.min(3, who.length);
        for (let k = 0; k < n; k++) {
          const t = who.splice(Math.floor(Math.random() * who.length), 1)[0];
          MEO.Hazards.zone({
            x: t.x, y: t.y, r: 58, delay: 2.2, dur: 6, dmg: Math.round(e.attack.dmg * 1.1), tickDmg: Math.round(e.attack.dmg * 0.4),
            school: 'fire', color: '#ff6a24', src: e, name: 'Hellfire'
          });
        }
        Boss.warn(e, 'Fire rains down – step out of the flames!');
      }
    },

    _near(e, r) {
      return MEO.Party.everyone().filter(function (m) {
        return m.alive && Math.hypot(m.x - e.x, m.y - e.y) <= r + m.radius;
      });
    },

    _engage(e, s, now) {
      s.engaged = true;
      s.phase = 0;
      s.nextCleave = now + 6;
      s.nextStomp = now + 12;
      s.nextFire = now + 4;
      Boss.current = e;
      if (e.def.boss.intro) Boss.say(e, e.def.boss.intro);
      Events.emit('boss:engage', e);
    },

    _enrage(e, s, now) {
      s.enraged = true;
      s.nextFire = now + 3;
      MEO.Buffs.apply(e, 'mob_enrage', e, { duration: 9999 });
      e.attack.interval = s.baseInterval * 0.8;
      Boss.warn(e, 'Gorthak is enraged!');
    },

    _summon(e, spec, victim) {
      const s = e.bs;
      for (let k = 0; k < spec.n; k++) {
        const a = e.facing + Math.PI * (k % 2 ? 0.6 : -0.6) + k * 0.3;
        const m = MEO.Game.spawnMob(spec.mob, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, 'bossadd');
        m.noRespawn = true;
        m.corpseTime = 6;
        s.adds.push(m);
        MEO.EnemyAI.pull(m, victim, false);
      }
    },

    _reset(e, s) {
      s.engaged = false;
      s.phase = 0;
      s.enraged = false;
      e.attack.interval = s.baseInterval;
      MEO.Buffs.removeById && MEO.Buffs.removeById(e, 'mob_enrage');
      s.adds.forEach(function (m) {
        MEO.Game.removeEntity(m);
      });
      s.adds.length = 0;
      MEO.Hazards.clear();
      if (Boss.current === e) Boss.current = null;
      Events.emit('boss:reset', e);
    }
  });

  Events.on('death', function (d) {
    const e = d.entity;
    if (e.type !== 'mob' || !e.def || !e.def.boss) return;
    const s = Boss._state(e);
    s.adds.forEach(function (m) {
      if (m.alive) MEO.Game.removeEntity(m);
    });
    s.adds.length = 0;
    s.engaged = false;
    MEO.Hazards.clear();
    if (e.def.boss.outro) Boss.say(e, e.def.boss.outro);
    if (MEO.HUD) MEO.HUD.showBanner('Victory!', e.name + ' is defeated');
    Events.emit('boss:dead', e);
    if (Boss.current === e) Boss.current = null;
  });
})();
