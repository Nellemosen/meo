/* ==========================================================================
   ui/combat-text.js – Floating combat text (damage, heal, status)
   The text is anchored to a point in the 3D world and projected every frame.
   Particles and visual effects live in core/fx3d.js.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const PX = 1 / 16;

  const now = function () {
    return performance.now() / 1000;
  };

  const CT = (MEO.CombatText = {
    texts: [],

    init() {
      Events.on('damage', CT._onDamage);
      Events.on('heal', CT._onHeal);
      Events.on('miss', function (d) {
        CT.text(d.tgt, 'Miss', '#c8c8c8', { size: 13, up: 0.3 });
      });
      Events.on('buff:apply', function (d) {
        const f = d.buff.def.flags;
        if (f && f.length && d.target.type !== 'player') {
          CT.text(d.target, d.buff.def.name, d.buff.def.color, { size: 13, up: 0.6 });
        }
      });
      Events.on('buff:remove', function (d) {
        if (d.reason === 'dispel' && d.target.type === 'player') {
          CT.text(d.target, d.buff.def.name + ' removed', '#e8f4ff', { size: 13, up: 0.4 });
        }
      });
      Events.on('cast:stop', function (d) {
        if (d.interrupted && !d.silent && d.entity.type === 'player') {
          CT.text(d.entity, d.reason || 'Interrupted', '#ffb0a0', { size: 13, up: 0.5 });
        }
      });
    },

    /** Text above an entity. o: size, crit, dx (px), up (extra height in meters), life. */
    text(ent, str, color, o) {
      o = o || {};
      if (MEO.Settings && !MEO.Settings.get('game.combatText')) return;
      const T = MEO.Terrain;
      const H = MEO.Models ? MEO.Models.heightOf(ent) : 1.9;
      const x = ent._rx !== undefined ? ent._rx : ent.x * PX;
      const z = ent._rz !== undefined ? ent._rz : ent.y * PX;
      const y = (ent._ry !== undefined ? ent._ry : T.heightAt(ent.x, ent.y)) + H * 0.85 + (o.up || 0);
      CT.texts.push({
        x: x, y: y, z: z, dx: o.dx != null ? o.dx : (Math.random() - 0.5) * 36,
        str: str, color: color, size: o.size || 15, crit: !!o.crit, t0: now(), life: o.life || 1.15
      });
      if (CT.texts.length > 80) CT.texts.shift();
    },

    _onDamage(d) {
      const tgt = d.tgt;
      const school = MEO.SCHOOLS[d.school] || MEO.SCHOOLS.physical;
      const incoming = tgt.type === 'player' || tgt.type === 'party';
      const ally = !incoming && d.src && d.src.type === 'party';
      if (d.amount > 0) {
        const str = (incoming ? '-' : '') + d.amount + (d.crit ? '!' : '');
        CT.text(tgt, str, incoming ? '#ff6a5a' : school.color, {
          size: d.crit ? (ally ? 18 : 25) : d.dot ? 12 : ally ? 13 : 17,
          crit: d.crit && !ally,
          dx: incoming ? -30 : (Math.random() - 0.5) * 36
        });
      }
      if (d.absorbed > 0) CT.text(tgt, '(' + Math.round(d.absorbed) + ' absorbed)', '#9ec8ff', { size: 12, dx: 0, up: -0.1 });
    },

    _onHeal(d) {
      if (d.effective <= 0 && !d.crit) return;
      CT.text(d.tgt, '+' + d.effective + (d.crit ? '!' : ''), '#6fe07a', {
        size: d.crit ? 24 : d.hot ? 13 : 17,
        crit: d.crit
      });
    },

    // ---- Drawing (called by the renderer with the 2D overlay, screen coordinates) ---------------------
    draw(ctx) {
      const t = now();
      const R = MEO.Renderer;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      for (let i = CT.texts.length - 1; i >= 0; i--) {
        const f = CT.texts[i];
        const age = t - f.t0;
        if (age >= f.life) {
          CT.texts.splice(i, 1);
          continue;
        }
        const p = age / f.life;
        const rise = 56 * (1 - Math.pow(1 - p, 2));
        const pop = f.crit ? 1 + 0.4 * Math.max(0, 1 - p * 5) : 1;
        const s = R.projectWorld(f.x, f.y, f.z);
        if (!s.visible) continue;
        ctx.globalAlpha = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
        ctx.font = '700 ' + Math.round(f.size * pop) + 'px Georgia, serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.88)';
        ctx.strokeText(f.str, s.x + f.dx, s.y - rise);
        ctx.fillStyle = f.color;
        ctx.fillText(f.str, s.x + f.dx, s.y - rise);
      }
      ctx.globalAlpha = 1;
    }
  });
})();
