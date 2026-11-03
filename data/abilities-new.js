/* ==========================================================================
   data/abilities-new.js – Abilities and buffs for Warden, Champion, Burglar,
   Captain, Loremaster and the Rune-keeper's healing runes.
   Same schema as data/abilities-data.js (loaded before this file).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  const MELEE = 46;
  const SPELL = 280;
  const add = function (o) {
    o.cost = o.cost || 0;
    o.cd = o.cd || 0;
    o.cast = o.cast || 0;
    o.gcd = o.gcd !== false;
    MEO.ABILITIES[o.id] = o;
  };
  const dmg = function (school, base, coef, extra) {
    return Object.assign({ type: 'damage', school: school, base: base, coef: coef }, extra || {});
  };
  const slash = function (c) {
    return { kind: 'slash', color: c };
  };
  const ring = function (c, r) {
    return { kind: 'ring', color: c, radius: r };
  };

  // =========================== WARDEN =====================================
  add({ id: 'jab', cls: 'warden', level: 1, name: 'Jab', icon: '⚔', color: '#cfe6d8', target: 'enemy', range: 52, cost: -10,
    desc: 'A quick spear thrust. Generates Focus.', fx: slash('#cfe6d8'), effects: [dmg('physical', 6, 0.9, { threatMult: 1.4 })] });
  add({ id: 'challenge', cls: 'warden', level: 2, name: 'Challenge', icon: '‼', color: '#e0a030', target: 'enemy', range: 400, cd: 8, gcd: false,
    desc: 'Forces the enemy to attack you for 4 sec and puts you at the top of its threat list.', fx: ring('#ffb347', 40), effects: [{ type: 'taunt', duration: 4 }] });
  add({ id: 'sweep', cls: 'warden', level: 3, name: 'Spear Sweep', icon: '✺', color: '#b8d8c8', target: 'self', cost: 20, cd: 6,
    desc: 'Sweeps the spear around, striking all nearby enemies.', fx: ring('#b8d8c8', 80),
    effects: [dmg('physical', 6, 0.7, { threatMult: 1.8, aoe: { around: 'self', radius: 80, affects: 'enemies', max: 8 } })] });
  add({ id: 'fend', cls: 'warden', level: 4, name: 'Fend', icon: '◈', color: '#7fd0a8', target: 'self', cd: 30, gcd: false,
    desc: 'Take 25% less damage for 8 sec.', fx: ring('#7fd0a8', 34), effects: [{ type: 'buff', buff: 'fend' }] });
  add({ id: 'pin_down', cls: 'warden', level: 5, name: 'Pin Down', icon: '✂', color: '#c8a060', target: 'enemy', range: 52, cost: 15, cd: 10,
    desc: 'Pins the enemy\'s leg: slows it by 50% for 6 sec.', fx: slash('#c8a060'),
    effects: [dmg('physical', 4, 0.6, { threatMult: 1.5 }), { type: 'buff', buff: 'crippled' }] });
  add({ id: 'second_wind', cls: 'warden', level: 6, name: 'Second Wind', icon: '✚', color: '#6fd67a', target: 'self', cost: 15, cd: 25, gcd: false,
    desc: 'Catch your breath and heal yourself.', fx: { kind: 'sparkle', color: '#8cf09a' }, effects: [{ type: 'heal', base: 35, coef: 1.4 }] });
  add({ id: 'impale', cls: 'warden', level: 7, name: 'Impale', icon: '➶', color: '#d85a4a', target: 'enemy', range: 52, cost: 25, cd: 8,
    desc: 'A heavy thrust that deals strong damage and builds threat.', fx: slash('#ff8a7a'), effects: [dmg('physical', 12, 1.5, { threatMult: 1.5 })] });
  add({ id: 'fortify', cls: 'warden', level: 8, name: 'Fortify', icon: '⛨', color: '#6aa3ff', target: 'self', cost: 20, cd: 40, gcd: false,
    desc: 'A shield of resolve absorbs damage and raises armor for 12 sec.', fx: ring('#6aa3ff', 34), effects: [{ type: 'buff', buff: 'fortify' }] });

  // =========================== CHAMPION ===================================
  add({ id: 'fell_strike', cls: 'champion', level: 1, name: 'Fell Strike', icon: '⚔', color: '#d65a4a', target: 'enemy', range: 48, cost: -12,
    desc: 'A heavy two-handed blow. Generates Fury.', fx: slash('#ffd0b0'), effects: [dmg('physical', 7, 1.0)] });
  add({ id: 'rend', cls: 'champion', level: 2, name: 'Rend', icon: '✹', color: '#b02a2a', target: 'enemy', range: 48, cost: 15, cd: 6,
    desc: 'Tears the enemy open: bleeding for 12 sec.', fx: slash('#ff7a7a'), effects: [dmg('physical', 3, 0.5), { type: 'buff', buff: 'rend' }] });
  add({ id: 'charge', cls: 'champion', level: 3, name: 'Skull Bash', icon: '☠', color: '#c8c8d0', target: 'enemy', range: 48, cost: 15, cd: 12, gcd: false,
    desc: 'A crushing blow that interrupts spellcasting.', fx: slash('#e0e0e8'), effects: [dmg('physical', 5, 0.8), { type: 'interrupt' }] });
  add({ id: 'bloodlust', cls: 'champion', level: 4, name: 'Bloodlust', icon: '✹', color: '#e0502a', target: 'self', cd: 40, gcd: false,
    desc: '+30% power for 10 sec.', fx: ring('#e0502a', 34), effects: [{ type: 'buff', buff: 'bloodlust' }] });
  add({ id: 'mighty_swing', cls: 'champion', level: 5, name: 'Mighty Swing', icon: '✺', color: '#e8e8f0', target: 'self', cost: 25, cd: 8,
    desc: 'A sweeping blow that strikes all nearby enemies.', fx: ring('#e0e0e8', 85),
    effects: [dmg('physical', 8, 0.9, { aoe: { around: 'self', radius: 85, affects: 'enemies', max: 8 } })] });
  add({ id: 'menace', cls: 'champion', level: 6, name: 'Menace', icon: '☹', color: '#a07050', target: 'enemy', range: 200, cost: 10, cd: 15,
    desc: 'A fearsome glare: the enemy deals 20% less damage for 10 sec.', fx: ring('#a07050', 30), effects: [{ type: 'buff', buff: 'menace' }] });
  add({ id: 'cull', cls: 'champion', level: 7, name: 'Cull', icon: '☠', color: '#b03030', target: 'enemy', range: 48, cost: 20, cd: 4,
    desc: 'A finishing blow. Deals much more damage to enemies below 30% health.', fx: slash('#ff7a7a'),
    effects: [dmg('physical', 10, 1.4, { executeBelow: 0.3, executeMult: 2.5 })] });
  add({ id: 'war_cry', cls: 'champion', level: 8, name: 'War Cry', icon: '✪', color: '#e8b04a', target: 'self', cost: 10, cd: 30, gcd: false,
    desc: '+15% critical strike chance for 12 sec.', fx: ring('#e8b04a', 40), effects: [{ type: 'buff', buff: 'war_cry' }] });

  // =========================== BURGLAR ====================================
  add({ id: 'stab', cls: 'burglar', level: 1, name: 'Stab', icon: '🗡', color: '#d8d8e0', target: 'enemy', range: 44, cost: -10,
    desc: 'A quick stab. Generates Focus.', fx: slash('#d8d8e0'), effects: [dmg('physical', 5, 0.9)] });
  add({ id: 'backstab', cls: 'burglar', level: 2, name: 'Backstab', icon: '✦', color: '#9090b0', target: 'enemy', range: 44, cost: 20, cd: 5,
    desc: 'A vicious strike for heavy damage.', fx: slash('#b8b8d8'), effects: [dmg('physical', 10, 1.5, { critBonus: 0.1 })] });
  add({ id: 'poison_blade', cls: 'burglar', level: 3, name: 'Poisoned Blade', icon: '☣', color: '#8fe06a', target: 'enemy', range: 44, cost: 15,
    desc: 'A poisoned strike. Deals nature damage over time for 12 sec.', fx: slash('#8fe06a'), effects: [dmg('physical', 3, 0.5), { type: 'buff', buff: 'deadly_poison' }] });
  add({ id: 'dirty_trick', cls: 'burglar', level: 4, name: 'Dirty Trick', icon: '★', color: '#ffd34d', target: 'enemy', range: 44, cost: 15, cd: 20,
    desc: 'Throws sand in the enemy\'s eyes: stunned for 2 sec.', fx: slash('#ffd34d'), effects: [{ type: 'buff', buff: 'stunned', duration: 2 }] });
  add({ id: 'fools_luck', cls: 'burglar', level: 5, name: 'Fool\'s Luck', icon: '♣', color: '#7fd06a', target: 'self', cd: 45, gcd: false,
    desc: '+20% critical strike chance and +10% speed for 8 sec.', fx: ring('#7fd06a', 30), effects: [{ type: 'buff', buff: 'fools_luck' }] });
  add({ id: 'shadow_step', cls: 'burglar', level: 6, name: 'Shadow Step', icon: '➤', color: '#6a6a90', target: 'self', cd: 15, gcd: false,
    desc: 'Slips quickly forward.', fx: { kind: 'none' }, effects: [{ type: 'dash', dir: 'forward', dist: 110 }] });
  add({ id: 'cutthroat', cls: 'burglar', level: 7, name: 'Cutthroat', icon: '☠', color: '#b03030', target: 'enemy', range: 44, cost: 30, cd: 10,
    desc: 'A deadly strike, doubly dangerous against weakened enemies.', fx: slash('#ff7a7a'),
    effects: [dmg('physical', 14, 1.9, { executeBelow: 0.35, executeMult: 1.8 })] });
  add({ id: 'escape', cls: 'burglar', level: 8, name: 'Escape', icon: '≫', color: '#a0e0ff', target: 'self', cd: 60, gcd: false,
    desc: 'Take 50% less damage and run 30% faster for 4 sec.', fx: ring('#a0e0ff', 30), effects: [{ type: 'buff', buff: 'escape' }] });

  // =========================== CAPTAIN ====================================
  add({ id: 'rallying_strike', cls: 'captain', level: 1, name: 'Rallying Strike', icon: '⚔', color: '#f0e6c0', target: 'enemy', range: 46, cost: 6,
    desc: 'A strike that steadies nearby allies.', fx: slash('#f0e6c0'), effects: [dmg('physical', 6, 0.9)] });
  add({ id: 'heralds_cry', cls: 'captain', level: 2, name: 'Herald\'s Cry', icon: '✪', color: '#e8b04a', target: 'self', cost: 20,
    desc: 'You and nearby allies gain +15% power and +3% crit for 30 sec.', fx: ring('#e8b04a', 90),
    effects: [{ type: 'buff', buff: 'heralds_cry', aoe: { around: 'self', radius: 500, affects: 'friends' } }] });
  add({ id: 'inspire', cls: 'captain', level: 3, name: 'Inspire', icon: '✚', color: '#6fd67a', target: 'friend', range: SPELL, cast: 1.5, cost: 25,
    desc: 'A rousing order that heals an ally.', fx: { kind: 'sparkle', color: '#8cf09a' }, effects: [{ type: 'heal', base: 22, coef: 1.2 }] });
  add({ id: 'defensive_order', cls: 'captain', level: 4, name: 'Defensive Order', icon: '◈', color: '#6aa3ff', target: 'self', cost: 25, cd: 20,
    desc: 'You and nearby allies take 15% less damage for 10 sec.', fx: ring('#6aa3ff', 90),
    effects: [{ type: 'buff', buff: 'defensive_order', aoe: { around: 'self', radius: 500, affects: 'friends' } }] });
  add({ id: 'to_arms', cls: 'captain', level: 5, name: 'To Arms!', icon: '≫', color: '#a0e0ff', target: 'self', cost: 20, cd: 30,
    desc: 'You and nearby allies run 25% faster for 8 sec.', fx: ring('#a0e0ff', 90),
    effects: [{ type: 'buff', buff: 'to_arms', aoe: { around: 'self', radius: 500, affects: 'friends' } }] });
  add({ id: 'pointed_command', cls: 'captain', level: 6, name: 'Pointed Command', icon: '◎', color: '#ff7a5a', target: 'enemy', range: SPELL, cost: 15,
    desc: 'The enemy takes 10% more damage for 20 sec.', fx: ring('#ff7a5a', 30), effects: [{ type: 'buff', buff: 'pointed' }] });
  add({ id: 'final_stand', cls: 'captain', level: 7, name: 'Final Stand', icon: '⛨', color: '#ffe58a', target: 'friend', range: SPELL, cost: 30, cd: 60, gcd: false,
    desc: 'A powerful shield absorbs damage for 10 sec.', fx: ring('#ffe58a', 34), effects: [{ type: 'buff', buff: 'final_stand' }] });
  add({ id: 'banner', cls: 'captain', level: 8, name: 'Raise the Banner', icon: '⚑', color: '#d8a040', target: 'self', cost: 40, cd: 60,
    desc: 'Rallies nearby allies: healing over time and +10% power for 15 sec.', fx: ring('#d8a040', 170),
    effects: [{ type: 'buff', buff: 'banner', aoe: { around: 'self', radius: 200, affects: 'friends' } }] });

  // =========================== LOREMASTER =================================
  add({ id: 'lore_bolt', cls: 'loremaster', level: 1, name: 'Bolt of Lore', icon: '✦', color: '#c58bff', target: 'enemy', range: SPELL, cast: 1.5, cost: 12,
    desc: 'A bolt of arcane power.', fx: { kind: 'bolt', color: '#c58bff' }, effects: [dmg('arcane', 6, 1.0)] });
  add({ id: 'insight', cls: 'loremaster', level: 3, name: 'Insight', icon: '☀', color: '#ffe58a', target: 'friend', range: SPELL, cost: 20,
    desc: 'An ally gains +12% power and +3% crit for 30 sec.', fx: { kind: 'sparkle', color: '#ffe58a' }, effects: [{ type: 'buff', buff: 'insight' }] });
  add({ id: 'blinding_light', cls: 'loremaster', level: 4, name: 'Blinding Light', icon: '☼', color: '#fff0a0', target: 'enemy', range: SPELL, cost: 18, cd: 10,
    desc: 'The enemy deals 25% less damage for 10 sec.', fx: { kind: 'bolt', color: '#fff0a0' }, effects: [{ type: 'buff', buff: 'dazzled' }] });
  add({ id: 'lore_ward', cls: 'loremaster', level: 6, name: 'Ward of Lore', icon: '◇', color: '#b8a0ff', target: 'friend', range: SPELL, cost: 22, cd: 8,
    desc: 'A shield absorbs damage for 12 sec.', fx: ring('#b8a0ff', 30), effects: [{ type: 'buff', buff: 'lore_ward' }] });
  add({ id: 'exposed', cls: 'loremaster', level: 7, name: 'Words of Weakness', icon: '◎', color: '#ff9ad0', target: 'enemy', range: SPELL, cost: 15,
    desc: 'The enemy takes 12% more damage for 20 sec.', fx: ring('#ff9ad0', 30), effects: [{ type: 'buff', buff: 'exposed' }] });
  add({ id: 'embers', cls: 'loremaster', level: 8, name: 'Fiery Embers', icon: '♨', color: '#ff6a2a', target: 'enemy', range: SPELL, cast: 2.0, cost: 28, cd: 10,
    desc: 'Embers rain on the target and its neighbours and set them ablaze.', fx: { kind: 'bolt', color: '#ff6a2a' },
    effects: [dmg('fire', 8, 0.9, { aoe: { around: 'target', radius: 80, affects: 'enemies', max: 5 } }),
      { type: 'buff', buff: 'burning', aoe: { around: 'target', radius: 80, affects: 'enemies', max: 5 } }] });
  // the Loremaster learns the old Wizard crowd-control spells
  Object.assign(MEO.ABILITIES.polymorph, { cls: 'loremaster', level: 2, name: 'Lore of Confusion' });
  Object.assign(MEO.ABILITIES.frost_nova, { cls: 'loremaster', level: 5, name: 'Winter\'s Grasp' });

  // =========================== RUNE-KEEPER (healing runes) ================
  add({ id: 'rune_mend', cls: 'runekeeper', level: 1, name: 'Rune of Mending', icon: '✚', color: '#6fd67a', target: 'friend', range: SPELL, cast: 2.0, cost: 26,
    desc: 'A rune that knits wounds. With no target, you heal yourself.', fx: { kind: 'sparkle', color: '#8cf09a' }, effects: [{ type: 'heal', base: 28, coef: 1.5 }] });
  add({ id: 'rune_renew', cls: 'runekeeper', level: 3, name: 'Rune of Renewal', icon: '❦', color: '#8fe06a', target: 'friend', range: SPELL, cost: 20,
    desc: 'Heals over time for 12 sec.', fx: { kind: 'sparkle', color: '#9aff8a' }, effects: [{ type: 'buff', buff: 'rune_renew' }] });
  add({ id: 'rune_ward', cls: 'runekeeper', level: 5, name: 'Rune of Protection', icon: '◉', color: '#9ec8ff', target: 'friend', range: SPELL, cost: 24, cd: 6,
    desc: 'A shield absorbs damage for 10 sec.', fx: ring('#9ec8ff', 30), effects: [{ type: 'buff', buff: 'rune_ward' }] });
  add({ id: 'rune_cleanse', cls: 'runekeeper', level: 6, name: 'Rune of Cleansing', icon: '✧', color: '#e8f4ff', target: 'friend', range: SPELL, cost: 15, cd: 8,
    desc: 'Removes one harmful effect (magic, poison or curse).', fx: { kind: 'sparkle', color: '#e8f4ff' },
    effects: [{ type: 'dispel', kinds: ['magic', 'poison', 'curse'], count: 1, harmful: true }] });
  Object.assign(MEO.ABILITIES.fireball, { name: 'Rune of Flame' });
  Object.assign(MEO.ABILITIES.arcane_blast, { level: 8, name: 'Rune of Storm' });
  Object.assign(MEO.ABILITIES.ignite, { level: 4, name: 'Rune of Embers' });

  // ===========================================================================
  //  Buffs and debuffs
  // ===========================================================================
  const B = MEO.BUFFS;
  Object.assign(B, {
    fend: { name: 'Fend', icon: '◈', color: '#7fd0a8', duration: 8, mods: { damageTaken: { pct: -0.25 } } },
    fortify: { name: 'Fortify', icon: '⛨', color: '#6aa3ff', duration: 12, absorb: { base: 60, coef: 1.8 }, mods: { armor: { pct: 0.3 } } },
    rend: { name: 'Rend', icon: '✹', color: '#b02a2a', harmful: true, duration: 12, tick: 2, tickEffect: { type: 'damage', school: 'physical', base: 3, coef: 0.25 }, dispel: 'physical' },
    bloodlust: { name: 'Bloodlust', icon: '✹', color: '#e0502a', duration: 10, mods: { power: { pct: 0.3 } } },
    menace: { name: 'Menace', icon: '☹', color: '#a07050', harmful: true, duration: 10, mods: { damageDealt: { pct: -0.2 } }, dispel: null },
    war_cry: { name: 'War Cry', icon: '✪', color: '#e8b04a', duration: 12, mods: { crit: { flat: 0.15 } } },
    deadly_poison: { name: 'Deadly Poison', icon: '☣', color: '#8fe06a', harmful: true, duration: 12, tick: 3, tickEffect: { type: 'damage', school: 'nature', base: 3, coef: 0.3 }, dispel: 'poison' },
    fools_luck: { name: 'Fool\'s Luck', icon: '♣', color: '#7fd06a', duration: 8, mods: { crit: { flat: 0.2 }, speed: { pct: 0.1 } } },
    escape: { name: 'Escape', icon: '≫', color: '#a0e0ff', duration: 4, mods: { damageTaken: { pct: -0.5 }, speed: { pct: 0.3 } } },
    heralds_cry: { name: 'Herald\'s Cry', icon: '✪', color: '#e8b04a', duration: 30, mods: { power: { pct: 0.15 }, crit: { flat: 0.03 } } },
    defensive_order: { name: 'Defensive Order', icon: '◈', color: '#6aa3ff', duration: 10, mods: { damageTaken: { pct: -0.15 } } },
    to_arms: { name: 'To Arms!', icon: '≫', color: '#a0e0ff', duration: 8, mods: { speed: { pct: 0.25 } } },
    pointed: { name: 'Pointed Command', icon: '◎', color: '#ff7a5a', harmful: true, duration: 20, mods: { damageTaken: { pct: 0.1 } }, dispel: null },
    final_stand: { name: 'Final Stand', icon: '⛨', color: '#ffe58a', duration: 10, absorb: { base: 90, coef: 2.5 } },
    banner: { name: 'Raised Banner', icon: '⚑', color: '#d8a040', duration: 15, tick: 3, tickEffect: { type: 'heal', base: 6, coef: 0.3 }, mods: { power: { pct: 0.1 } } },
    insight: { name: 'Insight', icon: '☀', color: '#ffe58a', duration: 30, mods: { power: { pct: 0.12 }, crit: { flat: 0.03 } } },
    dazzled: { name: 'Dazzled', icon: '☼', color: '#fff0a0', harmful: true, duration: 10, mods: { damageDealt: { pct: -0.25 } }, dispel: 'magic' },
    lore_ward: { name: 'Ward of Lore', icon: '◇', color: '#b8a0ff', duration: 12, absorb: { base: 45, coef: 1.4 }, dispel: 'magic' },
    exposed: { name: 'Exposed', icon: '◎', color: '#ff9ad0', harmful: true, duration: 20, mods: { damageTaken: { pct: 0.12 } }, dispel: null },
    rune_renew: { name: 'Rune of Renewal', icon: '❦', color: '#8fe06a', duration: 12, tick: 3, tickEffect: { type: 'heal', base: 6, coef: 0.3 }, dispel: 'magic' },
    rune_ward: { name: 'Rune of Protection', icon: '◉', color: '#9ec8ff', duration: 10, absorb: { base: 40, coef: 1.5 }, dispel: 'magic' }
  });
})();
