/* ==========================================================================
   ai/spawner.js – Places enemy groups in the world based on data/spawns.js
   Picks walkable tiles outside the town, with spacing between the members.
   Respawn happens in Game._onDeath (same place every time, mobs' 'home').
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  const OK_TILES = { grass: 1, path: 1, sand: 1, floor: 1 };

  const Spawner = (MEO.Spawner = {
    placed: 0,
    skipped: 0,

    _free(world, tx, ty) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = MEO.TILES[world.get(tx + dx, ty + dy)];
          if (!t || t.solid) return false;
        }
      }
      const t0 = MEO.TILES[world.get(tx, ty)];
      if (!OK_TILES[t0.key]) return false;
      const a = world.areaAt(tx, ty);
      if (a && a.kind === 'town') return false;
      // keep a safe buffer around towns, portals and zone entries
      const areas = world.areas || [];
      for (let i = 0; i < areas.length; i++) {
        const r = areas[i];
        if (r.kind !== 'town' && r.kind !== 'portal') continue;
        const m = r.kind === 'portal' ? 3 : 3;
        if (tx >= r.x - m && tx <= r.x + r.w + m && ty >= r.y - m && ty <= r.y + r.h + m) return false;
      }
      return true;
    },

    /** Spawn all groups. Uses its own deterministic random seed. */
    populate(world, groups) {
      const T = world.tile;
      const rng = MEO.util.mulberry32(C_SEED());
      const taken = [];
      MEO.Entities.list.forEach(function (e) {
        taken.push({ x: e.x, y: e.y });
      });

      (groups || []).forEach(function (g) {
        g.mobs.forEach(function (m) {
          for (let k = 0; k < m.n; k++) {
            let placed = false;
            for (let tries = 0; tries < 80 && !placed; tries++) {
              const a = rng() * Math.PI * 2;
              const r = Math.sqrt(rng()) * g.r;
              const tx = Math.round(g.at[0] + Math.cos(a) * r);
              const ty = Math.round(g.at[1] + Math.sin(a) * r);
              if (!Spawner._free(world, tx, ty)) continue;
              const px = (tx + 0.5) * T + (rng() - 0.5) * T * 0.5;
              const py = (ty + 0.5) * T + (rng() - 0.5) * T * 0.5;
              let close = false;
              for (let i = 0; i < taken.length; i++) {
                if (Math.hypot(taken[i].x - px, taken[i].y - py) < T * 1.6) {
                  close = true;
                  break;
                }
              }
              if (close) continue;
              taken.push({ x: px, y: py });
              MEO.Game.spawnMob(m.mob, px, py, g.name);
              Spawner.placed++;
              placed = true;
            }
            if (!placed) {
              Spawner.skipped++;
              console.warn('[Spawner] Could not place ' + m.mob + ' at ' + g.name);
            }
          }
        });
      });
    }
  });

  function C_SEED() {
    return (MEO.CONFIG.WORLD_SEED ^ 0x5eed) >>> 0;
  }
})();
