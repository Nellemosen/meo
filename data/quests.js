/* ==========================================================================
   data/quests.js – Quest definitions
   Objective types:
     kill    { mobs:[ids], n }                       – defeat creatures
     collect { item, n, from:[mobIds], chance }      – quest item that only drops while the quest is active
     explore { area }                                – enter an area (see world areas)
     talk    { npc }                                 – speak to an NPC
   Rewards: xp, gold (copper), items [[id, n]], itemByClass { classId: itemId }
   requires: quest id that must be completed first. level: recommended level (offered from level-1).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  MEO.QUESTS = [
    {
      id: 'q_training', name: 'Combat Training', giver: 'halvard', turnin: 'halvard', level: 1,
      text: 'Welcome to Greenbrook, traveler. Before I send you out there, show me what you can do. North of the square stand our training dummies. Use your abilities on three of them. Tab selects a target, and the number keys use your abilities.',
      progress: 'The dummies are just north of the square. Keep swinging.',
      done: 'Not bad at all. You will be a credit to the watch yet. Take this for your trouble.',
      objectives: [{ type: 'kill', mobs: ['dummy', 'dummy_armored', 'dummy_puncher'], n: 3, label: 'Defeat Training Dummies' }],
      reward: { xp: 45, gold: 40, items: [['bread', 3]] }
    },
    {
      id: 'q_pups', name: 'Pups in the Meadow', giver: 'halvard', turnin: 'halvard', level: 2, requires: 'q_training',
      text: 'Wolf pups have been wandering out of the north meadow and the shepherds are afraid to leave their flocks. They are small, but they bite. Thin them out before they grow up into something worse.',
      progress: 'The meadow lies north of the village. Pups hunt in packs, so mind your health.',
      done: 'The shepherds can sleep tonight. Here, a charm made of pup teeth. It is not much, but it is honest work.',
      objectives: [{ type: 'kill', mobs: ['wolf_pup'], n: 5, label: 'Wolf Pups slain' }],
      reward: { xp: 110, gold: 80, items: [['pup_charm', 1]] }
    },
    {
      id: 'q_pelts', name: 'Pelts for the Smith', giver: 'torvald', turnin: 'torvald', level: 3, requires: 'q_training',
      text: 'Good leather is hard to come by since the wolves came down from the hills. Bring me four fresh pelts from the wolves east and north of the village and I will make it worth your while.',
      progress: 'Four fresh pelts. Wolves along the East Road and in the meadow carry them.',
      done: 'Fine pelts! I will have these cured by morning. Take this. I made it myself.',
      objectives: [{ type: 'collect', item: 'q_wolf_pelt', n: 4, from: ['wolf_pup', 'young_wolf'], chance: 0.55, label: 'Fresh Wolf Pelts' }],
      reward: { xp: 170, gold: 120, itemByClass: { warrior: 'ash_sword', healer: 'ash_staff', mage: 'ash_staff', ranger: 'ash_bow' } }
    },
    {
      id: 'q_footpads', name: 'Trouble on the South Road', giver: 'ulf', turnin: 'ulf', level: 5, requires: 'q_pelts',
      text: 'Footpads have been robbing travelers on the south road. I cannot leave my post, but you can. Deal with five of them, and watch their knives. They fight dirty.',
      progress: 'The footpads work the south road, past the gate. Five of them.',
      done: 'The road breathes easier already. Take this mail, issued to the night watch. It has saved better men than me.',
      objectives: [{ type: 'kill', mobs: ['footpad'], n: 5, label: 'Footpads defeated' }],
      reward: { xp: 300, gold: 180, itemByClass: { warrior: 'watch_mail', healer: 'vestments', mage: 'vestments', ranger: 'trail_jerkin' } }
    },
    {
      id: 'q_satchels', name: 'Stolen Goods', giver: 'brage', turnin: 'brage', level: 5, requires: 'q_training',
      text: 'Those footpads took three satchels of mine off a wagon. Everything I own is in those bags! Find them on the thieves along the south road and bring them back to me. I will make it worth your while.',
      progress: 'The satchels are on the footpads. Check each one you defeat.',
      done: 'My satchels! The seals are still unbroken. You are a hero, truly. Please take this ring.',
      objectives: [{ type: 'collect', item: 'q_satchel', n: 3, from: ['footpad'], chance: 0.5, label: 'Stolen Satchels' }],
      reward: { xp: 280, gold: 250, items: [['thanks_ring', 1], ['potion_heal_s', 2]] }
    },
    {
      id: 'q_camp', name: 'The Howling Camp', giver: 'halvard', turnin: 'halvard', level: 8, requires: 'q_footpads',
      text: 'The wargs have made a camp on the far side of the lake. They stole the caravan horses and they are getting bold. I need proof that they are being culled. Bring me four fangs from the Grey Wargs there. Go well prepared, since they hunt in packs.',
      progress: 'Warg Camp lies southeast, past the lake. Four fangs.',
      done: 'That is proof enough. The camp will think twice before it comes near our walls again. Well done.',
      objectives: [{ type: 'collect', item: 'q_warg_tooth', n: 4, from: ['grey_wolf'], chance: 0.6, label: 'Warg Fang Trophies' }],
      reward: { xp: 700, gold: 400, items: [['potion_heal', 3], ['potion_res', 2]] }
    },
    {
      id: 'q_shadowfang', name: 'Shadowfang', giver: 'ulf', turnin: 'ulf', level: 10, requires: 'q_camp',
      text: 'The wargs are led by a black beast the shepherds call Shadowfang. Anyone who has seen it up close does not speak of it. It lives at the heart of the camp. Kill it, and the wargs will scatter. Do not go alone.',
      progress: 'Shadowfang waits at the heart of the Warg Camp.',
      done: 'It is dead? Then the road is safe once more. You have my thanks and the thanks of everyone in Greenbrook.',
      objectives: [{ type: 'kill', mobs: ['alpha_wolf'], n: 1, label: 'Shadowfang slain' }],
      reward: { xp: 1000, gold: 700, itemByClass: { warrior: 'bandit_sword', healer: 'gnarled_staff', mage: 'gnarled_staff', ranger: 'bandit_bow' } }
    },
    {
      id: 'q_scout_tower', name: 'Lights in the Tower', giver: 'halvard', turnin: 'halvard', level: 9, requires: 'q_camp',
      text: 'Lights burn in the Fallen Tower again, and last week a scout did not return. Go northeast to the ruins and see for yourself what is happening there. Do not engage, just look and come back.',
      progress: 'The Fallen Tower lies far to the northeast.',
      done: 'Orcs, then. I feared as much. You have done well to come back alive. Take this signet. It belonged to a man who did not.',
      objectives: [{ type: 'explore', area: 'ruins', label: 'Reach the Fallen Tower' }],
      reward: { xp: 500, gold: 250, items: [['bandit_signet', 1]] }
    },
    {
      id: 'q_orcs', name: 'War Tokens', giver: 'halvard', turnin: 'halvard', level: 10, requires: 'q_scout_tower',
      text: 'So the orcs have taken the tower. We need to know how many there are. Bring me four of their war tokens, and defeat two of the brutes that guard them. Good luck, and keep your companions close.',
      progress: 'The orcs at the Fallen Tower carry the tokens. Two brutes as well.',
      done: 'This is worse than I thought, but at least now we know. The watch will be doubled. Take this, and thank you.',
      objectives: [
        { type: 'collect', item: 'q_orc_brand', n: 4, from: ['orc_scout', 'orc_brute'], chance: 0.6, label: 'Orcish War Tokens' },
        { type: 'kill', mobs: ['orc_brute'], n: 2, label: 'Orc Brutes defeated' }
      ],
      reward: { xp: 1100, gold: 900, itemByClass: { warrior: 'orc_shield', healer: 'old_tome', mage: 'old_tome', ranger: 'quiver_hunter' } }
    },
    {
      id: 'q_venom', name: 'Venom for the Forge', giver: 'torvald', turnin: 'torvald', level: 10, requires: 'q_scout_tower',
      text: 'Tower spiders have webbed the lower halls of the ruins. Their venom makes steel temper harder than any quench I know. Bring me five venom sacs and I will make you something worthy.',
      progress: 'The spiders nest in the rubble of the Fallen Tower.',
      done: 'Ha, this will do nicely. Here, my best work. It will not fail you.',
      objectives: [{ type: 'collect', item: 'q_venom_sac', n: 5, from: ['spider'], chance: 0.5, label: 'Tower Spider Venom Sacs' }],
      reward: { xp: 900, gold: 600, itemByClass: { warrior: 'orcplate_legs', healer: 'silkweave_legs', mage: 'silkweave_legs', ranger: 'roadman_legs' } }
    },
    {
      id: 'q_warchief', name: 'The Warchief of the Tower', giver: 'halvard', turnin: 'halvard', level: 12, requires: 'q_orcs',
      text: 'The tokens carry one name: Gorthak. He rules the Fallen Tower from the old hall at the north end of the courtyard, and his warband grows by the week. If he is not stopped, Greenbrook will burn before winter. Take your companions, kill him, and bring me proof. Expect fire, and do not stand still when the ground glows.',
      progress: 'Gorthak waits in the Warchief\'s Hall, at the northern end of the Fallen Tower.',
      done: 'The Tower is silent. You have done what a hundred soldiers could not. Greenbrook will remember your name. Take this, it is the least we can give.',
      objectives: [{ type: 'kill', mobs: ['warchief'], n: 1, label: 'Gorthak the Warchief slain' }],
      reward: { xp: 3000, gold: 2500, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    }
  ];

  MEO.QUEST_BY_ID = {};
  MEO.QUESTS.forEach(function (q) {
    MEO.QUEST_BY_ID[q.id] = q;
  });
})();
