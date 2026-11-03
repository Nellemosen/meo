/* ==========================================================================
   core/entity.js – Entity base class, player, NPCs and the Entities manager
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  let nextId = 1;
  const tmp = { x: 0, y: 0 };

  // ----------------------------------------------------------------------
  //  Entities manager: keeps track of all living creatures in the zone
  // ----------------------------------------------------------------------
  const Entities = (MEO.Entities = {
    list: [],
    byId: new Map(),
    world: null,

    add(e) {
      Entities.list.push(e);
      Entities.byId.set(e.id, e);
      MEO.Events.emit('entity:add', e);
      return e;
    },

    remove(e) {
      const i = Entities.list.indexOf(e);
      if (i >= 0) Entities.list.splice(i, 1);
      Entities.byId.delete(e.id);
      MEO.Events.emit('entity:remove', e);
    },

    get(id) {
      return Entities.byId.get(id);
    },

    clear() {
      Entities.list.length = 0;
      Entities.byId.clear();
    },

    ofType(type) {
      return Entities.list.filter(function (e) {
        return e.type === type;
      });
    },

    /** Nearest entity within radius r (optional filter). */
    nearest(x, y, r, filter) {
      let best = null;
      let bestD = r;
      for (let i = 0; i < Entities.list.length; i++) {
        const e = Entities.list[i];
        if (!e.alive || (filter && !filter(e))) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d <= bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    },

    update(dt) {
      const list = Entities.list;
      for (let i = 0; i < list.length; i++) {
        list[i].prevX = list[i].x;
        list[i].prevY = list[i].y;
      }
      for (let i = 0; i < list.length; i++) if (list[i].alive) list[i].update(dt);
      Entities._separate();
    },

    /** Pushes overlapping, solid creatures apart. */
    _separate() {
      const list = Entities.list;
      const w = Entities.world;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (!a.solid || !a.alive) continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (!b.solid || !b.alive) continue;
          if (a.isStatic && b.isStatic) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.radius + b.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          let d = Math.sqrt(d2);
          let nx = 1;
          let ny = 0;
          if (d > 1e-6) {
            nx = dx / d;
            ny = dy / d;
          } else d = 0;
          const push = min - d;
          if (a.isStatic) {
            b.x += nx * push;
            b.y += ny * push;
          } else if (b.isStatic) {
            a.x -= nx * push;
            a.y -= ny * push;
          } else {
            a.x -= (nx * push) / 2;
            a.y -= (ny * push) / 2;
            b.x += (nx * push) / 2;
            b.y += (ny * push) / 2;
          }
          if (w) {
            if (!a.isStatic) {
              w.resolveCircle(a.x, a.y, a.radius, tmp);
              a.x = tmp.x;
              a.y = tmp.y;
            }
            if (!b.isStatic) {
              w.resolveCircle(b.x, b.y, b.radius, tmp);
              b.x = tmp.x;
              b.y = tmp.y;
            }
          }
        }
      }
    }
  });

  // ----------------------------------------------------------------------
  //  Entity: shared base for player, NPCs, mobs and bosses
  // ----------------------------------------------------------------------
  class Entity {
    constructor(o) {
      o = o || {};
      this.id = nextId++;
      this.type = o.type || 'npc';
      this.name = o.name || 'Ukendt';
      this.level = o.level || 1;
      this.faction = o.faction || 'neutral';

      this.x = o.x || 0;
      this.y = o.y || 0;
      this.prevX = this.x;
      this.prevY = this.y;
      this.vx = 0;
      this.vy = 0;
      this.radius = o.radius || 10;
      this.speed = o.speed || 105; // pixels/sec.
      this.facing = o.facing != null ? o.facing : Math.PI / 2;
      this.moving = false;

      this.solid = o.solid !== false;
      this.isStatic = !!o.isStatic;
      this.alive = true;

      // Appearance (procedurally drawn)
      this.color = o.color || '#8a8a8a';
      this.trim = o.trim || '#d8c48a';
      this.skin = o.skin || '#e2b88f';
      this.hair = o.hair || '#4a3322';
      this.weapon = !!o.weapon;
      this.marker = o.marker || null; // "!" / "?" above the head
      this.style = o.style || null;   // model style (see core/models.js)

      // Combat-related fields
      this.stats = Object.assign(
        { maxHp: 100, hp: 100, maxRes: 0, res: 0, resType: 'none', xp: 0, power: 0, armor: 0, crit: 0.05, resist: 0 },
        o.stats
      );
      this.buffs = [];
      this.threat = new Map();   // only used by mobs
      this.forced = null;        // taunt: { e, until }
      this.target = null;
      this.inCombat = false;
      this.lastCombat = 0;
      this.corpse = false;
      this.deathTime = 0;
      this.hitTime = -10;
      this.threatMod = 1;
      this.regen = null;

      // Abilities (set up by MEO.Abilities.setupClass)
      this.classId = null;
      this.abilityIds = [];
      this.bar = [];
      this.auto = null;
      this.cast = null;
      this.cd = {};
      this.gcdEnd = 0;
      this.queued = null;
    }

    get hpPct() {
      return this.stats.maxHp > 0 ? this.stats.hp / this.stats.maxHp : 0;
    }

    /** Overridden by subclasses. */
    update(dt) {} // eslint-disable-line no-unused-vars

    /** Move with collision against the world. */
    moveBy(dx, dy) {
      this.x += dx;
      this.y += dy;
      const w = Entities.world;
      if (w) {
        w.resolveCircle(this.x, this.y, this.radius, tmp);
        this.x = tmp.x;
        this.y = tmp.y;
      }
    }
  }

  // ----------------------------------------------------------------------
  //  Player: controlled with the keyboard
  // ----------------------------------------------------------------------
  class Player extends Entity {
    constructor(o) {
      super(
        Object.assign(
          {
            type: 'player',
            name: 'Adventurer',
            faction: 'player',
            color: '#3f6fb5',
            trim: '#d8c48a',
            hair: '#6b4a2b',
            weapon: true,
            radius: 10,
            speed: 105,
            facing: -Math.PI / 2,
            stats: { maxHp: 140, hp: 140, maxRes: 100, res: 0, resType: 'fury', xp: 0 }
          },
          o
        )
      );
      this.classId = 'guardian';
      this.canMove = true;
    }

    update(dt) {
      const I = MEO.Input;
      const R = MEO.Renderer;
      const yaw = R && R.camera ? R.camera.yaw : -Math.PI / 2;
      const fwd = (I.isDown('moveUp') ? 1 : 0) - (I.isDown('moveDown') ? 1 : 0);
      const str = (I.isDown('moveRight') ? 1 : 0) - (I.isDown('moveLeft') ? 1 : 0);
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      // camera-relative direction: forward = (cos, sin), right = (-sin, cos)
      const ax = fwd * cy - str * sy;
      const ay = fwd * sy + str * cy;
      const len = Math.hypot(ax, ay);
      const w = Entities.world;
      const mm = MEO.Combat ? MEO.Combat.moveMult(this) : 1;
      const look = I.mouseLook();

      if (len > 0 && this.canMove && mm > 0) {
        const mult = (w ? w.speedAt(this.x, this.y) : 1) * mm * (fwd < 0 && !str ? 0.6 : 1);
        this.vx = (ax / len) * this.speed * mult;
        this.vy = (ay / len) * this.speed * mult;
        this.facing = look ? yaw : Math.atan2(ay, ax);
        this.moving = true;
        this.moveBy(this.vx * dt, this.vy * dt);
      } else {
        this.vx = 0;
        this.vy = 0;
        this.moving = false;
        if (this.canMove && mm > 0) {
          if (look) this.facing = yaw;
          else if (len > 0) this.facing = Math.atan2(ay, ax); // rooted: can still turn
          else if (this.target && this.target.alive && this.inCombat && MEO.Combat.isEnemy(this, this.target)) {
            // in combat: turn slowly toward the target
            const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const d = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
            this.facing += d * Math.min(1, dt * 8);
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------------
  //  NPC: stationary people you can talk to
  // ----------------------------------------------------------------------
  class NPC extends Entity {
    constructor(o) {
      super(
        Object.assign(
          { type: 'npc', faction: 'friendly', isStatic: true, speed: 0, stats: { maxHp: 200, hp: 200 } },
          o
        )
      );
      this.npcId = (o && o.npcId) || null;
      this.lines = (o && o.lines) || [];
      this.lineIdx = 0;
    }

    /** Next line of dialogue (cycles around). */
    nextLine() {
      if (!this.lines.length) return '...';
      const line = this.lines[this.lineIdx % this.lines.length];
      this.lineIdx++;
      return line;
    }
  }

  // ----------------------------------------------------------------------
  //  PartyMember: AI-controlled companion (tank, healer or damage dealer).
  //  Behaviour lives in ai/party-ai.js, roster and commands in systems/party.js.
  // ----------------------------------------------------------------------
  class PartyMember extends Entity {
    constructor(o) {
      super(
        Object.assign(
          { type: 'party', faction: 'party', weapon: true, radius: 10, speed: 105, facing: -Math.PI / 2 },
          o
        )
      );
      this.slot = (o && o.slot) || 0;
      this.ai = null;
      this.reviveAt = 0;
    }

    update(dt) {
      MEO.PartyAI.step(this, dt);
    }
  }

  // ----------------------------------------------------------------------
  //  Mob: enemy. Dummies are stationary; all others are driven by ai/enemy-ai.js.
  // ----------------------------------------------------------------------
  class Mob extends Entity {
    constructor(o) {
      const def = o.def || {};
      super(
        Object.assign(
          {
            type: 'mob',
            faction: 'hostile',
            isStatic: !(def.speed > 0),
            speed: def.speed || 0,
            name: def.name,
            level: def.level || 1,
            radius: def.radius || 12,
            color: def.color,
            trim: def.trim,
            skin: def.skin,
            hair: def.hair,
            style: def.style,
            stats: {
              maxHp: def.hp || 100, hp: def.hp || 100,
              armor: def.armor || 0, resist: def.resist || 0,
              power: def.power || 0, crit: def.crit || 0.05
            }
          },
          o
        )
      );
      this.def = def;
      this.mobId = o.mobId || null;
      this.home = { x: this.x, y: this.y };
      this.attack = def.attack || null;
      this.nextAttack = 0;
      this.shape = def.shape || 'beast';
      this.respawn = def.respawn || 0;
      this.corpseTime = def.corpse || 8;
      this.xp = def.xp || 0;
      this.victim = null;
      this.scale = def.scale || 1;
      this.rank = def.rank || null;
      this.mobile = def.speed > 0;
      this.evading = false;
      this.ai = null;
      this.loot = null;
      this.group = o.group || null;
    }

    update(dt) {
      if (this.mobile) {
        MEO.EnemyAI.step(this, dt);
        return;
      }
      if (!this.inCombat) return;
      const now = MEO.Engine.time;
      const C = MEO.Combat;
      const T = MEO.Threat;

      T.prune(this);
      if (now - this.lastCombat > 8) {
        this.evade();
        return;
      }

      const victim = T.victim(this);
      this.victim = victim;
      if (!victim || !this.attack || !C.canAct(this)) return;

      const d = Math.hypot(victim.x - this.x, victim.y - this.y) - this.radius - victim.radius;
      this.facing = Math.atan2(victim.y - this.y, victim.x - this.x);
      if (d <= this.attack.range && now >= this.nextAttack) {
        this.nextAttack = now + this.attack.interval * (MEO.EnemyAI ? MEO.EnemyAI.pace().atk : 1);
        C.hit(this, victim, {
          base: this.attack.dmg, coef: 0, school: 'physical', canMiss: true,
          fx: { kind: 'slash', color: '#e0b890' }
        });
      }
    }

    /** Give up the fight: reset threat, buffs and health. */
    evade() {
      MEO.Threat.clear(this);
      MEO.Buffs.clear(this);
      this.stats.hp = this.stats.maxHp;
      this.victim = null;
      MEO.Combat.leaveCombat(this);
      MEO.Events.emit('mob:evade', this);
    }
  }

  MEO.Entity = Entity;
  MEO.Player = Player;
  MEO.NPC = NPC;
  MEO.Mob = Mob;
  MEO.PartyMember = PartyMember;
})();
