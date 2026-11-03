/* data/asset-map.js – which glTF model stands in for which creature, and how tall it is (metres).
   Ids are the file names in assets/models/ without .glb. Add a model, run
   `node tools/pack-assets.js`, then map it here. Anything not listed keeps the procedural model. */
MEO.ASSET_MAP = {
  // People: player, companions and NPCs. One model is chosen per character from their name, so a
  // village is not all the same person. EMPTY ON PURPOSE: the Universal Base Characters are bare
  // base bodies with no clothes. Add Quaternius' "Modular Character Outfits - Fantasy" (CC0),
  // build dressed characters, then put their ids back here:
  //   humanoid: ['char_male', 'char_female'],
  humanoid: [],
  mob: {
    orc_scout: 'orc', orc_brute: 'orc', warchief: 'orc', hill_orc: 'orc',
    isengard_scout: 'orc', moria_orc: 'orc', moria_goblin: 'orc', goblin_sneak: 'orc'
    // human raiders (footpad, bandit, ruffian) wait for dressed character models too
  }
};
MEO.ASSET_HEIGHT = { char_male: 1.85, char_female: 1.76, orc: 2.0 };
MEO.ASSET_RACE_H = { human: 1.85, elf: 1.95, dwarf: 1.40, hobbit: 1.15 };
MEO.ASSET_MOB_H = {
  orc_scout: 1.85, orc_brute: 2.25, warchief: 2.5, hill_orc: 1.95,
  isengard_scout: 1.9, moria_orc: 2.0, moria_goblin: 1.5, goblin_sneak: 1.5
};
