/* ==========================================================================
   core/engine.js – Game loop with fixed timestep
   Logic always runs at 60 steps/sec, regardless of the screen's frame rate.
   Rendering runs every frame and receives an interpolation factor (alpha).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const C = MEO.CONFIG;

  const Engine = (MEO.Engine = {
    running: false,
    paused: false,
    state: 'boot', // boot | menu | playing | paused
    time: 0,       // simulated game time in seconds
    tick: 0,       // number of logic steps
    fps: 0,
    frameMs: 16.7,
    alpha: 0,

    _updaters: [],
    _renderers: [],
    _timers: [],
    _acc: 0,
    _last: 0,
    _raf: 0,
    _errors: Object.create(null),

    /** Register a logic function: fn(dt). Lower "order" runs first. */
    addUpdate(fn, order) {
      Engine._add(Engine._updaters, fn, order);
    },

    /** Register a render function: fn(alpha, frameDt). */
    addRender(fn, order) {
      Engine._add(Engine._renderers, fn, order);
    },

    _add(list, fn, order) {
      list.push({ fn: fn, order: order || 0 });
      list.sort(function (a, b) {
        return a.order - b.order;
      });
    },

    /** Run fn after "sec" seconds of game time (stands still while paused). */
    after(sec, fn) {
      Engine._timers.push({ t: Engine.time + sec, fn: fn });
    },

    setState(next) {
      const prev = Engine.state;
      if (prev === next) return;
      Engine.state = next;
      MEO.Events.emit('state:change', { from: prev, to: next });
    },

    start() {
      if (Engine.running) return;
      Engine.running = true;
      Engine._last = performance.now();
      Engine._acc = 0;
      Engine._raf = requestAnimationFrame(Engine._frame);
      MEO.Events.emit('engine:start');
    },

    stop() {
      Engine.running = false;
      cancelAnimationFrame(Engine._raf);
    },

    pause(value) {
      const p = value !== false;
      if (p === Engine.paused) return;
      Engine.paused = p;
      Engine._acc = 0;
      MEO.Events.emit('engine:pause', p);
    },

    /** Run n logic steps manually (used by tests). */
    stepFrames(n) {
      for (let i = 0; i < n; i++) Engine._step(C.STEP);
    },

    _safe(tag, fn, a, b) {
      try {
        fn(a, b);
      } catch (err) {
        const key = tag + ':' + (err && err.message);
        const n = (Engine._errors[key] = (Engine._errors[key] || 0) + 1);
        if (n <= 3) console.error('[Engine] error in ' + tag + ':', err);
      }
    },

    _step(dt) {
      for (let i = 0; i < Engine._updaters.length; i++) Engine._safe('update', Engine._updaters[i].fn, dt);
      Engine.time += dt;
      Engine.tick++;
      if (Engine._timers.length) {
        const due = [];
        Engine._timers = Engine._timers.filter(function (tm) {
          if (Engine.time >= tm.t) {
            due.push(tm);
            return false;
          }
          return true;
        });
        due.sort(function (a, b) {
          return a.t - b.t;
        });
        for (let i = 0; i < due.length; i++) Engine._safe('timer', due[i].fn);
      }
      if (MEO.Input) MEO.Input.endStep();
    },

    _frame(now) {
      if (!Engine.running) return;
      Engine._raf = requestAnimationFrame(Engine._frame);

      let frame = (now - Engine._last) / 1000;
      Engine._last = now;
      if (!(frame > 0)) frame = 0;
      if (frame > C.MAX_FRAME) frame = C.MAX_FRAME;

      if (frame > 0) {
        Engine.frameMs = Engine.frameMs * 0.92 + frame * 1000 * 0.08;
        Engine.fps = 1000 / Engine.frameMs;
      }

      if (!Engine.paused) {
        Engine._acc += frame;
        let steps = 0;
        while (Engine._acc >= C.STEP && steps < C.MAX_STEPS) {
          Engine._step(C.STEP);
          Engine._acc -= C.STEP;
          steps++;
        }
        if (steps === C.MAX_STEPS) Engine._acc = 0; // give up catching up
      }

      Engine.alpha = Engine.paused ? 1 : Engine._acc / C.STEP;
      for (let i = 0; i < Engine._renderers.length; i++) {
        Engine._safe('render', Engine._renderers[i].fn, Engine.alpha, frame);
      }
    }
  });

  Engine._frame = Engine._frame.bind(Engine);
})();
