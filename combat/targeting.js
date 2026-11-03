/* ==========================================================================
   combat/targeting.js – Tab targeting, click targeting, self-target and target-of-target
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;

  const Targeting = (MEO.Targeting = {
    TAB_RANGE: 700,
    owner: null,
    target: null,

    init(owner) {
      Targeting.owner = owner;
      Targeting.target = null;
      owner.target = null;

      Events.on('entity:remove', function (e) {
        if (Targeting.target === e) Targeting.clear();
      });
    },

    set(e) {
      if (e === Targeting.target) return;
      const prev = Targeting.target;
      Targeting.target = e || null;
      Targeting.owner.target = Targeting.target;
      Events.emit('target:change', { target: Targeting.target, prev: prev });
    },

    clear() {
      Targeting.set(null);
    },

    selectSelf() {
      Targeting.set(Targeting.owner);
    },

    _onScreen(e) {
      const R = MEO.Renderer;
      const s = R.project(e.x, e.y, 1.2);
      return s.visible && s.x > -20 && s.y > -20 && s.x < R.viewW + 20 && s.y < R.viewH + 20;
    },

    /** Tab / Shift+Tab: cycle through enemies on screen, nearest in front of the player first. */
    cycle(dir) {
      const p = Targeting.owner;
      const C = MEO.Combat;
      const cands = [];
      const list = MEO.Entities.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !C.isEnemy(p, e)) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > Targeting.TAB_RANGE || !Targeting._onScreen(e)) continue;
        const yaw = MEO.Renderer.camera ? MEO.Renderer.camera.yaw : p.facing;
        const diff = Math.cos(Math.atan2(dy, dx) - yaw);
        const score = d * (1 + 0.5 * (1 - diff) / 2);
        cands.push({ e: e, score: score });
      }
      if (!cands.length) return null;
      cands.sort(function (a, b) {
        return a.score - b.score;
      });
      const idx = cands.findIndex(function (c) {
        return c.e === Targeting.target;
      });
      let next;
      if (idx < 0) next = dir > 0 ? 0 : cands.length - 1;
      else next = (idx + dir + cands.length) % cands.length;
      Targeting.set(cands[next].e);
      return cands[next].e;
    },

    /** Find the entity under the mouse (screen coordinates): ray against the 3D figures. */
    pick(sx, sy) {
      return MEO.Renderer.pickEntity(sx, sy);
    },

    click(sx, sy) {
      const e = Targeting.pick(sx, sy);
      if (e) Targeting.set(e);
      return e;
    },

    /** Who is attacking the target? */
    targetOfTarget() {
      const t = Targeting.target;
      if (!t || !t.alive) return null;
      if (t.type === 'mob') return MEO.Threat.victim(t);
      return t.target || null;
    }
  });
})();
