/* ==========================================================================
   systems/progression.js – Experience, level-ups and unlocked abilities
   Kill XP follows the enemy's level compared to the player's (green and grey
   enemies give less, tougher ones a bit more). Quests give XP through
   Progress.addXp. Level-ups raise stats, unlock abilities and level the
   companions together with the player.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const C = MEO.CONFIG;
  const U = MEO.util;

  const Progress = (MEO.Progress = {
    /** XP for defeating a creature. */
    killXp(mob, playerLevel) {
      const def = mob.def || {};
      if (def.xp === 0 || def.shape === 'dummy') return 0;
      const L = mob.level;
      let xp = def.xp > 0 ? def.xp : 8 + 5 * L;
      const diff = L - playerLevel;
      if (diff < 0) xp *= Math.max(0, 1 + diff * 0.18);
      else xp *= 1 + Math.min(diff, 4) * 0.05;
      if (mob.rank === 'rare') xp *= 4;
      return Math.round(xp);
    },

    /** Give XP to the player. Handles several level-ups at once. */
    addXp(amount, opts) {
      const p = MEO.Game.player;
      amount = Math.round(MEO.Races ? MEO.Races.xp(amount) : amount);
      if (!p || amount <= 0 || p.level >= C.MAX_LEVEL) return;
      const s = p.stats;
      s.xp = (s.xp || 0) + amount;
      if (!opts || !opts.silent) {
        MEO.log('You gain ' + amount + ' experience.', 'xp');
        if (MEO.CombatText) MEO.CombatText.text(p, '+' + amount + ' XP', '#c8a2ff', { size: 14, up: 0.9, life: 1.5 });
      }
      let gained = 0;
      while (p.level < C.MAX_LEVEL && s.xp >= U.xpToNext(p.level)) {
        s.xp -= U.xpToNext(p.level);
        Progress._levelUp(p, p.level + 1);
        gained++;
      }
      if (p.level >= C.MAX_LEVEL) s.xp = 0;
      Events.emit('xp:change', p);
    },

    /** Set the level directly (loading a save, console). No banner. */
    setLevel(level, silent) {
      const p = MEO.Game.player;
      Progress._apply(p, U.clamp(level, 1, C.MAX_LEVEL), silent);
    },

    _levelUp(p, level) {
      const unlocked = Progress._apply(p, level, false);
      const names = unlocked.map(function (id) {
        return MEO.ABILITIES[id].name;
      });
      MEO.log('You have reached level ' + level + '!', 'levelup');
      if (names.length) MEO.log('New abilities: ' + names.join(', ') + '.', 'levelup');
      if (MEO.HUD) MEO.HUD.showBanner('Level ' + level, names.length ? 'New: ' + names.join(', ') : 'You grow stronger');
      if (MEO.CombatText) MEO.CombatText.text(p, 'Level Up!', '#ffe27a', { size: 24, up: 1.2, life: 2 });
      const F = MEO.FX3D;
      if (F && F.burst && p._rx !== undefined) {
        F.burst(p._rx, p._ry + 0.2, p._rz, '#ffe27a', 36, { speed: 2.4, up: 3.2, grav: 1.2, size: 0.28, life: 1.3, alpha: true });
      }
      Events.emit('player:levelup', { level: level, unlocked: unlocked });
    },

    /** Recalculate stats for a new level (keeps buffs, cooldowns and gear). */
    _apply(p, level, silent) {
      const unlocked = MEO.Abilities.setLevel(p, level);
      MEO.Inventory.captureBase(p);
      MEO.Inventory.recalc(!silent);
      if (!silent) {
        p.stats.res = p.stats.resType === 'fury' ? p.stats.res : p.stats.maxRes;
        MEO.Buffs.removeById && MEO.Buffs.removeById(p, 'bleeding');
      }
      if (MEO.Party) MEO.Party.setLevel(level);
      Events.emit('class:levelset', p);
      return unlocked;
    }
  });

  // Kill credit: the player or a companion landed the killing blow
  Events.on('death', function (d) {
    const m = d.entity;
    if (m.type !== 'mob' || !d.killer || !MEO.Combat._isSide(d.killer)) return;
    const p = MEO.Game.player;
    const xp = Progress.killXp(m, p.level);
    if (xp > 0) Progress.addXp(xp);
  });
})();
