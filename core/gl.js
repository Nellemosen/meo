/* ==========================================================================
   core/gl.js – Small, self-contained WebGL2 engine (no external libraries)
   Indeholder: matrixmatematik (M4), MeshBuilder (flad-shadede low-poly figurer),
   dynamic batches for effects, shaders and helper functions.
   Coordinates: X = east, Y = up, Z = south. 1 unit ≈ 1 meter.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const GL = (MEO.GL = {});

  // ======================================================================
  //  Matrices (column-major Float32Array(16), as WebGL expects)
  // ======================================================================
  const M4 = (GL.M4 = {
    create() {
      const m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    identity(m) {
      m.fill(0);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    /** o = a * b (o may be a or b) */
    multiply(o, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
        o[c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
        o[c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
        o[c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
      }
      return o;
    },
    perspective(o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2);
      o.fill(0);
      o[0] = f / aspect;
      o[5] = f;
      o[10] = (far + near) / (near - far);
      o[11] = -1;
      o[14] = (2 * far * near) / (near - far);
      return o;
    },
    lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
      let zx = ex - cx, zy = ey - cy, zz = ez - cz;
      let l = Math.hypot(zx, zy, zz) || 1;
      zx /= l; zy /= l; zz /= l;
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
      l = Math.hypot(xx, xy, xz) || 1;
      xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * ex + xy * ey + xz * ez);
      o[13] = -(yx * ex + yy * ey + yz * ez);
      o[14] = -(zx * ex + zy * ey + zz * ez);
      o[15] = 1;
      return o;
    },
    invert(o, m) {
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
      const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
      const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },
    /** o = m * Translate */
    translate(o, m, x, y, z) {
      if (o !== m) o.set(m);
      o[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
      o[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
      o[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
      o[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
      return o;
    },
    /** o = m * Scale */
    scale(o, m, x, y, z) {
      for (let i = 0; i < 4; i++) {
        o[i] = m[i] * x;
        o[4 + i] = m[4 + i] * y;
        o[8 + i] = m[8 + i] * z;
        o[12 + i] = m[12 + i];
      }
      return o;
    },
    rotateX(o, m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      if (o !== m) o.set(m);
      o[4] = a10 * c + a20 * s; o[5] = a11 * c + a21 * s; o[6] = a12 * c + a22 * s; o[7] = a13 * c + a23 * s;
      o[8] = a20 * c - a10 * s; o[9] = a21 * c - a11 * s; o[10] = a22 * c - a12 * s; o[11] = a23 * c - a13 * s;
      return o;
    },
    rotateY(o, m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      if (o !== m) o.set(m);
      o[0] = a00 * c - a20 * s; o[1] = a01 * c - a21 * s; o[2] = a02 * c - a22 * s; o[3] = a03 * c - a23 * s;
      o[8] = a00 * s + a20 * c; o[9] = a01 * s + a21 * c; o[10] = a02 * s + a22 * c; o[11] = a03 * s + a23 * c;
      return o;
    },
    rotateZ(o, m, a) {
      const s = Math.sin(a), c = Math.cos(a);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      if (o !== m) o.set(m);
      o[0] = a00 * c + a10 * s; o[1] = a01 * c + a11 * s; o[2] = a02 * c + a12 * s; o[3] = a03 * c + a13 * s;
      o[4] = a10 * c - a00 * s; o[5] = a11 * c - a01 * s; o[6] = a12 * c - a02 * s; o[7] = a13 * c - a03 * s;
      return o;
    },
    /** Transform point (x,y,z) by m; writes to out[0..2]. */
    point(m, x, y, z, out) {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      out[3] = w;
      return out;
    }
  });

  // ======================================================================
  //  Colors
  // ======================================================================
  GL.rgb = function (hex) {
    if (Array.isArray(hex)) return hex;
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  GL.shade = function (c, k) {
    c = GL.rgb(c);
    return [Math.max(0, Math.min(255, c[0] * k)), Math.max(0, Math.min(255, c[1] * k)), Math.max(0, Math.min(255, c[2] * k))];
  };
  GL.mix = function (a, b, t) {
    a = GL.rgb(a);
    b = GL.rgb(b);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  GL.pack = function (r, g, b, a) {
    return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  };

  // ======================================================================
  //  MeshBuilder – collects triangles with flat normals and vertex colors
  //  Vertex: pos(3f) + normal(3 signed byte + pad) + color(4 ubyte, a = AO)
  // ======================================================================
  class MeshBuilder {
    constructor() {
      this.p = []; // x,y,z per vertex
      this.n = []; // nx,ny,nz
      this.c = []; // r,g,b,a (0..255)
      this.m = null; // current transformation (Float32Array) or null
      this.stack = [];
    }

    get vertCount() {
      return this.p.length / 3;
    }

    push() {
      this.stack.push(this.m ? this.m.slice() : null);
      return this;
    }
    pop() {
      this.m = this.stack.pop();
      return this;
    }
    _ensure() {
      if (!this.m) this.m = M4.create();
      return this.m;
    }
    translate(x, y, z) {
      const m = this._ensure();
      M4.translate(m, m, x, y, z);
      return this;
    }
    rotY(a) {
      const m = this._ensure();
      M4.rotateY(m, m, a);
      return this;
    }
    rotX(a) {
      const m = this._ensure();
      M4.rotateX(m, m, a);
      return this;
    }
    rotZ(a) {
      const m = this._ensure();
      M4.rotateZ(m, m, a);
      return this;
    }
    scale(x, y, z) {
      const m = this._ensure();
      M4.scale(m, m, x, y == null ? x : y, z == null ? x : z);
      return this;
    }

    /**
     * A single triangle. The hint point (hx,hy,hz) lies "inside" the shape – the normal is flipped away from it,
     * so the winding order can never be wrong. Colors: three [r,g,b,ao] arrays (or one).
     */
    tri(ax, ay, az, bx, by, bz, cx, cy, cz, c0, c1, c2, hx, hy, hz) {
      const m = this.m;
      if (m) {
        const t = tmp3;
        M4.point(m, ax, ay, az, t); ax = t[0]; ay = t[1]; az = t[2];
        M4.point(m, bx, by, bz, t); bx = t[0]; by = t[1]; bz = t[2];
        M4.point(m, cx, cy, cz, t); cx = t[0]; cy = t[1]; cz = t[2];
        if (hx !== undefined) {
          M4.point(m, hx, hy, hz, t); hx = t[0]; hy = t[1]; hz = t[2];
        }
      }
      let ux = bx - ax, uy = by - ay, uz = bz - az;
      let vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) return this;
      nx /= l; ny /= l; nz /= l;
      let flip = false;
      if (hx !== undefined) {
        const d = nx * (ax - hx) + ny * (ay - hy) + nz * (az - hz);
        if (d < 0) flip = true;
      }
      if (flip) {
        nx = -nx; ny = -ny; nz = -nz;
        let t;
        t = bx; bx = cx; cx = t;
        t = by; by = cy; cy = t;
        t = bz; bz = cz; cz = t;
        t = c1; c1 = c2; c2 = t;
      }
      c1 = c1 || c0;
      c2 = c2 || c0;
      const p = this.p, n = this.n, c = this.c;
      p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      c.push(c0[0], c0[1], c0[2], c0[3] === undefined ? 1 : c0[3],
        c1[0], c1[1], c1[2], c1[3] === undefined ? 1 : c1[3],
        c2[0], c2[1], c2[2], c2[3] === undefined ? 1 : c2[3]);
      return this;
    }

    /** Quad (a,b,c,d in order). */
    quad(a, b, c, d, ca, cb, cc, cd, hx, hy, hz) {
      this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], ca, cb, cc, hx, hy, hz);
      this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], ca, cc, cd, hx, hy, hz);
      return this;
    }

    /** Axis-aligned box, centered at (cx,cy,cz). aoBottom = brightness at the bottom. */
    box(cx, cy, cz, sx, sy, sz, color, aoBottom) {
      const col = GL.rgb(color);
      const top = [col[0], col[1], col[2], 1];
      const bot = [col[0], col[1], col[2], aoBottom === undefined ? 0.62 : aoBottom];
      const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
      const h = [cx, cy, cz];
      // +Y, -Y
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top, top, top, top, h[0], h[1], h[2]);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bot, bot, bot, bot, h[0], h[1], h[2]);
      // sides
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], bot, bot, top, top, h[0], h[1], h[2]);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], bot, bot, top, top, h[0], h[1], h[2]);
      this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], bot, bot, top, top, h[0], h[1], h[2]);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], bot, bot, top, top, h[0], h[1], h[2]);
      return this;
    }

    /** A grass blade / leaf: thin bent triangle with a base-to-tip colour gradient. */
    blade(x, y, z, h, w, ang, lean, cb, ct) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const bc = GL.rgb(cb), tc = GL.rgb(ct);
      const b0 = [bc[0], bc[1], bc[2], 0.55], b1 = [bc[0], bc[1], bc[2], 0.55], t0 = [tc[0], tc[1], tc[2], 1];
      const mid = [(bc[0] + tc[0]) / 2, (bc[1] + tc[1]) / 2, (bc[2] + tc[2]) / 2, 0.85];
      const lx = ca * lean * h, lz = sa * lean * h;
      const px = -sa * w, pz = ca * w;
      // two segments so the blade bends
      this.tri(x - px, y, z - pz, x + px, y, z + pz, x + lx * 0.35 + px * 0.6, y + h * 0.55, z + lz * 0.35 + pz * 0.6, b0, b1, mid, x, y + h * 0.5, z);
      this.tri(x - px, y, z - pz, x + lx * 0.35 + px * 0.6, y + h * 0.55, z + lz * 0.35 + pz * 0.6, x + lx * 0.35 - px * 0.6, y + h * 0.55, z + lz * 0.35 - pz * 0.6, b0, mid, mid, x, y + h * 0.5, z);
      this.tri(x + lx * 0.35 - px * 0.6, y + h * 0.55, z + lz * 0.35 - pz * 0.6, x + lx * 0.35 + px * 0.6, y + h * 0.55, z + lz * 0.35 + pz * 0.6, x + lx, y + h, z + lz, mid, mid, t0, x, y + h * 0.5, z);
      return this;
    }

    /** Truncated cone along +Y from y0 (base, radius rb) to y0+h (top, radius rt). */
    cyl(cx, y0, cz, rb, rt, h, seg, color, aoBottom, noCapTop, noCapBottom) {
      const col = GL.rgb(color);
      const top = [col[0], col[1], col[2], 1];
      const bot = [col[0], col[1], col[2], aoBottom === undefined ? 0.65 : aoBottom];
      const hx = cx, hy = y0 + h / 2, hz = cz;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const b0 = [cx + c0 * rb, y0, cz + s0 * rb], b1 = [cx + c1 * rb, y0, cz + s1 * rb];
        const t0 = [cx + c0 * rt, y0 + h, cz + s0 * rt], t1 = [cx + c1 * rt, y0 + h, cz + s1 * rt];
        if (rt > 1e-5) this.quad(b0, b1, t1, t0, bot, bot, top, top, hx, hy, hz);
        else this.tri(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], cx, y0 + h, cz, bot, bot, top, hx, hy, hz);
        if (!noCapTop && rt > 1e-5) this.tri(cx, y0 + h, cz, t0[0], t0[1], t0[2], t1[0], t1[1], t1[2], top, top, top, hx, hy, hz);
        if (rb > 1e-5 && !noCapBottom) this.tri(cx, y0, cz, b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], bot, bot, bot, hx, hy, hz);
      }
      return this;
    }

    cone(cx, y0, cz, r, h, seg, color, aoBottom, noCapBottom) {
      return this.cyl(cx, y0, cz, r, 0, h, seg, color, aoBottom, false, noCapBottom);
    }

    /** Low-poly blob (icosahedron, optionally subdivided) with irregularity. Radii rx,ry,rz. */
    blob(cx, cy, cz, rx, ry, rz, color, detail, jitter, seed, aoBottom) {
      const col = GL.rgb(color);
      const ico = icoMesh(detail || 0);
      const rnd = mulberry(seed || 1);
      const verts = ico.v.map(function (v) {
        const j = 1 + (jitter ? (rnd() - 0.5) * 2 * jitter : 0);
        return [cx + v[0] * rx * j, cy + v[1] * ry * j, cz + v[2] * rz * j, v[1]];
      });
      const ab = aoBottom === undefined ? 0.6 : aoBottom;
      const colOf = function (v) {
        const t = Math.max(0, Math.min(1, v[3] * 0.5 + 0.5));
        return [col[0], col[1], col[2], ab + (1 - ab) * t];
      };
      for (let i = 0; i < ico.f.length; i++) {
        const f = ico.f[i];
        const a = verts[f[0]], b = verts[f[1]], c = verts[f[2]];
        this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], colOf(a), colOf(b), colOf(c), cx, cy, cz);
      }
      return this;
    }

    /** Triangle with explicit (smooth) vertex normals; winding is corrected to match them. */
    stri(pa, pb, pc, na, nb, nc, ca, cb, cc) {
      const m = this.m;
      const t = tmp3;
      let P = [pa, pb, pc], N = [na, nb, nc], Cc = [ca, cb, cc];
      if (m) {
        P = P.map(function (q) {
          M4.point(m, q[0], q[1], q[2], t);
          return [t[0], t[1], t[2]];
        });
        N = N.map(function (q) {
          const x = m[0] * q[0] + m[4] * q[1] + m[8] * q[2];
          const y = m[1] * q[0] + m[5] * q[1] + m[9] * q[2];
          const z = m[2] * q[0] + m[6] * q[1] + m[10] * q[2];
          const l = Math.hypot(x, y, z) || 1;
          return [x / l, y / l, z / l];
        });
      }
      const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
      const vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * gx + gy * gy + gz * gz < 1e-14) return this;
      const dn = gx * (N[0][0] + N[1][0] + N[2][0]) + gy * (N[0][1] + N[1][1] + N[2][1]) + gz * (N[0][2] + N[1][2] + N[2][2]);
      if (dn < 0) {
        P = [P[0], P[2], P[1]];
        N = [N[0], N[2], N[1]];
        Cc = [Cc[0], Cc[2], Cc[1]];
      }
      for (let i = 0; i < 3; i++) {
        this.p.push(P[i][0], P[i][1], P[i][2]);
        this.n.push(N[i][0], N[i][1], N[i][2]);
        const c = Cc[i];
        this.c.push(c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]);
      }
      return this;
    }

    /**
     * Smooth surface of revolution around +Y at (cx,cy,cz). prof = [[r, y], ...] from bottom to top.
     * o: color, seg (default 14), xs/zs (cross-section scale, ellipse), ao0/ao1 (AO at bottom/top).
     */
    lathe(cx, cy, cz, prof, o) {
      o = o || {};
      const col = GL.rgb(o.color || [128, 128, 128]);
      const seg = o.seg || 14;
      const xs = o.xs || 1, zs = o.zs || 1;
      const ao0 = o.ao0 === undefined ? 0.7 : o.ao0, ao1 = o.ao1 === undefined ? 1 : o.ao1;
      const n = prof.length;
      let ymin = Infinity, ymax = -Infinity;
      prof.forEach(function (q) {
        if (q[1] < ymin) ymin = q[1];
        if (q[1] > ymax) ymax = q[1];
      });
      // profile normals (averaged over neighbouring segments)
      const pn = [];
      for (let i = 0; i < n; i++) {
        const a = prof[Math.max(0, i - 1)], b = prof[Math.min(n - 1, i + 1)];
        const dr = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dr, dy) || 1;
        pn.push([dy / l, -dr / l]);
      }
      const ring = [];
      for (let i = 0; i < n; i++) {
        const row = [];
        const t = ymax > ymin ? (prof[i][1] - ymin) / (ymax - ymin) : 1;
        const ao = ao0 + (ao1 - ao0) * t;
        const cc = [col[0], col[1], col[2], ao];
        for (let k = 0; k < seg; k++) {
          const a = (k / seg) * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          let nx = pn[i][0] * ca / xs, ny = pn[i][1], nz = pn[i][0] * sa / zs;
          const l = Math.hypot(nx, ny, nz) || 1;
          row.push({ p: [cx + prof[i][0] * ca * xs, cy + prof[i][1], cz + prof[i][0] * sa * zs], n: [nx / l, ny / l, nz / l], c: cc });
        }
        ring.push(row);
      }
      for (let i = 0; i < n - 1; i++) {
        for (let k = 0; k < seg; k++) {
          const k1 = (k + 1) % seg;
          const A = ring[i][k], B = ring[i][k1], C2 = ring[i + 1][k1], D = ring[i + 1][k];
          this.stri(A.p, B.p, C2.p, A.n, B.n, C2.n, A.c, B.c, C2.c);
          this.stri(A.p, C2.p, D.p, A.n, C2.n, D.n, A.c, C2.c, D.c);
        }
      }
      return this;
    }

    /** Smooth ellipsoid. */
    ellipsoid(cx, cy, cz, rx, ry, rz, color, seg, ao0, ao1) {
      const rings = Math.max(5, Math.round((seg || 12) * 0.6));
      const prof = [];
      for (let i = 0; i <= rings; i++) {
        const t = (i / rings) * Math.PI;
        prof.push([Math.sin(t), -Math.cos(t) * ry]);
      }
      return this.lathe(cx, cy, cz, prof, { color: color, seg: seg || 12, xs: rx, zs: rz, ao0: ao0 === undefined ? 0.75 : ao0, ao1: ao1 === undefined ? 1 : ao1 });
    }

    /** Tapered capsule along +Y from y0 (radius rb) to y0+h (radius rt) with round ends. */
    capsule(cx, y0, cz, rb, rt, h, color, seg, o) {
      o = o || {};
      const prof = [];
      const cap = 3;
      for (let i = 0; i <= cap; i++) {
        const t = (i / cap) * (Math.PI / 2);
        prof.push([Math.sin(t) * rb, y0 + rb - Math.cos(t) * rb]);
      }
      const mid = 2;
      for (let i = 1; i < mid; i++) {
        const f = i / mid;
        prof.push([rb + (rt - rb) * f, y0 + rb + (h - rb - rt) * f]);
      }
      for (let i = 0; i <= cap; i++) {
        const t = (i / cap) * (Math.PI / 2);
        prof.push([Math.cos(t) * rt, y0 + h - rt + Math.sin(t) * rt]);
      }
      return this.lathe(cx, 0, cz, prof, { color: color, seg: seg || 10, xs: o.xs, zs: o.zs, ao0: o.ao0, ao1: o.ao1 });
    }

    /** Smooth-shaded tapered cylinder (open or capped). */
    scyl(cx, y0, cz, rb, rt, h, color, seg, o) {
      o = o || {};
      const prof = [];
      if (!o.openBottom) prof.push([0, y0]);
      prof.push([rb, y0]);
      prof.push([rb + (rt - rb) * 0.5, y0 + h / 2]);
      prof.push([rt, y0 + h]);
      if (!o.openTop) prof.push([0, y0 + h]);
      // caps share normals with the side, so build them flat via a second pass
      const side = [[rb, y0], [rb + (rt - rb) * 0.5, y0 + h / 2], [rt, y0 + h]];
      this.lathe(cx, 0, cz, side, { color: color, seg: seg || 12, xs: o.xs, zs: o.zs, ao0: o.ao0, ao1: o.ao1 });
      const col = GL.rgb(color);
      const xs = o.xs || 1, zs = o.zs || 1;
      const capv = function (mb, y, r, ny, ao) {
        if (r < 1e-5) return;
        for (let k = 0; k < (seg || 12); k++) {
          const a0 = (k / (seg || 12)) * Math.PI * 2, a1 = ((k + 1) / (seg || 12)) * Math.PI * 2;
          const c = [col[0], col[1], col[2], ao];
          mb.stri([cx, y, cz], [cx + Math.cos(a0) * r * xs, y, cz + Math.sin(a0) * r * zs], [cx + Math.cos(a1) * r * xs, y, cz + Math.sin(a1) * r * zs],
            [0, ny, 0], [0, ny, 0], [0, ny, 0], c, c, c);
        }
      };
      if (!o.openTop) capv(this, y0 + h, rt, 1, 1);
      if (!o.openBottom) capv(this, y0, rb, -1, o.ao0 === undefined ? 0.7 : o.ao0);
      return this;
    }

    /** Gable roof over rectangle x0..x1, z0..z1 at height y; ridge along X if alongX. */
    /** Roof built from alternating bands (shingles / thatch courses) with a ridge beam. */
    roofBanded(x0, z0, x1, z1, y, h, color, alongX, over, bands) {
      bands = bands || 6;
      const base = this.roof(x0, z0, x1, z1, y, h, color, alongX, over);
      over = over || 0;
      x0 -= over; z0 -= over; x1 += over; z1 += over;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const dk = [color[0] * 0.78, color[1] * 0.78, color[2] * 0.78];
      for (let i = 1; i < bands; i++) {
        const t = i / bands;
        const yy = y + h * t + 0.03;
        if (alongX) {
          const zA = z0 + (cz - z0) * t, zB = z1 - (z1 - cz) * t;
          this.box(cx, yy, zA, x1 - x0 + 0.04, 0.07, 0.1, dk, 1);
          this.box(cx, yy, zB, x1 - x0 + 0.04, 0.07, 0.1, dk, 1);
        } else {
          const xA = x0 + (cx - x0) * t, xB = x1 - (x1 - cx) * t;
          this.box(xA, yy, cz, 0.1, 0.07, z1 - z0 + 0.04, dk, 1);
          this.box(xB, yy, cz, 0.1, 0.07, z1 - z0 + 0.04, dk, 1);
        }
      }
      // ridge beam and gable boards
      const rc = [86, 60, 40];
      if (alongX) this.box(cx, y + h + 0.06, cz, x1 - x0 + 0.3, 0.16, 0.2, rc, 1);
      else this.box(cx, y + h + 0.06, cz, 0.2, 0.16, z1 - z0 + 0.3, rc, 1);
      return base;
    }

    roof(x0, z0, x1, z1, y, h, color, alongX, over) {
      const col = GL.rgb(color);
      over = over || 0;
      x0 -= over; z0 -= over; x1 += over; z1 += over;
      const lo = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 0.75];
      const hi = [col[0], col[1], col[2], 1];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hint = [cx, y + h * 0.3, cz];
      if (alongX) {
        const r0 = [x0, y + h, cz], r1 = [x1, y + h, cz];
        this.quad([x0, y, z0], [x1, y, z0], r1, r0, lo, lo, hi, hi, hint[0], hint[1], hint[2]);
        this.quad([x0, y, z1], [x1, y, z1], r1, r0, lo, lo, hi, hi, hint[0], hint[1], hint[2]);
        this.tri(x0, y, z0, x0, y, z1, x0, y + h, cz, lo, lo, hi, hint[0], hint[1], hint[2]);
        this.tri(x1, y, z0, x1, y, z1, x1, y + h, cz, lo, lo, hi, hint[0], hint[1], hint[2]);
      } else {
        const r0 = [cx, y + h, z0], r1 = [cx, y + h, z1];
        this.quad([x0, y, z0], [x0, y, z1], r1, r0, lo, lo, hi, hi, hint[0], hint[1], hint[2]);
        this.quad([x1, y, z0], [x1, y, z1], r1, r0, lo, lo, hi, hi, hint[0], hint[1], hint[2]);
        this.tri(x0, y, z0, x1, y, z0, cx, y + h, z0, lo, lo, hi, hint[0], hint[1], hint[2]);
        this.tri(x0, y, z1, x1, y, z1, cx, y + h, z1, lo, lo, hi, hint[0], hint[1], hint[2]);
      }
      // underside, so the roof isn't hollow when seen from outside
      this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], lo, lo, lo, lo, cx, y + h, cz);
      return this;
    }

    /** Pack into a GPU-friendly ArrayBuffer. */
    pack() {
      const n = this.p.length / 3;
      const buf = new ArrayBuffer(n * 20);
      const f32 = new Float32Array(buf);
      const i8 = new Int8Array(buf);
      const u8 = new Uint8Array(buf);
      let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = this.p[i * 3], y = this.p[i * 3 + 1], z = this.p[i * 3 + 2];
        f32[i * 5] = x; f32[i * 5 + 1] = y; f32[i * 5 + 2] = z;
        i8[i * 20 + 12] = Math.round(this.n[i * 3] * 127);
        i8[i * 20 + 13] = Math.round(this.n[i * 3 + 1] * 127);
        i8[i * 20 + 14] = Math.round(this.n[i * 3 + 2] * 127);
        u8[i * 20 + 16] = this.c[i * 4];
        u8[i * 20 + 17] = this.c[i * 4 + 1];
        u8[i * 20 + 18] = this.c[i * 4 + 2];
        u8[i * 20 + 19] = Math.round(Math.max(0, Math.min(1, this.c[i * 4 + 3])) * 255);
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (z < minz) minz = z; if (z > maxz) maxz = z;
      }
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2;
      return {
        buf: buf, count: n,
        bounds: n ? { cx: cx, cy: cy, cz: cz, r: Math.hypot(maxx - minx, maxy - miny, maxz - minz) / 2 } : { cx: 0, cy: 0, cz: 0, r: 0 }
      };
    }
  }
  GL.MeshBuilder = MeshBuilder;
  const tmp3 = [0, 0, 0, 0];

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const icoCache = {};
  function icoMesh(detail) {
    if (icoCache[detail]) return icoCache[detail];
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const norm = function (p) {
      const l = Math.hypot(p[0], p[1], p[2]);
      return [p[0] / l, p[1] / l, p[2] / l];
    };
    v = v.map(norm);
    for (let d = 0; d < detail; d++) {
      const cache = {};
      const mid = function (a, b) {
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (cache[k] !== undefined) return cache[k];
        v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]));
        cache[k] = v.length - 1;
        return cache[k];
      };
      const nf = [];
      f.forEach(function (tri) {
        const a = mid(tri[0], tri[1]), b = mid(tri[1], tri[2]), c = mid(tri[2], tri[0]);
        nf.push([tri[0], a, c], [tri[1], b, a], [tri[2], c, b], [a, b, c]);
      });
      f = nf;
    }
    icoCache[detail] = { v: v, f: f };
    return icoCache[detail];
  }

  // ======================================================================
  //  GPU helpers
  // ======================================================================
  GL.ctx = null;

  GL.init = function (canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return null;
    GL.ctx = gl;
    return gl;
  };

  GL.createMesh = function (packed) {
    const gl = GL.ctx;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, packed.buf, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.bindVertexArray(null);
    return { vao: vao, vbo: vbo, count: packed.count, bounds: packed.bounds, buf: packed.buf };
  };

  GL.buildMesh = function (mb) {
    return mb.vertCount ? GL.createMesh(mb.pack()) : null;
  };

  GL.drawMesh = function (mesh) {
    const gl = GL.ctx;
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  };

  GL.compile = function (vs, fs, uniforms) {
    const gl = GL.ctx;
    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('Shader error: ' + log);
      }
      return s;
    }
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
    const u = {};
    uniforms.split(/\s+/).forEach(function (name) {
      if (name) u[name] = gl.getUniformLocation(p, name);
    });
    return { prog: p, u: u };
  };

  // ---- Dynamic batch for effects: pos(3f) uv(2f) color(4 ubyte) = 24 bytes ----
  class DynBatch {
    constructor(maxVerts) {
      const gl = GL.ctx;
      this.max = maxVerts;
      this.n = 0;
      this.buf = new ArrayBuffer(maxVerts * 24);
      this.f32 = new Float32Array(this.buf);
      this.u32 = new Uint32Array(this.buf);
      this.vao = gl.createVertexArray();
      this.vbo = gl.createBuffer();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.buf.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 20);
      gl.bindVertexArray(null);
    }
    reset() {
      this.n = 0;
    }
    full(extra) {
      return this.n + extra > this.max;
    }
    v(x, y, z, u, v, rgba) {
      const i = this.n * 6;
      const f = this.f32;
      f[i] = x; f[i + 1] = y; f[i + 2] = z; f[i + 3] = u; f[i + 4] = v;
      this.u32[i + 5] = rgba;
      this.n++;
    }
    /** Quad a-b-c-d with uv rectangle (u0,v0)-(u1,v1). */
    quad(a, b, c, d, u0, v0, u1, v1, rgba) {
      if (this.n + 6 > this.max) return;
      this.v(a[0], a[1], a[2], u0, v1, rgba);
      this.v(b[0], b[1], b[2], u1, v1, rgba);
      this.v(c[0], c[1], c[2], u1, v0, rgba);
      this.v(a[0], a[1], a[2], u0, v1, rgba);
      this.v(c[0], c[1], c[2], u1, v0, rgba);
      this.v(d[0], d[1], d[2], u0, v0, rgba);
    }
    flush() {
      if (!this.n) return;
      const gl = GL.ctx;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.n * 6);
      gl.drawArrays(gl.TRIANGLES, 0, this.n);
      this.n = 0;
    }
  }
  GL.DynBatch = DynBatch;

  // ======================================================================
  //  Shaders
  // ======================================================================
  const FOG = [
    'uniform vec3 u_cam;',
    'uniform vec3 u_fogCol;',
    'uniform float u_fogDen;',
    'vec3 applyFog(vec3 c, vec3 wp){',
    '  vec3 rd = wp - u_cam;',
    '  float dist = length(rd);',
    '  float d = dist * u_fogDen;',
    '  float hgt = clamp(1.0 - (wp.y - 1.0) * 0.035, 0.55, 1.15);',
    '  float f = (1.0 - exp(-d * d * hgt));',
    '  float sc = pow(max(dot(rd / max(dist, 0.001), u_sun), 0.0), 6.0);',
    '  vec3 fc = mix(u_fogCol, u_sunCol * vec3(1.0, 0.93, 0.78), sc * 0.42);',
    '  return mix(c, fc, clamp(f, 0.0, 1.0));',
    '}'
  ].join('\n');

  GL.SRC = {
    litVS: [
      '#version 300 es',
      'layout(location=0) in vec3 a_pos;',
      'layout(location=1) in vec3 a_nrm;',
      'layout(location=2) in vec4 a_col;',
      'uniform mat4 u_vp;',
      'uniform mat4 u_model;',
      'out vec3 v_nrm; out vec4 v_col; out vec3 v_wp;',
      'void main(){',
      '  vec4 wp = u_model * vec4(a_pos, 1.0);',
      '  v_wp = wp.xyz;',
      '  v_nrm = mat3(u_model) * a_nrm;',
      '  v_col = a_col;',
      '  gl_Position = u_vp * wp;',
      '}'
    ].join('\n'),
    litFS: [
      '#version 300 es',
      'precision highp float;',
      'precision highp sampler2DShadow;',
      'in vec3 v_nrm; in vec4 v_col; in vec3 v_wp;',
      'uniform vec3 u_sun; uniform vec3 u_sunCol; uniform vec3 u_skyCol; uniform vec3 u_gndCol;',
      'uniform vec4 u_tint; uniform vec3 u_emis; uniform float u_alpha;',
      'uniform sampler2DShadow u_shadow; uniform mat4 u_lvp; uniform float u_shOn; uniform float u_texel; uniform vec3 u_shCenter; uniform float u_shRad;',
      'uniform float u_detail;',
      FOG,
      'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
      'float vnoise(vec2 p){',
      '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);',
      '}',
      'float shadowAt(vec3 wp, vec3 n){',
      '  if (u_shOn < 0.5) return 1.0;',
      '  vec4 q = u_lvp * vec4(wp + n * 0.09, 1.0);',
      '  vec3 s = q.xyz / q.w * 0.5 + 0.5;',
      '  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;',
      '  s.z -= 0.0012;',
      '  float sh = 0.0;',
      '  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) sh += texture(u_shadow, vec3(s.xy + vec2(float(i), float(j)) * u_texel * 1.1, s.z));',
      '  sh /= 9.0;',
      '  float fade = smoothstep(u_shRad, u_shRad * 0.78, length(wp.xz - u_shCenter.xz));',
      '  return mix(1.0, sh, fade);',
      '}',
      'out vec4 o;',
      'void main(){',
      '  vec3 n = normalize(v_nrm);',
      '  vec3 albedo = v_col.rgb;',
      '  if (u_detail > 0.5) {',
      '    vec2 uv = n.y > 0.6 ? v_wp.xz : (abs(n.x) > abs(n.z) ? v_wp.zy : v_wp.xy);',
      '    float nz = vnoise(uv * 1.3) * 0.34 + vnoise(uv * 4.1) * 0.26 + vnoise(uv * 13.0) * 0.22 + vnoise(uv * 41.0) * 0.18;',
      '    albedo *= 0.7 + 0.62 * nz;',
      '    float pch = vnoise(uv * 0.7 + 17.0);',
      '    albedo = mix(albedo, albedo * vec3(0.78, 0.8, 0.74), smoothstep(0.55, 0.85, pch) * 0.6 * step(0.6, n.y));',
      '    albedo = mix(albedo, albedo * vec3(1.06, 1.03, 0.9), smoothstep(0.45, 0.9, vnoise(uv * 0.35)) * 0.6 * step(0.6, n.y));',
      '  }',
      '  vec3 amb = mix(u_gndCol, u_skyCol, n.y * 0.5 + 0.5);',
      '  float nd = dot(n, u_sun);',
      '  float d = clamp((nd + 0.22) / 1.22, 0.0, 1.0);',
      '  float sh = shadowAt(v_wp, n);',
      '  float ao = v_col.a;',
      '  vec3 vd = normalize(u_cam - v_wp);',
      '  float rim = pow(1.0 - max(dot(n, vd), 0.0), 3.0) * 0.14;',
      '  float sp = pow(max(dot(reflect(-u_sun, n), vd), 0.0), 24.0) * 0.14 * step(0.0, nd) * sh;',
      '  vec3 shadowFill = u_skyCol * vec3(0.9, 0.95, 1.12);',
      '  vec3 direct = u_sunCol * d * sh;',
      '  vec3 lit = albedo * (amb + (1.0 - sh) * d * shadowFill * 0.25 + direct) * ao + u_skyCol * rim * ao + u_sunCol * sp * ao;',
      '  lit = mix(lit, u_tint.rgb, u_tint.a) + u_emis;',
      '  o = vec4(applyFog(lit, v_wp), u_alpha);',
      '}'
    ].join('\n'),
    waterFS: [
      '#version 300 es',
      'precision highp float;',
      'in vec3 v_nrm; in vec4 v_col; in vec3 v_wp;',
      'uniform vec3 u_sun; uniform vec3 u_sunCol; uniform vec3 u_skyCol; uniform float u_time;',
      FOG,
      'out vec4 o;',
      'void main(){',
      '  vec2 p = v_wp.xz;',
      '  float t = u_time;',
      '  vec3 n = normalize(vec3(sin(p.x*1.3 + t*1.1)*0.10 + sin(p.y*2.1 - t*0.8)*0.07,',
      '                          1.0,',
      '                          sin(p.y*1.6 + t*0.9)*0.10 + sin(p.x*2.4 + t*1.2)*0.07));',
      '  vec3 vdir = normalize(u_cam - v_wp);',
      '  float fres = pow(1.0 - max(dot(n, vdir), 0.0), 3.0);',
      '  vec3 r = reflect(-vdir, n);',
      '  float spec = pow(max(dot(r, u_sun), 0.0), 120.0);',
      '  vec3 col = mix(v_col.rgb, u_skyCol * 0.95, 0.25 + fres * 0.6) + u_sunCol * spec * 1.5;',
      '  float foam = smoothstep(0.55, 0.15, v_col.a) * (0.5 + 0.5 * sin(p.x*4.0 + p.y*3.0 + t*2.0));',
      '  col = mix(col, vec3(0.92, 0.96, 0.98), foam * 0.55);',
      '  float a = clamp(v_col.a * 1.15 + fres * 0.2 + spec * 0.4 + foam * 0.3, 0.0, 0.95);',
      '  o = vec4(applyFog(col, v_wp), a);',
      '}'
    ].join('\n'),
    skyVS: [
      '#version 300 es',
      'out vec2 v_ndc;',
      'void main(){',
      '  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));',
      '  v_ndc = p * 2.0 - 1.0;',
      '  gl_Position = vec4(v_ndc, 1.0, 1.0);',
      '}'
    ].join('\n'),
    skyFS: [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_ndc;',
      'uniform mat4 u_invVP; uniform vec3 u_cam; uniform vec3 u_sun; uniform vec3 u_sunCol;',
      'uniform vec3 u_fogCol; uniform vec3 u_zenith; uniform float u_time;',
      'out vec4 o;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);',
      '  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0.0; float a = 0.5; for(int i=0;i<4;i++){ s += a*vn(p); p *= 2.03; a *= 0.5; } return s; }',
      'void main(){',
      '  vec4 w = u_invVP * vec4(v_ndc, 1.0, 1.0);',
      '  vec3 dir = normalize(w.xyz / w.w - u_cam);',
      '  float up = clamp(dir.y, 0.0, 1.0);',
      '  vec3 sky = mix(u_fogCol, u_zenith, pow(up, 0.5));',
      '  float s = max(dot(dir, u_sun), 0.0);',
      '  sky += u_sunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.28);',
      '  if (dir.y > 0.01) {',
      '    vec2 uv = dir.xz / (dir.y + 0.18) * 1.1 + vec2(u_time * 0.012, u_time * 0.004);',
      '    float c = smoothstep(0.48, 0.78, fbm(uv));',
      '    float fade = smoothstep(0.0, 0.22, dir.y);',
      '    sky = mix(sky, mix(vec3(1.0), u_fogCol, 0.25) * (0.8 + 0.2 * s), c * 0.6 * fade);',
      '  }',
      '  if (dir.y < 0.0) sky = u_fogCol * 0.9;',
      '  o = vec4(sky, 1.0);',
      '}'
    ].join('\n'),
    fxVS: [
      '#version 300 es',
      'layout(location=0) in vec3 a_pos;',
      'layout(location=1) in vec2 a_uv;',
      'layout(location=2) in vec4 a_col;',
      'uniform mat4 u_vp;',
      'out vec2 v_uv; out vec4 v_col; out vec3 v_wp;',
      'void main(){ v_uv = a_uv; v_col = a_col; v_wp = a_pos; gl_Position = u_vp * vec4(a_pos, 1.0); }'
    ].join('\n'),
    fxFS: [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_uv; in vec4 v_col; in vec3 v_wp;',
      'uniform sampler2D u_tex;',
      'uniform vec3 u_cam; uniform float u_fogDen;',
      'out vec4 o;',
      'void main(){',
      '  vec4 t = texture(u_tex, v_uv) * v_col;',
      '  float d = length(v_wp - u_cam) * u_fogDen;',
      '  t.a *= 1.0 - clamp(1.0 - exp(-d * d), 0.0, 0.9);',
      '  o = t;',
      '}'
    ].join('\n')
  };

  GL.LIT_UNIFORMS = 'u_vp u_model u_sun u_sunCol u_skyCol u_gndCol u_tint u_emis u_alpha u_cam u_fogCol u_fogDen u_shadow u_lvp u_shOn u_texel u_shCenter u_shRad u_detail';
  GL.WATER_UNIFORMS = 'u_vp u_model u_sun u_sunCol u_skyCol u_time u_cam u_fogCol u_fogDen';
  GL.SKY_UNIFORMS = 'u_invVP u_cam u_sun u_sunCol u_fogCol u_zenith u_time';
  GL.FX_UNIFORMS = 'u_vp u_tex u_cam u_fogDen';

  /** Glow/disc texture for billboards and effects: left half soft glow, right half solid. */
  GL.makeFxTexture = function () {
    const gl = GL.ctx;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff';
    g.fillRect(66, 2, 60, 60);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  // UV regions in the texture
  GL.UV_GLOW = [0.02, 0.02, 0.48, 0.98];
  GL.UV_SOLID = [0.55, 0.1, 0.95, 0.9];
})();
