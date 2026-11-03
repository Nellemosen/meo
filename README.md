# Middle-earth Online (Milestone 6 + visual and tempo pass)

Single-player, browser-based 3D MMORPG in a Lord-of-the-Rings style. No build step, no server:
open `index.html` in a modern browser (Chrome/Edge/Firefox with WebGL2). Add `?q=low` to the URL for lower graphics quality.

## Controls
WASD move · right mouse/drag camera · wheel zoom · Tab/click target · 1-8 abilities · 9/0 potions · Q auto-attack
E talk/loot · I backpack · L quest log · M map · R companions attack · V regroup · G stance · F1-F4 select party · Esc pause (sound settings, save)

## Game
- 4 classes (Warrior, Healer, Ranger, Mage); you choose one, AI companions fill the other three roles.
- 11 quests, levels 1-15, loot, vendor, autosave (browser localStorage).
- Dungeon: The Fallen Tower. Boss **Gorthak the Warchief** in the Warchief's Hall (north end of the courtyard):
  phase 1 cleave + Earthshaker ring; 70% his warband joins; 35% enrage + Hellfire zones. Bosses are immune to stun/root/polymorph.
  Final quest "The Warchief of the Tower" (Marshal Halvard, requires War Tokens).
- Sound is synthesized (Web Audio); volume/mute in the pause menu.

## Architecture (`window.MEO` namespace, classic script tags)
| Folder | Role |
|---|---|
| core/ | engine loop, input, events, world/terrain generation, custom WebGL2 renderer, models, effects |
| data/ | classes, abilities, mobs, items/loot, spawns, quests (pure data) |
| combat/ | damage formulas (with level scaling), buffs, threat, abilities, targeting |
| ai/ | enemy-ai (aggro/leash/specials), boss-ai (phases/hazards/adds), party-ai (companions), spawner |
| systems/ | inventory, loot, party, progression, quests, save, hazards (ground zones), audio |
| ui/ | HUD, frames, combat text, inventory, party frames, quest UI, boss frame |

## Extending
- New mob: add to `data/mobs.js`, place in `data/spawns.js`. New boss: give `def.boss.phases` and handle new abilities in `ai/boss-ai.js`.
- New quest: append to `data/quests.js` (objective types: kill, collect, explore, talk).
- New item/loot table: `data/items.js`.
- Ground hazard: `MEO.Hazards.zone({x, y, r, delay, dur, dmg, tickDmg, src, name})` (pixel coordinates, 16 px = 1 m).

Note: Three.js is not bundled; the game uses its own small WebGL2 engine (core/gl.js, terrain.js, models.js, fx3d.js, renderer.js).

## Visual and tempo pass (v0.7)
- Smooth-shaded figures (lathe/ellipsoid/capsule primitives in `core/gl.js`), rebuilt humanoids, wolves, spiders, trees, tents; smooth terrain normals; wrapped lighting with rim and soft specular.
- Pace: player speed 105 px/s (~6.5 m/s), creatures x0.7 speed and x1.5 health (`PACE` at the end of `data/mobs.js`). Tune these two numbers to taste.

## Options and keybinds (v0.8)
Open with O, from the pause menu or the start screen. Tabs: Controls (click a box, press the new key; Shift/Ctrl/Alt combos work; Backspace clears; conflicts move the key), Graphics, Audio, Gameplay, Interface, Accessibility.
Settings and keybinds are stored in the browser (`meo.settings.v1`). Add a setting in `systems/settings.js` (DEFS + apply); add a bindable action in `core/input.js` (DEFAULT_BINDS + ACTIONS).

## v0.9 – Races & Classes
- 4 races (Human, Elf, Dwarf, Hobbit) with unique traits: `data/races.js`, applied by `systems/races.js`.
- 9 lore classes in 4 archetypes: Tank (Guardian, Warden), Healer (Minstrel, Rune-keeper), Damage (Hunter, Champion, Burglar), Support (Captain, Loremaster). Each has 3 specs (defined in `data/classes.js`; trait trees follow in v0.10).
- New ability kits: `data/abilities-new.js`. Companion line-up = tank + healer + damage (Support replaces whichever archetype you are).
- Old saves migrate (warrior→guardian, healer→minstrel, ranger→hunter, mage→runekeeper).
- Roadmap: v0.10 trait trees (hybrid), v0.11 Fellowship manoeuvres, v0.12 start areas, main story and voice-over.

