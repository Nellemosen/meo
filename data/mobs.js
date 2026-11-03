/* ==========================================================================
   data/mobs.js – Mob types
   Training dummies (D2) + real enemies with AI (D3).
   attack.range is the distance between edges (not centers), in pixels.
   AI fields: speed (px/s; >0 = moves), aggro (px), leash (px), social (px),
   family, behavior ('aggressive' | 'defensive'), flees (health fraction), wander (px),
   specials[], loot (table id), gold [min,max] (copper), scale, rank ('rare').
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.MOBS = {
    dummy: {
      id: 'dummy',
      name: 'Training Dummy',
      level: 1,
      hp: 130,
      armor: 30,
      resist: 0.05,
      radius: 13,
      shape: 'dummy',
      color: '#d8bf72',
      trim: '#8a6038',
      respawn: 12,
      corpse: 5,
      xp: 0
    },

    dummy_armored: {
      id: 'dummy_armored',
      name: 'Armored Dummy',
      level: 1,
      hp: 130,
      armor: 160,
      resist: 0.15,
      radius: 13,
      shape: 'dummy',
      color: '#b8bcc4',
      trim: '#6c7078',
      respawn: 12,
      corpse: 5,
      xp: 0
    },

    dummy_puncher: {
      id: 'dummy_puncher',
      name: 'Punching Dummy',
      level: 1,
      hp: 160,
      armor: 60,
      resist: 0.05,
      radius: 13,
      shape: 'dummy',
      color: '#c98a6a',
      trim: '#a83a2a',
      attack: { dmg: 5, interval: 2.4, range: 34 },
      respawn: 12,
      corpse: 5,
      xp: 0
    }
  };

  // ---- New debuffs/buffs used by enemies -------------------------------
  Object.assign(MEO.BUFFS, {
    bleeding: { name: 'Bleeding', icon: '✚', color: '#d84a3a', harmful: true, duration: 8, tick: 2, tickEffect: { type: 'damage', school: 'physical', base: 3, coef: 0 }, dispel: 'physical' },
    spider_venom: { name: 'Spider Venom', icon: '☣', color: '#8fe06a', harmful: true, duration: 12, tick: 3, tickEffect: { type: 'damage', school: 'nature', base: 7, coef: 0 }, dispel: 'poison' },
    webbed: { name: 'Caught in Webbing', icon: '✳', color: '#e8e8f0', harmful: true, duration: 2.5, flags: ['root'], dispel: 'physical' },
    mob_enrage: { name: 'Fury', icon: '☠', color: '#ff5a3a', duration: 12, mods: { damageDealt: { pct: 0.3 } } }
  });

  const wolfFx = { kind: 'slash', color: '#e0c8a8' };

  Object.assign(MEO.MOBS, {
    // ------------------------- Wolves -------------------------------------
    wolf: {
      id: 'wolf', name: 'Forest Wolf', level: 8, hp: 190, armor: 120, resist: 0.02, radius: 12,
      shape: 'wolf', color: '#6e6a62', trim: '#c9c2b2', speed: 158, aggro: 170, leash: 520, social: 150,
      family: 'wolf', behavior: 'aggressive', wander: 90,
      attack: { dmg: 9, interval: 1.9, range: 20, fx: wolfFx },
      specials: [{ name: 'Rending Bite', cd: 9, kind: 'buff', buff: 'bleeding', dmgMult: 1.2, range: 22 }],
      respawn: 45, corpse: 8, loot: 'wolf', gold: [4, 14]
    },
    grey_wolf: {
      id: 'grey_wolf', name: 'Grey Warg', level: 10, hp: 270, armor: 170, resist: 0.03, radius: 13,
      shape: 'wolf', color: '#8b909a', trim: '#d4d8de', speed: 162, aggro: 190, leash: 560, social: 170,
      family: 'wolf', behavior: 'aggressive', wander: 110, scale: 1.1,
      attack: { dmg: 13, interval: 1.9, range: 22, fx: wolfFx },
      specials: [{ name: 'Rending Bite', cd: 8, kind: 'buff', buff: 'bleeding', dmgMult: 1.2, range: 24 }],
      respawn: 60, corpse: 8, loot: 'wolf2', gold: [8, 22]
    },
    alpha_wolf: {
      id: 'alpha_wolf', name: 'Shadowfang', level: 12, hp: 720, armor: 260, resist: 0.08, radius: 16,
      shape: 'wolf', color: '#2b2d38', trim: '#6a6e80', speed: 168, aggro: 210, leash: 640, social: 220,
      family: 'wolf', behavior: 'aggressive', wander: 60, scale: 1.45, rank: 'rare',
      attack: { dmg: 16, interval: 2.1, range: 26, fx: { kind: 'slash', color: '#ff9a8a' } },
      specials: [
        { name: 'Rending Bite', cd: 7, kind: 'buff', buff: 'bleeding', dmgMult: 1.3, range: 28 },
        { name: 'Alpha\'s Howl', cd: 20, kind: 'self', buff: 'mob_enrage', range: 9999, first: 6 }
      ],
      respawn: 420, corpse: 10, loot: 'alpha', gold: [60, 110]
    },

    // ------------------------- Beginner creatures (levels 1-6) ----------------------
    wolf_pup: {
      id: 'wolf_pup', name: 'Wolf Pup', level: 2, hp: 62, armor: 25, resist: 0, radius: 9,
      shape: 'wolf', color: '#7d776c', trim: '#cfc8b8', speed: 150, aggro: 120, leash: 450, social: 110,
      family: 'wolf', behavior: 'aggressive', wander: 80, scale: 0.7,
      attack: { dmg: 4, interval: 2.0, range: 18, fx: wolfFx },
      respawn: 30, corpse: 8, loot: 'pup', gold: [1, 4]
    },
    young_wolf: {
      id: 'young_wolf', name: 'Young Wolf', level: 4, hp: 125, armor: 70, resist: 0.01, radius: 11,
      shape: 'wolf', color: '#716c64', trim: '#cbc4b4', speed: 154, aggro: 150, leash: 500, social: 130,
      family: 'wolf', behavior: 'aggressive', wander: 90, scale: 0.88,
      attack: { dmg: 7, interval: 1.9, range: 20, fx: wolfFx },
      respawn: 40, corpse: 8, loot: 'young', gold: [2, 8]
    },
    footpad: {
      id: 'footpad', name: 'Footpad', level: 6, hp: 175, armor: 150, resist: 0.02, radius: 11,
      shape: 'humanoid', style: 'bandit', color: '#5d4a3a', trim: '#8c7a4a', skin: '#d6a982', hair: '#3a2a1c',
      speed: 130, aggro: 140, leash: 520, social: 150, family: 'bandit', behavior: 'aggressive', wander: 70,
      flees: 0.2,
      attack: { dmg: 9, interval: 2.1, range: 24, fx: { kind: 'slash', color: '#e8e0d0' } },
      specials: [{ name: 'Cheap Shot', cd: 11, kind: 'damage', mult: 1.6, range: 24 }],
      respawn: 50, corpse: 10, loot: 'footpad', gold: [6, 18]
    },

    // ------------------------- Bandits -------------------------------------
    bandit: {
      id: 'bandit', name: 'Highwayman', level: 9, hp: 240, armor: 230, resist: 0.03, radius: 11,
      shape: 'humanoid', style: 'bandit', color: '#6a4a36', trim: '#a88a52', skin: '#d6a982', hair: '#2f2218',
      speed: 135, aggro: 160, leash: 560, social: 180, family: 'bandit', behavior: 'aggressive', wander: 80,
      flees: 0.2,
      attack: { dmg: 11, interval: 2.0, range: 24, fx: { kind: 'slash', color: '#e8e0d0' } },
      specials: [{ name: 'Backstab', cd: 10, kind: 'damage', mult: 1.8, range: 24 }],
      respawn: 60, corpse: 10, loot: 'bandit', gold: [12, 32]
    },
    bandit_archer: {
      id: 'bandit_archer', name: 'Highwayman Archer', level: 9, hp: 170, armor: 120, resist: 0.03, radius: 11,
      shape: 'humanoid', style: 'banditArcher', color: '#4e5a3a', trim: '#9a8a52', skin: '#d6a982', hair: '#4a3322',
      speed: 135, aggro: 220, leash: 560, social: 180, family: 'bandit', behavior: 'aggressive', wander: 60,
      attack: { dmg: 12, interval: 2.4, range: 230, ranged: true, fx: { kind: 'bolt', color: '#d8c89a' } },
      specials: [{ name: 'Crippling Shot', cd: 12, kind: 'buff', buff: 'crippled', dmgMult: 1.0, range: 230 }],
      respawn: 60, corpse: 10, loot: 'bandit', gold: [10, 28]
    },

    // ------------------------- Orcs (The Fallen Tower) ---------------------------
    orc_scout: {
      id: 'orc_scout', name: 'Orc Scout', level: 11, hp: 330, armor: 330, resist: 0.05, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#3e3a40', trim: '#8a2a22', skin: '#6f8f4a', hair: '#1c1c1c', scale: 1.08,
      speed: 140, aggro: 180, leash: 560, social: 200, family: 'orc', behavior: 'aggressive', wander: 70,
      attack: { dmg: 16, interval: 2.1, range: 26, fx: { kind: 'slash', color: '#d8d0c0' } },
      specials: [{ name: 'Savage Cleave', cd: 11, kind: 'damage', mult: 1.7, range: 26 }],
      respawn: 75, corpse: 10, loot: 'orc', gold: [16, 40]
    },
    orc_brute: {
      id: 'orc_brute', name: 'Orc Brute', level: 12, hp: 480, armor: 480, resist: 0.08, radius: 14,
      shape: 'humanoid', style: 'orcBrute', color: '#2e2c30', trim: '#a0361e', skin: '#5f7f3c', hair: '#101010', scale: 1.3,
      speed: 132, aggro: 190, leash: 560, social: 200, family: 'orc', behavior: 'aggressive', wander: 50,
      attack: { dmg: 20, interval: 2.6, range: 30, fx: { kind: 'slash', color: '#e0b890' } },
      specials: [{ name: 'Crushing Blow', cd: 13, kind: 'buff', buff: 'stunned', duration: 1.6, dmgMult: 1.5, range: 30 }],
      respawn: 90, corpse: 10, loot: 'orc2', gold: [26, 62]
    },

    // ------------------------- Dungeon boss ----------------------------------
    warchief: {
      id: 'warchief', name: 'Gorthak the Warchief', level: 14, hp: 3200, armor: 700, resist: 0.12, radius: 20, xp: 520,
      shape: 'humanoid', style: 'orcBrute', color: '#241f26', trim: '#b02a14', skin: '#4f6f34', hair: '#0c0c0c', scale: 1.75,
      speed: 120, aggro: 230, leash: 760, social: 0, family: 'orc', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 24, interval: 2.4, range: 34, fx: { kind: 'slash', color: '#ffb070' } },
      specials: [],   // all abilities are scripted in ai/boss-ai.js
      boss: {
        intro: 'Who dares tread in my hall? Your bones will hold up my banner!',
        outro: 'The Tower... falls... but the Eye... sees you...',
        phases: [
          { at: 0.70, say: 'Rise, my warband! Crush them!', adds: { mob: 'orc_scout', n: 2 } },
          { at: 0.35, say: 'ENOUGH! The fire will have you all!', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [180, 320]
    },

    // ------------------------- Spiders ---------------------------------------
    spider: {
      id: 'spider', name: 'Tower Spider', level: 11, hp: 250, armor: 180, resist: 0.04, radius: 12,
      shape: 'spider', color: '#2f2a36', trim: '#8a3a52', speed: 150, aggro: 150, leash: 500, social: 130,
      family: 'spider', behavior: 'aggressive', wander: 80,
      attack: { dmg: 11, interval: 1.8, range: 20, fx: { kind: 'slash', color: '#b8e08a' } },
      specials: [
        { name: 'Web', cd: 14, kind: 'buff', buff: 'webbed', dmgMult: 0.5, range: 170, first: 3 },
        { name: 'Venomous Bite', cd: 8, kind: 'buff', buff: 'spider_venom', dmgMult: 1.1, range: 22 }
      ],
      respawn: 60, corpse: 8, loot: 'spider', gold: [8, 24]
    },

    // ------------------------- Start zone creatures (levels 3-5) -------------------
    ruffian: {
      id: 'ruffian', name: 'Ruffian', level: 3, hp: 80, armor: 40, resist: 0, radius: 11,
      shape: 'humanoid', style: 'bandit', color: '#5a4a42', trim: '#7c6a4a', skin: '#d6a982', hair: '#3a2a1c',
      speed: 125, aggro: 130, leash: 480, social: 130, family: 'bandit', behavior: 'aggressive', wander: 70,
      flees: 0.2,
      attack: { dmg: 5, interval: 2.2, range: 24, fx: { kind: 'slash', color: '#e8e0d0' } },
      respawn: 45, corpse: 10, loot: 'footpad', gold: [2, 8]
    },
    mirk_spiderling: {
      id: 'mirk_spiderling', name: 'Mirkwood Spiderling', level: 3, hp: 70, armor: 30, resist: 0, radius: 9,
      shape: 'spider', color: '#3a3040', trim: '#7a4a68', speed: 140, aggro: 120, leash: 450, social: 100,
      family: 'spider', behavior: 'aggressive', wander: 70, scale: 0.7,
      attack: { dmg: 4, interval: 1.9, range: 18, fx: { kind: 'slash', color: '#b8e08a' } },
      respawn: 40, corpse: 8, loot: 'pup', gold: [1, 5]
    },
    goblin_sneak: {
      id: 'goblin_sneak', name: 'Goblin Sneak', level: 4, hp: 95, armor: 60, resist: 0, radius: 10,
      shape: 'humanoid', style: 'orc', color: '#4a4440', trim: '#7a3a2a', skin: '#7a9a52', hair: '#1c1c1c', scale: 0.85,
      speed: 135, aggro: 140, leash: 480, social: 150, family: 'orc', behavior: 'aggressive', wander: 60,
      attack: { dmg: 6, interval: 2.0, range: 22, fx: { kind: 'slash', color: '#d8d0c0' } },
      respawn: 45, corpse: 10, loot: 'young', gold: [3, 10]
    },
    warg_scout: {
      id: 'warg_scout', name: 'Warg Scout', level: 5, hp: 130, armor: 80, resist: 0.01, radius: 11,
      shape: 'wolf', color: '#4a4a52', trim: '#aab0b8', speed: 154, aggro: 160, leash: 520, social: 140,
      family: 'wolf', behavior: 'aggressive', wander: 80, scale: 0.95,
      attack: { dmg: 8, interval: 1.9, range: 20, fx: wolfFx },
      specials: [{ name: 'Rending Bite', cd: 10, kind: 'buff', buff: 'bleeding', dmgMult: 1.1, range: 22 }],
      respawn: 55, corpse: 8, loot: 'young', gold: [4, 12]
    },

    // ------------------------- Book II: Weathertop -----------------------------
    dark_warg: {
      id: 'dark_warg', name: 'Black Warg', level: 13, hp: 330, armor: 220, resist: 0.04, radius: 13,
      shape: 'wolf', color: '#26262c', trim: '#7a2a2a', speed: 160, aggro: 170, leash: 520, social: 170,
      family: 'wolf', behavior: 'aggressive', wander: 70, scale: 1.1,
      attack: { dmg: 15, interval: 1.8, range: 22, fx: wolfFx },
      specials: [{ name: 'Rending Bite', cd: 8, kind: 'buff', buff: 'bleeding', dmgMult: 1.2, range: 24 }],
      respawn: 70, corpse: 10, loot: 'orc2', gold: [14, 34]
    },
    hill_orc: {
      id: 'hill_orc', name: 'Hill Orc Hunter', level: 13, hp: 380, armor: 300, resist: 0.05, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#3a3438', trim: '#8a3020', skin: '#6a8a46', hair: '#141414', scale: 1.05, weapon: true,
      speed: 138, aggro: 180, leash: 540, social: 190, family: 'orc', behavior: 'aggressive', wander: 60,
      attack: { dmg: 16, interval: 2.2, range: 26, fx: { kind: 'slash', color: '#e0b890' } },
      respawn: 75, corpse: 10, loot: 'orc2', gold: [18, 40]
    },
    barrow_shade: {
      id: 'barrow_shade', name: 'Shade of the Watchtower', level: 14, hp: 420, armor: 160, resist: 0.15, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#1c2430', trim: '#7ab0d8', skin: '#9ab8c8', hair: '#10161c', scale: 1.15,
      speed: 120, aggro: 150, leash: 480, social: 120, family: 'shade', behavior: 'aggressive', wander: 40,
      attack: { dmg: 17, interval: 2.4, range: 26, fx: { kind: 'slash', color: '#8ac8f0' } },
      respawn: 80, corpse: 10, loot: 'orc2', gold: [20, 44]
    },
    wraith_rider: {
      id: 'wraith_rider', name: 'The Rider of Weathertop', level: 16, hp: 4200, armor: 760, resist: 0.15, radius: 20,
      shape: 'humanoid', style: 'orcBrute', color: '#0e0e14', trim: '#5a1a2a', skin: '#2a2a34', hair: '#050508', scale: 1.7,
      speed: 125, aggro: 230, leash: 760, social: 0, family: 'shade', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 28, interval: 2.4, range: 36, fx: { kind: 'slash', color: '#b080e0' } },
      specials: [],
      boss: {
        intro: 'Where is it? The Ring! Give it to me, little ones...',
        outro: 'You cannot... destroy... the Nine...',
        phases: [
          { at: 0.70, say: 'Shadows, to me!', adds: { mob: 'barrow_shade', n: 2 } },
          { at: 0.35, say: 'Cold, and endless night, is all you will know!', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [260, 420]
    },

    // ------------------------- Book III: Hollin ---------------------------------
    hollin_wolf: {
      id: 'hollin_wolf', name: 'Hollin Wolf', level: 17, hp: 460, armor: 280, resist: 0.05, radius: 13,
      shape: 'wolf', color: '#6a6a72', trim: '#c8c8d0', speed: 164, aggro: 180, leash: 540, social: 180,
      family: 'wolf', behavior: 'aggressive', wander: 80, scale: 1.1,
      attack: { dmg: 18, interval: 1.8, range: 22, fx: wolfFx },
      specials: [{ name: 'Rending Bite', cd: 8, kind: 'buff', buff: 'bleeding', dmgMult: 1.2, range: 24 }],
      respawn: 70, corpse: 10, loot: 'orc2', gold: [20, 46]
    },
    isengard_scout: {
      id: 'isengard_scout', name: 'Isengard Scout', level: 18, hp: 520, armor: 360, resist: 0.06, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#2a2a2e', trim: '#e8e8f0', skin: '#7a7a58', hair: '#101010', scale: 1.1, weapon: true,
      speed: 140, aggro: 190, leash: 560, social: 200, family: 'orc', behavior: 'aggressive', wander: 60,
      attack: { dmg: 20, interval: 2.2, range: 26, fx: { kind: 'slash', color: '#e8e8f0' } },
      respawn: 80, corpse: 10, loot: 'orc2', gold: [26, 56]
    },
    hollin_wight: {
      id: 'hollin_wight', name: 'Eregion Wight', level: 19, hp: 560, armor: 220, resist: 0.15, radius: 12,
      shape: 'humanoid', style: 'orc', color: '#1c2430', trim: '#9ad0b0', skin: '#a8c0b0', hair: '#10161c', scale: 1.15,
      speed: 118, aggro: 150, leash: 480, social: 120, family: 'shade', behavior: 'aggressive', wander: 40,
      attack: { dmg: 22, interval: 2.4, range: 26, fx: { kind: 'slash', color: '#8af0c8' } },
      respawn: 85, corpse: 10, loot: 'orc2', gold: [30, 62]
    },
    watcher: {
      id: 'watcher', name: 'The Watcher in the Water', level: 20, hp: 6200, armor: 800, resist: 0.15, radius: 24,
      shape: 'spider', color: '#243a2e', trim: '#8ac060', speed: 105, aggro: 240, leash: 800, social: 0,
      family: 'beast', behavior: 'aggressive', wander: 0, rank: 'boss', scale: 2.4,
      attack: { dmg: 34, interval: 2.4, range: 44, fx: { kind: 'slash', color: '#8ac060' } },
      specials: [],
      boss: {
        intro: 'The water stirs. Something old and hungry has noticed you...',
        outro: 'The black water falls still.',
        phases: [
          { at: 0.65, say: 'Tendrils coil from the lake!', adds: { mob: 'hollin_wight', n: 2 } },
          { at: 0.30, say: 'The lake boils with fury!', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [320, 520]
    },

    // ------------------------- Book IV: Moria -----------------------------------
    moria_goblin: {
      id: 'moria_goblin', name: 'Moria Goblin', level: 21, hp: 560, armor: 360, resist: 0.05, radius: 11,
      shape: 'humanoid', style: 'orc', color: '#2a2622', trim: '#6a2a1a', skin: '#5a6a3e', hair: '#101010', scale: 0.95, weapon: true,
      speed: 142, aggro: 190, leash: 540, social: 220, family: 'orc', behavior: 'aggressive', wander: 50,
      attack: { dmg: 22, interval: 2.0, range: 24, fx: { kind: 'slash', color: '#d8c8a8' } },
      respawn: 70, corpse: 10, loot: 'orc2', gold: [34, 70]
    },
    moria_orc: {
      id: 'moria_orc', name: 'Moria Orc Captain', level: 22, hp: 700, armor: 480, resist: 0.07, radius: 13,
      shape: 'humanoid', style: 'orcBrute', color: '#26242a', trim: '#8a2a1a', skin: '#506a38', hair: '#0c0c0c', scale: 1.25, weapon: true,
      speed: 134, aggro: 190, leash: 560, social: 220, family: 'orc', behavior: 'aggressive', wander: 40,
      attack: { dmg: 26, interval: 2.4, range: 28, fx: { kind: 'slash', color: '#e0b890' } },
      respawn: 85, corpse: 10, loot: 'orc2', gold: [44, 90]
    },
    cave_troll: {
      id: 'cave_troll', name: 'Cave Troll', level: 23, hp: 1500, armor: 600, resist: 0.08, radius: 18,
      shape: 'humanoid', style: 'orcBrute', color: '#4a4a52', trim: '#2a2a30', skin: '#6a7a78', hair: '#202020', scale: 1.9, weapon: true,
      speed: 118, aggro: 200, leash: 600, social: 0, family: 'troll', behavior: 'aggressive', wander: 30,
      attack: { dmg: 32, interval: 2.8, range: 36, fx: { kind: 'slash', color: '#c8c8d0' } },
      specials: [{ name: 'Crushing Blow', cd: 13, kind: 'buff', buff: 'stunned', duration: 1.6, dmgMult: 1.5, range: 34 }],
      respawn: 120, corpse: 12, loot: 'orc2', gold: [70, 130]
    },
    troll_chief: {
      id: 'troll_chief', name: 'The Troll of Balin\'s Tomb', level: 24, hp: 7800, armor: 900, resist: 0.12, radius: 22,
      shape: 'humanoid', style: 'orcBrute', color: '#3a3a42', trim: '#8a8a30', skin: '#5a6a68', hair: '#101010', scale: 2.3, weapon: true,
      speed: 112, aggro: 240, leash: 780, social: 0, family: 'troll', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 40, interval: 2.6, range: 40, fx: { kind: 'slash', color: '#c8c8d0' } },
      specials: [],
      boss: {
        intro: 'BOOM. BOOM. The drums in the deep... they are coming!',
        outro: 'The troll collapses, and the drums fall silent.',
        phases: [
          { at: 0.65, say: 'Goblins pour from the walls!', adds: { mob: 'moria_goblin', n: 3 } },
          { at: 0.30, say: 'The troll roars and swings wildly!', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [420, 680]
    },
    durins_bane: {
      id: 'durins_bane', name: 'Ember-fiend of the Bridge', level: 26, hp: 12000, armor: 1100, resist: 0.2, radius: 26,
      shape: 'humanoid', style: 'orcBrute', color: '#1a0e0a', trim: '#ff6a20', skin: '#3a1a10', hair: '#ff8a30', scale: 3.0, weapon: true,
      speed: 118, aggro: 260, leash: 900, social: 0, family: 'demon', behavior: 'aggressive', wander: 0, rank: 'boss',
      attack: { dmg: 52, interval: 2.6, range: 48, fx: { kind: 'slash', color: '#ff7a20' } },
      specials: [],
      boss: {
        intro: 'A remnant of the fire that fell with the Balrog still clings to the bridge, and it burns.',
        outro: 'The last ember gutters out, and the bridge is dark.',
        phases: [
          { at: 0.70, say: 'Ash and cinders rise from the chasm!', adds: { mob: 'moria_orc', n: 2 } },
          { at: 0.35, say: 'The fire burns higher!', enrage: true }
        ]
      },
      respawn: 900, corpse: 60, loot: 'boss', gold: [800, 1200]
    }
  });

  // ---- Pace (WoW-like tempo): creatures move slower and fights last longer ----
  const PACE = { speed: 0.7, hp: 1.5 };
  Object.keys(MEO.MOBS).forEach(function (id) {
    const m = MEO.MOBS[id];
    if (m.speed > 0) m.speed = Math.round(m.speed * PACE.speed);
    if (!m.boss && m.shape !== 'dummy' && m.hp) m.hp = Math.round(m.hp * PACE.hp);
  });
})();
