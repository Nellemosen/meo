/* ==========================================================================
   data/book4.js – Second Age correction.

   The story was re-skinned to The Rings of Power, but Book IV still had the shape of
   Third Age Moria: a dead city full of goblins, a cave troll and a Balrog. In the Second
   Age Khazad-dûm is at its height — Durin IV's living kingdom, the forges, the mithril.
   So:
     · Khazad-dûm becomes a friendly hub and the end of Book III. The only danger is the
       deep delve, where the digging went too far and something came up the shaft.
     · Book IV becomes what the age actually turns on: Adar's host marching on the
       Southlands, the hilt that is a key, and the waking of Orodruin.
   Loaded after zones.js / story.js / the lore overlay, so it has the last word.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const ID = MEO.TILE_ID;
  const area = function (id, name, kind, x, y, w, h, extra) {
    return Object.assign({ id: id, name: name, kind: kind, x: x, y: y, w: w, h: h }, extra || {});
  };
  const group = function (name, at, r, mobs) { return { name: name, at: at, r: r, mobs: mobs }; };
  const kill = function (mobs, n, label) { return { type: 'kill', mobs: mobs, n: n, label: label }; };
  const collect = function (item, n, from, chance, label) { return { type: 'collect', item: item, n: n, from: from, chance: chance, label: label }; };
  const explore = function (a, label) { return { type: 'explore', area: a, label: label }; };
  const talk = function (npc, label) { return { type: 'talk', npc: npc, label: label }; };
  const PACE = { speed: 0.7, hp: 1.5 };

  function addMobs(defs) {
    Object.keys(defs).forEach(function (id) {
      const m = defs[id];
      if (m.speed > 0) m.speed = Math.round(m.speed * PACE.speed);
      if (!m.boss && m.hp) m.hp = Math.round(m.hp * PACE.hp);
      MEO.MOBS[id] = m;
    });
  }

  function addQuests(list) {
    list.forEach(function (q) {
      if (MEO.QUEST_BY_ID[q.id]) return;
      MEO.QUESTS.push(q);
      MEO.QUEST_BY_ID[q.id] = q;
    });
  }

  const patch = function (id, o) { const q = MEO.QUEST_BY_ID[id]; if (q) Object.assign(q, o); };

  // ======================================================================
  //  1) Khazad-dûm: a living kingdom, not a tomb
  // ======================================================================
  addMobs({
    deep_crawler: {
      id: 'deep_crawler', name: 'Deep Crawler', level: 21, hp: 760, armor: 560, resist: 0.08, radius: 13,
      shape: 'spider', color: '#2a2630', trim: '#6a5a7a', scale: 1.15,
      speed: 150, aggro: 170, leash: 520, social: 150, family: 'crawler', behavior: 'aggressive', wander: 50,
      attack: { dmg: 24, interval: 2.2, range: 26, fx: { kind: 'slash', color: '#9a86b8' } },
      respawn: 80, corpse: 10, loot: 'orc2', gold: [26, 52]
    },
    deep_gnawer: {
      id: 'deep_gnawer', name: 'The Nameless Gnawer', level: 24, hp: 8200, armor: 950, resist: 0.14, radius: 22,
      shape: 'spider', color: '#1c1a24', trim: '#7a6a3a', scale: 2.6,
      speed: 118, aggro: 240, leash: 780, social: 0, family: 'crawler', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 42, interval: 2.6, range: 40, fx: { kind: 'slash', color: '#b8a86a' } },
      specials: [],
      boss: {
        intro: 'Something vast shifts in the dark below. It has no name, and it was here before the Dwarves.',
        outro: 'The thing withdraws down the shaft. It is not dead. It is only gone.',
        phases: [
          { at: 0.60, say: 'The shaft spills crawlers!', adds: { mob: 'deep_crawler', n: 3 } },
          { at: 0.28, say: 'The dark presses in and the air turns cold.', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [430, 700]
    },
    // ---- Book IV: Adar's host ----
    ash_marauder: {
      id: 'ash_marauder', name: 'Marauder of Adar', level: 25, hp: 980, armor: 700, resist: 0.08, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#2e2a30', trim: '#9a3418', skin: '#6a8a46', hair: '#121212', scale: 1.08, weapon: true,
      speed: 142, aggro: 190, leash: 560, social: 200, family: 'orc', behavior: 'aggressive', wander: 60,
      attack: { dmg: 30, interval: 2.2, range: 28, fx: { kind: 'slash', color: '#e0b890' } },
      respawn: 75, corpse: 10, loot: 'orc2', gold: [34, 68]
    },
    ash_houndmaster: {
      id: 'ash_houndmaster', name: 'Houndmaster of Adar', level: 26, hp: 1240, armor: 780, resist: 0.1, radius: 13,
      shape: 'humanoid', style: 'orcBrute', color: '#34303a', trim: '#b04020', skin: '#5f8040', hair: '#101010', scale: 1.22, weapon: true,
      speed: 138, aggro: 200, leash: 600, social: 220, family: 'orc', behavior: 'aggressive', wander: 55,
      attack: { dmg: 36, interval: 2.4, range: 30, fx: { kind: 'slash', color: '#e8c0a0' } },
      respawn: 90, corpse: 12, loot: 'orc2', gold: [50, 96]
    },
    magrot: {
      id: 'magrot', name: 'Magrot, Warleader of Adar', level: 28, hp: 12400, armor: 1150, resist: 0.16, radius: 24,
      shape: 'humanoid', style: 'orcBrute', color: '#2a2430', trim: '#c04a18', skin: '#587a3e', hair: '#0c0c0c', scale: 1.9, weapon: true,
      speed: 120, aggro: 260, leash: 820, social: 0, family: 'orc', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 52, interval: 2.5, range: 42, fx: { kind: 'slash', color: '#ffb070' } },
      specials: [],
      boss: {
        intro: 'Adar gave me this valley. Go back to your little village and tell them it is ours now.',
        outro: 'Magrot falls. Far above, the mountain answers with a sound like the world splitting.',
        phases: [
          { at: 0.70, say: 'Magrot whistles, and the marauders come running!', adds: { mob: 'ash_marauder', n: 3 } },
          { at: 0.40, say: 'Ash rains down and the ground glows underfoot.', adds: { mob: 'ash_houndmaster', n: 1 } },
          { at: 0.18, say: 'Magrot roars and fights like a cornered beast.', enrage: true }
        ]
      },
      respawn: 1200, corpse: 60, loot: 'boss', gold: [700, 1100]
    }
  });

  MEO.ITEMS.q_sword_hilt = {
    id: 'q_sword_hilt', name: 'Shard of the Broken Hilt', kind: 'quest', q: 2, stack: 10, price: 0,
    icon: '🗝', desc: 'Black metal, warm to the touch. It is not a sword. It is a key.'
  };
  MEO.ITEMS.q_mithril_ore = {
    id: 'q_mithril_ore', name: 'Shard of Mithril', kind: 'quest', q: 2, stack: 10, price: 0,
    icon: '✨', desc: 'Lighter than a feather, and it holds the light of a star.'
  };

  // ---- the zone itself -------------------------------------------------
  const KZ = MEO.ZONES.moria;
  if (KZ) {
    KZ.name = 'Khazad-dûm – The Kingdom under the Mountain';
    KZ.spec.name = KZ.name;
    const AREA_NAMES = {
      mo_gate: 'The Great Gate', mo_halls: 'The Hall of Pillars',
      mo_tomb: 'The Mithril Vein', mo_bridge: 'The Deep Delve',
      road_west: 'The Road to Eregion'
    };
    (KZ.spec.areas || []).forEach(function (a) { if (AREA_NAMES[a.id]) a.name = AREA_NAMES[a.id]; });
    // the halls are a city now, not a ruin to fight through
    (KZ.spec.areas || []).forEach(function (a) { if (a.id === 'mo_halls') a.kind = 'town'; });

    KZ.npcs = [
      { npcId: 'gimli', name: 'Durin IV, Prince of Khazad-dûm', style: 'smith', tile: [28, 22], color: '#5a3f2e', trim: '#d8b45a', hair: '#8a3a1a', skin: '#d8a880', scale: 0.9,
        voice: { who: 'male', pitch: 0.68, rate: 0.95 },
        lines: ['Welcome to Khazad-dûm. Mind the step, and mind your manners: my father is in a mood.',
                'The Elves want mithril and they want it yesterday. My father says the mountain decides, not Lindon.',
                'We dig deeper than any Dwarf has dug. I tell myself the stone would say if it minded.'] },
      { npcId: 'bilbo', name: 'Disa, Princess of Khazad-dûm', style: 'mage', tile: [31, 25], color: '#6a3a4a', trim: '#e0c070', hair: '#4a2a18', skin: '#d8a880', scale: 0.88,
        voice: { who: 'female', pitch: 1.0, rate: 0.95 },
        lines: ['Stone-singing is listening, not shouting. The mountain answers if you ask it kindly.',
                'I sang to the new shaft last week and it would not answer me. That has never happened before.'] },
      { npcId: 'nar', name: 'Nár the Delver', style: 'smith', tile: [16, 25], color: '#6a4a38', trim: '#c8a868', hair: '#8a7a6a', skin: '#d8a880', scale: 0.88,
        voice: { who: 'male', pitch: 0.7, rate: 0.95 },
        lines: ['Four hundred fathoms and still the vein runs on. It is a wonder. It is also further than anyone has been.'] },
      { npcId: 'halbarad', name: 'Bronwyn, Leader of the Wayfarers', style: 'hunter', tile: [14, 22], color: '#5a4a38', trim: '#c0a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
        voice: { who: 'female', pitch: 1.05, rate: 0.97 },
        lines: ['I have never stood under so much stone. I keep looking up.', 'The caravans are safe. Our work here is nearly done.'] },
      { npcId: 'wt_scout', name: 'Scout Mirieth', style: 'hunter', tile: [12, 20], color: '#5a6a4a', trim: '#c0b080', hair: '#7a4a2a', skin: '#e0b890', weapon: true,
        voice: { who: 'female', pitch: 1.15, rate: 1.05 },
        lines: ['Listen. Under the hammers, under the singing. There is a sound down there that is none of ours.'] }
    ];
    KZ.spawns = [
      group('The Deep Delve', [44, 22], 5, [{ mob: 'deep_crawler', n: 5 }]),
      group('The Lower Shaft', [55, 24], 5, [{ mob: 'deep_crawler', n: 5 }])
    ];
    KZ.bosses = [{ mob: 'deep_gnawer', point: 'bossSpot2', group: 'Gnawer' }];
    // a working kingdom: forges and lanterns instead of grave-goods
    KZ.spec.props = [
      { kind: 'lantern', tx: 10, ty: 21 }, { kind: 'lantern', tx: 10, ty: 26 }, { kind: 'fire', tx: 14, ty: 24 },
      { kind: 'crate', tx: 8, ty: 20 }, { kind: 'barrel', tx: 9, ty: 20 },
      { kind: 'pillar', tx: 27, ty: 14 }, { kind: 'pillar', tx: 33, ty: 14 }, { kind: 'pillar', tx: 27, ty: 28 }, { kind: 'pillar', tx: 33, ty: 28 },
      { kind: 'fire', tx: 29, ty: 18 }, { kind: 'crate', tx: 30, ty: 19 }, { kind: 'barrel', tx: 26, ty: 24 },
      { kind: 'lantern', tx: 30, ty: 21 }, { kind: 'lantern', tx: 30, ty: 27 },
      { kind: 'banner', tx: 25, ty: 22, c: [180, 150, 70] }, { kind: 'banner', tx: 35, ty: 22, c: [180, 150, 70] },
      { kind: 'stone', tx: 44, ty: 18 }, { kind: 'crate', tx: 42, ty: 24 }, { kind: 'lantern', tx: 41, ty: 22 },
      { kind: 'lantern', tx: 52, ty: 22 }
    ];
  }

  // ======================================================================
  //  2) A new zone: Orodruin and the ash country below it
  // ======================================================================
  const OR_SPEC = {
    w: 64, h: 48, id: 'orodruin', name: 'The Southlands – Orodruin',
    salt: 909,
    theme: {
      grass: [0.42, 0.36, 0.32], tree: [0.4, 0.34, 0.3], rock: [0.6, 0.52, 0.5],
      path: [0.62, 0.54, 0.5], mount: [0.55, 0.45, 0.42], roofs: [[80, 56, 44]],
      ash: true, mood: { fog: [0.30, 0.17, 0.12], zen: [0.18, 0.08, 0.06], sun: 0.75, amb: 1.1 }
    },
    terrain: { treeF: 0.05, rocky: 0.8, rockR: 0.96 },
    clears: [[4, 18, 16, 12], [24, 14, 18, 20], [44, 10, 16, 22]],
    houses: [],
    fills: [[6, 22, 10, 4, ID.PATH], [26, 22, 14, 4, ID.PATH]],
    paths: [[[2, 23], [26, 23], [44, 22], [58, 20]], [[48, 10], [48, 32]]],
    areas: [
      area('or_camp', 'The Last Camp', 'town', 4, 18, 16, 12, { flat: 0.1 }),
      area('or_road', 'The Ash Road', 'wild', 24, 14, 18, 20),
      area('or_slope', 'The Slopes of Orodruin', 'wild', 44, 10, 16, 22),
      area('or_summit', 'The Fire of Orodruin', 'wild', 50, 14, 8, 8),
      area('road_west', 'The Road to the Ashen Hills', 'portal', 2, 22, 2, 4, { to: 'weathertop', entry: 'east' })
    ],
    points: { spawn: { tx: 10, ty: 23 }, bossSpot: { tx: 54, ty: 18 } },
    entries: { west: { tx: 6, ty: 23 } },
    props: [
      { kind: 'fire', tx: 9, ty: 26 }, { kind: 'tent', tx: 7, ty: 27, c: [92, 72, 58] }, { kind: 'tent', tx: 14, ty: 27, c: [92, 72, 58] },
      { kind: 'lantern', tx: 12, ty: 22 }, { kind: 'crate', tx: 8, ty: 21 }, { kind: 'barrel', tx: 9, ty: 21 },
      { kind: 'stone', tx: 30, ty: 18 }, { kind: 'stone', tx: 36, ty: 27 }, { kind: 'fire', tx: 33, ty: 22 },
      { kind: 'banner', tx: 40, ty: 20, c: [150, 50, 30] },
      { kind: 'stone', tx: 50, ty: 14 }, { kind: 'stone', tx: 56, ty: 22 }, { kind: 'fire', tx: 53, ty: 19 }
    ]
  };
  MEO.ZONES.orodruin = {
    id: 'orodruin', name: OR_SPEC.name, spec: OR_SPEC,
    npcs: [
      { npcId: 'wt_scout', name: 'Scout Mirieth', style: 'hunter', tile: [11, 22], color: '#5a6a4a', trim: '#c0b080', hair: '#7a4a2a', skin: '#e0b890', weapon: true,
        voice: { who: 'female', pitch: 1.15, rate: 1.05 },
        lines: ['The ash falls warm. Do not drink from anything that steams.',
                'Their camp is up the road. Magrot keeps it. He is Adar\'s, and he is proud of it.'] },
      { npcId: 'halbarad', name: 'Bronwyn, Leader of the Wayfarers', style: 'hunter', tile: [9, 24], color: '#5a4a38', trim: '#c0a878', hair: '#3a2a1c', skin: '#d6a982', weapon: true,
        voice: { who: 'female', pitch: 1.05, rate: 0.97 },
        lines: ['This was farmland a month ago. My son learned to walk on that road.',
                'We hold here. Not because we can win, but because the people behind us are still running.'] }
    ],
    spawns: [
      group('Ash Road Marauders', [30, 20], 6, [{ mob: 'ash_marauder', n: 5 }]),
      group('Road Hounds', [34, 26], 5, [{ mob: 'dark_warg', n: 4 }, { mob: 'ash_marauder', n: 2 }]),
      group('The Slopes', [48, 16], 6, [{ mob: 'ash_marauder', n: 4 }, { mob: 'ash_houndmaster', n: 1 }]),
      group('The Burning Stair', [52, 26], 5, [{ mob: 'ash_marauder', n: 4 }])
    ],
    bosses: [{ mob: 'magrot', point: 'bossSpot', group: 'Magrot' }],
    build(seed) { return MEO.World.generateStart(OR_SPEC, seed); }
  };

  // the Ashen Hills gain a road south to the mountain
  const WT = MEO.ZONES.weathertop;
  if (WT && WT.spec && WT.spec.areas && !WT.spec.areas.some(function (a) { return a.id === 'road_south'; })) {
    WT.spec.areas.push(area('road_south', 'The Road to Orodruin', 'portal', 28, 44, 4, 2, { to: 'orodruin', entry: 'west' }));
    WT.spec.entries = Object.assign({ south: { tx: 30, ty: 42 } }, WT.spec.entries);
    (WT.spec.paths || []).push([[30, 23], [30, 44]]);
  }

  // ======================================================================
  //  3) Book III now ends in Khazad-dûm — as a guest, not an invader
  // ======================================================================
  patch('m_m_enter', {
    name: 'The Gate of Khazad-dûm', giver: 'halbarad', turnin: 'nar', level: 21,
    text: 'The Gate stands open and the Dwarves have let us in. Mind yourself in there: this is not a ruin to be picked over, it is somebody\'s home, and the richest kingdom under the sky. Nár the Delver is waiting past the gate. He will show you the halls.',
    progress: 'Pass through the Great Gate and find Nár.',
    done: 'So. A Man in Khazad-dûm. Come in, come in. Look up — go on, look up. Every stair of it cut by hand. We have been at this a while.',
    objectives: [explore('mo_gate', 'Enter the Great Gate')]
  });
  patch('m_m_goblins', {
    name: 'What Came Up the Shaft', giver: 'nar', turnin: 'nar', level: 22,
    text: 'We dug too greedily and too deep, and something came up to meet us. Pale things, many legs, and they do not like the light. Three delvers are hurt and the lower galleries are shut. Clear them out, and I will not ask what a Man wants with our tunnels.',
    progress: 'The crawlers infest the Mithril Vein and the Deep Delve, east of the halls.',
    done: 'Quiet again. Good. Do not tell the Prince how many there were. He has enough on his plate with his father.',
    objectives: [kill(['deep_crawler'], 9, 'Deep Crawlers slain')]
  });
  patch('m_m_pages', {
    name: 'The Ledger of the Deep', giver: 'nar', turnin: 'nar', level: 22,
    text: 'Every vein we cut goes in the ledger: depth, direction, what the stone sounded like. The crawlers dragged the last pages into their nests. Without them nobody can say how deep the new shaft truly runs, and I would very much like to know.',
    progress: 'The crawlers carry the pages in the lower galleries.',
    done: '...four hundred fathoms, and then a hand that is not a hand in the margin, and nothing after. The delver who wrote this did not come back up. I will take it to the Prince myself.',
    objectives: [collect('q_mazarbul_page', 4, ['deep_crawler'], 0.6, 'Pages of the Dwarven Ledger')]
  });
  patch('m_m_tomb', {
    name: 'The Mithril Vein', giver: 'gimli', turnin: 'gimli', level: 23,
    text: 'You have heard the Elves talk about it. Now come and see it. Mithril. My father calls it a light that should stay in the dark, and Lindon calls it their salvation, and I am caught in the middle of them. Walk the vein with me. Bring me back a shard, so Celebrimbor has something to work with.',
    progress: 'The Mithril Vein lies east of the Hall of Pillars.',
    done: 'There. A river of silver in black rock. Beautiful, is it not? My father is right that it is dangerous, and Elrond is right that it is needed, and I have to choose. I hate that.',
    objectives: [explore('mo_tomb', 'Walk the Mithril Vein'), collect('q_mithril_ore', 2, ['deep_crawler'], 0.5, 'Shards of Mithril')]
  });
  patch('m_m_troll', {
    name: 'The Nameless Gnawer', giver: 'bilbo', turnin: 'bilbo', level: 24,
    text: 'I sang to the new shaft and it did not answer. Something down there is eating the sound. Nár\'s crawlers were only its vermin. Take your company down the Deep Delve and put an end to it, before my husband decides to go himself.',
    progress: 'The thing waits at the bottom of the Deep Delve, east of the vein.',
    done: 'It is gone, not dead. I could hear it going down and down and never stopping. The mountain is singing again, but it sings like someone with a hand over their mouth.',
    objectives: [{ type: 'kill', mobs: ['deep_gnawer'], n: 1, label: 'The Nameless Gnawer driven off' }]
  });
  patch('m_m_bridge', {
    name: 'Durin\'s Judgement', giver: 'gimli', turnin: 'gimli', level: 25,
    text: 'My father has given his word: the digging stops at the vein and goes no deeper. The mithril the Elves need is already cut, and the caravans are yours to guard home. Come and hear it said properly, in the Hall, with the horns. You have earned a place at the back of that hall.',
    progress: 'Hear Durin IV in the Hall of Pillars.',
    done: 'There it is, then. The rings will be made, Eregion will have its mithril, and the shaft stays shut. Book III is complete: the forge has what it needs and Khazad-dûm keeps its depths. Go home, Wayfarer — and go quickly. A rider came in this morning, and he was grey with ash.',
    objectives: [talk('gimli', 'Hear Durin IV in the Hall of Pillars')]
  });

  // ======================================================================
  //  4) Book IV: The Fire of Orodruin
  // ======================================================================
  const CLASS_ITEM = { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' };
  addQuests([
    {
      id: 'm_o_word', name: 'The Rider from the South', giver: 'gimli', turnin: 'halvard', level: 25,
      requires: 'm_m_bridge', story: true,
      text: 'The rider came from the Southlands, and he got three words out before he fell: Adar is marching. Tirharad lies in his road. You know that village, and they know you. Take the west road and ride, Wayfarer. We will send what we can, but the mountains are slow and war is fast.',
      progress: 'Take the long road west and south, back to Tirharad, and find Captain Arondir.',
      done: 'You came back. I had hoped you would not — there is nothing here worth coming back for now. Adar\'s host is three days out and we are forty, counting the children.',
      objectives: [explore('village', 'Return to Tirharad')],
      reward: { xp: 18000, gold: 5200, items: [['potion_heal', 4], ['potion_res', 4]] }
    },
    {
      id: 'm_o_muster', name: 'Forty Against the Dark', giver: 'halvard', turnin: 'halvard', level: 25,
      requires: 'm_o_word', story: true,
      text: 'His scouts are already in the fields, burning what they cannot carry so we cannot eat it. If we break the scouts, the host comes in blind and slow, and slow is all I am asking for. Take your company out and clear the fields.',
      progress: 'Adar\'s marauders are in the fields around Tirharad.',
      done: 'Blind and slow. Good. It buys us a day, and a day is a great deal when you have forty people and no walls.',
      objectives: [kill(['ash_marauder'], 10, 'Marauders of Adar slain')],
      reward: { xp: 19000, gold: 5600, itemByClass: CLASS_ITEM }
    },
    {
      id: 'm_o_hilt', name: 'The Hilt is a Key', giver: 'gandalf', turnin: 'gandalf', level: 26,
      requires: 'm_o_muster', story: true,
      text: 'Adar is not here for the village. He is here for a thing the Southlanders have kept buried for an age: a broken hilt of black metal that is not a sword at all, but a key. His marauders carry shards of its like as tokens. Bring me four, and I will know how close he is to the lock.',
      progress: 'The marauders carry shards of black metal.',
      done: 'Warm. Still warm, after an age in the ground. This opens something, and what it opens lets the water in — or lets the fire out. Either way the valley does not survive it.',
      objectives: [collect('q_sword_hilt', 4, ['ash_marauder'], 0.55, 'Shards of the Broken Hilt')],
      reward: { xp: 20000, gold: 6000, items: [['potion_heal', 4], ['potion_res', 4]] }
    },
    {
      id: 'm_o_hills', name: 'The Host on the Ashen Hills', giver: 'gandalf', turnin: 'halbarad', level: 26,
      requires: 'm_o_hilt', story: true,
      text: 'Adar\'s host is camped on the Ashen Hills, east of Ostirith, and Bronwyn\'s Wayfarers are shadowing them from the old halt. Go to her. Count their fires, and do not be seen counting.',
      progress: 'Take the east road to the Wayfarers\' Halt on the Ashen Hills.',
      done: 'You made it through. I counted their fires too, and then I stopped, because the number was not useful any more. But there is a road south out of these hills, and nobody is watching it.',
      objectives: [explore('wt_camp', 'Reach the Wayfarers\' Halt')],
      reward: { xp: 21000, gold: 6400, items: [['potion_heal', 4], ['bread', 6]] }
    },
    {
      id: 'm_o_road', name: 'The Road to the Mountain', giver: 'halbarad', turnin: 'wt_scout', level: 27,
      requires: 'm_o_hills', story: true,
      text: 'The road south runs to Orodruin, the mountain the Southlanders do not name out loud. Adar\'s people have been digging there for a year, and now we know what they were digging toward. Mirieth is already down there at the last camp. Follow her, and watch the sky.',
      progress: 'Take the south road out of the Ashen Hills to the Last Camp below Orodruin.',
      done: 'You got here. Good. Now look up at it and tell me honestly whether you want to go any further, because I will not think less of you.',
      objectives: [explore('or_camp', 'Reach the Last Camp')],
      reward: { xp: 22000, gold: 6800, items: [['potion_heal', 4], ['potion_res', 4]] }
    },
    {
      id: 'm_o_ash', name: 'The Ash Road', giver: 'wt_scout', turnin: 'wt_scout', level: 27,
      requires: 'm_o_road', story: true,
      text: 'The road up to the slopes is theirs: marauders, houndmasters and the wargs they keep half-starved. We cannot climb past them and we cannot go around. Break the road open, and do it before the next column comes down it.',
      progress: 'Adar\'s companies hold the Ash Road and the slopes above it.',
      done: 'The road is ours, for about an hour. That is all we need. Bronwyn is bringing the rest up behind us.',
      objectives: [kill(['ash_marauder', 'ash_houndmaster'], 14, 'Adar\'s companies broken')],
      reward: { xp: 23000, gold: 7200, itemByClass: CLASS_ITEM }
    },
    {
      id: 'm_o_warleader', name: 'Magrot, Warleader of Adar', giver: 'halbarad', turnin: 'halbarad', level: 28,
      requires: 'm_o_ash', story: true,
      text: 'The lock is at the top of the slope and Magrot holds it. He is Adar\'s warleader and he has never lost a valley. Take everyone. Hit him together, keep off the glowing ground, and do not let him pull his companies back around you. This is the whole fight, Wayfarer. There is no second attempt.',
      progress: 'Magrot holds the lock on the slopes of Orodruin.',
      done: 'He is down, and we are still here, most of us. But the key turned anyway — somebody got to it while we were fighting. Listen. Can you hear that? That is the water going in.',
      objectives: [{ type: 'kill', mobs: ['magrot'], n: 1, label: 'Magrot, Warleader of Adar, slain' }],
      reward: { xp: 40000, gold: 14000, itemByClass: CLASS_ITEM }
    },
    {
      id: 'm_o_fire', name: 'The Fire of Orodruin', giver: 'halbarad', turnin: 'wt_scout', level: 28,
      requires: 'm_o_warleader', story: true,
      text: 'The water has gone down into the mountain and the mountain does not want it. Get everyone off the slope. Get the Southlanders onto the west road and keep them moving, and whatever happens behind you, do not stop to watch it.',
      progress: 'Climb to the fire of Orodruin and see what has been woken, then get the people out.',
      done: 'It is done. The valley is gone, the farms, the mere, Tirharad, all of it under ash, and what is left has a new name now that nobody wants to say. You brought the people out. That is the only part of this that was ever yours to win. Book IV is complete: the Southlands have fallen and Mordor is made. The great ones will answer it in their own time — and you will be a day behind them, as always.',
      objectives: [explore('or_summit', 'Witness the fire of Orodruin')],
      reward: { xp: 46000, gold: 16000, items: [['potion_heal', 6], ['potion_res', 6]] }
    }
  ]);
})();
