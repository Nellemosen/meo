/* ==========================================================================
   data/vo.js – Recorded voice-over files (optional). Without an entry here the
   game reads the text with the browser's text-to-speech voice of that NPC.
   Key = questId_offer | questId_progress | questId_done | npcId_line0, npcId_line1 ...
   Value = path to an audio file (mp3, ogg, wav), relative to index.html.
   Example:   'sh_pups_offer': 'audio/vo/sh_pups_offer.mp3',
   The full list of keys, speakers and texts is in audio/vo/vo-script.csv.
   To use every file in audio/vo/ that follows the naming, set MEO.VO_AUTO = true
   (the game then tries <key>.mp3 and falls back to text-to-speech if it is missing).
   ========================================================================== */
(function () {
  'use strict';
  const MEO = window.MEO;
  MEO.VO_DIR = 'audio/vo/';
  MEO.VO_EXT = 'mp3';
  MEO.VO_AUTO = false;
  MEO.VO_FILES = {};
})();
