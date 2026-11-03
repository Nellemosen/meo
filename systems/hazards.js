/* ==========================================================================
   systems/hazards.js – Telegraphed ground hazards (boss mechanics)
   A zone first shows a red warning circle that fills up (delay), then bursts
   for damage and optionally lingers as fire that ticks once per second.
   Companions step out of zones (ai/party-ai.js asks Hazards.dangerAt).
   Positions and radii are in pixels like everything else in the logic layer.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const Events = MEO.Events;
  const PX = 1 / 16;
  const TAU = Math.PI * 2;

  const Hazards = (MEO.Hazards = {
    zones: [],

    /** Create a zone. o: x, y, r, delay, dur, dmg, tickDmg, school, color, src, name */
    zone(o) {
      const z = {
        x: o.x, y: o.y, r: o.r || 60, delay: o.delay || 1.5, dur: o.dur || 0,
        dmg: o.dmg || 20, tickDmg: o.tickDmg || 0, school: o.school || 'fire',
        color: o.color || '#ff5a2a', src: o.src || null, name: o.name || 'Hazard',
        t0: MEO.Engine.time, armed: false, nextTick: 0, end: 0
      };
      Hazards.zones.push(z);
      Events.emit('hazard:warn', z);
      return z;
    },

    clear() {
      Hazards.zones.length = 0;
    },

    /** The zone a point is in (or about to be hit by), or null. */
    dangerAt(x, y, margin) {
      for (let i = 0; i < Hazards.zones.length; i++) {
        const z = Hazards.zones[i];
        if (Math.hypot(x - z.x, y - z.y) < z.r + (margin || 0)) return z;
      }
      return null;
    },

    _damageIn(z, amount) {
      const src = z.src;
      if (!src || !src.alive) return;
      const list = MEO.Party.everyone();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.radius * 0.5) continue;
        MEO.Combat.hit(src, e, { base: amount, coef: 0, school: z.school, canMiss: false, noCrit: true, ability: { name: z.name } });
      }
    },

    update() {
      const now = MEO.Engine.time;
      const F = MEO.FX3D;
      for (let i = Hazards.zones.length - 1; i >= 0; i--) {
        const z = Hazards.zones[i];
        if (z.src && !z.src.alive) {
          Hazards.zones.splice(i, 1);
          continue;
        }
        if (!z.armed) {
          if (now < z.t0 + z.delay) continue;
          z.armed = true;
          z.end = now + z.dur;
          z.nextTick = now + 1;
          Hazards._damageIn(z, z.dmg);
          Events.emit('hazard:burst', z);
          if (F && F.burst) {
            const c = z.color;
            const y = F.groundY ? F.groundY(z.x * PX, z.y * PX) : 0;
            F.burst(z.x * PX, y + 0.2, z.y * PX, c, 26, { speed: 3.2, up: 3.4, grav: 5, size: 0.3, life: 0.8, alpha: true });
          }
          if (z.dur <= 0) Hazards.zones.splice(i, 1);
          continue;
        }
        if (now >= z.end) {
          Hazards.zones.splice(i, 1);
          continue;
        }
        if (now >= z.nextTick) {
          z.nextTick += 1;
          Hazards._damageIn(z, z.tickDmg);
        }
      }
    },

    draw(R, gB, aB, t) {
      const F = MEO.FX3D;
      const now = MEO.Engine.time;
      const GL = MEO.GL;
      for (let i = 0; i < Hazards.zones.length; i++) {
        const z = Hazards.zones[i];
        const c = GL.rgb(z.color);
        const x = z.x * PX, zz = z.y * PX, r = z.r * PX;
        if (!z.armed) {
          const p = Math.min(1, (now - z.t0) / z.delay);
          const pulse = 0.6 + 0.4 * Math.sin(t * 12);
          F.disc(aB, x, zz, r, GL.pack(255, 40, 20, 40 + 50 * p * pulse), 0.07);
          F.ring(aB, x, zz, r - 0.12, r, 0, TAU, GL.pack(255, 80, 40, 230), 0.09);
          F.ring(aB, x, zz, 0.1, r * p, 0, TAU, GL.pack(255, 120, 60, 150), 0.08);
        } else {
          const left = Math.max(0, (z.end - now));
          const fade = Math.min(1, left / 1.2);
          const flick = 0.75 + 0.25 * Math.sin(t * 9 + i);
          F.disc(gB, x, zz, r * 1.05, GL.pack(c[0], c[1], c[2], 120 * fade * flick), 0.09);
          F.ring(gB, x, zz, r - 0.1, r + 0.05, t, t + TAU, GL.pack(255, 190, 90, 210 * fade), 0.1);
          // a few licking flames
          for (let k = 0; k < 5; k++) {
            const a = k * 1.7 + t * 0.7 + i * 3;
            const d = r * 0.75 * (0.3 + 0.7 * ((k * 0.37 + i * 0.11) % 1));
            const fx = x + Math.cos(a) * d, fz = zz + Math.sin(a) * d;
            const fy = F.groundY(fx, fz);
            F.sprite(gB, fx, fy + 0.35 + 0.15 * Math.sin(t * 8 + k), fz, 0.9 + 0.3 * Math.sin(t * 6 + k * 2), 255, 140, 40, 0.55 * fade);
          }
        }
      }
    }
  });

  if (MEO.FX3D && MEO.FX3D.extra) MEO.FX3D.extra.push(Hazards.draw);
})();
