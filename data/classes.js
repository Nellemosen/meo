/* ==========================================================================
   data/classes.js – The nine classes: stats, growth, auto-attack and regeneration
   Archetypes: Tank (Guardian, Warden), Healer (Minstrel, Rune-keeper),
   Damage (Hunter, Champion, Burglar) and Support (Captain, Loremaster).
   Every class has three specs (data in data/traits.js later); each spec has a role.
   gear: legacy item groups the class may use (items list 'warrior', 'healer', ...).
   The ability list itself lives in data/abilities-data.js and data/abilities-new.js.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.Classes = {
    guardian: {
      id: 'guardian',
      name: 'Guardian',
      origin: 'Gondor',
      role: 'Tank',
      arch: 'tank',
      resType: 'fury',
      color: '#3f6fb5',
      trim: '#d8c48a',
      hair: '#6b4a2b',
      skin: '#e2b88f',
      weapon: true,
      gear: ['warrior'],
      armorTypes: ['plate','leather','cloth'],
      desc: 'Shield-bearer of Gondor. Holds the enemy\'s attention with sword and shield and builds Fury in battle.',
      base: { maxHp: 130, maxRes: 100, power: 12, armor: 70, crit: 0.05, resist: 0 },
      growth: { maxHp: 17, maxRes: 0, power: 2.0, armor: 10, crit: 0.002, resist: 0.003 },
      auto: {
        name: 'Sword Strike', range: 46, interval: 2.0, base: 6, coef: 0.6, school: 'physical',
        ranged: false, resGain: 6, fx: { kind: 'slash', color: '#f0e6d0' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: -6, resCombat: 0, furyPerDmg: 0.3 },
      threatMod: 1.8,
      abilities: ['slash', 'shield_bash', 'taunt', 'shield_wall', 'battle_shout', 'whirlwind', 'execute', 'berserk'],
      specs: [{ id: 'bulwark', name: 'Bulwark', role: 'tank', desc: 'The immovable wall: shields, threat and survival.' }, { id: 'avenger', name: 'Avenger', role: 'dps', desc: 'Turns the shield into a weapon: punishing counter-attacks.' }, { id: 'sentinel', name: 'Sentinel', role: 'support', desc: 'Guards the whole group with auras and rescues.' }]
    },

    warden: {
      id: 'warden',
      name: 'Warden',
      origin: 'Dúnedain of the North',
      role: 'Tank',
      arch: 'tank',
      resType: 'focus',
      color: '#3a6a5a',
      trim: '#c9b27a',
      hair: '#4a3a2a',
      skin: '#dcb08a',
      weapon: true,
      gear: ['warrior','ranger'],
      armorTypes: ['leather','cloth'],
      desc: 'Spear-fighter of the North. Avoids blows rather than absorbing them and controls the fight with gambits.',
      base: { maxHp: 120, maxRes: 100, power: 12, armor: 58, crit: 0.05, resist: 0.01 },
      growth: { maxHp: 15, maxRes: 0, power: 2.0, armor: 8, crit: 0.002, resist: 0.003 },
      auto: {
        name: 'Spear Thrust', range: 52, interval: 2.0, base: 6, coef: 0.6, school: 'physical',
        ranged: false, resGain: 5, fx: { kind: 'slash', color: '#cfe6d8' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 6, resCombat: 5, furyPerDmg: 0 },
      threatMod: 1.6,
      abilities: ['jab', 'challenge', 'sweep', 'fend', 'pin_down', 'second_wind', 'impale', 'fortify'],
      specs: [{ id: 'wall_of_spears', name: 'Wall of Spears', role: 'tank', desc: 'Defensive gambits: dodge, retaliation and control.' }, { id: 'assailant', name: 'Assailant', role: 'dps', desc: 'Offensive gambits: fast, precise spear work.' }, { id: 'wardmaster', name: 'Wardmaster', role: 'tank', desc: 'Self-healing and resilience over long fights.' }]
    },

    minstrel: {
      id: 'minstrel',
      name: 'Minstrel',
      origin: 'Rivendell',
      role: 'Healer',
      arch: 'heal',
      resType: 'mana',
      color: '#d8d8e8',
      trim: '#7fb0e8',
      hair: '#c9c2a8',
      skin: '#ecc9a6',
      weapon: false,
      gear: ['healer'],
      armorTypes: ['cloth','leather'],
      desc: 'Healer whose songs mend wounds and lift hearts. Can cleanse harmful effects, and has a bite of its own.',
      base: { maxHp: 95, maxRes: 150, power: 12, armor: 35, crit: 0.05, resist: 0.02 },
      growth: { maxHp: 11, maxRes: 6, power: 2.0, armor: 5, crit: 0.002, resist: 0.004 },
      auto: {
        name: 'Staff Strike', range: 40, interval: 2.4, base: 3, coef: 0.35, school: 'physical',
        ranged: false, resGain: 0, fx: { kind: 'slash', color: '#dcecff' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 8, resCombat: 2.2, furyPerDmg: 0 },
      threatMod: 1.0,
      abilities: ['smite', 'heal', 'renew', 'flash_heal', 'ward', 'cleanse', 'pain', 'radiance'],
      specs: [{ id: 'songs_of_mending', name: 'Songs of Mending', role: 'heal', desc: 'Direct and group healing.' }, { id: 'warsong', name: 'Warsong', role: 'dps', desc: 'Battle hymns that burn the enemy.' }, { id: 'harmony', name: 'Harmony', role: 'support', desc: 'Songs that strengthen the group.' }]
    },

    runekeeper: {
      id: 'runekeeper',
      name: 'Rune-keeper',
      origin: 'Dale and Erebor',
      role: 'Healer',
      arch: 'heal',
      resType: 'mana',
      color: '#c2543a',
      trim: '#f0c070',
      hair: '#8a6a4a',
      skin: '#e2b890',
      weapon: false,
      gear: ['healer','mage'],
      armorTypes: ['cloth','leather'],
      desc: 'Scholar of runes. Writes healing and flame in the same hand, and can swap between mending and burning.',
      base: { maxHp: 95, maxRes: 150, power: 12, armor: 35, crit: 0.05, resist: 0.02 },
      growth: { maxHp: 11, maxRes: 6, power: 2.1, armor: 5, crit: 0.002, resist: 0.004 },
      auto: {
        name: 'Rune Bolt', range: 230, interval: 2.4, base: 3, coef: 0.45, school: 'fire',
        ranged: true, resGain: 0, fx: { kind: 'bolt', color: '#ffb070' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 8, resCombat: 2.2, furyPerDmg: 0 },
      threatMod: 1.0,
      abilities: ['fireball', 'rune_mend', 'frostbolt', 'rune_renew', 'ignite', 'rune_ward', 'rune_cleanse', 'arcane_blast'],
      specs: [{ id: 'runes_of_healing', name: 'Runes of Healing', role: 'heal', desc: 'Restoring runes of renewal and protection.' }, { id: 'runes_of_flame', name: 'Runes of Flame', role: 'dps', desc: 'Fire runes that scorch the enemy.' }, { id: 'runes_of_storm', name: 'Runes of Storm', role: 'dps', desc: 'Lightning and frost: burst and control.' }]
    },

    hunter: {
      id: 'hunter',
      name: 'Hunter',
      origin: 'Rohan and Mirkwood',
      role: 'Ranged DPS',
      arch: 'dps',
      resType: 'focus',
      color: '#4f8f3f',
      trim: '#c9a24a',
      hair: '#8a5a2a',
      skin: '#e2b88f',
      weapon: false,
      gear: ['ranger'],
      armorTypes: ['leather','cloth'],
      desc: 'Strikes from afar with bow, venom and crippling shots. Kites enemies and tracks prey.',
      base: { maxHp: 105, maxRes: 100, power: 13, armor: 45, crit: 0.07, resist: 0 },
      growth: { maxHp: 13, maxRes: 0, power: 2.0, armor: 6, crit: 0.003, resist: 0.002 },
      auto: {
        name: 'Arrow Shot', range: 300, interval: 2.2, base: 5, coef: 0.6, school: 'physical',
        ranged: true, resGain: 0, fx: { kind: 'bolt', color: '#e6d28a' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 6, resCombat: 5, furyPerDmg: 0 },
      threatMod: 1.0,
      abilities: ['aimed_shot', 'quick_shot', 'serpent', 'crippling', 'disengage', 'multishot', 'mark', 'swiftness'],
      specs: [{ id: 'marksman', name: 'Marksman', role: 'dps', desc: 'Precision and burst from long range.' }, { id: 'trapper', name: 'Trapper', role: 'dps', desc: 'Poisons, snares and damage over time.' }, { id: 'strider', name: 'Strider', role: 'dps', desc: 'A close-range hunter with light armor and quick blades.' }]
    },

    champion: {
      id: 'champion',
      name: 'Champion',
      origin: 'Rohan and Eriador',
      role: 'Melee DPS',
      arch: 'dps',
      resType: 'fury',
      color: '#8a2a2a',
      trim: '#d8b070',
      hair: '#7a4a2a',
      skin: '#dcb08a',
      weapon: true,
      gear: ['warrior'],
      armorTypes: ['plate','leather','cloth'],
      desc: 'A heavy hitter with great weapons. Builds Fury with every blow and spends it in brutal finishers.',
      base: { maxHp: 120, maxRes: 100, power: 14, armor: 50, crit: 0.06, resist: 0 },
      growth: { maxHp: 15, maxRes: 0, power: 2.3, armor: 7, crit: 0.003, resist: 0.002 },
      auto: {
        name: 'Heavy Blow', range: 48, interval: 2.2, base: 7, coef: 0.7, school: 'physical',
        ranged: false, resGain: 7, fx: { kind: 'slash', color: '#ffd0b0' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: -6, resCombat: 0, furyPerDmg: 0.3 },
      threatMod: 1.0,
      abilities: ['fell_strike', 'rend', 'charge', 'bloodlust', 'mighty_swing', 'menace', 'cull', 'war_cry'],
      specs: [{ id: 'berserker', name: 'Berserker', role: 'dps', desc: 'Relentless two-handed fury.' }, { id: 'duelist', name: 'Duelist', role: 'dps', desc: 'Precise, critical strikes against single foes.' }, { id: 'defender', name: 'Defender', role: 'tank', desc: 'Trades damage for survival and holds a line.' }]
    },

    burglar: {
      id: 'burglar',
      name: 'Burglar',
      origin: 'The Shire and Bree',
      role: 'Melee DPS',
      arch: 'dps',
      resType: 'focus',
      color: '#4a4a58',
      trim: '#b0a070',
      hair: '#3a2a22',
      skin: '#e8c4a0',
      weapon: true,
      gear: ['ranger'],
      armorTypes: ['leather','cloth'],
      desc: 'Quick hands and quicker feet. Strikes from the shadows, tricks enemies and escapes what others cannot. Can start fellowship manoeuvres.',
      base: { maxHp: 105, maxRes: 100, power: 14, armor: 40, crit: 0.08, resist: 0 },
      growth: { maxHp: 13, maxRes: 0, power: 2.2, armor: 5, crit: 0.0035, resist: 0.002 },
      auto: {
        name: 'Dagger Stab', range: 44, interval: 1.8, base: 5, coef: 0.55, school: 'physical',
        ranged: false, resGain: 6, fx: { kind: 'slash', color: '#d8d8e0' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 6, resCombat: 5, furyPerDmg: 0 },
      threatMod: 0.8,
      abilities: ['stab', 'backstab', 'poison_blade', 'dirty_trick', 'fools_luck', 'shadow_step', 'cutthroat', 'escape'],
      specs: [{ id: 'mischief', name: 'Mischief', role: 'support', desc: 'Debuffs, distractions and fellowship tricks.' }, { id: 'assassin', name: 'Assassin', role: 'dps', desc: 'Burst damage from behind.' }, { id: 'trickster', name: 'Trickster', role: 'dps', desc: 'Evasion and damage over time.' }]
    },

    captain: {
      id: 'captain',
      name: 'Captain',
      origin: 'Gondor and the Rangers',
      role: 'Support',
      arch: 'support',
      resType: 'mana',
      color: '#a0802a',
      trim: '#e8e0c0',
      hair: '#5a3a2a',
      skin: '#e0b890',
      weapon: true,
      gear: ['warrior'],
      armorTypes: ['plate','leather','cloth'],
      desc: 'A commander. Buffs the group, steadies it with orders and raises a banner. Fights at the front when needed.',
      base: { maxHp: 110, maxRes: 130, power: 12, armor: 55, crit: 0.05, resist: 0.01 },
      growth: { maxHp: 14, maxRes: 5, power: 2.0, armor: 8, crit: 0.002, resist: 0.003 },
      auto: {
        name: 'Sword Cut', range: 46, interval: 2.2, base: 5, coef: 0.55, school: 'physical',
        ranged: false, resGain: 0, fx: { kind: 'slash', color: '#f0e6c0' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 8, resCombat: 2.2, furyPerDmg: 0 },
      threatMod: 1.2,
      abilities: ['rallying_strike', 'heralds_cry', 'inspire', 'defensive_order', 'to_arms', 'pointed_command', 'final_stand', 'banner'],
      specs: [{ id: 'herald', name: 'Herald', role: 'support', desc: 'Buffs and auras for the whole group.' }, { id: 'commander', name: 'Commander', role: 'heal', desc: 'Heals and steadies with orders.' }, { id: 'vanguard', name: 'Vanguard', role: 'dps', desc: 'Leads the charge: damage and fury.' }]
    },

    loremaster: {
      id: 'loremaster',
      name: 'Loremaster',
      origin: 'Rivendell and the White Tower',
      role: 'Support',
      arch: 'support',
      resType: 'mana',
      color: '#8a4fb8',
      trim: '#e8cd8a',
      hair: '#d8d8d8',
      skin: '#e8c4a0',
      weapon: false,
      gear: ['mage','healer'],
      armorTypes: ['cloth'],
      desc: 'Keeper of old lore. Weakens enemies, confuses and delays them, and shields friends with knowledge.',
      base: { maxHp: 90, maxRes: 160, power: 14, armor: 30, crit: 0.06, resist: 0.03 },
      growth: { maxHp: 10, maxRes: 7, power: 2.2, armor: 4, crit: 0.0025, resist: 0.004 },
      auto: {
        name: 'Staff Beam', range: 240, interval: 2.4, base: 3, coef: 0.45, school: 'arcane',
        ranged: true, resGain: 0, fx: { kind: 'bolt', color: '#c58bff' }
      },
      regen: { hpOoc: 0.03, hpCombat: 0, resOoc: 8, resCombat: 2.2, furyPerDmg: 0 },
      threatMod: 1.0,
      abilities: ['lore_bolt', 'polymorph', 'insight', 'blinding_light', 'frost_nova', 'lore_ward', 'exposed', 'embers'],
      specs: [{ id: 'sage', name: 'Sage', role: 'support', desc: 'Wisdom: buffs, shields and healing support.' }, { id: 'lorewise', name: 'Lorewise', role: 'dps', desc: 'Offensive lore: arcane and fire.' }, { id: 'wizened', name: 'Wizened', role: 'support', desc: 'Debuffs and crowd control.' }]
    }
  };

  MEO.CLASS_ORDER = ['guardian', 'warden', 'minstrel', 'runekeeper', 'hunter', 'champion', 'burglar', 'captain', 'loremaster'];

  /** Old save/class ids → new ones. */
  MEO.CLASS_ALIAS = { warrior: 'guardian', healer: 'minstrel', ranger: 'hunter', mage: 'runekeeper' };

  MEO.ARCH_NAMES = { tank: 'Tank', heal: 'Healer', dps: 'Damage', support: 'Support' };

  /** Does an item restricted to the legacy class list `list` fit the class? */
  MEO.classFits = function (classId, list) {
    if (!list) return true;
    const c = MEO.Classes[classId];
    if (list.indexOf(classId) >= 0) return true;
    for (let i = 0; c && i < c.gear.length; i++) if (list.indexOf(c.gear[i]) >= 0) return true;
    return false;
  };

  MEO.RES_NAMES = {
    fury: { name: 'Fury', lower: 'fury' },
    mana: { name: 'Mana', lower: 'mana' },
    focus: { name: 'Focus', lower: 'focus' },
    none: { name: '', lower: '' }
  };
})();
