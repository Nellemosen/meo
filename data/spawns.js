/* ==========================================================================
   data/spawns.js – Spawn groups (moved to zone files in Deliverable 5)
   Each group: center in tiles [tx, ty], radius in tiles and a list of
   { mob, n }. The spawner picks random walkable tiles outside the town.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.SPAWNS = [
    // --- Wolf packs along the roads ---
    { name: 'North Meadow', at: [30, 17], r: 6, mobs: [{ mob: 'wolf_pup', n: 4 }] },
    { name: 'East Road', at: [44, 27], r: 5, mobs: [{ mob: 'young_wolf', n: 3 }] },
    { name: 'South Meadow', at: [40, 45], r: 6, mobs: [{ mob: 'young_wolf', n: 3 }] },
    { name: 'West Wood', at: [8, 32], r: 4, mobs: [{ mob: 'wolf_pup', n: 3 }] },

    // --- Highwaymen on the roads ---
    { name: 'South Road', at: [47, 52], r: 4, mobs: [{ mob: 'footpad', n: 3 }] },
    { name: 'East of the Bridge', at: [70, 28], r: 8, mobs: [{ mob: 'bandit', n: 2 }, { mob: 'bandit_archer', n: 1 }] },
    { name: 'Crossroad', at: [36, 58], r: 4, mobs: [{ mob: 'footpad', n: 2 }, { mob: 'wolf', n: 2 }] },

    // --- Warg Camp ---
    { name: 'Camp West', at: [65, 54], r: 3, mobs: [{ mob: 'grey_wolf', n: 3 }] },
    { name: 'Camp East', at: [73, 56], r: 3, mobs: [{ mob: 'grey_wolf', n: 3 }] },
    { name: 'Heart of the Camp', at: [69, 55], r: 1, mobs: [{ mob: 'alpha_wolf', n: 1 }] },

    // --- The Fallen Tower ---
    { name: 'Tower Gate', at: [80, 21], r: 3, mobs: [{ mob: 'orc_scout', n: 2 }] },
    { name: 'Tower Courtyard', at: [78, 13], r: 3, mobs: [{ mob: 'orc_scout', n: 2 }, { mob: 'orc_brute', n: 1 }] },
    { name: 'Tower East', at: [84, 14], r: 5, mobs: [{ mob: 'orc_brute', n: 2 }] },
    { name: 'Spider Rubble', at: [76, 8], r: 3, mobs: [{ mob: 'spider', n: 3 }] },
    { name: 'Spider Rubble South', at: [82, 16], r: 4, mobs: [{ mob: 'spider', n: 2 }] }
  ];
})();
