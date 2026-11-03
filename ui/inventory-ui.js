/* ==========================================================================
   ui/inventory-ui.js – Backpack/character, loot window, merchant and item tooltips
   Keys I / B / C open the window. Right-click: use / equip / sell.
   Drag and drop: move within the backpack or place in an equipment slot.
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

  function cap(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  const EQUIP_GRID = ['head', 'neck', 'ring', 'chest', 'hands', 'legs', 'feet', 'mainhand', 'offhand'];

  const UI = (MEO.InventoryUI = {
    els: {},
    vendor: null,        // NPC the window is trading with
    _drag: null,

    init() {
      const root = document.getElementById('hud');
      const E = UI.els;

      // ---- Backpack / character ----
      E.inv = el('div', 'frame win', root);
      E.inv.id = 'win-inv';
      E.inv.hidden = true;
      const h = el('div', 'win-head', E.inv);
      el('span', '', h, 'Backpack and equipment');
      const x = el('button', 'win-x', h, '×');
      x.type = 'button';
      x.addEventListener('click', function () {
        UI.toggle(false);
      });
      E.equip = el('div', 'equip-grid', E.inv);
      E.stats = el('div', 'stat-list', E.inv);
      E.bag = el('div', 'bag-grid', E.inv);
      E.gold = el('div', 'gold-line', E.inv);
      el('div', 'win-hint', E.inv, 'Right-click: use / equip · Drag: move · Right-click equipment: unequip');

      // ---- Loot ----
      E.loot = el('div', 'frame win', root);
      E.loot.id = 'win-loot';
      E.loot.hidden = true;
      const lh = el('div', 'win-head', E.loot);
      E.lootTitle = el('span', '', lh, 'Loot');
      const lx = el('button', 'win-x', lh, '×');
      lx.type = 'button';
      lx.addEventListener('click', function () {
        MEO.Loot.close();
      });
      E.lootList = el('div', 'loot-list', E.loot);
      E.lootAll = el('button', 'win-btn', E.loot, 'Take all (E)');
      E.lootAll.type = 'button';
      E.lootAll.addEventListener('click', function () {
        MEO.Loot.takeAll();
      });

      // ---- Merchant ----
      E.shop = el('div', 'frame win', root);
      E.shop.id = 'win-shop';
      E.shop.hidden = true;
      const sh = el('div', 'win-head', E.shop);
      E.shopTitle = el('span', '', sh, 'Merchant');
      const sx = el('button', 'win-x', sh, '×');
      sx.type = 'button';
      sx.addEventListener('click', function () {
        UI.closeVendor();
      });
      E.shopList = el('div', 'shop-list', E.shop);
      E.shopJunk = el('button', 'win-btn', E.shop, 'Sell all junk');
      E.shopJunk.type = 'button';
      E.shopJunk.addEventListener('click', function () {
        const g = MEO.Inventory.sellJunk();
        if (g > 0) MEO.log('You sell junk for ' + MEO.Inventory.money(g) + '.', 'loot');
        else MEO.Game && MEO.HUD.flash('No junk to sell');
      });
      el('div', 'win-hint', E.shop, 'Click to buy (Shift: 5 at a time) · Right-click backpack items to sell');

      // ---- Tooltip ----
      E.tip = el('div', 'frame', root);
      E.tip.id = 'item-tip';
      E.tip.hidden = true;

      // windows must not show the browser's right-click menu
      [E.inv, E.loot, E.shop].forEach(function (w) {
        w.addEventListener('contextmenu', function (ev) {
          ev.preventDefault();
        });
        w.addEventListener('mousedown', function (ev) {
          ev.stopPropagation();
        });
      });

      Events.on('inv:change', function () {
        UI.refresh();
      });
      Events.on('class:change', function () {
        UI.refresh();
      });
      Events.on('loot:open', function (e) {
        UI._renderLoot(e);
      });
      Events.on('loot:change', function (e) {
        UI._renderLoot(e);
      });
      Events.on('loot:close', function () {
        E.loot.hidden = true;
        UI.hideTip();
      });
      Events.on('inv:fail', function (d) {
        MEO.HUD.flash(d.text);
      });
      Events.on('item:equip', function (d) {
        MEO.log('You equip ' + d.item.name + '.', 'loot');
      });
      Events.on('item:use', function (d) {
        MEO.log('You use ' + d.item.name + '.', 'loot');
      });
      Events.on('item:sell', function (d) {
        MEO.log('You sell ' + d.item.name + (d.n > 1 ? ' ×' + d.n : '') + ' for ' + MEO.Inventory.money(d.gold) + '.', 'loot');
      });
      Events.on('item:buy', function (d) {
        MEO.log('You buy ' + d.item.name + (d.n > 1 ? ' ×' + d.n : '') + ' for ' + MEO.Inventory.money(d.gold) + '.', 'loot');
      });

      UI.refresh();
    },

    // ---- Open / close ------------------------------------------------------------
    toggle(force) {
      if (MEO.Game.state !== 'playing' && force !== false) return;
      const E = UI.els;
      const open = force === undefined ? E.inv.hidden : !!force;
      E.inv.hidden = !open;
      if (!open) UI.hideTip();
      else UI.refresh();
    },

    openVendor(npc) {
      UI.vendor = npc;
      UI.els.shopTitle.textContent = npc.name;
      UI.els.shop.hidden = false;
      UI.els.inv.hidden = false;
      UI._renderShop();
      UI.refresh();
    },

    closeVendor() {
      UI.vendor = null;
      UI.els.shop.hidden = true;
      UI.hideTip();
    },

    /** Esc: close the topmost window. Returns true if something was closed. */
    closeTop() {
      const E = UI.els;
      if (MEO.Loot.open) {
        MEO.Loot.close();
        return true;
      }
      if (UI.vendor) {
        UI.closeVendor();
        return true;
      }
      if (!E.inv.hidden) {
        UI.toggle(false);
        return true;
      }
      return false;
    },

    /** Called every step: close the merchant if the player walks away. */
    update() {
      if (UI.vendor) {
        const p = MEO.Game.player;
        if (Math.hypot(UI.vendor.x - p.x, UI.vendor.y - p.y) > 130 || !p.alive) UI.closeVendor();
      }
    },

    // ---- Drawing ------------------------------------------------------------------
    refresh() {
      const E = UI.els;
      if (!E.inv || !MEO.Inventory.player || !MEO.Inventory.player.inv) return;
      UI.hideTip();
      if (!E.inv.hidden) {
        UI._renderEquip();
        UI._renderStats();
        UI._renderBag();
        E.gold.textContent = '';
        el('span', 'gold-ico', E.gold, '●');
        el('span', '', E.gold, ' ' + MEO.Inventory.money(MEO.Inventory.player.inv.gold));
      }
      if (UI.vendor) UI._renderShop();
    },

    _slotEl(parent, itemId, n) {
      const it = itemId ? MEO.ITEMS[itemId] : null;
      const s = el('div', 'islot', parent);
      if (it) {
        s.style.borderColor = MEO.QUALITY[it.q].color;
        const ic = el('span', 'iico', s, it.icon);
        if (it.color) ic.style.color = it.color;
        if (n > 1) el('span', 'icnt', s, String(n));
      } else s.classList.add('empty');
      return s;
    },

    _renderEquip() {
      const E = UI.els;
      const inv = MEO.Inventory;
      const p = inv.player;
      E.equip.textContent = '';
      EQUIP_GRID.forEach(function (slot) {
        const id = p.inv.equip[slot];
        const s = UI._slotEl(E.equip, id, 1);
        s.dataset.slot = slot;
        if (!id) {
          el('span', 'sglyph', s, MEO.SLOTS[slot].icon);
          s.title = MEO.SLOTS[slot].name;
        } else {
          s.draggable = true;
          s.addEventListener('mouseenter', function () {
            UI.showTip(s, id, { equipped: true });
          });
          s.addEventListener('mouseleave', UI.hideTip);
          s.addEventListener('contextmenu', function (ev) {
            ev.preventDefault();
            UI.hideTip();
            inv.unequip(slot);
          });
          s.addEventListener('dblclick', function () {
            UI.hideTip();
            inv.unequip(slot);
          });
          s.addEventListener('dragstart', function (ev) {
            UI._drag = { from: 'eq', slot: slot };
            ev.dataTransfer.setData('text/plain', 'eq');
            UI.hideTip();
          });
        }
        s.addEventListener('dragover', function (ev) {
          ev.preventDefault();
        });
        s.addEventListener('drop', function (ev) {
          ev.preventDefault();
          const d = UI._drag;
          UI._drag = null;
          if (d && d.from === 'bag') inv.equipToSlot(d.idx, slot);
        });
      });
    },

    _renderStats() {
      const E = UI.els;
      const p = MEO.Inventory.player;
      const s = p.stats;
      const rows = [
        ['Health', Math.round(s.maxHp)],
        [cap(MEO.Abilities.resName(p)), Math.round(s.maxRes)],
        ['Power', Math.round(s.power)],
        ['Armor', Math.round(s.armor)],
        ['Crit', (s.crit * 100).toFixed(1) + ' %'],
        ['Magic Resist', (s.resist * 100).toFixed(1) + ' %']
      ];
      E.stats.textContent = '';
      el('div', 'stat-name', E.stats, p.name + ' · ' + MEO.Classes[p.classId].name + ' · Lv. ' + p.level);
      const g = el('div', 'stat-grid', E.stats);
      rows.forEach(function (r) {
        const c = el('div', 'stat', g);
        el('span', 'k', c, r[0]);
        el('span', 'v', c, String(r[1]));
      });
    },

    _renderBag() {
      const E = UI.els;
      const inv = MEO.Inventory;
      const bag = inv.player.inv.bag;
      E.bag.textContent = '';
      for (let i = 0; i < bag.length; i++) {
        const b = bag[i];
        const s = UI._slotEl(E.bag, b ? b.id : null, b ? b.n : 0);
        (function (idx, slotEl, item) {
          slotEl.addEventListener('dragover', function (ev) {
            ev.preventDefault();
          });
          slotEl.addEventListener('drop', function (ev) {
            ev.preventDefault();
            const d = UI._drag;
            UI._drag = null;
            if (!d) return;
            if (d.from === 'bag') inv.swap(d.idx, idx);
            else if (d.from === 'eq') inv.unequip(d.slot);
          });
          if (!item) return;
          slotEl.draggable = true;
          slotEl.addEventListener('mouseenter', function () {
            UI.showTip(slotEl, item.id, { n: item.n, vendor: !!UI.vendor });
          });
          slotEl.addEventListener('mouseleave', UI.hideTip);
          slotEl.addEventListener('dragstart', function (ev) {
            UI._drag = { from: 'bag', idx: idx };
            ev.dataTransfer.setData('text/plain', 'bag');
            UI.hideTip();
          });
          const act = function (ev) {
            ev.preventDefault();
            UI.hideTip();
            if (UI.vendor) inv.sellAt(idx, ev.shiftKey);
            else inv.useAt(idx);
          };
          slotEl.addEventListener('contextmenu', act);
          slotEl.addEventListener('dblclick', act);
        })(i, s, b);
      }
    },

    _renderLoot(e) {
      const E = UI.els;
      E.loot.hidden = false;
      E.lootTitle.textContent = 'Corpse of ' + e.name;
      E.lootList.textContent = '';
      (e.loot ? e.loot.items : []).forEach(function (r, i) {
        const it = MEO.ITEMS[r.id];
        const row = el('div', 'loot-row', E.lootList);
        const s = UI._slotEl(row, r.id, r.n);
        const nm = el('span', 'loot-name', row, it.name);
        nm.style.color = MEO.QUALITY[it.q].color;
        row.addEventListener('click', function () {
          UI.hideTip();
          MEO.Loot.take(i);
        });
        row.addEventListener('mouseenter', function () {
          UI.showTip(row, r.id, { n: r.n });
        });
        row.addEventListener('mouseleave', UI.hideTip);
      });
    },

    _renderShop() {
      const E = UI.els;
      const inv = MEO.Inventory;
      const stock = MEO.VENDOR_STOCK.brage;
      E.shopList.textContent = '';
      stock.forEach(function (id) {
        const it = MEO.ITEMS[id];
        const row = el('div', 'shop-row', E.shopList);
        UI._slotEl(row, id, 1);
        const mid = el('div', 'shop-mid', row);
        const nm = el('div', 'shop-name', mid, it.name);
        nm.style.color = MEO.QUALITY[it.q].color;
        const cost = inv.buyPrice(id);
        const pr = el('div', 'shop-price', mid, inv.money(cost));
        if (inv.player.inv.gold < cost) pr.classList.add('poor');
        row.addEventListener('click', function (ev) {
          inv.buy(id, ev.shiftKey && it.stack > 1 ? 5 : 1);
        });
        row.addEventListener('mouseenter', function () {
          UI.showTip(row, id, { shop: true });
        });
        row.addEventListener('mouseleave', UI.hideTip);
      });
      let junk = 0;
      inv.player.inv.bag.forEach(function (b) {
        if (b && MEO.ITEMS[b.id].q === 0) junk += MEO.ITEMS[b.id].price * b.n;
      });
      E.shopJunk.textContent = junk > 0 ? 'Sell all junk (' + inv.money(junk) + ')' : 'Sell all junk';
      E.shopJunk.disabled = junk <= 0;
    },

    // ---- Tooltip -----------------------------------------------------------------------
    showTip(anchor, id, o) {
      o = o || {};
      const E = UI.els;
      const it = MEO.ITEMS[id];
      const inv = MEO.Inventory;
      const p = inv.player;
      const q = MEO.QUALITY[it.q];
      E.tip.textContent = '';
      const n = el('div', 'tip-name', E.tip, it.name);
      n.style.color = q.color;
      let meta = q.name;
      if (it.slot) {
        meta += ' · ' + MEO.SLOTS[it.slot].name;
        if (it.armorType) meta += ' · ' + { plate: 'Plate', leather: 'Leather', cloth: 'Cloth' }[it.armorType];
        else if (it.wtype) meta += ' · ' + it.wtype.charAt(0).toUpperCase() + it.wtype.slice(1);
      } else if (it.kind === 'consumable') meta += ' · Consumable';
      else meta += ' · Junk';
      el('div', 'tip-meta', E.tip, meta);

      if (it.lvl && it.slot) el('div', 'tip-meta', E.tip, 'Item level ' + it.lvl);

      if (it.stats) {
        const cur = it.slot && !o.equipped ? MEO.ITEMS[p.inv.equip[it.slot]] : null;
        Object.keys(it.stats).forEach(function (k) {
          const v = it.stats[k];
          const txt = k === 'crit' ? '+' + (v * 100).toFixed(1) + ' % ' + MEO.STAT_NAMES[k] : '+' + v + ' ' + (k === 'maxRes' ? cap(MEO.Abilities.resName(p)) : MEO.STAT_NAMES[k]);
          const row = el('div', 'tip-stat', E.tip, txt);
          if (cur) {
            const d = v - ((cur.stats && cur.stats[k]) || 0);
            if (Math.abs(d) > 1e-9) {
              const ds = el('span', d > 0 ? 'up' : 'down', row, ' (' + (d > 0 ? '+' : '') + (k === 'crit' ? (d * 100).toFixed(1) + ' %' : Math.round(d)) + ')');
              ds.title = 'Compared to what you are wearing';
            }
          }
        });
        // stats lost when swapping
        const cur2 = it.slot && !o.equipped ? MEO.ITEMS[p.inv.equip[it.slot]] : null;
        if (cur2 && cur2.stats) {
          Object.keys(cur2.stats).forEach(function (k) {
            if (it.stats[k] === undefined) {
              const v = cur2.stats[k];
              el('div', 'tip-stat down', E.tip, '(−' + (k === 'crit' ? (v * 100).toFixed(1) + ' %' : v) + ' ' + MEO.STAT_NAMES[k] + ')');
            }
          });
        }
      }
      if (it.use) el('div', 'tip-val', E.tip, 'Use: ' + it.desc);
      else if (it.desc) el('div', 'tip-desc', E.tip, it.desc);

      if (it.slot) {
        const chk = inv.canEquip(id);
        if (!chk.ok) el('div', 'tip-bad', E.tip, chk.reason);
      }
      if (o.shop) el('div', 'tip-price', E.tip, 'Price: ' + inv.money(inv.buyPrice(id)));
      else if (it.price) el('div', 'tip-price', E.tip, 'Sells for: ' + inv.money(it.price * (o.n || 1)) + (o.n > 1 ? ' (' + o.n + ' pcs.)' : ''));

      E.tip.hidden = false;
      const r = anchor.getBoundingClientRect();
      const tr = E.tip.getBoundingClientRect();
      let left = r.left - tr.width - 10;
      if (left < 8) left = Math.min(window.innerWidth - tr.width - 8, r.right + 10);
      E.tip.style.left = left + 'px';
      E.tip.style.top = Math.max(8, Math.min(window.innerHeight - tr.height - 8, r.top)) + 'px';
    },

    hideTip() {
      if (UI.els.tip) UI.els.tip.hidden = true;
    }
  });
})();
