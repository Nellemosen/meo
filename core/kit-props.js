/* ==========================================================================
   core/kit-props.js – Real props from the Quaternius Fantasy Props MegaKit (CC0).
   Replaces the procedural barrels, crates, banners, lanterns, market stalls and house
   furniture with glTF models when the three.js renderer is on. Terrain skips its own
   versions of these (see MEO.KitProps.on() checks in core/terrain.js).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3) return;
  const TM = 2;             // metres per tile

  // world prop kind -> kit piece (+ y offset and a random yaw spread)
  const BY_KIND = {
    barrel: 'Barrel',
    crate: 'Crate_Wooden',
    lantern: 'Torch_Metal',
    banner: 'Banner_1'
  };

  const KP = (MEO.KitProps = {
    src: null,
    group: null,
    _box: {},

    ready() {
      if (KP.src) return true;
      const m = MEO.Assets && MEO.Assets.models && MEO.Assets.models.props_kit;
      if (!m) return false;
      KP.src = m.scene;
      return true;
    },

    on() {
      const S = MEO.Settings;
      if (S && S.get('gfx.engine') === 'classic') return false;
      if (S && !S.get('gfx.kitProps')) return false;
      return KP.ready();
    },

    piece(name) { return KP.ready() ? (KP.src.getObjectByName(name) || null) : null; },

    bounds(name) {
      if (KP._box[name]) return KP._box[name];
      const p = KP.piece(name);
      if (!p) return null;
      p.updateMatrixWorld(true);
      KP._box[name] = new T3.Box3().setFromObject(p);
      return KP._box[name];
    },

    /** Place a piece with its base on the ground at (x, y, z). */
    place(parent, name, x, y, z, rotY, scale) {
      const src = KP.piece(name);
      if (!src) return null;
      const bb = KP.bounds(name);
      const o = src.clone(true);
      const s = scale || 1;
      o.scale.setScalar(s);
      o.position.set(x, y - (bb ? bb.min.y * s : 0), z);
      o.rotation.y = rotY || 0;
      o.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      parent.add(o);
      return o;
    },

    /** Build all kit props for the current world. */
    build(world, parent, heightAt) {
      if (!KP.on() || !world) return;
      const grp = new T3.Group();
      parent.add(grp);
      KP.group = grp;
      const rnd = function (n) { const s = Math.sin(n * 91.37) * 43758.5453; return s - Math.floor(s); };

      // ---- props placed by zone data ----
      (world.props || []).forEach(function (p, n) {
        const name = BY_KIND[p.kind];
        if (!name) return;
        const x = (p.tx + 0.5) * TM + (p.dx || 0);
        const z = (p.ty + 0.5) * TM + (p.dz || 0);
        KP.place(grp, name, x, heightAt(x, z), z, rnd(n) * Math.PI * 2);
      });

      // ---- house furniture ----
      (world.buildings || []).forEach(function (b, i) {
        const x0 = b.x * TM, z0 = b.y * TM, x1 = (b.x + b.w) * TM;
        const y = heightAt((x0 + x1) / 2, z0 + TM * 2);
        const f = [
          ['Bed_Twin1', x0 + 2.2, z0 + TM + 1.4, 0],
          ['Table_Large', x0 + 6.0, z0 + TM + 2.0, Math.PI / 2],
          ['Stool', x0 + 5.1, z0 + TM + 2.0, 0],
          ['Stool', x0 + 6.9, z0 + TM + 2.0, Math.PI],
          ['Chest_Wood', x1 - TM - 0.7, z0 + TM + 0.6, Math.PI],
          ['Barrel', x0 + 1.2, z0 + TM + 3.4, 0],
          ['CandleStick', x0 + 6.0, z0 + TM + 2.0, 0]
        ];
        f.forEach(function (t, k) {
          const yy = t[0] === 'CandleStick' ? y + 0.81 : y;    // on the table top
          KP.place(grp, t[0], t[1], yy, t[2], t[3] + (k === 0 ? 0 : rnd(i * 9 + k) * 0.2 - 0.1));
        });
      });

      // ---- market stalls and a smithy in the village square ----
      const v = world.areaById && (world.areaById.village || world.areaById.compound);
      if (v) {
        const sx = (v.x + v.w / 2) * TM, sz = (v.y + v.h / 2) * TM;
        const set = [
          ['Stall_Empty', -4.5, -2.0, 0.3], ['Stall_Cart_Empty', 4.2, -1.4, -0.5],
          ['FarmCrate_Apple', -3.2, -0.9, 0.8], ['FarmCrate_Carrot', -2.5, -0.6, 0.2],
          ['Anvil_Log', 5.4, 2.6, 1.1], ['Workbench', 6.6, 3.6, 0.4],
          ['WeaponStand', -6.0, 2.2, -0.3], ['Bench', 0.5, 4.2, 0]
        ];
        set.forEach(function (t) {
          const x = sx + t[1], z = sz + t[2];
          KP.place(grp, t[0], x, heightAt(x, z), z, t[3]);
        });
      }
    },

    clear() {
      if (KP.group && KP.group.parent) KP.group.parent.remove(KP.group);
      KP.group = null;
    }
  });
})();
