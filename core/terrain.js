/* ==========================================================================
   core/terrain.js – 3D terrain, water and landscape props built from the tilemap
   Height map on tile corners, flat triangles, color per corner, chunks of 16x16 tiles.
   Enheder: 1 tile = 2 meter. Spillets pixel-koordinater / 16 = meter.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;
  const GL = MEO.GL;
  const ID = MEO.TILE_ID;

  const TM = 2;              // meters per tile
  const PX = 1 / 16;         // pixel → meters
  const M = 12;              // margin (tiles) with mountains outside the zone
  const CH = 16;             // chunk size in tiles
  const WATER_Y = -0.12;
  const BRIDGE_Y = 0.2;

  const smooth = function (a, b, x) {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const Terrain = (MEO.Terrain = {
    TM: TM,
    PX: PX,
    WATER_Y: WATER_Y,
    world: null,
    chunks: [],
    chunkBounds: [],
    water: null,
    roofs: [],
    emitters: [],
    ready: false,
    stats: { verts: 0, chunks: 0 },

    _H: null,
    _gw: 0,
    _gh: 0,

    // ---- Height lookup ---------------------------------------------------
    _h(i, j) {
      const w = Terrain.world;
      i = U.clamp(i, -M, w.w + M);
      j = U.clamp(j, -M, w.h + M);
      return Terrain._H[(j + M) * Terrain._gw + (i + M)];
    },

    /** Terrain height (meters) in tile units (may be fractional). */
    _heightTiles(gx, gz) {
      const i = Math.floor(gx);
      const j = Math.floor(gz);
      const fx = gx - i;
      const fz = gz - j;
      const h00 = Terrain._h(i, j);
      const h10 = Terrain._h(i + 1, j);
      const h01 = Terrain._h(i, j + 1);
      const h11 = Terrain._h(i + 1, j + 1);
      return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
    },

    /** Walking height for game pixel coordinates (px, py) → meters. */
    heightAt(px, py) {
      const w = Terrain.world;
      if (!w) return 0;
      const gx = px / w.tile;
      const gz = py / w.tile;
      if (w.get(Math.floor(gx), Math.floor(gz)) === ID.BRIDGE) return BRIDGE_Y;
      return Terrain._heightTiles(gx, gz);
    },

    /** Height in meter coordinates (x, z). */
    heightAtM(xm, zm) {
      return Terrain.heightAt(xm / PX, zm / PX);
    },

    /** Is the point (meters) inside a building? Used to hide roofs. */
    buildingAt(px, py) {
      const w = Terrain.world;
      if (!w) return null;
      const tx = px / w.tile;
      const ty = py / w.tile;
      for (let i = 0; i < w.buildings.length; i++) {
        const b = w.buildings[i];
        if (tx > b.x - 0.3 && tx < b.x + b.w + 0.3 && ty > b.y - 0.3 && ty < b.y + b.h + 0.3) return i;
      }
      return -1;
    },

    // ======================================================================
    //  Building
    // ======================================================================
    build(world) {
      Terrain.world = world;
      Terrain._disposeAll();
      const t0 = performance.now();
      Terrain._buildHeights(world);
      Terrain._buildMeshes(world);
      Terrain.ready = true;
      Terrain.stats.ms = Math.round(performance.now() - t0);
    },

    _disposeAll() {
      const gl = GL.ctx;
      const kill = function (m) {
        if (!m) return;
        gl.deleteBuffer(m.vbo);
        gl.deleteVertexArray(m.vao);
      };
      Terrain.chunks.forEach(function (c) {
        kill(c.terrain);
        kill(c.props);
      });
      Terrain.roofs.forEach(function (r) {
        kill(r.mesh);
      });
      kill(Terrain.water);
      Terrain.chunks = [];
      Terrain.roofs = [];
      Terrain.emitters = [];
      Terrain.water = null;
    },

    _tileOr(w, tx, ty) {
      return w.inBounds(tx, ty) ? w.tiles[ty * w.w + tx] : -1;
    },

    _buildHeights(w) {
      const seed = w.seed;
      const gw = w.w + 2 * M + 1;
      const gh = w.h + 2 * M + 1;
      Terrain._gw = gw;
      Terrain._gh = gh;
      const H = (Terrain._H = new Float32Array(gw * gh));

      // Flat zones (village, ruins, camp): weight 1 inside the rectangle, falls off over 3 tiles
      const flat = [];
      w.areas.forEach(function (a) {
        if (a.flat != null) flat.push({ x0: a.x - 1, y0: a.y - 1, x1: a.x + a.w + 1, y1: a.y + a.h + 1, lvl: a.flat });
        else if (w.id !== 'westmark') return;
        else if (a.id === 'village') flat.push({ x0: a.x - 1, y0: a.y - 1, x1: a.x + a.w + 1, y1: a.y + a.h + 1, lvl: 0.1 });
        else if (a.id === 'ruins') flat.push({ x0: 73, y0: 7, x1: 88, y1: 19, lvl: 0.25 });
        else if (a.id === 'camp') flat.push({ x0: 62, y0: 50, x1: 76, y1: 61, lvl: 0.05 });
      });

      const wet = function (id) {
        return id === ID.WATER ? -1.45 : id === ID.SHALLOW ? -0.48 : id === ID.BRIDGE ? -0.7 : null;
      };

      for (let j = -M; j <= w.h + M; j++) {
        for (let i = -M; i <= w.w + M; i++) {
          // rolling hills
          let base = (U.fbm(i / 21, j / 21, seed + 41, 3) - 0.5) * 5.6 + (U.fbm(i / 7, j / 7, seed + 44, 2) - 0.5) * 1.4 + (U.fbm(i / 4, j / 4, seed + 43, 2) - 0.5) * 0.4;
          const smoothBase = (U.fbm(i / 34, j / 34, seed + 41, 2) - 0.5) * 1.6;

          // flat zones
          let fw = 0;
          let lvl = 0;
          for (let k = 0; k < flat.length; k++) {
            const f = flat[k];
            const dx = Math.max(f.x0 - i, 0, i - f.x1);
            const dy = Math.max(f.y0 - j, 0, j - f.y1);
            const wgt = 1 - smooth(0, 4, Math.hypot(dx, dy));
            if (wgt > fw) {
              fw = wgt;
              lvl = f.lvl;
            }
          }
          base = base + (lvl - base) * fw;

          // neighbors
          const t00 = Terrain._tileOr(w, i - 1, j - 1);
          const t10 = Terrain._tileOr(w, i, j - 1);
          const t01 = Terrain._tileOr(w, i - 1, j);
          const t11 = Terrain._tileOr(w, i, j);
          const ts = [t00, t10, t01, t11];
          let path = 0;
          let sum = 0;
          for (let k = 0; k < 4; k++) {
            const id = ts[k];
            if (id === ID.PATH || id === ID.FLOOR || id === ID.WALL || id === ID.WELL) path++;
            const wv = id >= 0 ? wet(id) : null;
            sum += wv === null ? base : wv;
          }
          let h = sum / 4;
          if (path) h += (smoothBase + lvl * fw - h) * (path / 4) * 0.8 * (1 - 0.0);

          // coast: sand lies just above the water
          let sand = 0;
          for (let k = 0; k < 4; k++) if (ts[k] === ID.SAND) sand++;
          if (sand && h > 0.25) h += (0.1 - h) * (sand / 4) * 0.7;

          // mountains outside the map
          const ed = Math.min(i, j, w.w - i, w.h - j);
          const hill = Math.max(0, 7 - ed);
          if (hill > 0) {
            const nz = 0.65 + U.fbm(i / 6, j / 6, seed + 47, 3) * 0.7;
            h += Math.min(hill * hill * 0.085, 26) * nz;
          }
          H[(j + M) * gw + (i + M)] = h;
        }
      }
    },

    // ---- Colors -----------------------------------------------------------
    _tileColor(w, tx, ty, id, hVert) {
      const c = Terrain._tileColor0(w, tx, ty, id, hVert);
      const th = w.theme;
      if (!th) return c;
      const m = id === ID.GRASS ? th.grass : id === ID.TREE ? th.tree : id === ID.ROCK || id === ID.WALL ? th.rock : id === ID.PATH ? th.path : null;
      return m ? [c[0] * m[0], c[1] * m[1], c[2] * m[2]] : c;
    },

    _tileColor0(w, tx, ty, id, hVert) {
      const seed = w.seed;
      const r = U.hash2(tx, ty, seed + 101);
      const nz = U.fbm(tx / 7, ty / 7, seed + 5, 2);
      switch (id) {
        case ID.PATH:
        case ID.WELL:
          return [140 + r * 14 + nz * 16, 112 + r * 12 + nz * 12, 78 + r * 10 + nz * 6];
        case ID.SAND:
          return [206 + r * 10, 188 + r * 10, 130 + r * 10];
        case ID.SHALLOW:
          return [120 + r * 8, 134 + r * 8, 108 + r * 6];
        case ID.WATER:
        case ID.BRIDGE:
          return [62 + r * 8, 82 + r * 8, 72 + r * 6];
        case ID.WALL:
          return [120 + r * 10, 100 + r * 8, 76 + r * 6];
        case ID.FLOOR:
          return [128 + r * 10, 94 + r * 8, 58 + r * 6];
        case ID.TREE:
          return [52 + nz * 22, 90 + nz * 26 + r * 4, 40 + nz * 10];
        case ID.ROCK:
          return [88 + nz * 18, 100 + nz * 20, 64 + nz * 8];
        case ID.GRASS:
        default:
          return [62 + nz * 44 + r * 9, 86 + nz * 36 + r * 10, 40 + nz * 14];
      }
    },

    _mountainColor(h, tx, ty, seed) {
      const c = Terrain._mountainColor0(h, tx, ty, seed);
      const m = Terrain.world && Terrain.world.theme && Terrain.world.theme.mount;
      return m ? [c[0] * m[0], c[1] * m[1], c[2] * m[2]] : c;
    },

    _mountainColor0(h, tx, ty, seed) {
      const r = U.hash2(tx, ty, seed + 55);
      if (h > 15) return [226 + r * 12, 232 + r * 10, 240];
      if (h > 9) {
        const t = smooth(9, 15, h);
        return [GLmix(104, 226, t) + r * 8, GLmix(104, 232, t) + r * 8, GLmix(108, 240, t) + r * 6];
      }
      if (h > 4.5) {
        const t = smooth(4.5, 9, h);
        return [GLmix(62, 104, t) + r * 8, GLmix(88, 104, t) + r * 8, GLmix(52, 108, t) + r * 6];
      }
      return [50 + r * 8, 84 + r * 10, 44 + r * 6];
    },

    // ---- Mesh construction ---------------------------------------------------
    _buildMeshes(w) {
      const seed = w.seed;
      const NX = Math.ceil((w.w + 2 * M) / CH);
      const NZ = Math.ceil((w.h + 2 * M) / CH);
      const cb = [];
      for (let k = 0; k < NX * NZ; k++) cb.push({ t: new GL.MeshBuilder(), p: new GL.MeshBuilder() });
      Terrain._NX = NX;
      Terrain._NZ = NZ;
      const chunkOf = function (tx, ty) {
        const cx = U.clamp(Math.floor((tx + M) / CH), 0, NX - 1);
        const cz = U.clamp(Math.floor((ty + M) / CH), 0, NZ - 1);
        return cb[cz * NX + cx];
      };

      const colAt = function (tx, ty) {
        // color for tile (may lie outside the map)
        const id = Terrain._tileOr(w, tx, ty);
        return id;
      };

      // ---- Terrain ---------------------------------------------------------
      const tmpC = [];
      for (let ty = -M; ty < w.h + M; ty++) {
        for (let tx = -M; tx < w.w + M; tx++) {
          const id = colAt(tx, ty);
          const mb = chunkOf(tx, ty).t;
          const hs = [Terrain._h(tx, ty), Terrain._h(tx + 1, ty), Terrain._h(tx + 1, ty + 1), Terrain._h(tx, ty + 1)];
          const cs = [];
          for (let k = 0; k < 4; k++) {
            const vx = tx + (k === 1 || k === 2 ? 1 : 0);
            const vy = ty + (k >= 2 ? 1 : 0);
            // average of the four tiles around the corner
            let r = 0, g = 0, b = 0;
            for (let q = 0; q < 4; q++) {
              const ax = vx - 1 + (q & 1);
              const ay = vy - 1 + (q >> 1);
              const aid = Terrain._tileOr(w, ax, ay);
              const c = aid < 0 || Math.min(ax, ay, w.w - 1 - ax, w.h - 1 - ay) < -1
                ? Terrain._mountainColor(hs[k], ax, ay, seed)
                : Terrain._tileColor(w, ax, ay, aid);
              r += c[0]; g += c[1]; b += c[2];
            }
            r /= 4; g /= 4; b /= 4;
            let own = id < 0 || Math.min(tx, ty, w.w - 1 - tx, w.h - 1 - ty) < -1
              ? Terrain._mountainColor(hs[k], tx, ty, seed)
              : Terrain._tileColor(w, tx, ty, id);
            // mountains: use height for color
            if (hs[k] > 4.5 && (id < 0 || Math.min(tx, ty, w.w - 1 - tx, w.h - 1 - ty) < 4)) {
              const mc = Terrain._mountainColor(hs[k], tx, ty, seed);
              own = mc;
              r = mc[0]; g = mc[1]; b = mc[2];
            }
            cs.push([own[0] * 0.5 + r * 0.5, own[1] * 0.5 + g * 0.5, own[2] * 0.5 + b * 0.5, 1]);
          }
          const x0 = tx * TM, x1 = (tx + 1) * TM, z0 = ty * TM, z1 = (ty + 1) * TM;
          // A: (0,1,2)  B: (0,2,3) — same diagonal as heightAt
          // smooth normals from the height field (central differences)
          const nrm = function (vx, vy) {
            const gx = (Terrain._h(vx + 1, vy) - Terrain._h(vx - 1, vy)) / (2 * TM);
            const gz = (Terrain._h(vx, vy + 1) - Terrain._h(vx, vy - 1)) / (2 * TM);
            const l = Math.hypot(gx, 1, gz);
            return [-gx / l, 1 / l, -gz / l];
          };
          const ns = [nrm(tx, ty), nrm(tx + 1, ty), nrm(tx + 1, ty + 1), nrm(tx, ty + 1)];
          const pp = [[x0, hs[0], z0], [x1, hs[1], z0], [x1, hs[2], z1], [x0, hs[3], z1]];
          mb.stri(pp[0], pp[1], pp[2], ns[0], ns[1], ns[2], cs[0], cs[1], cs[2]);
          mb.stri(pp[0], pp[2], pp[3], ns[0], ns[2], ns[3], cs[0], cs[2], cs[3]);
        }
      }

      // ---- Water -----------------------------------------------------------
      const wb = new GL.MeshBuilder();
      const waterness = function (tx, ty) {
        const id = Terrain._tileOr(w, tx, ty);
        return id === ID.WATER ? 1 : id === ID.SHALLOW ? 0.55 : id === ID.BRIDGE ? 0.8 : 0;
      };
      const cornerW = function (vx, vy) {
        let s = 0;
        s += waterness(vx - 1, vy - 1) + waterness(vx, vy - 1) + waterness(vx - 1, vy) + waterness(vx, vy);
        return s / 4;
      };
      const deepC = [30, 82, 118];
      const shalC = [86, 156, 168];
      for (let ty = 0; ty < w.h; ty++) {
        for (let tx = 0; tx < w.w; tx++) {
          if (waterness(tx, ty) === 0) continue;
          const cs = [];
          for (let k = 0; k < 4; k++) {
            const vx = tx + (k === 1 || k === 2 ? 1 : 0);
            const vy = ty + (k >= 2 ? 1 : 0);
            const a = cornerW(vx, vy);
            const t = U.clamp((a - 0.45) / 0.55, 0, 1);
            cs.push([shalC[0] + (deepC[0] - shalC[0]) * t, shalC[1] + (deepC[1] - shalC[1]) * t, shalC[2] + (deepC[2] - shalC[2]) * t, U.clamp(a * 1.25, 0, 0.96)]);
          }
          const x0 = tx * TM, x1 = (tx + 1) * TM, z0 = ty * TM, z1 = (ty + 1) * TM, y = WATER_Y;
          wb.tri(x0, y, z0, x1, y, z0, x1, y, z1, cs[0], cs[1], cs[2], x0, y - 1, z0);
          wb.tri(x0, y, z0, x1, y, z1, x0, y, z1, cs[0], cs[2], cs[3], x0, y - 1, z0);
        }
      }
      Terrain.water = GL.buildMesh(wb);

      // ---- Props ----------------------------------------------------------
      Terrain._buildProps(w, chunkOf);

      // ---- Upload ---------------------------------------------------------
      let verts = 0;
      for (let cz = 0; cz < NZ; cz++) {
        for (let cx = 0; cx < NX; cx++) {
          const b = cb[cz * NX + cx];
          const ch = { cx: cx, cz: cz, terrain: GL.buildMesh(b.t), props: GL.buildMesh(b.p) };
          verts += (ch.terrain ? ch.terrain.count : 0) + (ch.props ? ch.props.count : 0);
          // shared bounding sphere for frustum test
          const bs = [ch.terrain, ch.props].filter(Boolean).map(function (m) { return m.bounds; });
          let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
          bs.forEach(function (bd) {
            minx = Math.min(minx, bd.cx - bd.r); maxx = Math.max(maxx, bd.cx + bd.r);
            miny = Math.min(miny, bd.cy - bd.r); maxy = Math.max(maxy, bd.cy + bd.r);
            minz = Math.min(minz, bd.cz - bd.r); maxz = Math.max(maxz, bd.cz + bd.r);
          });
          ch.bounds = bs.length
            ? { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, cz: (minz + maxz) / 2, r: Math.hypot(maxx - minx, maxy - miny, maxz - minz) / 2 }
            : { cx: 0, cy: 0, cz: 0, r: 0 };
          Terrain.chunks.push(ch);
        }
      }
      Terrain.stats.verts = verts;
      Terrain.stats.chunks = Terrain.chunks.length;
    },

    // ======================================================================
    //  Props: trees, rocks, walls, houses, bridge, well, camp …
    // ======================================================================
    _buildProps(w, chunkOf) {
      const seed = w.seed;
      const hash = function (x, y, s) { return U.hash2(x, y, seed + s); };
      const hAt = function (xm, zm) { return Terrain._heightTiles(xm / TM, zm / TM); };
      const village = w.areaById.village || w.areaById.compound;
      const ruins = w.areaById.ruins;
      const inRect = function (tx, ty, a) { return !!a && tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h; };
      const buildingOf = function (tx, ty) {
        for (let i = 0; i < w.buildings.length; i++) {
          const b = w.buildings[i];
          if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return i;
        }
        return -1;
      };

      const GRN = [[58, 84, 42], [66, 92, 46], [50, 74, 44], [80, 98, 48]];
      const AUT = [[138, 108, 46], [150, 88, 44]];

      for (let ty = -2; ty < w.h + 2; ty++) {
        for (let tx = -2; tx < w.w + 2; tx++) {
          const id = Terrain._tileOr(w, tx, ty);
          if (id < 0) continue;
          const mb = chunkOf(tx, ty).p;
          const cxm = (tx + 0.5) * TM;
          const czm = (ty + 0.5) * TM;
          const r1 = hash(tx, ty, 11);
          const r2 = hash(tx, ty, 12);
          const r3 = hash(tx, ty, 13);
          const edge = Math.min(tx, ty, w.w - 1 - tx, w.h - 1 - ty);

          if (id === ID.TREE) {
            if (edge < 0) continue;
            const x = cxm + (r1 - 0.5) * 1.2;
            const z = czm + (r2 - 0.5) * 1.2;
            const y = hAt(x, z) - 0.12;
            const s = (0.8 + r3 * 0.75) * (edge < 3 ? 1.35 : 1);
            mb.push().translate(x, y, z).rotY(r1 * 6.28);
            if (r2 >= 0.55 && r3 < 0.22) {
              // birch: pale trunk, light airy crown
              const bg = [[112, 154, 66], [128, 168, 72], [150, 160, 60]][Math.floor(r1 * 3) % 3];
              mb.scyl(0, -0.05, 0, 0.14 * s, 0.07 * s, 2.7 * s, [214, 208, 194], 7, { ao0: 0.7, openTop: true });
              for (let k = 0; k < 3; k++) mb.box(0.1 * s, (0.8 + k * 0.5) * s, 0, 0.05, 0.05 * s, 0.14 * s, [60, 56, 52], 1);
              mb.ellipsoid(0, 3.0 * s, 0, 0.95 * s, 1.1 * s, 0.95 * s, bg, 9, 0.5, 1);
              mb.ellipsoid(0.5 * s, 2.5 * s, 0.2 * s, 0.6 * s, 0.7 * s, 0.6 * s, GL.shade(bg, 1.12), 8, 0.55, 1);
              mb.ellipsoid(-0.45 * s, 2.7 * s, -0.25 * s, 0.55 * s, 0.7 * s, 0.55 * s, GL.shade(bg, 0.9), 8, 0.55, 1);
            } else if (r2 < 0.55 && r3 > 0.8) {
              // tall pine: bare lower trunk, flat dark crowns
              mb.scyl(0, -0.05, 0, 0.22 * s, 0.1 * s, 3.4 * s, [84, 58, 38], 7, { ao0: 0.7, openTop: true });
              for (let k = 0; k < 4; k++) {
                const yy = (1.9 + k * 0.5) * s;
                mb.ellipsoid(0, yy, 0, (1.3 - k * 0.25) * s, 0.28 * s, (1.3 - k * 0.25) * s, GL.shade([44, 92, 48], 0.9 + k * 0.08), 9, 0.5, 1);
              }
              mb.cone(0, 3.7 * s, 0, 0.35 * s, 0.9 * s, 7, [50, 100, 52], 0.6, true);
            } else if (r2 < 0.55) {
              // spruce: smooth drooping tiers
              const g = GRN[Math.floor(r1 * 4) % 4];
              mb.scyl(0, 0, 0, 0.19 * s, 0.1 * s, 1.5 * s, [92, 62, 38], 7, { ao0: 0.7, openTop: true, openBottom: true });
              const prof = [[0, 0.55 * s]];
              for (let k = 0; k < 4; k++) {
                const yb = (0.55 + k * 0.62) * s;
                const rb = (1.32 - k * 0.27) * s;
                prof.push([rb, yb]);
                prof.push([rb * 0.78, yb + 0.2 * s]);
                prof.push([rb * 0.4, yb + 0.72 * s]);
              }
              prof.push([0.12 * s, 3.2 * s]);
              prof.push([0, 3.55 * s]);
              mb.lathe(0, 0, 0, prof, { color: g, seg: 9, xs: 1, zs: 1, ao0: 0.5, ao1: 1.0 });
            } else {
              // deciduous tree: trunk with forks and a cluster of smooth crowns
              const g = r3 > 0.93 ? AUT[Math.floor(r1 * 2) % 2] : GRN[Math.floor(r2 * 40) % 4];
              mb.scyl(0, -0.05, 0, 0.3 * s, 0.17 * s, 1.9 * s, [96, 66, 40], 8, { ao0: 0.65, openTop: true });
              mb.push().translate(0, 1.5 * s, 0).rotZ(0.6); mb.capsule(0, 0, 0, 0.07 * s, 0.1 * s, 1.0 * s, [96, 66, 40], 6, { ao0: 0.8 }); mb.pop();
              mb.push().translate(0, 1.6 * s, 0).rotX(0.55); mb.capsule(0, 0, 0, 0.07 * s, 0.1 * s, 0.95 * s, [96, 66, 40], 6, { ao0: 0.8 }); mb.pop();
              // crown made of many small leaf clumps for a ragged, natural silhouette
              for (let k = 0; k < 22; k++) {
                const a = hash(tx, ty, 500 + k) * 6.28, e = hash(tx, ty, 530 + k);
                const rr = (0.35 + e * 1.0) * s, yy = (2.0 + hash(tx, ty, 560 + k) * 1.5) * s;
                const sz = (0.34 + hash(tx, ty, 590 + k) * 0.3) * s;
                const shade = 0.78 + hash(tx, ty, 620 + k) * 0.5 + (yy / s - 2) * 0.1;
                mb.blob(Math.cos(a) * rr, yy, Math.sin(a) * rr, sz * 1.15, sz * 0.85, sz * 1.15, GL.shade(g, shade), 1, 0.3, tx * 7 + k, 0.5);
              }
            }
            mb.pop();
            if (r3 > 0.45) {
              const fx = x + (r2 - 0.5) * 2.2, fz = z + (r1 - 0.5) * 2.2, fy = hAt(fx, fz);
              for (let k = 0; k < 5; k++) {
                const a = k * 1.26 + r1 * 3;
                mb.push().translate(fx, fy, fz).rotY(a).rotZ(-0.9);
                mb.capsule(0, 0, 0, 0.012, 0.03, 0.55, [58 + k * 5, 116, 54], 4, { ao0: 0.8 });
                mb.pop();
              }
            }
          } else if (id === ID.ROCK) {
            const big = edge < 1 ? 2.3 : 1;
            const x = cxm + (r1 - 0.5) * 0.6;
            const z = czm + (r2 - 0.5) * 0.6;
            const y = hAt(x, z);
            const g = 108 + r3 * 36;
            const col = [g, g * 0.98, g * 0.94];
            mb.blob(x, y + 0.45 * big, z, (0.95 + r3 * 0.4) * big, (0.75 + r1 * 0.45) * big, (0.95 + r2 * 0.35) * big, col, 2, 0.2, tx * 17 + ty * 3, 0.5);
            mb.blob(x + (r2 - 0.5) * 0.5, y + 0.85 * big, z + (r1 - 0.5) * 0.5, 0.55 * big, 0.2 * big, 0.55 * big, [70, 88, 46], 1, 0.25, tx + ty * 13, 0.8);
            if (r1 > 0.45 && big === 1) mb.blob(x + 0.8, y + 0.2, z - 0.5, 0.45, 0.35, 0.5, GL.shade(col, 0.9), 0, 0.2, tx + ty * 9, 0.6);
          } else if (id === ID.WALL) {
            if (MEO.Kit && MEO.Kit.on() && buildingOf(tx, ty) >= 0) continue;   // real house models instead
            Terrain._wall(w, mb, tx, ty, hash, hAt, village, ruins, inRect, buildingOf);
          } else if (id === ID.WELL) {
            const y = hAt(cxm, czm);
            mb.cyl(cxm, y, czm, 0.95, 0.88, 0.95, 10, [128, 126, 122], 0.7, true);
            mb.cyl(cxm, y + 0.9, czm, 0.7, 0.7, 0.06, 10, [38, 88, 128], 1);
            mb.cyl(cxm, y + 0.88, czm, 1.0, 1.0, 0.1, 10, [150, 146, 138], 0.9);
            mb.box(cxm - 0.82, y + 1.0, czm, 0.14, 2.0, 0.14, [96, 66, 40]);
            mb.box(cxm + 0.82, y + 1.0, czm, 0.14, 2.0, 0.14, [96, 66, 40]);
            mb.roof(cxm - 1.0, czm - 0.6, cxm + 1.0, czm + 0.6, y + 2.0, 0.75, [136, 76, 56], false, 0.2);
            mb.box(cxm, y + 1.6, czm, 0.08, 0.08, 1.2, [60, 44, 30]);
          } else if (id === ID.BRIDGE) {
            Terrain._bridge(w, mb, tx, ty);
          } else if (id === ID.PATH) {
            // pebbles, cart ruts and tufts along the road edge
            if (r1 > 0.55) {
              for (let k = 0; k < 3; k++) {
                const x = cxm + (hash(tx, ty, 400 + k) - 0.5) * 1.8, z = czm + (hash(tx, ty, 410 + k) - 0.5) * 1.8, y = hAt(x, z);
                const g = 100 + hash(tx, ty, 420 + k) * 50;
                mb.blob(x, y + 0.04, z, 0.12 + r2 * 0.1, 0.06, 0.1 + r3 * 0.08, [g, g * 0.95, g * 0.88], 0, 0.15, tx + k * 7, 0.8);
              }
            }
            if (r2 > 0.8) {
              const x = cxm + (r1 - 0.5) * 1.6, z = czm + (r3 - 0.5) * 1.6, y = hAt(x, z);
              mb.cone(x, y - 0.02, z, 0.09, 0.3, 3, [104, 130, 56], 0.6, true);
              mb.cone(x + 0.1, y - 0.02, z + 0.05, 0.08, 0.26, 3, [92, 120, 52], 0.6, true);
            }
          } else if (id === ID.GRASS) {
            if (edge < 0) continue;
            const d = hash(tx, ty, 202);
            if (d > 0.3) {
              const x = cxm + (r1 - 0.5) * 1.4;
              const z = czm + (r2 - 0.5) * 1.4;
              const y = hAt(x, z);
              // a tuft of thin blades, dark at the root and lighter / drier at the tip
              const dry = hash(tx, ty, 205);
              const nb = 7 + Math.floor(r3 * 5);
              for (let k = 0; k < nb; k++) {
                const a = hash(tx, ty, 210 + k) * 6.28;
                const ox = (hash(tx, ty, 230 + k) - 0.5) * 0.34, oz = (hash(tx, ty, 250 + k) - 0.5) * 0.34;
                const hh = 0.32 + hash(tx, ty, 270 + k) * 0.42;
                const tipC = dry > 0.7 ? [150 + r1 * 30, 140 + r1 * 24, 84] : [92 + r1 * 30 + k * 2, 118 + r2 * 24, 58];
                mb.blade(x + ox, y - 0.02, z + oz, hh, 0.032, a, 0.25 + hash(tx, ty, 290 + k) * 0.5, [40, 56, 28], tipC);
              }
            }
            // shrubs and flower beds
            if (d < 0.07) {
              const x = cxm + (r1 - 0.5) * 1.2, z = czm + (r2 - 0.5) * 1.2, y = hAt(x, z);
              const bg = GRN[Math.floor(r3 * 4) % 4];
              mb.blob(x, y + 0.32, z, 0.62, 0.42, 0.58, bg, 1, 0.18, tx * 5 + ty, 0.5);
              mb.blob(x + 0.45, y + 0.24, z + 0.2, 0.4, 0.3, 0.4, GL.shade(bg, 1.12), 1, 0.18, tx + ty * 5, 0.5);
              if (r1 > 0.5) mb.blob(x - 0.1, y + 0.62, z + 0.05, 0.12, 0.09, 0.12, [226, 90, 110], 0, 0.1, tx, 1);
            } else if (d > 0.8 && d <= 0.93) {
              const pal = [[236, 214, 80], [240, 240, 246], [216, 100, 140], [160, 120, 220], [236, 140, 60]];
              const fc = pal[Math.floor(r2 * 5) % 5];
              for (let k = 0; k < 5; k++) {
                const x = cxm + (hash(tx, ty, 300 + k) - 0.5) * 1.6, z = czm + (hash(tx, ty, 320 + k) - 0.5) * 1.6, y = hAt(x, z);
                mb.cyl(x, y, z, 0.02, 0.015, 0.22 + k * 0.02, 3, [60, 110, 50], 0.8, true, true);
                mb.blob(x, y + 0.24 + k * 0.02, z, 0.07, 0.05, 0.07, k % 2 ? GL.shade(fc, 1.1) : fc, 0, 0.1, tx + k, 0.9);
              }
            }
            if (d > 0.93) {
              const x = cxm + (r2 - 0.5) * 1.5;
              const z = czm + (r3 - 0.5) * 1.5;
              const y = hAt(x, z);
              const pal = [[236, 214, 80], [240, 240, 246], [216, 100, 140], [160, 120, 220]];
              const fc = pal[Math.floor(r1 * 4) % 4];
              mb.cyl(x, y, z, 0.025, 0.02, 0.28, 3, [60, 110, 50], 0.8, true, true);
              mb.blob(x, y + 0.3, z, 0.1, 0.07, 0.1, fc, 0, 0.1, tx + ty, 0.9);
            }
          }
        }
      }

      Terrain._buildings(w, chunkOf, hash, hAt);
      if (w.points.campCenter) Terrain._camp(w, chunkOf, hash, hAt);
      if (w.id === 'westmark') Terrain._villageDeco(w, chunkOf, hash, hAt);
      if (w.points.ruinsCenter) Terrain._ruinDeco(w, chunkOf, hash, hAt);
      if (w.props && w.props.length) Terrain._props(w, chunkOf, hash, hAt);
    },

    _wall(w, mb, tx, ty, hash, hAt, village, ruins, inRect, buildingOf) {
      const cxm = (tx + 0.5) * TM;
      const czm = (ty + 0.5) * TM;
      const hs = [Terrain._h(tx, ty), Terrain._h(tx + 1, ty), Terrain._h(tx, ty + 1), Terrain._h(tx + 1, ty + 1)];
      const low = Math.min(hs[0], hs[1], hs[2], hs[3]);
      const high = Math.max(hs[0], hs[1], hs[2], hs[3]);
      const r1 = hash(tx, ty, 71);
      const r2 = hash(tx, ty, 72);
      const bi = buildingOf(tx, ty);
      if (bi >= 0) {
        const h = 2.75;
        const base = low - 0.35;
        const top = high + h;
        const c = [182 + r1 * 14, 156 + r1 * 12, 118 + r1 * 10];
        mb.box(cxm, (base + top) / 2, czm, TM, top - base, TM, c, 0.62);
        mb.box(cxm, top - 0.08, czm, TM + 0.08, 0.2, TM + 0.08, [92, 64, 40], 0.9);
        // stone foundation (rough, two courses)
        mb.box(cxm, base + 0.4, czm, TM + 0.06, 0.8, TM + 0.06, [128 + r2 * 12, 122 + r2 * 10, 112], 0.7);
        mb.box(cxm + (r2 - 0.5) * 0.6, base + 0.95, czm, TM * 0.6, 0.3, TM + 0.1, [116, 110, 102], 0.8);
        // timber frame: corner posts, a mid beam and diagonal braces on every exterior face
        const dark = [76, 52, 34];
        const wallLike = function (x, y) { return buildingOf(x, y) >= 0; };
        const faces = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        faces.forEach(function (f, fi) {
          if (wallLike(tx + f[0], ty + f[1])) return;
          const nx = f[0], nz = f[1];
          const off = TM / 2 + 0.05;
          const px = cxm + nx * off, pz = czm + nz * off;
          const along = nx !== 0 ? [0, 1] : [1, 0];
          const sx = nx !== 0 ? 0.14 : TM + 0.02, sz = nz !== 0 ? 0.14 : TM + 0.02;
          const midY = (low + top - 0.2) / 2;
          // horizontal beam (mid height)
          mb.box(px, base + 1.55, pz, nx !== 0 ? 0.14 : TM + 0.02, 0.16, nz !== 0 ? 0.14 : TM + 0.02, dark, 0.9);
          // corner posts
          [-1, 1].forEach(function (s) {
            mb.box(px + along[0] * s * (TM / 2 - 0.08), midY, pz + along[1] * s * (TM / 2 - 0.08), nx !== 0 ? 0.16 : 0.18, top - base, nz !== 0 ? 0.16 : 0.18, dark, 0.8);
          });
          // window or plain panel
          const hasWin = (hash(tx, ty, 77 + fi) > 0.35) && !(Terrain._tileOr(w, tx + nx, ty + nz) === ID.FLOOR && false);
          if (hasWin) {
            const wy = base + 1.95;
            mb.box(px + nx * 0.02, wy, pz + nz * 0.02, nx !== 0 ? 0.1 : 1.0, 0.8, nz !== 0 ? 0.1 : 1.0, [38, 44, 54], 0.9);
            mb.box(px + nx * 0.05, wy, pz + nz * 0.05, nx !== 0 ? 0.06 : 0.9, 0.7, nz !== 0 ? 0.06 : 0.9, [255, 205, 120], 1);
            mb.box(px + nx * 0.09, wy, pz + nz * 0.09, nx !== 0 ? 0.06 : 0.07, 0.72, nz !== 0 ? 0.06 : 0.07, dark, 1);
            mb.box(px + nx * 0.09, wy, pz + nz * 0.09, nx !== 0 ? 0.06 : 0.92, 0.07, nz !== 0 ? 0.06 : 0.92, dark, 1);
            mb.box(px + nx * 0.14, wy - 0.46, pz + nz * 0.14, nx !== 0 ? 0.22 : 1.2, 0.08, nz !== 0 ? 0.22 : 1.2, dark, 1);
          } else {
            // diagonal brace
            const a = 0.5 * (hash(tx, ty, 78 + fi) > 0.5 ? 1 : -1);
            for (let k = 0; k < 3; k++) {
              const u = (k - 1) * 0.55 * a;
              mb.box(px + along[0] * u, base + 2.2 + k * 0.0, pz + along[1] * u, nx !== 0 ? 0.1 : 0.14, 0.6 + k * 0.0, nz !== 0 ? 0.1 : 0.14, dark, 1);
            }
          }
        });
      } else if (inRect(tx, ty, village)) {
        const h = 3.4;
        const base = low - 0.4;
        const top = high + h;
        const c = [128 + r1 * 14, 124 + r1 * 12, 114 + r1 * 10];
        mb.box(cxm, (base + top) / 2, czm, TM, top - base, TM, c, 0.6);
        mb.box(cxm, top + 0.1, czm, TM + 0.1, 0.22, TM + 0.1, GL.shade(c, 1.1), 0.9);
        const horiz = Terrain._tileOr(w, tx - 1, ty) === ID.WALL || Terrain._tileOr(w, tx + 1, ty) === ID.WALL;
        for (let k = 0; k < 2; k++) {
          const o = (k - 0.5) * 1.0;
          mb.box(cxm + (horiz ? o : 0), top + 0.5, czm + (horiz ? 0 : o), horiz ? 0.55 : 1.9, 0.5, horiz ? 1.9 : 0.55, GL.shade(c, 1.05), 0.8);
        }
      } else {
        // ruins: broken walls
        const h = 0.9 + r1 * r1 * 3.6;
        const base = low - 0.4;
        const top = high + h;
        const c = [100 + r2 * 14, 98 + r2 * 12, 88 + r2 * 10];
        mb.box(cxm, (base + top) / 2, czm, TM, top - base, TM, c, 0.55);
        if (r2 > 0.5) mb.box(cxm + (r1 - 0.5) * 0.8, top + 0.12, czm + (r2 - 0.5) * 0.8, 0.9, 0.3, 0.8, GL.shade(c, 0.9), 0.8);
        if (r1 > 0.55) mb.blob(cxm + (r2 - 0.5) * 2.4, high + 0.2, czm + 1.6 * (r1 - 0.5) + 1.0, 0.45, 0.3, 0.4, GL.shade(c, 0.85), 0, 0.2, tx * 3 + ty, 0.6);
      }
    },

    _bridge(w, mb, tx, ty) {
      const cxm = (tx + 0.5) * TM;
      const czm = (ty + 0.5) * TM;
      const ns = Terrain._tileOr(w, tx, ty - 1) === ID.BRIDGE || Terrain._tileOr(w, tx, ty + 1) === ID.BRIDGE;
      const wood = [128, 94, 58];
      mb.box(cxm, BRIDGE_Y - 0.1, czm, TM, 0.22, TM, wood, 0.85);
      // planks
      for (let k = 0; k < 4; k++) {
        const o = (k - 1.5) * 0.5;
        mb.box(cxm + (ns ? 0 : o), BRIDGE_Y + 0.02, czm + (ns ? o : 0), ns ? TM - 0.1 : 0.04, 0.03, ns ? 0.04 : TM - 0.1, [86, 60, 36], 1);
      }
      const rail = [96, 66, 40];
      for (let s = -1; s <= 1; s += 2) {
        const ox = ns ? s * 0.93 : 0;
        const oz = ns ? 0 : s * 0.93;
        mb.box(cxm + ox, BRIDGE_Y + 0.95, czm + oz, ns ? 0.1 : TM, 0.1, ns ? TM : 0.1, rail, 0.9);
        mb.box(cxm + ox, BRIDGE_Y + 0.55, czm + oz, ns ? 0.06 : TM, 0.06, ns ? TM : 0.06, rail, 0.9);
        for (let k = 0; k < 2; k++) {
          const p = (k - 0.5) * 1.8;
          mb.box(cxm + ox + (ns ? 0 : p), BRIDGE_Y + 0.5, czm + oz + (ns ? p : 0), 0.14, 1.1, 0.14, GL.shade(rail, 0.85), 0.7);
        }
      }
      // bridge posts down into the water
      for (let s = -1; s <= 1; s += 2) {
        const ox = ns ? s * 0.93 : 0;
        const oz = ns ? 0 : s * 0.93;
        mb.box(cxm + ox, -0.5, czm + oz, 0.2, 1.6, 0.2, [72, 52, 34], 0.5);
      }
    },

    // ---- Houses (floor details + roofs) -----------------------------------------
    _buildings(w, chunkOf, hash, hAt) {
      const roofCols = (w.theme && w.theme.roofs) || [[148, 70, 52], [132, 100, 58], [120, 64, 56], [140, 108, 62]];
      w.buildings.forEach(function (b, i) {
        const mbP = chunkOf(b.x + 1, b.y + 1).p;
        const kitFurn = MEO.KitProps && MEO.KitProps.on();
        const x0 = b.x * TM, z0 = b.y * TM, x1 = (b.x + b.w) * TM, z1 = (b.y + b.h) * TM;
        const y = hAt((x0 + x1) / 2, (z0 + z1) / 2);
        // furnishings: bed, table, stools, crate, rug
        if (!kitFurn) {
          mbP.box(x0 + 2.0 * 1.0 + 0.2, y + 0.3, z0 + TM + 0.9, 1.0, 0.45, 2.0, [150, 60, 54], 0.7);
          mbP.box(x0 + 2.0 + 0.2, y + 0.58, z0 + TM + 0.35, 0.9, 0.18, 0.5, [226, 216, 196], 0.9);
          mbP.box(x0 + 6.0, y + 0.45, z0 + TM + 2.0, 1.5, 0.12, 1.0, [112, 78, 46], 0.8);
          mbP.box(x0 + 5.35, y + 0.22, z0 + TM + 1.0 * 2, 0.12, 0.45, 0.12, [86, 60, 36], 0.6);
          mbP.box(x0 + 6.65, y + 0.22, z0 + TM + 2.0, 0.12, 0.45, 0.12, [86, 60, 36], 0.6);
          mbP.cyl(x0 + 5.0, y, z0 + TM + 3.0 - 0.2, 0.28, 0.25, 0.4, 6, [112, 78, 46], 0.7);
          mbP.box(x1 - TM - 0.6, y + 0.35, z0 + TM + 0.5, 0.9, 0.7, 0.7, [120, 90, 56], 0.7);
          mbP.cyl(x0 + 6.4, y + 0.46, z0 + TM + 2.0, 0.14, 0.12, 0.2, 6, [200, 190, 170], 0.9);
        }
        // floor rug
        mbP.box(x0 + 5.0, y + 0.015, z0 + TM + 2.4, 2.4, 0.03, 1.6, [120, 52, 48], 1);
        // roof (separate mesh – hidden when the player is inside)
        if (MEO.Kit && MEO.Kit.on()) {
          Terrain.roofs.push({ mesh: null, index: i, x0: b.x - 0.3, y0: b.y - 0.3, x1: b.x + b.w + 0.3, y1: b.y + b.h + 0.3, alpha: 1 });
          Terrain.emitters.push({ kind: 'torch', x: (b.doorX + 0.5) * TM + 1.25, y: y + 2.0, z: (b.y + b.h - 0.5) * TM + 0.5, seed: i });
          return;
        }
        const rb = new GL.MeshBuilder();
        const ry = y + 2.9;
        const col = roofCols[Math.floor(hash(b.x, b.y, 91) * roofCols.length) % roofCols.length];
        rb.roofBanded(x0, z0, x1, z1, ry, 2.1, col, b.w >= b.h, 0.45, 7);
        // chimney
        rb.box(x0 + 1.4, ry + 1.5, z0 + 1.2, 0.7, 1.6, 0.7, [120, 112, 104], 0.7);
        rb.box(x0 + 1.4, ry + 2.35, z0 + 1.2, 0.85, 0.15, 0.85, [96, 90, 84], 0.9);
        // door lintel
        const dx = (b.doorX + 0.5) * TM;
        const dz = (b.y + b.h - 0.5) * TM;
        mbP.box(dx, y + 2.3, dz, TM + 0.1, 0.18, 0.4, [92, 64, 40], 0.9);
        mbP.box(dx - 1.0, y + 1.1, dz, 0.16, 2.3, 0.4, [92, 64, 40], 0.7);
        mbP.box(dx + 1.0, y + 1.1, dz, 0.16, 2.3, 0.4, [92, 64, 40], 0.7);
        Terrain.roofs.push({
          mesh: GL.buildMesh(rb), index: i,
          x0: b.x - 0.3, y0: b.y - 0.3, x1: b.x + b.w + 0.3, y1: b.y + b.h + 0.3, alpha: 1
        });
        // lantern by the door
        Terrain.emitters.push({ kind: 'torch', x: dx + 1.25, y: y + 2.0, z: dz + 0.5, seed: i });
      });
    },

    // ---- Generic props placed by zone data: { kind, tx, ty, c? } ------------------
    _props(w, chunkOf, hash, hAt) {
      const kitKinds = (MEO.KitProps && MEO.KitProps.on()) ? { barrel: 1, crate: 1, lantern: 1, banner: 1 } : {};
      w.props.forEach(function (p, n) {
        if (kitKinds[p.kind]) return;                       // a real model is placed instead
        const x = (p.tx + 0.5) * TM + (p.dx || 0);
        const z = (p.ty + 0.5) * TM + (p.dz || 0);
        const y = hAt(x, z);
        const mb = chunkOf(p.tx, p.ty).p;
        const col = p.c || [140, 40, 30];
        switch (p.kind) {
          case 'barrel':
            mb.cyl(x, y, z, 0.4, 0.4, 0.95, 8, [118, 80, 46], 0.7);
            mb.cyl(x, y + 0.25, z, 0.43, 0.43, 0.07, 8, [60, 56, 54], 0.9, true);
            mb.cyl(x, y + 0.68, z, 0.43, 0.43, 0.07, 8, [60, 56, 54], 0.9, true);
            break;
          case 'crate':
            mb.box(x, y + 0.4, z, 0.85, 0.8, 0.85, [128, 96, 58], 0.62);
            mb.box(x, y + 0.82, z, 0.9, 0.06, 0.9, [96, 68, 40], 0.9);
            break;
          case 'fire':
            for (let k = 0; k < 7; k++) {
              const a = (k / 7) * Math.PI * 2;
              mb.blob(x + Math.cos(a) * 0.65, y + 0.1, z + Math.sin(a) * 0.65, 0.22, 0.18, 0.22, [92, 90, 88], 0, 0.2, k + n, 0.6);
            }
            mb.cone(x, y + 0.1, z, 0.3, 0.55, 5, [255, 150, 40], 1);
            Terrain.emitters.push({ kind: 'fire', x: x, y: y + 0.3, z: z, seed: n + 3 });
            break;
          case 'banner':
            mb.cyl(x, y, z, 0.1, 0.1, 4.0, 6, [60, 44, 30], 0.7);
            mb.box(x + 0.7, y + 3.2, z, 1.4, 1.5, 0.07, col, 0.6);
            break;
          case 'pillar':
            mb.cyl(x, y - 0.1, z, 0.55, 0.5, p.h || 2.6, 7, [118, 116, 108], 0.65);
            break;
          case 'stone': {
            const h = p.h || 2.4;
            mb.box(x, y + h / 2, z, 0.9, h, 0.6, [118, 116, 112], 0.6);
            mb.blob(x, y + h, z, 0.5, 0.25, 0.35, [110, 108, 104], 0, 0.2, n + 9, 0.6);
            break;
          }
          case 'hay':
            mb.cyl(x, y, z, 0.8, 0.8, 0.9, 9, [204, 176, 84], 0.7);
            mb.cyl(x, y + 0.9, z, 0.5, 0.2, 0.3, 9, [190, 160, 70], 0.8);
            break;
          case 'lantern':
            mb.cyl(x, y, z, 0.07, 0.07, 2.2, 5, [60, 44, 30], 0.7);
            mb.blob(x, y + 2.3, z, 0.22, 0.26, 0.22, [255, 214, 120], 1, 0.0, n + 4, 1.0);
            Terrain.emitters.push({ kind: 'fire', x: x, y: y + 2.3, z: z, seed: n + 11 });
            break;
          case 'tent':
            mb.push().translate(x, y - 0.05, z).rotY(p.rot || 0.4);
            mb.lathe(0, 0, 0, [[2.05, 0.0], [1.95, 0.5], [1.55, 1.15], [1.0, 1.75], [0.5, 2.2], [0.12, 2.5], [0, 2.55]], { color: col, seg: 10, ao0: 0.55, ao1: 1 });
            mb.pop();
            break;
          default:
            break;
        }
      });
    },

    // ---- Warg camp ----------------------------------------------------------
    _camp(w, chunkOf, hash, hAt) {
      const c = w.points.campCenter;
      const cx = (c.tx + 0.5) * TM;
      const cz = (c.ty + 0.5) * TM;
      const mb = chunkOf(c.tx, c.ty).p;
      const y = hAt(cx, cz);
      // fire pit
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        mb.blob(cx + Math.cos(a) * 0.75, y + 0.12, cz + Math.sin(a) * 0.75, 0.24, 0.2, 0.24, [92, 90, 88], 0, 0.2, k + 5, 0.6);
      }
      mb.push().translate(cx, y + 0.18, cz).rotY(0.5);
      mb.box(0, 0.05, 0, 1.0, 0.16, 0.18, [70, 44, 28], 0.8).box(0, 0.05, 0, 0.18, 0.16, 1.0, [78, 50, 30], 0.8);
      mb.pop();
      mb.cone(cx, y + 0.1, cz, 0.34, 0.6, 5, [255, 150, 40], 1);
      Terrain.emitters.push({ kind: 'fire', x: cx, y: y + 0.3, z: cz, seed: 1 });

      // tents
      const tents = [[-5.2, -3.8, 0.4, [118, 84, 56]], [5.0, -3.2, 2.4, [96, 74, 62]], [-0.5, 5.4, 4.2, [128, 96, 64]], [-6.2, 3.4, 5.4, [88, 70, 56]]];
      tents.forEach(function (t) {
        const x = cx + t[0];
        const z = cz + t[1];
        const ty = hAt(x, z);
        mb.push().translate(x, ty - 0.05, z).rotY(t[2]);
        mb.lathe(0, 0, 0, [[2.05, 0.0], [1.95, 0.5], [1.55, 1.15], [1.0, 1.75], [0.5, 2.2], [0.12, 2.5], [0, 2.55]], { color: t[3], seg: 10, ao0: 0.55, ao1: 1 });
        mb.scyl(0, 0.0, 0, 2.08, 2.0, 0.22, GL.shade(t[3], 0.7), 10, { ao0: 0.6, openTop: true, openBottom: true });
        mb.ellipsoid(1.6, 0.62, 0, 0.12, 0.62, 0.38, [34, 26, 20], 8, 0.7, 0.9);                 // door opening
        mb.scyl(0, 2.35, 0, 0.05, 0.035, 0.9, [70, 50, 34], 6, { ao0: 0.9 });
        mb.box(0.02, 3.05, 0.2, 0.02, 0.2, 0.4, [170, 40, 28], 1);                                 // pennant
        mb.pop();
      });
      // crates, barrels, weapon rack, stakes with skulls
      const props = [[3.4, 2.4], [3.9, 3.0], [-3.2, -0.6], [2.5, -5.4], [-3.6, 5.0]];
      props.forEach(function (p, i) {
        const x = cx + p[0];
        const z = cz + p[1];
        const py = hAt(x, z);
        if (i % 2 === 0) mb.box(x, py + 0.4, z, 0.8, 0.8, 0.8, [124, 92, 56], 0.6);
        else mb.cyl(x, py, z, 0.36, 0.38, 0.9, 7, [110, 76, 44], 0.7);
      });
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + 0.8;
        const x = cx + Math.cos(a) * 9.2;
        const z = cz + Math.sin(a) * 6.6;
        const py = hAt(x, z);
        mb.cyl(x, py, z, 0.1, 0.08, 2.4, 5, [76, 56, 38], 0.7);
        mb.blob(x, py + 2.55, z, 0.2, 0.22, 0.2, [226, 220, 204], 0, 0.1, k + 3, 0.8);
        mb.box(x, py + 2.0, z, 0.5, 0.06, 0.06, [76, 56, 38], 0.9);
      }
      // campfire glow from torches
      Terrain.emitters.push({ kind: 'torch', x: cx + 6.4, y: hAt(cx + 6.4, cz - 4) + 2.0, z: cz - 4, seed: 3 });
      Terrain.emitters.push({ kind: 'torch', x: cx - 6.2, y: hAt(cx - 6.2, cz + 5) + 2.0, z: cz + 5, seed: 4 });
    },

    // ---- The village: stalls, barrels, torches, banner ----------------------------------
    _villageDeco(w, chunkOf, hash, hAt) {
      const T = function (tx, ty) { return [tx * TM, ty * TM]; };
      const mbAt = function (tx, ty) { return chunkOf(Math.floor(tx), Math.floor(ty)).p; };

      // Barrels and crates near the blacksmith and the merchant
      const stacks = [[21.1, 35.9, 'barrel'], [21.9, 36.2, 'crate'], [26.3, 33.0, 'crate'], [26.5, 33.7, 'barrel'], [20.8, 31.2, 'barrel'], [29.4, 31.4, 'crate']];
      stacks.forEach(function (s) {
        const p = T(s[0], s[1]);
        const y = hAt(p[0], p[1]);
        const mb = mbAt(s[0], s[1]);
        if (s[2] === 'barrel') {
          mb.cyl(p[0], y, p[1], 0.4, 0.4, 0.95, 8, [118, 80, 46], 0.7);
          mb.cyl(p[0], y + 0.25, p[1], 0.43, 0.43, 0.07, 8, [60, 56, 54], 0.9, true);
          mb.cyl(p[0], y + 0.68, p[1], 0.43, 0.43, 0.07, 8, [60, 56, 54], 0.9, true);
        } else {
          mb.box(p[0], y + 0.4, p[1], 0.85, 0.8, 0.85, [128, 96, 58], 0.62);
          mb.box(p[0], y + 0.82, p[1], 0.9, 0.06, 0.9, [96, 68, 40], 0.9);
        }
      });

      // The blacksmith's anvil and coals
      {
        const p = T(22.0, 35.1);
        const y = hAt(p[0], p[1]);
        const mb = mbAt(22, 35);
        mb.cyl(p[0], y, p[1], 0.3, 0.26, 0.55, 6, [96, 70, 44], 0.7);
        mb.box(p[0], y + 0.65, p[1], 0.75, 0.2, 0.3, [58, 60, 66], 0.8);
        mb.box(p[0] + 0.4, y + 0.62, p[1], 0.3, 0.12, 0.18, [58, 60, 66], 0.9);
      }

      // The marshal's banner
      {
        const p = T(24.3, 29.6);
        const y = hAt(p[0], p[1]);
        const mb = mbAt(24, 29);
        mb.cyl(p[0], y, p[1], 0.07, 0.06, 4.0, 5, [84, 60, 38], 0.8);
        mb.box(p[0] + 0.55, y + 3.2, p[1], 1.0, 1.3, 0.05, [140, 36, 34], 1);
        mb.box(p[0] + 0.55, y + 3.2, p[1], 0.5, 0.16, 0.07, [214, 186, 100], 1);
        mb.box(p[0] + 0.55, y + 2.75, p[1], 0.14, 0.4, 0.07, [214, 186, 100], 1);
        mb.cone(p[0], y + 4.0, p[1], 0.1, 0.3, 4, [214, 186, 100], 1);
      }

      // Hay and straw bales plus weapon rack at the training grounds
      {
        const bales = [[22.5, 25.6], [27.3, 27.3], [22.4, 27.5]];
        bales.forEach(function (b, i) {
          const p = T(b[0], b[1]);
          const y = hAt(p[0], p[1]);
          const mb = mbAt(b[0], b[1]);
          mb.push().translate(p[0], y, p[1]).rotY(i * 1.1);
          mb.box(0, 0.35, 0, 1.1, 0.7, 0.7, [200, 176, 92], 0.6);
          mb.box(0, 0.35, 0, 1.14, 0.1, 0.74, [140, 110, 54], 0.8);
          mb.pop();
        });
        const p = T(26.9, 25.6);
        const y = hAt(p[0], p[1]);
        const mb = mbAt(26, 25);
        mb.box(p[0], y + 0.6, p[1], 1.6, 0.1, 0.1, [96, 66, 40], 0.9);
        mb.box(p[0] - 0.75, y + 0.6, p[1], 0.1, 1.3, 0.12, [96, 66, 40], 0.7);
        mb.box(p[0] + 0.75, y + 0.6, p[1], 0.1, 1.3, 0.12, [96, 66, 40], 0.7);
        for (let k = 0; k < 3; k++) {
          mb.box(p[0] - 0.5 + k * 0.5, y + 0.75, p[1] + 0.05, 0.07, 1.2, 0.07, [168, 172, 182], 0.9);
          mb.box(p[0] - 0.5 + k * 0.5, y + 0.2, p[1] + 0.05, 0.14, 0.1, 0.14, [96, 66, 40], 0.9);
        }
      }

      // Torches along the main road and at the gates
      const torches = [[22.6, 36.4], [27.4, 36.4], [22.6, 29.4], [27.4, 29.4], [24.0, 39.6], [26.0, 39.6], [35.6, 30.0], [35.6, 32.0], [19.2, 38.5], [30.8, 38.5]];
      torches.forEach(function (t, i) {
        const p = T(t[0], t[1]);
        const y = hAt(p[0], p[1]);
        const mb = mbAt(t[0], t[1]);
        mb.cyl(p[0], y, p[1], 0.08, 0.07, 2.2, 5, [80, 56, 36], 0.8);
        mb.cyl(p[0], y + 2.1, p[1], 0.16, 0.1, 0.25, 6, [60, 56, 54], 0.9);
        Terrain.emitters.push({ kind: 'torch', x: p[0], y: y + 2.5, z: p[1], seed: i + 9 });
      });
    },

    // ---- The ruins: pillars, rubble, faint ghostly light ------------------------------------
    _ruinDeco(w, chunkOf, hash, hAt) {
      const c = w.points.ruinsCenter;
      const cx = (c.tx + 0.5) * TM;
      const cz = (c.ty + 0.5) * TM;
      const mb = chunkOf(c.tx, c.ty).p;
      const y = hAt(cx, cz);
      // fallen pillars and plinth
      mb.box(cx, y + 0.2, cz, 3.0, 0.4, 3.0, [110, 108, 100], 0.6);
      mb.cyl(cx, y + 0.4, cz, 0.7, 0.6, 2.2, 8, [124, 122, 114], 0.7);
      mb.blob(cx, y + 3.0, cz, 0.35, 0.35, 0.35, [120, 220, 200], 1, 0.0, 5, 1.0);
      Terrain.emitters.push({ kind: 'ruinlight', x: cx, y: y + 3.0, z: cz, seed: 2 });
      // The Warchief's hall: dais step, braziers and a banner pole
      const hb = w.points.bossSpot;
      const bx = (hb.tx + 0.5) * TM, bz = (hb.ty + 0.5) * TM;
      const by = hAt(bx, bz);
      mb.box(bx, by + 0.12, bz - 0.5, 12, 0.24, 4.2, [86, 82, 78], 0.7);
      [-5.2, 5.2].forEach(function (dx, i) {
        const x = bx + dx;
        const py = hAt(x, bz + 1.2);
        mb.cyl(x, py, bz + 1.2, 0.35, 0.3, 1.1, 7, [60, 58, 56], 0.7);
        mb.cyl(x, py + 1.1, bz + 1.2, 0.6, 0.4, 0.3, 8, [40, 38, 38], 0.6);
        Terrain.emitters.push({ kind: 'fire', x: x, y: py + 1.5, z: bz + 1.2, seed: 7 + i });
      });
      mb.cyl(bx, by, bz - 1.6, 0.12, 0.12, 4.4, 6, [60, 44, 30], 0.7);
      mb.box(bx, by + 3.6, bz - 1.4, 1.5, 1.6, 0.08, [140, 28, 20], 0.6);
      const cols = [[-6, -3, 3.2], [6, -2, 1.6], [-5, 4, 2.4], [5.5, 4.4, 0.9]];
      cols.forEach(function (p, i) {
        const x = cx + p[0];
        const z = cz + p[1];
        const py = hAt(x, z);
        mb.cyl(x, py - 0.1, z, 0.55, 0.5, p[2], 7, [118, 116, 108], 0.65);
        if (i > 1) mb.blob(x + 0.9, py + 0.25, z + 0.4, 0.5, 0.3, 0.45, [110, 108, 100], 0, 0.2, i * 7, 0.6);
      });
      for (let k = 0; k < 14; k++) {
        const x = cx + (hash(k, 4, 301) - 0.5) * 18;
        const z = cz + (hash(k, 5, 302) - 0.5) * 12;
        const py = hAt(x, z);
        const tid = Terrain.world.get(Math.floor(x / TM), Math.floor(z / TM));
        if (tid === ID.WALL || tid === ID.ROCK) continue;
        mb.blob(x, py + 0.15, z, 0.3 + hash(k, 6, 303) * 0.3, 0.2, 0.3 + hash(k, 7, 304) * 0.3, [104, 102, 94], 0, 0.25, k * 5 + 1, 0.6);
      }
    }
  });

  function GLmix(a, b, t) {
    return a + (b - a) * t;
  }
})();
