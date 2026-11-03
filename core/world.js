/* ==========================================================================
   core/world.js – Tilemap, collision, areas and procedural zone generation
   The Westmark zone: village, river with bridge, lake, ruins and warg camp.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;

  const ID = (MEO.TILE_ID = {
    GRASS: 0,
    PATH: 1,
    SAND: 2,
    SHALLOW: 3,
    WATER: 4,
    TREE: 5,
    ROCK: 6,
    WALL: 7,
    FLOOR: 8,
    BRIDGE: 9,
    WELL: 10
  });

  const TILES = (MEO.TILES = [
    { key: 'grass', name: 'Grass', solid: false, speed: 1.0, map: '#4f7d3a' },
    { key: 'path', name: 'Path', solid: false, speed: 1.12, map: '#a38a5c' },
    { key: 'sand', name: 'Sand', solid: false, speed: 0.9, map: '#cdb97a' },
    { key: 'shallow', name: 'Ford', solid: false, speed: 0.55, map: '#4b8aa8' },
    { key: 'water', name: 'Deep water', solid: true, speed: 0, map: '#27597f' },
    { key: 'tree', name: 'Forest', solid: true, speed: 0, map: '#2d5a2a' },
    { key: 'rock', name: 'Cliff', solid: true, speed: 0, map: '#77787d' },
    { key: 'wall', name: 'Wall', solid: true, speed: 0, map: '#5d5148' },
    { key: 'floor', name: 'Floor', solid: false, speed: 1.05, map: '#8a7355' },
    { key: 'bridge', name: 'Bridge', solid: false, speed: 1.0, map: '#7c5a33' },
    { key: 'well', name: 'Well', solid: true, speed: 0, map: '#6b6b70' }
  ]);

  const SOLID = TILES.map(function (t) {
    return t.solid;
  });
  const SPEED = TILES.map(function (t) {
    return t.speed;
  });
  // Solid tiles block line of sight – except water (you can see and shoot over it)
  const SIGHT = TILES.map(function (t) {
    return t.solid && t.key !== 'water';
  });

  class World {
    constructor(w, h, tile) {
      this.w = w;
      this.h = h;
      this.tile = tile;
      this.pixelW = w * tile;
      this.pixelH = h * tile;
      this.tiles = new Uint8Array(w * h);
      this.name = 'The Westmark';
      this.seed = 0;
      this.areas = [];
      this.areaById = {};
      this.buildings = [];
      this.points = {};
      this.warnings = [];
      this.stats = {};
    }

    inBounds(tx, ty) {
      return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
    }

    get(tx, ty) {
      return this.inBounds(tx, ty) ? this.tiles[ty * this.w + tx] : ID.ROCK;
    }

    set(tx, ty, id) {
      if (this.inBounds(tx, ty)) this.tiles[ty * this.w + tx] = id;
    }

    isSolid(tx, ty) {
      return SOLID[this.get(tx, ty)];
    }

    tileAtPx(x, y) {
      return this.get(Math.floor(x / this.tile), Math.floor(y / this.tile));
    }

    speedAt(x, y) {
      const s = SPEED[this.tileAtPx(x, y)];
      return s > 0 ? s : 1;
    }

    /** Is there a clear line of sight between two points (pixels)? Start and end tiles are ignored. */
    lineOfSight(x0, y0, x1, y1) {
      const T = this.tile;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      if (dist < T * 0.5) return true;
      const steps = Math.ceil(dist / (T * 0.25));
      const sx = Math.floor(x0 / T);
      const sy = Math.floor(y0 / T);
      const ex = Math.floor(x1 / T);
      const ey = Math.floor(y1 / T);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const tx = Math.floor((x0 + dx * t) / T);
        const ty = Math.floor((y0 + dy * t) / T);
        if ((tx === sx && ty === sy) || (tx === ex && ty === ey)) continue;
        if (SIGHT[this.get(tx, ty)]) return false;
      }
      return true;
    }

    areaAt(tx, ty) {
      for (let i = 0; i < this.areas.length; i++) {
        const a = this.areas[i];
        if (tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h) return a;
      }
      return null;
    }

    /**
     * Pushes a circle (x, y, r) out of all solid tiles, so it slides along walls.
     * The result is written to "out" ({x, y}) to avoid allocation.
     */
    resolveCircle(x, y, r, out) {
      const T = this.tile;
      for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        const tx0 = Math.floor((x - r) / T);
        const tx1 = Math.floor((x + r) / T);
        const ty0 = Math.floor((y - r) / T);
        const ty1 = Math.floor((y + r) / T);
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            if (!this.isSolid(tx, ty)) continue;
            const rx = tx * T;
            const ry = ty * T;
            const cx = U.clamp(x, rx, rx + T);
            const cy = U.clamp(y, ry, ry + T);
            const dx = x - cx;
            const dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-9) {
              const d = Math.sqrt(d2);
              const push = r - d;
              x += (dx / d) * push;
              y += (dy / d) * push;
            } else {
              // center lies inside the tile → push out to the nearest edge
              const l = x - rx;
              const rr = rx + T - x;
              const t = y - ry;
              const b = ry + T - y;
              const m = Math.min(l, rr, t, b);
              if (m === l) x = rx - r;
              else if (m === rr) x = rx + T + r;
              else if (m === t) y = ry - r;
              else y = ry + T + r;
            }
            moved = true;
          }
        }
        if (!moved) break;
      }
      out.x = x;
      out.y = y;
      return out;
    }

    /** Flood fill from a tile across all walkable tiles. Returns a mask (1 = reachable). */
    reachableFrom(tx, ty) {
      const w = this.w;
      const mask = new Uint8Array(w * this.h);
      if (!this.inBounds(tx, ty) || this.isSolid(tx, ty)) return mask;
      const queue = new Int32Array(w * this.h);
      let head = 0;
      let tail = 0;
      const start = ty * w + tx;
      mask[start] = 1;
      queue[tail++] = start;
      const self = this;
      function visit(nx, ny) {
        if (!self.inBounds(nx, ny) || self.isSolid(nx, ny)) return;
        const j = ny * w + nx;
        if (mask[j]) return;
        mask[j] = 1;
        queue[tail++] = j;
      }
      while (head < tail) {
        const i = queue[head++];
        const x = i % w;
        const y = (i / w) | 0;
        visit(x + 1, y);
        visit(x - 1, y);
        visit(x, y + 1);
        visit(x, y - 1);
      }
      return mask;
    }

    tileCenter(tx, ty) {
      return { x: (tx + 0.5) * this.tile, y: (ty + 0.5) * this.tile };
    }
  }

  // ======================================================================
  //  Procedural generation of the zone: The Westmark
  // ======================================================================
  World.generate = function (seed) {
    const W = 96;
    const H = 64;
    const world = new World(W, H, MEO.CONFIG.TILE);
    world.seed = seed;
    world.id = 'westmark';

    const hash = function (x, y, salt) {
      return U.hash2(x, y, seed + salt);
    };

    const lake = { cx: 66, cy: 40, rx: 11, ry: 7 };
    const riverX = function (y) {
      return 60 + Math.sin(y * 0.22) * 3 + Math.sin(y * 0.07 + 1) * 2;
    };

    // ---- 1) Terrain: lake, river, forest, rocks, edge ---------------------------
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let id = ID.GRASS;

        const dx = (x - lake.cx) / lake.rx;
        const dy = (y - lake.cy) / lake.ry;
        const d = dx * dx + dy * dy + (U.fbm(x / 5, y / 5, seed + 3, 3) - 0.5) * 0.9;
        if (d < 0.5) id = ID.WATER;
        else if (d < 0.8) id = ID.SHALLOW;
        else if (d < 1.0) id = ID.SAND;

        if (y <= 38) {
          const rd = Math.abs(x - riverX(y));
          if (rd < 1.6) id = ID.WATER;
          else if (rd < 2.8) {
            if (id !== ID.WATER) id = ID.SHALLOW;
          } else if (rd < 3.6 && id === ID.GRASS) id = ID.SAND;
        }

        if (id === ID.GRASS) {
          const f = U.fbm(x / 8, y / 8, seed + 7, 3);
          const h1 = hash(x, y, 11);
          if (f > 0.56 && h1 > 0.28) id = ID.TREE;
          else if (h1 > 0.975) id = ID.TREE;
          else if (hash(x, y, 19) > 0.992) id = ID.ROCK;
          else if (x > 68 && y < 24 && U.fbm(x / 6, y / 6, seed + 23, 3) > 0.58) id = ID.ROCK;
        }

        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) id = ID.ROCK;
        else if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) id = ID.TREE;

        world.tiles[y * W + x] = id;
      }
    }

    // ---- Construction helper functions --------------------------------
    function fill(x, y, w, h, id) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) world.set(i, j, id);
    }
    function outline(x, y, w, h, id) {
      for (let i = x; i < x + w; i++) {
        world.set(i, y, id);
        world.set(i, y + h - 1, id);
      }
      for (let j = y; j < y + h; j++) {
        world.set(x, j, id);
        world.set(x + w - 1, j, id);
      }
    }
    function clear(x, y, w, h) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
          if (i >= 3 && j >= 3 && i < W - 3 && j < H - 3) world.set(i, j, ID.GRASS);
        }
      }
    }
    function pave(x, y) {
      const cur = world.get(x, y);
      if (cur === ID.WALL || cur === ID.FLOOR || cur === ID.WELL) return;
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return;
      const wet = cur === ID.WATER || cur === ID.SHALLOW || cur === ID.BRIDGE;
      world.set(x, y, wet ? ID.BRIDGE : ID.PATH);
    }
    function carve(pts) {
      for (let i = 0; i < pts.length - 1; i++) {
        const x0 = pts[i][0];
        const y0 = pts[i][1];
        const dx = pts[i + 1][0] - x0;
        const dy = pts[i + 1][1] - y0;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
        const horiz = Math.abs(dx) >= Math.abs(dy);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const ix = Math.floor(x0 + dx * t);
          const iy = Math.floor(y0 + dy * t);
          pave(ix, iy);
          if (horiz) pave(ix, iy + 1);
          else pave(ix + 1, iy);
        }
      }
    }

    // ---- 2) The village of Greenbrook -----------------------------------------
    const V = { x: 14, y: 24, w: 22, h: 16 };
    clear(V.x - 4, V.y - 4, V.w + 8, V.h + 8);
    outline(V.x, V.y, V.w, V.h, ID.WALL);
    fill(24, 39, 2, 1, ID.PATH); // south gate
    fill(35, 30, 1, 2, ID.PATH); // east gate
    clear(4, 28, 10, 6);
    fill(14, 30, 1, 2, ID.PATH); // west gate

    function house(x, y, w, h, doorX) {
      fill(x, y, w, h, ID.FLOOR);
      outline(x, y, w, h, ID.WALL);
      world.set(doorX, y + h - 1, ID.FLOOR);
      world.buildings.push({ x: x, y: y, w: w, h: h, doorX: doorX });
    }
    house(16, 26, 6, 5, 19);
    house(28, 26, 6, 5, 30);
    house(16, 33, 6, 5, 19);
    house(28, 33, 6, 5, 30);

    fill(22, 29, 6, 7, ID.PATH);   // market square
    fill(24, 36, 2, 3, ID.PATH);   // main path north-south
    fill(19, 31, 1, 2, ID.PATH);
    fill(19, 32, 4, 1, ID.PATH);
    fill(30, 31, 1, 2, ID.PATH);
    fill(28, 32, 3, 1, ID.PATH);
    fill(19, 38, 6, 1, ID.PATH);
    fill(25, 38, 6, 1, ID.PATH);
    world.set(24, 32, ID.WELL);

    // ---- 3) The Fallen Tower (ruins) --------------------------------------
    const R = { x: 74, y: 8, w: 13, h: 10 };
    clear(R.x - 4, R.y - 4, R.w + 8, R.h + 8);
    for (let j = R.y; j < R.y + R.h; j++) {
      for (let i = R.x; i < R.x + R.w; i++) {
        const edge = i === R.x || j === R.y || i === R.x + R.w - 1 || j === R.y + R.h - 1;
        if (!edge) continue;
        const corner = (i === R.x || i === R.x + R.w - 1) && (j === R.y || j === R.y + R.h - 1);
        const h = hash(i, j, 31);
        if (corner || h < 0.62) world.set(i, j, ID.WALL);
        else if (h < 0.8) world.set(i, j, ID.ROCK);
      }
    }
    fill(R.x + 6, R.y + R.h - 1, 2, 1, ID.PATH); // south gate (80,17)-(81,17)
    world.set(77, 11, ID.ROCK);
    world.set(83, 11, ID.ROCK);
    world.set(77, 14, ID.ROCK);
    world.set(83, 14, ID.ROCK);
    // The Warchief's hall: a raised dais of floor stones at the north end of the courtyard
    fill(76, 9, 9, 2, ID.FLOOR);
    fill(78, 11, 5, 1, ID.FLOOR);

    // ---- 4) Warg Camp ------------------------------------------------
    const CP = { cx: 69, cy: 55 };
    clear(CP.cx - 9, CP.cy - 6, 19, 12);
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
      if (Math.abs(Math.sin(a * 2)) < 0.3) continue; // openings in the 4 cardinal directions
      world.set(Math.round(CP.cx + Math.cos(a) * 4), Math.round(CP.cy + Math.sin(a) * 4), ID.ROCK);
    }

    // ---- 5) Paths (bridges over water) ------------------------------------
    carve([[36, 30], [46, 31], [56, 30], [70, 29], [78, 24], [80, 19]]);   // east gate → the ruins
    carve([[24, 40], [24, 47], [38, 51], [52, 55], [66, 55]]);              // south gate → the camp
    carve([[70, 29], [80, 29], [93, 29]]);                                  // east road → Weathertop
    carve([[14, 30], [9, 30], [5, 30]]);                                   // west gate → the Western Road

    // ---- 6) Areas and key points ------------------------------------
    world.areas = [
      { id: 'training', name: 'The Training Grounds', kind: 'town', x: 22, y: 25, w: 6, h: 4 },
      { id: 'village', name: 'Tirharad', kind: 'town', x: 14, y: 24, w: 22, h: 16 },
      { id: 'hall', name: 'Warchief\'s Hall', kind: 'ruin', x: 76, y: 9, w: 9, h: 3 },
      { id: 'ruins', name: 'The Fallen Tower', kind: 'ruin', x: 72, y: 6, w: 17, h: 14 },
      { id: 'camp', name: 'Warg Camp', kind: 'camp', x: 62, y: 50, w: 14, h: 11 },
      { id: 'lake', name: 'Misty Lake', kind: 'lake', x: 55, y: 32, w: 24, h: 17 },
      { id: 'road_west', name: 'The Western Road', kind: 'portal', x: 4, y: 29, w: 2, h: 3, to: 'home', entry: 'east' },
      { id: 'road_east', name: 'The Road to Weathertop', kind: 'portal', x: 93, y: 28, w: 2, h: 3, to: 'weathertop', entry: 'west' }
    ];
    world.entries = { west: { tx: 8, ty: 30 }, east: { tx: 90, ty: 29 } };
    world.areaById = {};
    world.areas.forEach(function (a) {
      world.areaById[a.id] = a;
    });
    world.points = {
      spawn: { tx: 25, ty: 36 },
      ruinsCenter: { tx: 80, ty: 13 },
      ruinsGate: { tx: 80, ty: 18 },
      bossSpot: { tx: 80, ty: 10 },
      campCenter: { tx: 69, ty: 55 },
      bridge: { tx: 61, ty: 30 }
    };

    // ---- 7) Validation: everything important must be reachable from the start -----------
    const sp = world.points.spawn;
    let mask = world.reachableFrom(sp.tx, sp.ty);
    ['ruinsCenter', 'campCenter', 'bridge'].forEach(function (key) {
      const p = world.points[key];
      if (!mask[p.ty * W + p.tx]) world.warnings.push('Key point not reachable: ' + key);
    });

    // Fill closed "pockets" with forest, so there are no hidden islands
    let walkable = 0;
    let filled = 0;
    for (let i = 0; i < W * H; i++) {
      if (SOLID[world.tiles[i]]) continue;
      walkable++;
      if (!mask[i] && world.tiles[i] !== ID.SHALLOW) {
        world.tiles[i] = ID.TREE;
        filled++;
      }
    }
    mask = world.reachableFrom(sp.tx, sp.ty);
    let reachable = 0;
    for (let i = 0; i < W * H; i++) if (mask[i]) reachable++;
    world.stats = { walkable: walkable, filledPockets: filled, reachable: reachable };

    return world;
  };

  // ======================================================================
  //  Small start zones, built from a spec (data/zones.js)
  // ======================================================================
  World.generateStart = function (spec, seed) {
    const W = spec.w;
    const H = spec.h;
    const world = new World(W, H, MEO.CONFIG.TILE);
    const salt = spec.salt || 0;
    world.seed = seed + salt;
    world.id = spec.id;
    world.name = spec.name;
    world.theme = spec.theme || null;
    const sd = world.seed;
    const hash = function (x, y, s) { return U.hash2(x, y, sd + s); };
    const T = spec.terrain || {};

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let id = ID.GRASS;
        (T.lakes || []).forEach(function (l) {
          const dx = (x - l.cx) / l.rx;
          const dy = (y - l.cy) / l.ry;
          const d = dx * dx + dy * dy + (U.fbm(x / 5, y / 5, sd + 3, 3) - 0.5) * 0.9;
          if (d < 0.5) id = ID.WATER;
          else if (d < 0.8 && id !== ID.WATER) id = ID.SHALLOW;
          else if (d < 1.0 && id === ID.GRASS) id = ID.SAND;
        });
        if (T.river) {
          const r = T.river;
          const rx = r.x + Math.sin(y * 0.22) * r.amp + Math.sin(y * 0.07 + 1) * r.amp * 0.6;
          const rd = Math.abs(x - rx);
          if (rd < 1.4) id = ID.WATER;
          else if (rd < 2.4 && id !== ID.WATER) id = ID.SHALLOW;
          else if (rd < 3.2 && id === ID.GRASS) id = ID.SAND;
        }
        if (id === ID.GRASS) {
          const f = U.fbm(x / 8, y / 8, sd + 7, 3);
          const h1 = hash(x, y, 11);
          if (f > (T.treeF || 0.56) && h1 > 0.28) id = ID.TREE;
          else if (h1 > (T.treeR || 0.975)) id = ID.TREE;
          else if (hash(x, y, 19) > (T.rockR || 0.992)) id = ID.ROCK;
          else if (T.rocky && U.fbm(x / 6, y / 6, sd + 23, 3) > T.rocky) id = ID.ROCK;
        }
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) id = ID.ROCK;
        else if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) id = ID.TREE;
        world.tiles[y * W + x] = id;
      }
    }

    function fill(x, y, w, h, id) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) world.set(i, j, id);
    }
    function outline(x, y, w, h, id) {
      for (let i = x; i < x + w; i++) { world.set(i, y, id); world.set(i, y + h - 1, id); }
      for (let j = y; j < y + h; j++) { world.set(x, j, id); world.set(x + w - 1, j, id); }
    }
    function clear(x, y, w, h) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 3 && j >= 3 && i < W - 3 && j < H - 3) world.set(i, j, ID.GRASS);
    }
    function pave(x, y) {
      const cur = world.get(x, y);
      if (cur === ID.WALL || cur === ID.FLOOR || cur === ID.WELL) return;
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return;
      world.set(x, y, cur === ID.WATER || cur === ID.SHALLOW || cur === ID.BRIDGE ? ID.BRIDGE : ID.PATH);
    }
    function carve(pts) {
      for (let i = 0; i < pts.length - 1; i++) {
        const x0 = pts[i][0], y0 = pts[i][1];
        const dx = pts[i + 1][0] - x0, dy = pts[i + 1][1] - y0;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
        const horiz = Math.abs(dx) >= Math.abs(dy);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const ix = Math.floor(x0 + dx * t), iy = Math.floor(y0 + dy * t);
          pave(ix, iy);
          if (horiz) pave(ix, iy + 1); else pave(ix + 1, iy);
        }
      }
    }

    (spec.clears || []).forEach(function (c) { clear(c[0], c[1], c[2], c[3]); });
    (spec.houses || []).forEach(function (h) {
      fill(h[0], h[1], h[2], h[3], ID.FLOOR);
      outline(h[0], h[1], h[2], h[3], ID.WALL);
      world.set(h[4], h[1] + h[3] - 1, ID.FLOOR);
      world.buildings.push({ x: h[0], y: h[1], w: h[2], h: h[3], doorX: h[4] });
    });
    (spec.walls || []).forEach(function (w) { outline(w[0], w[1], w[2], w[3], ID.WALL); });
    (spec.fills || []).forEach(function (f) { fill(f[0], f[1], f[2], f[3], f[4]); });
    (spec.paths || []).forEach(function (p) { carve(p); });
    (spec.tiles || []).forEach(function (t) { world.set(t[0], t[1], t[2]); });

    world.areas = spec.areas.slice();
    world.areaById = {};
    world.areas.forEach(function (a) { world.areaById[a.id] = a; });
    world.points = Object.assign({}, spec.points);
    world.entries = spec.entries || {};
    world.props = spec.props || [];

    // validation: key points reachable from the spawn, pockets filled with forest
    const sp = world.points.spawn;
    let mask = world.reachableFrom(sp.tx, sp.ty);
    Object.keys(world.points).forEach(function (k) {
      const p = world.points[k];
      if (!mask[p.ty * W + p.tx]) world.warnings.push('Key point not reachable: ' + k);
    });
    Object.keys(world.entries).forEach(function (k) {
      const p = world.entries[k];
      if (!mask[p.ty * W + p.tx]) world.warnings.push('Entry not reachable: ' + k);
    });
    world.areas.forEach(function (a) {
      if (a.kind !== 'portal') return;
      let ok = false;
      for (let j = a.y; j < a.y + a.h; j++) for (let i = a.x; i < a.x + a.w; i++) if (mask[j * W + i]) ok = true;
      if (!ok) world.warnings.push('Portal not reachable: ' + a.id);
    });
    for (let i = 0; i < W * H; i++) {
      if (SOLID[world.tiles[i]]) continue;
      if (!mask[i] && world.tiles[i] !== ID.SHALLOW) world.tiles[i] = ID.TREE;
    }
    return world;
  };

  MEO.World = World;
})();
