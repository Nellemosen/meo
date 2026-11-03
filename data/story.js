/* ==========================================================================
   data/story.js – The main story, Book I: "The Shadow in the West".
   Four races start in four places; each chain of five quests ends with an
   "arrive" quest that is turned in to Marshal Halvard in Greenbrook. From there
   the story is shared: Gandalf, the Westmark quests, Gorthak the Warchief, and
   the way east. Book II (m_wt_*, m_rv_*): Weathertop and Rivendell. `story: true` quests carry a star in the quest log.
   Quest ids: sh_ (Shire), du_ (Dwarf), el_ (Elf), hu_ (Human), m_ (main story, hub).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  const CLASS_ITEM_1 = { warrior: 'ash_sword', healer: 'ash_staff', mage: 'ash_staff', ranger: 'ash_bow' };
  const CLASS_ITEM_2 = { warrior: 'watch_mail', healer: 'vestments', mage: 'vestments', ranger: 'trail_jerkin' };

  const kill = function (mobs, n, label) { return { type: 'kill', mobs: mobs, n: n, label: label }; };
  const collect = function (item, n, from, chance, label) { return { type: 'collect', item: item, n: n, from: from, chance: chance, label: label }; };
  const explore = function (area, label) { return { type: 'explore', area: area, label: label }; };

  const Q = [
    // =================== THE SHIRE (Hobbit) ======================================
    {
      id: 'sh_pups', name: 'Hungry Pups on the Hill', giver: 'hamfast', turnin: 'hamfast', level: 1, story: true,
      text: 'Hullo there, young master! Or mistress. Never mind. Wolf pups have been coming down from the hills, and they dig up my taters something terrible. My old dad would not believe wolves in the Shire, not since the Fell Winter. Thin them out, would you?',
      progress: 'The pups run in the hill country, north-east of Bywater.',
      done: 'Gone quiet at last! The taters are safe. Here, a little something for your trouble. Mind you eat it, you look thin.',
      objectives: [kill(['wolf_pup'], 4, 'Wolf Pups driven off')],
      reward: { xp: 60, gold: 30, items: [['bread', 3]] }
    },
    {
      id: 'sh_mushrooms', name: 'Maggot\'s Mushrooms', giver: 'maggot', turnin: 'maggot', level: 2, requires: 'sh_pups', story: true,
      text: 'Those wolves have been into my mushroom patch, and they carry off whole baskets! A mushroom is a serious thing to a Maggot. Find the baskets they dropped, and I will pay you well. And mind my dogs on the way out.',
      progress: 'The baskets lie with the wolves in the hills and on the East Farthing.',
      done: 'My mushrooms! Only a little chewed. You have done a good turn today, and I will say so in the village.',
      objectives: [collect('q_mushroom', 4, ['wolf_pup', 'young_wolf'], 0.6, 'Baskets of Mushrooms')],
      reward: { xp: 90, gold: 50, itemByClass: CLASS_ITEM_1 }
    },
    {
      id: 'sh_ruffians', name: 'Strangers on the East Road', giver: 'rosie', turnin: 'rosie', level: 3, requires: 'sh_mushrooms', story: true,
      text: 'Rough folk have come to the East Farthing. Big Folk, and not friendly. They took the cart-horse from the Green Dragon and broke the Thistlewood fence, and nobody in the Shire is used to such things. Could you scare them off? I would not ask, only Hamfast says you are the sort who can.',
      progress: 'The ruffians loiter on the East Farthing, along the road east.',
      done: 'Oh, thank goodness. The Green Dragon is quiet again. Please, take this. There will be a pot on the fire for you whenever you come back.',
      objectives: [kill(['ruffian'], 4, 'Ruffians driven off')],
      reward: { xp: 130, gold: 80, items: [['potion_heal_s', 2]] }
    },
    {
      id: 'sh_seals', name: 'A Wizard\'s Errand', giver: 'gandalf', turnin: 'gandalf', level: 3, requires: 'sh_ruffians', story: true,
      text: 'Ah. I wondered when I would find you, and here you are. Those ruffians were not simple thieves. They were searching for something, or someone, a long way from where they were told to look. If you take their seals, I may learn who sent them. And, my dear fellow, Hobbits are often hardier than anyone expects. Including themselves.',
      progress: 'The ruffians carry black wax seals. Bring me three.',
      done: 'The pale hand. I feared as much. Mordor reaches further than anyone in this peaceful country would believe. I must ask one more thing of you.',
      objectives: [collect('q_black_seal', 3, ['ruffian'], 0.6, 'Black Wax Seals')],
      reward: { xp: 180, gold: 90, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'sh_arrive', name: 'The Road to Greenbrook', giver: 'gandalf', turnin: 'halvard', level: 4, requires: 'sh_seals', story: true,
      text: 'Take this letter east, to Greenbrook in the Westmark, and place it in the hands of Marshal Halvard. He guards the road, and he should know what you have seen. Keep to the road, keep your head, and keep your friends close. The road goes ever on, and this is where yours begins.',
      progress: 'Follow the road east, out of the Shire, to Greenbrook. Marshal Halvard waits there.',
      done: 'A letter from Gandalf himself? Then it is worse than I feared. Sit, friend, you have come a long way. I am glad you are here.',
      objectives: [explore('village', 'Reach Greenbrook')],
      reward: { xp: 250, gold: 120, items: [['potion_heal_s', 2], ['bread', 3]] }
    },

    // =================== ERED LUIN (Dwarf) =======================================
    {
      id: 'du_spiders', name: 'Cave-crawlers', giver: 'dwalin', turnin: 'dwalin', level: 1, story: true,
      text: 'Spiders in the Old Mine again, and the miners will not go below. Mirkwood spawn, if you ask me, though how they came this far west I do not know. Take your axe and clear the first gallery. A dwarf who fears a spider is no dwarf.',
      progress: 'The spiderlings crawl in the Old Mine, north-east of the Hall.',
      done: 'Well done. Dwarves are slow to praise but quick to remember. You have earned the Hall\'s thanks.',
      objectives: [kill(['mirk_spiderling'], 5, 'Spiderlings slain')],
      reward: { xp: 60, gold: 30, items: [['bread', 3]] }
    },
    {
      id: 'du_ore', name: 'Ore for the Forge', giver: 'bofur', turnin: 'bofur', level: 2, requires: 'du_spiders', story: true,
      text: 'The forges are cold. Goblins and cave-things have dragged our silver-vein ore out of the lower galleries and into their holes. A dwarf can forgive many things, but not stolen ore. Bring back what you can find. We will see it forged into something worthy.',
      progress: 'Stolen ore is carried by the cave-things in the Old Mine and the goblins at Goblin Gap.',
      done: 'Good silver! The forge will sing again. Take this. I made it on my day off, which is to say, I stole the time.',
      objectives: [collect('q_ore', 4, ['mirk_spiderling', 'goblin_sneak'], 0.55, 'Chunks of Silver-vein Ore')],
      reward: { xp: 90, gold: 50, itemByClass: CLASS_ITEM_1 }
    },
    {
      id: 'du_goblins', name: 'Goblins at the Gate', giver: 'dwalin', turnin: 'dwalin', level: 3, requires: 'du_ore', story: true,
      text: 'The goblins have grown bold, and they are not alone behind it: something drives them. Go to Goblin Gap, south-east of the Mountain Road, and teach them that the Gate still has teeth.',
      progress: 'Goblin Gap lies south-east, beyond the Mountain Road.',
      done: 'Five less to fear. The rest will think twice. Yet I do not like it. Something is driving them, and they do not plunder as goblins plunder.',
      objectives: [kill(['goblin_sneak'], 5, 'Goblin Sneaks slain')],
      reward: { xp: 130, gold: 80, items: [['potion_heal_s', 2]] }
    },
    {
      id: 'du_signs', name: 'Signs of the Eye', giver: 'oin', turnin: 'oin', level: 3, requires: 'du_goblins', story: true,
      text: 'I have been reading the marks the goblins leave. Not their usual scrawl. An Eye, painted red, and always the same Eye. I have seen such a mark in an old book, and I did not like the story it told. Bring me three of their painted rags, and I will know for certain.',
      progress: 'The goblins at Goblin Gap carry cloths painted with the Eye.',
      done: 'It is true, then. The Eye. Lidless, watching. I did not think I would live to see it wake again. Balin must hear of this at once.',
      objectives: [collect('q_eye_sigil', 3, ['goblin_sneak'], 0.6, 'Eye Sigils')],
      reward: { xp: 180, gold: 90, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'du_arrive', name: 'Word to the Free Peoples', giver: 'balin', turnin: 'halvard', level: 4, requires: 'du_signs', story: true,
      text: 'The Dwarves of Ered Luin cannot fight what is coming alone. There is a man in Greenbrook, in the Westmark, Marshal Halvard, who guards the road for the Free Peoples. Take him our warning, and take this seal: it is the seal of Durin\'s folk. The Eye is awake. Tell him that, and let him do what is wise.',
      progress: 'Take the Mountain Road east to Greenbrook and find Marshal Halvard.',
      done: 'The seal of Durin\'s folk, and a warning from Ered Luin. Then the stories are true. Sit, friend. You have done more than you know.',
      objectives: [explore('village', 'Reach Greenbrook')],
      reward: { xp: 250, gold: 120, items: [['potion_heal_s', 2], ['bread', 3]] }
    },

    // =================== IMLADRIS (Elf) ==========================================
    {
      id: 'el_whispers', name: 'Whispers in the Trees', giver: 'lindir', turnin: 'lindir', level: 1, story: true,
      text: 'The trees of the Silent Glade are singing, and the song is wrong. Something drives the wolves of the north against the Marches, and the young ones are the first to come. Go, and quiet the glade. Gently, if you can.',
      progress: 'The pups run in the Silent Glade, north-west of the river.',
      done: 'The song is softer. Still wrong, but softer. Thank you. Take this, and keep your ears open.',
      objectives: [kill(['wolf_pup'], 4, 'Wolf Pups driven off')],
      reward: { xp: 60, gold: 30, items: [['bread', 3]] }
    },
    {
      id: 'el_webs', name: 'Webs in the Vale', giver: 'glorfindel', turnin: 'glorfindel', level: 2, requires: 'el_whispers', story: true,
      text: 'Spiders have crossed into the Webbed Vale, south-east of the river, and our wards are failing. They come from the dark of Mirkwood, and they should not be able to reach so far. I will not ask a stranger to risk what I would risk myself, but I have other duties. Clear them out.',
      progress: 'The spiderlings nest in the Webbed Vale, south-east of the river.',
      done: 'The vale is clear. You are quicker than you look. I will remember you.',
      objectives: [kill(['mirk_spiderling'], 5, 'Spiderlings slain')],
      reward: { xp: 90, gold: 50, itemByClass: CLASS_ITEM_1 }
    },
    {
      id: 'el_leaves', name: 'The Stolen Wards', giver: 'lindir', turnin: 'lindir', level: 3, requires: 'el_webs', story: true,
      text: 'Goblins have been tearing the silver leaves from our ward-trees. The leaves keep the paths safe. Without them, the Marches are open. Bring back what they stole, and we will mend the wards before the next dusk.',
      progress: 'The goblins on the Northern Trace carry the leaves.',
      done: 'The leaves are whole. We can mend the wards. Thank you, friend of the valley. I will sing of this, if I live to.',
      objectives: [collect('q_silver_leaf', 4, ['goblin_sneak'], 0.55, 'Silver Leaves of Imladris')],
      reward: { xp: 130, gold: 80, items: [['potion_heal_s', 2]] }
    },
    {
      id: 'el_hunt', name: 'The Hunter in the Dark', giver: 'glorfindel', turnin: 'glorfindel', level: 3, requires: 'el_leaves', story: true,
      text: 'The goblins do not act alone. Wargs have been seen on the road south of the Trace, scouting. They are not hunting for food. They are looking for a path. Kill three of them, and look at what they carry.',
      progress: 'Warg scouts prowl the road south of the Northern Trace, near the river.',
      done: 'Black harness, and the Eye. The same sign the goblins carry. Elrond must hear of this.',
      objectives: [kill(['warg_scout'], 3, 'Warg Scouts slain')],
      reward: { xp: 180, gold: 90, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'el_arrive', name: 'Elrond\'s Warning', giver: 'elrond', turnin: 'halvard', level: 4, requires: 'el_hunt', story: true,
      text: 'You have seen what the shadow does at our borders. It is not only here. There is a Marshal in Greenbrook, in the Westmark, who gathers what is left of the Free Peoples in the west. Take him my word, and the word of Imladris: it is time. Do not hurry, but do not delay.',
      progress: 'Cross the river and take the road east to Greenbrook. Find Marshal Halvard.',
      done: 'A message from Lord Elrond himself. I did not think the Elves would send word to us. They must be afraid. Sit, friend, and tell me everything.',
      objectives: [explore('village', 'Reach Greenbrook')],
      reward: { xp: 250, gold: 120, items: [['potion_heal_s', 2], ['bread', 3]] }
    },

    // =================== THE NORTH DOWNS (Man of the West) =======================
    {
      id: 'hu_wolves', name: 'Wolves at the Border', giver: 'halbarad', turnin: 'halbarad', level: 1, story: true,
      text: 'Welcome to the Watch. The Rangers of the North keep these lands, and we are few. Wolves are coming down from the Barrow-Downs. They are hungry, and they are not the first sign that something is wrong. Clear the pups from the hills and the herders will breathe easier.',
      progress: 'The wolves hunt in the Barrow-Downs, north-east of the camp.',
      done: 'Good. The herders will breathe again. Stay a while, there is more work for someone with your skills.',
      objectives: [kill(['wolf_pup'], 4, 'Wolf Pups driven off')],
      reward: { xp: 60, gold: 30, items: [['bread', 3]] }
    },
    {
      id: 'hu_grain', name: 'Burned Farmsteads', giver: 'aldor', turnin: 'aldor', level: 2, requires: 'hu_wolves', story: true,
      text: 'They burned the farmsteads along the Greenway and carried off the grain, every sack. The winter will be hard. If you find what they took, bring it back. I do not ask for justice. Bread will do.',
      progress: 'The brigands on the Greenway carry the stolen grain.',
      done: 'Grain! Honest grain. We shall eat this winter after all. Bless you, stranger. Take this.',
      objectives: [collect('q_stolen_grain', 4, ['ruffian'], 0.55, 'Sacks of Stolen Grain')],
      reward: { xp: 90, gold: 50, itemByClass: CLASS_ITEM_1 }
    },
    {
      id: 'hu_brigands', name: 'Brigands on the Greenway', giver: 'halbarad', turnin: 'halbarad', level: 3, requires: 'hu_grain', story: true,
      text: 'The brigands cannot be farmers gone wrong. They are organised, and well armed, and they are paid. By whom, I do not know. Break them, and see what they carry. The Greenway runs east from here.',
      progress: 'The brigands hold the Greenway, east of the Watch.',
      done: 'Black wax on their orders, and a mark I have not seen since my father\'s day. Whoever pays them has a long reach.',
      objectives: [kill(['ruffian'], 5, 'Brigands slain')],
      reward: { xp: 130, gold: 80, items: [['potion_heal_s', 2]] }
    },
    {
      id: 'hu_tracks', name: 'Dark Tracks', giver: 'halbarad', turnin: 'halbarad', level: 3, requires: 'hu_brigands', story: true,
      text: 'One of my scouts found tracks at the Black Ford, hoofprints, deeper than any horse should leave. Go there and see them for yourself. Wargs prowl the ford, so watch your back. I need to know whether what I fear is true.',
      progress: 'The Black Ford lies south-east of the Greenway. Wargs prowl there.',
      done: 'It is as I feared. Riders in black, hunting. Someone must carry this word west, and I cannot leave the Watch.',
      objectives: [explore('black_ford', 'Reach the Black Ford'), kill(['warg_scout'], 2, 'Warg Scouts slain')],
      reward: { xp: 180, gold: 90, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'hu_arrive', name: 'A Ranger\'s Warning', giver: 'halbarad', turnin: 'halvard', level: 4, requires: 'hu_tracks', story: true,
      text: 'There is a Marshal in Greenbrook, in the Westmark, who guards the road for the Free Peoples. Take him this: the Rangers have found the tracks of the Black Riders, and they hunt something small and precious. He will know what to do. Go quickly, and trust no one on the road you do not know.',
      progress: 'Take the road east to Greenbrook and find Marshal Halvard.',
      done: 'Halbarad sends you? Then it is serious. The Rangers are not given to alarm. Come, sit, and tell me everything.',
      objectives: [explore('village', 'Reach Greenbrook')],
      reward: { xp: 250, gold: 120, items: [['potion_heal_s', 2], ['bread', 3]] }
    },

    // =================== MAIN STORY IN THE HUB: the paths merge ==================
    {
      id: 'm_gandalf', name: 'The Grey Pilgrim', giver: 'halvard', turnin: 'gandalf', level: 4, story: true,
      requires: ['sh_arrive', 'du_arrive', 'el_arrive', 'hu_arrive'],
      text: 'Four roads have brought four warnings to my door: from the Shire, from Ered Luin, from Imladris and from the Rangers in the north. They say the same thing in different words. There is only one person who can make sense of this, and he is here, in Greenbrook, this very week. Gandalf the Grey, by the well in the square. Go and speak to him.',
      progress: 'Gandalf waits by the well in the market square.',
      done: 'So. Four warnings, from four peoples, and one shadow behind them all. I have waited long for this council, even if it is only the two of us, and a few brave friends. Yes. It is time to act.',
      objectives: [{ type: 'talk', npc: 'gandalf', label: 'Speak to Gandalf' }],
      reward: { xp: 300, gold: 150, items: [['potion_heal', 2]] }
    },
    {
      id: 'm_orders', name: 'Orders of the Eye', giver: 'halvard', turnin: 'gandalf', level: 12, requires: 'q_warchief', story: true,
      text: 'Gorthak is dead, and the Fallen Tower is silent, but a warlord does not act without orders. Search his hall at the north end of the courtyard. Anything he kept, any map or letter, and bring it to Gandalf. The wizard will know how to read it.',
      progress: 'Search Gorthak\'s hall at the north end of the Fallen Tower.',
      done: 'A map of the old road, and orders in the Black Speech. It is as I feared: Gorthak was only a hunter, set to watch the road. His master hunts something small and precious. The road leads east, to Weathertop.',
      objectives: [explore('hall', 'Search Gorthak\'s Hall')],
      reward: { xp: 1200, gold: 800, items: [['potion_heal', 3], ['potion_res', 2]] }
    },
    {
      id: 'm_road', name: 'The Road Goes Ever On', giver: 'gandalf', turnin: 'gandalf', level: 12, requires: 'm_orders', story: true,
      text: 'You have done what the Free Peoples needed: you have bought them time. The Tower is free and the road is open, but the Shadow will not wait. The Black Riders come east from the Shire\'s border, and you and I will meet them on the old road at Weathertop. First, rest, repair your kit, and say what must be said to your friends. When you are ready, speak to me again.',
      progress: 'Speak to Marshal Halvard before you leave. A soldier deserves a farewell.',
      done: 'Then it begins. The road goes ever on and on, down from the door where it began. Now far ahead the road has gone, and you must follow, if you can. Book I of your story is complete. The road to Weathertop and Rivendell waits.',
      objectives: [{ type: 'talk', npc: 'halvard', label: 'Say farewell to Marshal Halvard' }],
      reward: { xp: 2000, gold: 1500, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },

    // =================== BOOK II: THE ROAD TO RIVENDELL ===========================
    {
      id: 'm_wt_road', name: 'The Old Road East', giver: 'gandalf', turnin: 'gandalf', level: 12, requires: 'm_road', story: true,
      text: 'The Westmark is behind you, and the road east is long. Follow it past the Fallen Tower and through the east gate, until you reach the hill the Rangers call Weathertop. I will go ahead, and wait for you at the Rangers\' Halt. Keep to the road, and do not light a fire you cannot put out.',
      progress: 'Take the east road out of Greenbrook, past the Fallen Tower, to Weathertop.',
      done: 'You came by the old road, and without losing anyone. Good. Weathertop is not a place that forgives carelessness, as you will see.',
      objectives: [explore('wt_camp', 'Reach the Rangers\' Halt at Weathertop')],
      reward: { xp: 1200, gold: 400, items: [['potion_heal', 2], ['bread', 4]] }
    },
    {
      id: 'm_wt_wargs', name: 'Wolves of the Hill', giver: 'halbarad', turnin: 'halbarad', level: 13, requires: 'm_wt_road', story: true,
      text: 'You remember the Black Ford, and the tracks I feared. They have followed us here, and they have brought wargs: black ones, bred for the hunt. They circle the Old Road at dusk. Thin them out before they find our fires, or we shall not sleep tonight.',
      progress: 'The Black Wargs hunt along the Old Road, east of the camp.',
      done: 'Fewer teeth in the dark now. Still, wargs hunt for a master. Whoever rides them is close.',
      objectives: [kill(['dark_warg'], 6, 'Black Wargs slain')],
      reward: { xp: 1500, gold: 450, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_wt_hunters', name: 'Scraps of Shadow', giver: 'wt_scout', turnin: 'wt_scout', level: 13, requires: 'm_wt_road', story: true,
      text: 'Hill orcs came out of the east with something under their cloaks, a scrap of black cloth, passed from hand to hand like a holy thing. Take a few from them. Gandalf will want to see it. And be careful. The cloth is cold, and it does not burn.',
      progress: 'The Hill Orc Hunters patrol the slopes north of the Old Road.',
      done: 'It is cold! The scrap feels cold, even through the glove. I will not touch it again. Take it to the wizard.',
      objectives: [collect('q_cloak_scrap', 4, ['hill_orc'], 0.55, 'Scraps of Black Cloak')],
      reward: { xp: 1500, gold: 450, items: [['potion_heal', 2], ['potion_res', 2]] }
    },
    {
      id: 'm_wt_summit', name: 'The Summit of Weathertop', giver: 'gandalf', turnin: 'gandalf', level: 14, requires: ['m_wt_wargs', 'm_wt_hunters'], story: true,
      text: 'The scraps are Nazgul cloth, woven in Mordor. They have been here, and they will be here again, and the hill is where they come to see. Climb Weathertop. The ring of stones on its summit is what is left of the Tower of Amon Sul. The shades of its old guard still walk there, bound by the dark. Clear them, and look to the east.',
      progress: 'Climb the hill to the Summit of Weathertop and clear the shades.',
      done: 'The tower is quiet, for now. I saw, from the summit, nine fires on the hill, nine, and only a few paces from where we stand. They know the place. They will be here by nightfall.',
      objectives: [explore('wt_summit', 'Reach the Summit of Weathertop'), kill(['barrow_shade'], 5, 'Shades slain')],
      reward: { xp: 2200, gold: 600, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_wt_rider', name: 'The Rider on the Hill', giver: 'gandalf', turnin: 'gandalf', level: 16, requires: 'm_wt_summit', story: true,
      text: 'At nightfall the Rider comes alone, to scout the hill before the others arrive. He is one of the Nine, and he is wounded in spirit only when his master is far. Stand against him in the ruins of Amon Sul. Do not look into his hood. Do not stand in the cold that follows him. Break him, and the others will hesitate.',
      progress: 'The Rider waits in the ruins of Amon Sul, on the summit of Weathertop.',
      done: 'He is driven off, not destroyed. They cannot be killed, not by us. But the way to the Bruinen is open now. Come, we ride for Rivendell, and Elrond.',
      objectives: [{ type: 'kill', mobs: ['wraith_rider'], n: 1, label: 'The Rider of Weathertop driven off' }],
      reward: { xp: 5000, gold: 2500, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },
    {
      id: 'm_rv_arrive', name: 'The Ford of Bruinen', giver: 'gandalf', turnin: 'elrond', level: 16, requires: 'm_wt_rider', story: true,
      text: 'The road to Rivendell follows the Bruinen east from here, through the valley of the Hoarwell. Take it quickly. Elrond will know what to do with what we have found. Tell him: the Nine are loose, and the Ring is nearer than he hopes.',
      progress: 'Follow the road east to Rivendell and find Elrond.',
      done: 'Gandalf sent you? Then there is no doubt. Come in, and rest. This house has been waiting for many years for tidings like these.',
      objectives: [explore('rivendell_town', 'Reach Rivendell')],
      reward: { xp: 3000, gold: 800, items: [['potion_heal', 3], ['bread', 5]] }
    },
    {
      id: 'm_rv_glorfindel', name: 'The Elf-lord of the Ford', giver: 'elrond', turnin: 'glorfindel', level: 17, requires: 'm_rv_arrive', story: true,
      text: 'Glorfindel rode out to meet the Nine at the ford. He is a veteran of the First Age and a better judge of the Riders than I. Seek him out, and tell him what you saw on Weathertop. I would not say it twice, and he does not like to be told things twice.',
      progress: 'Find Glorfindel somewhere in the courtyards of Rivendell.',
      done: 'Weathertop, and the Rider. You faced him alone? You are braver than most who wear armour. It will not be long until the Council meets.',
      objectives: [{ type: 'talk', npc: 'glorfindel', label: 'Speak to Glorfindel' }],
      reward: { xp: 2000, gold: 600, items: [['potion_res', 2]] }
    },
    {
      id: 'm_rv_bilbo', name: 'There and Back Again', giver: 'glorfindel', turnin: 'bilbo', level: 17, requires: 'm_rv_glorfindel', story: true,
      text: 'There is one in this valley who knows more of the Ring than the Council suspects, and he does not know it himself. A small, kind, old hobbit with a book. Find Bilbo in the garden, and listen to what he has to say. It will matter. That is all I will tell you.',
      progress: 'Bilbo Baggins is in the gardens of Rivendell.',
      done: 'Ah! A visitor. Did you bring a map? No? Never mind. I have been writing, you see, and I should like to show you something, but the pen is gone. It will turn up. It always does. Tell Frodo, if you see him, that his old uncle thinks of him.',
      objectives: [{ type: 'talk', npc: 'bilbo', label: 'Speak to Bilbo' }],
      reward: { xp: 2500, gold: 1000, items: [['potion_heal', 3], ['potion_res', 3]] }
    },
    {
      id: 'm_rv_council', name: 'The Council of Elrond', giver: 'bilbo', turnin: 'elrond', level: 17, requires: 'm_rv_bilbo', story: true,
      text: 'Elrond has called a Council of all the Free Peoples, and you are to be there. I would go, but I am too old and too tired, and I should only fall asleep. Go to Elrond, and tell him you are ready. And look after the young ones. Someone has to.',
      progress: 'Speak to Elrond when you are ready to attend the Council.',
      done: 'Then it begins. Book II of your story is complete: you have faced the Rider at Weathertop, and brought word to Rivendell. What the Council decides will shape the Third Age, and your part in it. The road goes ever on.',
      objectives: [{ type: 'talk', npc: 'elrond', label: 'Tell Elrond you are ready' }],
      reward: { xp: 6000, gold: 3000, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },

    // =================== BOOK III: THE FELLOWSHIP OF THE RING =====================
    {
      id: 'm_f_council', name: 'The Council of Elrond', giver: 'elrond', turnin: 'elrond', level: 17, requires: 'm_rv_council', story: true,
      text: 'They have come from the Shire, from Gondor, from Mirkwood and from Erebor, and they all say the same thing: the Ring cannot stay, and it cannot be used. It must be destroyed in the fire where it was made. Go into the Hall of Fire and listen, for what is said there will decide the fate of the Free Peoples.',
      progress: 'Enter the Hall of Fire, in the heart of Rivendell.',
      done: 'It is decided. The Ring goes to Mordor, and it goes in the hands of one who did not ask for it. Frodo has spoken. Nine walkers will go with him, to match the Nine Riders.',
      objectives: [explore('rv_hall', 'Attend the Council in the Hall of Fire')],
      reward: { xp: 4000, gold: 1200, items: [['potion_heal', 3], ['potion_res', 3]] }
    },
    {
      id: 'm_f_gather', name: 'The Nine Walkers', giver: 'elrond', turnin: 'gandalf', level: 17, requires: 'm_f_council', story: true,
      text: 'Nine will go, and each has already said yes. Gandalf you know. There are three others you should meet before the road: Boromir of Gondor, who carries a horn and a doubt, Legolas of Mirkwood, who sees what others miss, and Gimli, son of Gloin, who will not be told what to do. Find them in the courtyards, and speak to each. Then tell Gandalf you are ready.',
      progress: 'Boromir, Legolas and Gimli are somewhere in the courtyards of Rivendell.',
      done: 'Good. Then the Company is complete, or as complete as it will ever be. We leave at dusk.',
      objectives: [
        { type: 'talk', npc: 'boromir', label: 'Speak to Boromir' },
        { type: 'talk', npc: 'legolas', label: 'Speak to Legolas' },
        { type: 'talk', npc: 'gimli', label: 'Speak to Gimli' }
      ],
      reward: { xp: 4500, gold: 1500, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_f_depart', name: 'The Road to Hollin', giver: 'gandalf', turnin: 'gandalf', level: 17, requires: 'm_f_gather', story: true,
      text: 'The road south and east leads to Hollin, the old land of the elves of Eregion. We go quietly, by night, and we do not stop until the mountains are in front of us. Take the east road out of Rivendell, and find us in the camp beyond the ruins.',
      progress: 'Take the east road out of Rivendell to Hollin.',
      done: 'Hollin. A good place to camp, if the wolves allow it, and they will not. Keep your blade out.',
      objectives: [explore('hol_camp', 'Reach the Fellowship\'s Camp in Hollin')],
      reward: { xp: 4500, gold: 1500, items: [['potion_heal', 3], ['bread', 5]] }
    },
    {
      id: 'm_h_wolves', name: 'The Wolves of Hollin', giver: 'gandalf', turnin: 'gandalf', level: 18, requires: 'm_f_depart', story: true,
      text: 'The wolves came before we did. They are lean and clever, and they are watching the camp. I would sleep better if there were fewer of them. Drive them off, and mind the ruins: not everything that hunts here has fur.',
      progress: 'The Hollin Wolves roam the ruins and the foothills east of camp.',
      done: 'Better. Not safe, but better. Now, there is the other matter Legolas has been muttering about.',
      objectives: [kill(['hollin_wolf'], 7, 'Hollin Wolves slain')],
      reward: { xp: 6000, gold: 1800, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_h_tokens', name: 'The White Hand', giver: 'legolas', turnin: 'legolas', level: 18, requires: 'm_f_depart', story: true,
      text: 'There are Orcs on the old road wearing a pale mark: a small white hand on a black field. These are not the Eye\'s soldiers. They belong to another power, and it has been watching us since Rivendell. Take a few of their tokens. Gandalf needs to see them, and I need to be wrong.',
      progress: 'The Isengard Scouts patrol the ruins and the road to the Door.',
      done: 'A white hand. Saruman has been watching us. Gandalf will not be happy, but he will not be surprised either.',
      objectives: [collect('q_isengard_token', 4, ['isengard_scout'], 0.55, 'White Hand Tokens')],
      reward: { xp: 6000, gold: 1800, items: [['potion_heal', 3], ['potion_res', 3]] }
    },
    {
      id: 'm_h_ruins', name: 'Ghosts of Eregion', giver: 'gimli', turnin: 'gimli', level: 19, requires: 'm_f_depart', story: true,
      text: 'There are shadows in the ruins, tall and cold, that were not here an age ago. I have no patience for ghosts. I have patience for axes, though. Clear them out, and I will tell Balin you helped his kin, and then Balin will tell everybody.',
      progress: 'The Eregion Wights haunt the Ruins of Eregion.',
      done: 'Hah! The dead stay dead, then, when properly reminded. Good work. I shall sing about it later, quietly, so as not to disturb Gandalf.',
      objectives: [kill(['hollin_wight'], 5, 'Eregion Wights slain')],
      reward: { xp: 6500, gold: 2000, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_h_watcher', name: 'The Pool by the Door', giver: 'gandalf', turnin: 'gandalf', level: 20, requires: ['m_h_wolves', 'm_h_tokens', 'm_h_ruins'], story: true,
      text: 'The road to the Doors of Durin runs beside a black pool, and the pool is not empty. Something lives in it that has never seen daylight and does not care for visitors. It will take a hand from any who go near, and take the rest of them after. It must be dealt with before the Fellowship can pass. Be fast, and do not stand in the water.',
      progress: 'The Watcher in the Water waits in the Moria Pool, south-east of the ruins.',
      done: 'The water is still. Not forever, I think, but long enough for us to reach the Door. You have my thanks, and Moria\'s soon enough.',
      objectives: [{ type: 'kill', mobs: ['watcher'], n: 1, label: 'The Watcher in the Water slain' }],
      reward: { xp: 12000, gold: 5000, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },
    {
      id: 'm_h_door', name: 'Speak, Friend, and Enter', giver: 'gandalf', turnin: 'gandalf', level: 20, requires: 'm_h_watcher', story: true,
      text: 'The Doors of Durin are at the foot of the cliff, on the far side of the pool. Invisible in starlight, they are written in silver and wait for a word. I read it once, and I have forgotten it, as one forgets the obvious. Come and stand beside me. We shall see what the Door has to say.',
      progress: 'Stand before the Doors of Durin, at the east end of the road.',
      done: 'Mellon. The word was friend. All this time, the word was friend. Come, Book III is done, and the mountain waits. Moria is before us, and what we find there, none of us can say.',
      objectives: [explore('hol_door', 'Reach the Doors of Durin')],
      reward: { xp: 15000, gold: 6000, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },

    // =================== BOOK IV: THE MINES OF MORIA ===============================
    {
      id: 'm_m_enter', name: 'Into the Dark', giver: 'gandalf', turnin: 'gandalf', level: 21, requires: 'm_h_door', story: true,
      text: 'The Doors are open, and there is no other way. The Redhorn has beaten us, and the wolves are behind. Under the mountain, and out the other side. Stay close, light no more than you need, and call out if you see anything that glows.',
      progress: 'Pass through the Doors of Durin and into Moria.',
      done: 'The Doors have closed behind us. Well. That decides it. We go forward.',
      objectives: [explore('mo_gate', 'Enter the West Gate of Moria')],
      reward: { xp: 8000, gold: 2000, items: [['potion_heal', 3], ['bread', 5]] }
    },
    {
      id: 'm_m_goblins', name: 'The Drums in the Deep', giver: 'gimli', turnin: 'gimli', level: 22, requires: 'm_m_enter', story: true,
      text: 'Goblins. A great many, and they are coming from the south hall. There is a place I want to see, and a tomb I want to find, and I will not do either with goblin arrows in my back. Clear the hall. Let them hear what a dwarf sounds like when he is angry.',
      progress: 'Goblins infest the Twenty-first Hall, east of the gate.',
      done: 'Better. They will come back, they always do, but for now the hall is quiet. Here, take a drink. It is dwarf-brewed. Do not ask what is in it.',
      objectives: [kill(['moria_goblin'], 9, 'Moria Goblins slain')],
      reward: { xp: 9000, gold: 2500, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_m_pages', name: 'The Book of Mazarbul', giver: 'gandalf', turnin: 'gandalf', level: 22, requires: 'm_m_enter', story: true,
      text: 'Balin led a colony here, and wrote of it in a book. The pages are scattered, and I think the Orcs have taken them. If we are to know what became of him, and what the Orcs are afraid of, I need those pages. Search the fallen, and bring me whatever you can.',
      progress: 'The Orc Captains in the Twenty-first Hall carry the pages.',
      done: '...we found the Dwarves dead... drums, drums in the deep... they are coming. They are coming. It is as I feared. Whatever sleeps beneath this mountain has woken, and it is not the Orcs they fear.',
      objectives: [collect('q_mazarbul_page', 4, ['moria_orc'], 0.6, 'Pages of the Book of Mazarbul')],
      reward: { xp: 9000, gold: 2500, items: [['potion_heal', 3], ['potion_res', 3]] }
    },
    {
      id: 'm_m_tomb', name: 'Balin\'s Tomb', giver: 'gimli', turnin: 'gimli', level: 23, requires: ['m_m_goblins', 'm_m_pages'], story: true,
      text: 'Balin, son of Fundin, Lord of Moria. That is what the stone will say, when we find it. I need to see it. I need to see my cousin\'s grave with my own eyes, even if the Orcs have been at it. The tomb lies east of the great hall. Take the left passage, and keep your eyes open.',
      progress: 'Balin\'s Tomb lies east of the Twenty-first Hall.',
      done: '...Here lies Balin, son of Fundin, Lord of Moria. He is dead, then. I knew it, I think. I knew it before we came. Thank you, friend. I do not have words, but I will remember this.',
      objectives: [explore('mo_tomb', 'Find Balin\'s Tomb')],
      reward: { xp: 10000, gold: 3000, itemByClass: CLASS_ITEM_2 }
    },
    {
      id: 'm_m_troll', name: 'The Troll of the Tomb', giver: 'gandalf', turnin: 'gandalf', level: 24, requires: 'm_m_tomb', story: true,
      text: 'We have made too much noise. The drums are louder now, and there is a Troll in the tomb chamber, a great one, and he is not alone. Break him. The way to the bridge is through the chamber, and the Fellowship cannot pass with a Troll at its back.',
      progress: 'The Troll waits in Balin\'s Tomb.',
      done: 'He is down. Good. Now we run. The Bridge of Khazad-dum is east of here, and what comes will not wait for us to catch our breath.',
      objectives: [{ type: 'kill', mobs: ['troll_chief'], n: 1, label: 'The Troll of Balin\'s Tomb slain' }],
      reward: { xp: 16000, gold: 5000, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    },
    {
      id: 'm_m_bridge', name: 'You Shall Not Pass', giver: 'gandalf', turnin: 'gandalf', level: 26, requires: 'm_m_troll', story: true,
      text: 'Run for the Bridge! There is something coming, an old, fire-born thing, older than the Orcs, older than the Dwarves\' delving. You cannot beat it. I do not think anyone can. But the bridge is narrow, and a narrow bridge is a place where a staff and a will can hold a long time. Cross, and do not look back. Or fight, if you must. I will stand beside you.',
      progress: 'The Bridge of Khazad-dum lies at the far east of Moria. Durin\'s Bane is coming.',
      done: 'The bridge breaks, and the shadow falls into the deep. Grey, and tired, and old, I lean on my staff and live. Book IV is complete: you have crossed Moria, and slain a thing out of the First Age. Lothlorien lies ahead, and rest.',
      objectives: [{ type: 'kill', mobs: ['durins_bane'], n: 1, label: 'Durin\'s Bane vanquished' }],
      reward: { xp: 30000, gold: 10000, itemByClass: { warrior: 'gorthak_blade', healer: 'gorthak_staff', mage: 'gorthak_staff', ranger: 'gorthak_bow' } }
    }
  ];

  // Existing Westmark quests become part of the shared main story
  const patch = function (id, o) { const q = MEO.QUEST_BY_ID[id]; if (q) Object.assign(q, o); };

  Q.forEach(function (q) {
    MEO.QUESTS.push(q);
    MEO.QUEST_BY_ID[q.id] = q;
  });
  patch('q_training', { requires: 'm_gandalf' });
  ['q_camp', 'q_scout_tower', 'q_orcs', 'q_warchief'].forEach(function (id) { patch(id, { story: true }); });
  patch('q_warchief', { level: 12 });
  // Book II-IV: the player follows the Fellowship as a member of the Following Watch
  var BOOK_PATCH = {
 "m_road": {
  "text": "The Ring-bearer and his friends are already on the road east, and Elrond will soon send them on to a far darker place. I cannot take you with them: that road is theirs, and few are meant to walk it. But the Enemy hunts their trail, and someone must watch their backs: clear what follows, cover what they leave, and carry what they cannot. Halbarad and his Rangers will shadow the road a day behind them. Join the Following Watch. First, say farewell to Marshal Halvard.",
  "done": "Then it begins. You will not be in the songs, friend, and neither will I. The songs will be about the nine who walk ahead, and the stones they leave behind will be yours to keep clean. Book I is finished. The Old Road to Weathertop waits."
 },
 "q_warchief": {
  "done": "The Tower is silent. You and your company did what a hundred soldiers could not. Greenbrook will remember it, though the name they tell is unlikely to be yours. Take this, it is the least we can give."
 },
 "m_wt_road": {
  "turnin": "halbarad",
  "text": "The Ring-bearer passed Weathertop three days ago, with the Ranger they call Strider. The Nine have been hunting along that same road ever since. Halbarad and the Following Watch hold the Rangers' Halt at the foot of the hill: join them, and follow the old road east. You are the rearguard: do not try to be the story.",
  "progress": "Take the east road out of Greenbrook, past the Fallen Tower, to the Rangers' Halt at Weathertop.",
  "done": "You are in time. We are not the Nine Walkers, nor are we heroes of songs, and that is how it should be. Songs need people who quietly do the work behind them. Welcome to the Watch."
 },
 "m_wt_wargs": {
  "text": "The hobbits' trail still smells of fear, and the Black Wargs have been following it like bloodhounds. If they are still running the road when the Fellowship's friends come through, someone will die. Thin them out before they find our fires.",
  "done": "Fewer teeth in the dark now. Still, wargs hunt for a master. Whoever rides them is close."
 },
 "m_wt_hunters": {
  "text": "Hill orcs came out of the east with something under their cloaks, a scrap of black cloth, passed from hand to hand like a holy thing. Take a few from them. Halbarad will want to see it. And be careful. The cloth is cold, and it does not burn.",
  "done": "It is cold! The scrap feels cold, even through the glove. I will not touch it again. Take it to Halbarad."
 },
 "m_wt_summit": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "The scraps are Nazgul cloth, woven in Mordor. The Nine have been here, and they will be here again. Hobbits and Strider spent a night in the ruins on the hill, and the dead remember. Climb Weathertop. The ring of stones on its summit is what is left of the Tower of Amon Sul. The shades of its old guard still walk there, bound by the dark. Clear them, so the Watch can pass.",
  "done": "The tower is quiet, for now. I saw, from the summit, the scorched stone where the Nine stood, and a smear of blood on the old floor. They struck here, at the Ring-bearer. Whatever else this war is, it is real."
 },
 "m_wt_rider": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "One of the Nine left a wraith behind to watch the hill, and as long as it holds the summit, no one can pass or camp. It is a lesser servant, but a Ring-wraith's servant is no small enemy. Take the whole Watch, and break it in the ruins of Amon Sul. Do not look into its hood. Do not stand in the cold that follows it.",
  "done": "It is driven off, not destroyed. They cannot be killed, not by us. But the way to the Bruinen is open now. Elrond asked for scouts willing to follow the Fellowship. Go to Rivendell, and tell him the road behind them is clear."
 },
 "m_rv_arrive": {
  "giver": "halbarad",
  "text": "Elrond has asked for scouts willing to walk a day behind the Fellowship. Take the road east along the Bruinen to Rivendell. Tell him the road behind is clear, and that the Watch stands ready.",
  "progress": "Follow the road east to Rivendell and find Elrond.",
  "done": "Halbarad sends you? Then the Watch has not failed. The Nine Walkers leave soon. Come in, and rest while you can: you will not have many more soft beds."
 },
 "m_rv_glorfindel": {
  "text": "Glorfindel rode out to meet the Nine at the ford, and he knows the Riders better than anyone here. Seek him out, tell him what you saw at Weathertop, and listen to what he says. He is a veteran of the First Age, and he does not repeat himself.",
  "done": "Weathertop, and the wraith on the hill. You faced it, you and the Watch? Brave. Not wise, but brave. The Nine Walkers will not know what you did, and that is as it should be."
 },
 "m_rv_bilbo": {
  "text": "There is a small, kind, old hobbit in the garden with a book, and he has nobody to talk to. He is Frodo's uncle. Sit with him a little before the Fellowship departs. Some tasks are harder than any battle.",
  "done": "Ah! A visitor. Did you bring a map? No? Never mind. I have been writing, you see. Will you give Frodo this little scrap? No, wait, he is gone already. Then you keep it, and look after the lad if you see him. The road is long, and dark, and he is not as strong as he looks."
 },
 "m_rv_council": {
  "turnin": "elrond",
  "giver": "bilbo",
  "text": "The Council has met, and the Nine Walkers leave soon. Elrond wants to speak to you, not as one of the Nine, but as one of those who follow. Go to him when you are ready.",
  "done": "You are not one of the Nine, and no song will name you. But the road behind them must be kept open, and their friends must reach them if they call. That is a task worth doing. Book II is complete: you have broken the wraith on Weathertop and brought word to Rivendell. The road goes ever on."
 },
 "m_f_council": {
  "text": "The Council of Elrond met yesterday, in the Hall of Fire. I was there, and I will tell you what was said, but first see the Hall for yourself: the empty chairs and the fire still burning.",
  "done": "The Ring goes to Mordor, and it goes in the hands of one who did not ask for it. Frodo has spoken. Nine walkers will go with him, to match the Nine Riders. We are the ones who follow."
 },
 "m_f_gather": {
  "text": "Nine will go: Gandalf, Boromir, Legolas, Gimli, Aragorn, and four hobbits. You are not among them, nor should you be. But you will walk where they walk, and it is good to know their faces. Find Boromir, Legolas and Gimli in the courtyards and speak to them. Then tell Gandalf you will follow.",
  "done": "Good. Then you have seen them, and you will know them by their footprints. They leave at dusk. You will leave a day behind, and keep to their trail."
 },
 "m_f_depart": {
  "turnin": "halbarad",
  "text": "The Fellowship has gone south and east, toward the old land of Hollin. Take the road after them. The Watch makes camp in the ruins, where they camped. Their fires are cold now, but I would like to know what the ashes say.",
  "progress": "Take the east road out of Rivendell to Hollin.",
  "done": "Hollin. They slept here, you see? Legolas' watch-post, the ring of stones where Gimli's pipe was knocked out. Keep your blade out. The wolves that followed them are still around."
 },
 "m_h_wolves": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "The wolves came after the Fellowship, as the wargs did at Weathertop. They are lean and clever, and they are watching our camp now. Drive them off, and mind the ruins: not everything that hunts here has fur.",
  "done": "Better. Not safe, but better. There is also the matter Mirieth has been muttering about."
 },
 "m_h_tokens": {
  "giver": "wt_scout",
  "turnin": "wt_scout",
  "text": "There are Orcs on the old road wearing a pale mark: a small white hand on a black field. These are not the Eye's soldiers. They belong to another power, and they have been following the Fellowship since Rivendell. Take a few of their tokens. Halbarad needs to see them, and I need to be wrong.",
  "done": "A white hand. Saruman has been watching them. The Fellowship does not know. We must be their eyes."
 },
 "m_h_ruins": {
  "giver": "nar",
  "turnin": "nar",
  "text": "There are shadows in the ruins, tall and cold, that were not here an age ago. A dwarf has little patience for ghosts, but a great deal for axes. Clear them out, so the Watch may sleep, and I will tell my kin at Moria that you helped.",
  "done": "Hah! The dead stay dead, then, when properly reminded. Good work. I shall sing about it later, quietly, so as not to disturb the Rangers."
 },
 "m_h_watcher": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "The road to the Doors of Durin runs beside a black pool, and the pool is not empty. The Fellowship passed it, and it took a toll on them; now it is awake and hungry, and it will take a hand from anyone who follows. It must be dealt with before the Watch can pass. Be fast, and do not stand in the water.",
  "done": "The water is still. Not forever, I think, but long enough for us to reach the Door. You have my thanks, and Moria's soon enough."
 },
 "m_h_door": {
  "giver": "halbarad",
  "turnin": "nar",
  "text": "The Doors of Durin are at the foot of the cliff, on the far side of the pool. Gandalf found the word a few days ago. Nár is waiting by the Door: he knows the old greeting of his people, and he will see us in.",
  "done": "Mellon, the old word, friend. The Doors will let us in, though they closed behind the Fellowship, and I do not like the smell of what waits inside. Book III is done, and the mountain waits. Moria is before us, and what we find there, none of us can say."
 },
 "m_m_enter": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "The Doors are open, and there is no other way. The Redhorn has beaten the Fellowship, and the wolves are behind us. Under the mountain, and out the other side. Stay close, light no more than you need, and call out if you see anything that glows.",
  "done": "The Doors have closed behind us. Well. That decides it. We go forward, following the same road the Fellowship walked, and not all of them walked it out."
 },
 "m_m_goblins": {
  "giver": "nar",
  "turnin": "nar",
  "text": "Goblins. A great many, and they are coming from the south hall. There is a place I want to see, and a tomb I want to find, and I will not do either with goblin arrows in my back. Clear the hall. Let them hear what a dwarf sounds like when he is angry.",
  "done": "Better. They will come back, they always do, but for now the hall is quiet. Here, take a drink. It is dwarf-brewed. Do not ask what is in it."
 },
 "m_m_pages": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "Balin led a colony here, and wrote of it in a book. The pages are scattered, and the Orcs have taken them. If we are to know what became of him, and what the Fellowship faced here, we need those pages. Search the fallen, and bring me whatever you can.",
  "done": "...we found the Dwarves dead... drums, drums in the deep... they are coming. They are coming. It is as I feared. The Fellowship walked into this, and I do not yet know how many walked out."
 },
 "m_m_tomb": {
  "giver": "nar",
  "turnin": "nar",
  "text": "Balin, son of Fundin, Lord of Moria. That is what the stone will say, when we find it. Gimli will have stood there days ago. I need to see it too, even if the Orcs have been at it. The tomb lies east of the great hall. Take the left passage, and keep your eyes open.",
  "done": "...Here lies Balin, son of Fundin, Lord of Moria. He is dead, then. I knew it, I think. I knew it before we came. And there, in the dust, a dwarf's footprints, fresh when they were made. Gimli was here. Thank you, friend. I do not have words, but I will remember this."
 },
 "m_m_troll": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "We have made too much noise. The drums are louder now, and there is a Troll in the tomb chamber, a great one, and he is not alone. It is the same one that nearly broke the Fellowship. Break him. The way to the bridge is through the chamber.",
  "done": "He is down. Good. Now we move. The Bridge of Khazad-dum is east of here, and what remains of the fire still clings to it."
 },
 "m_m_bridge": {
  "giver": "halbarad",
  "turnin": "halbarad",
  "text": "This is where the Fellowship crossed, and where Gandalf the Grey went down into the dark with the Balrog. The creature itself fell, but cinders of its fire still cling to the broken bridge, and they will burn anyone who tries to cross. It must be put out. Do it for the Fellowship, and for him.",
  "progress": "The Bridge of Khazad-dum lies at the far east of Moria. The embers of Durin's Bane still burn there.",
  "done": "The last ember is out. The Bridge is dark. Gandalf the Grey fell here, and we will not forget him. Book IV is complete: you followed the Fellowship through Moria and cleared the road behind them. Lothlorien lies ahead, and rest, and what comes next is for the Nine to tell."
 }
};
  Object.keys(BOOK_PATCH).forEach(function (id) { patch(id, BOOK_PATCH[id]); });

  /** Name with a star for main-story quests. */
  MEO.questTitle = function (q) {
    return (q.story ? '★ ' : '') + q.name;
  };

  /** NPC definition by id (searches all zones; the first match wins). */
  MEO.npcDef = function (id) {
    let def = null;
    Object.keys(MEO.ZONES || {}).forEach(function (zid) {
      (MEO.ZONES[zid].npcs || []).forEach(function (n) { if (!def && n.npcId === id) def = n; });
    });
    return def;
  };

  /** Display name for an NPC id (from any zone). */
  MEO.npcName = function (id) {
    let name = id;
    Object.keys(MEO.ZONES || {}).forEach(function (zid) {
      (MEO.ZONES[zid].npcs || []).forEach(function (n) { if (n.npcId === id) name = n.name; });
    });
    return name;
  };
})();
