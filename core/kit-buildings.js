/* ==========================================================================
   core/kit-buildings.js – Real houses built from the Quaternius Medieval Village
   MegaKit (CC0). Each building in world.buildings is assembled from modular glTF
   pieces: wall modules (2 m wide, 3.12 m tall), corner posts, a door, windows,
   a tiled roof and a chimney. Used only by the three.js renderer; the classic
   renderer keeps the procedural houses.
   The kit lives in assets/models/village_kit.glb (packed into assets/models.js).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3) return;

  const WALL_W = 2.0;        // one module = one world tile
  const WALL_H = 3.12;
  const TM = 2;              // meters per tile

  const WALLS = ['Wall_Plaster_Straight', 'Wall_Plaster_WoodGrid', 'Wall_UnevenBrick_Straight'];
  const WINDOWS = ['Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Window_Thin_Round', 'Wall_Plaster_Window_Wide_Flat', 'Wall_UnevenBrick_Window_Wide_Round'];
  const ROOFS = ['Roof_RoundTiles_4x4', 'Roof_RoundTiles_4x6', 'Roof_RoundTiles_4x8', 'Roof_RoundTiles_6x4', 'Roof_RoundTiles_6x6', 'Roof_RoundTiles_6x8', 'Roof_RoundTiles_6x10', 'Roof_RoundTiles_6x12', 'Roof_RoundTiles_6x14', 'Roof_RoundTiles_8x8', 'Roof_RoundTiles_8x10', 'Roof_RoundTiles_8x12', 'Roof_RoundTiles_8x14'];

  const Kit = (MEO.Kit = {
    src: null,          // the loaded glTF scene
    _box: {},           // piece name -> THREE.Box3 (local)
    group: null,        // current house group in the scene
    roofs: [],          // { obj, index } so roofs can fade like the procedural ones

    /** Is the kit available (loaded) right now? */
    ready() {
      if (Kit.src) return true;
      const m = MEO.Assets && MEO.Assets.models && MEO.Assets.models.village_kit;
      if (!m) return false;
      Kit.src = m.scene;
      return true;
    },

    /** Kit houses are used when the three.js renderer is on and the kit is loaded. */
    on() {
      const S = MEO.Settings;
      if (S && S.get('gfx.engine') === 'classic') return false;
      if (S && !S.get('gfx.kitHouses')) return false;
      return Kit.ready();
    },

    piece(name) {
      if (!Kit.ready()) return null;
      return Kit.src.getObjectByName(name) || null;
    },

    bounds(name) {
      if (Kit._box[name]) return Kit._box[name];
      const p = Kit.piece(name);
      if (!p) return null;
      p.updateMatrixWorld(true);
      const b = new T3.Box3().setFromObject(p);
      Kit._box[name] = b;
      return b;
    },

    /** A positioned clone of a kit piece. */
    place(name, parent, x, y, z, rotY, scale) {
      const src = Kit.piece(name);
      if (!src) return null;
      const o = src.clone(true);
      o.position.set(x, y, z);
      o.rotation.set(0, rotY || 0, 0);
      if (scale) o.scale.set(scale[0], scale[1], scale[2]);
      o.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      parent.add(o);
      return o;
    },

    // ------------------------------------------------------------------
    /** Build every house of the current world into `parent` (a THREE.Group). */
    build(world, parent, heightAt) {
      Kit.roofs = [];
      if (!Kit.on() || !world || !world.buildings) return;
      const grp = new T3.Group();
      parent.add(grp);
      Kit.group = grp;
      const rnd = function (n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

      world.buildings.forEach(function (b, i) {
        const x0 = b.x * TM, z0 = b.y * TM;
        const x1 = (b.x + b.w) * TM, z1 = (b.y + b.h) * TM;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const y = heightAt(cx, cz);
        const house = new T3.Group();
        house.position.set(0, 0, 0);
        grp.add(house);

        const brick = rnd(i * 7 + 1) > 0.65;
        const wallName = brick ? 'Wall_UnevenBrick_Straight' : WALLS[Math.floor(rnd(i * 3 + 2) * 2)];
        const winName = brick ? 'Wall_UnevenBrick_Window_Wide_Round' : WINDOWS[Math.floor(rnd(i * 5 + 3) * 3)];

        // ---- walls: one module per tile along each side, facing outward ----
        // sides: [normal x, normal z, along x, along z, count, fixed coordinate]
        const sides = [
          { nx: 0, nz: 1, count: b.w, rot: 0, at: function (k) { return [x0 + (k + 0.5) * WALL_W, z1]; } },          // south
          { nx: 0, nz: -1, count: b.w, rot: Math.PI, at: function (k) { return [x0 + (k + 0.5) * WALL_W, z0]; } },   // north
          { nx: -1, nz: 0, count: b.h, rot: -Math.PI / 2, at: function (k) { return [x0, z0 + (k + 0.5) * WALL_W]; } }, // west
          { nx: 1, nz: 0, count: b.h, rot: Math.PI / 2, at: function (k) { return [x1, z0 + (k + 0.5) * WALL_W]; } }  // east
        ];
        const doorK = b.doorX - b.x;   // module index of the door on the south side
        sides.forEach(function (s, si) {
          for (let k = 0; k < s.count; k++) {
            const p = s.at(k);
            let name = wallName;
            if (si === 0 && k === doorK) name = brick ? 'Wall_UnevenBrick_Door_Round' : 'Wall_Plaster_Door_Round';
            else if (rnd(i * 31 + si * 7 + k) > 0.45) name = winName;
            Kit.place(name, house, p[0], y, p[1], s.rot);
            if (si === 0 && k === doorK) Kit.place('Door_2_Round', house, p[0] - 0.56, y + 0.02, p[1] + 0.06, s.rot);
          }
        });

        // ---- corner posts ----
        [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(function (c) {
          Kit.place('Corner_Exterior_Wood', house, c[0], y, c[1], 0);
        });

        // ---- roof: the closest kit roof, scaled onto the footprint ----
        const w = x1 - x0, d = z1 - z0;
        let best = null, bestErr = 1e9;
        ROOFS.forEach(function (name) {
          const bb = Kit.bounds(name);
          if (!bb) return;
          const sz = bb.getSize(new T3.Vector3());
          // prefer a roof whose own footprint is closest to the house: less distortion when scaled
          const err = Math.abs(sz.x - w) + Math.abs(sz.z - d);
          if (err < bestErr) { bestErr = err; best = { name: name, sz: sz, bb: bb }; }
        });
        if (best) {
          const over = 0.35;                                  // eaves
          const sx = (w + over) / best.sz.x;
          const sz = (d + over) / best.sz.z;
          const sy = (2.4 + 0.13 * Math.min(w, d)) / best.sz.y;   // keep the pitch cottage-like
          const roof = Kit.place(best.name, house, cx, y + WALL_H - 0.18, cz, 0, [sx, sy, sz]);
          if (roof) {
            // the kit roof is modelled around its own centre: shift it onto the footprint centre
            const c = best.bb.getCenter(new T3.Vector3());
            roof.position.x -= c.x * sx;
            roof.position.z -= c.z * sz;
            roof.position.y -= best.bb.min.y * sy;
            Kit.roofs.push({ obj: roof, index: i });
          }
          Kit.place('Prop_Chimney', house, x0 + 1.4, y + WALL_H - 0.2, z0 + 1.4, 0);
        }
      });
    },

    clear(parent) {
      if (Kit.group && Kit.group.parent) Kit.group.parent.remove(Kit.group);
      Kit.group = null;
      Kit.roofs = [];
      void parent;
    }
  });
})();
