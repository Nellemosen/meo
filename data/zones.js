/* ==========================================================================
   data/zones.js – All zones: the Westmark hub (Tirharad) and the four
   racial start zones. A zone = { id, name, build(seed), npcs, dummies, spawns,
   bosses }. Start zones are described by a spec for World.generateStart.
   Portals are areas with kind 'portal' { to, entry } (to 'home' = the player's start zone).
   NPC fields: npcId, name, style, tile [tx, ty], color, trim, hair, skin, scale, weapon, voice, lines[].
   voice = { pitch, rate, who: 'male'|'female' } for the text-to-speech narrator (v0.13).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const ID = MEO.TILE_ID;

  MEO.ZONES = {};

  // ----------------------------------------------------------------------
  //  The hub: Tirharad and the Westmark (all stories meet here)
  // ----------------------------------------------------------------------
  MEO.ZONES.westmark = {
    id: 'westmark', name: 'The Westmark',
    build(seed) { return MEO.World.generate(seed); },
    npcs: [
      { npcId: 'halvard', name: 'Marshal Halvard', style: 'marshal', tile: [23, 30], color: '#8b2f2f', trim: '#d8c48a', hair: '#bdbdbd', weapon: true,
        voice: { who: 'male', pitch: 0.8, rate: 0.95 },
        lines: ['Welcome to Tirharad, traveller. You arrive in troubled times.', 'Warg tracks have been seen near the lake, and lights glow in the old tower at night.', 'Watch yourself out there. We will soon have need of someone like you.'] },
      { npcId: 'brage', name: 'Merchant Brage', style: 'merchant', tile: [27, 31], color: '#2f6b57', trim: '#e8cd8a', hair: '#5a3a22',
        voice: { who: 'male', pitch: 1.1, rate: 1.05 },
        lines: ['Fine wares, fair prices! Come back when you have some gold in your purse.', 'Rumor has it the wargs carry goods they have plundered from caravans.'] },
      { npcId: 'torvald', name: 'Smith Torvald', style: 'smith', tile: [22, 34], color: '#5a4a3a', trim: '#a8a8b0', hair: '#2a1d12',
        voice: { who: 'male', pitch: 0.7, rate: 0.9 },
        lines: ['A fine sword is worth nothing without a hand that can wield it.', 'Bring me your gear when it needs some tending.'] },
      { npcId: 'ulf', name: 'Sentry Ulf', style: 'guard', tile: [23, 37], color: '#4a5568', trim: '#c9a24a', hair: '#7a5a3a', weapon: true, facing: Math.PI / 2,
        voice: { who: 'male', pitch: 0.9, rate: 1.0 },
        lines: ['The south gate is open, but do not venture out after nightfall.', 'The paths are safe enough, if you keep to them.'] },
      { npcId: 'gandalf', name: 'Gandalf the Grey', style: 'loremaster', tile: [25, 34], color: '#6a6e78', trim: '#c8c8d0', hair: '#d8d8d8', skin: '#e2c4a0',
        voice: { who: 'male', pitch: 0.75, rate: 0.85 },
        lines: ['A wizard is never late, nor is he early. He arrives precisely when he means to.', 'There is a shadow in the East, and it is growing.'] }
    ],
    dummies: [
      { id: 'dummy', tile: [23, 26] },
      { id: 'dummy_armored', tile: [25, 26] },
      { id: 'dummy_puncher', tile: [27, 26] }
    ],
    get spawns() { return MEO.SPAWNS; },
    bosses: [{ mob: 'warchief', point: 'bossSpot', group: 'Warchief' }]
  };

  // ----------------------------------------------------------------------
  //  Start zones (64 x 48)
  // ----------------------------------------------------------------------
  const spec = function (o) {
    return Object.assign({ w: 64, h: 48 }, o);
  };
  const addZone = function (id, name, s, npcs, spawns) {
    s.id = id;
    s.name = name;
    MEO.ZONES[id] = {
      id: id, name: name, spec: s, npcs: npcs, spawns: spawns,
      build(seed) { return MEO.World.generateStart(s, seed); }
    };
  };
  const area = function (id, name, kind, x, y, w, h, extra) {
    return Object.assign({ id: id, name: name, kind: kind, x: x, y: y, w: w, h: h }, extra || {});
  };
  const EAST = function () { return area('road_east', 'The Road to Tirharad', 'portal', 58, 22, 2, 4, { to: 'westmark', entry: 'west' }); };
  const group = function (name, at, r, mobs) { return { name: name, at: at, r: r, mobs: mobs }; };

  // ---- The Shire (Hobbit) ------------------------------------------------------
  addZone('shire', 'The Shire – Bywater', spec({
    salt: 101,
    theme: { grass: [1.08, 1.12, 0.95], tree: [1.0, 1.08, 0.95], roofs: [[96, 120, 62], [110, 86, 52], [88, 110, 72]] },
    terrain: { treeF: 0.62, lakes: [{ cx: 16, cy: 38, rx: 8, ry: 4 }] },
    clears: [[6, 10, 28, 24], [34, 18, 26, 10]],
    houses: [[11, 14, 5, 4, 13], [20, 14, 5, 4, 22], [11, 24, 5, 4, 13], [25, 24, 5, 4, 27]],
    fills: [[14, 19, 12, 4, ID.PATH]],
    paths: [[[13, 18], [13, 20]], [[22, 18], [22, 20]], [[13, 28], [13, 30], [27, 30], [27, 28]], [[20, 30], [20, 23]], [[26, 21], [40, 22], [52, 23], [58, 23]]],
    areas: [
      area('bywater', 'Bywater', 'town', 9, 12, 24, 20, { flat: 0.1 }),
      area('hill_country', 'The Green Hill Country', 'wild', 34, 4, 26, 14),
      area('east_farthing', 'The East Farthing', 'wild', 38, 18, 20, 12),
      area('old_forest_edge', 'Edge of the Old Forest', 'wild', 34, 32, 26, 12),
      EAST()
    ],
    points: { spawn: { tx: 20, ty: 21 } },
    entries: { east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'lantern', tx: 14, ty: 19 }, { kind: 'lantern', tx: 25, ty: 19 }, { kind: 'lantern', tx: 14, ty: 22 }, { kind: 'lantern', tx: 25, ty: 22 },
      { kind: 'hay', tx: 32, ty: 19 }, { kind: 'hay', tx: 33, ty: 20 }, { kind: 'barrel', tx: 19, ty: 23 }, { kind: 'barrel', tx: 20, ty: 23 }, { kind: 'crate', tx: 29, ty: 21 }
    ]
  }), [
    { npcId: 'hamfast', name: 'Hamfast Gamgee', style: 'villager', tile: [17, 21], color: '#6a7a3a', trim: '#c8b078', hair: '#6a4a2a', skin: '#eac6a0', scale: 0.72,
      voice: { who: 'male', pitch: 1.15, rate: 1.0 },
      lines: ['Mind the garden, if you please! A Gamgee takes pride in his taters.', 'Funny things, wolves in the Shire. My old dad would not believe it.'] },
    { npcId: 'rosie', name: 'Rosie Cotton', style: 'villager', tile: [21, 22], color: '#a8586a', trim: '#e8d8b0', hair: '#c8883a', skin: '#f0cfa8', scale: 0.7,
      voice: { who: 'female', pitch: 1.3, rate: 1.05 },
      lines: ['There is always a pot on the fire at The Green Dragon.', 'Strangers on the East Road, and not a friendly face among them.'] },
    { npcId: 'gandalf', name: 'Gandalf the Grey', style: 'loremaster', tile: [23, 20], color: '#6a6e78', trim: '#c8c8d0', hair: '#d8d8d8', skin: '#e2c4a0',
      voice: { who: 'male', pitch: 0.75, rate: 0.85 },
      lines: ['Hobbits really are amazing creatures. You can learn all that there is to know about their ways in a month, and yet after a hundred years they can still surprise you.'] },
    { npcId: 'maggot', name: 'Farmer Maggot', style: 'villager', tile: [30, 22], color: '#7a5a3a', trim: '#b89868', hair: '#8a8a8a', skin: '#e0b890', scale: 0.8,
      voice: { who: 'male', pitch: 0.95, rate: 0.95 },
      lines: ['Off my land! ... Oh. You are not one of those Brandybuck lads. Well, mind the dogs.'] }
  ], [
    group('Hill Pups', [44, 10], 7, [{ mob: 'wolf_pup', n: 6 }]),
    group('Hill Wolves', [52, 12], 4, [{ mob: 'young_wolf', n: 2 }]),
    group('East Farthing Ruffians', [47, 24], 6, [{ mob: 'ruffian', n: 5 }]),
    group('Forest Edge', [46, 38], 7, [{ mob: 'mirk_spiderling', n: 3 }, { mob: 'wolf_pup', n: 2 }])
  ]);

  // ---- Ered Luin (Dwarf) ---------------------------------------------------------
  addZone('eredluin', 'Ered Luin – Thorin\'s Gate', spec({
    salt: 202,
    theme: { grass: [0.92, 0.95, 0.88], tree: [0.9, 0.95, 0.9], rock: [1.15, 1.05, 0.95], mount: [1.0, 0.95, 0.95], roofs: [[110, 96, 86], [96, 86, 80]] },
    terrain: { treeF: 0.68, treeR: 0.985, rocky: 0.5, rockR: 0.985, lakes: [{ cx: 48, cy: 38, rx: 6, ry: 4 }] },
    clears: [[8, 11, 30, 24]],
    walls: [[10, 13, 24, 19]],
    houses: [[12, 15, 6, 5, 14], [26, 15, 6, 5, 28], [12, 24, 6, 5, 14], [26, 24, 6, 5, 28]],
    fills: [[16, 21, 14, 6, ID.PATH], [14, 20, 1, 1, ID.PATH], [28, 20, 1, 1, ID.PATH], [14, 29, 16, 1, ID.PATH]],
    tiles: [[22, 31, ID.PATH], [23, 31, ID.PATH], [33, 22, ID.PATH], [33, 23, ID.PATH]],
    paths: [[[22, 27], [22, 32]], [[33, 22], [46, 22], [55, 23], [58, 23]], [[14, 20], [14, 21]], [[28, 20], [28, 21]], [[14, 28], [14, 30]], [[28, 28], [28, 30]]],
    areas: [
      area('compound', 'Thorin\'s Hall', 'town', 10, 13, 24, 19, { flat: 0.1 }),
      area('old_mine', 'The Old Mine', 'wild', 38, 4, 20, 12),
      area('goblin_gap', 'Goblin Gap', 'wild', 38, 28, 20, 14),
      area('mountain_road', 'The Mountain Road', 'wild', 36, 16, 20, 10),
      EAST()
    ],
    points: { spawn: { tx: 22, ty: 23 } },
    entries: { east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'lantern', tx: 17, ty: 21 }, { kind: 'lantern', tx: 29, ty: 21 }, { kind: 'lantern', tx: 17, ty: 26 }, { kind: 'lantern', tx: 29, ty: 26 },
      { kind: 'banner', tx: 21, ty: 21, c: [150, 50, 40] }, { kind: 'banner', tx: 25, ty: 21, c: [150, 50, 40] },
      { kind: 'barrel', tx: 19, ty: 29 }, { kind: 'barrel', tx: 20, ty: 29 }, { kind: 'crate', tx: 26, ty: 29 },
      { kind: 'stone', tx: 40, ty: 20 }, { kind: 'stone', tx: 42, ty: 26 }
    ]
  }), [
    { npcId: 'balin', name: 'Balin, Lord of the Gate', style: 'smith', tile: [22, 22], color: '#8a3a30', trim: '#d8b868', hair: '#d0d0d0', skin: '#d8a880', scale: 0.88,
      voice: { who: 'male', pitch: 0.7, rate: 0.9 },
      lines: ['Our halls are old, but our memory is older.', 'Mind the deep places. Not all that sleeps there is stone.'] },
    { npcId: 'dwalin', name: 'Dwalin the Axe-warden', style: 'guard', tile: [18, 24], color: '#4a4a58', trim: '#c0a060', hair: '#3a2a1c', skin: '#d8a880', scale: 0.88, weapon: true,
      voice: { who: 'male', pitch: 0.6, rate: 1.0 },
      lines: ['Keep your axe sharp and your wits sharper.', 'Goblins do not scare a dwarf. They merely annoy him.'] },
    { npcId: 'oin', name: 'Óin the Lore-keeper', style: 'smith', tile: [26, 24], color: '#5a6a5a', trim: '#b8b8c0', hair: '#e0e0e0', skin: '#d8a880', scale: 0.86,
      voice: { who: 'male', pitch: 0.8, rate: 0.85 },
      lines: ['I read the stars and the stones. Both speak of change.'] },
    { npcId: 'bofur', name: 'Bofur the Miner', style: 'smith', tile: [24, 26], color: '#7a5a3a', trim: '#a8a8b0', hair: '#4a3020', skin: '#d8a880', scale: 0.86,
      voice: { who: 'male', pitch: 0.85, rate: 1.1 },
      lines: ['Honest work, mining. Dark, but honest.'] }
  ], [
    group('Mine Spiderlings', [46, 9], 7, [{ mob: 'mirk_spiderling', n: 7 }]),
    group('Gap Goblins', [47, 34], 6, [{ mob: 'goblin_sneak', n: 6 }]),
    group('Road Wolves', [48, 20], 5, [{ mob: 'young_wolf', n: 2 }, { mob: 'wolf_pup', n: 2 }])
  ]);

  // ---- Imladris Marches (Elf) -----------------------------------------------------
  addZone('imladris', 'The Marches of Imladris', spec({
    salt: 303,
    theme: { grass: [0.86, 1.1, 0.95], tree: [0.85, 1.1, 1.0], path: [1.0, 1.0, 1.06], mount: [0.9, 1.0, 1.1], roofs: [[96, 128, 120], [120, 140, 130]] },
    terrain: { treeF: 0.5, treeR: 0.965, river: { x: 46, amp: 2.5 }, lakes: [{ cx: 14, cy: 38, rx: 7, ry: 4 }] },
    clears: [[8, 11, 28, 23], [48, 18, 12, 10]],
    houses: [[12, 14, 6, 5, 14], [22, 14, 6, 5, 24], [12, 25, 6, 5, 14], [22, 25, 6, 5, 24]],
    fills: [[14, 20, 12, 4, ID.PATH]],
    paths: [[[14, 19], [14, 20]], [[24, 19], [24, 20]], [[14, 30], [14, 32], [30, 32], [30, 22]], [[24, 30], [24, 24]], [[26, 22], [46, 23], [56, 23], [58, 23]]],
    areas: [
      area('glade_village', 'The Edge of Imladris', 'town', 10, 12, 22, 22, { flat: 0.1 }),
      area('silent_glade', 'The Silent Glade', 'wild', 33, 4, 11, 14),
      area('north_road', 'The Northern Trace', 'wild', 48, 14, 12, 8),
      area('webbed_vale', 'The Webbed Vale', 'wild', 48, 30, 12, 14),
      EAST()
    ],
    points: { spawn: { tx: 19, ty: 22 } },
    entries: { east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'lantern', tx: 13, ty: 20 }, { kind: 'lantern', tx: 26, ty: 20 }, { kind: 'lantern', tx: 13, ty: 23 }, { kind: 'lantern', tx: 26, ty: 23 },
      { kind: 'stone', tx: 19, ty: 19 }, { kind: 'stone', tx: 20, ty: 24 }, { kind: 'banner', tx: 31, ty: 21, c: [110, 150, 200] }
    ]
  }), [
    { npcId: 'lindir', name: 'Lindir the Minstrel', style: 'minstrel', tile: [17, 22], color: '#5a7aa8', trim: '#d8d8f0', hair: '#c8a868', skin: '#f0d4b8',
      voice: { who: 'male', pitch: 1.2, rate: 0.9 },
      lines: ['Do you hear it? The trees are singing softly tonight, and the song is wrong.'] },
    { npcId: 'glorfindel', name: 'Glorfindel', style: 'guard', tile: [22, 21], color: '#d0d4dc', trim: '#e0c878', hair: '#e8c878', skin: '#f0d4b8', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.9 },
      lines: ['I have seen the fall of cities. This shadow is not new, only patient.'] },
    { npcId: 'elrond', name: 'Elrond Half-elven', style: 'loremaster', tile: [20, 23], color: '#5a4a7a', trim: '#c8b8e0', hair: '#2a2018', skin: '#f0d4b8',
      voice: { who: 'male', pitch: 0.85, rate: 0.8 },
      lines: ['Much has been lost, yet not all. Remember that, whatever comes.'] }
  ], [
    group('Glade Pups', [38, 10], 5, [{ mob: 'wolf_pup', n: 6 }]),
    group('Webbed Vale', [54, 37], 7, [{ mob: 'mirk_spiderling', n: 7 }]),
    group('Northern Goblins', [54, 18], 4, [{ mob: 'goblin_sneak', n: 5 }]),
    group('Warg Scouts', [54, 28], 4, [{ mob: 'warg_scout', n: 3 }])
  ]);

  // ---- The North Downs (Man of the West) -----------------------------------------
  addZone('eriador', 'The North Downs', spec({
    salt: 404,
    theme: { grass: [0.96, 1.0, 0.82], tree: [0.95, 0.98, 0.9], roofs: [[120, 90, 60], [100, 80, 58]] },
    terrain: { treeF: 0.62, rocky: 0.6, lakes: [{ cx: 44, cy: 35, rx: 5, ry: 3 }] },
    clears: [[8, 11, 28, 24], [36, 16, 24, 14]],
    houses: [[12, 16, 6, 5, 14], [26, 16, 6, 5, 28]],
    fills: [[14, 22, 16, 5, ID.PATH]],
    paths: [[[14, 21], [14, 22]], [[28, 21], [28, 22]], [[30, 24], [40, 23], [52, 23], [58, 23]]],
    areas: [
      area('rangers_camp', 'The Rangers\' Watch', 'town', 9, 12, 26, 22, { flat: 0.1 }),
      area('barrow_hills', 'The Barrow-Downs', 'wild', 36, 3, 22, 12),
      area('greenway', 'The Greenway', 'wild', 36, 16, 20, 14),
      area('black_ford', 'The Black Ford', 'wild', 38, 30, 12, 10),
      EAST()
    ],
    points: { spawn: { tx: 22, ty: 24 } },
    entries: { east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'tent', tx: 11, ty: 28, c: [118, 96, 64] }, { kind: 'tent', tx: 14, ty: 30, c: [96, 80, 60] }, { kind: 'tent', tx: 28, ty: 29, c: [118, 96, 64] }, { kind: 'tent', tx: 31, ty: 27, c: [96, 80, 60] },
      { kind: 'fire', tx: 20, ty: 28 }, { kind: 'fire', tx: 25, ty: 29 }, { kind: 'banner', tx: 22, ty: 21, c: [80, 110, 150] },
      { kind: 'barrel', tx: 17, ty: 27 }, { kind: 'crate', tx: 18, ty: 27 }
    ]
  }), [
    { npcId: 'halbarad', name: 'Halbarad, Ranger of the North', style: 'hunter', tile: [19, 24], color: '#4a5a3a', trim: '#b8a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.95 },
      lines: ['We watch so that others may sleep. It is the way of our people.', 'The old roads are quiet. Too quiet.'] },
    { npcId: 'aldor', name: 'Aldor the Farmer', style: 'villager', tile: [26, 24], color: '#7a6a4a', trim: '#c8b890', hair: '#8a7a5a', skin: '#e0b890',
      voice: { who: 'male', pitch: 1.0, rate: 1.0 },
      lines: ['My fields lay burned, and the wind carries the ash east.'] }
  ], [
    group('Downs Wolves', [41, 8], 6, [{ mob: 'wolf_pup', n: 6 }]),
    group('Greenway Brigands', [46, 22], 6, [{ mob: 'ruffian', n: 6 }]),
    group('Barrow Edge', [52, 10], 5, [{ mob: 'young_wolf', n: 2 }, { mob: 'goblin_sneak', n: 2 }]),
    group('Ford Wargs', [44, 38], 5, [{ mob: 'warg_scout', n: 3 }])
  ]);

  // ======================================================================
  //  Book II – "The Road to Rivendell"
  // ======================================================================
  const WEST = function (to, entry) { return area('road_west', 'The Road West', 'portal', 2, 22, 2, 4, { to: to, entry: entry }); };

  // ---- Weathertop ------------------------------------------------------------------
  addZone('weathertop', 'Weathertop – Amon Sûl', spec({
    salt: 505,
    theme: { grass: [0.88, 0.95, 0.78], tree: [0.8, 0.9, 0.85], rock: [1.1, 1.08, 1.05], path: [0.95, 0.95, 0.95], mount: [0.95, 0.98, 1.05], roofs: [[96, 90, 86]], mood: { fog: [0.5, 0.52, 0.6], zen: [0.3, 0.34, 0.5], sun: 0.8, amb: 0.9 } },
    terrain: { treeF: 0.5, rocky: 0.7, rockR: 0.97, lakes: [{ cx: 24, cy: 40, rx: 5, ry: 3 }] },
    clears: [[6, 16, 20, 14], [28, 14, 28, 18], [44, 4, 14, 14]],
    houses: [[10, 19, 5, 4, 12]],
    fills: [[12, 24, 12, 4, ID.PATH]],
    paths: [[[4, 23], [30, 23], [44, 22], [56, 22], [58, 23]], [[40, 22], [48, 14], [50, 10], [50, 6]], [[12, 23], [12, 22]]],
    areas: [
      area('wt_camp', 'The Rangers\' Halt', 'town', 6, 16, 20, 14, { flat: 0.1 }),
      area('wt_approach', 'The Old Road', 'wild', 28, 14, 16, 16),
      area('wt_summit', 'The Summit of Weathertop', 'wild', 44, 4, 14, 14),
      area('wt_ruin', 'The Ruins of Amon Sûl', 'wild', 46, 8, 8, 6),
      WEST('westmark', 'east'),
      area('road_east', 'The Road to Rivendell', 'portal', 58, 22, 2, 4, { to: 'rivendell', entry: 'west' })
    ],
    points: { spawn: { tx: 14, ty: 23 }, bossSpot: { tx: 50, ty: 10 } },
    entries: { west: { tx: 6, ty: 23 }, east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'fire', tx: 16, ty: 26 }, { kind: 'fire', tx: 20, ty: 22 }, { kind: 'tent', tx: 9, ty: 27, c: [96, 90, 74] }, { kind: 'tent', tx: 22, ty: 27, c: [96, 90, 74] },
      { kind: 'lantern', tx: 13, ty: 22 }, { kind: 'lantern', tx: 21, ty: 25 },
      { kind: 'pillar', tx: 47, ty: 9 }, { kind: 'pillar', tx: 53, ty: 9 }, { kind: 'pillar', tx: 47, ty: 12 }, { kind: 'stone', tx: 50, ty: 13 }, { kind: 'stone', tx: 38, ty: 20 }
    ]
  }), [
    { npcId: 'halbarad', name: 'Halbarad, Ranger of the North', style: 'hunter', tile: [14, 21], color: '#4a5a3a', trim: '#b8a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.95 },
      lines: ['I told you the old roads were too quiet. Now they are loud, and I like it less.'] },
    { npcId: 'wt_scout', name: 'Scout Mirieth', style: 'hunter', tile: [20, 20], color: '#5a6a4a', trim: '#c0b080', hair: '#7a4a2a', skin: '#e0b890', weapon: true,
      voice: { who: 'female', pitch: 1.15, rate: 1.05 },
      lines: ['I counted nine fires on the hill last night. Then I stopped counting.'] }
  ], [
    group('Road Wargs', [36, 28], 5, [{ mob: 'dark_warg', n: 5 }]),
    group('Hill Orc Hunters', [34, 18], 5, [{ mob: 'hill_orc', n: 5 }]),
    group('Slopes of Weathertop', [46, 16], 4, [{ mob: 'hill_orc', n: 2 }, { mob: 'dark_warg', n: 2 }]),
    group('Shades of the Watchtower', [50, 6], 3, [{ mob: 'barrow_shade', n: 5 }]),
    group('Lower Slopes', [40, 8], 5, [{ mob: 'dark_warg', n: 3 }])
  ]);
  MEO.ZONES.weathertop.bosses = [{ mob: 'wraith_rider', point: 'bossSpot', group: 'Rider' }];

  // ---- Rivendell ---------------------------------------------------------------------
  addZone('rivendell', 'Rivendell – The Last Homely House', spec({
    salt: 606,
    theme: { grass: [0.84, 1.12, 0.92], tree: [0.9, 1.05, 0.85], path: [1.0, 1.0, 1.08], mount: [0.95, 1.0, 1.1], roofs: [[110, 140, 124], [128, 148, 136], [92, 120, 112]] },
    terrain: { treeF: 0.45, treeR: 0.97, river: { x: 50, amp: 2 }, lakes: [{ cx: 44, cy: 38, rx: 5, ry: 3 }] },
    clears: [[6, 10, 36, 28]],
    houses: [[10, 14, 7, 5, 13], [22, 14, 7, 5, 25], [32, 14, 7, 5, 35], [10, 26, 7, 5, 13], [24, 26, 7, 5, 27]],
    fills: [[12, 20, 26, 4, ID.PATH]],
    paths: [[[13, 19], [13, 20]], [[25, 19], [25, 20]], [[35, 19], [35, 20]], [[13, 31], [13, 33], [30, 33], [30, 24]], [[4, 22], [12, 22]], [[38, 22], [48, 22], [56, 22], [58, 23]]],
    areas: [
      area('rv_hall', 'The Hall of Fire', 'town', 20, 18, 8, 5, { flat: 0.1 }),
      area('rivendell_town', 'Rivendell', 'town', 6, 10, 36, 28, { flat: 0.1 }),
      area('rv_falls', 'The Bruinen Falls', 'wild', 44, 4, 12, 14),
      WEST('weathertop', 'east'),
      area('road_east', 'The Road to Hollin', 'portal', 58, 22, 2, 4, { to: 'hollin', entry: 'west' })
    ],
    points: { spawn: { tx: 24, ty: 22 } },
    entries: { west: { tx: 6, ty: 22 }, east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'lantern', tx: 14, ty: 20 }, { kind: 'lantern', tx: 26, ty: 20 }, { kind: 'lantern', tx: 36, ty: 20 }, { kind: 'lantern', tx: 20, ty: 24 },
      { kind: 'stone', tx: 24, ty: 19 }, { kind: 'stone', tx: 30, ty: 25 }, { kind: 'banner', tx: 21, ty: 21, c: [110, 150, 200] }, { kind: 'banner', tx: 29, ty: 21, c: [110, 150, 200] },
      { kind: 'pillar', tx: 18, ty: 23 }, { kind: 'pillar', tx: 32, ty: 23 }
    ]
  }), [
    { npcId: 'elrond', name: 'Elrond Half-elven', style: 'loremaster', tile: [24, 21], color: '#5a4a7a', trim: '#c8b8e0', hair: '#2a2018', skin: '#f0d4b8',
      voice: { who: 'male', pitch: 0.85, rate: 0.8 },
      lines: ['Welcome to my house. It has been a refuge for many, and a prison for none.', 'Rest, and let the waters of the Bruinen sing the shadow out of you.'] },
    { npcId: 'glorfindel', name: 'Glorfindel', style: 'guard', tile: [29, 23], color: '#d0d4dc', trim: '#e0c878', hair: '#e8c878', skin: '#f0d4b8', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.9 },
      lines: ['I rode out to meet the Riders at the ford. The river heeded us then, and it will again.'] },
    { npcId: 'bilbo', name: 'Bilbo Baggins', style: 'villager', tile: [20, 23], color: '#6a5a8a', trim: '#e0c890', hair: '#c0b8a8', skin: '#eac6a0', scale: 0.7,
      voice: { who: 'male', pitch: 1.25, rate: 0.95 },
      lines: ['I am writing a book, you know. There and Back Again. Or perhaps a sequel. Do you think anyone will read it?'] },
    { npcId: 'gandalf', name: 'Gandalf the Grey', style: 'loremaster', tile: [23, 22], color: '#6a6e78', trim: '#c8c8d0', hair: '#d8d8d8', skin: '#e2c4a0',
      voice: { who: 'male', pitch: 0.75, rate: 0.85 },
      lines: ['Nine walkers to set against the Nine Riders. It is a small hope, but hope is the only thing small enough to be carried across a mountain.'] },
    { npcId: 'boromir', name: 'Boromir of Gondor', style: 'guard', tile: [26, 24], color: '#6a3a30', trim: '#d8c8a0', hair: '#4a3022', skin: '#e0b890', weapon: true,
      voice: { who: 'male', pitch: 0.8, rate: 1.0 },
      lines: ['One does not simply walk into Mordor. But I will walk with you as far as the road allows.'] },
    { npcId: 'legolas', name: 'Legolas of Mirkwood', style: 'hunter', tile: [28, 22], color: '#4a6a4a', trim: '#d8d0a0', hair: '#e8d088', skin: '#f0d4b8', weapon: true,
      voice: { who: 'male', pitch: 1.1, rate: 1.0 },
      lines: ['The woods are uneasy, and they tell me nothing good. I will go where my arrows are needed.'] },
    { npcId: 'gimli', name: 'Gimli, son of Glóin', style: 'smith', tile: [30, 24], color: '#6a3a28', trim: '#c8a868', hair: '#a04a20', skin: '#d8a880', scale: 0.88,
      voice: { who: 'male', pitch: 0.65, rate: 1.0 },
      lines: ['Let me say this: no axe has ever been raised in Moria without a dwarf behind it. I shall be that dwarf.'] },
    { npcId: 'erestor', name: 'Erestor the Lore-master', style: 'loremaster', tile: [27, 20], color: '#4a5a7a', trim: '#c8d0e0', hair: '#1c1c20', skin: '#f0d4b8',
      voice: { who: 'male', pitch: 0.95, rate: 0.85 },
      lines: ['The library has an answer for every question. It is the questions people forget to ask that cost lives.'] }
  ], []);

  // ======================================================================
  //  Book III – "The Fellowship of the Ring"
  // ======================================================================
  addZone('hollin', 'Hollin – Eregion', spec({
    salt: 707,
    theme: { grass: [0.82, 0.88, 0.7], tree: [0.78, 0.86, 0.78], rock: [1.12, 1.1, 1.08], path: [0.92, 0.92, 0.94], mount: [1.0, 1.0, 1.1], roofs: [[92, 90, 90]], mood: { fog: [0.6, 0.64, 0.7], zen: [0.4, 0.48, 0.64], sun: 0.85 } },
    terrain: { treeF: 0.45, rocky: 0.8, rockR: 0.96, lakes: [{ cx: 52, cy: 41, rx: 5, ry: 3 }] },
    clears: [[6, 16, 18, 14], [26, 12, 26, 22], [40, 4, 18, 10], [38, 30, 16, 8]],
    houses: [[10, 19, 5, 4, 12]],
    fills: [[12, 24, 12, 4, ID.PATH]],
    paths: [[[4, 23], [30, 23], [44, 22], [54, 22], [56, 22], [58, 23]], [[36, 22], [44, 10], [48, 8]], [[34, 23], [40, 32], [44, 34]]],
    areas: [
      area('hol_camp', 'The Fellowship\'s Old Camp', 'town', 6, 16, 18, 14, { flat: 0.1 }),
      area('hol_ruins', 'The Ruins of Eregion', 'wild', 26, 12, 20, 18),
      area('hol_pass', 'The Redhorn Foothills', 'wild', 40, 4, 18, 10),
      area('hol_shore', 'The Moria Pool', 'wild', 38, 30, 16, 10),
      area('hol_door', 'The Doors of Durin', 'wild', 52, 20, 6, 6),
      WEST('rivendell', 'east'),
      area('road_east', 'The Doors of Durin', 'portal', 58, 22, 2, 4, { to: 'moria', entry: 'west' })
    ],
    points: { spawn: { tx: 14, ty: 23 }, bossSpot: { tx: 44, ty: 34 } },
    entries: { west: { tx: 6, ty: 23 }, east: { tx: 54, ty: 23 } },
    props: [
      { kind: 'fire', tx: 14, ty: 26 }, { kind: 'fire', tx: 19, ty: 22 }, { kind: 'tent', tx: 9, ty: 27, c: [90, 90, 96] }, { kind: 'tent', tx: 20, ty: 27, c: [90, 90, 96] },
      { kind: 'pillar', tx: 30, ty: 18 }, { kind: 'pillar', tx: 34, ty: 18 }, { kind: 'pillar', tx: 30, ty: 26 }, { kind: 'stone', tx: 38, ty: 21 },
      { kind: 'pillar', tx: 54, ty: 21 }, { kind: 'pillar', tx: 54, ty: 25 }, { kind: 'banner', tx: 55, ty: 23, c: [150, 150, 170] }
    ]
  }), [
    { npcId: 'halbarad', name: 'Halbarad, Ranger of the North', style: 'hunter', tile: [18, 24], color: '#4a5a3a', trim: '#b8a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.95 },
      lines: ['We are a day behind them, no more. That is where a rearguard belongs.', 'Their fires are cold. Cold fires tell you much, if you know how to listen.'] },
    { npcId: 'wt_scout', name: 'Scout Mirieth', style: 'hunter', tile: [14, 21], color: '#5a6a4a', trim: '#c0b080', hair: '#7a4a2a', skin: '#e0b890', weapon: true,
      voice: { who: 'female', pitch: 1.15, rate: 1.05 },
      lines: ['I found Legolas\' arrow in an oak. Nine days old, and still pointing the way.'] },
    { npcId: 'nar', name: 'Nár the Delver', style: 'smith', tile: [20, 21], color: '#6a4a38', trim: '#c8a868', hair: '#8a7a6a', skin: '#d8a880', scale: 0.88,
      voice: { who: 'male', pitch: 0.7, rate: 0.95 },
      lines: ['I know the doors of Durin as I know my father\'s face. Something has changed in the stone, though.'] }
  ], [
    group('Hollin Wolves', [34, 18], 5, [{ mob: 'hollin_wolf', n: 6 }]),
    group('Isengard Scouts', [36, 26], 5, [{ mob: 'isengard_scout', n: 5 }]),
    group('Ruins Wights', [30, 16], 4, [{ mob: 'hollin_wight', n: 4 }]),
    group('Foothill Wolves', [48, 8], 5, [{ mob: 'hollin_wolf', n: 4 }]),
    group('Door Guard', [50, 24], 3, [{ mob: 'isengard_scout', n: 3 }])
  ]);
  MEO.ZONES.hollin.bosses = [{ mob: 'watcher', point: 'bossSpot', group: 'Watcher' }];

  // ======================================================================
  //  Book IV – "The Mines of Moria"
  // ======================================================================
  addZone('moria', 'Moria – Khazad-dûm', spec({
    salt: 808,
    theme: { grass: [0.4, 0.42, 0.44], tree: [0.3, 0.32, 0.36], rock: [0.75, 0.75, 0.85], path: [0.6, 0.6, 0.68], mount: [0.5, 0.5, 0.6], roofs: [[70, 68, 74]], cave: true, mood: { fog: [0.09, 0.09, 0.14], zen: [0.05, 0.05, 0.09], sky: [0.34, 0.38, 0.55], sun: 0.5, amb: 1.5 } },
    terrain: { treeF: 2, treeR: 2, rocky: 0.55, rockR: 0.95, lakes: [{ cx: 40, cy: 40, rx: 4, ry: 2 }] },
    clears: [[6, 16, 16, 14], [24, 10, 12, 26], [38, 14, 14, 18], [52, 8, 10, 30]],
    houses: [],
    fills: [[8, 18, 12, 10, ID.FLOOR], [26, 12, 8, 22, ID.FLOOR], [40, 16, 10, 14, ID.FLOOR], [54, 10, 6, 26, ID.FLOOR]],
    paths: [[[4, 23], [28, 23], [44, 23], [56, 23]], [[30, 12], [30, 34]], [[44, 16], [44, 30]], [[56, 10], [56, 36]]],
    areas: [
      area('mo_gate', 'The West Gate of Moria', 'town', 6, 16, 16, 14, { flat: 0.1 }),
      area('mo_halls', 'The Twenty-first Hall', 'wild', 24, 10, 12, 26),
      area('mo_tomb', 'Balin\'s Tomb', 'wild', 38, 14, 14, 18),
      area('mo_bridge', 'The Bridge of Khazad-dûm', 'wild', 52, 8, 10, 30),
      area('road_west', 'The West Gate', 'portal', 2, 22, 2, 4, { to: 'hollin', entry: 'east' })
    ],
    points: { spawn: { tx: 12, ty: 23 }, bossSpot: { tx: 44, ty: 22 }, bossSpot2: { tx: 57, ty: 22 } },
    entries: { west: { tx: 6, ty: 23 } },
    props: [
      { kind: 'lantern', tx: 10, ty: 21 }, { kind: 'lantern', tx: 10, ty: 26 }, { kind: 'fire', tx: 14, ty: 24 }, { kind: 'crate', tx: 8, ty: 20 }, { kind: 'barrel', tx: 9, ty: 20 },
      { kind: 'pillar', tx: 27, ty: 14 }, { kind: 'pillar', tx: 33, ty: 14 }, { kind: 'pillar', tx: 27, ty: 28 }, { kind: 'pillar', tx: 33, ty: 28 },
      { kind: 'stone', tx: 44, ty: 18 }, { kind: 'stone', tx: 42, ty: 26 }, { kind: 'banner', tx: 48, ty: 22, c: [120, 90, 60] },
      { kind: 'pillar', tx: 54, ty: 14 }, { kind: 'pillar', tx: 54, ty: 32 }, { kind: 'lantern', tx: 52, ty: 22 }
    ]
  }), [
    { npcId: 'halbarad', name: 'Halbarad, Ranger of the North', style: 'hunter', tile: [14, 22], color: '#4a5a3a', trim: '#b8a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
      voice: { who: 'male', pitch: 0.85, rate: 0.95 },
      lines: ['I have never liked this place. Light no torch you cannot put out.', 'They came through here, and not all of them came out the other side.'] },
    { npcId: 'nar', name: 'Nár the Delver', style: 'smith', tile: [16, 25], color: '#6a4a38', trim: '#c8a868', hair: '#8a7a6a', skin: '#d8a880', scale: 0.88,
      voice: { who: 'male', pitch: 0.7, rate: 0.95 },
      lines: ['Do not look at it. It is a tomb, not a hall, and we are not the first to come looking.'] },
    { npcId: 'wt_scout', name: 'Scout Mirieth', style: 'hunter', tile: [12, 20], color: '#5a6a4a', trim: '#c0b080', hair: '#7a4a2a', skin: '#e0b890', weapon: true,
      voice: { who: 'female', pitch: 1.15, rate: 1.05 },
      lines: ['The stone is wrong here. I can hear the mountain breathing, and it is not asleep.'] }
  ], [
    group('Gate Goblins', [26, 20], 5, [{ mob: 'moria_goblin', n: 6 }]),
    group('Hall Captains', [30, 28], 4, [{ mob: 'moria_orc', n: 3 }, { mob: 'moria_goblin', n: 2 }]),
    group('Tomb Goblins', [42, 26], 4, [{ mob: 'moria_goblin', n: 5 }]),
    group('Cave Trolls', [46, 16], 3, [{ mob: 'cave_troll', n: 2 }]),
    group('Bridge Guard', [55, 30], 4, [{ mob: 'moria_orc', n: 3 }])
  ]);
  MEO.ZONES.moria.bosses = [
    { mob: 'troll_chief', point: 'bossSpot', group: 'Troll' },
    { mob: 'durins_bane', point: 'bossSpot2', group: 'Bane' }
  ];
})();
