/* ==========================================================================
   ui/hud.js – HUD: player frame, action bar, XP bar, minimap, log, debug, world map
   Builds its own DOM and listens to events from the rest of the game.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const C = MEO.CONFIG;
  const U = MEO.util;
  const Events = MEO.Events;
  const Engine = MEO.Engine;
  const T = C.TILE;

  const RES_NAMES = { fury: 'Fury', mana: 'Mana', focus: 'Focus', none: '' };
  const CLASS_NAMES = {};
  Object.keys(MEO.Classes).forEach(function (k) { CLASS_NAMES[k] = MEO.Classes[k].name; });
  const CLASS_COLORS = {};
  Object.keys(MEO.Classes).forEach(function (k) { CLASS_COLORS[k] = MEO.Classes[k].color; });

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const HUD = (MEO.HUD = {
    game: null,
    els: {},
    zoneName: '',
    worldMapOpen: false,

    _cache: {},
    _mapImg: null,
    _miniCtx: null,
    _bigCtx: null,
    _debugTimer: 0,
    _mapTimer: 0,

    // ---------------------------------------------------------------------
    init(game) {
      HUD.game = game;
      HUD.zoneName = game.world.name;
      HUD._buildMapImage(game.world);

      const root = document.getElementById('hud');
      const E = HUD.els;

      // Player frame
      E.player = el('div', 'frame', root);
      E.player.id = 'hud-player';
      E.portrait = el('div', 'portrait', E.player, 'W');
      const body = el('div', 'pf-body', E.player);
      const nameRow = el('div', 'pf-name', body);
      E.name = el('span', '', nameRow);
      E.lvl = el('span', 'lvl', nameRow);
      E.hpBar = el('div', 'bar hp', body);
      E.hpFill = el('div', 'fill', E.hpBar);
      E.hpTxt = el('div', 'txt', E.hpBar);
      E.resBar = el('div', 'bar res', body);
      E.resFill = el('div', 'fill', E.resBar);
      E.resTxt = el('div', 'txt', E.resBar);

      // Banner
      E.banner = el('div', '', root);
      E.banner.id = 'hud-banner';
      E.bannerTitle = el('div', 'zone', E.banner);
      E.bannerSub = el('div', 'area', E.banner);

      // Minimap
      E.mini = el('div', 'frame', root);
      E.mini.id = 'hud-minimap';
      E.miniTitle = el('div', 'title', E.mini, HUD.zoneName);
      E.miniCanvas = el('canvas', '', E.mini);
      E.miniCanvas.width = game.world.w * 2;
      E.miniCanvas.height = game.world.h * 2;
      E.miniCoords = el('div', 'coords', E.mini);
      HUD._miniCtx = E.miniCanvas.getContext('2d');

      // Bottom: XP bar + action bar
      E.bottom = el('div', '', root);
      E.bottom.id = 'hud-bottom';
      E.xp = el('div', '', E.bottom);
      E.xp.id = 'hud-xp';
      E.xpFill = el('div', 'fill', E.xp);
      E.xpTxt = el('div', 'txt', E.xp);
      E.actionbar = el('div', '', E.bottom);
      E.actionbar.id = 'hud-actionbar';
      E.slots = [];
      for (let i = 0; i < 10; i++) {
        const slot = el('div', 'slot empty', E.actionbar);
        const s = {
          node: slot,
          ico: el('span', 'ico', slot),
          cd: el('span', 'cd', slot),
          cdt: el('span', 'cdt', slot),
          cnt: el('span', 'cnt', slot),
          key: el('span', 'key', slot),
          id: null,
          cls: ''
        };
        E.slots.push(s);
        (function (idx, slotObj) {
          slot.addEventListener('pointerdown', function (ev) {
            ev.preventDefault();
            const id = slotObj.id;
            if (!HUD.game.player.alive || HUD.game.state !== 'playing') return;
            if (id) MEO.Abilities.use(HUD.game.player, id);
            else if (slotObj.quick) MEO.Inventory.quickUse(slotObj.quick);
          });
          slot.addEventListener('mouseenter', function () {
            HUD.showTip(slotObj);
          });
          slot.addEventListener('mouseleave', HUD.hideTip);
        })(i, s);
      }

      // Tooltip and error flash
      E.tip = el('div', 'frame', root);
      E.tip.id = 'hud-tip';
      E.tip.hidden = true;
      E.flash = el('div', '', root);
      E.flash.id = 'hud-flash';
      E.autoTag = el('div', '', root);
      E.autoTag.id = 'hud-auto';
      E.autoTag.textContent = 'Auto-attack';
      E.autoTag.hidden = true;

      // Prompt (E – talk to …)
      E.prompt = el('div', '', root);
      E.prompt.id = 'hud-prompt';
      E.prompt.hidden = true;

      // Log
      E.log = el('div', 'frame', root);
      E.log.id = 'hud-log';

      // Hint
      E.hint = el('div', '', root);
      E.hint.id = 'hud-hint';
      HUD.refreshHint();
      Events.on('binds:change', HUD.refreshHint);

      // Debug
      E.debug = el('pre', 'frame', root);
      E.debug.id = 'hud-debug';
      E.debug.hidden = !C.DEBUG;

      // World map
      E.worldmap = el('div', 'frame', root);
      E.worldmap.id = 'hud-worldmap';
      E.worldmap.hidden = true;
      E.worldTitle = el('div', 'title', E.worldmap, game.world.name);
      E.bigCanvas = el('canvas', '', E.worldmap);
      E.bigCanvas.width = game.world.w * 8;
      E.bigCanvas.height = game.world.h * 8;
      el('div', 'foot', E.worldmap, 'M or Esc closes the map');
      HUD._bigCtx = E.bigCanvas.getContext('2d');

      // Events
      Events.on('log', function (d) {
        HUD.addLog(d.text, d.kind);
      });
      Events.on('zone:enter', function (d) {
        HUD.zoneName = d.name;
        E.miniTitle.textContent = d.name;
      });
      Events.on('area:enter', function (area) {
        E.miniTitle.textContent = area.name;
        HUD.showBanner(area.name, HUD.zoneName);
        HUD.addLog('You enter ' + area.name + '.', 'system');
      });
      Events.on('area:leave', function () {
        E.miniTitle.textContent = HUD.zoneName;
      });
      Events.on('debug:toggle', function (on) {
        E.debug.hidden = !on;
      });
      Events.on('class:change', function () {
        HUD.refreshBar();
      });
      Events.on('class:levelset', function () {
        HUD.refreshBar();
      });
      Events.on('ability:fail', function (d) {
        if (d.entity === HUD.game.player) HUD.flash(d.reason);
      });
      HUD.refreshBar();
    },

    // ---- Action bar ------------------------------------------------------------
    refreshBar() {
      const p = HUD.game.player;
      const E = HUD.els;
      for (let i = 0; i < E.slots.length; i++) {
        const s = E.slots[i];
        const id = p.bar[i] || null;
        s.id = id;
        s.cls = '';
        s.quick = !id && i === 8 ? 'heal' : !id && i === 9 ? 'res' : null;
        const code = (MEO.Input.binds['ability' + (i + 1)] || [])[0];
        s.key.textContent = MEO.Input.keyLabel(code);
        if (id) {
          const def = MEO.ABILITIES[id];
          s.ico.textContent = def.icon;
          s.ico.style.color = def.color;
          s.node.classList.remove('empty');
        } else if (s.quick) {
          s.ico.textContent = '🧪';
          s.ico.style.color = s.quick === 'heal' ? '#ff6a5a' : '#6a9aff';
        } else {
          s.ico.textContent = '';
          s.node.classList.add('empty');
        }
        s.node.className = 'slot' + (id || s.quick ? '' : ' empty');
      }
    },

    _updateBar() {
      const p = HUD.game.player;
      const slots = HUD.els.slots;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.quick) {
          HUD._updateQuick(s);
          continue;
        }
        if (!s.id) continue;
        const st = MEO.Abilities.slotState(p, s.id);
        const useCd = st.cdLeft > st.gcdLeft;
        const left = Math.max(st.cdLeft, st.gcdLeft);
        const total = useCd ? st.cdTotal : MEO.Abilities.GCD;
        const frac = left > 0 && total > 0 ? Math.min(1, left / total) : 0;

        let cls = 'slot';
        if (st.noRes) cls += ' nores';
        if (st.oor) cls += ' oor';
        if (st.casting) cls += ' casting';
        if (left > 0) cls += ' cooling';
        if (cls !== s.cls) {
          s.cls = cls;
          s.node.className = cls;
        }

        const pv = frac.toFixed(3);
        if (s.pv !== pv) {
          s.pv = pv;
          s.cd.style.setProperty('--p', pv);
        }
        const txt = useCd && st.cdLeft > 0.05 ? (st.cdLeft >= 10 ? String(Math.ceil(st.cdLeft)) : st.cdLeft.toFixed(1)) : '';
        if (s.txt !== txt) {
          s.txt = txt;
          s.cdt.textContent = txt;
        }
      }
      HUD.els.autoTag.hidden = !(p.auto && p.auto.on);
    },

    _updateQuick(s) {
      const inv = MEO.Inventory;
      const n = inv.quickCount(s.quick);
      const cdl = inv.potionCdLeft();
      const cls = 'slot' + (n === 0 ? ' nores' : '') + (cdl > 0 ? ' cooling' : '');
      if (cls !== s.cls) {
        s.cls = cls;
        s.node.className = cls;
      }
      const pv = cdl > 0 ? Math.min(1, cdl / 20).toFixed(3) : '0.000';
      if (s.pv !== pv) {
        s.pv = pv;
        s.cd.style.setProperty('--p', pv);
      }
      const txt = cdl > 0.05 ? String(Math.ceil(cdl)) : '';
      if (s.txt !== txt) {
        s.txt = txt;
        s.cdt.textContent = txt;
      }
      const c = n > 0 ? String(n) : '';
      if (s.cntTxt !== c) {
        s.cntTxt = c;
        s.cnt.textContent = c;
      }
    },

    showTip(slot) {
      if (slot.quick) {
        const E0 = HUD.els;
        E0.tip.textContent = '';
        el('div', 'tip-name', E0.tip, slot.quick === 'heal' ? 'Healing Potion' : 'Power Potion');
        el('div', 'tip-meta', E0.tip, 'Quick slot · ' + MEO.Inventory.quickCount(slot.quick) + ' in backpack');
        el('div', 'tip-desc', E0.tip, slot.quick === 'heal' ? 'Drinks the smallest healing potion in your backpack.' : 'Drinks the smallest power potion in your backpack. Restores Mana, Focus or Fury.');
        E0.tip.hidden = false;
        const r0 = slot.node.getBoundingClientRect();
        const t0 = E0.tip.getBoundingClientRect();
        E0.tip.style.left = Math.max(8, Math.min(window.innerWidth - t0.width - 8, r0.left + r0.width / 2 - t0.width / 2)) + 'px';
        E0.tip.style.top = Math.max(8, r0.top - t0.height - 10) + 'px';
        return;
      }
      if (!slot.id) return;
      const E = HUD.els;
      const def = MEO.ABILITIES[slot.id];
      const d = MEO.Abilities.describe(def, HUD.game.player);
      E.tip.textContent = '';
      el('div', 'tip-name', E.tip, def.name);
      el('div', 'tip-meta', E.tip, d.meta);
      if (d.value) el('div', 'tip-val', E.tip, d.value);
      el('div', 'tip-desc', E.tip, def.desc);
      E.tip.hidden = false;
      const r = slot.node.getBoundingClientRect();
      const tr = E.tip.getBoundingClientRect();
      E.tip.style.left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2)) + 'px';
      E.tip.style.top = Math.max(8, r.top - tr.height - 10) + 'px';
    },

    hideTip() {
      HUD.els.tip.hidden = true;
    },

    flash(text) {
      const f = HUD.els.flash;
      const now = performance.now();
      if (HUD._flashText === text && now - HUD._flashAt < 350) return;
      HUD._flashText = text;
      HUD._flashAt = now;
      f.textContent = text;
      f.classList.remove('show');
      void f.offsetWidth;
      f.classList.add('show');
    },

    // ---------------------------------------------------------------------
    addLog(text, kind) {
      const log = HUD.els.log;
      if (!log) return;
      const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
      el('div', 'line k-' + (kind || 'info'), log, text);
      while (log.children.length > 80) log.removeChild(log.firstChild);
      if (stick) log.scrollTop = log.scrollHeight;
    },

    /** Key hint bar text built from the current keybinds. */
    refreshHint() {
      const I = MEO.Input;
      const k = function (a) {
        return I.keyLabel((I.binds[a] || [])[0]) || '–';
      };
      const E = HUD.els;
      if (!E || !E.hint) return;
      E.hint.textContent = 'Move ' + k('moveUp') + k('moveLeft') + k('moveDown') + k('moveRight') + ' · Target ' + k('targetNext') + ' · Abilities ' + k('ability1') + '-' + k('ability8') +
        ' · Auto-attack ' + k('autoAttack') + ' · Party ' + k('partyTarget1') + '-' + k('partyTarget3') + ' · Attack ' + k('partyAttack') + ' · Regroup ' + k('partyRegroup') +
        ' · Stance ' + k('partyStance') + ' · Interact ' + k('interact') + ' · Quests ' + k('questLog') + ' · Map ' + k('toggleMap') + ' · Options ' + k('toggleOptions');
    },

    showBanner(title, sub) {
      const b = HUD.els.banner;
      HUD.els.bannerTitle.textContent = title;
      HUD.els.bannerSub.textContent = sub || '';
      b.classList.remove('show');
      void b.offsetWidth; // restart the CSS animation
      b.classList.add('show');
    },

    toggleWorldMap(force) {
      const open = typeof force === 'boolean' ? force : !HUD.worldMapOpen;
      HUD.worldMapOpen = open;
      HUD.els.worldmap.hidden = !open;
      if (open) HUD._drawWorldMap();
    },

    // ---------------------------------------------------------------------
    _setText(key, node, text) {
      if (HUD._cache[key] !== text) {
        HUD._cache[key] = text;
        node.textContent = text;
      }
    },

    _setWidth(key, node, pct) {
      const v = Math.round(U.clamp(pct, 0, 1) * 1000) / 10 + '%';
      if (HUD._cache[key] !== v) {
        HUD._cache[key] = v;
        node.style.width = v;
      }
    },

    _updateFrames() {
      const E = HUD.els;
      const p = HUD.game.player;
      const s = p.stats;

      HUD._setText('name', E.name, p.name);
      HUD._setText('lvl', E.lvl, (CLASS_NAMES[p.classId] || '') + ' · Lv. ' + p.level);
      HUD._setText('portrait', E.portrait, (CLASS_NAMES[p.classId] || '?').charAt(0));
      if (HUD._cache.pcolor !== p.classId) {
        HUD._cache.pcolor = p.classId;
        E.portrait.style.background = CLASS_COLORS[p.classId] || '#555';
      }

      HUD._setWidth('hpw', E.hpFill, s.maxHp ? s.hp / s.maxHp : 0);
      HUD._setText('hpt', E.hpTxt, Math.ceil(s.hp) + ' / ' + s.maxHp);

      const hasRes = s.resType && s.resType !== 'none';
      E.resBar.style.display = hasRes ? '' : 'none';
      if (hasRes) {
        if (HUD._cache.rtype !== s.resType) {
          HUD._cache.rtype = s.resType;
          E.resBar.className = 'bar res ' + s.resType;
        }
        HUD._setWidth('resw', E.resFill, s.maxRes ? s.res / s.maxRes : 0);
        HUD._setText('rest', E.resTxt, RES_NAMES[s.resType] + ' ' + Math.floor(s.res) + ' / ' + s.maxRes);
      }

      const need = U.xpToNext(p.level);
      HUD._setWidth('xpw', E.xpFill, s.xp / need);
      HUD._setText('xpt', E.xpTxt, 'Level ' + p.level + ' · ' + s.xp + ' / ' + need + ' XP');
    },

    _updatePrompt() {
      const g = HUD.game;
      const npc = g.nearNpc;
      const E = HUD.els;
      const lootE = g.nearLoot;
      let text = '';
      if (MEO.Loot && MEO.Loot.open) text = 'Take all';
      else if (lootE) text = 'Loot ' + lootE.name;
      else if (npc) text = (npc.style === 'merchant' ? 'Trade with ' : 'Talk to ') + npc.name;
      if (HUD._cache.prompt === text) return;
      HUD._cache.prompt = text;
      if (!text) {
        E.prompt.hidden = true;
        return;
      }
      const code = (MEO.Input.binds.interact || [])[0];
      E.prompt.textContent = '';
      el('b', '', E.prompt, MEO.Input.keyLabel(code) || 'E');
      E.prompt.appendChild(document.createTextNode(text));
      E.prompt.hidden = false;
    },

    _updateDebug() {
      const g = HUD.game;
      const p = g.player;
      const tx = Math.floor(p.x / T);
      const ty = Math.floor(p.y / T);
      const tile = MEO.TILES[g.world.get(tx, ty)];
      const area = g.world.areaAt(tx, ty);
      HUD.els.debug.textContent =
        'FPS ' + Engine.fps.toFixed(0) + '  (' + Engine.frameMs.toFixed(1) + ' ms)   Tick ' + Engine.tick + '\n' +
        'Pos  ' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ' px\n' +
        'Tile ' + tx + ', ' + ty + '  (' + (tile ? tile.name : '?') + ')\n' +
        'Area ' + (area ? area.name : '–') + '\n' +
        'Camera ' + MEO.Renderer.camera.dist.toFixed(1) + 'm   Entities ' + MEO.Entities.list.length + '\n' +
        'Alpha ' + Engine.alpha.toFixed(2) + '   Seed ' + g.world.seed + '\n' +
        'Combat ' + (p.inCombat ? 'yes' : 'no') + '   GCD ' + MEO.Abilities.gcdLeft(p).toFixed(2) + '\n' + HUD._threatDebug();
    },

    _threatDebug() {
      const t = MEO.Targeting.target;
      if (!t || t.type !== 'mob') return 'Threat: –';
      const rows = MEO.Threat.list(t).slice(0, 3).map(function (r) {
        return r.entity.name + ' ' + Math.round(r.threat);
      });
      const v = MEO.Threat.victim(t);
      return 'Threat: ' + (rows.join(', ') || '–') + (v ? '  → ' + v.name : '');
    },

    /** A new zone was loaded: map image, canvas sizes and names. */
    setWorld(world) {
      const E = HUD.els;
      HUD.zoneName = world.name;
      HUD._buildMapImage(world);
      E.miniCanvas.width = world.w * 2;
      E.miniCanvas.height = world.h * 2;
      E.bigCanvas.width = world.w * 8;
      E.bigCanvas.height = world.h * 8;
      E.miniTitle.textContent = world.name;
      if (E.worldTitle) E.worldTitle.textContent = world.name;
      HUD._miniCtx = E.miniCanvas.getContext('2d');
      HUD._bigCtx = E.bigCanvas.getContext('2d');
    },

    // ---------------------------------------------------------------------
    _buildMapImage(world) {
      const c = document.createElement('canvas');
      c.width = world.w;
      c.height = world.h;
      const g = c.getContext('2d');
      const img = g.createImageData(world.w, world.h);
      const rgb = MEO.TILES.map(function (t) {
        return hexToRgb(t.map);
      });
      for (let i = 0; i < world.w * world.h; i++) {
        const col = rgb[world.tiles[i]];
        img.data[i * 4] = col[0];
        img.data[i * 4 + 1] = col[1];
        img.data[i * 4 + 2] = col[2];
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      HUD._mapImg = c;
    },

    _drawPlayerArrow(g, x, y, facing, size) {
      g.save();
      g.translate(x, y);
      g.rotate(facing);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#000000';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(size, 0);
      g.lineTo(-size * 0.7, size * 0.7);
      g.lineTo(-size * 0.7, -size * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    },

    _drawMinimap() {
      const g = HUD._miniCtx;
      const c = HUD.els.miniCanvas;
      const w = HUD.game.world;
      const p = HUD.game.player;
      g.imageSmoothingEnabled = false;
      g.drawImage(HUD._mapImg, 0, 0, c.width, c.height);

      const kx = c.width / w.pixelW;
      const ky = c.height / w.pixelH;

      g.fillStyle = '#ffd34d';
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        if (list[i].type === 'npc') g.fillRect(list[i].x * kx - 1.5, list[i].y * ky - 1.5, 3, 3);
      }
      g.fillStyle = '#7dff8a';
      for (let i = 0; i < list.length; i++) {
        if (list[i].type === 'party' && list[i].alive) g.fillRect(list[i].x * kx - 1.5, list[i].y * ky - 1.5, 3, 3);
      }

      const R = MEO.Renderer;
      const yaw = R.camera.yaw;
      const px = p.x * kx, py = p.y * ky;
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, py);
      g.arc(px, py, 26, yaw - 0.55, yaw + 0.55);
      g.closePath();
      g.fill();
      g.stroke();

      HUD._drawPlayerArrow(g, p.x * kx, p.y * ky, p.facing, 5);
      HUD._setText('coords', HUD.els.miniCoords, Math.floor(p.x / T) + ', ' + Math.floor(p.y / T));
    },

    _drawWorldMap() {
      const g = HUD._bigCtx;
      const c = HUD.els.bigCanvas;
      const w = HUD.game.world;
      const p = HUD.game.player;
      g.imageSmoothingEnabled = false;
      g.drawImage(HUD._mapImg, 0, 0, c.width, c.height);

      const k = c.width / w.pixelW;

      g.font = '700 14px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.lineJoin = 'round';
      for (let i = 0; i < w.areas.length; i++) {
        const a = w.areas[i];
        const cx = (a.x + a.w / 2) * T * k;
        const cy = (a.y + a.h / 2) * T * k;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText(a.name, cx, cy);
        g.fillStyle = '#ffe9a8';
        g.fillText(a.name, cx, cy);
      }

      g.fillStyle = '#ffd34d';
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        if (list[i].type === 'npc') g.fillRect(list[i].x * k - 3, list[i].y * k - 3, 6, 6);
      }
      g.fillStyle = '#7dff8a';
      for (let i = 0; i < list.length; i++) {
        if (list[i].type === 'party' && list[i].alive) g.fillRect(list[i].x * k - 3, list[i].y * k - 3, 6, 6);
      }
      HUD._drawPlayerArrow(g, p.x * k, p.y * k, p.facing, 9);
    },

    // ---------------------------------------------------------------------
    /** Called every frame by the engine. */
    render(alpha, dt) {
      if (!HUD.game) return;
      HUD._updateFrames();
      HUD._updateBar();
      HUD._updatePrompt();
      HUD._drawMinimap();

      if (C.DEBUG) {
        HUD._debugTimer += dt;
        if (HUD._debugTimer > 0.1) {
          HUD._debugTimer = 0;
          HUD._updateDebug();
        }
      }
      if (HUD.worldMapOpen) {
        HUD._mapTimer += dt;
        if (HUD._mapTimer > 0.25) {
          HUD._mapTimer = 0;
          HUD._drawWorldMap();
        }
      }
    }
  });
})();
