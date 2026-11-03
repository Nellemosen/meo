/* ==========================================================================
   core/assets.js – glTF model layer for the three.js renderer.
   Put .glb files in assets/models/, run `node tools/pack-assets.js`, and map them in
   data/asset-map.js (MEO.ASSET_MAP). Entities with a mapped, loaded model are drawn from
   the glTF (with animations: idle / walk / run / attack / death by clip name) instead of the
   procedural rig. Everything else keeps working unchanged.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3 || !T3.GLTFLoader) return;

  const Assets = (MEO.Assets = {
    models: {},            // id -> { scene, clips }
    ready: false,
    _used: [],
    _prev: [],

    load() {
      const b64 = MEO.ASSET_B64 || {};
      const loader = new T3.GLTFLoader();
      Object.keys(b64).forEach(function (id) {
        const bin = atob(b64[id]);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        loader.parse(buf.buffer, '', function (g) {
          g.scene.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
          Assets.models[id] = { scene: g.scene, clips: g.animations || [] };
        }, function (err) { console.warn('[Assets] could not parse ' + id, err); });
      });
      Assets.ready = true;
    },

    /** Which model id (if any) replaces this entity? data/asset-map.js: MEO.ASSET_MAP.{mob|npc|class|race} */
    modelFor(e) {
      const M = MEO.ASSET_MAP;
      if (!M) return null;
      let id = null;
      if (e.type === 'mob') id = (M.mob && (M.mob[e.mobId] || M.mob[e.shape])) || null;
      else if (e.type === 'npc') id = (M.npc && M.npc[e.npcId]) || null;
      else id = (M.class && M.class[e.classId]) || (M.race && M.race[e.raceId]) || null;
      return id && Assets.models[id] ? id : null;
    },

    _clip(inst, kind) {
      const names = { idle: /idle|survey|stand/i, walk: /walk/i, run: /run|gallop/i, attack: /attack|strike|bite/i, death: /death|die/i };
      const re = names[kind];
      return inst.clips.filter(function (c) { return re.test(c.name); })[0] || null;
    },

    drawEntity(e, x, y, z, time, Three) {
      if (!Assets.ready) Assets.load();
      const id = Assets.modelFor(e);
      if (!id) return false;
      let inst = e._glb;
      if (!inst || inst.id !== id) {
        const src = Assets.models[id];
        const root = T3.SkeletonUtils ? T3.SkeletonUtils.clone(src.scene) : src.scene.clone(true);
        const sc = (MEO.ASSET_SCALE && MEO.ASSET_SCALE[id]) || 1;
        root.scale.setScalar(sc);
        const wrap = new T3.Group();
        wrap.add(root);
        Three._entGroup.add(wrap);
        inst = e._glb = { id: id, wrap: wrap, mixer: new T3.AnimationMixer(root), clips: src.clips, action: null, kind: '', last: time };
      }
      const moving = e.moving && e.alive;
      const kind = !e.alive ? 'death' : moving ? (MEO.Engine.time - (e.lastRun || 0) < 1 ? 'run' : 'walk') : 'idle';
      if (kind !== inst.kind) {
        const clip = Assets._clip(inst, kind) || Assets._clip(inst, 'idle') || inst.clips[0];
        if (clip) {
          const next = inst.mixer.clipAction(clip);
          next.reset().play();
          if (inst.action && inst.action !== next) inst.action.crossFadeTo(next, 0.2, false);
          inst.action = next;
        }
        inst.kind = kind;
      }
      inst.mixer.update(Math.min(0.1, Math.max(0, time - inst.last)));
      inst.last = time;
      inst.wrap.position.set(x, y, z);
      inst.wrap.rotation.y = -(e.facing || 0) + Math.PI / 2;
      inst.wrap.visible = true;
      Assets._used.push(inst);
      return true;
    },

    /** Hide glTF instances not drawn this frame (called by the bridge after entities). */
    endFrame() {
      const prev = Assets._prev, used = Assets._used;
      for (let i = 0; i < prev.length; i++) if (used.indexOf(prev[i]) < 0) prev[i].wrap.visible = false;
      Assets._prev = used;
      Assets._used = [];
    }
  });
})();
