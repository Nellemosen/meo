/* ==========================================================================
   data/items.js – Items, qualities, loot tables and the merchant's stock
   Price = what the merchant pays for the item, in copper (100 c = 1 s, 100 s = 1 g).
   Stats: power, armor, maxHp, maxRes, crit (0.01 = 1%), resist.
   Armor types: plate | leather | cloth. Weapons/shields carry an explicit class list (cls).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.QUALITY = [
    { id: 0, name: 'Poor', color: '#9d9d9d' },
    { id: 1, name: 'Common', color: '#f2f2f2' },
    { id: 2, name: 'Uncommon', color: '#4cff3a' },
    { id: 3, name: 'Rare', color: '#4aa8ff' },
    { id: 4, name: 'Epic', color: '#c27bff' }
  ];

  MEO.SLOTS = {
    head: { name: 'Head', icon: '♔' },
    neck: { name: 'Neck', icon: '◌' },
    chest: { name: 'Chest', icon: '▣' },
    hands: { name: 'Hands', icon: '✋' },
    legs: { name: 'Legs', icon: '▥' },
    feet: { name: 'Feet', icon: '⌂' },
    ring: { name: 'Ring', icon: '○' },
    mainhand: { name: 'Main Hand', icon: '⚔' },
    offhand: { name: 'Off Hand', icon: '◈' }
  };
  MEO.SLOT_ORDER = ['head', 'neck', 'chest', 'hands', 'legs', 'feet', 'ring', 'mainhand', 'offhand'];

  MEO.STAT_NAMES = {
    power: 'Power', armor: 'Armor', maxHp: 'Health', maxRes: 'Resource', crit: 'Crit', resist: 'Magic Resist'
  };

  // Which armor types may each class wear?
  MEO.ARMOR_ALLOWED = {
    guardian: ['plate', 'leather', 'cloth'], champion: ['plate', 'leather', 'cloth'], captain: ['plate', 'leather', 'cloth'],
    warden: ['leather', 'cloth'], hunter: ['leather', 'cloth'], burglar: ['leather', 'cloth'],
    minstrel: ['cloth', 'leather'], runekeeper: ['cloth', 'leather'], loremaster: ['cloth']
  };

  const ITEMS = (MEO.ITEMS = {});

  function add(id, o) {
    o.id = id;
    if (o.q === undefined) o.q = 1;
    if (!o.stack) o.stack = 1;
    ITEMS[id] = o;
    return o;
  }

  // ---- Consumables -----------------------------------------------------
  add('potion_heal_s', { name: 'Minor Healing Draught', kind: 'consumable', q: 1, stack: 10, price: 12, buy: 40, icon: '🧪', color: '#e0584a',
    use: { type: 'heal', amount: 140, cd: 20 }, desc: 'Restores 140 health. Shares a 20 sec cooldown with other draughts.' });
  add('potion_heal', { name: 'Healing Draught', kind: 'consumable', q: 2, stack: 10, price: 30, buy: 110, icon: '🧪', color: '#ff3a3a',
    use: { type: 'heal', amount: 270, cd: 20 }, desc: 'Restores 270 health. Shares a 20 sec cooldown with other draughts.' });
  add('potion_res_s', { name: 'Minor Draught of Vigor', kind: 'consumable', q: 1, stack: 10, price: 12, buy: 40, icon: '🧪', color: '#4a8ae8',
    use: { type: 'res', pct: 0.5, cd: 20 }, desc: 'Restores 50% of your resource (Mana, Focus or Fury).' });
  add('potion_res', { name: 'Draught of Vigor', kind: 'consumable', q: 2, stack: 10, price: 30, buy: 110, icon: '🧪', color: '#3a6aff',
    use: { type: 'res', pct: 0.8, cd: 20 }, desc: 'Restores 80% of your resource (Mana, Focus or Fury).' });
  add('bread', { name: 'Wayfarer\'s Bread', kind: 'consumable', q: 1, stack: 20, price: 2, buy: 8, icon: '🍞', color: '#d8b070',
    use: { type: 'heal', amount: 90, ooc: true }, desc: 'Restores 90 health. Can only be eaten out of combat.' });

  // ---- Junk (sold to the merchant) -----------------------------------
  add('wolf_pelt', { name: 'Wolf Pelt', kind: 'junk', q: 0, stack: 20, price: 14, icon: '🐾', desc: 'A coarse hide. Merchants will pay for it.' });
  add('wolf_fang', { name: 'Wolf Fang', kind: 'junk', q: 0, stack: 20, price: 9, icon: '🦷', desc: 'A sharp tooth.' });
  add('grey_pelt', { name: 'Grey Warg Pelt', kind: 'junk', q: 0, stack: 20, price: 28, icon: '🐾', desc: 'Thick, warm fur from a warg.' });
  add('alpha_pelt', { name: 'Shadowfang\'s Pelt', kind: 'junk', q: 2, stack: 1, price: 220, icon: '🐾', desc: 'Black as night. A rare trophy.' });
  add('stolen_goods', { name: 'Plundered Candlestick', kind: 'junk', q: 0, stack: 5, price: 55, icon: '🕯', desc: 'Stolen from a caravan. There is still wax on it.' });
  add('rusty_dagger', { name: 'Rusty Dagger', kind: 'junk', q: 0, stack: 5, price: 16, icon: '🗡', desc: 'Good for nothing but selling.' });
  add('orc_tooth', { name: 'Orc Tooth', kind: 'junk', q: 0, stack: 20, price: 22, icon: '🦷', desc: 'Yellow and crooked.' });
  add('orc_brand', { name: 'Orcish Brand', kind: 'junk', q: 0, stack: 10, price: 38, icon: '✠', desc: 'An iron brand bearing a red eye.' });
  add('spider_silk', { name: 'Spider Silk', kind: 'junk', q: 0, stack: 20, price: 12, icon: '🕸', desc: 'Tough and sticky.' });
  add('venom_gland', { name: 'Venom Gland', kind: 'junk', q: 0, stack: 10, price: 26, icon: '☣', desc: 'Careful, it is leaking.' });

  // ---- Quest items (cannot be sold, taken by the quest on turn-in) ----------
  add('q_wolf_pelt', { name: 'Fresh Wolf Pelt', kind: 'quest', q: 1, stack: 20, price: 0, icon: '🐾', desc: 'Torvald wants these for his leatherwork.' });
  add('q_mushroom', { name: 'Basket of Mushrooms', kind: 'quest', q: 1, stack: 10, price: 0, icon: '🍄', desc: 'A basket of Farmer Maggot\'s prized mushrooms.' });
  add('q_cloak_scrap', { name: 'Scrap of Black Cloak', kind: 'quest', q: 1, stack: 10, price: 0, icon: '🧣', desc: 'Cold to the touch, and it will not burn.' });
  add('q_isengard_token', { name: 'White Hand Token', kind: 'quest', q: 1, stack: 10, price: 0, icon: '✋', desc: 'A small badge stamped with a white hand. Saruman has eyes everywhere.' });
  add('q_mazarbul_page', { name: 'Page of the Book of Mazarbul', kind: 'quest', q: 1, stack: 10, price: 0, icon: '📜', desc: 'Torn, bloodstained, and written in a dwarvish hand.' });
  add('q_black_seal', { name: 'Black Wax Seal', kind: 'quest', q: 1, stack: 10, price: 0, icon: '⚫', desc: 'A seal of black wax pressed with a pale, many-fingered hand.' });
  add('q_ore', { name: 'Chunk of Silver-vein Ore', kind: 'quest', q: 1, stack: 10, price: 0, icon: '⛏', desc: 'Ore the Dwarves of Ered Luin mined, taken by thieves.' });
  add('q_eye_sigil', { name: 'Eye Sigil', kind: 'quest', q: 1, stack: 10, price: 0, icon: '◉', desc: 'A rag painted with a red, lidless eye.' });
  add('q_silver_leaf', { name: 'Silver Leaf of Imladris', kind: 'quest', q: 1, stack: 10, price: 0, icon: '🍃', desc: 'A leaf of silver, torn from a ward-tree of the valley.' });
  add('q_stolen_grain', { name: 'Sack of Stolen Grain', kind: 'quest', q: 1, stack: 10, price: 0, icon: '🌾', desc: 'Grain taken from the burned farmsteads of the North Downs.' });
  add('q_satchel', { name: 'Stolen Satchel', kind: 'quest', q: 1, stack: 10, price: 0, icon: '👜', desc: 'Merchant Brage\'s stolen goods. The seal is still intact.' });
  add('q_warg_tooth', { name: 'Warg Fang Trophy', kind: 'quest', q: 1, stack: 20, price: 0, icon: '🦷', desc: 'Proof that a warg from the camp has been dealt with.' });
  add('q_orc_brand', { name: 'Orcish War Token', kind: 'quest', q: 1, stack: 20, price: 0, icon: '✠', desc: 'Carried by the orcs at the Fallen Tower.' });
  add('q_venom_sac', { name: 'Tower Spider Venom Sac', kind: 'quest', q: 1, stack: 20, price: 0, icon: '☣', desc: 'Smith Torvald says he can use the venom for tempering.' });

  // ---- Early gear (quest rewards and low-level drops) ----------------------
  add('pup_charm', { name: 'Pup-Tooth Charm', kind: 'armor', slot: 'neck', q: 2, lvl: 2, stats: { maxHp: 10, power: 1 }, price: 10, icon: '📿', desc: 'Small teeth on a leather cord.' });
  weapon('ash_sword', 'Tirharad Hunting Sword', 'sword', ['warrior'], 2, 3, { power: 6 }, 18, '🗡', 'Balanced and well kept.');
  weapon('ash_staff', 'Hazel Staff', 'staff', ['healer', 'mage'], 2, 3, { power: 7, maxRes: 10 }, 18, '🪄', 'Cut from a hazel tree at the lake.');
  weapon('ash_bow', 'Elm Hunting Bow', 'bow', ['ranger'], 2, 3, { power: 7 }, 18, '🏹', 'A hunter\'s bow with a good draw.');
  add('watch_mail', { name: 'Watchman\'s Mail', kind: 'armor', slot: 'chest', armorType: 'plate', q: 2, lvl: 5, stats: { armor: 64, maxHp: 18 }, price: 24, icon: '🛡', desc: 'Issued to the Tirharad night watch.' });
  add('trail_jerkin', { name: 'Trailwalker\'s Jerkin', kind: 'armor', slot: 'chest', armorType: 'leather', q: 2, lvl: 5, stats: { armor: 36, power: 4, crit: 0.008 }, price: 24, icon: '🧥', desc: 'Oiled leather, soft as a glove.' });
  add('vestments', { name: 'Tirharad Vestments', kind: 'armor', slot: 'chest', armorType: 'cloth', q: 2, lvl: 5, stats: { armor: 14, power: 6, maxRes: 18 }, price: 24, icon: '👘', desc: 'Embroidered with a silver oak leaf.' });
  jewel('thanks_ring', 'Ring of Thanks', 'ring', 2, 5, { power: 3, maxHp: 14 }, 30, '💍', 'A merchant\'s gift.');

  // ---- Armor sets (generated) -----------------------------------------
  const SLOT_W = { head: 0.7, chest: 1, hands: 0.5, legs: 0.85, feet: 0.5 };
  const TYPE_ICON = {
    plate: { head: '⛑', chest: '🛡', hands: '🧤', legs: '▥', feet: '👢' },
    leather: { head: '🎩', chest: '🧥', hands: '🧤', legs: '👖', feet: '👢' },
    cloth: { head: '🎓', chest: '👘', hands: '🧤', legs: '👖', feet: '👟' }
  };

  function armorSet(key, label, armorType, q, lvl, parts) {
    Object.keys(parts).forEach(function (slot) {
      const w = SLOT_W[slot];
      const m = q >= 3 ? 1.4 : 1;
      const st = {};
      if (armorType === 'plate') {
        st.armor = Math.round(52 * w * m);
        st.maxHp = Math.round(12 * w * m);
      } else if (armorType === 'leather') {
        st.armor = Math.round(32 * w * m);
        st.power = Math.round(2.5 * w * m);
        st.crit = Math.round(6 * w * m) / 1000;
      } else {
        st.armor = Math.round(11 * w * m);
        st.power = Math.round(3.5 * w * m);
        st.maxRes = Math.round(12 * w * m);
      }
      add(key + '_' + slot, {
        name: parts[slot], kind: 'armor', slot: slot, armorType: armorType, q: q, lvl: lvl,
        stats: st, price: Math.round((q >= 3 ? 70 : 34) * w * (lvl / 9)), icon: TYPE_ICON[armorType][slot],
        desc: label
      });
    });
  }

  armorSet('wolfhide', 'Stitched from wolf pelts.', 'leather', 2, 9, {
    head: 'Wolfhide Hood', chest: 'Wolfhide Vest', hands: 'Wolfhide Gloves', legs: 'Wolfhide Breeches', feet: 'Wolfhide Boots'
  });
  armorSet('roadman', 'Worn but sturdy thieves\' loot.', 'leather', 2, 9, {
    head: 'Highwayman\'s Hood', chest: 'Highwayman\'s Jacket', hands: 'Highwayman\'s Gloves', legs: 'Highwayman\'s Breeches', feet: 'Highwayman\'s Boots'
  });
  armorSet('silkweave', 'Woven from spider silk.', 'cloth', 2, 11, {
    head: 'Silken Hood', chest: 'Silken Robe', hands: 'Silken Gloves', legs: 'Silken Leggings', feet: 'Silken Slippers'
  });
  armorSet('orcplate', 'Hammered together by orcish smiths.', 'plate', 2, 11, {
    head: 'Orcish Iron Helm', chest: 'Orcish Breastplate', hands: 'Orcish Iron Gauntlets', legs: 'Orcish Greaves', feet: 'Orcish Iron Boots'
  });
  armorSet('towerguard', 'Heirloom of the Tower\'s wardens.', 'plate', 3, 12, {
    head: 'Towerwarden\'s Helm', chest: 'Towerwarden\'s Hauberk', legs: 'Towerwarden\'s Greaves'
  });
  armorSet('shadowhide', 'Cut from Shadowfang\'s own pelt.', 'leather', 3, 12, {
    chest: 'Shadowpelt Cloak', head: 'Shadowpelt Hood'
  });
  armorSet('starweave', 'Silk that glimmers faintly in the dark.', 'cloth', 3, 12, {
    chest: 'Starwoven Robe', legs: 'Starwoven Leggings'
  });

  // Starter gear (common quality)
  add('recruit_mail', { name: 'Recruit\'s Hauberk', kind: 'armor', slot: 'chest', armorType: 'plate', q: 1, lvl: 1, stats: { armor: 40, maxHp: 10 }, price: 8, icon: '🛡', desc: 'Standard issue from the Tirharad watch.' });
  add('recruit_jerkin', { name: 'Recruit\'s Jerkin', kind: 'armor', slot: 'chest', armorType: 'leather', q: 1, lvl: 1, stats: { armor: 24, power: 2 }, price: 8, icon: '🧥', desc: 'Standard issue for scouts.' });
  add('recruit_robe', { name: 'Recruit\'s Robe', kind: 'armor', slot: 'chest', armorType: 'cloth', q: 1, lvl: 1, stats: { armor: 8, power: 3, maxRes: 10 }, price: 8, icon: '👘', desc: 'A plain woolen robe.' });

  // ---- Weapons -----------------------------------------------------------------
  function weapon(id, name, wtype, cls, q, lvl, stats, price, icon, desc) {
    add(id, { name: name, kind: 'weapon', slot: 'mainhand', wtype: wtype, cls: cls, q: q, lvl: lvl, stats: stats, price: price, icon: icon, desc: desc || '' });
  }
  const SWORD = ['warrior'];
  const STAFF = ['healer', 'mage'];
  const BOW = ['ranger'];

  weapon('recruit_sword', 'Recruit\'s Sword', 'sword', SWORD, 1, 1, { power: 4 }, 10, '🗡', 'A plain, honest sword.');
  weapon('recruit_staff', 'Recruit\'s Staff', 'staff', STAFF, 1, 1, { power: 5, maxRes: 8 }, 10, '🪄', 'A staff of ash.');
  weapon('recruit_bow', 'Recruit\'s Bow', 'bow', BOW, 1, 1, { power: 5 }, 10, '🏹', 'A common hunting bow.');

  weapon('steel_sword', 'Steel Sword', 'sword', SWORD, 1, 8, { power: 7 }, 40, '🗡', 'Solid smithwork.');
  weapon('walking_staff', 'Wanderer\'s Staff', 'staff', STAFF, 1, 8, { power: 8, maxRes: 14 }, 40, '🪄', 'Serves equally well as a walking stick and a staff.');
  weapon('short_bow', 'Shortbow', 'bow', BOW, 1, 8, { power: 8 }, 40, '🏹', 'Light and quick.');

  weapon('bandit_sword', 'Highwayman\'s Sword', 'sword', SWORD, 2, 9, { power: 10, crit: 0.01 }, 60, '🗡', 'Sharp despite the rust.');
  weapon('bandit_bow', 'Highwayman\'s Bow', 'bow', BOW, 2, 9, { power: 11, crit: 0.012 }, 60, '🏹', 'Stolen from a ranger.');
  weapon('gnarled_staff', 'Gnarled Staff', 'staff', STAFF, 2, 9, { power: 12, maxRes: 20 }, 60, '🪄', 'Grown crooked, but grown well.');
  weapon('orc_blade', 'Orcish Blade', 'sword', SWORD, 2, 11, { power: 13, maxHp: 14 }, 90, '🗡', 'Heavy, curved and cruel.');
  weapon('spider_staff', 'Spiderwood Staff', 'staff', STAFF, 2, 11, { power: 14, maxRes: 26, crit: 0.01 }, 90, '🪄', 'Tangled in silk.');
  weapon('hunter_bow', 'Ranger\'s Longbow', 'bow', BOW, 2, 11, { power: 14, crit: 0.015 }, 90, '🏹', 'Long reach, taut string.');
  weapon('tower_sword', 'Watchmaster\'s Longsword', 'sword', SWORD, 3, 12, { power: 18, crit: 0.02, maxHp: 20 }, 220, '⚔', 'Bears the mark of the Tower.');
  weapon('tower_staff', 'Towerwarden\'s Staff', 'staff', STAFF, 3, 12, { power: 19, maxRes: 38, crit: 0.02 }, 220, '🪄', 'A crystal glows faintly at its tip.');
  weapon('black_bow', 'Black Longbow', 'bow', BOW, 3, 12, { power: 19, crit: 0.03 }, 220, '🏹', 'Carved from yew, twisted by shadow.');
  // ---- Epic: the Warchief's hoard (boss drops) ----
  weapon('gorthak_blade', 'Gorthak\'s Cleaver', 'sword', SWORD, 4, 14, { power: 26, crit: 0.03, maxHp: 40 }, 600, '⚔', 'Notched by a hundred battles. Still hungry.');
  weapon('gorthak_staff', 'Staff of the Red Eye', 'staff', STAFF, 4, 14, { power: 28, maxRes: 60, crit: 0.03 }, 600, '🪄', 'A burning ember is trapped in the iron claw.');
  weapon('gorthak_bow', 'Warchief\'s Warbow', 'bow', BOW, 4, 14, { power: 28, crit: 0.045 }, 600, '🏹', 'Horn and sinew. It takes a strong arm to string.');
  add('gorthak_crown', { name: 'Crown of Black Iron', kind: 'armor', slot: 'head', armorType: 'plate', q: 4, lvl: 14, stats: { armor: 78, maxHp: 34, power: 6 }, price: 500, icon: '⛑', desc: 'Worn by every warchief before him.' });
  add('gorthak_hood', { name: 'Hood of the Red Eye', kind: 'armor', slot: 'head', armorType: 'cloth', q: 4, lvl: 14, stats: { armor: 20, power: 12, maxRes: 40 }, price: 500, icon: '🎓', desc: 'Whispers in the dark.' });
  add('gorthak_ring', { name: 'Band of the Warchief', kind: 'armor', slot: 'ring', q: 4, lvl: 14, stats: { power: 10, crit: 0.02, maxHp: 30 }, price: 450, icon: '💍', desc: 'Heavy, blood-red and warm to the touch.' });
  add('gorthak_amulet', { name: 'Amulet of the Fallen Tower', kind: 'armor', slot: 'neck', q: 4, lvl: 14, stats: { power: 9, maxRes: 30, armor: 30 }, price: 450, icon: '◌', desc: 'It once hung above the tower gate.' });
  add('warchief_banner', { name: 'Tattered Warchief Banner', kind: 'junk', q: 2, stack: 1, price: 400, icon: '⚑', desc: 'Proof that the Fallen Tower is silent at last.' });


  // ---- Off hand ----------------------------------------------------------------
  function offhand(id, name, wtype, cls, q, lvl, stats, price, icon, desc) {
    add(id, { name: name, kind: 'armor', slot: 'offhand', wtype: wtype, cls: cls, q: q, lvl: lvl, stats: stats, price: price, icon: icon, desc: desc || '' });
  }
  offhand('recruit_shield', 'Recruit\'s Wooden Shield', 'shield', SWORD, 1, 1, { armor: 30 }, 8, '◈', 'A round shield of lime wood.');
  offhand('iron_shield', 'Iron-Banded Shield', 'shield', SWORD, 2, 9, { armor: 60, maxHp: 14 }, 55, '◈', 'Banded with iron.');
  offhand('orc_shield', 'Orcish Shield', 'shield', SWORD, 2, 11, { armor: 78, maxHp: 22 }, 85, '◈', 'Dented and scarred, with a red eye painted on.');
  offhand('old_tome', 'Old Tome', 'tome', STAFF, 2, 9, { power: 5, maxRes: 16 }, 50, '📖', 'Pages filled with faded runes.');
  offhand('rune_tome', 'Runebook', 'tome', STAFF, 3, 12, { power: 9, maxRes: 30, crit: 0.015 }, 190, '📖', 'The runes shift when you are not looking.');
  offhand('quiver_hunter', 'Ranger\'s Quiver', 'quiver', BOW, 2, 9, { power: 5, crit: 0.01 }, 55, '🎯', 'Filled with well-balanced arrows.');

  // ---- Jewelry ----------------------------------------------------------------
  function jewel(id, name, slot, q, lvl, stats, price, icon, desc) {
    add(id, { name: name, kind: 'armor', slot: slot, q: q, lvl: lvl, stats: stats, price: price, icon: icon, desc: desc || '' });
  }
  jewel('copper_ring', 'Copper Ring', 'ring', 2, 9, { power: 4, maxHp: 10 }, 45, '💍', 'Simple, but lucky.');
  jewel('bandit_signet', 'Highwayman\'s Signet Ring', 'ring', 2, 10, { crit: 0.015, armor: 12 }, 60, '💍', 'Engraved with a crow.');
  jewel('orc_charm', 'Orcish Amulet', 'neck', 2, 11, { maxHp: 28, armor: 10 }, 80, '📿', 'Hung with teeth.');
  jewel('fang_necklace', 'Wolffang Necklace', 'neck', 3, 12, { power: 9, crit: 0.02, maxHp: 26 }, 210, '📿', 'The fangs still carry the chill of night.');
  jewel('silver_ring', 'Silver Ring of the Tower', 'ring', 3, 12, { power: 7, crit: 0.015, maxRes: 20 }, 190, '💍', 'Engraving: "Keep watch."');

  // ---- Loot tables ----------------------------------------------------------
  // Each row: { item | pick:[...], chance, min, max }. "pick" selects one at random.
  function setPick(key, slots) {
    return slots.map(function (s) {
      return key + '_' + s;
    });
  }

  MEO.LOOT = {
    pup: [
      { item: 'wolf_fang', chance: 0.3 },
      { item: 'bread', chance: 0.12 },
      { item: 'potion_heal_s', chance: 0.03 }
    ],
    young: [
      { item: 'wolf_pelt', chance: 0.55 },
      { item: 'wolf_fang', chance: 0.3 },
      { item: 'pup_charm', chance: 0.04 },
      { item: 'bread', chance: 0.12 },
      { item: 'potion_heal_s', chance: 0.05 }
    ],
    footpad: [
      { item: 'rusty_dagger', chance: 0.3 },
      { item: 'stolen_goods', chance: 0.1 },
      { pick: ['ash_sword', 'ash_staff', 'ash_bow'], chance: 0.05 },
      { pick: ['watch_mail', 'trail_jerkin', 'vestments'], chance: 0.03 },
      { item: 'potion_heal_s', chance: 0.1 },
      { item: 'potion_res_s', chance: 0.06 },
      { item: 'bread', chance: 0.18 }
    ],
    wolf: [
      { item: 'wolf_pelt', chance: 0.7 },
      { item: 'wolf_fang', chance: 0.35 },
      { pick: setPick('wolfhide', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.09 },
      { item: 'potion_heal_s', chance: 0.06 },
      { item: 'bread', chance: 0.1 }
    ],
    wolf2: [
      { item: 'grey_pelt', chance: 0.65 },
      { item: 'wolf_fang', chance: 0.3, min: 1, max: 2 },
      { pick: setPick('wolfhide', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.13 },
      { item: 'potion_heal_s', chance: 0.08 },
      { item: 'potion_heal', chance: 0.03 },
      { item: 'copper_ring', chance: 0.02 }
    ],
    alpha: [
      { item: 'alpha_pelt', chance: 1 },
      { pick: ['fang_necklace', 'shadowhide_chest', 'shadowhide_head'], chance: 1 },
      { pick: ['fang_necklace', 'shadowhide_chest', 'shadowhide_head', 'black_bow', 'tower_sword'], chance: 0.5 },
      { item: 'potion_heal', chance: 1, min: 2, max: 3 },
      { item: 'potion_res', chance: 0.6 }
    ],
    bandit: [
      { item: 'stolen_goods', chance: 0.22 },
      { item: 'rusty_dagger', chance: 0.25 },
      { pick: setPick('roadman', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.13 },
      { pick: ['bandit_sword', 'bandit_bow', 'gnarled_staff', 'iron_shield', 'old_tome', 'quiver_hunter'], chance: 0.1 },
      { pick: ['bandit_signet', 'copper_ring'], chance: 0.04 },
      { item: 'potion_heal_s', chance: 0.12 },
      { item: 'potion_res_s', chance: 0.08 },
      { item: 'bread', chance: 0.2 }
    ],
    orc: [
      { item: 'orc_tooth', chance: 0.5 },
      { item: 'orc_brand', chance: 0.28 },
      { pick: setPick('orcplate', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.13 },
      { pick: ['orc_blade', 'orc_shield', 'hunter_bow'], chance: 0.05 },
      { item: 'orc_charm', chance: 0.03 },
      { item: 'potion_heal_s', chance: 0.1 },
      { item: 'potion_heal', chance: 0.03 }
    ],
    boss: [
      { item: 'warchief_banner', chance: 1 },
      { pick: ['gorthak_blade', 'gorthak_staff', 'gorthak_bow', 'gorthak_crown', 'gorthak_hood', 'gorthak_ring', 'gorthak_amulet'], chance: 1 },
      { pick: ['gorthak_blade', 'gorthak_staff', 'gorthak_bow', 'gorthak_crown', 'gorthak_hood', 'gorthak_ring', 'gorthak_amulet'], chance: 0.6 },
      { pick: setPick('orcplate', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.8 },
      { item: 'potion_heal', chance: 1, min: 2, max: 4 },
      { item: 'potion_res', chance: 1, min: 1, max: 2 }
    ],
    orc2: [
      { item: 'orc_brand', chance: 0.6 },
      { item: 'orc_tooth', chance: 0.4, min: 1, max: 2 },
      { pick: setPick('orcplate', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.22 },
      { pick: ['orc_blade', 'orc_shield', 'hunter_bow', 'spider_staff'], chance: 0.09 },
      { pick: ['tower_sword', 'tower_staff', 'rune_tome', 'towerguard_head', 'towerguard_chest', 'towerguard_legs', 'silver_ring'], chance: 0.07 },
      { item: 'potion_heal', chance: 0.12 },
      { item: 'potion_res', chance: 0.08 }
    ],
    spider: [
      { item: 'spider_silk', chance: 0.7 },
      { item: 'venom_gland', chance: 0.35 },
      { pick: setPick('silkweave', ['head', 'chest', 'hands', 'legs', 'feet']), chance: 0.14 },
      { pick: ['spider_staff', 'old_tome'], chance: 0.05 },
      { pick: ['starweave_chest', 'starweave_legs'], chance: 0.015 },
      { item: 'potion_res_s', chance: 0.09 }
    ]
  };

  // Merchant's stock (Brage the Trader)
  MEO.VENDOR_STOCK = {
    brage: ['potion_heal_s', 'potion_heal', 'potion_res_s', 'potion_res', 'bread', 'ash_sword', 'ash_staff', 'ash_bow', 'steel_sword', 'walking_staff', 'short_bow']
  };

  // Starter kit per class
  MEO.STARTER_KIT = {
    guardian: { equip: ['recruit_sword', 'recruit_shield', 'recruit_mail'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    champion: { equip: ['recruit_sword', 'recruit_mail'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    captain: { equip: ['recruit_sword', 'recruit_shield', 'recruit_mail'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    warden: { equip: ['recruit_sword', 'recruit_shield', 'recruit_jerkin'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    hunter: { equip: ['recruit_bow', 'recruit_jerkin'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    burglar: { equip: ['recruit_bow', 'recruit_jerkin'], bag: [['potion_heal_s', 3], ['bread', 5]] },
    minstrel: { equip: ['recruit_staff', 'recruit_robe'], bag: [['potion_heal_s', 2], ['potion_res_s', 3], ['bread', 5]] },
    runekeeper: { equip: ['recruit_staff', 'recruit_robe'], bag: [['potion_heal_s', 2], ['potion_res_s', 3], ['bread', 5]] },
    loremaster: { equip: ['recruit_staff', 'recruit_robe'], bag: [['potion_heal_s', 2], ['potion_res_s', 3], ['bread', 5]] }
  };
})();
