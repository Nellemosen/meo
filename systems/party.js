/* ==========================================================================
   systems/party.js – Party roster, stance, commands and revival of companions.
   The party is the player plus three AI companions, one for each class the
   player did not pick, so the group always has a tank, a healer and damage.
   Companion behaviour: ai/party-ai.js. Frames and buttons: ui/party-frames.js.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const U = MEO.util;

  const NAMES = {
    guardian: 'Thandor', warden: 'Hirgon', minstrel: 'Elowen', runekeeper: 'Maegwyn', hunter: 'Faelar',
    champion: 'Borin', burglar: 'Nori', captain: 'Belegon', loremaster: 'Sirion'
  };
  const SKIN = {
    guardian: '#d9a77c', warden: '#c99468', minstrel: '#f0c9a4', runekeeper: '#e8bf9a', hunter: '#c99468',
    champion: '#d9a77c', burglar: '#f0c9a4', captain: '#d9a77c', loremaster: '#e8bf9a'
  };
  const ROLE_NAMES = {
    guardian: 'Tank', warden: 'Tank', minstrel: 'Healer', runekeeper: 'Healer', hunter: 'Damage',
    champion: 'Damage', burglar: 'Damage', captain: 'Support', loremaster: 'Support'
  };
  // Companion line-up: one tank, one healer, one damage dealer. If the player already
  // fills the archetype, a Support companion takes its place. Alternatives avoid duplicates.
  const FILL = {
    tank: ['guardian', 'warden'], heal: ['minstrel', 'runekeeper'],
    dps: ['hunter', 'champion', 'burglar'], support: ['captain', 'loremaster']
  };
  const STANCES = ['defensive', 'aggressive', 'passive'];
  const STANCE_NAMES = { defensive: 'Defensive', aggressive: 'Aggressive', passive: 'Passive' };
  const STANCE_HELP = {
    defensive: 'Companions fight when you or they are attacked.',
    aggressive: 'Companions also attack hostile creatures near you.',
    passive: 'Companions only follow and heal; they never attack.'
  };

  const Party = (MEO.Party = {
    NAMES: NAMES,
    ROLE_NAMES: ROLE_NAMES,
    STANCE_NAMES: STANCE_NAMES,
    STANCE_HELP: STANCE_HELP,
    REVIVE_DELAY: 12,       // seconds after death before a companion may return
    MAX: 4,                 // most companions at once
    COOLDOWN: 20,           // seconds between changes outside towns and camps
    nextChange: 0,
    roster: null,           // chosen class ids (null = recommended line-up)
    REVIVE_MAX: 45,         // ... or this long even if the fight is still going
    leader: null,
    members: [],
    tank: null,
    stance: 'defensive',
    focus: null,            // enemy all companions should attack ("Attack my target")
    heading: -Math.PI / 2,  // direction the leader last moved in (for formation)
    active: false,

    // ---- Roster ----------------------------------------------------------
    /** Recommended line-up for a class: one tank, one healer, one damage dealer. */
    recommended(classId) {
      const arch = MEO.Classes[classId].arch;
      const slots = ['tank', 'heal', 'dps'].map(function (a) { return a === arch ? 'support' : a; });
      return slots.map(function (a) {
        return FILL[a].filter(function (id) { return id !== classId; })[0];
      });
    },

    /** Create one companion of the given class next to the player. */
    _spawn(id, slot) {
      const player = Party.leader;
      const m = new MEO.PartyMember({ name: NAMES[id], x: player.x, y: player.y, slot: slot, skin: SKIN[id] });
      MEO.Abilities.setupClass(m, id, player.level);
      Party.applyGear(m);
      m.stats.hp = m.stats.maxHp;
      m.stats.res = m.stats.resType === 'fury' ? 0 : m.stats.maxRes;
      MEO.Entities.add(m);
      Party.placeNear(m, player, 80 + slot * 20);
      return m;
    },

    _refresh() {
      Party.members.forEach(function (m, i) { m.slot = i; });
      Party.tank = Party.members.filter(function (m) {
        return MEO.Classes[m.classId].arch === 'tank';
      })[0] || null;
      Party.roster = Party.members.map(function (m) { return m.classId; });
      Events.emit('party:change', Party);
      if (MEO.Save) MEO.Save.markDirty();
    },

    /** (Re)create the companions for the player's current class (saved roster, or the recommended line-up). */
    build(player) {
      Party.clear();
      Party.leader = player;
      let ids = Party.roster;
      if (!ids) ids = Party.recommended(player.classId);
      ids = ids.filter(function (id, i) { return MEO.Classes[id] && id !== player.classId && ids.indexOf(id) === i; }).slice(0, Party.MAX);
      ids.forEach(function (id, i) { Party.members.push(Party._spawn(id, i)); });
      Party.active = true;
      Party._refresh();
    },

    // ---- Changing the party on the go ------------------------------------------
    /** null if the party may be changed now, otherwise the reason. */
    changeBlock() {
      if (!Party.leader || !Party.active) return 'The party is not ready yet.';
      if (Party.anyInCombat()) return 'You cannot change the party in combat.';
      if (!MEO.EnemyAI.inSafe(Party.leader) && MEO.Engine.time < Party.nextChange) {
        return 'Wait ' + Math.ceil(Party.nextChange - MEO.Engine.time) + ' s (free in towns and camps).';
      }
      return null;
    },

    _stamp() {
      Party.nextChange = MEO.Engine.time + (MEO.EnemyAI.inSafe(Party.leader) ? 0 : Party.COOLDOWN);
    },

    add(id) {
      const why = Party.changeBlock();
      if (why) { MEO.log(why, 'hint'); return false; }
      if (!MEO.Classes[id] || id === Party.leader.classId || Party.has(id)) return false;
      if (Party.members.length >= Party.MAX) { MEO.log('The party is full (' + Party.MAX + ' companions).', 'hint'); return false; }
      Party.members.push(Party._spawn(id, Party.members.length));
      Party._stamp();
      MEO.log(NAMES[id] + ' joins you.', 'system');
      Party._refresh();
      return true;
    },

    remove(id) {
      const why = Party.changeBlock();
      if (why) { MEO.log(why, 'hint'); return false; }
      const m = Party.members.filter(function (x) { return x.classId === id; })[0];
      if (!m) return false;
      if (MEO.Entities.byId.has(m.id)) MEO.Entities.remove(m);
      Party.members.splice(Party.members.indexOf(m), 1);
      if (Party.focus && Party.focus.id === m.id) Party.focus = null;
      Party._stamp();
      MEO.log(m.name + ' leaves the party.', 'system');
      Party._refresh();
      return true;
    },

    /** Back to the recommended tank / healer / damage line-up. */
    useRecommended() {
      const why = Party.changeBlock();
      if (why) { MEO.log(why, 'hint'); return false; }
      Party.roster = null;
      Party.build(Party.leader);
      Party._stamp();
      MEO.log('The recommended party joins you.', 'system');
      return true;
    },

    has(id) {
      return Party.members.some(function (m) { return m.classId === id; });
    },

    /** Simple "equipment" for companions: a bonus that grows with their level. */
    applyGear(m) {
      m.stats.power = Math.round(m.stats.power * 1.1);
      m.stats.armor += 40 + 11 * m.level;
    },

    /** The player levelled up: companions follow (stats recomputed, then fully healed). */
    setLevel(level) {
      Party.members.forEach(function (m) {
        if (m.level === level) return;
        MEO.Abilities.setLevel(m, level);
        Party.applyGear(m);
        m.stats.hp = m.stats.maxHp;
        if (m.stats.resType !== 'fury') m.stats.res = m.stats.maxRes;
      });
    },

    clear() {
      Party.members.forEach(function (m) {
        if (MEO.Entities.byId.has(m.id)) MEO.Entities.remove(m);
      });
      Party.members = [];
      Party.tank = null;
      Party.focus = null;
    },

    /** Everyone in the group: the player first, then the companions. */
    everyone() {
      return Party.leader ? [Party.leader].concat(Party.members) : Party.members.slice();
    },

    isMember(e) {
      return e === Party.leader || Party.members.indexOf(e) >= 0;
    },

    anyInCombat() {
      if (Party.leader && Party.leader.inCombat) return true;
      for (let i = 0; i < Party.members.length; i++) if (Party.members[i].alive && Party.members[i].inCombat) return true;
      return false;
    },

    // ---- Commands ----------------------------------------------------------
    setStance(s) {
      if (STANCES.indexOf(s) < 0 || s === Party.stance) return;
      Party.stance = s;
      if (s === 'passive') Party.focus = null;
      MEO.log('Companions: ' + STANCE_NAMES[s] + ' stance. ' + STANCE_HELP[s], 'system');
      Events.emit('party:stance', s);
    },

    cycleStance() {
      Party.setStance(STANCES[(STANCES.indexOf(Party.stance) + 1) % STANCES.length]);
    },

    /** "Attack my target": all companions engage the player's enemy. */
    attackTarget() {
      const p = Party.leader;
      const t = p && p.target;
      if (!t || !t.alive || !MEO.Combat.isEnemy(p, t)) {
        MEO.log('Select an enemy first, then order your companions to attack it.', 'hint');
        return false;
      }
      if (Party.stance === 'passive') Party.setStance('defensive');
      Party.focus = t;
      MEO.log('Companions attack ' + t.name + '!', 'system');
      return true;
    },

    /** "Regroup": drop the focus and call everyone who has wandered off. */
    regroup() {
      Party.focus = null;
      Party.summon(300);
      MEO.log('Companions regroup around you.', 'system');
    },

    /** Teleport companions that are further than minDist from the leader to their side. */
    summon(minDist) {
      const p = Party.leader;
      Party.members.forEach(function (m, i) {
        if (!m.alive) return;
        if (Math.hypot(m.x - p.x, m.y - p.y) > (minDist || 0)) Party.placeNear(m, p, 70 + i * 20);
      });
    },

    /** Put e on a free spot near the leader (tries a ring of positions). */
    placeNear(e, leader, dist) {
      const w = MEO.Entities.world;
      const T = w ? w.tile : 32;
      const base = Party.heading + Math.PI + (e.slot - 1) * 0.9;
      for (let k = 0; k < 12; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55;
        const r = dist || 80;
        const x = leader.x + Math.cos(a) * r;
        const y = leader.y + Math.sin(a) * r;
        if (w && w.isSolid(Math.floor(x / T), Math.floor(y / T))) continue;
        e.x = e.prevX = x;
        e.y = e.prevY = y;
        return true;
      }
      e.x = e.prevX = leader.x;
      e.y = e.prevY = leader.y;
      return false;
    },

    // ---- Per logic step ------------------------------------------------------
    update() {
      const p = Party.leader;
      if (!p || !Party.active) return;
      const now = MEO.Engine.time;

      if (p.moving) Party.heading = p.facing;
      if (Party.focus && (!Party.focus.alive || Party.focus.evading)) Party.focus = null;

      for (let i = 0; i < Party.members.length; i++) {
        const m = Party.members[i];
        if (m.alive) continue;
        if (!m.reviveAt) m.reviveAt = now + Party.REVIVE_DELAY;
        const waited = now - m.deathTime;
        if (now >= m.reviveAt && (!Party.anyInCombat() || waited >= Party.REVIVE_MAX)) Party.revive(m);
      }
    },

    reviveIn(m) {
      return Math.max(0, m.reviveAt - MEO.Engine.time);
    },

    revive(m) {
      m.alive = true;
      m.corpse = false;
      m.reviveAt = 0;
      m.stats.hp = Math.round(m.stats.maxHp * 0.6);
      m.stats.res = m.stats.resType === 'fury' ? 0 : Math.round(m.stats.maxRes * 0.6);
      m.cd = {};
      m.gcdEnd = 0;
      m.target = null;
      m.ai = null;
      Party.placeNear(m, Party.leader, 70);
      MEO.log(m.name + ' returns to your side.', 'system');
      Events.emit('party:revive', m);
    },

    onDeath(m) {
      m.reviveAt = MEO.Engine.time + Party.REVIVE_DELAY;
      MEO.log(m.name + ' has fallen.', 'system');
    }
  });

  Events.on('entity:remove', function (e) {
    if (Party.focus === e) Party.focus = null;
  });
})();
