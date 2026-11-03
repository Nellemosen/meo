/* ==========================================================================
   systems/races.js – Applies the player's race: model look, stat traits (via
   Inventory.recalc), and special traits (xp, gold, dodge, ...). Race data in
   data/races.js. The race is chosen on the start screen and saved.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  const Races = (MEO.Races = {
    current: 'human',

    /** Special trait value of an entity's race (0 for companions and mobs). */
    special(e, key) {
      return e && e.raceId ? MEO.raceSpecial(e.raceId, key) : 0;
    },

    set(p, raceId) {
      if (!MEO.RACES[raceId]) raceId = 'human';
      Races.current = raceId;
      p.raceId = raceId;
      const r = MEO.RACES[raceId];
      p.skin = r.skin;
      p.scale = r.scale;
      p.speed = 105 * (1 + MEO.raceSpecial(raceId, 'speed'));
      if (MEO.Inventory && MEO.Inventory.player === p) MEO.Inventory.recalc(true);
      MEO.Events.emit('race:change', { entity: p, raceId: raceId });
    },

    xp(amount) {
      return amount * (1 + Races.special(MEO.Game.player, 'xp'));
    },

    gold(amount) {
      return Math.round(amount * (1 + Races.special(MEO.Game.player, 'gold')));
    }
  });

  // A new class resets the character: keep the race on the player
  MEO.Events.on('class:change', function (e) {
    if (e && e.type === 'player') Races.set(e, Races.current);
  });
})();
