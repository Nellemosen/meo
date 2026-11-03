/* ==========================================================================
   systems/inventory.js – Backpack, equipment, gold, potions and stats from equipment
   The player's data lives in player.inv = { bag[24], equip{slot:id}, gold, potionCd }.
   Changes emit 'inv:change'. The UI lives in ui/inventory-ui.js.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const STAT_KEYS = ['maxHp', 'maxRes', 'power', 'armor', 'crit', 'resist'];

  const Inv = (MEO.Inventory = {
    BAG_SIZE: 24,
    player: null,

    // ---- Money -----------------------------------------------------------
    money(c) {
      c = Math.max(0, Math.floor(c || 0));
      const g = Math.floor(c / 10000);
      const s = Math.floor((c % 10000) / 100);
      const k = c % 100;
      const out = [];
      if (g) out.push(g + 'g');
      if (s) out.push(s + 's');
      if (k || !out.length) out.push(k + 'c');
      return out.join(' ');
    },

    // ---- Setup -------------------------------------------------------
    /** Reset the backpack and equipment to the class starter kit. Called when the class is chosen. */
    reset(p) {
      Inv.player = p;
      p.inv = { bag: new Array(Inv.BAG_SIZE).fill(null), equip: {}, gold: 0, potionCd: 0 };
      const kit = MEO.STARTER_KIT[p.classId];
      if (kit) {
        kit.equip.forEach(function (id) {
          const it = MEO.ITEMS[id];
          p.inv.equip[Inv._slotOf(it)] = id;
        });
        kit.bag.forEach(function (b) {
          Inv.add(b[0], b[1]);
        });
      }
      Inv.recalc(true);
    },

    _slotOf(it) {
      return it.slot;
    },

    /** Remember base stats (without equipment) – called right after setupClass. */
    captureBase(p) {
      const s = p.stats;
      p._base = {};
      STAT_KEYS.forEach(function (k) {
        p._base[k] = s[k] || 0;
      });
    },

    // ---- Stats from equipment ---------------------------------------------------
    gearStats(p) {
      const out = {};
      const eq = p.inv.equip;
      Object.keys(eq).forEach(function (slot) {
        const it = MEO.ITEMS[eq[slot]];
        if (!it || !it.stats) return;
        Object.keys(it.stats).forEach(function (k) {
          out[k] = (out[k] || 0) + it.stats[k];
        });
      });
      return out;
    },

    recalc(fill) {
      const p = Inv.player;
      if (!p || !p._base) return;
      const g = Inv.gearStats(p);
      const s = p.stats;
      const hpPct = s.maxHp ? s.hp / s.maxHp : 1;
      STAT_KEYS.forEach(function (k) {
        s[k] = p._base[k] + (g[k] || 0);
      });
      const ts = p.traitStats;
      if (ts) {
        const map = { hp: 'maxHp', pw: 'power', ar: 'armor', mr: 'maxRes', cr: 'crit', rs: 'resist' };
        Object.keys(ts).forEach(function (k) {
          const st = map[k];
          if (!st || s[st] === undefined) return;
          if (k === 'cr' || k === 'rs') s[st] += ts[k];
          else s[st] = Math.round(s[st] * (1 + ts[k]));
        });
      }
      const rs = p.raceId ? MEO.raceStats(p.raceId) : null;
      if (rs) {
        Object.keys(rs).forEach(function (k) {
          if (s[k] === undefined) return;
          s[k] = Math.round(s[k] * (1 + rs[k].pct) * 1000) / 1000 + rs[k].flat;
          if (k !== 'crit' && k !== 'resist') s[k] = Math.round(s[k]);
        });
      }
      s.hp = fill ? s.maxHp : Math.min(s.maxHp, Math.max(1, Math.round(s.maxHp * hpPct)));
      if (s.maxRes && s.res > s.maxRes) s.res = s.maxRes;
      Events.emit('inv:change', p);
    },

    // ---- Backpack -----------------------------------------------------------------
    _bag() {
      return Inv.player.inv.bag;
    },

    freeSlots() {
      return Inv._bag().filter(function (b) {
        return !b;
      }).length;
    },

    canAdd(id, n) {
      const it = MEO.ITEMS[id];
      let room = 0;
      const bag = Inv._bag();
      for (let i = 0; i < bag.length; i++) {
        if (!bag[i]) room += it.stack;
        else if (bag[i].id === id) room += it.stack - bag[i].n;
      }
      return room >= (n || 1);
    },

    /** Put into the backpack. Returns the number that did NOT fit. */
    add(id, n) {
      const it = MEO.ITEMS[id];
      n = n || 1;
      const bag = Inv._bag();
      for (let i = 0; i < bag.length && n > 0; i++) {
        if (bag[i] && bag[i].id === id && bag[i].n < it.stack) {
          const put = Math.min(n, it.stack - bag[i].n);
          bag[i].n += put;
          n -= put;
        }
      }
      for (let i = 0; i < bag.length && n > 0; i++) {
        if (!bag[i]) {
          const put = Math.min(n, it.stack);
          bag[i] = { id: id, n: put };
          n -= put;
        }
      }
      Events.emit('inv:change', Inv.player);
      return n;
    },

    count(id) {
      return Inv._bag().reduce(function (a, b) {
        return a + (b && b.id === id ? b.n : 0);
      }, 0);
    },

    removeAt(idx, n) {
      const bag = Inv._bag();
      const b = bag[idx];
      if (!b) return;
      b.n -= n || 1;
      if (b.n <= 0) bag[idx] = null;
      Events.emit('inv:change', Inv.player);
    },

    /** Remove n items of an id from anywhere in the backpack. Returns how many were removed. */
    take(id, n) {
      const bag = Inv._bag();
      let left = n || 1;
      for (let i = 0; i < bag.length && left > 0; i++) {
        if (bag[i] && bag[i].id === id) {
          const t = Math.min(left, bag[i].n);
          bag[i].n -= t;
          left -= t;
          if (bag[i].n <= 0) bag[i] = null;
        }
      }
      Events.emit('inv:change', Inv.player);
      return (n || 1) - left;
    },

    swap(i, j) {
      const bag = Inv._bag();
      if (i === j) return;
      const a = bag[i];
      const b = bag[j];
      if (a && b && a.id === b.id) {
        const it = MEO.ITEMS[a.id];
        const put = Math.min(a.n, it.stack - b.n);
        b.n += put;
        a.n -= put;
        if (a.n <= 0) bag[i] = null;
      } else {
        bag[i] = b;
        bag[j] = a;
      }
      Events.emit('inv:change', Inv.player);
    },

    // ---- Equipment ----------------------------------------------------------------------
    /** { ok, reason } */
    canEquip(id) {
      const it = MEO.ITEMS[id];
      const p = Inv.player;
      if (!it || !it.slot) return { ok: false, reason: 'Cannot be equipped' };
      if (it.cls && !MEO.classFits(p.classId, it.cls)) {
        const names = it.cls.map(function (c) {
          return MEO.Classes[c].name;
        });
        return { ok: false, reason: 'Only for: ' + names.join(', ') };
      }
      if (it.armorType && MEO.ARMOR_ALLOWED[p.classId].indexOf(it.armorType) < 0) {
        return { ok: false, reason: MEO.Classes[p.classId].name + ' cannot wear ' + Inv.armorTypeName(it.armorType) };
      }
      return { ok: true };
    },

    armorTypeName(t) {
      return t === 'plate' ? 'plate' : t === 'leather' ? 'leather' : 'cloth';
    },

    equipFromBag(idx) {
      const p = Inv.player;
      const b = Inv._bag()[idx];
      if (!b) return false;
      const chk = Inv.canEquip(b.id);
      if (!chk.ok) {
        Events.emit('inv:fail', { text: chk.reason });
        return false;
      }
      const it = MEO.ITEMS[b.id];
      const old = p.inv.equip[it.slot];
      p.inv.equip[it.slot] = b.id;
      Inv._bag()[idx] = old ? { id: old, n: 1 } : null;
      Inv.recalc();
      Events.emit('item:equip', { item: it });
      return true;
    },

    unequip(slot) {
      const p = Inv.player;
      const id = p.inv.equip[slot];
      if (!id) return false;
      if (Inv.freeSlots() < 1) {
        Events.emit('inv:fail', { text: 'Your backpack is full' });
        return false;
      }
      delete p.inv.equip[slot];
      Inv.add(id, 1);
      Inv.recalc();
      return true;
    },

    /** Drag from the bag to an equipment slot (only if the item fits the slot). */
    equipToSlot(idx, slot) {
      const b = Inv._bag()[idx];
      if (!b) return false;
      const it = MEO.ITEMS[b.id];
      if (it.slot !== slot) {
        Events.emit('inv:fail', { text: 'Does not fit ' + MEO.SLOTS[slot].name.toLowerCase() });
        return false;
      }
      return Inv.equipFromBag(idx);
    },

    // ---- Consumables ------------------------------------------------------------------------
    potionCdLeft() {
      return Math.max(0, Inv.player.inv.potionCd - MEO.Engine.time);
    },

    useAt(idx) {
      const p = Inv.player;
      const b = Inv._bag()[idx];
      if (!b || !p.alive) return false;
      const it = MEO.ITEMS[b.id];
      if (it.kind === 'weapon' || it.kind === 'armor') return Inv.equipFromBag(idx);
      if (it.kind !== 'consumable') return false;
      const u = it.use;
      const fail = function (t) {
        Events.emit('inv:fail', { text: t });
        return false;
      };
      if (u.ooc && p.inCombat) return fail('Cannot be used in combat');
      if (u.cd && Inv.potionCdLeft() > 0) return fail('Potion is not ready (' + Math.ceil(Inv.potionCdLeft()) + ' s)');
      if (u.type === 'heal') {
        if (p.stats.hp >= p.stats.maxHp) return fail('You are at full health');
        MEO.Combat.heal(p, p, { base: u.amount * (u.ooc ? 1 + MEO.raceSpecial(p.raceId, 'foodHeal') : 1), coef: 0, noCrit: true });
      } else if (u.type === 'res') {
        const s = p.stats;
        if (!s.maxRes || s.resType === 'none') return fail('No resource to restore');
        if (s.res >= s.maxRes) return fail('Your resource is full');
        s.res = Math.min(s.maxRes, s.res + s.maxRes * u.pct);
      }
      if (u.cd) p.inv.potionCd = MEO.Engine.time + u.cd;
      Inv.removeAt(idx, 1);
      Events.emit('item:use', { item: it });
      return true;
    },

    /** Best consumable of a kind (for the quick buttons 9 and 0). */
    findUsable(type) {
      const bag = Inv._bag();
      let best = -1;
      let bestV = -1;
      for (let i = 0; i < bag.length; i++) {
        const b = bag[i];
        if (!b) continue;
        const it = MEO.ITEMS[b.id];
        if (it.kind !== 'consumable' || it.use.type !== type) continue;
        const v = it.use.amount || it.use.pct * 1000;
        // use the smallest that still restores plenty – otherwise the best
        if (best < 0 || v < bestV) {
          best = i;
          bestV = v;
        }
      }
      return best;
    },

    quickCount(type) {
      let n = 0;
      Inv._bag().forEach(function (b) {
        if (!b) return;
        const it = MEO.ITEMS[b.id];
        if (it.kind === 'consumable' && it.use.type === type) n += b.n;
      });
      return n;
    },

    quickUse(type) {
      const i = Inv.findUsable(type);
      if (i < 0) {
        Events.emit('inv:fail', { text: type === 'heal' ? 'No healing potions' : 'No resource potions' });
        return false;
      }
      return Inv.useAt(i);
    },

    // ---- Trade -------------------------------------------------------------------------
    buyPrice(id) {
      const it = MEO.ITEMS[id];
      return it.buy || it.price * 4;
    },

    sellAt(idx, all) {
      const p = Inv.player;
      const b = Inv._bag()[idx];
      if (!b) return 0;
      const it = MEO.ITEMS[b.id];
      const n = all ? b.n : 1;
      const gain = it.price * n;
      Inv.removeAt(idx, n);
      p.inv.gold += gain;
      Events.emit('inv:change', p);
      Events.emit('item:sell', { item: it, n: n, gold: gain });
      return gain;
    },

    sellJunk() {
      const bag = Inv._bag();
      let total = 0;
      for (let i = 0; i < bag.length; i++) {
        if (bag[i] && MEO.ITEMS[bag[i].id].q === 0) total += Inv.sellAt(i, true);
      }
      return total;
    },

    buy(id, n) {
      const p = Inv.player;
      n = n || 1;
      const cost = Inv.buyPrice(id) * n;
      if (p.inv.gold < cost) {
        Events.emit('inv:fail', { text: 'Not enough money' });
        return false;
      }
      if (!Inv.canAdd(id, n)) {
        Events.emit('inv:fail', { text: 'Your backpack is full' });
        return false;
      }
      p.inv.gold -= cost;
      Inv.add(id, n);
      Events.emit('item:buy', { item: MEO.ITEMS[id], n: n, gold: cost });
      return true;
    }
  });

  // When the class is chosen or changed: new base and new starter kit
  Events.on('class:change', function (e) {
    if (e.type !== 'player') return;
    Inv.player = e;
    Inv.captureBase(e);
    Inv.reset(e);
  });
})();
