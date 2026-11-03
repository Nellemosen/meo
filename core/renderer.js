/* ==========================================================================
   core/renderer.js – WebGL2 renderer with third-person camera
   Draws sky, terrain, props, figures, water and effects, plus a 2D overlay
   with nameplates, health/cast bars and floating combat text.
   Camera: orbits around the player (WoW/LOTRO style): drag with the mouse, wheel = distance.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const C = MEO.CONFIG;
  const U = MEO.util;
  const GL = MEO.GL;
  const M4 = GL.M4;
  const PX = 1 / 16;
  const TAU = Math.PI * 2;

  // Light and fog
  const SUN = (function () {
    const v = [-0.55, 0.56, -0.5];
    const l = Math.hypot(v[0], v[1], v[2]);
    return new Float32Array([v[0] / l, v[1] / l, v[2] / l]);
  })();
  const SUN_COL = new Float32Array([1.12, 0.96, 0.72]);
  const SKY_COL = new Float32Array([0.46, 0.58, 0.82]);
  const GND_COL = new Float32Array([0.30, 0.28, 0.2]);
  const FOG_COL = new Float32Array([0.66, 0.75, 0.82]);
  const ZENITH = new Float32Array([0.22, 0.42, 0.78]);
  let AMB_SCALE = 0.7;
  const DEF_MOOD = { sun: Array.from(SUN_COL), sky: Array.from(SKY_COL), gnd: Array.from(GND_COL), fog: Array.from(FOG_COL), zen: Array.from(ZENITH), amb: 0.7 };
  /** Per-zone atmosphere: world.theme.mood = { fog, zen, sun (scale), amb } */
  function applyMood(m) {
    m = m || {};
    const set = function (dst, src, mul) { for (let i = 0; i < 3; i++) dst[i] = src[i] * (mul == null ? 1 : mul); };
    set(SUN_COL, DEF_MOOD.sun, m.sun == null ? 1 : m.sun);
    set(SKY_COL, m.sky || DEF_MOOD.sky);
    set(GND_COL, DEF_MOOD.gnd);
    set(FOG_COL, m.fog || DEF_MOOD.fog);
    set(ZENITH, m.zen || m.fog || DEF_MOOD.zen);
    AMB_SCALE = DEF_MOOD.amb * (m.amb == null ? 1 : m.amb);
  }

  const Renderer = (MEO.Renderer = {
    canvas: null,
    overlay: null,
    octx: null,
    gl: null,
    failed: false,
    dpr: 1,
    scale: 1,
    viewW: 0,
    viewH: 0,
    world: null,
    follow: null,
    fogDen: 0.0085,
    camPos: new Float32Array(3),
    view: M4.create(),
    proj: M4.create(),
    vp: M4.create(),
    invVP: M4.create(),
    planes: new Float32Array(24),
    visible: [],
    dt: 0.016,
    camera: {
      yaw: -Math.PI / 2, pitch: 0.5, dist: 10, distTarget: 10, minDist: 2.5, maxDist: 24,
      x: 0, y: 0, ty: 0, ready: false, fov: 0.92, free: 0
    },
    stats: { frame: 0, chunks: 0, entities: 0 },
    _slow: 0,
    _fast: 0,

    // ---- Setup ----------------------------------------------------------
    init(canvas, overlay) {
      Renderer.canvas = canvas;
      Renderer.overlay = overlay;
      Renderer.octx = overlay ? overlay.getContext('2d') : null;
      const q = /[?&]q=(low|med|high)/.exec(location.search);
      if (q) Renderer.scale = q[1] === 'low' ? 0.5 : q[1] === 'med' ? 0.75 : 1;

      const gl = GL.init(canvas);
      if (!gl) {
        Renderer.failed = true;
        console.error('WebGL2 is not supported');
        const msg = document.getElementById('gl-error');
        if (msg) msg.hidden = false;
        window.addEventListener('resize', Renderer.resize);
        Renderer.resize();
        return;
      }
      Renderer.gl = gl;
      try {
        Renderer.lit = GL.compile(GL.SRC.litVS, GL.SRC.litFS, GL.LIT_UNIFORMS);
        Renderer.water = GL.compile(GL.SRC.litVS, GL.SRC.waterFS, GL.WATER_UNIFORMS);
        Renderer.sky = GL.compile(GL.SRC.skyVS, GL.SRC.skyFS, GL.SKY_UNIFORMS);
        MEO.FX3D.init();
        if (MEO.Post) MEO.Post.init(gl);
      } catch (err) {
        Renderer.failed = true;
        console.error(err);
        const msg = document.getElementById('gl-error');
        if (msg) {
          msg.hidden = false;
          msg.textContent = 'Grafikfejl: ' + err.message;
        }
      }
      Renderer.identity = M4.create();
      window.addEventListener('resize', Renderer.resize);
      Renderer.resize();
    },

    resize() {
      const R = Renderer;
      R.dpr = Math.min(window.devicePixelRatio || 1, 2);
      R.viewW = Math.max(320, window.innerWidth);
      R.viewH = Math.max(240, window.innerHeight);
      const c = R.canvas;
      const s = R.dpr * Math.min(1, R.scale) * (R.dpr > 1.5 ? 0.9 : 1);
      c.width = Math.max(2, Math.floor(R.viewW * s));
      c.height = Math.max(2, Math.floor(R.viewH * s));
      c.style.width = R.viewW + 'px';
      c.style.height = R.viewH + 'px';
      if (MEO.Post && MEO.Post.ok) MEO.Post.resize(c.width, c.height);
      if (R.overlay) {
        R.overlay.width = Math.floor(R.viewW * R.dpr);
        R.overlay.height = Math.floor(R.viewH * R.dpr);
        R.overlay.style.width = R.viewW + 'px';
        R.overlay.style.height = R.viewH + 'px';
      }
    },

    setWorld(world) {
      Renderer.world = world;
      applyMood(world && world.theme && world.theme.mood);
      Renderer.camera.ready = false;
      if (Renderer.failed) {
        MEO.Terrain.world = world;
        return;
      }
      MEO.Terrain.build(world);
      MEO.FX3D.reset();
    },

    setFollow(entity) {
      Renderer.follow = entity;
    },

    // ---- Camera -----------------------------------------------------------------
    zoomBy(steps) {
      const cam = Renderer.camera;
      cam.distTarget = U.clamp(cam.distTarget * Math.pow(1.12, -steps), cam.minDist, cam.maxDist);
    },

    /** Color and distance shift: dist in meters. */
    setDistance(d) {
      Renderer.camera.distTarget = U.clamp(d, Renderer.camera.minDist, Renderer.camera.maxDist);
    },

    _updateCamera(alpha, dt) {
      const R = Renderer;
      const cam = R.camera;
      const f = R.follow;
      const menu = MEO.Engine.state === 'menu';
      const I = MEO.Input;

      // mouse control
      if (I && !menu) {
        const l = I.consumeLook();
        if (l.dx || l.dy) {
          const S = MEO.Settings;
          const sens = S ? S.get('game.camSens') : 1;
          cam.yaw += l.dx * 0.0042 * sens;
          cam.pitch = U.clamp(cam.pitch + l.dy * 0.0042 * sens * (S && S.get('game.invertY') ? -1 : 1), -0.22, 1.38);
        }
      } else if (I) {
        I.consumeLook();
      }
      if (menu) {
        cam.yaw += dt * 0.12;
        cam.pitch += (0.3 - cam.pitch) * Math.min(1, dt * 2);
        cam.distTarget = 11;
      }
      cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw));

      let tx = cam.x, ty = cam.y;
      if (f) {
        tx = U.lerp(f.prevX, f.x, alpha);
        ty = U.lerp(f.prevY, f.y, alpha);
      }
      cam.x = tx;
      cam.y = ty;
      const ground = MEO.Terrain.heightAt(tx, ty);
      if (!cam.ready) cam.ty = ground;
      cam.ty += (ground - cam.ty) * Math.min(1, dt * 12);

      const focus = [tx * PX, cam.ty + (menu ? 1.5 : 1.55), ty * PX];
      cam.focus = focus;

      // distance with collision
      cam.dist += (cam.distTarget - cam.dist) * Math.min(1, dt * 10);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const dx = -Math.cos(cam.yaw) * cp, dy = sp, dz = -Math.sin(cam.yaw) * cp;
      let d = cam.dist;
      const world = R.world;
      const T = MEO.Terrain;
      for (let s = 0.5; s <= cam.dist + 0.4; s += 0.35) {
        const x = focus[0] + dx * s, y = focus[1] + dy * s, z = focus[2] + dz * s;
        const gh = T.heightAtM(x, z);
        let hit = y < gh + 0.45;
        if (!hit && world) {
          const id = world.get(Math.floor(x / PX / world.tile), Math.floor(z / PX / world.tile));
          if ((id === MEO.TILE_ID.WALL || id === MEO.TILE_ID.ROCK) && y < gh + 3.4) hit = true;
        }
        if (hit) {
          d = Math.max(0.9, s - 0.55);
          break;
        }
      }
      cam.eff = cam.eff === undefined || !cam.ready ? d : (d < cam.eff ? d : cam.eff + (d - cam.eff) * Math.min(1, dt * 5));
      const e = cam.eff;
      R.camPos[0] = focus[0] + dx * e;
      R.camPos[1] = focus[1] + dy * e;
      R.camPos[2] = focus[2] + dz * e;
      // never below the terrain
      const minY = T.heightAtM(R.camPos[0], R.camPos[2]) + 0.35;
      if (R.camPos[1] < minY) R.camPos[1] = minY;
      cam.ready = true;

      const aspect = R.canvas.width / R.canvas.height;
      M4.perspective(R.proj, cam.fov, aspect, 0.25, 520);
      M4.lookAt(R.view, R.camPos[0], R.camPos[1], R.camPos[2], focus[0], focus[1], focus[2], 0, 1, 0);
      M4.multiply(R.vp, R.proj, R.view);
      M4.invert(R.invVP, R.vp);

      // frustum planes (Gribb/Hartmann)
      const m = R.vp, p = R.planes;
      const set = function (i, a, b, c, dd) {
        const l = Math.hypot(a, b, c) || 1;
        p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = c / l; p[i * 4 + 3] = dd / l;
      };
      set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
      set(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
      set(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
      set(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
      set(4, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
      set(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
    },

    inFrustum(x, y, z, r) {
      const p = Renderer.planes;
      for (let i = 0; i < 6; i++) {
        if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z + p[i * 4 + 3] < -r) return false;
      }
      return true;
    },

    // ---- Projection and picking ---------------------------------------------------------
    /** World point in meters → screen (CSS pixels). */
    projectWorld(x, y, z) {
      const m = Renderer.vp;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.05) return { x: 0, y: 0, visible: false, depth: w };
      const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      const ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      return { x: (nx * 0.5 + 0.5) * Renderer.viewW, y: (0.5 - ny * 0.5) * Renderer.viewH, visible: Math.abs(nx) < 1.3 && Math.abs(ny) < 1.3, depth: w };
    },

    /** Game pixel coordinates (px,py) + height in meters above terrain → screen. */
    project(px, py, h) {
      const T = MEO.Terrain;
      return Renderer.projectWorld(px * PX, T.heightAt(px, py) + (h || 0), py * PX);
    },

    /** Screen point → ray {o:[x,y,z], d:[x,y,z]}. */
    ray(sx, sy) {
      const nx = (sx / Renderer.viewW) * 2 - 1;
      const ny = 1 - (sy / Renderer.viewH) * 2;
      const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
      M4.point(Renderer.invVP, nx, ny, -1, a);
      M4.point(Renderer.invVP, nx, ny, 1, b);
      let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const l = Math.hypot(dx, dy, dz) || 1;
      return { o: [a[0], a[1], a[2]], d: [dx / l, dy / l, dz / l] };
    },

    /** Find the creature under the mouse: nearest ray/capsule hit. */
    pickEntity(sx, sy, corpses) {
      const r = Renderer.ray(sx, sy);
      const list = MEO.Entities.list;
      let best = null;
      let bestT = Infinity;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e._rx === undefined) continue;
        if (!e.alive) {
          if (!corpses || !e.loot) continue;
        } else if (corpses) continue;
        const H = e.alive ? MEO.Models.heightOf(e) : 0.5;
        const a = [e._rx, e._ry + 0.1, e._rz];
        const b = [e._rx, e._ry + H * 0.95, e._rz];
        const rad = e.alive ? Math.max(0.5, e.radius * PX + 0.22) : Math.max(0.9, e.radius * PX * (e.scale || 1) + 0.5);
        const res = Renderer._raySeg(r.o, r.d, a, b);
        if (res.dist <= rad && res.t < bestT) {
          bestT = res.t;
          best = e;
        }
      }
      return best;
    },

    _raySeg(o, d, a, b) {
      const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
      const wx = o[0] - a[0], wy = o[1] - a[1], wz = o[2] - a[2];
      const bb = d[0] * vx + d[1] * vy + d[2] * vz;
      const c = vx * vx + vy * vy + vz * vz;
      const dd = d[0] * wx + d[1] * wy + d[2] * wz;
      const ee = vx * wx + vy * wy + vz * wz;
      const den = c - bb * bb;
      let tc = den > 1e-9 ? (ee - bb * dd) / den : 0;
      tc = U.clamp(tc, 0, 1);
      let sc = bb * tc - dd;
      if (sc < 0) sc = 0;
      const px = o[0] + d[0] * sc - (a[0] + vx * tc);
      const py = o[1] + d[1] * sc - (a[1] + vy * tc);
      const pz = o[2] + d[2] * sc - (a[2] + vz * tc);
      return { t: sc, dist: Math.hypot(px, py, pz) };
    },

    groundHeight(px, py) {
      return MEO.Terrain.heightAt(px, py);
    },

    // =========================================================================
    //  Main drawing
    // =========================================================================
    render(alpha, dt) {
      const R = Renderer;
      dt = dt || 0.016;
      R.dt = Math.min(dt, 0.1);
      const world = R.world;
      if (!world) return;
      R._updateCamera(alpha, R.dt);
      R._updateEntities(alpha);
      R.stats.frame++;
      R._adapt(dt);

      if (!R.failed && R.gl) {
        if (MEO.Three && MEO.Three.wanted()) MEO.Three.render(alpha);
        else R._drawScene(alpha);
      }
      R._drawOverlay(alpha);
    },

    _updateEntities(alpha) {
      const T = MEO.Terrain;
      const list = MEO.Entities.list;
      const vis = Renderer.visible;
      vis.length = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const x = U.lerp(e.prevX, e.x, alpha);
        const z = U.lerp(e.prevY, e.y, alpha);
        e._rx = x * PX;
        e._rz = z * PX;
        e._ry = T.heightAt(x, z);
        if (Renderer.inFrustum(e._rx, e._ry + 1, e._rz, 2.6)) {
          if (e.alive || (e.corpse && MEO.Engine.time - e.deathTime < (e.corpseTime || 8) + 0.5)) vis.push(e);
        }
      }
    },

    /** Lower the resolution automatically if the frame rate is low. */
    _adapt(dt) {
      const R = Renderer;
      if (MEO.Engine.paused || dt <= 0) return;
      if (MEO.Settings && !MEO.Settings.get('gfx.adaptive')) return;
      if (dt > 0.026) R._slow++;
      else R._slow = Math.max(0, R._slow - 1);
      if (R._slow > 70 && R.scale > 0.5) {
        R.scale = Math.max(0.5, R.scale - 0.125);
        R._slow = 0;
        R.resize();
      }
    },

    _drawScene(alpha) {
      const R = Renderer;
      const gl = R.gl;
      const T = MEO.Terrain;
      const time = performance.now() / 1000;
      const P = MEO.Post;
      if (P && P.ok) {
        P.refreshSettings();
        if (P.shadowOn && R.camera.focus) R._shadowPass(time);
      }
      if (P && P.ok) P.beginScene();
      gl.viewport(0, 0, R.canvas.width, R.canvas.height);
      gl.clearColor(FOG_COL[0], FOG_COL[1], FOG_COL[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);

      // ---- sky ----
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(R.sky.prog);
      const su = R.sky.u;
      gl.uniformMatrix4fv(su.u_invVP, false, R.invVP);
      gl.uniform3fv(su.u_cam, R.camPos);
      gl.uniform3fv(su.u_sun, SUN);
      gl.uniform3fv(su.u_sunCol, SUN_COL);
      gl.uniform3fv(su.u_fogCol, FOG_COL);
      gl.uniform3fv(su.u_zenith, ZENITH);
      gl.uniform1f(su.u_time, time);
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      // ---- shared lit uniforms ----
      const lit = R.lit;
      const u = lit.u;
      gl.useProgram(lit.prog);
      gl.uniformMatrix4fv(u.u_vp, false, R.vp);
      gl.uniformMatrix4fv(u.u_model, false, R.identity);
      gl.uniform3fv(u.u_sun, SUN);
      gl.uniform3fv(u.u_sunCol, SUN_COL);
      gl.uniform3f(u.u_skyCol, SKY_COL[0] * AMB_SCALE, SKY_COL[1] * AMB_SCALE, SKY_COL[2] * AMB_SCALE);
      gl.uniform3f(u.u_gndCol, GND_COL[0] * AMB_SCALE, GND_COL[1] * AMB_SCALE, GND_COL[2] * AMB_SCALE);
      gl.uniform4f(u.u_tint, 0, 0, 0, 0);
      gl.uniform3f(u.u_emis, 0, 0, 0);
      gl.uniform1f(u.u_alpha, 1);
      gl.uniform3fv(u.u_cam, R.camPos);
      gl.uniform3fv(u.u_fogCol, FOG_COL);
      gl.uniform1f(u.u_fogDen, R.fogDen);
      if (P && P.ok) P.bindShadowUniforms(u);
      gl.uniform1f(u.u_detail, 1);

      // ---- terrain and props ----
      let drawn = 0;
      const chunks = T.chunks;
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        const b = ch.bounds;
        if (!b.r || !R.inFrustum(b.cx, b.cy, b.cz, b.r)) continue;
        if (ch.terrain) GL.drawMesh(ch.terrain);
        if (ch.props) GL.drawMesh(ch.props);
        drawn++;
      }
      R.stats.chunks = drawn;

      // ---- roofs (hidden when the player is inside) ----
      const pl = R.follow;
      const inside = pl ? T.buildingAt(pl.x, pl.y) : -1;
      for (let i = 0; i < T.roofs.length; i++) {
        const rf = T.roofs[i];
        const target = inside === rf.index ? 0 : 1;
        rf.alpha += (target - rf.alpha) * Math.min(1, R.dt * 7);
        if (rf.alpha < 0.03 || !rf.mesh) continue;
        const b = rf.mesh.bounds;
        if (!R.inFrustum(b.cx, b.cy, b.cz, b.r)) continue;
        const fade = rf.alpha < 0.98;
        if (fade) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.disable(gl.CULL_FACE);
          gl.uniform1f(u.u_alpha, rf.alpha);
        }
        GL.drawMesh(rf.mesh);
        if (fade) {
          gl.uniform1f(u.u_alpha, 1);
          gl.disable(gl.BLEND);
          gl.enable(gl.CULL_FACE);
        }
      }

      // ---- creatures ----
      gl.useProgram(R.lit.prog);
      gl.uniform1f(u.u_detail, 0);
      R._drawEntities(time);
      gl.uniform1f(u.u_detail, 1);

      // ---- water ----
      if (T.water) {
        const w = R.water;
        gl.useProgram(w.prog);
        gl.uniformMatrix4fv(w.u.u_vp, false, R.vp);
        gl.uniformMatrix4fv(w.u.u_model, false, R.identity);
        gl.uniform3fv(w.u.u_sun, SUN);
        gl.uniform3fv(w.u.u_sunCol, SUN_COL);
        gl.uniform3fv(w.u.u_skyCol, ZENITH);
        gl.uniform1f(w.u.u_time, time);
        gl.uniform3fv(w.u.u_cam, R.camPos);
        gl.uniform3fv(w.u.u_fogCol, FOG_COL);
        gl.uniform1f(w.u.u_fogDen, R.fogDen);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        GL.drawMesh(T.water);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
      }

      // ---- effects ----
      MEO.FX3D.update(R.dt, R.camera, R);
      MEO.FX3D.render(R);
      gl.disable(gl.BLEND);
      if (P && P.ok) P.endScene();
    },

    /** Render the sun's depth map around the player. */
    _shadowPass(time) {
      const R = Renderer;
      const gl = R.gl;
      const P = MEO.Post;
      const T = MEO.Terrain;
      const f = R.camera.focus;
      P.updateLight(SUN, f);
      P.beginShadow();
      const rad = P.radius + 6;
      const chunks = T.chunks;
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        const b = ch.bounds;
        if (!ch.props || !b.r) continue;
        if (Math.hypot(b.cx - f[0], b.cz - f[2]) > rad + b.r) continue;
        GL.drawMesh(ch.props);
      }
      P.setModel(R.identity);
      for (let i = 0; i < T.roofs.length; i++) {
        const rf = T.roofs[i];
        if (rf.alpha < 0.9 || !rf.mesh) continue;
        const b = rf.mesh.bounds;
        if (Math.hypot(b.cx - f[0], b.cz - f[2]) > rad + b.r) continue;
        GL.drawMesh(rf.mesh);
      }
      const vis = R.visible;
      const draw = function (mesh, mat) {
        if (!mesh) return;
        P.setModel(mat);
        GL.drawMesh(mesh);
      };
      for (let i = 0; i < vis.length; i++) {
        const e = vis[i];
        if (Math.hypot(e._rx - f[0], e._rz - f[2]) > rad) continue;
        MEO.Models.draw(e, e._rx, e._ry, e._rz, time, draw);
      }
      P.endShadow();
    },

    _drawEntities(time) {
      const R = Renderer;
      const gl = R.gl;
      const u = R.lit.u;
      gl.useProgram(R.lit.prog);
      const vis = R.visible;
      const draw = function (mesh, mat, tint, emis, a) {
        if (!mesh) return;
        gl.uniformMatrix4fv(u.u_model, false, mat);
        gl.uniform4f(u.u_tint, tint[0], tint[1], tint[2], tint[3]);
        gl.uniform3f(u.u_emis, emis[0], emis[1], emis[2]);
        GL.drawMesh(mesh);
      };
      for (let i = 0; i < vis.length; i++) {
        const e = vis[i];
        MEO.Models.draw(e, e._rx, e._ry, e._rz, time, draw);
      }
      gl.uniformMatrix4fv(u.u_model, false, R.identity);
      gl.uniform4f(u.u_tint, 0, 0, 0, 0);
      gl.uniform3f(u.u_emis, 0, 0, 0);
      R.stats.entities = vis.length;
    },

    // =========================================================================
    //  2D overlay: nameplates, bars, floating text, debug
    // =========================================================================
    _drawOverlay(alpha) {
      const R = Renderer;
      const ctx = R.octx;
      if (!ctx) return;
      ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      ctx.clearRect(0, 0, R.viewW, R.viewH);
      if (R.failed) return;

      const now = performance.now() / 1000;
      const tgt = MEO.Targeting ? MEO.Targeting.target : null;
      const vis = R.visible;
      const cam = R.camPos;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';

      for (let i = 0; i < vis.length; i++) {
        const e = vis[i];
        if (!e.alive) {
          if (e.loot && R._corpseLabel(ctx, e, cam)) continue;
          continue;
        }
        const dx = e._rx - cam[0], dz = e._rz - cam[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        const isMob = e.type === 'mob';
        const maxD = e === tgt ? 90 : e.type === 'player' || e.type === 'party' ? 60 : isMob ? 42 : 30;
        if (dist > maxD) continue;
        const H = MEO.Models.heightOf(e);
        const s = R.projectWorld(e._rx, e._ry + H + 0.28, e._rz);
        if (!s.visible) continue;
        const np = MEO.Settings ? MEO.Settings.get('game.nameplates') : 'all';
        if (np === 'off' && e !== tgt) continue;
        if (np === 'combat' && e !== tgt && !e.inCombat) continue;
        R._nameplate(ctx, e, s.x, s.y, now, tgt);
      }

      if (MEO.CombatText) MEO.CombatText.draw(ctx);
      if (C.DEBUG) R._drawDebug(ctx);
    },

    _corpseLabel(ctx, e, cam) {
      const dx = e._rx - cam[0], dz = e._rz - cam[2];
      if (dx * dx + dz * dz > 30 * 30) return false;
      const s = Renderer.projectWorld(e._rx, e._ry + 0.9, e._rz);
      if (!s.visible) return false;
      ctx.font = '600 12px Georgia, serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const t = 'Corpse of ' + e.name;
      ctx.strokeText(t, s.x, s.y);
      ctx.fillStyle = '#ffe58a';
      ctx.fillText(t, s.x, s.y);
      return true;
    },

    _nameplate(ctx, e, x, y, now, tgt) {
      const isMob = e.type === 'mob';
      let nameY = y;
      if ((isMob || e.type === 'party') && (e.inCombat || e === tgt || e.stats.hp < e.stats.maxHp)) {
        const w = 62;
        const bx = x - w / 2;
        const by = y - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(bx - 1, by - 1, w + 2, 8);
        ctx.fillStyle = isMob ? '#6a1b17' : '#17381b';
        ctx.fillRect(bx, by, w, 6);
        ctx.fillStyle = e.hpPct > 0.5 ? '#4fbf4f' : e.hpPct > 0.25 ? '#e0b030' : '#d84030';
        ctx.fillRect(bx, by, w * U.clamp(e.hpPct, 0, 1), 6);
        nameY = by - 4;
      }
      if (e.cast) {
        const w = 56;
        const p = U.clamp((MEO.Engine.time - e.cast.start) / (e.cast.end - e.cast.start), 0, 1);
        const bx = x - w / 2;
        const by = y + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(bx - 1, by - 1, w + 2, 8);
        ctx.fillStyle = '#e8b04a';
        ctx.fillRect(bx, by, w * p, 6);
        ctx.font = '600 10px Georgia, serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(e.cast.def.name, x, by + 18);
        ctx.fillText(e.cast.def.name, x, by + 18);
      }
      ctx.font = '600 13px Georgia, serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const label = isMob ? e.name + (e.rank === 'rare' ? ' ★' : e.rank === 'boss' ? ' ☠' : '') + '  (' + e.level + ')' : e.name;
      ctx.strokeText(label, x, nameY);
      let mobCol = '#ff9d8a';
      if (isMob && MEO.Game && MEO.Game.player) {
        const diff = e.level - MEO.Game.player.level;
        mobCol = e.rank === 'boss' ? '#ff4a3a' : e.rank === 'rare' ? '#c9a0ff' : diff >= 4 ? '#ff5a5a' : diff >= 1 ? '#ffb070' : diff >= -2 ? '#ffe28a' : diff >= -5 ? '#8fe08f' : '#b0b0b0';
      }
      ctx.fillStyle = e.type === 'player' ? '#e8f4ff' : e.type === 'party' ? '#a6f0a8' : isMob ? mobCol : '#f6e7a6';
      ctx.fillText(label, x, nameY);

      if (e.marker) {
        const my = nameY - 14 + Math.sin(now * 3) * 3;
        ctx.font = '700 28px Georgia, serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 5;
        ctx.strokeText(e.marker, x, my);
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(e.marker, x, my);
      }
    },

    _drawDebug(ctx) {
      const R = Renderer;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(R.viewW - 252, R.viewH - 78, 244, 70);
      ctx.fillStyle = '#9fe8a0';
      const T = MEO.Terrain;
      ctx.fillText('3D  ' + R.canvas.width + 'x' + R.canvas.height + '  scale ' + R.scale.toFixed(2), R.viewW - 246, R.viewH - 60);
      ctx.fillText('chunks ' + R.stats.chunks + '/' + T.chunks.length + '  entities ' + R.stats.entities, R.viewW - 246, R.viewH - 44);
      ctx.fillText('verts ' + T.stats.verts + '  partikler ' + MEO.FX3D.parts.length, R.viewW - 246, R.viewH - 28);
      ctx.fillText('camera yaw ' + R.camera.yaw.toFixed(2) + ' pitch ' + R.camera.pitch.toFixed(2), R.viewW - 246, R.viewH - 12);
      ctx.textAlign = 'center';
    }
  });
})();
