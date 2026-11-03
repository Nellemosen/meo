/* ==========================================================================
   core/events.js – Event bus (on / once / off / emit)
   Decouples systems: quests, UI and combat talk via events.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const handlers = new Map();

  const Events = (MEO.Events = {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return function () {
        Events.off(name, fn);
      };
    },

    once(name, fn) {
      const off = Events.on(name, function (data) {
        off();
        fn(data);
      });
      return off;
    },

    off(name, fn) {
      const set = handlers.get(name);
      if (set) set.delete(fn);
    },

    emit(name, data) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          fn(data);
        } catch (err) {
          console.error('[Events] error in handler for "' + name + '":', err);
        }
      }
    }
  });

  /** Shortcut for writing to the game log: MEO.log('text', 'system'). */
  MEO.log = function (text, kind) {
    Events.emit('log', { text: text, kind: kind || 'info' });
  };
})();
