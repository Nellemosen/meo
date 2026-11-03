/* ==========================================================================
   systems/loot.js – Loot tables, lootable corpses, loot window logic
   The enemy rolls its loot on death (only if the player/group killed it).
   Gold is picked up automatically when the corpse is opened; items are taken one at a time
   or all at once ('E' again / "Take all").
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const Loot = (MEO.Loot = {
    RANGE: 80,          // px (edge to edge) to loot
    LOOT_TIME: 50,      // sec a corpse with loot stays around
    open: null,         // the corpse the window is showing right now
    _sparkT: 0,

    // ---- Roll loot -----------------------------------------------------------
    roll(mob) {
      const def = mob.def;
      const items = [];
      const table = (def.loot && MEO.LOOT[def.loot]) || [];
      table.forEach(function (r) {
        if (Math.random() >= r.chance) return;
        const id = r.pick ? r.pick[Math.floor(Math.random() * r.pick.length)] : r.item;
        const n = r.min ? r.min + Math.floor(Math.random() * (r.max - r.min + 1)) : 1;
        if (MEO.ITEMS[id]) items.push({ id: id, n: n });
      });
      if (MEO.Quests) MEO.Quests.addDrops(mob, items);
      let gold = 0;
      if (def.gold) gold = Math.round(def.gold[0] + Math.random() * (def.gold[1] - def.gold[0]));
      return { items: items, gold: gold };
    },

    onDeath(d) {
      const e = d.entity;
      if (e.type !== 'mob' || !e.def || !e.def.loot && !e.def.gold) return;
      const k = d.killer;
      if (!k || !MEO.Combat._isSide(k)) return;
      const l = Loot.roll(e);
      if (!l.items.length && !l.gold) return;
      e.loot = l;
      e.corpseTime = Loot.LOOT_TIME;
    },

    isLootable(e) {
      return !!(e && !e.alive && e.type === 'mob' && e.loot);
    },

    /** Edge-to-edge distance to the player. */
    distTo(e) {
      const p = MEO.Game.player;
      return Math.hypot(e.x - p.x, e.y - p.y) - e.radius - p.radius;
    },

    nearest() {
      const p = MEO.Game.player;
      let best = null;
      let bd = Loot.RANGE;
      MEO.Entities.list.forEach(function (e) {
        if (!Loot.isLootable(e)) return;
        const d = Loot.distTo(e);
        if (d < bd) {
          bd = d;
          best = e;
        }
      });
      return best;
    },

    // ---- Window ------------------------------------------------------------------
    tryOpen(e) {
      if (!Loot.isLootable(e)) return false;
      if (Loot.distTo(e) > Loot.RANGE) {
        Events.emit('inv:fail', { text: 'Too far away' });
        return false;
      }
      const p = MEO.Game.player;
      if (!p.alive) return false;
      if (e.loot.gold > 0) {
        const g = MEO.Races ? MEO.Races.gold(e.loot.gold) : e.loot.gold;
        p.inv.gold += g;
        e.loot.gold = 0;
        MEO.log('You loot ' + MEO.Inventory.money(g) + '.', 'loot');
        Events.emit('inv:change', p);
        if (MEO.CombatText) MEO.CombatText.text(p, '+' + MEO.Inventory.money(g), '#ffd34d', { size: 14, up: 0.5 });
      }
      if (!e.loot.items.length) {
        Loot._finish(e);
        return true;
      }
      Loot.open = e;
      Events.emit('loot:open', e);
      if (MEO.Settings && MEO.Settings.get('game.autoLoot')) Loot.takeAll();
      return true;
    },

    close() {
      if (!Loot.open) return;
      Loot.open = null;
      Events.emit('loot:close');
    },

    /** Take item no. i from the open corpse. */
    take(i) {
      const e = Loot.open;
      if (!e || !e.loot) return false;
      const r = e.loot.items[i];
      if (!r) return false;
      const Inv = MEO.Inventory;
      if (!Inv.canAdd(r.id, r.n)) {
        Events.emit('inv:fail', { text: 'Your backpack is full' });
        return false;
      }
      Inv.add(r.id, r.n);
      e.loot.items.splice(i, 1);
      const it = MEO.ITEMS[r.id];
      MEO.log('You receive: ' + it.name + (r.n > 1 ? ' ×' + r.n : '') + '.', 'loot');
      Events.emit('loot:change', e);
      if (!e.loot.items.length) {
        Loot.close();
        Loot._finish(e);
      }
      return true;
    },

    takeAll() {
      const e = Loot.open;
      if (!e) return;
      let guard = 40;
      while (e.loot && e.loot.items.length && guard-- > 0) {
        if (!Loot.take(0)) break;
      }
    },

    _finish(e) {
      e.loot = null;
      const left = 1.2;
      e.corpseTime = MEO.Engine.time - e.deathTime + left;
      MEO.Engine.after(left, function () {
        MEO.Game.removeEntity(e);
      });
    },

    // ---- Per step: sparkles over the corpses and distance check ----------------------------------
    update(dt) {
      if (Loot.open) {
        if (!Loot.isLootable(Loot.open) || Loot.distTo(Loot.open) > Loot.RANGE + 40) Loot.close();
      }
      Loot._sparkT -= dt;
      if (Loot._sparkT > 0) return;
      Loot._sparkT = 0.45;
      const F = MEO.FX3D;
      if (!F || !F.burst) return;
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!Loot.isLootable(e) || e._rx === undefined) continue;
        F.burst(e._rx, e._ry + 0.25, e._rz, '#ffe58a', 2, { speed: 0.35, up: 0.9, grav: -0.4, size: 0.22, life: 0.9, alpha: true });
      }
    }
  });

  Events.on('death', Loot.onDeath);
})();
