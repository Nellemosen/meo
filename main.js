/* ==========================================================================
   main.js – Startup: assembles zone, player and systems, and starts the loop
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const C = MEO.CONFIG;
  const T = C.TILE;
  const Events = MEO.Events;
  const Input = MEO.Input;
  const Engine = MEO.Engine;
  const Renderer = MEO.Renderer;
  const Entities = MEO.Entities;
  const HUD = MEO.HUD;

  const Game = (MEO.Game = {
    world: null,
    player: null,
    classId: 'guardian',
    state: 'boot',
    loaded: false,
    areaId: null,
    nearNpc: null,
    _lastTx: -1,
    _lastTy: -1,

    // -------------------------------------------------------------------
    init() {
      const canvas = document.getElementById('game');
      Input.init(canvas);
      Renderer.init(canvas, document.getElementById('overlay'));

      Game.player = Entities.add(new MEO.Player({ x: 0, y: 0 }));
      Renderer.setFollow(Game.player);
      MEO.Abilities.setupClass(Game.player, Game.classId, C.START_LEVEL);
      MEO.Targeting.init(Game.player);
      Game.loadZone('westmark', { entry: 'spawn', first: true });

      HUD.init(Game);
      Events.emit('hud:ready');
      MEO.Settings.init();
      MEO.OptionsUI.init();
      MEO.InventoryUI.init();
      MEO.TraitsUI.init();
      MEO.PartyUI.init();
      MEO.FellowshipUI.init();
      MEO.QuestUI.init();
      MEO.BossUI.init();
      document.getElementById('btn-options').addEventListener('click', MEO.OptionsUI.toggle);
      document.getElementById('btn-options-start').addEventListener('click', MEO.OptionsUI.toggle);
      MEO.Quests.refreshMarkers();
      MEO.Frames.init();
      MEO.CombatText.init();
      MEO.PartyFrames.init();
      Game._buildClassSelect();
      Game._buildContinue();

      Events.on('death', Game._onDeath);
      Events.on('area:enter', function (a) {
        if (a.kind === 'portal' && Game.state === 'playing') Game.travel(a);
      });

      Engine.addUpdate(Game.update, 0);
      Engine.addRender(function (alpha, dt) {
        Renderer.render(alpha, dt);
      }, 0);
      Engine.addRender(function (alpha, dt) {
        HUD.render(alpha, dt);
      }, 100);
      Engine.addRender(function (alpha, dt) {
        MEO.Frames.render(alpha, dt);
      }, 105);
      Engine.addRender(function () {
        MEO.PartyFrames.render();
      }, 106);

      // Buttons and global keys
      document.getElementById('btn-start').addEventListener('click', Game._startClick);
      document.getElementById('btn-resume').addEventListener('click', Game.togglePause);
      document.getElementById('btn-save').addEventListener('click', function () {
        MEO.Save.save(true);
      });
      window.addEventListener('keydown', Game._onKey);

      Engine.setState('menu');
      Game.state = 'menu';
      Engine.start();
      Engine.pause(true); // wait for "Begin the adventure"
    },

    // -------------------------------------------------------------------
    /** Change the player's class (and level). Used by the start screen and the console. */
    setClass(id, level) {
      Game.classId = id;
      MEO.Abilities.setupClass(Game.player, id, level || C.START_LEVEL);
      if (MEO.Party.active) MEO.Party.build(Game.player);
    },

    // -------------------------------------------------------------------
    /**
     * Build and enter a zone (data/zones.js). opts: { entry: 'name' | 'spawn', pos: {x,y}, first }.
     * All creatures and NPCs of the old zone vanish; the player and companions come along.
     */
    loadZone(id, opts) {
      opts = opts || {};
      const z = MEO.ZONES[id];
      if (!z) return false;
      const p = Game.player;
      Game.zoneSerial = (Game.zoneSerial || 0) + 1;
      if (MEO.Boss) { MEO.Boss.list = []; MEO.Boss.current = null; }
      Events.emit('boss:reset');
      Game.zoneId = id;
      Entities.list.slice().forEach(function (e) {
        if (e !== p && e.type !== 'party') Entities.remove(e);
      });
      MEO.Quests.npcs = {};
      MEO.Targeting.clear();
      if (MEO.Loot.open) MEO.Loot.close();
      MEO.Hazards.clear();

      const world = z.build(C.WORLD_SEED);
      if (world.warnings.length) console.warn('[World ' + id + ']', world.warnings.join('; '));
      Game.world = world;
      Entities.world = world;
      Renderer.setWorld(world);

      // player position
      let pos;
      if (opts.pos) pos = opts.pos;
      else {
        const e = opts.entry && opts.entry !== 'spawn' && world.entries && world.entries[opts.entry] ? world.entries[opts.entry] : world.points.spawn;
        pos = world.tileCenter(e.tx, e.ty);
      }
      p.x = p.prevX = pos.x;
      p.y = p.prevY = pos.y;
      p.vx = p.vy = 0;
      if (MEO.Party.active) {
        MEO.Party.members.forEach(function (m, i) {
          MEO.Party.placeNear(m, p, 70 + i * 20);
          if (m.ai) { m.ai.main = null; m.ai.foes = []; }
        });
      }

      (z.npcs || []).forEach(function (d) {
        const pp = world.tileCenter(d.tile[0], d.tile[1]);
        MEO.Quests.registerNpc(Entities.add(new MEO.NPC(Object.assign({}, d, { x: pp.x, y: pp.y }))));
      });
      (z.dummies || []).forEach(function (d) {
        const pp = world.tileCenter(d.tile[0], d.tile[1]);
        Game.spawnMob(d.id, pp.x, pp.y);
      });
      MEO.Spawner.populate(world, z.spawns || []);
      (z.bosses || []).forEach(function (b) {
        const bp = world.points[b.point];
        Game.spawnMob(b.mob, (bp.tx + 0.5) * world.tile, (bp.ty + 0.5) * world.tile, b.group || b.mob);
      });

      Game.areaId = null;
      Game._lastTx = -1;
      Game._lastTy = -1;
      Renderer.camera.ready = false;
      if (HUD.game) HUD.setWorld(world);
      MEO.Quests.refreshMarkers();
      if (!opts.first) {
        Events.emit('zone:enter', { name: world.name });
        MEO.log('You enter ' + world.name + '.', 'system');
        if (MEO.Save && MEO.Save.enabled) MEO.Save.markDirty();
      }
      return true;
    },

    /** Leave through a portal area: to = zone id or 'home' (the race's starting zone). */
    travel(area) {
      if (Game._travelLock) return;
      let to = area.to;
      let entry = area.entry;
      if (to === 'home') {
        const r = MEO.RACES[MEO.Races.current];
        to = r.zone;
      }
      if (!MEO.ZONES[to]) return;
      Game._travelLock = true;
      MEO.HUD.showBanner(MEO.ZONES[to].name, 'Travelling...');
      Engine.after(0.4, function () {
        Game.loadZone(to, { entry: entry || 'spawn' });
        Engine.after(1.0, function () {
          Game._travelLock = false;
          const a = Game.world.areaById[Game.areaId];
          if (a && a.kind === 'portal') Game.travel(a);   // walked into a portal while it was locked
        });
      });
    },

    spawnMob(id, x, y, group) {
      const mob = new MEO.Mob({ def: MEO.MOBS[id], mobId: id, x: x, y: y, group: group || null });
      Game.scaleMob(mob);
      return Entities.add(mob);
    },

    /**
     * Group difficulty: enemies are designed for a party. Health and damage grow with the party size
     * (you + companions) and with the Difficulty setting. Dummies are left alone.
     */
    scaleMob(mob) {
      if (!mob.attack || mob.isStatic) return;
      const n = 1 + (MEO.Party && MEO.Party.members ? MEO.Party.members.length : 0);
      const diff = { story: [0.8, 0.75], adventure: [1, 1], heroic: [1.35, 1.3] }[MEO.Settings ? MEO.Settings.get('game.difficulty') : 'adventure'] || [1, 1];
      const boss = mob.rank === 'boss' ? 1.15 : 1;
      const hpK = (1 + 0.5 * (n - 1)) * diff[0] * boss;
      const dmgK = (1 + 0.1 * (n - 1)) * diff[1];
      mob.stats.maxHp = Math.round(mob.stats.maxHp * hpK);
      mob.stats.hp = mob.stats.maxHp;
      mob.attack = Object.assign({}, mob.attack, { dmg: Math.round(mob.attack.dmg * dmgK) });
    },

    /** Remove an entity once (safe to call multiple times). */
    removeEntity(e) {
      if (Entities.byId.has(e.id)) Entities.remove(e);
    },

    /** "Begin the adventure": with an existing save the first click asks for confirmation. */
    _startClick() {
      const b = document.getElementById('btn-start');
      if (MEO.Save.exists() && !Game._armed) {
        Game._armed = true;
        b.textContent = 'This replaces your saved game – click again';
        return;
      }
      Game.begin();
    },

    /** "Continue" on the start screen when a save exists. */
    _buildContinue() {
      const b = document.getElementById('btn-continue');
      const s = MEO.Save.summary();
      if (!s) return;
      b.hidden = false;
      b.textContent = 'Continue – ' + s.name + ', level ' + s.level;
      b.addEventListener('click', function () {
        if (MEO.Save.load()) {
          Game.loaded = true;
          Game.begin();
        }
      });
    },

    _buildClassSelect() {
      const rbox = document.getElementById('race-select');
      const box = document.getElementById('class-select');
      if (!box || !rbox) return;
      MEO.RACE_ORDER.forEach(function (id) {
        const r = MEO.RACES[id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'class-btn race-btn';
        b.dataset.race = id;
        b.innerHTML = '<span class="crest"></span>' + r.short + '<small>' + r.origin + '</small>';
        b.querySelector('.crest').style.background = r.skin;
        b.querySelector('.crest').style.color = '#222';
        b.querySelector('.crest').textContent = r.short.charAt(0);
        b.addEventListener('click', function () { Game.chooseRace(id); });
        rbox.appendChild(b);
      });
      ['tank', 'heal', 'dps', 'support'].forEach(function (arch) {
        const row = document.createElement('div');
        row.className = 'arch-row';
        row.innerHTML = '<span class="arch-name">' + MEO.ARCH_NAMES[arch] + '</span>';
        MEO.CLASS_ORDER.forEach(function (id) {
          const cls = MEO.Classes[id];
          if (cls.arch !== arch) return;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'class-btn';
          b.dataset.cls = id;
          b.innerHTML = '<span class="crest"></span>' + cls.name + '<small>' + cls.specs.map(function (s) { return s.name; }).join(' · ') + '</small>';
          b.querySelector('.crest').style.background = cls.color;
          b.querySelector('.crest').textContent = cls.name.charAt(0);
          b.addEventListener('click', function () { Game.chooseClass(id); });
          row.appendChild(b);
        });
        box.appendChild(row);
      });
      Game.chooseRace(MEO.Races.current);
      Game.chooseClass(Game.classId);
    },

    chooseRace(id) {
      MEO.Races.set(Game.player, id);
      const r = MEO.RACES[id];
      document.querySelectorAll('.race-btn').forEach(function (b) {
        b.classList.toggle('sel', b.dataset.race === id);
      });
      document.getElementById('race-desc').textContent = r.desc + '  ' +
        r.traits.map(function (t) { return t.name + ': ' + t.desc; }).join('  ·  ');
    },

    chooseClass(id) {
      Game.setClass(id);
      const cls = MEO.Classes[id];
      document.querySelectorAll('.class-btn:not(.race-btn)').forEach(function (b) {
        b.classList.toggle('sel', b.dataset.cls === id);
      });
      document.getElementById('class-desc').textContent =
        cls.name + ' (' + MEO.ARCH_NAMES[cls.arch] + ') from ' + cls.origin + ' – ' + cls.desc;
    },

    _onDeath(d) {
      const e = d.entity;
      if (e.type === 'mob') {
        MEO.log(e.name + ' is defeated.', 'system');
        e.evading = false;
        Engine.after(e.corpseTime, function () {
          Game.removeEntity(e);
        });
        if (e.respawn && !e.noRespawn) {
          const zs = Game.zoneSerial;
          Engine.after(e.respawn * MEO.EnemyAI.pace().respawn, function () {
            if (zs === Game.zoneSerial) Game.spawnMob(e.mobId, e.home.x, e.home.y, e.group);
          });
        }
      } else if (e.type === 'party') {
        MEO.Party.onDeath(e);
      } else if (e === Game.player) {
        MEO.log('You have fallen in battle. You will be revived at the village shortly.', 'system');
        HUD.showBanner('You have fallen', 'Reviving in 6 seconds');
        Engine.after(6, Game.revive);
      }
    },

    revive() {
      const p = Game.player;
      const sp = Game.world.tileCenter(Game.world.points.spawn.tx, Game.world.points.spawn.ty);
      p.alive = true;
      p.corpse = false;
      p.x = p.prevX = sp.x;
      p.y = p.prevY = sp.y;
      p.stats.hp = Math.round(p.stats.maxHp * 0.5);
      p.stats.res = p.stats.resType === 'fury' ? 0 : Math.round(p.stats.maxRes * 0.5);
      p.cd = {};
      p.gcdEnd = 0;
      MEO.Targeting.clear();
      MEO.Party.summon(0);
      MEO.log('You are revived.', 'system');
    },

    begin() {
      if (Game.state !== 'menu') return;
      document.getElementById('start-screen').hidden = true;
      Game.state = 'playing';
      Engine.setState('playing');
      Input.clear();
      Engine.pause(false);
      document.getElementById('game').focus();

      if (!Game.loaded) {
        MEO.Quests.reset();
        const home = MEO.RACES[MEO.Races.current].zone;
        if (home && Game.zoneId !== home) Game.loadZone(home, { entry: 'spawn', first: true });
      }
      MEO.Party.build(Game.player);
      MEO.Save.enabled = true;
      Events.emit('zone:enter', { name: Game.world.name });
      MEO.log('Welcome to ' + Game.world.name + ', adventurer.', 'system');
      MEO.log('WASD moves you. Drag with the mouse to rotate the camera (the right button also turns your character). Wheel = zoom. E talks to people.', 'hint');
      const kl = function (a) {
        return MEO.Input.keyLabel((MEO.Input.binds[a] || [])[0]) || '-';
      };
      MEO.log(kl('targetNext') + ' selects a target, ' + kl('ability1') + '-' + kl('ability8') + ' use abilities, ' + kl('autoAttack') + ' starts auto-attack. ' + kl('ability9') + '/' + kl('ability10') + ' drink potions. ' + kl('interact') + ' loots corpses and talks to people (a ! above a head means a quest). ' + kl('toggleInv') + ' opens your backpack, ' + kl('toggleTraits') + ' your traits, ' + kl('toggleParty') + ' your companions, ' + kl('questLog') + ' the quest log. All keys can be changed in Options (' + kl('toggleOptions') + ').', 'hint');
      MEO.log('A ! above someone\'s head means a quest. The main story is marked with a star in your quest log.', 'hint');
    },

    togglePause() {
      if (Game.state === 'playing') {
        Game.state = 'paused';
        Engine.setState('paused');
        Engine.pause(true);
        document.getElementById('pause-screen').hidden = false;
      } else if (Game.state === 'paused') {
        Game.state = 'playing';
        Engine.setState('playing');
        Input.clear();
        Engine.pause(false);
        document.getElementById('pause-screen').hidden = true;
        document.getElementById('game').focus();
      }
    },

    _onKey(e) {
      if (e.code === 'Escape') {
        if (MEO.OptionsUI.closeTop()) return;
        if (MEO.QuestUI.closeTop()) return;
        if (MEO.TraitsUI.closeTop()) return;
        if (MEO.PartyUI.closeTop()) return;
        if (MEO.InventoryUI.closeTop()) return;
        if (HUD.worldMapOpen) HUD.toggleWorldMap(false);
        else if (Game.state === 'playing' && MEO.Targeting.target) MEO.Targeting.clear();
        else Game.togglePause();
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && Game.state === 'menu') {
        e.preventDefault();
        Game._startClick();
      } else if (Game.state === 'menu' && /^Digit[1-9]$/.test(e.code)) {
        Game.chooseClass(MEO.CLASS_ORDER[Number(e.code.slice(5)) - 1]);
      }
    },

    // -------------------------------------------------------------------
    /** One logic step (60 times per second). */
    update(dt) {
      Game._globalInput();
      if (Game.player.alive) Game._combatInput();
      Entities.update(dt);
      MEO.Abilities.update(dt);
      MEO.Buffs.update(dt);
      MEO.Combat.update(dt);
      MEO.Party.update(dt);
      MEO.Hazards.update(dt);
      MEO.Boss.update(dt);
      if (MEO.BossUI) MEO.BossUI.update();
      if (MEO.Audio) MEO.Audio.update(dt);
      MEO.Loot.update(dt);
      MEO.InventoryUI.update();
      MEO.QuestUI.update();
      MEO.Fm.update(dt);
      MEO.Save.update();
      Game._trackPosition();
      Game._updateNearbyNpc();
      if (Input.wasPressed('interact')) Game._interact();
    },

    _globalInput() {
      if (Input.wasPressed('toggleDebug')) {
        C.DEBUG = !C.DEBUG;
        Events.emit('debug:toggle', C.DEBUG);
      }
      if (Input.wasPressed('toggleMap')) HUD.toggleWorldMap();
      if (Input.wasPressed('toggleOptions')) MEO.OptionsUI.toggle();
      if (Input.wasPressed('hideUI')) document.getElementById('hud').classList.toggle('ui-hidden');
      if (Input.wasPressed('toggleInv')) MEO.InventoryUI.toggle();
      if (Input.wasPressed('toggleTraits')) MEO.TraitsUI.toggle();
      if (Input.wasPressed('toggleParty')) MEO.PartyUI.toggle();

      let steps = Input.consumeWheelSteps();
      if (Input.wasPressed('zoomIn')) steps -= 1;
      if (Input.wasPressed('zoomOut')) steps += 1;
      if (steps !== 0) Renderer.zoomBy(-steps);
      if (Game.state !== 'playing') Input.consumeClicks();
    },

    _combatInput() {
      const p = Game.player;
      const T = MEO.Targeting;
      const C2 = MEO.Combat;

      if (Input.wasPressed('targetNext')) T.cycle(1);
      else if (Input.wasPressed('targetPrev')) T.cycle(-1);
      if (Input.wasPressed('targetSelf')) T.selectSelf();
      if (Input.wasPressed('autoAttack')) C2.toggleAuto(p);

      // companions: F2-F4 target them, R = attack my target, V = regroup, G = change stance
      for (let i = 0; i < 3; i++) {
        if (Input.wasPressed('partyTarget' + (i + 1)) && MEO.Party.members[i]) T.set(MEO.Party.members[i]);
      }
      if (Input.wasPressed('partyAttack')) MEO.Party.attackTarget();
      if (Input.wasPressed('partyRegroup')) MEO.Party.regroup();
      if (Input.wasPressed('partyStance')) MEO.Party.cycleStance();

      for (let i = 1; i <= 10; i++) {
        if (Input.wasPressed('ability' + i)) {
          const id = p.bar[i - 1];
          if (id) MEO.Abilities.use(p, id);
          else if (i === 9) MEO.Inventory.quickUse('heal');
          else if (i === 10) MEO.Inventory.quickUse('res');
        }
      }

      // clean clicks (dragging is used for the camera): left selects a target, right selects and attacks
      const clicks = Input.consumeClicks();
      for (let i = 0; i < clicks.length; i++) {
        const c = clicks[i];
        const e = T.click(c.x, c.y);
        if (!e) {
          // no living entity: is it a corpse with loot?
          const corpse = Renderer.pickEntity(c.x, c.y, true);
          if (corpse) MEO.Loot.tryOpen(corpse);
        } else if (c.button === 2 && C2.isEnemy(p, e)) C2.startAuto(p);
      }
    },

    _trackPosition() {
      const p = Game.player;
      const tx = Math.floor(p.x / T);
      const ty = Math.floor(p.y / T);
      if (tx === Game._lastTx && ty === Game._lastTy) return;
      Game._lastTx = tx;
      Game._lastTy = ty;
      Events.emit('player:tile', { tx: tx, ty: ty });

      const area = Game.world.areaAt(tx, ty);
      const id = area ? area.id : null;
      if (id === Game.areaId) return;
      const prev = Game.areaId ? Game.world.areaById[Game.areaId] : null;
      Game.areaId = id;
      if (prev) Events.emit('area:leave', prev);
      if (area) Events.emit('area:enter', area);
    },

    _updateNearbyNpc() {
      const p = Game.player;
      Game.nearNpc = Entities.nearest(p.x, p.y, 56, function (e) {
        return e.type === 'npc';
      });
      Game.nearLoot = p.alive ? MEO.Loot.nearest() : null;
    },

    _interact() {
      const p = Game.player;
      if (!p.alive) return;
      // 1) E again on an open corpse = take all
      if (MEO.Loot.open) {
        MEO.Loot.takeAll();
        return;
      }
      // 2) corpse nearby
      if (Game.nearLoot) {
        MEO.Loot.tryOpen(Game.nearLoot);
        return;
      }
      // 3) NPC
      const npc = Game.nearNpc;
      if (!npc) return;
      p.facing = Math.atan2(npc.y - p.y, npc.x - p.x);
      MEO.QuestUI.talk(npc);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.init);
  else Game.init();
})();
