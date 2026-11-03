/* ==========================================================================
   systems/voice.js – Voice-over for quests and NPC lines.
   1) a recorded file (MEO.VO_FILES[key], or <dir>/<key>.<ext> when MEO.VO_AUTO)
   2) otherwise the browser's text-to-speech, with a fixed voice, pitch and rate per NPC
      (npc.voice = { who: 'male'|'female', pitch, rate }, see data/zones.js).
   Settings: vo.enabled, vo.volume, vo.lines (also read idle NPC lines).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  const Events = MEO.Events;

  const FEMALE = /female|zira|samantha|susan|hazel|karen|moira|tessa|fiona|victoria|serena|kate|allison|ava|joanna|salli|emma|amy|libby|sonia|jenny|aria/i;
  const MALE = /\bmale\b|david|mark|daniel|alex|fred|george|ryan|james|thomas|oliver|arthur|guy|brian|matthew|joey|guy|davis|eric|roger/i;

  const Voice = (MEO.Voice = {
    supported: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
    current: null,        // { key, text, npcId }
    _audio: null,
    _token: 0,
    _voices: null,

    enabled() {
      return !MEO.Settings || MEO.Settings.get('vo.enabled') !== false;
    },

    volume() {
      const v = MEO.Settings ? MEO.Settings.get('vo.volume') : 1;
      return typeof v === 'number' ? v : 1;
    },

    /** English voices, split into male / female pools. */
    _pools() {
      if (!Voice.supported) return { male: [], female: [], any: [] };
      const list = window.speechSynthesis.getVoices() || [];
      if (Voice._voices && Voice._voices.n === list.length) return Voice._voices;
      const en = list.filter(function (v) { return /^en/i.test(v.lang); });
      const pool = en.length ? en : list;
      const f = pool.filter(function (v) { return FEMALE.test(v.name); });
      const m = pool.filter(function (v) { return MALE.test(v.name) && !FEMALE.test(v.name); });
      Voice._voices = { n: list.length, male: m, female: f, any: pool };
      return Voice._voices;
    },

    _hash(s) {
      let h = 7;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    },

    /** The same NPC always gets the same voice. */
    voiceFor(npcId, def) {
      const P = Voice._pools();
      const who = (def && def.who) || 'male';
      let pool = who === 'female' ? P.female : P.male;
      if (!pool.length) pool = P.any;
      if (!pool.length) return null;
      return pool[Voice._hash(npcId || 'narrator') % pool.length];
    },

    _fileFor(key) {
      if (MEO.VO_FILES && MEO.VO_FILES[key]) return MEO.VO_FILES[key];
      if (MEO.VO_AUTO && !Voice._missing[key]) return MEO.VO_DIR + key + '.' + (MEO.VO_EXT || 'mp3');
      return null;
    },
    _missing: {},

    /**
     * Speak a text. key: file key; npcId: speaker (for voice settings).
     * opts: { replay }  Returns nothing; safe to call when disabled or unsupported.
     */
    speak(key, text, npcId, opts) {
      Voice.stop();
      if (!Voice.enabled() || !text) return;
      Voice.current = { key: key, text: text, npcId: npcId };
      const token = ++Voice._token;
      const file = Voice._fileFor(key);
      if (file) {
        const a = new Audio(file);
        a.volume = Math.min(1, Voice.volume());
        Voice._audio = a;
        a.addEventListener('ended', function () { if (token === Voice._token) Voice._audio = null; });
        a.addEventListener('error', function () {
          Voice._missing[key] = true;
          if (token === Voice._token) Voice._tts(text, npcId, token);
        });
        const pr = a.play();
        if (pr && pr.catch) pr.catch(function () {
          Voice._missing[key] = true;
          if (token === Voice._token) Voice._tts(text, npcId, token);
        });
        return;
      }
      Voice._tts(text, npcId, token);
    },

    _tts(text, npcId, token) {
      if (!Voice.supported) return;
      const def = MEO.npcDef ? MEO.npcDef(npcId) : null;
      const vdef = (def && def.voice) || {};
      const voice = Voice.voiceFor(npcId, vdef);
      // short chunks: some browsers cut off long utterances
      const parts = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
      parts.forEach(function (part) {
        const u = new window.SpeechSynthesisUtterance(part.trim());
        if (voice) u.voice = voice;
        u.lang = (voice && voice.lang) || 'en-GB';
        u.pitch = Math.max(0.1, Math.min(2, vdef.pitch || 1));
        u.rate = Math.max(0.5, Math.min(1.6, vdef.rate || 1));
        u.volume = Math.min(1, Voice.volume());
        window.speechSynthesis.speak(u);
      });
    },

    stop() {
      Voice._token++;
      Voice.current = null;
      if (Voice._audio) {
        try { Voice._audio.pause(); } catch (e) { /* ignore */ }
        Voice._audio = null;
      }
      if (Voice.supported) {
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      }
    },

    replay() {
      const c = Voice.current;
      if (c) Voice.speak(c.key, c.text, c.npcId, { replay: true });
    }
  });

  if (Voice.supported && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', function () { Voice._voices = null; });
  }
  // leaving the game screen or the dialogue silences the speaker
  Events.on('class:change', function () { Voice.stop(); });
  window.addEventListener('blur', function () { Voice.stop(); });
})();
