/* ==========================================================================
   systems/traits.js – Trait points and trees (data in data/traits.js).
   You get 1 point per level above 1 (14 at level 15). Rules:
     - tier N needs 3*(N-1) points in lower tiers of the same tree
     - hybrid: your main tree (most points) is free; at most HYBRID_MAX points
       may sit in other trees, and only in tiers 1–2.
   Effects are read by Inventory.recalc (stats), Combat.modPct (traitMods) and
   Abilities (abMods: dmg, heal, cd, cost). Free respec outside combat.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const Events = MEO.Events;

  const nodes = {};
  Object.keys(MEO.TRAITS).forEach(function (c) {
    MEO.TRAITS[c].forEach(function (t) {
      t.nodes.forEach(function (n) { nodes[n.id] = n; });
    });
  });

  const Traits = (MEO.Traits = {
    HYBRID_MAX: 5,
    nodes: nodes,

    trees(classId) { return MEO.TRAITS[classId] || []; },
    total(p) { return Math.max(0, (p.level || 1) - 1); },
    rank(p, id) { return (p.traits && p.traits[id]) || 0; },

    spent(p, treeId) {
      let n = 0;
      Object.keys(p.traits || {}).forEach(function (id) {
        if (!treeId || nodes[id].tree === treeId) n += p.traits[id];
      });
      return n;
    },
    free(p) { return Traits.total(p) - Traits.spent(p); },

    /** Tree with the most points (ties: first), or null. */
    main(p, tr) {
      let best = null;
      let bn = 0;
      Traits.trees(p.classId).forEach(function (t) {
        let n = 0;
        Object.keys(tr).forEach(function (id) { if (nodes[id].tree === t.id) n += tr[id]; });
        if (n > bn) { bn = n; best = t; }
      });
      return best;
    },

    /** Returns null when `tr` (id → rank) is legal, otherwise the reason. */
    validate(p, tr) {
      let sum = 0;
      const per = {};
      const low = {};   // points per tree per tier
      const ids = Object.keys(tr);
      for (let i = 0; i < ids.length; i++) {
        const n = nodes[ids[i]];
        const r = tr[ids[i]];
        if (!n || n.tree.split('.')[0] !== p.classId) return 'Not a trait of your class';
        if (r > n.max) return 'Maximum rank reached';
        sum += r;
        per[n.tree] = (per[n.tree] || 0) + r;
        (low[n.tree] || (low[n.tree] = {}))[n.tier] = ((low[n.tree][n.tier]) || 0) + r;
      }
      if (sum > Traits.total(p)) return 'No trait points left';
      for (let i = 0; i < ids.length; i++) {
        const n = nodes[ids[i]];
        let below = 0;
        for (let t = 1; t < n.tier; t++) below += (low[n.tree][t] || 0);
        if (below < n.req) return 'Needs ' + n.req + ' points in lower tiers of this tree';
      }
      const main = Traits.main(p, tr);
      let other = 0;
      Object.keys(per).forEach(function (tid) { if (!main || tid !== main.id) other += per[tid]; });
      if (other > Traits.HYBRID_MAX) return 'Only ' + Traits.HYBRID_MAX + ' points outside your main tree';
      for (let i = 0; i < ids.length; i++) {
        const n = nodes[ids[i]];
        if (main && n.tree !== main.id && n.tier > 2) return 'Tier 3–4 only in your main tree';
      }
      return null;
    },

    _try(p, id, delta) {
      const n = nodes[id];
      if (!n) return 'Unknown trait';
      if (p.inCombat) return 'Not in combat';
      const tr = Object.assign({}, p.traits);
      tr[id] = (tr[id] || 0) + delta;
      if (tr[id] <= 0) delete tr[id];
      if (delta < 0 && !p.traits[id]) return 'Nothing to remove';
      const why = Traits.validate(p, tr);
      return why ? { why: why } : { tr: tr };
    },

    canAdd(p, id) {
      const r = Traits._try(p, id, 1);
      return typeof r === 'string' ? r : r.why || null;
    },

    add(p, id) {
      const r = Traits._try(p, id, 1);
      if (typeof r === 'string' || r.why) return false;
      p.traits = r.tr;
      Traits.compute(p);
      return true;
    },

    remove(p, id) {
      const r = Traits._try(p, id, -1);
      if (typeof r === 'string' || r.why) return false;
      p.traits = r.tr;
      Traits.compute(p);
      return true;
    },

    reset(p) {
      if (p.inCombat) return false;
      p.traits = {};
      Traits.compute(p);
      return true;
    },

    /** Rebuild stat totals and ability modifiers from the chosen traits. */
    compute(p) {
      const stats = {};
      const mods = {};
      const ab = {};
      Object.keys(p.traits || {}).forEach(function (id) {
        const n = nodes[id];
        const r = p.traits[id];
        const e = n.eff;
        Object.keys(e).forEach(function (k) {
          if (k === 'ab') {
            const a = ab[e.ab.id] || (ab[e.ab.id] = {});
            ['dmg', 'heal', 'cd', 'cost'].forEach(function (f) { if (e.ab[f]) a[f] = (a[f] || 0) + e.ab[f] * r; });
          } else if (k === 'dd' || k === 'dt' || k === 'sp') {
            const key = k === 'dd' ? 'damageDealt' : k === 'dt' ? 'damageTaken' : 'speed';
            mods[key] = (mods[key] || 0) + e[k] * r;
          } else stats[k] = (stats[k] || 0) + e[k] * r;
        });
      });
      p.traitStats = stats;
      p.traitMods = mods;
      p.abMods = ab;
      if (MEO.Inventory && MEO.Inventory.player === p) MEO.Inventory.recalc();
      Events.emit('traits:change', p);
      if (MEO.Save && MEO.Save.markDirty) MEO.Save.markDirty();
    },

    ab(e, id, key) {
      const a = e.abMods && e.abMods[id];
      return (a && a[key]) || 0;
    },

    /** "Bulwark" – name of the main tree (what the player is playing as). */
    specName(p) {
      const m = Traits.main(p, p.traits || {});
      return m ? m.name : null;
    },

    /** Human-readable text for one rank of a node. */
    describe(n) {
      const e = n.eff;
      const out = [];
      const pc = function (v) { return (v > 0 ? '+' : '') + Math.round(v * 1000) / 10 + '%'; };
      const lab = { hp: 'maximum health', pw: 'power', ar: 'armor', mr: 'maximum resource', cr: 'critical chance', rs: 'magic resistance',
        dd: 'damage dealt', dt: 'damage taken', sp: 'movement speed' };
      Object.keys(e).forEach(function (k) {
        if (k === 'ab') {
          const nm = MEO.ABILITIES[e.ab.id].name;
          if (e.ab.dmg) out.push(nm + ': ' + pc(e.ab.dmg) + ' damage');
          if (e.ab.heal) out.push(nm + ': ' + pc(e.ab.heal) + ' healing');
          if (e.ab.cd) out.push(nm + ': ' + pc(e.ab.cd) + ' cooldown');
          if (e.ab.cost) out.push(nm + ': ' + pc(e.ab.cost) + ' cost');
        } else out.push(pc(e[k]) + ' ' + lab[k]);
      });
      return out.join(', ');
    }
  });

  // New class → fresh trait state. Save.apply restores saved traits afterwards.
  Events.on('class:change', function (e) {
    if (e && e.type === 'player') {
      e.traits = {};
      Traits.compute(e);
    }
  });
  Events.on('player:levelup', function () {
    Events.emit('traits:change', MEO.Game.player);
    const f = Traits.free(MEO.Game.player);
    if (f > 0) MEO.log('You have ' + f + ' unspent trait point' + (f > 1 ? 's' : '') + '. Press T.', 'levelup');
  });
})();
