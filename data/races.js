/* ==========================================================================
   data/races.js – Playable races and their racial traits
   Stat traits (pct/flat on maxHp, power, armor, crit, resist, maxRes) are applied
   in systems/inventory.js (recalc). Special traits are read by systems/races.js:
     xp, gold, speed, dodge, aggro, healTaken, resRegen, fireResist, foodHeal, critBow
   Each race also has a home region (start area) used by the story in later milestones.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.RACES = {
    human: {
      id: 'human', zone: 'eriador', name: 'Man of the West', short: 'Human', home: 'gondor',
      origin: 'Gondor and Rohan',
      desc: 'Brave and adaptable. Men of the West carry the burden of Isildur\'s heir and the hope of the free peoples.',
      skin: '#e2b88f', scale: 1.0,
      traits: [
        { name: 'Indomitable Spirit', desc: '+6% maximum health.', stats: { maxHp: { pct: 0.06 } } },
        { name: 'Quick Learners', desc: '+8% experience from all sources.', special: { xp: 0.08 } },
        { name: 'Dúnedain Heritage', desc: '+3% power.', stats: { power: { pct: 0.03 } } },
        { name: 'Leaders of Men', desc: '+5% healing received.', special: { healTaken: 0.05 } }
      ]
    },
    elf: {
      id: 'elf', zone: 'imladris', name: 'Elf', short: 'Elf', home: 'rivendell',
      origin: 'Rivendell and Lothlórien',
      desc: 'Ageless and graceful, Elves see far and move lightly. Their eyes remember the first dawn.',
      skin: '#f0d4b8', scale: 1.04,
      traits: [
        { name: 'Keen Senses', desc: '+4% critical strike chance.', stats: { crit: { flat: 0.04 } } },
        { name: 'Elven Grace', desc: '+4% chance to avoid physical attacks.', special: { dodge: 0.04 } },
        { name: 'Starlit Mind', desc: '+15% resource regeneration.', special: { resRegen: 0.15 } },
        { name: 'Long Sight', desc: '+8% magic resistance.', stats: { resist: { flat: 0.08 } } }
      ]
    },
    dwarf: {
      id: 'dwarf', zone: 'eredluin', name: 'Dwarf', short: 'Dwarf', home: 'erebor',
      origin: 'Ered Luin and Erebor',
      desc: 'Stout, proud and stubborn. Dwarves are children of stone and forge, slow to anger and never forgetting.',
      skin: '#d8a880', scale: 0.86,
      traits: [
        { name: 'Stoneskin', desc: '+10% armor.', stats: { armor: { pct: 0.10 } } },
        { name: 'Mountain Constitution', desc: '+4% maximum health.', stats: { maxHp: { pct: 0.04 } } },
        { name: 'Forge-fire', desc: '-20% damage from fire.', special: { fireResist: 0.20 } },
        { name: 'Craftmanship', desc: '+10% gold from loot and quests.', special: { gold: 0.10 } }
      ]
    },
    hobbit: {
      id: 'hobbit', zone: 'shire', name: 'Hobbit', short: 'Hobbit', home: 'shire',
      origin: 'The Shire',
      desc: 'Small, quiet and surprisingly tough. Hobbits go unnoticed, eat well and are braver than anyone expects.',
      skin: '#eac6a0', scale: 0.7,
      traits: [
        { name: 'Unnoticed', desc: 'Enemies notice you from 25% less distance.', special: { aggro: 0.25 } },
        { name: 'Nimble Folk', desc: '+8% chance to avoid physical attacks.', special: { dodge: 0.08 } },
        { name: 'Second Breakfast', desc: 'Food heals 50% more.', special: { foodHeal: 0.5 } },
        { name: 'Hardy', desc: '+10% resource, -4% maximum health.', stats: { maxRes: { pct: 0.10 }, maxHp: { pct: -0.04 } } }
      ]
    }
  };
  MEO.RACE_ORDER = ['human', 'elf', 'dwarf', 'hobbit'];

  /** Sum of one special trait value for a race (0 when none). */
  MEO.raceSpecial = function (raceId, key) {
    const r = MEO.RACES[raceId];
    let v = 0;
    if (!r) return 0;
    r.traits.forEach(function (t) {
      if (t.special && t.special[key]) v += t.special[key];
    });
    return v;
  };

  /** Stat modifiers of a race as { stat: {pct, flat} }. */
  MEO.raceStats = function (raceId) {
    const out = {};
    const r = MEO.RACES[raceId];
    if (!r) return out;
    r.traits.forEach(function (t) {
      if (!t.stats) return;
      Object.keys(t.stats).forEach(function (k) {
        const o = out[k] || (out[k] = { pct: 0, flat: 0 });
        o.pct += t.stats[k].pct || 0;
        o.flat += t.stats[k].flat || 0;
      });
    });
    return out;
  };
})();
