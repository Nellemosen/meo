/* ==========================================================================
   data/fellowship.js – Fellowship manoeuvres (Lotro-style group events).
   A manoeuvre is triggered at random in tough fights or by certain abilities
   (def.fm below). The player has a short time to choose one of three answers;
   companions answer by themselves. Reading the situation (the hint) right
   gives a full-strength effect.
     strike – damage burst + damage buff    guard – group heal + damage reduction
     rally  – resource restored + haste
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;

  MEO.FM_CHOICES = {
    strike: { name: 'Strike', icon: '⚔', color: '#e0503a', desc: 'Press the advantage: a burst of damage and +25% power for the group.' },
    guard: { name: 'Guard', icon: '⛨', color: '#6aa3ff', desc: 'Close ranks: heals the group and cuts damage taken by 20%.' },
    rally: { name: 'Rally', icon: '✪', color: '#e8b04a', desc: 'Lift spirits: restores resource and makes the group 15% faster.' }
  };

  // best = the choice the hint points to; names are flavour for the three buttons
  MEO.FELLOWSHIP = {
    looming_blow: { name: 'Looming Blow', hint: 'The enemy raises its weapon for a crushing blow!', best: 'guard',
      names: { strike: 'Strike first', guard: 'Brace together', rally: 'Shout a warning' } },
    open_flank: { name: 'Open Flank', hint: 'The enemy has left its flank wide open!', best: 'strike',
      names: { strike: 'Hit the flank', guard: 'Hold position', rally: 'Call to the others' } },
    wavering_hearts: { name: 'Wavering Hearts', hint: 'The company\'s courage wavers. Someone must lift their spirits!', best: 'rally',
      names: { strike: 'Charge ahead', guard: 'Stand firm', rally: 'Sing a rousing song' } },
    staggering_foe: { name: 'Staggering Foe', hint: 'The enemy staggers, weakened. Finish it!', best: 'strike',
      names: { strike: 'Press on', guard: 'Wait and see', rally: 'Shout encouragement' } },
    dark_chill: { name: 'Darkening Chill', hint: 'A dark chill falls over the company, and hands begin to shake...', best: 'rally',
      names: { strike: 'Fight it off', guard: 'Huddle together', rally: 'Light a hopeful tune' } },
    raining_arrows: { name: 'Hail of Arrows', hint: 'Arrows fall from all sides! Take cover!', best: 'guard',
      names: { strike: 'Return fire', guard: 'Raise the shields', rally: 'Rush for the trees' } }
  };

  // Abilities that start a manoeuvre when used (burglar's tricks, the captain's call ...)
  const FM = { dirty_trick: 'open_flank', fools_luck: 'looming_blow', heralds_cry: 'wavering_hearts', pointed_command: 'staggering_foe' };
  Object.keys(FM).forEach(function (id) {
    if (MEO.ABILITIES[id]) MEO.ABILITIES[id].fm = FM[id];
  });

  const B = MEO.BUFFS;
  Object.assign(B, {
    fm_strike: { name: 'Fellowship: Strike', icon: '⚔', color: '#e0503a', duration: 12, mods: { power: { pct: 0.25 } } },
    fm_strike_big: { name: 'Fellowship: Perfect Strike', icon: '⚔', color: '#ff7a5a', duration: 14, mods: { power: { pct: 0.4 } } },
    fm_guard: { name: 'Fellowship: Guard', icon: '⛨', color: '#6aa3ff', duration: 10, mods: { damageTaken: { pct: -0.2 } } },
    fm_guard_big: { name: 'Fellowship: Perfect Guard', icon: '⛨', color: '#9ec8ff', duration: 12, mods: { damageTaken: { pct: -0.35 } } },
    fm_rally: { name: 'Fellowship: Rally', icon: '✪', color: '#e8b04a', duration: 10, mods: { speed: { pct: 0.15 } } },
    fm_rally_big: { name: 'Fellowship: Perfect Rally', icon: '✪', color: '#ffd978', duration: 12, mods: { speed: { pct: 0.25 }, crit: { flat: 0.05 } } }
  });
})();
