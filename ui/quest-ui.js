/* ==========================================================================
   ui/quest-ui.js – NPC dialogue (offer / progress / turn in), quest log (L)
   and the quest tracker on the left side of the screen.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function btn(label, parent, fn, cls) {
    const b = el('button', 'win-btn ' + (cls || ''), parent, label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  const UI = (MEO.QuestUI = {
    els: {},
    npc: null,         // NPC in the open dialogue
    selected: null,    // quest id shown in the log
    _sig: '',

    init() {
      const root = document.getElementById('hud');
      const E = UI.els;

      // ---- Dialogue ----
      E.dlg = el('div', 'frame win', root);
      E.dlg.id = 'win-quest';
      E.dlg.hidden = true;
      const h = el('div', 'win-head', E.dlg);
      E.dlgTitle = el('span', '', h, '');
      const x = el('button', 'win-x', h, '×');
      x.type = 'button';
      x.addEventListener('click', UI.closeDialogue);
      E.dlgBody = el('div', 'qd-body', E.dlg);

      // ---- Quest log ----
      E.log = el('div', 'frame win', root);
      E.log.id = 'win-qlog';
      E.log.hidden = true;
      const lh = el('div', 'win-head', E.log);
      el('span', '', lh, 'Quest Log');
      const lx = el('button', 'win-x', lh, '×');
      lx.type = 'button';
      lx.addEventListener('click', function () {
        UI.toggleLog(false);
      });
      const cols = el('div', 'ql-cols', E.log);
      E.logList = el('div', 'ql-list', cols);
      E.logDetail = el('div', 'ql-detail', cols);
      E.logFoot = el('div', 'win-hint', E.log);

      // ---- Tracker ----
      E.track = el('div', 'qtrack', root);
      E.track.hidden = true;

      Events.on('quest:update', UI._onUpdate);
      Events.on('inv:change', UI._onUpdate);
    },

    // =======================================================================
    //  Dialogue
    // =======================================================================
    /** Talk to an NPC. Returns true if a dialogue window opened. */
    talk(npc) {
      const Q = MEO.Quests;
      const id = npc.npcId;
      const ready = Q.readyFor(id);
      const offers = Q.offersFor(id);
      const open = Q.openFor(id);
      UI.npc = npc;
      UI.els.dlgTitle.textContent = npc.name;
      UI.els.dlg.hidden = false;
      const plain = npc.style !== 'merchant';
      if (plain && ready.length === 1 && !offers.length) UI._detail(ready[0], 'ready');
      else if (plain && !ready.length && offers.length === 1 && !open.length) UI._detail(offers[0], 'offer');
      else UI._list(npc);
      Events.emit('npc:interact', npc);
      return true;
    },

    _list(npc) {
      const Q = MEO.Quests;
      const B = UI.els.dlgBody;
      B.textContent = '';
      const lineIdx = npc.lineIdx;
      const line = npc.nextLine();
      el('p', 'qd-text', B, '"' + line + '"');
      if (!UI._spokeDetail && MEO.Settings.get('vo.lines')) MEO.Voice.speak(npc.npcId + '_line' + (lineIdx % Math.max(1, npc.lines.length)), line, npc.npcId);
      UI._spokeDetail = false;
      const rows = [];
      Q.readyFor(npc.npcId).forEach(function (q) { rows.push([q, 'ready', '?', 'Ready to turn in']); });
      Q.offersFor(npc.npcId).forEach(function (q) { rows.push([q, 'offer', '!', 'Available']); });
      Q.openFor(npc.npcId).forEach(function (q) { rows.push([q, 'open', '…', 'In progress']); });
      rows.forEach(function (r) {
        const row = el('button', 'qd-quest ' + r[1], B);
        row.type = 'button';
        el('span', 'qd-mark', row, r[2]);
        const t = el('span', 'qd-qname', row, MEO.questTitle(r[0]));
        el('span', 'qd-qlvl', row, 'Lv. ' + (r[0].level || 1));
        t.title = r[3];
        row.addEventListener('click', function () {
          UI._detail(r[0], r[1]);
        });
      });
      if (npc.style === 'merchant') {
        btn('Browse wares', B, function () {
          UI.closeDialogue();
          MEO.InventoryUI.openVendor(npc);
        });
      }
      btn('Goodbye', B, UI.closeDialogue, 'secondary');
    },

    _detail(q, mode) {
      const B = UI.els.dlgBody;
      const Q = MEO.Quests;
      B.textContent = '';
      el('h4', 'qd-title', B, MEO.questTitle(q));
      const text = mode === 'ready' ? q.done : mode === 'open' ? q.progress : q.text;
      el('p', 'qd-text', B, text);
      const voiceKey = q.id + '_' + (mode === 'ready' ? 'done' : mode === 'open' ? 'progress' : 'offer');
      const speaker = UI.npc ? UI.npc.npcId : q.giver;
      MEO.Voice.speak(voiceKey, text, speaker);
      const rp = btn('🔊 Replay voice', B, function () { MEO.Voice.speak(voiceKey, text, speaker); }, 'secondary');
      UI._objectives(B, q, mode !== 'offer');
      if (mode !== 'open') UI._rewards(B, q);
      const npc = UI.npc;
      if (mode === 'offer') {
        btn('Accept quest', B, function () {
          if (Q.accept(q.id)) UI.closeDialogue();
        });
      } else if (mode === 'ready') {
        btn('Complete quest', B, function () {
          if (Q.complete(q.id)) UI._after(npc);
        });
      }
      btn(mode === 'offer' ? 'Not now' : 'Back', B, function () {
        UI._after(npc);
      }, 'secondary');
    },

    /** After accept/complete/back: show the list again, or close when nothing is left. */
    _after(npc) {
      const Q = MEO.Quests;
      const id = npc.npcId;
      if (!Q.readyFor(id).length && !Q.offersFor(id).length && !Q.openFor(id).length && npc.style !== 'merchant') UI.closeDialogue();
      else UI._list(npc);
    },

    closeDialogue() {
      MEO.Voice.stop();
      UI.npc = null;
      UI.els.dlg.hidden = true;
    },

    _objectives(parent, q, showProgress) {
      const box = el('div', 'qd-objs', parent);
      q.objectives.forEach(function (o, i) {
        const ob = MEO.Quests.objective(q, i);
        const line = el('div', 'qd-obj' + (showProgress && ob.done ? ' done' : ''), box);
        el('span', 'qd-dot', line, showProgress && ob.done ? '✔' : '•');
        el('span', '', line, o.label + (o.n > 1 || showProgress ? ' ' + (showProgress ? ob.n + '/' : '0/') + ob.need : ''));
      });
    },

    _rewards(parent, q) {
      const r = q.reward || {};
      const box = el('div', 'qd-rewards', parent);
      el('div', 'qd-rhead', box, 'Rewards');
      const row = el('div', 'qd-rrow', box);
      if (r.xp) el('span', 'qd-r xp', row, r.xp + ' XP');
      if (r.gold) el('span', 'qd-r gold', row, MEO.Inventory.money(r.gold));
      const items = (r.items || []).slice();
      const pick = MEO.Quests.rewardItem(q);
      if (pick) items.push([pick, 1]);
      items.forEach(function (it) {
        const d = MEO.ITEMS[it[0]];
        const s = el('span', 'qd-r item', row, (d.icon || '') + ' ' + d.name + (it[1] > 1 ? ' ×' + it[1] : ''));
        s.style.color = MEO.QUALITY[d.q || 0].color;
      });
    },

    // =======================================================================
    //  Quest log
    // =======================================================================
    toggleLog(force) {
      const open = typeof force === 'boolean' ? force : UI.els.log.hidden;
      UI.els.log.hidden = !open;
      if (open) UI._renderLog();
    },

    _renderLog() {
      const Q = MEO.Quests;
      const E = UI.els;
      E.logList.textContent = '';
      const list = Q.activeList();
      if (UI.selected && !Q.isActive(UI.selected)) UI.selected = null;
      if (!UI.selected && list.length) UI.selected = list[0].id;
      list.forEach(function (q) {
        const row = el('button', 'ql-row' + (q.id === UI.selected ? ' sel' : '') + (Q.isComplete(q) ? ' ready' : ''), E.logList);
        row.type = 'button';
        el('span', '', row, MEO.questTitle(q));
        el('span', 'ql-lvl', row, Q.isComplete(q) ? '✔' : 'Lv. ' + (q.level || 1));
        row.addEventListener('click', function () {
          UI.selected = q.id;
          UI._renderLog();
        });
      });
      if (!list.length) el('div', 'ql-empty', E.logList, 'No active quests. Talk to the people of Tirharad: a "!" above a head means they have work for you.');

      E.logDetail.textContent = '';
      const q = UI.selected ? Q.def(UI.selected) : null;
      if (q) {
        el('h4', 'qd-title', E.logDetail, MEO.questTitle(q));
        el('p', 'qd-text', E.logDetail, Q.isComplete(q) ? q.done : q.text);
        UI._objectives(E.logDetail, q, true);
        UI._rewards(E.logDetail, q);
        const giver = Q.npcs[q.turnin];
        el('div', 'win-hint', E.logDetail, (Q.isComplete(q) ? 'Turn in to ' : 'Report to ') + (giver ? giver.name : MEO.npcName(q.turnin)) + '.');
        const ab = btn('Abandon quest', E.logDetail, function () {
          Q.abandon(q.id);
        }, 'secondary');
        ab.style.marginTop = '10px';
      }
      const done = Object.keys(Q.done).length;
      E.logFoot.textContent = list.length + ' active · ' + done + ' completed';
    },

    // =======================================================================
    //  Tracker + refresh
    // =======================================================================
    _onUpdate() {
      UI._renderTracker();
      if (!UI.els.log.hidden) UI._renderLog();
    },

    _renderTracker() {
      const Q = MEO.Quests;
      const T = UI.els.track;
      const list = Q.activeList().slice(0, 5);
      let sig = '';
      list.forEach(function (q) {
        sig += q.id + ':';
        q.objectives.forEach(function (o, i) {
          sig += Q.objective(q, i).n + ',';
        });
      });
      if (sig === UI._sig) return;
      UI._sig = sig;
      T.hidden = !list.length;
      T.textContent = '';
      if (!list.length) return;
      el('div', 'qt-head', T, 'Quests');
      list.forEach(function (q) {
        const ready = Q.isComplete(q);
        const box = el('div', 'qt-quest' + (ready ? ' ready' : ''), T);
        el('div', 'qt-name', box, MEO.questTitle(q) + (ready ? ' – ready' : ''));
        if (!ready) {
          q.objectives.forEach(function (o, i) {
            const ob = Q.objective(q, i);
            el('div', 'qt-obj' + (ob.done ? ' done' : ''), box, o.label + ' ' + ob.n + '/' + ob.need);
          });
        }
      });
    },

    update() {
      const I = MEO.Input;
      if (I.wasPressed('questLog')) UI.toggleLog();
      // walk away from the NPC: the dialogue closes
      if (UI.npc) {
        const p = MEO.Game.player;
        if (!p.alive || Math.hypot(UI.npc.x - p.x, UI.npc.y - p.y) > 110) UI.closeDialogue();
      }
    },

    /** Esc: close the topmost quest window. */
    closeTop() {
      if (!UI.els.dlg.hidden) {
        UI.closeDialogue();
        return true;
      }
      if (!UI.els.log.hidden) {
        UI.toggleLog(false);
        return true;
      }
      return false;
    }
  });
})();
