/* ==========================================================================
   core/kit-cave.js – Khazad-dûm built from the Mines and Cave Modular Set (CC0, loafbrr).
   In a zone marked `theme.cave` the blocky rock walls are replaced with real cave and mine
   walls, timber supports, pillars, rails and mine carts. Everything is instanced, so a hall
   of a thousand wall faces costs a handful of draw calls.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3) return;
  const TM = 2;                 // metres per tile
  const WALL_H = 4.1;           // how tall the cave walls stand

  const WALLS = ['Wall_Mines_A', 'Wall_Mines_B', 'Wall_Mines_C', 'Wall_Mines_D',
                 'Wall_Caves_A', 'Wall_Caves_B', 'Wall_Caves_C', 'Wall_Caves_D'];
  const PILLARS = ['Cave_Pillar_A', 'Cave_Pillar_B', 'Cave_Pillar_C'];
  const ROCKS = ['Cave_Rocks_A', 'Cave_Rocks_B', 'Cave_Rocks_C', 'Cave_Rocks_D'];

  const KC = (MEO.KitCave = {
    src: null,
    group: null,
    _box: {},

    ready() {
      if (KC.src) return true;
      const m = MEO.Assets && MEO.Assets.models && MEO.Assets.models.mine_kit;
      if (!m) return false;
      KC.src = m.scene;
      return true;
    },

    /** On only in cave zones, with the three.js renderer and the setting enabled. */
    on(world) {
      const w = world || (MEO.Renderer && MEO.Renderer.world);
      if (!w || !w.theme || !w.theme.cave) return false;
      const S = MEO.Settings;
      if (S && S.get('gfx.engine') === 'classic') return false;
      if (!S || !S.get('gfx.kitCave')) return false;
      return KC.ready();
    },

    piece(name) { return KC.ready() ? (KC.src.getObjectByName(name) || null) : null; },

    /** The piece's meshes in its own local space, plus its local bounding box (cached). */
    parts(name) {
      if (KC._box[name]) return KC._box[name];
      const src = KC.piece(name);
      if (!src) return null;
      src.updateMatrixWorld(true);
      const inv = new T3.Matrix4().copy(src.matrixWorld).invert();
      const list = [];
      const bb = new T3.Box3();
      src.traverse(function (n) {
        if (!n.isMesh) return;
        const l = new T3.Matrix4().multiplyMatrices(inv, n.matrixWorld);
        if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
        bb.union(n.geometry.boundingBox.clone().applyMatrix4(l));
        list.push({ g: n.geometry, m: n.material, l: l });
      });
      KC._box[name] = { parts: list, bb: bb, size: bb.getSize(new T3.Vector3()) };
      return KC._box[name];
    },

    size(name) {
      const p = KC.parts(name);
      return p ? p.size : null;
    },

    /** Instance `name` at every transform in `list` ([{x,y,z,rot,sx,sy,sz}]). */
    _instance(grp, name, list) {
      const P = KC.parts(name);
      if (!P || !list.length) return;
      // pieces sit wherever they were modelled: recentre on x/z, base on y
      const c = P.bb.getCenter(new T3.Vector3());
      const centre = new T3.Matrix4().makeTranslation(-c.x, -P.bb.min.y, -c.z);
      const up = new T3.Vector3(0, 1, 0);
      P.parts.forEach(function (part) {
        const im = new T3.InstancedMesh(part.g, part.m, list.length);
        im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
        const q = new T3.Quaternion();
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          q.setFromAxisAngle(up, t.rot || 0);
          const world = new T3.Matrix4().compose(
            new T3.Vector3(t.x, t.y, t.z), q, new T3.Vector3(t.sx || 1, t.sy || 1, t.sz || 1));
          im.setMatrixAt(i, world.multiply(centre).multiply(part.l));
        }
        im.instanceMatrix.needsUpdate = true;
        grp.add(im);
      });
    },

    build(world, parent, heightAt) {
      KC.clear();
      if (!KC.on(world)) return;
      const grp = new T3.Group();
      parent.add(grp);
      KC.group = grp;
      const ID = MEO.TILE_ID;
      const rnd = function (n) { const s = Math.sin(n * 53.17) * 43758.5453; return s - Math.floor(s); };
      const solid = function (tx, ty) {
        if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
        const id = world.get(tx, ty);
        return id === ID.WALL || id === ID.ROCK;
      };

      const byName = {};
      const add = function (name, t) { (byName[name] || (byName[name] = [])).push(t); };
      const posts = [];
      const beams = [];

      // one wall panel on every rock face that looks out onto walkable ground
      const faces = [[0, -1, Math.PI], [0, 1, 0], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2]];
      for (let ty = 0; ty < world.h; ty++) {
        for (let tx = 0; tx < world.w; tx++) {
          if (!solid(tx, ty)) continue;
          for (let f = 0; f < 4; f++) {
            const nx = tx + faces[f][0], ny = ty + faces[f][1];
            if (solid(nx, ny)) continue;
            const cx = (tx + 0.5) * TM + faces[f][0] * TM / 2;
            const cz = (ty + 0.5) * TM + faces[f][1] * TM / 2;
            const y = heightAt(cx, cz);
            const r = rnd(tx * 31 + ty * 7 + f);
            const name = WALLS[Math.floor(r * 997) % WALLS.length];
            const sz = KC.size(name);
            if (!sz) continue;
            add(name, {
              x: cx, y: y - 0.25, z: cz, rot: faces[f][2],
              sx: (TM + 0.25) / sz.x, sy: WALL_H / sz.y, sz: 1
            });
          }
          // timber supports across the corridors, now and then
          if (rnd(tx * 13 + ty * 29) > 0.93) {
            const cx = (tx + 0.5) * TM, cz = (ty + 0.5) * TM;
            const open = !solid(tx - 1, ty) && !solid(tx + 1, ty);
            const y = heightAt(cx, cz);
            const rot = open ? 0 : Math.PI / 2;
            const dx = open ? TM : 0, dz = open ? 0 : TM;
            posts.push({ x: cx - dx, y: y, z: cz - dz, rot: rot, sy: WALL_H / 3.8 });
            posts.push({ x: cx + dx, y: y, z: cz + dz, rot: rot, sy: WALL_H / 3.8 });
            beams.push({ x: cx, y: y + WALL_H - 0.3, z: cz, rot: rot, sx: (2 * TM + 0.6) / 4 });
          }
        }
      }

      // pillars and rubble in the open halls
      for (let ty = 2; ty < world.h - 2; ty += 3) {
        for (let tx = 2; tx < world.w - 2; tx += 3) {
          if (solid(tx, ty)) continue;
          const r = rnd(tx * 7 + ty * 91);
          const cx = (tx + 0.5) * TM, cz = (ty + 0.5) * TM;
          let openAround = true;
          for (let k = 0; k < 4 && openAround; k++) openAround = !solid(tx + faces[k][0] * 2, ty + faces[k][1] * 2);
          if (openAround && r > 0.93) {
            const name = PILLARS[Math.floor(r * 331) % PILLARS.length];
            const psz = KC.size(name);
            const h = psz ? psz.y : 5.24;
            add(name, { x: cx, y: heightAt(cx, cz), z: cz, rot: r * 6.28, sy: (WALL_H + 0.6) / h });
          } else if (r < 0.06) {
            add(ROCKS[Math.floor(r * 1711) % ROCKS.length], { x: cx, y: heightAt(cx, cz), z: cz, rot: r * 31 });
          }
        }
      }

      // a rock ceiling, so looking up shows stone instead of sky
      const cw = world.w * TM, cd = world.h * TM;
      const ceil = new T3.Mesh(
        new T3.PlaneGeometry(cw * 1.4, cd * 1.4),
        new T3.MeshStandardMaterial({ color: 0x24242c, roughness: 1, metalness: 0, side: T3.DoubleSide })
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(cw / 2, heightAt(cw / 2, cd / 2) + WALL_H + 1.6, cd / 2);
      ceil.receiveShadow = false;
      ceil.frustumCulled = false;
      grp.add(ceil);

      Object.keys(byName).forEach(function (n) { KC._instance(grp, n, byName[n]); });
      KC._instance(grp, 'Post_Reinforced_A', posts);
      KC._instance(grp, 'Beam_A', beams);
    },

    clear() {
      if (KC.group && KC.group.parent) KC.group.parent.remove(KC.group);
      KC.group = null;
    }
  });
})();
