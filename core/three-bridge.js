/* ==========================================================================
   core/three-bridge.js – three.js renderer (PBR) sharing the game's WebGL2 context.
   The game's meshes (terrain, props, roofs, water, creatures) are converted to three.js
   geometry once and then drawn with MeshStandardMaterial: physically based lighting,
   soft sun shadows, ACES tone mapping, hemisphere ambient and exponential fog.
   Camera, picking and the 2D overlay still use the game's own camera code, so the
   bridge simply copies its view/projection matrices into the three.js camera.
   glTF models are loaded through MEO.Assets (core/assets.js) and replace procedural
   props or creatures by id, so real art can be dropped in without changing game code.
   Switch: Options → Graphics → Graphics engine (three.js / Classic).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const T3 = window.THREE;
  if (!T3) return; // lib missing: the classic renderer is used
  const U = MEO.util;

  function srgbToLinear(v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  const LUT = new Float32Array(256);
  for (let i = 0; i < 256; i++) LUT[i] = srgbToLinear(i);

  const Three = (MEO.Three = {
    ok: false,
    failed: false,
    renderer: null,
    scene: null,
    camera: null,
    sun: null,
    hemi: null,
    sky: null,
    _geo: new WeakMap(),     // game mesh -> BufferGeometry
    _mats: {},               // material cache
    _terrainGroup: null,
    _entGroup: null,
    _pool: [],
    _poolUsed: 0,
    _chunksRef: null,
    _roofMeshes: [],
    _water: null,
    stats: { draws: 0, tris: 0 },

    wanted() {
      if (Three.failed) return false;
      const S = MEO.Settings;
      if (S && S.get('gfx.engine') === 'classic') return false;
      if (!Three.ok) Three._init();
      return Three.ok;
    },

    // ---- Setup ---------------------------------------------------------------------------
    _init() {
      const R = MEO.Renderer;
      try {
        const r = new T3.WebGLRenderer({ canvas: R.canvas, context: R.gl, antialias: true });
        r.outputEncoding = T3.sRGBEncoding;
        r.toneMapping = T3.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.0;
        r.shadowMap.enabled = true;
        r.shadowMap.type = T3.PCFSoftShadowMap;
        r.autoClear = true;
        r.info.autoReset = true;
        Three.renderer = r;

        const scene = (Three.scene = new T3.Scene());
        scene.fog = new T3.FogExp2(0xa8bfd0, R.fogDen);
        scene.background = new T3.Color(0xa8bfd0);

        const cam = (Three.camera = new T3.PerspectiveCamera());
        cam.matrixAutoUpdate = false;
        cam.matrixWorldAutoUpdate = false;

        Three.hemi = new T3.HemisphereLight(0x8fa8d6, 0x4b4733, 0.6);
        scene.add(Three.hemi);
        const sun = (Three.sun = new T3.DirectionalLight(0xffe2b0, 3.4));
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera;
        sc.left = -44; sc.right = 44; sc.top = 44; sc.bottom = -44; sc.near = 1; sc.far = 160;
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.05;
        scene.add(sun);
        scene.add(sun.target);

        Three._terrainGroup = new T3.Group();
        Three._entGroup = new T3.Group();
        scene.add(Three._terrainGroup, Three._entGroup);
        Three._makeSky();
        if (MEO.Assets && !MEO.Assets.ready) MEO.Assets.load();
        Three.ok = true;
      } catch (err) {
        console.error('three.js init failed, using the classic renderer:', err);
        Three.failed = true;
      }
    },

    _makeSky() {
      const geo = new T3.SphereGeometry(1, 32, 16);
      const mat = new T3.ShaderMaterial({
        side: T3.BackSide, depthWrite: false, fog: false,
        uniforms: {
          uTop: { value: new T3.Color(0x3a6bc0) }, uHor: { value: new T3.Color(0xa8bfd0) },
          uSun: { value: new T3.Vector3(0, 1, 0) }, uSunCol: { value: new T3.Color(0xffe6b0) }
        },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position,1.0); gl_Position = p.xyww; }',
        fragmentShader: [
          'varying vec3 vD; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol;',
          'void main(){',
          '  float h = clamp(vD.y, 0.0, 1.0);',
          '  vec3 c = mix(uHor, uTop, pow(h, 0.55));',
          '  float s = max(dot(normalize(vD), uSun), 0.0);',
          '  c += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 14.0) * 0.28);',
          '  gl_FragColor = vec4(c, 1.0);',
          '  #include <tonemapping_fragment>',
          '  #include <encodings_fragment>',
          '}'
        ].join('\n')
      });
      const m = (Three.sky = new T3.Mesh(geo, mat));
      m.frustumCulled = false;
      m.renderOrder = -1000;
      Three.scene.add(m);
    },

    // ---- Geometry conversion ---------------------------------------------------------------
    /** Convert a game mesh (packed 20-byte vertices) into a BufferGeometry (cached). */
    geometry(mesh) {
      let g = Three._geo.get(mesh);
      if (g) return g;
      const n = mesh.count;
      const src = mesh.buf;
      const f32 = new Float32Array(src);
      const i8 = new Int8Array(src);
      const u8 = new Uint8Array(src);
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = f32[i * 5]; pos[i * 3 + 1] = f32[i * 5 + 1]; pos[i * 3 + 2] = f32[i * 5 + 2];
        nrm[i * 3] = i8[i * 20 + 12] / 127; nrm[i * 3 + 1] = i8[i * 20 + 13] / 127; nrm[i * 3 + 2] = i8[i * 20 + 14] / 127;
        const ao = 0.35 + 0.65 * (u8[i * 20 + 19] / 255);    // baked ambient occlusion
        col[i * 3] = LUT[u8[i * 20 + 16]] * ao;
        col[i * 3 + 1] = LUT[u8[i * 20 + 17]] * ao;
        col[i * 3 + 2] = LUT[u8[i * 20 + 18]] * ao;
      }
      g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T3.BufferAttribute(nrm, 3));
      g.setAttribute('color', new T3.BufferAttribute(col, 3));
      g.computeBoundingSphere();
      Three._geo.set(mesh, g);
      return g;
    },

    material(kind, tint, emis) {
      const key = kind + (tint ? ':' + tint[0].toFixed(2) + ',' + tint[1].toFixed(2) + ',' + tint[2].toFixed(2) + ',' + tint[3].toFixed(2) : '') + (emis && (emis[0] || emis[1] || emis[2]) ? ':e' + emis[0].toFixed(2) + emis[1].toFixed(2) + emis[2].toFixed(2) : '');
      let m = Three._mats[key];
      if (m) return m;
      if (kind === 'water') {
        m = new T3.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.8, side: T3.DoubleSide, depthWrite: false, clearcoat: 0.6 });
      } else if (kind === 'roof') {
        m = new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, transparent: true, side: T3.DoubleSide });
      } else {
        m = new T3.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'ground' ? 1 : 0.82, metalness: 0 });
        if (kind === 'ground') Three._detail(m, 0.75); else if (kind === 'prop' && !tint) Three._detail(m, 0.35);
      }
      if (tint && tint[3] > 0) {
        m.color = new T3.Color(1 - tint[3] * 0.4, 1 - tint[3] * 0.7, 1 - tint[3] * 0.7);
        m.emissive = new T3.Color(tint[0] * tint[3] * 0.6, tint[1] * tint[3] * 0.3, tint[2] * tint[3] * 0.3);
      }
      if (emis && (emis[0] || emis[1] || emis[2])) {
        m.emissive = (m.emissive || new T3.Color(0, 0, 0)).add(new T3.Color(emis[0], emis[1], emis[2]));
      }
      Three._mats[key] = m;
      return m;
    },

    /** Add world-space procedural detail (mottling) to a material so flat vertex colours read as surfaces. */
    _detail(m, strength) {
      m.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position,1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', [
          '#include <common>', 'varying vec3 vWp;',
          'float h3(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
          'float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);',
          ' return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),',
          '            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }'
        ].join('\n')).replace('#include <color_fragment>', '#include <color_fragment>\n  float dn = vn(vWp*1.3)*0.5 + vn(vWp*5.1)*0.3 + vn(vWp*19.0)*0.2;\n  diffuseColor.rgb *= 1.0 + (dn-0.5) * ' + strength.toFixed(2) + ';');
      };
      return m;
    },

    /** Rebuild the static scene when the zone changed. */
    _syncWorld() {
      const Tr = MEO.Terrain;
      if (Three._chunksRef === Tr.chunks) return;
      Three._chunksRef = Tr.chunks;
      const grp = Three._terrainGroup;
      while (grp.children.length) grp.remove(grp.children[0]);
      if (MEO.Kit) MEO.Kit.clear(grp);
      Three._roofMeshes = [];
      Three._water = null;
      Tr.chunks.forEach(function (ch) {
        if (ch.terrain) {
          const m = new T3.Mesh(Three.geometry(ch.terrain), Three.material('ground'));
          m.receiveShadow = true; m.matrixAutoUpdate = false;
          grp.add(m);
        }
        if (ch.props) {
          const m = new T3.Mesh(Three.geometry(ch.props), Three.material('prop'));
          m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
          grp.add(m);
        }
      });
      Tr.roofs.forEach(function (rf) {
        if (!rf.mesh) return;
        const mat = Three.material('roof').clone();
        const m = new T3.Mesh(Three.geometry(rf.mesh), mat);
        m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
        m.userData.roof = rf;
        grp.add(m);
        Three._roofMeshes.push(m);
      });
      if (MEO.Kit && MEO.Kit.on()) MEO.Kit.build(MEO.Renderer.world, grp, function (x, z) { return Tr.heightAt(x, z); });
      if (Tr.water) {
        const m = new T3.Mesh(Three.geometry(Tr.water), Three.material('water'));
        m.renderOrder = 5; m.matrixAutoUpdate = false;
        grp.add(m);
        Three._water = m;
      }
      // zone atmosphere
      const R = MEO.Renderer;
      const mood = (R.world && R.world.theme && R.world.theme.mood) || {};
      const fog = mood.fog || [0.66, 0.75, 0.82];
      const zen = mood.zen || mood.fog || [0.22, 0.42, 0.78];
      const sun = mood.sun == null ? 1 : mood.sun;
      Three._fogCol = new T3.Color().setRGB(fog[0], fog[1], fog[2]).convertSRGBToLinear();
      Three.scene.fog.color.copy(Three._fogCol);
      Three.scene.background.copy(Three._fogCol);
      Three.sky.material.uniforms.uHor.value.copy(Three._fogCol);
      Three.sky.material.uniforms.uTop.value.setRGB(zen[0], zen[1], zen[2]).convertSRGBToLinear();
      Three.sun.intensity = 3.4 * sun;
      Three.hemi.intensity = 0.6 * (mood.amb == null ? 1 : mood.amb);
      Three.hemi.color.setRGB(0.46, 0.58, 0.82).convertSRGBToLinear();
      Three.hemi.groundColor.setRGB(0.30, 0.28, 0.2).convertSRGBToLinear();
    },

    // ---- Entities ----------------------------------------------------------------------------
    _acquire() {
      let o = Three._pool[Three._poolUsed];
      if (!o) {
        o = new T3.Mesh();
        o.matrixAutoUpdate = false;
        o.castShadow = true; o.receiveShadow = false;
        o.frustumCulled = false;
        Three._entGroup.add(o);
        Three._pool.push(o);
      }
      Three._poolUsed++;
      o.visible = true;
      return o;
    },

    _drawEntities(time) {
      Three._poolUsed = 0;
      const R = MEO.Renderer;
      const vis = R.visible;
      const draw = function (mesh, mat, tint, emis) {
        if (!mesh) return;
        const o = Three._acquire();
        o.geometry = Three.geometry(mesh);
        o.material = Three.material('prop', tint && tint[3] > 0 ? tint : null, emis);
        o.matrix.fromArray(mat);
        o.matrixWorld.copy(o.matrix);
        o.matrixWorldNeedsUpdate = false;
      };
      for (let i = 0; i < vis.length; i++) {
        const e = vis[i];
        if (MEO.Assets && MEO.Assets.drawEntity && MEO.Assets.drawEntity(e, e._rx, e._ry, e._rz, time, Three)) continue;
        MEO.Models.draw(e, e._rx, e._ry, e._rz, time, draw);
      }
      for (let i = Three._poolUsed; i < Three._pool.length; i++) Three._pool[i].visible = false;
      if (MEO.Assets && MEO.Assets.endFrame) MEO.Assets.endFrame();
      R.stats.entities = vis.length;
    },

    // ---- Frame ---------------------------------------------------------------------------------
    render(alpha) {
      const R = MEO.Renderer;
      const r = Three.renderer;
      const gl = R.gl;
      const time = performance.now() / 1000;
      Three._syncWorld();

      // camera: copy matrices from the game camera
      const cam = Three.camera;
      cam.projectionMatrix.fromArray(R.proj);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      cam.matrixWorldInverse.fromArray(R.view);
      cam.matrixWorld.copy(cam.matrixWorldInverse).invert();
      cam.matrix.copy(cam.matrixWorld);
      cam.position.set(R.camPos[0], R.camPos[1], R.camPos[2]);

      // sun follows the player so the shadow map covers what you see
      const f = R.camera.focus || [R.camPos[0], 0, R.camPos[2]];
      const dir = new T3.Vector3(-0.55, 0.56, -0.5).normalize();
      Three.sun.position.set(f[0] + dir.x * 70, f[1] + dir.y * 70, f[2] + dir.z * 70);
      Three.sun.target.position.set(f[0], f[1], f[2]);
      Three.sun.target.updateMatrixWorld();
      Three.sun.updateMatrixWorld();
      const sh = MEO.Settings ? MEO.Settings.get('gfx.shadows') : 'on';
      Three.sun.castShadow = sh !== 'off';
      const ms = sh === 'high' ? 4096 : 2048;
      if (Three.sun.shadow.mapSize.x !== ms) { Three.sun.shadow.mapSize.set(ms, ms); if (Three.sun.shadow.map) { Three.sun.shadow.map.dispose(); Three.sun.shadow.map = null; } }
      Three.sky.material.uniforms.uSun.value.copy(dir);
      Three.sky.scale.setScalar(1);

      // roofs fade out when the player is inside
      const pl = R.follow;
      const inside = pl ? MEO.Terrain.buildingAt(pl.x, pl.y) : -1;
      for (let i = 0; i < Three._roofMeshes.length; i++) {
        const m = Three._roofMeshes[i];
        const rf = m.userData.roof;
        const target = inside === rf.index ? 0 : 1;
        rf.alpha += (target - rf.alpha) * Math.min(1, R.dt * 7);
        m.visible = rf.alpha > 0.03;
        m.material.opacity = rf.alpha;
        m.material.depthWrite = rf.alpha > 0.98;
      }
      if (MEO.Kit && MEO.Kit.roofs.length) {
        const rs = MEO.Kit.roofs;
        for (let i = 0; i < rs.length; i++) {
          const rf = MEO.Terrain.roofs[rs[i].index];
          rs[i].obj.visible = !rf || rf.alpha > 0.5;
        }
      }

      Three._drawEntities(time);
      Three.scene.fog.density = R.fogDen;

      gl.viewport(0, 0, R.canvas.width, R.canvas.height);
      r.setSize(R.canvas.width, R.canvas.height, false);
      r.render(Three.scene, cam);

      // game effects (particles, rings, shadows blobs) use the raw context: draw them on top
      r.resetState();
      MEO.FX3D.update(R.dt, R.camera, R);
      MEO.FX3D.render(R);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      r.resetState();
      Three.stats.draws = r.info.render.calls;
      Three.stats.tris = r.info.render.triangles;
    }
  });
})();
