/* ==========================================================================
   systems/quests.js – Quest state, objective tracking, rewards and NPC markers.
   Definitions: data/quests.js. Dialogue/log/tracker UI: ui/quest-ui.js.
   state[id] = { progress: [n, ...] } while a quest is active; finished quests are in done{}.
   Collect objectives count items in the backpack; their drops are added to the loot of
   the listed enemies only while the quest is active.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const Q = (MEO.Quests = {
    MAX_ACTIVE: 12,
    state: {},      // active quests
    done: {},       // completed quests { id: true }
    npcs: {},       // npcId → NPC entity

    reset() {
      Q.state = {};
      Q.done = {};
      Q.refreshMarkers();
      Events.emit('quest:update');
    },

    // ---- Queries ---------------------------------------------------------------
    def(id) {
      return MEO.QUEST_BY_ID[id];
    },

    isActive(id) {
      return !!Q.state[id];
    },

    isDone(id) {
      return !!Q.done[id];
    },

    activeList() {
      return MEO.QUESTS.filter(function (q) {
        return Q.state[q.id];
      });
    },

    /** Objective progress as { n, need, done }. */
    objective(q, i) {
      const o = q.objectives[i];
      const st = Q.state[q.id];
      let n = st ? st.progress[i] || 0 : 0;
      if (o.type === 'collect') n = MEO.Inventory.count(o.item);
      n = Math.min(n, o.n || 1);
      return { n: n, need: o.n || 1, done: n >= (o.n || 1), def: o };
    },

    isComplete(q) {
      if (!Q.state[q.id]) return false;
      for (let i = 0; i < q.objectives.length; i++) if (!Q.objective(q, i).done) return false;
      return true;
    },

    canOffer(q) {
      const p = MEO.Game.player;
      if (Q.state[q.id] || Q.done[q.id]) return false;
      if (q.requires) {
        const req = Array.isArray(q.requires) ? q.requires : [q.requires];
        if (!req.some(function (r) { return Q.done[r]; })) return false;   // any of them
      }
      return p.level >= (q.level || 1) - 1;
    },

    offersFor(npcId) {
      return MEO.QUESTS.filter(function (q) {
        return q.giver === npcId && Q.canOffer(q);
      });
    },

    readyFor(npcId) {
      return MEO.QUESTS.filter(function (q) {
        return q.turnin === npcId && Q.isComplete(q);
      });
    },

    openFor(npcId) {
      return MEO.QUESTS.filter(function (q) {
        return q.turnin === npcId && Q.state[q.id] && !Q.isComplete(q);
      });
    },

    /** The reward item for this class, if the quest has class rewards. */
    rewardItem(q) {
      const r = q.reward || {};
      const p = MEO.Game.player;
      if (!r.itemByClass) return null;
      if (r.itemByClass[p.classId]) return r.itemByClass[p.classId];
      const g = MEO.Classes[p.classId].gear;
      for (let i = 0; i < g.length; i++) if (r.itemByClass[g[i]]) return r.itemByClass[g[i]];
      return null;
    },

    // ---- Accept / abandon / complete --------------------------------------------------
    accept(id) {
      const q = Q.def(id);
      if (!q || !Q.canOffer(q)) return false;
      if (Q.activeList().length >= Q.MAX_ACTIVE) {
        Events.emit('inv:fail', { text: 'Your quest log is full' });
        return false;
      }
      Q.state[id] = { progress: q.objectives.map(function () { return 0; }) };
      // Objectives that may already be satisfied
      Q._checkExplore(MEO.Game.areaId);
      MEO.log('Quest accepted: ' + q.name + '.', 'quest');
      Q._changed(q);
      return true;
    },

    abandon(id) {
      const q = Q.def(id);
      if (!q || !Q.state[id]) return;
      delete Q.state[id];
      MEO.log('Quest abandoned: ' + q.name + '.', 'quest');
      Q._changed(q);
    },

    /** Turn in. Returns false if the backpack cannot hold the reward. */
    complete(id) {
      const q = Q.def(id);
      if (!q || !Q.isComplete(q)) return false;
      const Inv = MEO.Inventory;
      const r = q.reward || {};
      const rewards = (r.items || []).slice();
      const pick = Q.rewardItem(q);
      if (pick) rewards.push([pick, 1]);

      // Quest items are handed in, so their slots free up
      const hand = [];
      q.objectives.forEach(function (o) {
        if (o.type === 'collect') hand.push([o.item, o.n]);
      });
      hand.forEach(function (h) {
        Inv.take(h[0], h[1]);
      });
      for (let i = 0; i < rewards.length; i++) {
        if (!Inv.canAdd(rewards[i][0], rewards[i][1])) {
          hand.forEach(function (h) {
            Inv.add(h[0], h[1]);
          });
          Events.emit('inv:fail', { text: 'Your backpack is full' });
          return false;
        }
      }
      rewards.forEach(function (it) {
        Inv.add(it[0], it[1]);
        MEO.log('You receive: ' + MEO.ITEMS[it[0]].name + (it[1] > 1 ? ' ×' + it[1] : '') + '.', 'loot');
      });
      const p = MEO.Game.player;
      if (r.gold) {
        const rg = MEO.Races ? MEO.Races.gold(r.gold) : r.gold;
        p.inv.gold += rg;
        MEO.log('You receive ' + Inv.money(rg) + '.', 'loot');
      }
      delete Q.state[id];
      Q.done[id] = true;
      MEO.log('Quest completed: ' + q.name + '!', 'quest');
      if (MEO.HUD) MEO.HUD.showBanner('Quest Complete', q.name);
      Events.emit('inv:change', p);
      if (r.xp) MEO.Progress.addXp(r.xp);
      Q._changed(q);
      Events.emit('quest:complete', q);
      return true;
    },

    // ---- Tracking ------------------------------------------------------------------------
    _changed() {
      Q.refreshMarkers();
      Events.emit('quest:update');
    },

    _progressMsg(q, i) {
      const o = Q.objective(q, i);
      MEO.log(q.name + ': ' + o.def.label + ' ' + o.n + '/' + o.need + (o.done ? ' (done)' : ''), 'quest');
      if (Q.isComplete(q)) MEO.log('Quest ready to turn in: ' + q.name + '.', 'quest');
    },

    onKill(mob) {
      let hit = false;
      Q.activeList().forEach(function (q) {
        const st = Q.state[q.id];
        q.objectives.forEach(function (o, i) {
          if (o.type !== 'kill' || o.mobs.indexOf(mob.mobId) < 0) return;
          if ((st.progress[i] || 0) >= o.n) return;
          st.progress[i] = (st.progress[i] || 0) + 1;
          hit = true;
          Q._progressMsg(q, i);
        });
      });
      if (hit) Q._changed();
    },

    _checkExplore(areaId) {
      if (!areaId) return;
      let hit = false;
      Q.activeList().forEach(function (q) {
        const st = Q.state[q.id];
        q.objectives.forEach(function (o, i) {
          if (o.type !== 'explore' || o.area !== areaId || (st.progress[i] || 0) >= 1) return;
          st.progress[i] = 1;
          hit = true;
          Q._progressMsg(q, i);
        });
      });
      if (hit) Q._changed();
    },

    onTalk(npc) {
      let hit = false;
      Q.activeList().forEach(function (q) {
        const st = Q.state[q.id];
        q.objectives.forEach(function (o, i) {
          if (o.type !== 'talk' || o.npc !== npc.npcId || (st.progress[i] || 0) >= 1) return;
          st.progress[i] = 1;
          hit = true;
          Q._progressMsg(q, i);
        });
      });
      if (hit) Q._changed();
    },

    /** Called by the loot system: add quest items to the corpse's loot. */
    addDrops(mob, items) {
      Q.activeList().forEach(function (q) {
        q.objectives.forEach(function (o) {
          if (o.type !== 'collect' || o.from.indexOf(mob.mobId) < 0) return;
          let have = MEO.Inventory.count(o.item);
          items.forEach(function (it) {
            if (it.id === o.item) have += it.n;
          });
          if (have >= o.n) return;
          if (Math.random() < (o.chance || 0.5)) items.push({ id: o.item, n: 1 });
        });
      });
    },

    // ---- Markers over NPC heads ---------------------------------------------------------
    registerNpc(npc) {
      if (npc.npcId) Q.npcs[npc.npcId] = npc;
    },

    refreshMarkers() {
      Object.keys(Q.npcs).forEach(function (id) {
        const n = Q.npcs[id];
        if (Q.readyFor(id).length) n.marker = '?';
        else if (Q.offersFor(id).length) n.marker = '!';
        else n.marker = null;
      });
    },

    // ---- Save / load -------------------------------------------------------------------------
    serialize() {
      return { state: JSON.parse(JSON.stringify(Q.state)), done: Object.assign({}, Q.done) };
    },

    load(data) {
      Q.state = {};
      Q.done = {};
      if (data) {
        Object.keys(data.state || {}).forEach(function (id) {
          if (Q.def(id)) Q.state[id] = data.state[id];
        });
        Object.keys(data.done || {}).forEach(function (id) {
          if (Q.def(id)) Q.done[id] = true;
        });
      }
      Q._changed();
    }
  });

  // ---- Event wiring ----------------------------------------------------------------------------
  Events.on('death', function (d) {
    const m = d.entity;
    if (m.type !== 'mob' || !d.killer || !MEO.Combat._isSide(d.killer)) return;
    Q.onKill(m);
  });

  Events.on('area:enter', function (area) {
    Q._checkExplore(area.id);
  });

  Events.on('npc:interact', function (npc) {
    Q.onTalk(npc);
  });

  Events.on('inv:change', function () {
    if (!Q.npcs) return;
    // collect progress changes with the backpack contents; announce each new item once
    Q.activeList().forEach(function (q) {
      const st = Q.state[q.id];
      q.objectives.forEach(function (o, i) {
        if (o.type !== 'collect') return;
        const n = Math.min(MEO.Inventory.count(o.item), o.n);
        if (n !== st.progress[i]) {
          const grew = n > (st.progress[i] || 0);
          st.progress[i] = n;
          if (grew) Q._progressMsg(q, i);
        }
      });
    });
    Q.refreshMarkers();
    Events.emit('quest:update');
  });

  Events.on('player:levelup', function () {
    Q.refreshMarkers();
  });
})();
