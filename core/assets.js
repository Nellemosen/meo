/* ==========================================================================
   core/assets.js – glTF characters and creatures for the three.js renderer.
   Models live in assets/models/*.glb and are packed into assets/models.js by
   tools/pack-assets.js (the game runs from file://, so nothing can be fetched).
   data/asset-map.js decides which model stands in for which creature, and how tall it is.

   Animations: the Quaternius characters ship without clips, and the Universal
   Animation Library (assets/models/anims.glb) carries them on the same bone names.
   three.js resolves animation tracks by node name, so those clips play on any model
   that shares the rig. Creatures with their own clips (the orc) use their own.
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3 || !T3.GLTFLoader) return;

  // kind -> the clip names to look for, best first
  const CLIPS = {
    idle: ['Idle_Loop', 'Idle'],
    walk: ['Walk_Loop', 'Walk'],
    run: ['Jog_Fwd_Loop', 'Run', 'Sprint_Loop'],
    attack: ['Sword_Attack', 'Punch', 'Punch_Cross'],
    cast: ['Spell_Simple_Shoot', 'Weapon'],
    hit: ['Hit_Chest', 'HitReact'],
    death: ['Death01', 'Death']
  };
  const ONESHOT = { attack: 1, cast: 1, death: 1, hit: 1 };
  const ATTACK_TIME = 0.75;     // seconds an attack animation is shown

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h / 4294967295;
  }

  const Assets = (MEO.Assets = {
    models: {},            // id -> { scene, clips, height }
    ready: false,
    _live: [],             // active instances
    _used: [],

    load() {
      if (Assets.ready) return;
      Assets.ready = true;
      const b64 = MEO.ASSET_B64 || {};
      const loader = new T3.GLTFLoader();
      Object.keys(b64).forEach(function (id) {
        const bin = atob(b64[id]);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        loader.parse(buf.buffer, '', function (g) {
          g.scene.traverse(function (o) {
            if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
          });
          const box = new T3.Box3().setFromObject(g.scene);
          Assets.models[id] = { scene: g.scene, clips: g.animations || [], height: Math.max(0.01, box.max.y - box.min.y) };
          const R = MEO.Renderer;
          if (R && R.world) R.setWorld(R.world);     // rebuild so new models show at once
        }, function (err) { console.warn('[Assets] could not read ' + id, err); });
      });
    },

    /** Clips every rigged character shares (the animation library). */
    shared() {
      const a = Assets.models.anims;
      return a ? a.clips : [];
    },

    /** { id, height } for an entity, or null to keep the procedural model. */
    pick(e) {
      const M = MEO.ASSET_MAP || {};
      const H = MEO.ASSET_HEIGHT || {};
      const P = M.people || {};
      const key = String(e.npcId || e.mobId || e.classId || e.id || e.name || 'x');
      const fromSet = function (set, height) {
        if (!set || !set.length) return null;
        const id = set[Math.floor(hash(key) * set.length) % set.length];
        return Assets.models[id] ? { id: id, height: height || H[id] || 1.85 } : null;
      };
      if (e.type === 'mob') {
        if (e.isStatic || e.shape === 'dummy') return null;
        const id = M.mob && M.mob[e.mobId];
        if (!id) return null;
        const h = (MEO.ASSET_MOB_H && MEO.ASSET_MOB_H[e.mobId]) || null;
        if (id === 'people') return fromSet(P.mob, h);          // a human enemy: use a person model
        return Assets.models[id] ? { id: id, height: h || H[id] || 1.85 } : null;
      }
      if (e.isStatic && e.shape === 'dummy') return null;
      const named = MEO.ASSET_NPC && e.npcId && MEO.ASSET_NPC[e.npcId];
      if (named && Assets.models[named]) {
        const rh = (MEO.ASSET_RACE_H && MEO.ASSET_RACE_H[e.raceId]) || null;
        return { id: named, height: rh || H[named] || 1.85 };
      }
      const set = e.type === 'player' ? P.player : e.type === 'party' ? P.party : P.npc;
      const race = (MEO.ASSET_RACE_H && MEO.ASSET_RACE_H[e.raceId]) || null;
      return fromSet(set, race);
    },

    clipFor(inst, kind) {
      const want = CLIPS[kind] || [];
      const pools = [inst.own, inst.lib];
      for (let p = 0; p < pools.length; p++) {
        for (let i = 0; i < want.length; i++) {
          const c = pools[p].filter(function (x) { return x.name === want[i]; })[0];
          if (c) return c;
        }
      }
      return null;
    },

    /** Which animation should this entity show right now? */
    state(e, now) {
      if (!e.alive) return 'death';
      const a = e._anim;
      if (a && now - a.atkT < ATTACK_TIME) return 'attack';
      if (e.moving) return (e.speed || 0) > 130 ? 'run' : 'walk';
      return 'idle';
    },

    play(inst, kind, now) {
      if (kind === inst.kind) return;
      const clip = Assets.clipFor(inst, kind) || Assets.clipFor(inst, 'idle');
      if (!clip) { inst.kind = kind; return; }
      const next = inst.mixer.clipAction(clip);
      next.reset();
      if (ONESHOT[kind]) { next.setLoop(T3.LoopOnce, 1); next.clampWhenFinished = true; }
      else next.setLoop(T3.LoopRepeat, Infinity);
      next.play();
      if (inst.action && inst.action !== next) {
        inst.action.crossFadeTo(next, kind === 'attack' ? 0.08 : 0.22, false);
      }
      inst.action = next;
      inst.kind = kind;
      void now;
    },

    /** Draw e with a glTF model. Returns false when there is none (procedural model is used). */
    drawEntity(e, x, y, z, time, Three) {
      if (!Assets.ready) Assets.load();
      const want = Assets.pick(e);
      if (!want) return false;
      let inst = e._glb;
      if (!inst || inst.id !== want.id) {
        if (inst) Assets._dispose(inst);
        const src = Assets.models[want.id];
        const root = T3.SkeletonUtils ? T3.SkeletonUtils.clone(src.scene) : src.scene.clone(true);
        const s = want.height / src.height;
        root.scale.setScalar(s);
        const wrap = new T3.Group();
        wrap.add(root);
        Three._entGroup.add(wrap);
        inst = e._glb = {
          id: want.id, wrap: wrap, mixer: new T3.AnimationMixer(root),
          own: src.clips, lib: Assets.shared(), action: null, kind: '', last: time, h: want.height
        };
        Assets._live.push(inst);
      }
      Assets.play(inst, Assets.state(e, time), time);
      inst.mixer.update(Math.min(0.1, Math.max(0, time - inst.last)));
      inst.last = time;
      inst.wrap.position.set(x, y, z);
      inst.wrap.rotation.y = Math.PI / 2 - (e.facing || 0);
      inst.wrap.visible = true;
      Assets._used.push(inst);
      return true;
    },

    _dispose(inst) {
      if (inst.wrap.parent) inst.wrap.parent.remove(inst.wrap);
      const i = Assets._live.indexOf(inst);
      if (i >= 0) Assets._live.splice(i, 1);
    },

    /** Hide instances not drawn this frame and drop ones gone for a while. */
    endFrame() {
      const used = Assets._used;
      const now = MEO.Engine ? MEO.Engine.time : 0;
      for (let i = Assets._live.length - 1; i >= 0; i--) {
        const inst = Assets._live[i];
        if (used.indexOf(inst) >= 0) { inst.seen = now; continue; }
        inst.wrap.visible = false;
        if (now - (inst.seen || 0) > 20) Assets._dispose(inst);
      }
      Assets._used = [];
    }
  });

  // a new zone means new creatures: drop every instance
  if (MEO.Events) {
    MEO.Events.on('zone:enter', function () {
      Assets._live.slice().forEach(Assets._dispose);
      Assets._used = [];
    });
  }
})();
