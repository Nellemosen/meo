/* ==========================================================================
   systems/save.js – Save and load (browser localStorage, one slot)
   Saved: class, level, XP, position, backpack, equipment, gold, quests, companion stance.
   Not saved: enemies (they respawn), cooldowns and buffs.
   Autosave: every 30 seconds outside combat, on quest changes and level-ups.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const KEY = 'meo.save.v1';
  const VERSION = 1;

  const Save = (MEO.Save = {
    AUTOSAVE: 30,
    _next: 0,
    _dirty: false,
    enabled: false,   // turned on by Game.begin
    lastSaved: 0,

    // ---- Storage (always guarded: private windows can throw) -----------------------
    _read() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d && d.v === VERSION ? d : null;
      } catch (err) {
        return null;
      }
    },

    _write(d) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(d));
        return true;
      } catch (err) {
        return false;
      }
    },

    exists() {
      return !!Save._read();
    },

    /** Short description for the start screen, or null. */
    summary() {
      const d = Save._read();
      if (!d) return null;
      const cls = MEO.Classes[d.classId];
      return cls ? { name: cls.name, level: d.level, id: d.classId, time: d.time } : null;
    },

    erase() {
      try {
        window.localStorage.removeItem(KEY);
      } catch (err) {
        /* ignore */
      }
    },

    // ---- Save --------------------------------------------------------------------------
    snapshot() {
      const G = MEO.Game;
      const p = G.player;
      return {
        v: VERSION,
        time: Date.now(),
        classId: p.classId,
        raceId: p.raceId || 'human',
        zoneId: G.zoneId || 'westmark',
        traits: p.traits || {},
        level: p.level,
        xp: Math.round(p.stats.xp || 0),
        pos: { x: Math.round(p.x), y: Math.round(p.y) },
        inv: { bag: p.inv.bag, equip: p.inv.equip, gold: p.inv.gold },
        quests: MEO.Quests.serialize(),
        stance: MEO.Party.stance,
        roster: MEO.Party.roster
      };
    },

    save(manual) {
      const G = MEO.Game;
      if (!Save.enabled || !G.player) return false;
      const ok = Save._write(Save.snapshot());
      Save._dirty = false;
      Save.lastSaved = MEO.Engine.time;
      if (manual) {
        if (ok) MEO.log('Game saved.', 'system');
        else MEO.log('Could not save: browser storage is unavailable.', 'system');
      }
      return ok;
    },

    markDirty() {
      Save._dirty = true;
    },

    // ---- Load -------------------------------------------------------------------------------
    /** Apply a save to the freshly created player. Returns true on success. */
    apply(d) {
      const G = MEO.Game;
      const p = G.player;
      if (d && MEO.CLASS_ALIAS[d.classId]) d.classId = MEO.CLASS_ALIAS[d.classId];
      if (!d || !MEO.Classes[d.classId]) return false;
      G.chooseClass(d.classId);
      G.setClass(d.classId, d.level);       // class:change resets the starter kit ...
      MEO.Races.set(p, d.raceId || 'human');
      p.traits = {};
      Object.keys(d.traits || {}).forEach(function (id) { if (MEO.Traits.nodes[id]) p.traits[id] = d.traits[id]; });
      if (MEO.Traits.validate(p, p.traits)) p.traits = {};
      MEO.Traits.compute(p);
      p.stats.xp = d.xp || 0;
      const bag = new Array(MEO.Inventory.BAG_SIZE).fill(null);
      (d.inv.bag || []).forEach(function (b, i) {
        if (b && MEO.ITEMS[b.id] && i < bag.length) bag[i] = { id: b.id, n: b.n };
      });
      const equip = {};
      Object.keys(d.inv.equip || {}).forEach(function (slot) {
        if (MEO.ITEMS[d.inv.equip[slot]]) equip[slot] = d.inv.equip[slot];
      });
      p.inv.bag = bag;                       // ... which we now replace with the saved items
      p.inv.equip = equip;
      p.inv.gold = d.inv.gold || 0;
      MEO.Inventory.captureBase(p);
      MEO.Inventory.recalc(true);
      const zid = MEO.ZONES[d.zoneId] ? d.zoneId : 'westmark';
      if (zid !== G.zoneId) G.loadZone(zid, { pos: d.pos, first: true });
      p.x = p.prevX = d.pos.x;
      p.y = p.prevY = d.pos.y;
      MEO.Renderer.camera.ready = false;
      MEO.Party.stance = d.stance || 'defensive';
      MEO.Party.roster = Array.isArray(d.roster) ? d.roster : null;
      if (MEO.Party.active) MEO.Party.build(p);
      MEO.Quests.load(d.quests);
      MEO.Events.emit('save:loaded', d);
      return true;
    },

    load() {
      return Save.apply(Save._read());
    },

    // ---- Per logic step ---------------------------------------------------------------------
    update() {
      if (!Save.enabled) return;
      const now = MEO.Engine.time;
      const p = MEO.Game.player;
      if (now < Save._next) return;
      Save._next = now + Save.AUTOSAVE;
      if (p.alive && !MEO.Party.anyInCombat()) Save.save(false);
    }
  });

  // Save soon after important changes (but never in the middle of a fight)
  ['quest:update', 'player:levelup', 'item:equip'].forEach(function (name) {
    Events.on(name, function () {
      Save.markDirty();
      if (Save.enabled) Save._next = Math.min(Save._next, MEO.Engine.time + 3);
    });
  });

  window.addEventListener('beforeunload', function () {
    if (Save.enabled && MEO.Game.player && MEO.Game.player.alive) Save.save(false);
  });
})();
