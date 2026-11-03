/* ==========================================================================
   data/traits.js – Trait trees. Every class has 3 trees (one per spec).
   Each tree has 7 nodes in 4 tiers: tier 1 (2 nodes), tier 2 (2), tier 3 (2),
   tier 4 (1 capstone). Tier N needs 3*(N-1) points spent in the same tree.
   Effect per rank (keys): hp pw ar mr = % of max health / power / armor / resource,
   cr rs = flat crit chance / magic resist, dd dt sp = damage dealt / damage taken /
   move speed, ab = { id, dmg, heal, cd, cost } changes to one ability (cd and cost
   are negative to reduce). Rules in systems/traits.js (hybrid: max 5 points outside
   the main tree, and only tiers 1–2 there).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  // [name, icon, maxRank, effect per rank]
  const D = {
    guardian: [
      ['bulwark', [
        ['Toughness', '♥', 3, { hp: 0.04 }], ['Shield Training', '⛨', 3, { ar: 0.05 }],
        ['Stand Firm', '⚓', 3, { dt: -0.02 }], ['Bash Mastery', '✹', 2, { ab: { id: 'shield_bash', dmg: 0.12, cost: -0.1 } }],
        ['Unbroken', '⛰', 2, { ab: { id: 'shield_wall', cd: -0.12 } }], ['Guardian\'s Vigil', '☀', 2, { hp: 0.03, rs: 0.02 }],
        ['Immovable', '♜', 1, { dt: -0.08, ab: { id: 'shield_wall', cd: -0.15 } }]]],
      ['avenger', [
        ['Sharpened Blade', '⚔', 3, { pw: 0.03 }], ['Fury Channel', '✺', 3, { ab: { id: 'slash', dmg: 0.06 } }],
        ['Cleaving Arc', '✧', 3, { ab: { id: 'whirlwind', dmg: 0.08 } }], ['Keen Eye', '◎', 2, { cr: 0.02 }],
        ['Executioner', '☠', 2, { ab: { id: 'execute', dmg: 0.1, cd: -0.1 } }], ['Rage Unleashed', '✹', 2, { ab: { id: 'berserk', cd: -0.1 }, dd: 0.02 }],
        ['Wrath of Gondor', '✪', 1, { dd: 0.08, cr: 0.03 }]]],
      ['sentinel', [
        ['Rallying Presence', '✪', 3, { pw: 0.02 }], ['Hardy', '♥', 3, { hp: 0.03 }],
        ['Battle Cry', '♪', 3, { ab: { id: 'battle_shout', cd: -0.1, cost: -0.1 } }], ['Quick Guard', '➤', 2, { sp: 0.02 }],
        ['Protective Bash', '✹', 2, { ab: { id: 'shield_bash', cd: -0.12 } }], ['Resolute', '☀', 2, { rs: 0.03, ar: 0.03 }],
        ['Banner of the Free', '⚑', 1, { hp: 0.05, pw: 0.04 }]]]
    ],
    warden: [
      ['wall_of_spears', [
        ['Toughness', '♥', 3, { hp: 0.04 }], ['Gambit Training', '➶', 3, { ar: 0.04 }],
        ['Challenge Master', '‼', 3, { ab: { id: 'challenge', cd: -0.1 } }], ['Spear Wall', '♜', 2, { dt: -0.03 }],
        ['Deep Fend', '◈', 2, { ab: { id: 'fend', cd: -0.12 } }], ['Second Wind', '✚', 2, { ab: { id: 'second_wind', heal: 0.15, cd: -0.1 } }],
        ['Wall of Spears', '♖', 1, { dt: -0.06, hp: 0.05 }]]],
      ['assailant', [
        ['Spear Craft', '⚔', 3, { pw: 0.03 }], ['Reach', '➶', 3, { ab: { id: 'jab', dmg: 0.08 } }],
        ['Impale Mastery', '➶', 3, { ab: { id: 'impale', dmg: 0.1, cost: -0.08 } }], ['Sweeping Strikes', '✺', 2, { ab: { id: 'sweep', dmg: 0.1 } }],
        ['Keen Point', '◎', 2, { cr: 0.02 }], ['Pinning Wounds', '✂', 2, { ab: { id: 'pin_down', dmg: 0.12, cd: -0.1 } }],
        ['Lance of the North', '✪', 1, { dd: 0.07, cr: 0.03 }]]],
      ['wardmaster', [
        ['Steadfast', '♥', 3, { hp: 0.03 }], ['Guarded Stance', '⛨', 3, { ar: 0.05 }],
        ['Fortify', '⛨', 3, { ab: { id: 'fortify', cd: -0.1 } }], ['Calm Mind', '☼', 2, { mr: 0.06 }],
        ['Long Challenge', '‼', 2, { ab: { id: 'challenge', cd: -0.1, cost: -0.1 } }], ['Hardy Heart', '✚', 2, { rs: 0.03, hp: 0.02 }],
        ['Warden of the Wild', '☀', 1, { dt: -0.05, ar: 0.06 }]]]
    ],
    minstrel: [
      ['songs_of_mending', [
        ['Gentle Voice', '♪', 3, { pw: 0.03 }], ['Deep Wells', '☼', 3, { mr: 0.05 }],
        ['Healing Hand', '✚', 3, { ab: { id: 'heal', heal: 0.08, cost: -0.06 } }], ['Quick Mercy', '✦', 2, { ab: { id: 'flash_heal', heal: 0.1, cost: -0.08 } }],
        ['Renewing Verse', '❦', 2, { ab: { id: 'renew', heal: 0.12 } }], ['Radiant Chorus', '☀', 2, { ab: { id: 'radiance', heal: 0.1, cd: -0.1 } }],
        ['Song of Life', '♫', 1, { pw: 0.05, ab: { id: 'heal', heal: 0.12 } }]]],
      ['warsong', [
        ['Sharp Notes', '♪', 3, { pw: 0.03 }], ['Fierce Rhythm', '✺', 3, { ab: { id: 'smite', dmg: 0.08 } }],
        ['Painful Verse', '☣', 3, { ab: { id: 'pain', dmg: 0.1, cost: -0.08 } }], ['Clear Pitch', '◎', 2, { cr: 0.02 }],
        ['Crescendo', '♫', 2, { dd: 0.03 }], ['Battle Hymn', '✪', 2, { ab: { id: 'smite', cost: -0.12 } }],
        ['Dirge of the Fallen', '☠', 1, { dd: 0.06, cr: 0.03 }]]],
      ['harmony', [
        ['Soothing Tune', '♪', 3, { mr: 0.05 }], ['Hardy Singer', '♥', 3, { hp: 0.03 }],
        ['Shielding Song', '◉', 3, { ab: { id: 'ward', cd: -0.1, cost: -0.08 } }], ['Clean Chords', '✧', 2, { ab: { id: 'cleanse', cd: -0.15, cost: -0.1 } }],
        ['Swift Cadence', '➤', 2, { sp: 0.03 }], ['Warm Harmony', '✚', 2, { ab: { id: 'renew', heal: 0.08 }, pw: 0.02 }],
        ['Harmony of the Ainur', '♫', 1, { pw: 0.04, mr: 0.08 }]]]
    ],
    runekeeper: [
      ['runes_of_healing', [
        ['Scribed Hands', '✎', 3, { pw: 0.03 }], ['Deep Ink', '☼', 3, { mr: 0.05 }],
        ['Rune of Mending', '✚', 3, { ab: { id: 'rune_mend', heal: 0.08, cost: -0.06 } }], ['Rune of Renewal', '❦', 2, { ab: { id: 'rune_renew', heal: 0.12 } }],
        ['Warding Script', '◉', 2, { ab: { id: 'rune_ward', cd: -0.12, cost: -0.08 } }], ['Pure Script', '✧', 2, { ab: { id: 'rune_cleanse', cd: -0.15 } }],
        ['Rune-lore of Life', '♥', 1, { pw: 0.05, hp: 0.04 }]]],
      ['runes_of_flame', [
        ['Scribed Hands', '✎', 3, { pw: 0.03 }], ['Hot Ink', '♨', 3, { ab: { id: 'fireball', dmg: 0.07 } }],
        ['Smouldering Script', '♨', 3, { ab: { id: 'ignite', dmg: 0.1, cost: -0.08 } }], ['Keen Sight', '◎', 2, { cr: 0.02 }],
        ['Cold Rune', '❄', 2, { ab: { id: 'frostbolt', dmg: 0.1, cost: -0.08 } }], ['Swift Writing', '✎', 2, { ab: { id: 'fireball', cd: -0.1 } }],
        ['Mastery of Flame', '♨', 1, { dd: 0.07, cr: 0.03 }]]],
      ['runes_of_storm', [
        ['Scribed Hands', '✎', 3, { pw: 0.03 }], ['Charged Ink', '☼', 3, { mr: 0.05 }],
        ['Storm Rune', '⚡', 3, { ab: { id: 'arcane_blast', dmg: 0.1, cd: -0.08 } }], ['Frost Edge', '❄', 2, { ab: { id: 'frostbolt', dmg: 0.1 } }],
        ['Static Mind', '◎', 2, { cr: 0.02 }], ['Runic Shield', '◉', 2, { rs: 0.03, hp: 0.02 }],
        ['Heart of the Storm', '⚡', 1, { dd: 0.06, pw: 0.04 }]]]
    ],
    hunter: [
      ['marksman', [
        ['Steady Aim', '◎', 3, { pw: 0.03 }], ['Keen Eye', '◎', 3, { cr: 0.015 }],
        ['Aimed Mastery', '➶', 3, { ab: { id: 'aimed_shot', dmg: 0.09, cost: -0.06 } }], ['Quick Draw', '➤', 2, { ab: { id: 'quick_shot', dmg: 0.1, cd: -0.1 } }],
        ['Mark of Prey', '☉', 2, { ab: { id: 'mark', cd: -0.15, cost: -0.1 } }], ['Deadly Venom', '☣', 2, { ab: { id: 'serpent', dmg: 0.12 } }],
        ['Eye of the Eagle', '✪', 1, { dd: 0.06, cr: 0.04 }]]],
      ['trapper', [
        ['Woodcraft', '♣', 3, { hp: 0.03 }], ['Snare Craft', '✂', 3, { ab: { id: 'crippling', cd: -0.1, cost: -0.1 } }],
        ['Poisoned Arrows', '☣', 3, { ab: { id: 'serpent', dmg: 0.1, cost: -0.08 } }], ['Volley', '✺', 2, { ab: { id: 'multishot', dmg: 0.1, cd: -0.08 } }],
        ['Careful Step', '➤', 2, { sp: 0.03 }], ['Lethal Preparation', '◎', 2, { pw: 0.03 }],
        ['Master Trapper', '☠', 1, { dd: 0.05, ab: { id: 'multishot', dmg: 0.1 } }]]],
      ['strider', [
        ['Long Road', '➤', 3, { sp: 0.03 }], ['Hardy Walker', '♥', 3, { hp: 0.03 }],
        ['Disengage', '↩', 3, { ab: { id: 'disengage', cd: -0.1 } }], ['Swiftness', '≫', 2, { ab: { id: 'swiftness', cd: -0.12 } }],
        ['Wilds Cloak', '♣', 2, { dt: -0.02 }], ['Ranger Eyes', '◎', 2, { cr: 0.02 }],
        ['Strider of the North', '✪', 1, { sp: 0.05, dd: 0.04, hp: 0.04 }]]]
    ],
    champion: [
      ['berserker', [
        ['Brute Force', '⚔', 3, { pw: 0.03 }], ['Blood Hunger', '✹', 3, { ab: { id: 'fell_strike', dmg: 0.07 } }],
        ['Mighty Swing', '✺', 3, { ab: { id: 'mighty_swing', dmg: 0.1, cost: -0.08 } }], ['Rending Blows', '✹', 2, { ab: { id: 'rend', dmg: 0.12, cd: -0.1 } }],
        ['Bloodlust', '✹', 2, { ab: { id: 'bloodlust', cd: -0.12 } }], ['War Cry', '✪', 2, { ab: { id: 'war_cry', cd: -0.12 } }],
        ['Berserk Fury', '☠', 1, { dd: 0.08, cr: 0.03 }]]],
      ['duelist', [
        ['Precision', '◎', 3, { cr: 0.015 }], ['Duellist\'s Reach', '⚔', 3, { pw: 0.03 }],
        ['Cull the Weak', '☠', 3, { ab: { id: 'cull', dmg: 0.1, cd: -0.1 } }], ['Skull Bash', '✹', 2, { ab: { id: 'charge', cd: -0.15 } }],
        ['Fell Craft', '✹', 2, { ab: { id: 'fell_strike', cost: -0.15 } }], ['Quick Feet', '➤', 2, { sp: 0.03 }],
        ['Blade Master', '✪', 1, { dd: 0.06, cr: 0.04 }]]],
      ['defender', [
        ['Thick Hide', '⛨', 3, { ar: 0.05 }], ['Hardy', '♥', 3, { hp: 0.04 }],
        ['Menace', '☹', 3, { ab: { id: 'menace', cd: -0.12, cost: -0.1 } }], ['Brace', '♜', 2, { dt: -0.03 }],
        ['Battle Lust Shield', '✹', 2, { ab: { id: 'bloodlust', cd: -0.1 } }], ['Resolve', '☀', 2, { rs: 0.03, hp: 0.02 }],
        ['Unyielding', '♖', 1, { dt: -0.06, hp: 0.05 }]]]
    ],
    burglar: [
      ['mischief', [
        ['Light Fingers', '♣', 3, { cr: 0.015 }], ['Trickery', '★', 3, { ab: { id: 'dirty_trick', cd: -0.1, cost: -0.1 } }],
        ['Fool\'s Luck', '♣', 3, { ab: { id: 'fools_luck', cd: -0.1 } }], ['Quick Escape', '≫', 2, { ab: { id: 'escape', cd: -0.12 } }],
        ['Soft Steps', '➤', 2, { sp: 0.03 }], ['Fast Hands', '✋', 2, { pw: 0.03 }],
        ['Master of Mischief', '✪', 1, { sp: 0.04, dd: 0.04, cr: 0.03 }]]],
      ['assassin', [
        ['Deadly Aim', '◎', 3, { pw: 0.03 }], ['Backstab Craft', '✦', 3, { ab: { id: 'backstab', dmg: 0.08 } }],
        ['Cutthroat', '☠', 3, { ab: { id: 'cutthroat', dmg: 0.1, cd: -0.1 } }], ['Sure Stab', '✧', 2, { ab: { id: 'stab', dmg: 0.1 } }],
        ['Keen Edge', '◎', 2, { cr: 0.02 }], ['Shadow Step', '➤', 2, { ab: { id: 'shadow_step', cd: -0.15 } }],
        ['Silent Death', '☠', 1, { dd: 0.07, cr: 0.03 }]]],
      ['trickster', [
        ['Dirty Fighter', '☣', 3, { pw: 0.03 }], ['Venom Craft', '☣', 3, { ab: { id: 'poison_blade', dmg: 0.1, cost: -0.08 } }],
        ['Sand in the Eyes', '★', 3, { ab: { id: 'dirty_trick', cd: -0.12 } }], ['Hardy Rogue', '♥', 2, { hp: 0.03 }],
        ['Quick Poison', '☣', 2, { ab: { id: 'poison_blade', cd: -0.1 } }], ['Slippery', '≫', 2, { dt: -0.02 }],
        ['Wits of the Shire', '♣', 1, { dd: 0.06, cr: 0.03, sp: 0.03 }]]]
    ],
    captain: [
      ['herald', [
        ['Commanding Voice', '✪', 3, { pw: 0.02 }], ['Strong Spirit', '☼', 3, { mr: 0.05 }],
        ['Herald\'s Cry', '✪', 3, { ab: { id: 'heralds_cry', cd: -0.1, cost: -0.1 } }], ['To Arms!', '≫', 2, { ab: { id: 'to_arms', cd: -0.12 } }],
        ['Defensive Order', '◈', 2, { ab: { id: 'defensive_order', cd: -0.12, cost: -0.1 } }], ['Pointed Eye', '◎', 2, { ab: { id: 'pointed_command', cd: -0.1, cost: -0.1 } }],
        ['Banner of Gondor', '⚑', 1, { pw: 0.05, hp: 0.04 }]]],
      ['commander', [
        ['Compassion', '✚', 3, { pw: 0.03 }], ['Strong Spirit', '☼', 3, { mr: 0.05 }],
        ['Inspire', '✚', 3, { ab: { id: 'inspire', heal: 0.1, cost: -0.08 } }], ['Last Stand', '⛨', 2, { ab: { id: 'final_stand', cd: -0.12 } }],
        ['Rally the Wounded', '⚑', 2, { ab: { id: 'banner', heal: 0.12, cd: -0.1 } }], ['Hardy', '♥', 2, { hp: 0.03 }],
        ['Heart of the Commander', '✚', 1, { pw: 0.05, ab: { id: 'inspire', heal: 0.1 } }]]],
      ['vanguard', [
        ['Sword Arm', '⚔', 3, { pw: 0.03 }], ['Hardy', '♥', 3, { hp: 0.03 }],
        ['Rallying Strike', '⚔', 3, { ab: { id: 'rallying_strike', dmg: 0.1 } }], ['Keen Mind', '◎', 2, { cr: 0.02 }],
        ['Armoured', '⛨', 2, { ar: 0.05 }], ['Charge!', '≫', 2, { sp: 0.03 }],
        ['Lead from the Front', '✪', 1, { dd: 0.06, ar: 0.05 }]]]
    ],
    loremaster: [
      ['sage', [
        ['Deep Knowledge', '☼', 3, { mr: 0.05 }], ['Wise Words', '✎', 3, { pw: 0.02 }],
        ['Insight', '☀', 3, { ab: { id: 'insight', cd: -0.1, cost: -0.1 } }], ['Ward of Lore', '◇', 2, { ab: { id: 'lore_ward', cd: -0.12, cost: -0.1 } }],
        ['Calm Mind', '☼', 2, { rs: 0.03 }], ['Hardy Scholar', '♥', 2, { hp: 0.03 }],
        ['Sage of the West', '☀', 1, { pw: 0.05, mr: 0.08 }]]],
      ['lorewise', [
        ['Sharp Mind', '✎', 3, { pw: 0.03 }], ['Arcane Study', '✦', 3, { ab: { id: 'lore_bolt', dmg: 0.08 } }],
        ['Fiery Embers', '♨', 3, { ab: { id: 'embers', dmg: 0.1, cost: -0.08 } }], ['Keen Insight', '◎', 2, { cr: 0.02 }],
        ['Swift Study', '✦', 2, { ab: { id: 'lore_bolt', cost: -0.1 } }], ['Winter Lore', '❄', 2, { ab: { id: 'frost_nova', cd: -0.12 } }],
        ['Wisdom of Fire', '♨', 1, { dd: 0.07, cr: 0.03 }]]],
      ['wizened', [
        ['Lore of Weakness', '◎', 3, { ab: { id: 'exposed', cd: -0.1, cost: -0.1 } }], ['Blinding Mind', '☼', 3, { ab: { id: 'blinding_light', cd: -0.12, cost: -0.1 } }],
        ['Confusing Lore', '❓', 3, { ab: { id: 'polymorph', cd: -0.12 } }], ['Winter\'s Grasp', '❄', 2, { ab: { id: 'frost_nova', cd: -0.12, cost: -0.1 } }],
        ['Cunning', '✎', 2, { pw: 0.03 }], ['Old Bones', '♥', 2, { hp: 0.03 }],
        ['Wizened Wisdom', '☀', 1, { dd: 0.05, dt: -0.04, mr: 0.06 }]]]
    ]
  };

  const TIER_OF = [1, 1, 2, 2, 3, 3, 4];
  const TIER_REQ = [0, 3, 6, 9];

  MEO.TRAITS = {};
  Object.keys(D).forEach(function (classId) {
    const cls = MEO.Classes[classId];
    MEO.TRAITS[classId] = D[classId].map(function (t) {
      const spec = cls.specs.filter(function (s) { return s.id === t[0]; })[0];
      const treeId = classId + '.' + t[0];
      return {
        id: treeId, classId: classId, name: spec.name, role: spec.role, desc: spec.desc,
        nodes: t[1].map(function (n, i) {
          const tier = TIER_OF[i];
          return {
            id: treeId + '.' + i, tree: treeId, idx: i, name: n[0], icon: n[1], max: n[2],
            eff: n[3], tier: tier, req: TIER_REQ[tier - 1]
          };
        })
      };
    });
  });
})();
