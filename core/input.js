/* ==========================================================================
   core/input.js – Keyboard, mouse and rebindable keybinds
   Logic asks for ACTIONS ("moveUp"), not key codes.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;

  const DEFAULT_BINDS = {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    interact: ['KeyE'],
    toggleDebug: ['F9'],
    toggleMap: ['KeyM'],
    zoomIn: ['Equal', 'NumpadAdd'],
    zoomOut: ['Minus', 'NumpadSubtract'],
    targetNext: ['Tab'],
    targetPrev: ['Shift+Tab'],
    targetSelf: ['F1'],
    autoAttack: ['KeyQ'],
    partyTarget1: ['F2'],
    partyTarget2: ['F3'],
    partyTarget3: ['F4'],
    partyAttack: ['KeyR'],
    partyRegroup: ['KeyV'],
    partyStance: ['KeyG'],
    questLog: ['KeyL'],
    toggleTraits: ['KeyT'],
    toggleParty: ['KeyP'],
    fm1: ['KeyZ'],
    fm2: ['KeyX'],
    fm3: ['KeyH'],
    toggleInv: ['KeyI', 'KeyB', 'KeyC'],
    toggleOptions: ['KeyO'],
    hideUI: ['Alt+KeyZ'],
    ability1: ['Digit1'],
    ability2: ['Digit2'],
    ability3: ['Digit3'],
    ability4: ['Digit4'],
    ability5: ['Digit5'],
    ability6: ['Digit6'],
    ability7: ['Digit7'],
    ability8: ['Digit8'],
    ability9: ['Digit9'],
    ability10: ['Digit0']
  };

  // Rebinding UI: label and group of every action, in display order
  const ACTIONS = [
    ['Movement', [['moveUp', 'Move forward'], ['moveDown', 'Move backward'], ['moveLeft', 'Move / strafe left'], ['moveRight', 'Move / strafe right'], ['interact', 'Interact / loot / talk'], ['zoomIn', 'Camera zoom in'], ['zoomOut', 'Camera zoom out']]],
    ['Targeting and combat', [['targetNext', 'Next target'], ['targetPrev', 'Previous target'], ['targetSelf', 'Target yourself'], ['autoAttack', 'Toggle auto-attack']]],
    ['Abilities', [['ability1', 'Action bar slot 1'], ['ability2', 'Action bar slot 2'], ['ability3', 'Action bar slot 3'], ['ability4', 'Action bar slot 4'], ['ability5', 'Action bar slot 5'], ['ability6', 'Action bar slot 6'], ['ability7', 'Action bar slot 7'], ['ability8', 'Action bar slot 8'], ['ability9', 'Healing draught (slot 9)'], ['ability10', 'Vigor draught (slot 10)']]],
    ['Party', [['partyTarget1', 'Target companion 1'], ['partyTarget2', 'Target companion 2'], ['partyTarget3', 'Target companion 3'], ['partyAttack', 'Companions: attack my target'], ['partyRegroup', 'Companions: regroup'], ['partyStance', 'Companions: cycle stance']]],
    ['Interface', [['toggleInv', 'Backpack / character'], ['questLog', 'Quest log'], ['toggleTraits', 'Traits'], ['toggleParty', 'Party / companions'], ['fm1', 'Fellowship: Strike'], ['fm2', 'Fellowship: Guard'], ['fm3', 'Fellowship: Rally'], ['toggleMap', 'World map'], ['toggleOptions', 'Options'], ['hideUI', 'Hide / show interface'], ['toggleDebug', 'Debug overlay']]]
  ];
  const MODS = { ShiftLeft: 1, ShiftRight: 1, ControlLeft: 1, ControlRight: 1, AltLeft: 1, AltRight: 1, MetaLeft: 1, MetaRight: 1 };
  function comboOf(e) {
    return (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + e.code;
  }

  // Keys for which we always block the browser's default action
  const ALWAYS_BLOCK = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4']);

  function isTyping(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
  }

  const Input = (MEO.Input = {
    binds: {},
    down: new Set(),
    pressed: new Set(),
    pressedPlain: new Set(),   // key presses made without Shift/Ctrl/Alt
    pressedCombo: new Set(),   // combos such as 'Shift+Tab'
    downCombo: new Set(),
    _comboOf: {},              // code -> combo currently held
    _cap: null,                // key-capture callback used by the rebind UI
    ACTIONS: ACTIONS,
    DEFAULTS: DEFAULT_BINDS,
    mouseDown: new Set(),
    mousePressedSet: new Set(),
    mouse: { x: 0, y: 0, inside: false },
    wheel: 0,
    look: { dx: 0, dy: 0 },   // mouse movement while dragging (camera rotation)
    clicks: [],               // clean clicks (not drags): { button, x, y }
    drags: {},                // active mouse buttons: { x0, y0, moved }
    locked: false,
    _canvas: null,

    init(canvas) {
      Input._canvas = canvas;
      Input.resetBinds();

      window.addEventListener('keydown', Input._onKeyDown, true);
      window.addEventListener('keyup', Input._onKeyUp);
      window.addEventListener('blur', Input.clear);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) Input.clear();
      });

      window.addEventListener('mousemove', Input._onMouseMove);
      document.addEventListener('pointerlockchange', function () {
        Input.locked = document.pointerLockElement === canvas;
      });
      canvas.addEventListener('mouseenter', function () {
        Input.mouse.inside = true;
      });
      canvas.addEventListener('mouseleave', function () {
        Input.mouse.inside = false;
      });
      canvas.addEventListener('mousedown', Input._onMouseDown);
      window.addEventListener('mouseup', Input._onMouseUp);
      canvas.addEventListener('wheel', Input._onWheel, { passive: false });
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
      });
    },

    // ---- Keybinds -------------------------------------------------------
    resetBinds() {
      Input.binds = {};
      for (const action in DEFAULT_BINDS) Input.binds[action] = DEFAULT_BINDS[action].slice();
    },

    setBind(action, codes) {
      Input.binds[action] = Array.isArray(codes) ? codes.slice() : [codes];
    },

    getBinds() {
      return Input.binds;
    },

    /** Human-readable name for a key code, e.g. "KeyW" → "W". */
    keyLabel(code) {
      if (!code) return '';
      if (code.indexOf('+') > 0) {
        return code.split('+').map(Input.keyLabel).join('+');
      }
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
      if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
      const names = { Equal: '=', Minus: '-', Backquote: '`', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Space: 'Space' };
      return names[code] || code;
    },

    /** Which actions use this bind string? */
    actionsUsing(code) {
      const out = [];
      for (const a in Input.binds) if (Input.binds[a].indexOf(code) >= 0) out.push(a);
      return out;
    },

    /** Set slot (0 or 1) of an action. Removes the key from other actions; returns their names. */
    bindKey(action, slot, code) {
      const moved = [];
      for (const a in Input.binds) {
        if (a === action) continue;
        const i = Input.binds[a].indexOf(code);
        if (i >= 0) {
          Input.binds[a].splice(i, 1);
          moved.push(a);
        }
      }
      const list = Input.binds[action] || (Input.binds[action] = []);
      const old = list.indexOf(code);
      if (old >= 0 && old !== slot) list.splice(old, 1);
      if (slot >= list.length) list.push(code);
      else list[slot] = code;
      return moved;
    },

    clearSlot(action, slot) {
      if (Input.binds[action]) Input.binds[action].splice(slot, 1);
    },

    resetAction(action) {
      Input.binds[action] = (DEFAULT_BINDS[action] || []).slice();
    },

    /** Only binds that differ from the defaults (for saving). */
    diffBinds() {
      const d = {};
      for (const a in Input.binds) {
        if (JSON.stringify(Input.binds[a]) !== JSON.stringify(DEFAULT_BINDS[a] || [])) d[a] = Input.binds[a].slice();
      }
      return d;
    },

    loadBinds(d) {
      Input.resetBinds();
      if (!d) return;
      for (const a in d) if (DEFAULT_BINDS[a] && Array.isArray(d[a])) Input.binds[a] = d[a].filter(function (c) { return typeof c === 'string'; }).slice(0, 2);
    },

    /** Capture the next key press (for the rebind UI). cb(bindString) – Esc cancels with null. */
    capture(cb) {
      Input._cap = cb;
    },

    // ---- Queries -------------------------------------------------
    isDown(action) {
      const codes = Input.binds[action];
      if (!codes) return false;
      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c.indexOf('+') > 0 ? Input.downCombo.has(c) : Input.down.has(c)) return true;
      }
      return false;
    },

    wasPressed(action) {
      const codes = Input.binds[action];
      if (!codes) return false;
      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c.indexOf('+') > 0 ? Input.pressedCombo.has(c) : Input.pressedPlain.has(c)) return true;
      }
      return false;
    },

    rawDown(code) {
      return Input.down.has(code);
    },

    rawPressed(code) {
      return Input.pressed.has(code);
    },

    mouseButtonDown(button) {
      return Input.mouseDown.has(button);
    },

    mousePressed(button) {
      return Input.mousePressedSet.has(button);
    },

    /** Number of wheel "clicks" since last call (negative = up/in). */
    consumeWheelSteps() {
      const steps = Math.trunc(Input.wheel / 100);
      Input.wheel -= steps * 100;
      return steps;
    },

    /** Called by the engine after each logic step. */
    endStep() {
      Input.pressed.clear();
      Input.pressedPlain.clear();
      Input.pressedCombo.clear();
      Input.mousePressedSet.clear();
    },

    clear() {
      Input.down.clear();
      Input.downCombo.clear();
      Input._comboOf = {};
      Input.pressed.clear();
      Input.pressedPlain.clear();
      Input.pressedCombo.clear();
      Input.mouseDown.clear();
      Input.mousePressedSet.clear();
      Input.drags = {};
      Input.clicks = [];
      Input.look.dx = 0;
      Input.look.dy = 0;
      Input.wheel = 0;
    },

    // ---- Event handlers ------------------------------------------------
    _onKeyDown(e) {
      if (Input._cap) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (MODS[e.code] || e.repeat) return;
        const cb = Input._cap;
        Input._cap = null;
        cb(e.code === 'Escape' ? null : comboOf(e));
        return;
      }
      if (isTyping(e.target)) return;
      if (e.metaKey) return;
      const combo = comboOf(e);
      const modded = combo !== e.code;
      // Ctrl/Alt combos are only ours if some action uses them (else leave browser shortcuts alone)
      if ((e.ctrlKey || e.altKey) && !Input.actionsUsing(combo).length) return;
      if (!e.repeat) {
        Input.pressed.add(e.code);
        if (modded) Input.pressedCombo.add(combo);
        else Input.pressedPlain.add(e.code);
      }
      Input.down.add(e.code);
      if (modded) {
        Input.downCombo.add(combo);
        Input._comboOf[e.code] = combo;
      }
      if (ALWAYS_BLOCK.has(e.code) || (modded && Input.actionsUsing(combo).length)) e.preventDefault();
    },

    _onKeyUp(e) {
      Input.down.delete(e.code);
      const c = Input._comboOf[e.code];
      if (c) {
        Input.downCombo.delete(c);
        delete Input._comboOf[e.code];
      }
    },

    _onMouseMove(e) {
      const r = Input._canvas.getBoundingClientRect();
      if (!Input.locked) {
        Input.mouse.x = e.clientX - r.left;
        Input.mouse.y = e.clientY - r.top;
      }
      let dragging = false;
      for (const b in Input.drags) {
        const d = Input.drags[b];
        d.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
        if (d.moved > 5 && (b === '0' || b === '2')) dragging = true;
      }
      if (dragging) {
        Input.look.dx += e.movementX || 0;
        Input.look.dy += e.movementY || 0;
        if (!Input.locked && Input._canvas.requestPointerLock) {
          try {
            const p = Input._canvas.requestPointerLock();
            if (p && p.catch) p.catch(function () {});
          } catch (err) { /* ignored */ }
        }
      }
    },

    _onMouseDown(e) {
      Input.mouseDown.add(e.button);
      Input.mousePressedSet.add(e.button);
      const r = Input._canvas.getBoundingClientRect();
      Input.mouse.x = e.clientX - r.left;
      Input.mouse.y = e.clientY - r.top;
      Input.drags[e.button] = { x0: Input.mouse.x, y0: Input.mouse.y, moved: 0 };
    },

    _onMouseUp(e) {
      Input.mouseDown.delete(e.button);
      const d = Input.drags[e.button];
      if (d) {
        if (d.moved <= 5) Input.clicks.push({ button: e.button, x: d.x0, y: d.y0 });
        delete Input.drags[e.button];
      }
      if (!Object.keys(Input.drags).length && document.pointerLockElement && document.exitPointerLock) {
        try { document.exitPointerLock(); } catch (err) { /* ignored */ }
      }
    },

    /** Mouse movement since last call (only while dragging). */
    consumeLook() {
      const l = { dx: Input.look.dx, dy: Input.look.dy };
      Input.look.dx = 0;
      Input.look.dy = 0;
      return l;
    },

    /** Clean clicks since last call. */
    consumeClicks() {
      const c = Input.clicks;
      Input.clicks = [];
      return c;
    },

    /** Is the player dragging the camera right now (right mouse button held down)? */
    mouseLook() {
      return Input.mouseDown.has(2);
    },

    _onWheel(e) {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      Input.wheel += e.deltaY * unit;
    }
  });
})();