## v0.10 – Trait trees
- Key **T** opens the trait window. 1 point per level above 1 (14 at level 15). 3 trees per class (one per spec), 7 nodes each in 4 tiers (tier N needs 3·(N−1) points in lower tiers of the same tree).
- Hybrid rule (Rift-style): your main tree (most points) is free; at most 5 points may sit in other trees, and only in tiers 1–2. Left-click spends, right-click refunds, "Reset" is free outside combat.
- Data: `data/traits.js` (all 27 trees; effect keys documented in the file). Logic: `systems/traits.js`. UI: `ui/traits-ui.js`. Effects: stats, damage dealt/taken, speed, and per-ability damage/healing/cooldown/cost.
- Traits are saved. Next: v0.11 Fellowship manoeuvres, then start areas, main story and voice-over.

## v0.11 – Fellowship manoeuvres
- Lotro-style group events: a panel appears with a hint ("The enemy raises its weapon...") and three answers – **Strike** (Z), **Guard** (X), **Rally** (H); all rebindable in Options. 9 seconds to decide.
- Started by certain abilities (Burglar: Dirty Trick and Fool's Luck; Captain: Herald's Cry and Pointed Command) or at random in tough fights (28 s cooldown).
- Reading the hint right gives a full-strength effect (Perfect). Companions answer by role (tank guards, damage strikes, healer/support rally); if all three answer types are covered, the group gets a bonus heal.
- Data: `data/fellowship.js` (manoeuvres, buffs, which abilities trigger). Logic: `systems/fellowship.js`. UI: `ui/fellowship-ui.js`.

## v0.12 – Zones, start areas and the main story (Book I)
- **Zone system:** `data/zones.js` (zones, NPCs, spawns), `Game.loadZone()`, portals (areas with `kind: 'portal'`), per-zone themes (`theme` colours) and props. Start zones are built from a small spec by `World.generateStart`.
- **Four start zones, one per race** (levels 1–4, five quests each): Shire/Bywater (Hobbit), Ered Luin/Thorin's Gate (Dwarf), Marches of Imladris (Elf), North Downs/Rangers' Watch (Man). Every chain ends with an "arrive" quest turned in to Marshal Halvard in Tirharad.
- **The merge:** all four chains lead to `m_gandalf` (The Grey Pilgrim) in Tirharad, then the shared Westmark chain (camp, tower, Gorthak) and the epilogue quests `m_orders` and `m_road`. Main-story quests have a ★ in the quest log. The Western Road in Tirharad leads back to your start zone.
- Saves remember the zone. `requires` in a quest may be a list (any of).
- Next: v0.13 voice-over for every quest (browser TTS per NPC, optional audio-file paths).

## Voice-over (v0.13)
Every quest text (offer / progress / done) and NPC line is read aloud. Each NPC has its own voice, pitch and rate (`voice` in data/zones.js); the browser's text-to-speech is used.
Recorded files are optional: list them in `data/vo.js` (`MEO.VO_FILES['sh_pups_offer'] = 'audio/vo/sh_pups_offer.mp3'`) or set `MEO.VO_AUTO = true` and drop `<key>.mp3` into `audio/vo/`. Missing files fall back to text-to-speech.
`audio/vo/vo-script.csv` lists all keys, speakers and texts (a recording script).
Settings: Options → Gameplay (voice-over on/off, volume, idle NPC lines). The dialogue has a 🔊 Replay button.

## v0.14 – Calm & polish
- Companions only fight enemies within 300 of you, and the Aggressive stance reaches shorter.
- Enemies no longer spawn within 3 tiles of towns and portals; Calm pace is slower (monster speed, aggro, attack rate, global cooldown 1.2×).
- Houses: timber framing, lit windows, stone foundations, banded roofs with ridge beams. Terrain: shrubs, flower beds, pebbles, more varied ground colour.
- v0.14.1: stronger terrain relief, birch and tall pine trees, ferns under trees.

## v0.15 – Book II: The Road to Rivendell
East gate of the Westmark → Weathertop (levels 13-16: Black Wargs, Hill Orc Hunters, Shades, boss "The Rider of Weathertop") → Rivendell (Elrond, Glorfindel, Bilbo, Erestor).
Main story continues after "The Road Goes Ever On": m_wt_road … m_rv_council (9 quests, all with voice-over).

## v0.16 – Book III: The Fellowship of the Ring
Rivendell east gate → Hollin (levels 17-20; Hollin Wolves, Isengard Scouts, Eregion Wights, boss "The Watcher in the Water", the Doors of Durin).
Quests: m_f_council, m_f_gather, m_f_depart, m_h_wolves, m_h_tokens, m_h_ruins, m_h_watcher, m_h_door (all with voice-over). Moria itself is not built yet.

## v0.17 – Book IV: The Mines of Moria
Hollin: the Doors of Durin → Moria (levels 21-26): goblins, orc captains, cave trolls, boss "The Troll of Balin's Tomb" and the final boss "Durin's Bane" on the Bridge of Khazad-dûm. Quests m_m_enter … m_m_bridge. Next: Lothlórien (Book V).

