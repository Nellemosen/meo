/* ==========================================================================
   core/fx3d.js – 3D-effekter: projektiler, hug, ringe, particles, statusfx,
   target ring, blob shadows, campfires and torches.
   Everything is drawn as billboards/ribbons in three batches (ground, alpha, additive).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;
  const GL = MEO.GL;
  const Events = MEO.Events;
  const TAU = Math.PI * 2;
  const PX = 1 / 16;

  const now = function () {
    return performance.now() / 1000;
  };
  const rnd = Math.random;

  function rgbOf(c) {
    return GL.rgb(c || '#ffffff');
  }

  const FX3D = (MEO.FX3D = {
    parts: [],
    extra: [],   // extra render callbacks (R, gB, aB, t) from other modules (hazards)
    effects: [],
    emitAcc: Object.create(null),
    right: [1, 0, 0],
    up: [0, 1, 0],
    camPos: [0, 0, 0],
    _ready: false,
    maxParts: 1600,

    init() {
      FX3D.decal = new GL.DynBatch(9000);
      FX3D.alpha = new GL.DynBatch(12000);
      FX3D.glow = new GL.DynBatch(14000);
      FX3D.tex = GL.makeFxTexture();
      FX3D.prog = GL.compile(GL.SRC.fxVS, GL.SRC.fxFS, GL.FX_UNIFORMS);
      FX3D._ready = true;

      Events.on('fx', FX3D._onFx);
      Events.on('death', function (d) {
        const e = d.entity;
        const p = FX3D.pos(e, 0.9);
        const dummy = e.shape === 'dummy';
        FX3D.burst(p[0], p[1], p[2], dummy ? '#d8bf72' : '#c04030', 16, { alpha: true, speed: 2.4, grav: 7, size: 0.18 });
        FX3D.burst(p[0], p[1] - 0.3, p[2], '#8a8070', 8, { alpha: true, speed: 1.2, grav: -0.4, size: 0.5, life: 0.9, a: 0.35 });
      });
      Events.on('buff:apply', function (d) {
        const B = MEO.Buffs;
        const e = d.target;
        if (B.has(e, 'incapacitate')) {
          const p = FX3D.pos(e, 1.0);
          FX3D.burst(p[0], p[1], p[2], '#ff9ad0', 22, { speed: 3, grav: 1, size: 0.3, life: 0.8 });
          FX3D.burst(p[0], p[1], p[2], '#ffffff', 10, { alpha: true, speed: 2.2, grav: -0.5, size: 0.7, life: 0.6, a: 0.5 });
        }
        if (B.has(e, 'stun')) {
          const p = FX3D.pos(e, 1.0);
          FX3D.burst(p[0], p[1], p[2], '#ffd34d', 8, { speed: 2.0, size: 0.22 });
        }
      });
      Events.on('buff:remove', function (d) {
        if (d.buff && d.buff.def && d.buff.def.flags && d.buff.def.flags.indexOf('incapacitate') >= 0) {
          const p = FX3D.pos(d.target, 1.0);
          FX3D.burst(p[0], p[1], p[2], '#ffffff', 12, { alpha: true, speed: 2, size: 0.6, life: 0.5, a: 0.4 });
        }
      });
    },

    reset() {
      FX3D.parts.length = 0;
      FX3D.effects.length = 0;
    },

    // ---- Helpers -----------------------------------------------------------
    /** World position [x,y,z] (meters) of a creature, h meters above the ground. */
    pos(e, h) {
      const T = MEO.Terrain;
      let x = e._rx, y = e._ry, z = e._rz;
      if (x === undefined) {
        x = e.x * PX;
        z = e.y * PX;
        y = T.heightAt(e.x, e.y);
      }
      return [x, y + (h || 0), z];
    },

    groundY(xm, zm) {
      return MEO.Terrain.heightAtM(xm, zm);
    },

    spawn(p) {
      if (FX3D.parts.length >= FX3D.maxParts) FX3D.parts.shift();
      p.t0 = now();
      FX3D.parts.push(p);
      return p;
    },

    burst(x, y, z, color, n, o) {
      o = o || {};
      if (MEO.Settings) n = Math.max(1, Math.round(n * MEO.Settings.fxScale()));
      const c = rgbOf(color);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const el = (rnd() - 0.3) * 1.4;
        const sp = (o.speed || 2) * (0.35 + rnd() * 0.75);
        FX3D.spawn({
          x: x + (rnd() - 0.5) * 0.2, y: y, z: z + (rnd() - 0.5) * 0.2,
          vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp + (o.up || 0.8), vz: Math.sin(a) * Math.cos(el) * sp,
          g: o.grav === undefined ? 4 : o.grav,
          life: (o.life || 0.6) * (0.7 + rnd() * 0.6),
          s0: (o.size || 0.2) * (0.7 + rnd() * 0.6), s1: o.size1 === undefined ? 0.02 : o.size1,
          r: c[0], g2: c[1], b: c[2], a: o.a === undefined ? 0.95 : o.a,
          alpha: !!o.alpha
        });
      }
    },

    // ---- Event: effects ------------------------------------------------------
    _onFx(d) {
      const t = now();
      const c = rgbOf(d.color);
      switch (d.kind) {
        case 'bolt':
          if (!d.src || !d.tgt) return;
          FX3D.effects.push({ kind: 'bolt', src: d.src, tgt: d.tgt, c: c, t0: t, life: 0.26, hit: false, sp: FX3D.pos(d.src, 1.3) });
          break;
        case 'slash': {
          if (!d.src || !d.tgt) return;
          FX3D.effects.push({
            kind: 'slash', src: d.src, tgt: d.tgt, c: c, t0: t, life: 0.24,
            ang: Math.atan2(d.tgt.y - d.src.y, d.tgt.x - d.src.x), hit: false
          });
          break;
        }
        case 'ring':
          FX3D.effects.push({ kind: 'ring', x: d.x * PX, z: d.y * PX, r: Math.max(1.2, (d.radius || 40) * PX), c: c, t0: t, life: 0.6 });
          FX3D.effects[FX3D.effects.length - 1].made = false;
          break;
        case 'sparkle': {
          const e = d.tgt || d.src;
          if (!e) return;
          const p = FX3D.pos(e, 0);
          for (let i = 0; i < 12; i++) {
            const a = rnd() * TAU;
            const r = 0.2 + rnd() * 0.45;
            FX3D.spawn({
              x: p[0] + Math.cos(a) * r, y: p[1] + 0.1 + rnd() * 0.6, z: p[2] + Math.sin(a) * r,
              vx: 0, vy: 0.9 + rnd() * 1.1, vz: 0, g: 0,
              life: 0.8 + rnd() * 0.4, s0: 0.2 + rnd() * 0.12, s1: 0.03, r: c[0], g2: c[1], b: c[2], a: 0.9
            });
          }
          FX3D.effects.push({ kind: 'column', ent: e, c: c, t0: t, life: 0.7 });
          break;
        }
        case 'blink': {
          const x = d.x * PX, z = d.y * PX;
          const y = FX3D.groundY(x, z);
          FX3D.burst(x, y + 1.0, z, d.color, 22, { speed: 3, grav: 1.5, size: 0.28, life: 0.7 });
          FX3D.effects.push({ kind: 'ring', x: x, z: z, r: 1.5, c: c, t0: t, life: 0.45 });
          break;
        }
        default:
          break;
      }
    },

    // =====================================================================
    //  Drawing
    // =====================================================================
    /** Billboard sprite (glow). */
    sprite(b, x, y, z, size, r, g, bl, a, rot, uv) {
      const R = FX3D.right, Up = FX3D.up;
      const u = uv || GL.UV_GLOW;
      const col = GL.pack(r, g, bl, a * 255);
      const h = size / 2;
      let rx = R[0] * h, ry = R[1] * h, rz = R[2] * h;
      let ux = Up[0] * h, uy = Up[1] * h, uz = Up[2] * h;
      if (rot) {
        const c = Math.cos(rot), s = Math.sin(rot);
        const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s;
        ux = ux * c - rx * s; uy = uy * c - ry * s; uz = uz * c - rz * s;
        rx = nrx; ry = nry; rz = nrz;
      }
      b.quad([x - rx - ux, y - ry - uy, z - rz - uz], [x + rx - ux, y + ry - uy, z + rz - uz],
        [x + rx + ux, y + ry + uy, z + rz + uz], [x - rx + ux, y - ry + uy, z - rz + uz], u[0], u[1], u[2], u[3], col);
    },

    /** Ribbon along a circular arc on the ground (draped over the terrain). */
    ring(b, cx, cz, r0, r1, a0, a1, rgba, yoff) {
      const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(r1, 0.5) * 3));
      const u = GL.UV_SOLID;
      const uu = (u[0] + u[2]) / 2, vv = (u[1] + u[3]) / 2;
      let px0, pz0, px1, pz1;
      yoff = yoff === undefined ? 0.08 : yoff;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const c = Math.cos(a), s = Math.sin(a);
        const ax = cx + c * r0, az = cz + s * r0, bx = cx + c * r1, bz = cz + s * r1;
        if (i > 0) {
          const y0 = FX3D.groundY(px0, pz0) + yoff, y1 = FX3D.groundY(px1, pz1) + yoff;
          const y2 = FX3D.groundY(bx, bz) + yoff, y3 = FX3D.groundY(ax, az) + yoff;
          b.quad([px0, y0, pz0], [px1, y1, pz1], [bx, y2, bz], [ax, y3, az], uu, vv, uu, vv, rgba);
        }
        px0 = ax; pz0 = az; px1 = bx; pz1 = bz;
      }
    },

    /** Filled disc on the ground (soft) – used for glow under rings. */
    disc(b, cx, cz, r, rgba, yoff) {
      const y = FX3D.groundY(cx, cz) + (yoff === undefined ? 0.06 : yoff);
      const u = GL.UV_GLOW;
      b.quad([cx - r, y, cz - r], [cx + r, y, cz - r], [cx + r, y, cz + r], [cx - r, y, cz + r], u[0], u[1], u[2], u[3], rgba);
    },

    update(dt, camera, R) {
      const parts = FX3D.parts;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const age = now() - p.t0;
        if (age >= p.life) {
          parts.splice(i, 1);
        }
      }
    },

    render(R) {
      if (!FX3D._ready) return;
      const gl = GL.ctx;
      const view = R.view;
      FX3D.right = [view[0], view[4], view[8]];
      FX3D.up = [view[1], view[5], view[9]];
      FX3D.camPos = R.camPos;
      const t = now();
      const dB = FX3D.decal, aB = FX3D.alpha, gB = FX3D.glow;
      dB.reset(); aB.reset(); gB.reset();

      FX3D._shadows(R, dB);
      FX3D._targetRing(R, gB, aB, t);
      FX3D._entityStatus(R, gB, aB, dB, t);
      FX3D._effects(R, gB, aB, t);
      for (let i = 0; i < FX3D.extra.length; i++) FX3D.extra[i](R, gB, aB, t);
      FX3D._emitters(R, gB, aB, t);
      FX3D._particles(gB, aB, t);

      gl.useProgram(FX3D.prog.prog);
      gl.uniformMatrix4fv(FX3D.prog.u.u_vp, false, R.vp);
      gl.uniform3fv(FX3D.prog.u.u_cam, R.camPos);
      gl.uniform1f(FX3D.prog.u.u_fogDen, R.fogDen);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, FX3D.tex);
      gl.uniform1i(FX3D.prog.u.u_tex, 0);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      dB.flush();
      aB.flush();
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gB.flush();
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
    },

    // ---- blob shadows --------------------------------------------------------
    _shadows(R, b) {
      const list = R.visible;
      const u = GL.UV_GLOW;
      const col = GL.pack(0, 0, 0, 120);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const x = e._rx, z = e._rz;
        const r = Math.max(0.55, e.radius * PX * 1.55) * (e.alive ? 1 : 0.9);
        const y = e._ry + 0.05;
        // slight slope: sample heights at four corners
        const y0 = FX3D.groundY(x - r, z - r) + 0.05, y1 = FX3D.groundY(x + r, z - r) + 0.05;
        const y2 = FX3D.groundY(x + r, z + r) + 0.05, y3 = FX3D.groundY(x - r, z + r) + 0.05;
        b.quad([x - r, Math.max(y0, y - 0.0), z - r], [x + r, y1, z - r], [x + r, y2, z + r], [x - r, y3, z + r], u[0], u[1], u[2], u[3], col);
      }
    },

    // ---- target ring -----------------------------------------------------------
    _targetRing(R, gB, aB, t) {
      const e = MEO.Targeting ? MEO.Targeting.target : null;
      if (!e || !e.alive || e._rx === undefined) return;
      const hostile = e.faction === 'hostile';
      const c = hostile ? [255, 70, 60] : e.faction === 'friendly' ? [255, 214, 80] : [90, 220, 110];
      const r = e.radius * PX + 0.6 + Math.sin(t * 5) * 0.04;
      const col = GL.pack(c[0], c[1], c[2], 235);
      const colSoft = GL.pack(c[0], c[1], c[2], 60);
      FX3D.disc(aB, e._rx, e._rz, r * 1.25, colSoft, 0.07);
      // broken ring that rotates
      const n = 8;
      const rot = t * 0.9;
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * TAU;
        FX3D.ring(aB, e._rx, e._rz, r - 0.05, r + 0.07, a0, a0 + (TAU / n) * 0.62, col, 0.1);
      }
      FX3D.ring(aB, e._rx, e._rz, r + 0.13, r + 0.17, 0, TAU, GL.pack(c[0], c[1], c[2], 110), 0.1);
    },

    // ---- status FX per creature --------------------------------------------------
    _entityStatus(R, gB, aB, dB, t) {
      const list = R.visible;
      const B = MEO.Buffs;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        const x = e._rx, y = e._ry, z = e._rz;
        const H = MEO.Models.heightOf(e);

        // Casting: ring rune under the feet and sparks in the hand
        if (e.cast) {
          const col = rgbOf(e.cast.def.color);
          const p = Math.min(1, (MEO.Engine.time - e.cast.start) / (e.cast.end - e.cast.start));
          const r = 0.9;
          FX3D.ring(gB, x, z, r - 0.05, r + 0.04, t * 1.5, t * 1.5 + TAU * (0.2 + 0.6 * p), GL.pack(col[0], col[1], col[2], 210), 0.09);
          FX3D.ring(gB, x, z, r * 0.62, r * 0.66, -t * 2.2, -t * 2.2 + TAU * 0.7, GL.pack(col[0], col[1], col[2], 150), 0.09);
          FX3D.disc(gB, x, z, r * 1.1, GL.pack(col[0], col[1], col[2], 38 + 30 * p), 0.07);
          const a = rnd() * TAU;
          FX3D.spawn({
            x: x + Math.cos(a) * 0.55, y: y + 0.1, z: z + Math.sin(a) * 0.55, vx: -Math.cos(a) * 0.3, vy: 1.4 + rnd(), vz: -Math.sin(a) * 0.3,
            g: 0, life: 0.6, s0: 0.16, s1: 0.02, r: col[0], g2: col[1], b: col[2], a: 0.9
          });
          const hp = MEO.Models.handPos(e, [0, 0, 0]);
          if (hp) {
            FX3D.sprite(gB, hp[0] + 0, hp[1] + 0.2, hp[2], 0.5 + 0.2 * Math.sin(t * 14), col[0], col[1], col[2], 0.55);
          }
        }

        if (!e.buffs.length) continue;
        if (B.has(e, 'stun')) {
          for (let k = 0; k < 3; k++) {
            const a = t * 4.5 + (k * TAU) / 3;
            FX3D.sprite(gB, x + Math.cos(a) * 0.38, y + H + 0.18 + Math.sin(a * 2) * 0.03, z + Math.sin(a) * 0.38, 0.28, 255, 220, 80, 0.95, t * 3, GL.UV_GLOW);
          }
        }
        if (B.has(e, 'incapacitate')) {
          FX3D.sprite(gB, x, y + 0.9, z, 1.9, 255, 150, 210, 0.16 + 0.06 * Math.sin(t * 4));
          for (let k = 0; k < 2; k++) {
            const a = t * 2.2 + k * Math.PI;
            FX3D.sprite(gB, x + Math.cos(a) * 0.45, y + 1.5 + Math.sin(t * 3 + k) * 0.08, z + Math.sin(a) * 0.45, 0.2, 255, 170, 220, 0.9);
          }
        }
        if (B.has(e, 'root')) {
          const col = GL.pack(168, 228, 255, 230);
          FX3D.ring(aB, x, z, 0.6, 0.78, 0, TAU, col, 0.09);
          FX3D.disc(gB, x, z, 1.1, GL.pack(120, 200, 255, 70), 0.08);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU + 0.4;
            FX3D.sprite(aB, x + Math.cos(a) * 0.72, y + 0.22, z + Math.sin(a) * 0.72, 0.3, 200, 240, 255, 0.85, 0, GL.UV_GLOW);
          }
        }
        for (let k = 0; k < e.buffs.length; k++) {
          if (e.buffs[k].shield > 0) {
            FX3D.sprite(gB, x, y + H * 0.55, z, H * 1.35, 130, 190, 255, 0.14 + 0.05 * Math.sin(t * 6 + k));
            break;
          }
        }
      }
    },

    // ---- timed effects -------------------------------------------------
    _effects(R, gB, aB, t) {
      const list = FX3D.effects;
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        const p = (t - f.t0) / f.life;
        if (p >= 1 || (f.src && f.tgt && f.src._rx === undefined && f.tgt._rx === undefined)) {
          if (f.kind === 'bolt' && !f.hit && f.tgt && f.tgt._rx !== undefined) FX3D._boltHit(f);
          list.splice(i, 1);
          continue;
        }
        const c = f.c;
        if (f.kind === 'bolt') {
          const a = f.sp;
          const hp = f.src._handM ? MEO.Models.handPos(f.src, [0, 0, 0]) : null;
          const sx = hp ? hp[0] : a[0], sy = hp ? hp[1] + 0.1 : a[1], sz = hp ? hp[2] : a[2];
          const tp = FX3D.pos(f.tgt, 1.15);
          const e = Math.min(1, p * 1.15);
          for (let k = 0; k < 9; k++) {
            const q = Math.max(0, e - k * 0.045);
            const x = sx + (tp[0] - sx) * q, y = sy + (tp[1] - sy) * q + Math.sin(q * Math.PI) * 0.25, z = sz + (tp[2] - sz) * q;
            const fall = 1 - k / 9;
            FX3D.sprite(gB, x, y, z, 0.55 * fall + 0.1, c[0], c[1], c[2], 0.7 * fall);
            if (k === 0) FX3D.sprite(gB, x, y, z, 0.28, 255, 255, 255, 1);
          }
          if (p > 0.85 && !f.hit) {
            f.hit = true;
            FX3D._boltHit(f);
          }
        } else if (f.kind === 'slash') {
          const src = FX3D.pos(f.src, 1.15);
          const tg = FX3D.pos(f.tgt, 1.15);
          const base = Math.atan2(tg[2] - src[2], tg[0] - src[0]);
          const reach = Math.min(1.7, Math.hypot(tg[0] - src[0], tg[2] - src[2]) * 0.8 + 0.3);
          const head = -1.1 + 2.2 * Math.min(1, p * 1.5);
          const tail = Math.max(-1.1, head - 1.1);
          const al = Math.round((1 - p) * 230);
          const n = 12;
          for (let k = 0; k < n; k++) {
            const a0 = base + tail + ((head - tail) * k) / n, a1 = base + tail + ((head - tail) * (k + 1)) / n;
            const w = (k + 1) / n;
            const col = GL.pack(c[0], c[1], c[2], al * w);
            const r0 = reach * 0.62, r1 = reach * (0.62 + 0.32 * w);
            const tilt = 0.55;
            const ptA = [src[0] + Math.cos(a0) * r0, src[1] + 0.3 + Math.sin((k / n) * 3) * 0.35 - tilt * 0.2, src[2] + Math.sin(a0) * r0];
            const ptB = [src[0] + Math.cos(a1) * r0, src[1] + 0.3 + Math.sin(((k + 1) / n) * 3) * 0.35 - tilt * 0.2, src[2] + Math.sin(a1) * r0];
            const ptC = [src[0] + Math.cos(a1) * r1, ptB[1] + 0.05, src[2] + Math.sin(a1) * r1];
            const ptD = [src[0] + Math.cos(a0) * r1, ptA[1] + 0.05, src[2] + Math.sin(a0) * r1];
            const u = GL.UV_SOLID;
            gB.quad(ptA, ptB, ptC, ptD, u[0], u[1], u[2], u[3], col);
          }
          if (p > 0.5 && !f.hit) {
            f.hit = true;
            FX3D.burst(tg[0], tg[1], tg[2], '#ffffff', 5, { speed: 2.4, size: 0.12, life: 0.3, grav: 6 });
            FX3D.burst(tg[0], tg[1], tg[2], '#' + ((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0'), 6, { speed: 2.0, size: 0.14, life: 0.35, grav: 6 });
          }
        } else if (f.kind === 'ring') {
          const r = f.r * (0.25 + 0.75 * Math.sqrt(p));
          const al = (1 - p);
          FX3D.ring(gB, f.x, f.z, r - 0.1, r + 0.08, 0, TAU, GL.pack(c[0], c[1], c[2], 230 * al), 0.12);
          FX3D.disc(gB, f.x, f.z, r * 1.05, GL.pack(c[0], c[1], c[2], 90 * al), 0.1);
          if (!f.made) {
            f.made = true;
            const y = FX3D.groundY(f.x, f.z);
            const nn = Math.min(22, Math.round(f.r * 6));
            for (let k = 0; k < nn; k++) {
              const a = (k / nn) * TAU;
              FX3D.spawn({
                x: f.x + Math.cos(a) * f.r * 0.8, y: y + 0.1, z: f.z + Math.sin(a) * f.r * 0.8,
                vx: Math.cos(a) * 0.5, vy: 1.2 + rnd() * 1.4, vz: Math.sin(a) * 0.5, g: 0,
                life: 0.7 + rnd() * 0.3, s0: 0.2, s1: 0.03, r: c[0], g2: c[1], b: c[2], a: 0.85
              });
            }
          }
        } else if (f.kind === 'column') {
          const pp = FX3D.pos(f.ent, 0);
          const al = Math.sin(p * Math.PI);
          for (let k = 0; k < 5; k++) {
            FX3D.sprite(gB, pp[0], pp[1] + 0.2 + k * 0.45 + p * 0.8, pp[2], 1.0 - k * 0.12, c[0], c[1], c[2], 0.2 * al);
          }
        }
      }
    },

    _boltHit(f) {
      const tg = FX3D.pos(f.tgt, 1.1);
      const col = '#' + ((f.c[0] << 16) | (f.c[1] << 8) | f.c[2]).toString(16).padStart(6, '0');
      FX3D.burst(tg[0], tg[1], tg[2], col, 10, { speed: 2.6, size: 0.2, life: 0.45, grav: 3 });
      FX3D.burst(tg[0], tg[1], tg[2], '#ffffff', 4, { speed: 1.6, size: 0.16, life: 0.3 });
      FX3D.effects.push({ kind: 'flash', x: tg[0], y: tg[1], z: tg[2], c: f.c, t0: now(), life: 0.2 });
      f.hit = true;
    },

    // ---- campfires, torches and ruin lights ---------------------------------------------------
    _emitters(R, gB, aB, t) {
      const em = MEO.Terrain.emitters;
      const cam = R.camPos;
      const dt = R.dt || 0.016;
      for (let i = 0; i < em.length; i++) {
        const e = em[i];
        const dx = e.x - cam[0], dz = e.z - cam[2];
        if (dx * dx + dz * dz > 70 * 70) continue;
        const fl = 0.85 + 0.15 * Math.sin(t * 13 + e.seed * 3) * Math.sin(t * 7.3 + e.seed);
        let rate = 0;
        if (e.kind === 'fire') {
          FX3D.sprite(gB, e.x, e.y + 0.6, e.z, 6.5 * fl, 255, 130, 40, 0.1);
          FX3D.sprite(gB, e.x, e.y + 0.35, e.z, 1.7 * fl, 255, 190, 80, 0.5);
          rate = 42;
        } else if (e.kind === 'torch') {
          FX3D.sprite(gB, e.x, e.y + 0.1, e.z, 3.2 * fl, 255, 150, 60, 0.12);
          FX3D.sprite(gB, e.x, e.y, e.z, 0.5 * fl, 255, 200, 110, 0.7);
          rate = 14;
        } else if (e.kind === 'ruinlight') {
          const pu = 0.65 + 0.35 * Math.sin(t * 1.4);
          FX3D.sprite(gB, e.x, e.y, e.z, 5.5 * pu, 90, 230, 200, 0.16);
          FX3D.sprite(gB, e.x, e.y, e.z, 1.2 * pu, 190, 255, 240, 0.55);
          rate = 6;
        }
        let acc = (FX3D.emitAcc[i] || 0) + rate * dt;
        while (acc >= 1) {
          acc -= 1;
          if (e.kind === 'ruinlight') {
            const a = rnd() * TAU, r = 0.5 + rnd() * 1.4;
            FX3D.spawn({ x: e.x + Math.cos(a) * r, y: e.y - 1.5 + rnd(), z: e.z + Math.sin(a) * r, vx: 0, vy: 0.5 + rnd() * 0.5, vz: 0, g: 0, life: 2.2, s0: 0.14, s1: 0.02, r: 140, g2: 255, b: 225, a: 0.8 });
          } else {
            const big = e.kind === 'fire';
            const j = big ? 0.22 : 0.05;
            FX3D.spawn({
              x: e.x + (rnd() - 0.5) * j * 2, y: e.y, z: e.z + (rnd() - 0.5) * j * 2,
              vx: (rnd() - 0.5) * 0.3, vy: (big ? 1.3 : 0.9) + rnd() * 0.8, vz: (rnd() - 0.5) * 0.3, g: 0,
              life: 0.45 + rnd() * 0.4, s0: big ? 0.42 : 0.2, s1: 0.04, r: 255, g2: 120 + rnd() * 70, b: 40, a: 0.85
            });
            if (big && rnd() < 0.2) {
              FX3D.spawn({ x: e.x, y: e.y + 0.8, z: e.z, vx: (rnd() - 0.5) * 0.4, vy: 0.9, vz: (rnd() - 0.5) * 0.4, g: 0, life: 2.2, s0: 0.3, s1: 1.3, r: 80, g2: 78, b: 76, a: 0.22, alpha: true });
            }
          }
        }
        FX3D.emitAcc[i] = acc;
      }
      // flash effects (timed)
      const list = FX3D.effects;
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        if (f.kind !== 'flash') continue;
        const p = (t - f.t0) / f.life;
        if (p >= 1) continue;
        FX3D.sprite(gB, f.x, f.y, f.z, 1.4 * (1 - p) + 0.3, f.c[0], f.c[1], f.c[2], (1 - p) * 0.8);
        FX3D.sprite(gB, f.x, f.y, f.z, 0.6 * (1 - p), 255, 255, 255, (1 - p));
      }
    },

    // ---- particles -----------------------------------------------------------------
    _particles(gB, aB, t) {
      const parts = FX3D.parts;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const age = t - p.t0;
        if (age >= p.life) continue;
        const k = age / p.life;
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age - 0.5 * p.g * age * age;
        const z = p.z + p.vz * age;
        const s = p.s0 + (p.s1 - p.s0) * k;
        const a = p.a * (1 - k * k);
        FX3D.sprite(p.alpha ? aB : gB, x, y, z, s, p.r, p.g2, p.b, a);
      }
    }
  });
})();
