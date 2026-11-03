/* data/asset-map.js – which glTF model stands in for which creature, and how tall it is (metres).
   Ids are the file names in assets/models/ without .glb. Add a model, run
   `node tools/pack-assets.js`, then map it here. Anything not listed keeps the procedural model.
   Models: Quaternius "Modular Character Outfits - Fantasy" (peasant + ranger, CC0) on the
   Universal Base Characters rig, so the Universal Animation Library drives them. */
MEO.ASSET_MAP = {
  // People. One model is picked per character from their name, so a village is not all the
  // same person. Villagers wear peasant clothes; the player, companions and brigands are rangers.
  people: {
    npc: ['m_peasant', 'f_peasant'],
    player: ['m_ranger'],
    party: ['m_ranger', 'f_ranger'],
    mob: ['m_ranger', 'f_ranger']
  },
  // the training dummies in the square are props, not creatures
  prop: { dummy: 'Dummy', dummy_armored: 'Dummy', dummy_puncher: 'Dummy' },
  mob: {
    orc_scout: 'orc', orc_brute: 'orc', warchief: 'orc', hill_orc: 'orc',
    isengard_scout: 'orc', moria_orc: 'orc', moria_goblin: 'orc', goblin_sneak: 'orc',
    barrow_shade: 'skel_minion', hollin_wight: 'skel_warrior', wraith_rider: 'skel_mage',
    footpad: 'people', bandit: 'people', bandit_archer: 'people', ruffian: 'people'
  }
};
// A few named people who should not be left to chance. NPC ids repeat across zones, so an id
// can be a different person in another zone; only clear cases belong here.
MEO.ASSET_NPC = { gandalf: 'f_ranger', rosie: 'f_peasant', bilbo: 'f_peasant' };
MEO.ASSET_HEIGHT = {
  m_ranger: 1.85, f_ranger: 1.76, m_peasant: 1.82, f_peasant: 1.74, orc: 2.0,
  skel_minion: 1.7, skel_warrior: 1.85, skel_mage: 1.8
};
// Animation clips live in separate files and are matched to a model by its rig: a clip only
// plays on a model whose bone names it targets. 'ual' = Quaternius Universal Animation Library,
// 'kay' = KayKit Character Animations.
MEO.ASSET_RIG = {
  m_ranger: 'ual', f_ranger: 'ual', m_peasant: 'ual', f_peasant: 'ual',
  skel_minion: 'kay', skel_warrior: 'kay', skel_mage: 'kay'
};
MEO.ASSET_LIBS = { ual: ['anims'], kay: ['kay_general', 'kay_move', 'kay_melee'] };
MEO.ASSET_RACE_H = { human: 1.85, elf: 1.95, dwarf: 1.40, hobbit: 1.15 };
MEO.ASSET_MOB_H = {
  orc_scout: 1.85, orc_brute: 2.25, warchief: 2.5, hill_orc: 1.95,
  isengard_scout: 1.9, moria_orc: 2.0, moria_goblin: 1.5, goblin_sneak: 1.5,
  footpad: 1.8, bandit: 1.85, bandit_archer: 1.75, ruffian: 1.88
};
