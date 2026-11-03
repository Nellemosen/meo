/* ==========================================================================
   data/lore-ra.js – Lore layer: "The Rings of Power" (the Second Age).
   Re-skins the game's content without touching mechanics: races, zone and area names,
   NPC names / lines, monster names, quest items and (in data/lore-ra-quests.js) all quest texts.
   NOTE: npcIds, zone ids, area ids and quest ids stay as they were (they are internal keys),
   so e.g. npcId 'gandalf' is now Galadriel in the hub and 'halvard' is Arondir.
   The player is one of the Wayfarers: a nameless follower in the footsteps of the great ones.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  // ---- Races ----------------------------------------------------------------
  const R = MEO.RACES;
  Object.assign(R.human, {
    name: 'Man of Númenor', short: 'Human', home: 'numenor', origin: 'Númenor, the Island of the Star',
    desc: 'Sea-kings\' kin. The Númenóreans are tall, long-lived and proud, sailors and builders who carry the Light of the West to Middle-earth.'
  });
  R.human.traits[2].name = 'Gift of Númenor';
  R.human.traits[3].name = 'Sea-kings\' Command';
  Object.assign(R.elf, {
    name: 'Elf of Lindon', origin: 'Lindon and Eregion',
    desc: 'Ageless and graceful. The Elves of Lindon watched the First Age end, and they fear the shadow that is not yet fully gone.'
  });
  Object.assign(R.dwarf, {
    name: 'Dwarf of Khazad-dûm', home: 'khazad-dum', origin: 'Khazad-dûm, the Mines of Durin',
    desc: 'Stout, proud and stubborn. The Dwarves of Durin\'s folk delve deep for the one metal that gleams like starlight: mithril.'
  });
  Object.assign(R.hobbit, {
    name: 'Harfoot', short: 'Harfoot', home: 'rhovanion', origin: 'The wilds of Rhovanion',
    desc: 'Small, quiet and nimble. Harfoots wander in caravans, keep to the shadows and live by the saying that no one is ever left behind.'
  });
  R.hobbit.traits[0].name = 'Unseen Folk';
  R.hobbit.traits[2].name = 'Foraging Instinct';

  // ---- Zone and area names -------------------------------------------------------
  const ZN = {
    shire: ['The Harfoot Trail', { bywater: 'The Harfoot Camp', hill_country: 'The Wolf Hills', east_farthing: 'The Long Trail', old_forest_edge: 'The Edge of the Deep Wood' }],
    eredluin: ['Khazad-dûm – The Great Gates', { compound: 'The Upper Halls', old_mine: 'The Silver Galleries', goblin_gap: 'The Broken Gate', mountain_road: 'The Mountain Road' }],
    imladris: ['Lindon – The Grey Havens', { glade_village: 'The Grey Havens', silent_glade: 'The Silent Glade', north_road: 'The Northern Trace', webbed_vale: 'The Webbed Vale' }],
    eriador: ['Númenor – The Western Shore', { rangers_camp: 'The Harbour of Rómenna', barrow_hills: 'The Cliffs of Andustar', greenway: 'The Coast Road', black_ford: 'The Black Landing' }],
    westmark: ['The Southlands – Tirharad', {}],
    weathertop: ['The Ashen Hills', { wt_camp: 'The Wayfarers\' Halt', wt_approach: 'The Scorched Road', wt_summit: 'The Cinder Crown', wt_ruin: 'The Fallen Watchtower' }],
    rivendell: ['Eregion – Ost-in-Edhil', { rivendell_town: 'Ost-in-Edhil', rv_hall: 'The Forge Hall', rv_falls: 'The Sirannon Falls' }],
    hollin: ['Eregion – The Mithril Road', { hol_camp: 'The Wayfarers\' Camp', hol_ruins: 'The Old Elf-road', hol_pass: 'The Redhorn Foothills', hol_shore: 'The Pool by the Gate', hol_door: 'The West Gate of Khazad-dûm' }],
    moria: ['Khazad-dûm – The Deep Halls', { mo_gate: 'The Great Gate', mo_halls: 'The Hall of Pillars', mo_tomb: 'The Mithril Vein', mo_bridge: 'The Bridge of Durin' }]
  };
  Object.keys(ZN).forEach(function (zid) {
    const z = MEO.ZONES[zid];
    if (!z) return;
    z.name = ZN[zid][0];
    if (z.spec) {
      z.spec.name = z.name;
      z.spec.areas.forEach(function (a) { if (ZN[zid][1][a.id]) a.name = ZN[zid][1][a.id]; });
    }
    const orig = z.build;
    z.build = function (seed) {
      const w = orig.call(z, seed);
      w.name = z.name;
      if (zid === 'westmark') {
        w.areas.forEach(function (a) {
          if (a.id === 'village') a.name = 'Tirharad';
          if (a.id === 'ruins') a.name = 'Ostirith';
          if (a.id === 'hall') a.name = 'The Warlord\'s Hall';
          if (a.id === 'camp') a.name = 'The Orc Camp';
          if (a.id === 'lake') a.name = 'The Mere';
          if (a.id === 'road_west') a.name = 'The Road Home';
          if (a.id === 'road_east') a.name = 'The Ashen Road';
        });
      }
      return w;
    };
  });
  MEO.ZONES.rivendell.spec.areas.forEach(function (a) { if (a.id === 'road_east') a.name = 'The Mithril Road'; if (a.id === 'road_west') a.name = 'The Ashen Road'; });

  // ---- NPCs: [zone][npcId] -> overrides -----------------------------------------------
  const V = function (who, pitch, rate) { return { who: who, pitch: pitch, rate: rate }; };
  const NPC = {
    shire: {
      hamfast: { name: 'Sadoc Burrows', lines: ['A caravan is only as quick as its slowest foot, and we leave no foot behind.', 'Keep to the shadows, little one. Harfoots do not make a fuss.'] },
      rosie: { name: 'Poppy Proudfellow', voice: V('female', 1.3, 1.05), lines: ['There is always something good at the bottom of a berry basket, if you do not give up.', 'Strange tall folk asking questions on the trail. I do not like it.'] },
      maggot: { name: 'Largo Brandyfoot', voice: V('male', 1.05, 1.0), lines: ['A good Harfoot knows where the berries grow. A great one knows where the wolves do not.'] },
      gandalf: { name: 'The Stranger', voice: V('male', 0.8, 0.85), lines: ['I fell from the sky, and I do not remember why. But something in me remembers fire.', 'There is a darkness following me, little friend. I would not have it follow you.'] }
    },
    eredluin: {
      balin: { name: 'Prince Durin', voice: V('male', 0.8, 0.95), lines: ['The mountain has more to give than we dare take. That is both its gift and its warning.', 'Stone does not forget, and neither do I.'] },
      dwalin: { name: 'Captain Ragni', voice: V('male', 0.65, 1.0), lines: ['Keep your axe sharp and your wits sharper.', 'Goblins do not scare a dwarf. They merely annoy him.'] },
      oin: { name: 'Narvi the Lore-keeper', lines: ['I read the stars and the stones. Both speak of change, and not all of it is welcome.'] },
      bofur: { name: 'Brô the Miner', lines: ['Honest work, mining. Dark, but honest. And the silver-vein is nearer than ever.'] }
    },
    imladris: {
      lindir: { name: 'Lindir the Minstrel', lines: ['Do you hear it? The trees of the Havens are singing softly tonight, and the song is wrong.'] },
      glorfindel: { name: 'Thalion, Warden of the Havens', lines: ['I have watched these shores for centuries. The shadow was not this patient before.'] },
      elrond: { name: 'Elrond, the Herald', lines: ['The High King sees further than any of us. I merely carry his words, and try to understand them.'] }
    },
    eriador: {
      halbarad: { name: 'Captain Elendil', voice: V('male', 0.85, 0.95), lines: ['The sea has been strange this season, and so have the sails on it.', 'A captain does not choose his storms, only his ship.'] },
      aldor: { name: 'Aldor the Farmer', lines: ['My granary stood full at midsummer. Now there is not a sack left.'] }
    },
    westmark: {
      halvard: { name: 'Arondir, Watchwarden', style: 'hunter', color: '#4a5a3a', trim: '#b8a878', hair: '#1c1812', skin: '#d8b090', weapon: true, voice: V('male', 0.85, 0.95),
        lines: ['Welcome to Tirharad. We hold this village against the dark, and we are fewer every week.', 'Orc-fires burn on the old tower. They gather there, and they are not idle.', 'Watch yourself out there. We will soon have need of someone like you.'] },
      brage: { name: 'Merchant Brage', lines: ['Fair prices, honest weights. The orcs have not yet taken my coin, and I would like it to stay that way.', 'They say the wargs carry goods plundered from the road.'] },
      torvald: { name: 'Smith Torvald', lines: ['A good blade is worth nothing without a hand that can wield it.', 'Bring me your gear when it needs tending. I mean to keep the Watch armed.'] },
      ulf: { name: 'Sentry Ulf', lines: ['The south gate is open, but do not venture out after dark.', 'The roads are safe enough, if you keep to them.'] },
      gandalf: { name: 'Galadriel, Commander of the Northern Armies', style: 'loremaster', color: '#c8d0dc', trim: '#e8d890', hair: '#e8d8a0', skin: '#f0d4b8', voice: V('female', 1.0, 0.85),
        lines: ['I have hunted a shadow for a thousand years. It does not rest, and so neither shall I.', 'Do not ask me to be gentle. Ask me to be right.'] }
    },
    weathertop: {
      halbarad: { name: 'Bronwyn, Leader of the Wayfarers', voice: V('female', 1.0, 1.0), lines: ['We are not the heroes of the tale, but heroes need someone to keep the road open behind them.', 'Ash on the wind. The mountain is awake.'] },
      wt_scout: { name: 'Scout Mirieth', lines: ['I counted nine fires on the hill last night. Then I stopped counting.'] }
    },
    rivendell: {
      elrond: { name: 'Elrond, Herald of Gil-galad', lines: ['Eregion has a gift for shaping things. I am not sure that is always a virtue.'] },
      glorfindel: { name: 'Celebrimbor, Lord of Eregion', style: 'smith', voice: V('male', 0.85, 0.9), lines: ['There is nothing in the world I cannot imagine making. That, they tell me, is the danger.'] },
      bilbo: { name: 'Disa, Princess of Khazad-dûm', style: 'smith', color: '#7a5a8a', trim: '#e0c890', hair: '#4a2a1a', voice: V('female', 1.0, 1.0), scale: 0.88, lines: ['Dwarves are not afraid of the dark. We simply respect what lives in it.'] },
      erestor: { name: 'Herald Calithil', lines: ['Every message has a sender. Every sender has a motive. Remember both.'] },
      gandalf: { name: 'Galadriel, Commander of the Northern Armies', style: 'loremaster', color: '#c8d0dc', trim: '#e8d890', hair: '#e8d8a0', skin: '#f0d4b8', voice: V('female', 1.0, 0.85), lines: ['I rode here with a question. I leave with a fear. That is also an answer.'] },
      boromir: { name: 'Isildur of Númenor', voice: V('male', 0.9, 1.0), lines: ['My father says the sea keeps its secrets. I am less patient than he is.'] },
      legolas: { name: 'Halbrand, the Wanderer', style: 'villager', color: '#5a4a3a', trim: '#c8b078', hair: '#2a2018', skin: '#e0b890', weapon: false, voice: V('male', 0.9, 0.95), lines: ['Everything can be forged into something better. That is the only lesson worth learning.'] },
      gimli: { name: 'Durin IV, Prince of Khazad-dûm', style: 'smith', color: '#8a3a30', trim: '#d8b868', hair: '#4a2a18', voice: V('male', 0.7, 1.0), lines: ['Mithril. A metal that glows like starlight in the dark. We should be careful what we do with it.'] }
    },
    hollin: {
      halbarad: { name: 'Bronwyn, Leader of the Wayfarers', voice: V('female', 1.0, 1.0), lines: ['We are a day behind them, no more. That is where a rearguard belongs.', 'The mithril carts leave deep ruts. Wolves can follow ruts too.'] },
      wt_scout: { name: 'Scout Mirieth', lines: ['I found a hand-print burnt into an oak. A brand. Whoever made it is not trying to hide.'] },
      nar: { name: 'Nár the Delver', lines: ['I know the Gate of Durin as I know my father\'s face. Something has changed in the stone, though.'] }
    },
    moria: {
      halbarad: { name: 'Bronwyn, Leader of the Wayfarers', voice: V('female', 1.0, 1.0), lines: ['I have never liked deep places. Light no torch you cannot put out.', 'The mithril is there. So is whatever sleeps beneath it.'] },
      nar: { name: 'Nár the Delver', lines: ['Do not look at it. It is a vein, not a hall, and some of us have died looking.'] },
      wt_scout: { name: 'Scout Mirieth', lines: ['The stone is wrong here. I can hear the mountain breathing, and it is not asleep.'] }
    }
  };
  Object.keys(NPC).forEach(function (zid) {
    const z = MEO.ZONES[zid];
    if (!z) return;
    (z.npcs || []).forEach(function (n) {
      const o = NPC[zid][n.npcId];
      if (o) Object.assign(n, o);
    });
  });

  // ---- Monsters and quest items -----------------------------------------------------------
  const MN = {
    ruffian: 'Raider', dark_warg: 'Ash Warg', hill_orc: 'Ash Orc Hunter', barrow_shade: 'Ash Shade',
    wraith_rider: 'The Ash-wraith of Orodruin', isengard_scout: 'Adar\'s Scout', hollin_wight: 'Ashen Wight',
    watcher: 'The Deep Watcher', moria_goblin: 'Deep Goblin', moria_orc: 'Orc Captain of the Deep',
    troll_chief: 'The Troll of the Mithril Vein', durins_bane: 'The Ember-fiend of the Deep', mirk_spiderling: 'Mirk Spiderling'
  };
  Object.keys(MN).forEach(function (id) { if (MEO.MOBS[id]) MEO.MOBS[id].name = MN[id]; });
  const IN = {
    q_cloak_scrap: 'Scrap of Ash-cloak', q_isengard_token: 'Adar\'s Brand', q_mazarbul_page: 'Page of the Dwarven Ledger',
    q_black_seal: 'Mark of the Hooded Cult', q_eye_sigil: 'Sigil of the Eye', q_stolen_grain: 'Sack of Stolen Grain'
  };
  Object.keys(IN).forEach(function (id) { if (MEO.ITEMS && MEO.ITEMS[id]) MEO.ITEMS[id].name = IN[id]; });
  if (MEO.ITEMS) {
    if (MEO.ITEMS.q_black_seal) MEO.ITEMS.q_black_seal.desc = 'A scrap of black cloth stamped with a pale, many-fingered hand. Cult-hunters carry them.';
    if (MEO.ITEMS.q_isengard_token) MEO.ITEMS.q_isengard_token.desc = 'A hand-shaped brand burnt into a scrap of leather. Adar\'s orcs mark everything they own.';
    if (MEO.ITEMS.q_mazarbul_page) MEO.ITEMS.q_mazarbul_page.desc = 'Torn and bloodstained, written in a dwarvish hand: tallies of mithril and a warning.';
  }
})();
