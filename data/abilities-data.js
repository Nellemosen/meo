/* ==========================================================================
   data/abilities-data.js – All abilities and buffs/debuffs
   cost: positive = costs resource, negative = grants resource
   cd/cast in seconds, range in pixels (edge to edge), gcd: triggers the global cooldown
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  const MELEE = 46;
  const SPELL = 280;
  const BOW = 300;

  const LIST = [];
  function A(o) {
    o.cost = o.cost || 0;
    o.cd = o.cd || 0;
    o.cast = o.cast || 0;
    o.gcd = o.gcd !== false;
    LIST.push(o);
  }

  // =========================== WARRIOR ===================================
  A({
    id: 'slash', cls: 'guardian', level: 1, name: 'Slash', icon: '⚔', color: '#d65a4a',
    target: 'enemy', range: MELEE, cost: -12,
    desc: 'A swift strike with the sword. Generates Fury.',
    fx: { kind: 'slash', color: '#f0e6d0' },
    effects: [{ type: 'damage', school: 'physical', base: 6, coef: 0.9 }]
  });
  A({
    id: 'shield_bash', cls: 'guardian', level: 2, name: 'Shield Bash', icon: '⛨', color: '#6f8fd6',
    target: 'enemy', range: MELEE, cost: 15, cd: 12,
    desc: 'Slams your shield into the enemy. Stuns for 3 sec and interrupts spellcasting.',
    fx: { kind: 'slash', color: '#9fc0ff' },
    effects: [
      { type: 'damage', school: 'physical', base: 4, coef: 0.5, threatMult: 2 },
      { type: 'interrupt' },
      { type: 'buff', buff: 'stunned' }
    ]
  });
  A({
    id: 'taunt', cls: 'guardian', level: 3, name: 'Taunt', icon: '‼', color: '#e0a030',
    target: 'enemy', range: 400, cd: 8, gcd: false,
    desc: 'Forces the enemy to attack you for 4 sec and puts you at the top of its threat list.',
    fx: { kind: 'ring', color: '#ffb347', radius: 40 },
    effects: [{ type: 'taunt', duration: 4 }]
  });
  A({
    id: 'shield_wall', cls: 'guardian', level: 4, name: 'Shield Wall', icon: '◈', color: '#6aa3ff',
    target: 'self', cd: 40, gcd: false,
    desc: 'Reduces all damage you take by 40% and increases armor for 8 sec.',
    fx: { kind: 'ring', color: '#6aa3ff', radius: 34 },
    effects: [{ type: 'buff', buff: 'shield_wall' }]
  });
  A({
    id: 'battle_shout', cls: 'guardian', level: 5, name: 'Battle Cry', icon: '✪', color: '#e8b04a',
    target: 'self', cost: 10, cd: 0,
    desc: 'A rallying cry that grants you and nearby allies +20% power for 30 sec.',
    fx: { kind: 'ring', color: '#e8b04a', radius: 90 },
    effects: [{ type: 'buff', buff: 'battle_shout', aoe: { around: 'self', radius: 500, affects: 'friends' } }]
  });
  A({
    id: 'whirlwind', cls: 'guardian', level: 6, name: 'Whirlwind', icon: '✺', color: '#c8c8d0',
    target: 'self', cost: 25, cd: 8,
    desc: 'You spin around, striking all nearby enemies.',
    fx: { kind: 'ring', color: '#e0e0e8', radius: 80 },
    effects: [{ type: 'damage', school: 'physical', base: 8, coef: 0.8, aoe: { around: 'self', radius: 80, affects: 'enemies', max: 8 } }]
  });
  A({
    id: 'execute', cls: 'guardian', level: 7, name: 'Execute', icon: '☠', color: '#b03030',
    target: 'enemy', range: MELEE, cost: 20, cd: 4,
    desc: 'A killing blow. Deals more than double damage to enemies below 25% health.',
    fx: { kind: 'slash', color: '#ff7a7a' },
    effects: [{ type: 'damage', school: 'physical', base: 10, coef: 1.4, executeBelow: 0.25, executeMult: 2.2 }]
  });
  A({
    id: 'berserk', cls: 'guardian', level: 8, name: 'Battle Frenzy', icon: '✹', color: '#e0502a',
    target: 'self', cd: 45, gcd: false,
    desc: '+25% damage dealt for 10 sec, but you take 15% more damage.',
    fx: { kind: 'ring', color: '#e0502a', radius: 34 },
    effects: [{ type: 'buff', buff: 'berserk' }]
  });

  // =========================== PRIEST ====================================
  A({
    id: 'smite', cls: 'minstrel', level: 1, name: 'Holy Flash', icon: '☀', color: '#ffe58a',
    target: 'enemy', range: SPELL, cast: 1.5, cost: 12,
    desc: 'A flash of holy fire sears the enemy.',
    fx: { kind: 'bolt', color: '#ffe58a' },
    effects: [{ type: 'damage', school: 'holy', base: 6, coef: 1.0 }]
  });
  A({
    id: 'heal', cls: 'minstrel', level: 1, name: 'Healing', icon: '✚', color: '#6fd67a',
    target: 'friend', range: SPELL, cast: 2.0, cost: 28,
    desc: 'A powerful heal. With no target, you heal yourself.',
    fx: { kind: 'sparkle', color: '#8cf09a' },
    effects: [{ type: 'heal', base: 30, coef: 1.6 }]
  });
  A({
    id: 'renew', cls: 'minstrel', level: 2, name: 'Renewal', icon: '❦', color: '#8fe06a',
    target: 'friend', range: SPELL, cost: 20,
    desc: 'Heals over time for 12 sec.',
    fx: { kind: 'sparkle', color: '#9aff8a' },
    effects: [{ type: 'buff', buff: 'renew' }]
  });
  A({
    id: 'flash_heal', cls: 'minstrel', level: 3, name: 'Swift Heal', icon: '⚡', color: '#a8f0b0',
    target: 'friend', range: SPELL, cast: 1.0, cost: 30,
    desc: 'A quick but costly heal.',
    fx: { kind: 'sparkle', color: '#c8ffd0' },
    effects: [{ type: 'heal', base: 18, coef: 1.1 }]
  });
  A({
    id: 'ward', cls: 'minstrel', level: 4, name: 'Ward', icon: '◉', color: '#9ec8ff',
    target: 'friend', range: SPELL, cost: 25, cd: 6,
    desc: 'A shield absorbs damage for 10 sec.',
    fx: { kind: 'ring', color: '#9ec8ff', radius: 30 },
    effects: [{ type: 'buff', buff: 'ward' }]
  });
  A({
    id: 'cleanse', cls: 'minstrel', level: 5, name: 'Cleanse', icon: '✧', color: '#e8f4ff',
    target: 'friend', range: SPELL, cost: 15, cd: 8,
    desc: 'Removes one harmful effect (magic, poison or curse).',
    fx: { kind: 'sparkle', color: '#e8f4ff' },
    effects: [{ type: 'dispel', kinds: ['magic', 'poison', 'curse'], count: 1, harmful: true }]
  });
  A({
    id: 'pain', cls: 'minstrel', level: 6, name: 'Dark Torment', icon: '☾', color: '#a77bd6',
    target: 'enemy', range: SPELL, cost: 18,
    desc: 'Torments the enemy with shadow damage over time for 15 sec.',
    fx: { kind: 'bolt', color: '#a77bd6' },
    effects: [{ type: 'buff', buff: 'pain' }]
  });
  A({
    id: 'radiance', cls: 'minstrel', level: 8, name: 'Wave of Light', icon: '✸', color: '#fff0a0',
    target: 'self', cast: 1.5, cost: 40, cd: 15,
    desc: 'A wave of light heals all nearby allies.',
    fx: { kind: 'ring', color: '#fff0a0', radius: 170 },
    effects: [{ type: 'heal', base: 20, coef: 0.9, aoe: { around: 'self', radius: 170, affects: 'friends' } }]
  });

  // =========================== RANGER ====================================
  A({
    id: 'aimed_shot', cls: 'hunter', level: 1, name: 'Aimed Shot', icon: '➶', color: '#e6d08a',
    target: 'enemy', range: BOW, cast: 1.5, cost: -12,
    desc: 'A well-placed shot. Generates Focus.',
    fx: { kind: 'bolt', color: '#e6d08a' },
    effects: [{ type: 'damage', school: 'physical', base: 8, coef: 1.3 }]
  });
  A({
    id: 'quick_shot', cls: 'hunter', level: 2, name: 'Quick Shot', icon: '➳', color: '#f0e0a0',
    target: 'enemy', range: BOW, cost: 20,
    desc: 'A quick shot with no draw time.',
    fx: { kind: 'bolt', color: '#f0e0a0' },
    effects: [{ type: 'damage', school: 'physical', base: 8, coef: 1.2 }]
  });
  A({
    id: 'serpent', cls: 'hunter', level: 3, name: 'Serpent Venom', icon: '☣', color: '#8fe06a',
    target: 'enemy', range: BOW, cost: 15,
    desc: 'A poisoned arrow. Deals nature damage over time for 15 sec.',
    fx: { kind: 'bolt', color: '#8fe06a' },
    effects: [{ type: 'buff', buff: 'venom' }]
  });
  A({
    id: 'crippling', cls: 'hunter', level: 4, name: 'Crippling Shot', icon: '✂', color: '#c8a060',
    target: 'enemy', range: BOW, cost: 15, cd: 10,
    desc: 'Strikes the legs, slowing the enemy by 50% for 6 sec.',
    fx: { kind: 'bolt', color: '#c8a060' },
    effects: [
      { type: 'damage', school: 'physical', base: 4, coef: 0.6 },
      { type: 'buff', buff: 'crippled' }
    ]
  });
  A({
    id: 'disengage', cls: 'hunter', level: 5, name: 'Disengage', icon: '↶', color: '#b0d0ff',
    target: 'self', cd: 20, gcd: false,
    desc: 'A quick leap away from the enemy.',
    fx: { kind: 'none' },
    effects: [{ type: 'dash', dir: 'back', dist: 150 }]
  });
  A({
    id: 'multishot', cls: 'hunter', level: 6, name: 'Volley', icon: '⁂', color: '#e6c070',
    target: 'enemy', range: BOW, cost: 30, cd: 10,
    desc: 'Fires at the target and all enemies near it.',
    fx: { kind: 'bolt', color: '#e6c070' },
    effects: [{ type: 'damage', school: 'physical', base: 6, coef: 0.9, aoe: { around: 'target', radius: 90, affects: 'enemies', max: 5 } }]
  });
  A({
    id: 'mark', cls: 'hunter', level: 7, name: 'Ranger\'s Mark', icon: '◎', color: '#ff7a5a',
    target: 'enemy', range: BOW, cost: 10,
    desc: 'Marks the enemy so it takes 10% more damage for 30 sec.',
    fx: { kind: 'ring', color: '#ff7a5a', radius: 30 },
    effects: [{ type: 'buff', buff: 'marked' }]
  });
  A({
    id: 'swiftness', cls: 'hunter', level: 8, name: 'Wind\'s Stride', icon: '≫', color: '#a0e0ff',
    target: 'self', cd: 30, gcd: false,
    desc: '+40% movement speed for 6 sec.',
    fx: { kind: 'ring', color: '#a0e0ff', radius: 30 },
    effects: [{ type: 'buff', buff: 'swift' }]
  });

  // =========================== WIZARD ================================
  A({
    id: 'fireball', cls: 'runekeeper', level: 1, name: 'Fireball', icon: '☄', color: '#ff8a3d',
    target: 'enemy', range: SPELL, cast: 2.0, cost: 22,
    desc: 'A ball of fire that deals heavy damage.',
    fx: { kind: 'bolt', color: '#ff8a3d' },
    effects: [{ type: 'damage', school: 'fire', base: 10, coef: 1.5 }]
  });
  A({
    id: 'frostbolt', cls: 'runekeeper', level: 2, name: 'Frostbolt', icon: '❄', color: '#7fd4ff',
    target: 'enemy', range: SPELL, cast: 1.5, cost: 16,
    desc: 'Frost damage that slows the enemy by 40% for 5 sec.',
    fx: { kind: 'bolt', color: '#7fd4ff' },
    effects: [
      { type: 'damage', school: 'frost', base: 6, coef: 1.0 },
      { type: 'buff', buff: 'chilled' }
    ]
  });
  A({
    id: 'arcane_blast', cls: 'runekeeper', level: 3, name: 'Arcane Blast', icon: '✦', color: '#c58bff',
    target: 'self', cost: 25, cd: 6,
    desc: 'A burst of arcane energy strikes all enemies near you.',
    fx: { kind: 'ring', color: '#c58bff', radius: 110 },
    effects: [{ type: 'damage', school: 'arcane', base: 8, coef: 0.9, aoe: { around: 'self', radius: 110, affects: 'enemies', max: 8 } }]
  });
  A({
    id: 'polymorph', cls: 'runekeeper', level: 4, name: 'Polymorph', icon: '❀', color: '#ff9ad0',
    target: 'enemy', range: 240, cast: 1.5, cost: 20,
    desc: 'Transforms the enemy for 8 sec. It cannot act, but the effect breaks on damage.',
    fx: { kind: 'bolt', color: '#ff9ad0' },
    effects: [{ type: 'buff', buff: 'polymorph' }]
  });
  A({
    id: 'frost_nova', cls: 'runekeeper', level: 5, name: 'Frost Nova', icon: '❅', color: '#a8e4ff',
    target: 'self', cost: 20, cd: 20,
    desc: 'Freezes all nearby enemies in place for 4 sec and deals minor damage.',
    fx: { kind: 'ring', color: '#a8e4ff', radius: 100 },
    effects: [
      { type: 'damage', school: 'frost', base: 4, coef: 0.4, aoe: { around: 'self', radius: 100, affects: 'enemies', max: 8 } },
      { type: 'buff', buff: 'frozen', aoe: { around: 'self', radius: 100, affects: 'enemies', max: 8 } }
    ]
  });
  A({
    id: 'blink', cls: 'runekeeper', level: 6, name: 'Blink', icon: '➤', color: '#d8b8ff',
    target: 'self', cd: 15, gcd: false,
    desc: 'Teleports you a short distance forward in the direction you are facing.',
    fx: { kind: 'none' },
    effects: [{ type: 'dash', dir: 'forward', dist: 170 }]
  });
  A({
    id: 'arcane_ward', cls: 'runekeeper', level: 7, name: 'Arcane Ward', icon: '◇', color: '#b8a0ff',
    target: 'self', cost: 20, cd: 20,
    desc: 'A shield absorbs damage for 12 sec.',
    fx: { kind: 'ring', color: '#b8a0ff', radius: 30 },
    effects: [{ type: 'buff', buff: 'arcane_ward' }]
  });
  A({
    id: 'ignite', cls: 'runekeeper', level: 8, name: 'Ignite', icon: '♨', color: '#ff6a2a',
    target: 'enemy', range: SPELL, cost: 20, cd: 8,
    desc: 'Sets the enemy ablaze: instant damage and burning for 8 sec.',
    fx: { kind: 'bolt', color: '#ff6a2a' },
    effects: [
      { type: 'damage', school: 'fire', base: 4, coef: 0.6 },
      { type: 'buff', buff: 'burning' }
    ]
  });

  MEO.ABILITIES = {};
  LIST.forEach(function (a) {
    MEO.ABILITIES[a.id] = a;
  });

  // ===========================================================================
  //  Buffs and debuffs
  //  mods: {stat: {pct, flat}}  – stat may be power, armor, speed, damageDealt, damageTaken
  //  flags: stun | root | incapacitate
  // ===========================================================================
  MEO.BUFFS = {
    stunned: { name: 'Stunned', icon: '★', color: '#ffd34d', harmful: true, duration: 3, flags: ['stun'], dispel: null },
    frozen: { name: 'Frozen Solid', icon: '❅', color: '#a8e4ff', harmful: true, duration: 4, flags: ['root'], dispel: 'magic' },
    polymorph: { name: 'Polymorphed', icon: '❀', color: '#ff9ad0', harmful: true, duration: 8, flags: ['incapacitate'], breakOnDamage: true, dispel: 'magic' },

    chilled: { name: 'Chilled', icon: '❄', color: '#7fd4ff', harmful: true, duration: 5, mods: { speed: { pct: -0.4 } }, dispel: 'magic' },
    crippled: { name: 'Crippled', icon: '✂', color: '#c8a060', harmful: true, duration: 6, mods: { speed: { pct: -0.5 } }, dispel: 'physical' },
    marked: { name: 'Marked', icon: '◎', color: '#ff7a5a', harmful: true, duration: 30, mods: { damageTaken: { pct: 0.1 } }, dispel: null },

    pain: { name: 'Dark Torment', icon: '☾', color: '#a77bd6', harmful: true, duration: 15, tick: 3, tickEffect: { type: 'damage', school: 'shadow', base: 4, coef: 0.25 }, dispel: 'magic' },
    venom: { name: 'Serpent Venom', icon: '☣', color: '#8fe06a', harmful: true, duration: 15, tick: 3, tickEffect: { type: 'damage', school: 'nature', base: 3, coef: 0.3 }, dispel: 'poison' },
    burning: { name: 'Burning', icon: '♨', color: '#ff6a2a', harmful: true, duration: 8, tick: 2, tickEffect: { type: 'damage', school: 'fire', base: 2, coef: 0.25 }, dispel: 'magic' },

    shield_wall: { name: 'Shield Wall', icon: '◈', color: '#6aa3ff', duration: 8, mods: { damageTaken: { pct: -0.4 }, armor: { pct: 0.5 } } },
    battle_shout: { name: 'Battle Cry', icon: '✪', color: '#e8b04a', duration: 30, mods: { power: { pct: 0.2 } } },
    berserk: { name: 'Battle Frenzy', icon: '✹', color: '#e0502a', duration: 10, mods: { damageDealt: { pct: 0.25 }, damageTaken: { pct: 0.15 } } },
    swift: { name: 'Wind\'s Stride', icon: '≫', color: '#a0e0ff', duration: 6, mods: { speed: { pct: 0.4 } } },

    renew: { name: 'Renewal', icon: '❦', color: '#8fe06a', duration: 12, tick: 3, tickEffect: { type: 'heal', base: 6, coef: 0.3 }, dispel: 'magic' },
    ward: { name: 'Ward', icon: '◉', color: '#9ec8ff', duration: 10, absorb: { base: 40, coef: 1.5 }, dispel: 'magic' },
    arcane_ward: { name: 'Arcane Ward', icon: '◇', color: '#b8a0ff', duration: 12, absorb: { base: 50, coef: 1.3 }, dispel: 'magic' }
  };
})();