## v0.18 – Following the Fellowship
- Story: the player is no hero of the Ring but a member of the Following Watch (led by Halbarad), a day behind the Fellowship. Books II-IV rewritten; Gandalf's fall is part of the story (Moria's final boss is the Ember-fiend of the Bridge).
- Difficulty: enemies scale with party size (+50% health, +10% damage per extra member) and with Options -> Gameplay -> Difficulty (Story / Adventure / Heroic). Applies to newly spawned enemies (zone entry, respawn).
- Visuals: muted natural palette, blade grass, ragged tree crowns, mossy rocks, stronger ground texture, less bloom and saturation.


## v0.19 – Rings of Power lore layer
The story is re-told after *The Rings of Power* (Second Age). Quest/NPC/zone ids are unchanged internal keys; all names and texts are re-skinned at runtime by `data/lore-ra.js` (races, zones, NPCs, mobs, items) and `data/lore-ra-quests.js` (all quest texts). Races: Man of Númenor, Elf of Lindon, Dwarf of Khazad-dûm, Harfoot. You remain a nameless Wayfarer following the great ones (Galadriel, Elrond, Celebrimbor, Durin, Isildur, Halbrand).

## v0.20 – Flexible party
Press **P** to recruit or dismiss companions on the go (0–4, any class but your own). Free in towns and camps, 20 s cooldown elsewhere, blocked in combat. The roster is saved. Enemies scale with party size when they spawn.

## v0.21 – three.js renderer
Options → Graphics → Graphics engine: three.js (PBR lighting, soft shadows, tone mapping) or Classic. Put CC0 .glb files in assets/models/, run `node tools/pack-assets.js`, and map them in data/asset-map.js.

## v0.22 – Real houses
Villages are assembled from the Quaternius Medieval Village MegaKit (CC0): modular walls, doors, windows, tiled roofs and chimneys, with PBR textures. Toggle in Options → Graphics → Detailed houses. Kit source: assets/models/village_kit.glb, built by tools/merge_gltf.py; assembly logic in core/kit-buildings.js.

## v0.23 – glTF creatures and the animation library
`core/assets.js` draws creatures from glTF models when the three.js renderer is on, with
animations resolved by bone name: the Quaternius characters carry no clips, and the Universal
Animation Library (`assets/models/anims.glb`) supplies idle / walk / run / attack / hit / death
for anything on the same rig. `tools/build_glb.py` converts a kit's .gltf (or .glb) into one
self-contained .glb with embedded, down-scaled textures, and can keep a chosen set of animations
or strip geometry for an animation-only file. `data/asset-map.js` maps creatures to models.

## v0.24 – Dressed characters
People are drawn from Quaternius' "Modular Character Outfits – Fantasy" (CC0): villagers wear the
peasant outfit, the player, companions and brigands the ranger outfit, each in a male and a female
version picked from the character's name. They sit on the Universal Base Characters rig, so the
Universal Animation Library drives them. Orcs and goblins use the Ultimate Monsters orc.
Wolves, spiders and the great beasts are still procedural — no CC0 models for them yet.

## v0.25 – Real props
Barrels, crates, banners, torches, market stalls, the smithy and the house furniture are models
from Quaternius' Fantasy Props MegaKit (CC0), assembled by `core/kit-props.js`. The training
dummies use the kit's dummy. Toggle in Options → Graphics → Detailed props.

## v0.26 – Real trees, rocks and the undead
Trees and rocks come from the KayKit Forest Nature Pack (CC0) and are drawn with
`THREE.InstancedMesh`, so a forest of a thousand trees costs a handful of draw calls
(`core/kit-nature.js`; terrain records the spots it would have filled and skips its own
geometry). Barrow shades, ashen wights and the ash-wraith are KayKit skeletons, animated by
the KayKit Character Animations library.

Animation clips are matched to a model by its rig (`MEO.ASSET_RIG` / `MEO.ASSET_LIBS` in
data/asset-map.js): the Quaternius library drives the Quaternius characters, the KayKit library
the KayKit skeletons. A clip only plays on a model whose bone names it targets.

Toggles: Options → Graphics → Detailed trees and rocks.

## v0.27 – Cave groundwork (unfinished, off by default)
`core/kit-cave.js` dresses a zone marked `theme.cave` with the Mines and Cave Modular Set
(CC0, loafbrr): instanced cave and mine walls on every rock face, timber supports, pillars,
a rock ceiling, no sky and a torch that follows the player.

It is **off by default** (Options → Graphics → Cave dressing underground). Khazad-dûm was laid
out as open ground with scattered rock rather than as corridors and halls, so dressing it this
way leaves large empty stretches. Making it read as a cave needs the zone's layout rebuilt —
solid rock with carved passages — not just different models. The kit and the renderer support
are in place for that work.
