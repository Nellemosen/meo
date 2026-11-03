/* ==========================================================================
   core/kit-nature.js – Trees, rocks and bushes from the KayKit Forest Nature Pack (CC0).
   Terrain records where it would have drawn a procedural tree or rock (Terrain.natureSpots)
   and skips its own geometry; this module draws real models there instead.
   Everything is drawn with InstancedMesh, so a forest of 400 trees costs a handful of
   draw calls rather than 400.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3) return;

  const TREES = ['Tree_1_A', 'Tree_1_B', 'Tree_1_C', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C', 'Tree_2_D',
                 'Tree_3_A', 'Tree_3_B', 'Tree_3_C', 'Tree_4_A', 'Tree_4_B', 'Tree_4_C'];
  const BARE = ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_C'];
  const ROCKS = ['Rock_1_A', 'Rock_1_D', 'Rock_1_H', 'Rock_1_K', 'Rock_2_A', 'Rock_2_C', 'Rock_2_F',
                 'Rock_3_A', 'Rock_3_E', 'Rock_3_J', 'Rock_3_N'];
  const BUSHES = ['Bush_1_A', 'Bush_1_D', 'Bush_2_B', 'Bush_3_A', 'Bush_4_C'];
  const SUFFIX = '_Color1';          // the free pack ships one colour variation

  const KN = (MEO.KitNature = {
    src: null,
    group: null,
    _h: {},          // piece name -> natural height

    ready() {
      if (KN.src) return true;
      const m = MEO.Assets && MEO.Assets.models && MEO.Assets.models.nature_kit;
      if (!m) return false;
      KN.src = m.scene;
      return true;
    },

    on() {
      const w = MEO.Renderer && MEO.Renderer.world;
      if (w && w.theme && w.theme.cave) return false;      // underground: core/kit-cave.js dresses it
      const S = MEO.Settings;
      if (S && S.get('gfx.engine') === 'classic') return false;
      if (S && !S.get('gfx.kitNature')) return false;
      return KN.ready();
    },

    piece(name) { return KN.ready() ? (KN.src.getObjectByName(name + SUFFIX) || KN.src.getObjectByName(name) || null) : null; },

    height(name) {
      if (KN._h[name] != null) return KN._h[name];
      const p = KN.piece(name);
      if (!p) return (KN._h[name] = 0);
      p.updateMatrixWorld(true);
      const b = new T3.Box3().setFromObject(p);
      KN._h[name] = Math.max(0.01, b.max.y - b.min.y);
      return KN._h[name];
    },

    /** Build instanced trees and rocks from the spots terrain recorded. */
    build(parent) {
      KN.clear();
      if (!KN.on()) return;
      const spots = (MEO.Terrain && MEO.Terrain.natureSpots) || [];
      if (!spots.length) return;
      const grp = new T3.Group();
      parent.add(grp);
      KN.group = grp;

      // 1) decide a model and a transform for every spot, grouped by model
      const ash = !!(MEO.Renderer.world && MEO.Renderer.world.theme && MEO.Renderer.world.theme.ash);
      const byName = {};
      const m4 = new T3.Matrix4();
      const q = new T3.Quaternion();
      const pos = new T3.Vector3();
      const scl = new T3.Vector3();
      spots.forEach(function (s) {
        let set, target;
        if (s.k === 'tree') {
          set = (ash || s.v2 > 0.93) ? BARE : TREES;   // burnt country: nothing green is left
          target = (ash ? 2.4 : 3.0) * s.s;
        } else if (s.k === 'rock') {
          set = ROCKS;
          target = 1.0 * s.s;
        } else {
          set = BUSHES;
          target = 0.9 * s.s;
        }
        const name = set[Math.floor(s.v * 997) % set.length];
        const nh = KN.height(name);
        if (!nh) return;
        const k = target / nh;
        pos.set(s.x, s.y, s.z);
        q.setFromAxisAngle(new T3.Vector3(0, 1, 0), s.rot);
        scl.set(k, k, k);
        (byName[name] || (byName[name] = [])).push(new T3.Matrix4().compose(pos, q, scl));
      });
      void m4;

      // 2) one InstancedMesh per (model part), carrying the part's own local transform
      Object.keys(byName).forEach(function (name) {
        const src = KN.piece(name);
        const mats = byName[name];
        if (!src) return;
        src.updateMatrixWorld(true);
        const inv = new T3.Matrix4().copy(src.matrixWorld).invert();
        src.traverse(function (n) {
          if (!n.isMesh) return;
          const local = new T3.Matrix4().multiplyMatrices(inv, n.matrixWorld);
          const im = new T3.InstancedMesh(n.geometry, n.material, mats.length);
          im.castShadow = true;
          im.receiveShadow = true;
          im.frustumCulled = false;
          for (let i = 0; i < mats.length; i++) {
            im.setMatrixAt(i, new T3.Matrix4().multiplyMatrices(mats[i], local));
          }
          im.instanceMatrix.needsUpdate = true;
          grp.add(im);
        });
      });
    },

    clear() {
      if (KN.group && KN.group.parent) KN.group.parent.remove(KN.group);
      KN.group = null;
    }
  });
})();
