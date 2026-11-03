/* ==========================================================================
   core/models.js – Procedurally built 3D figures with skeletal animation
   Humanoids (warriors, healers, hunters, mages, NPCs), training dummies and sheep.
   Figures face +X in model space; right side = +Z. Height ≈ 1.8 m.
   Animation: walk, idle, attack, spellcasting, flinch and death.
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const U = MEO.util;
  const GL = MEO.GL;
  const M4 = GL.M4;
  const Models = (MEO.Models = {});

  const HALF_PI = Math.PI / 2;

  // ----------------------------------------------------------------------
  //  Styles
  // ----------------------------------------------------------------------
  const STYLES = {
    guardian: { armor: 'plate', weapon: 'sword', shield: true, helm: 'helm', cape: true },
    warden: { armor: 'leather', weapon: 'sword', shield: true, helm: 'helm', cape: true },
    champion: { armor: 'plate', weapon: 'sword', helm: 'helm', cape: true },
    captain: { armor: 'plate', weapon: 'sword', shield: true, cape: true },
    burglar: { armor: 'leather', weapon: 'sword', hood: true },
    hunter: { armor: 'leather', weapon: 'bow', quiver: true, hood: true, cape: true },
    minstrel: { robe: true, weapon: 'staff', orb: true, hairLong: true },
    runekeeper: { robe: true, weapon: 'staff', crystal: true, hairLong: true },
    loremaster: { robe: true, weapon: 'staff', crystal: true, hat: 'wizard', beard: true },
    marshal: { armor: 'plate', weapon: 'sword', helm: 'none', cape: true, beard: true },
    guard: { armor: 'plate', weapon: 'spear', helm: 'helm' },
    merchant: { armor: 'cloth', apron: true, hat: 'cap', backpack: true },
    smith: { armor: 'cloth', apron: true, weapon: 'hammer', beard: true },
    villager: { armor: 'cloth' },
    bandit: { armor: 'leather', bodyMain: true, weapon: 'dagger', hood: true, cape: true, mask: true },
    banditArcher: { armor: 'leather', bodyMain: true, weapon: 'bow', quiver: true, hood: true, mask: true },
    orc: { armor: 'plate', iron: true, weapon: 'axe', helm: 'orc', tusks: true, cape: false },
    orcBrute: { armor: 'plate', iron: true, weapon: 'club', helm: 'none', tusks: true, spikes: true, bald: true }
  };
  const MELEE1H = { sword: 1, hammer: 1, axe: 1, club: 1, dagger: 1 };

  function mk(fn) {
    const mb = new GL.MeshBuilder();
    fn(mb);
    return GL.buildMesh(mb);
  }

  const C = function (hex, k) {
    return k === undefined ? GL.rgb(hex) : GL.shade(hex, k);
  };

  // ----------------------------------------------------------------------
  //  Humanoid: build all parts
  // ----------------------------------------------------------------------
  function buildHumanoid(e, styleName) {
    const st = STYLES[styleName] || STYLES.villager;
    const main = C(e.color || '#556');
    const trim = C(e.trim || '#cba');
    const skin = C(e.skin || '#e0b590');
    const hair = C(e.hair || '#553');
    const steel = st.iron ? [92, 88, 98] : [150, 156, 168];
    const dark = [52, 42, 36];
    const leather = [112, 80, 50];

    const bodyCol = st.armor === 'plate' ? steel : st.armor === 'leather' ? (st.bodyMain ? main : C('#5a6e3c', 1)) : main;
    const sleeveCol = st.robe ? main : st.armor === 'plate' ? C(steel, 0.92) : st.armor === 'leather' ? leather : main;
    const legCol = st.armor === 'plate' ? [78, 74, 76] : st.armor === 'leather' ? [92, 70, 48] : C(main, 0.62);
    const rig = { kind: 'humanoid', style: styleName, st: st, weapon: st.weapon || null, height: 1.95, parts: {} };
    const P = rig.parts;

    const S2 = function (c, k) {
      return GL.shade(c, k);
    };
    const plate = st.armor === 'plate';
    const leath = st.armor === 'leather';

    // ---- legs (hang from the hip, origin at hip joint) ----
    P.leg = mk(function (mb) {
      // thigh and calf
      mb.capsule(0, -0.46, 0, 0.074, 0.1, 0.5, legCol, 10, { ao0: 0.75 });
      mb.capsule(0.005, -0.8, 0, 0.054, 0.076, 0.42, legCol, 10, { ao0: 0.7 });
      // boot: shaft + foot + toe cap
      mb.scyl(0, -0.72, 0, 0.066, 0.085, 0.2, leath || plate ? [70, 52, 38] : dark, 10, { ao0: 0.8 });
      mb.ellipsoid(0.07, -0.79, 0, 0.16, 0.065, 0.085, dark, 10, 0.7, 1);
      mb.ellipsoid(0.14, -0.78, 0, 0.06, 0.05, 0.075, S2(dark, 1.15), 8, 0.8, 1);
      if (plate) {
        mb.ellipsoid(0.065, -0.46, 0, 0.08, 0.075, 0.085, steel, 10, 0.85, 1);          // knee cop
        mb.scyl(0.004, -0.72, 0, 0.068, 0.082, 0.26, S2(steel, 0.9), 10, { ao0: 0.8, ao1: 0.95 }); // greave
        mb.scyl(0, -0.4, 0, 0.1, 0.108, 0.36, S2(legCol, 1.05), 10, { ao0: 0.85, ao1: 0.95 });    // cuisse
      }
    });

    // ---- body ----
    P.torso = mk(function (mb) {
      const xs = 0.68, zs = 1.12;
      // waist to shoulders, slightly flared at the chest
      mb.lathe(0, 0, 0, [[0.0, 0.0], [0.15, 0.0], [0.165, 0.12], [0.2, 0.34], [0.225, 0.5], [0.2, 0.58], [0.1, 0.64], [0.0, 0.65]],
        { color: bodyCol, seg: 16, xs: xs, zs: zs, ao0: 0.72, ao1: 1 });
      // hips
      mb.ellipsoid(0, -0.02, 0, 0.19 * xs * 1.18, 0.11, 0.2 * zs, S2(legCol, 1.0), 12, 0.75, 0.95);
      // neck
      mb.scyl(0, 0.6, 0, 0.065, 0.058, 0.12, skin, 10, { ao0: 0.8 });
      // belt and buckle
      mb.scyl(0, 0.03, 0, 0.172, 0.172, 0.085, dark, 16, { xs: xs * 1.02, zs: zs * 1.02, ao0: 0.85, ao1: 0.95, openTop: true, openBottom: true });
      mb.ellipsoid(0.125, 0.07, 0, 0.022, 0.04, 0.045, trim, 8, 0.9, 1);
      if (plate) {
        // breastplate with a ridge, gorget and tabard
        mb.lathe(0.012, 0.0, 0, [[0.0, 0.16], [0.18, 0.2], [0.215, 0.36], [0.235, 0.5], [0.2, 0.585], [0.0, 0.6]],
          { color: S2(steel, 1.02), seg: 16, xs: xs * 0.98, zs: zs * 1.0, ao0: 0.8, ao1: 1 });
        mb.ellipsoid(0.13, 0.42, 0, 0.05, 0.16, 0.025, S2(steel, 1.2), 8, 0.9, 1);
        mb.scyl(0, 0.56, 0, 0.115, 0.095, 0.075, S2(steel, 0.95), 12, { ao0: 0.85 });
        mb.capsule(0.17, 0.0, 0, 0.03, 0.05, 0.4, S2(main, 0.95), 8, { xs: 0.4, zs: 3.0, ao0: 0.85 });
        mb.box(0.19, 0.34, 0, 0.012, 0.07, 0.24, trim, 1);
        // faulds
        mb.scyl(0, -0.13, 0, 0.21, 0.185, 0.17, S2(steel, 0.9), 14, { xs: xs, zs: zs * 0.94, ao0: 0.8, ao1: 0.95, openTop: true });
      }
      if (leath) {
        mb.lathe(0.01, 0.0, 0, [[0.0, 0.1], [0.18, 0.14], [0.215, 0.34], [0.225, 0.5], [0.0, 0.54]], { color: [104, 74, 46], seg: 16, xs: xs * 0.98, zs: zs, ao0: 0.8 });
        mb.scyl(0, 0.48, 0, 0.23, 0.215, 0.07, [84, 58, 36], 16, { xs: xs, zs: zs, ao0: 0.9, openTop: true, openBottom: true });
        for (let k = 0; k < 3; k++) mb.box(0.15, 0.22 + k * 0.1, 0, 0.012, 0.025, 0.2, [140, 108, 70], 1);
      }
      if (st.robe) {
        mb.lathe(0.006, 0.0, 0, [[0.0, 0.22], [0.172, 0.24], [0.2, 0.4], [0.0, 0.46]], { color: trim, seg: 16, xs: xs * 0.55, zs: zs * 0.2, ao0: 0.9 });
        mb.scyl(0, 0.54, 0, 0.24, 0.22, 0.08, S2(main, 0.82), 16, { xs: xs, zs: zs * 1.02, ao0: 0.9, openTop: true, openBottom: true });
      }
      if (st.apron) mb.capsule(0.17, -0.1, 0, 0.03, 0.04, 0.66, st.weapon === 'hammer' ? [96, 66, 42] : trim, 8, { xs: 0.35, zs: 3.4, ao0: 0.85 });
      if (st.cape) {
        mb.ellipsoid(-0.2, 0.28, 0, 0.045, 0.46, 0.225, S2(main, 0.72), 12, 0.7, 1);
        mb.ellipsoid(-0.2, 0.58, 0, 0.07, 0.07, 0.25, S2(main, 0.8), 10, 0.9, 1);
      }
      if (st.spikes) {
        for (let k = -1; k <= 1; k += 2) {
          mb.push().translate(0, 0.58, 0.3 * k).rotX(k * 0.7);
          mb.cone(0, 0, 0, 0.06, 0.24, 7, [190, 188, 196], 1, true);
          mb.pop();
        }
        mb.capsule(0.17, 0.0, 0, 0.03, 0.05, 0.42, S2(main, 0.9), 8, { xs: 0.4, zs: 3.2, ao0: 0.85 });
      }
      if (st.backpack) {
        mb.ellipsoid(-0.26, 0.3, 0, 0.12, 0.22, 0.18, [118, 86, 52], 12, 0.7, 1);
        mb.ellipsoid(-0.27, 0.5, 0, 0.12, 0.07, 0.19, [92, 66, 40], 10, 0.9, 1);
      }
      if (st.quiver) {
        mb.push().translate(-0.2, 0.34, 0.12).rotZ(0.28);
        mb.scyl(0, -0.22, 0, 0.075, 0.068, 0.5, [110, 78, 48], 10, { ao0: 0.7 });
        for (let i = 0; i < 3; i++) mb.box(0, 0.32 + i * 0.01, (i - 1) * 0.04, 0.02, 0.1, 0.04, [220, 220, 210], 1);
        mb.pop();
      }
    });
    P.robe = st.robe
      ? mk(function (mb) {
        mb.lathe(0, 0, 0, [[0.43, 0.0], [0.4, 0.06], [0.34, 0.3], [0.285, 0.6], [0.25, 0.85], [0.235, 0.98]],
          { color: main, seg: 18, xs: 1, zs: 1, ao0: 0.6, ao1: 1 });
        mb.scyl(0, 0.0, 0, 0.44, 0.415, 0.09, trim, 18, { ao0: 0.9, openTop: true, openBottom: true });
        // folds
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + 0.3;
          mb.capsule(Math.cos(a) * 0.33, 0.06, Math.sin(a) * 0.33, 0.03, 0.02, 0.62, S2(main, 0.88), 6, { ao0: 0.7 });
        }
      })
      : null;

    // ---- head ----
    const jaw = st.tusks ? 1.15 : 1;
    P.head = mk(function (mb) {
      mb.scyl(0, -0.06, 0, 0.06, 0.055, 0.13, skin, 10, { ao0: 0.8 });                      // neck stub
      mb.ellipsoid(0, 0.19, 0, 0.125, 0.15, 0.115, skin, 14, 0.9, 1);                       // skull
      mb.ellipsoid(0.03, 0.09, 0, 0.095 * jaw, 0.085, 0.095 * jaw, S2(skin, 0.97), 12, 0.9, 1); // jaw
      mb.ellipsoid(0.12, 0.155, 0, 0.032, 0.04, 0.026, S2(skin, 0.95), 8, 0.9, 1);          // nose
      mb.ellipsoid(0.09, 0.225, 0, 0.04, 0.02, 0.1, S2(skin, 0.9), 8, 0.9, 1);              // brow
      for (let k = -1; k <= 1; k += 2) {
        mb.ellipsoid(0.1, 0.2, 0.046 * k, 0.018, 0.021, 0.026, [236, 232, 220], 8, 0.95, 1); // eyeballs
        mb.ellipsoid(0.113, 0.2, 0.046 * k, 0.008, 0.013, 0.014, st.tusks ? [210, 60, 30] : [34, 28, 24], 6, 1, 1);
        mb.ellipsoid(0.0, 0.18, 0.118 * k, 0.026, 0.045, 0.014, S2(skin, 0.94), 8, 0.9, 1);  // ears
      }
      mb.ellipsoid(0.105, 0.115, 0, 0.022, 0.01, 0.04, S2(skin, 0.78), 6, 1, 1);            // mouth
      if (st.helm === 'orc') {
        mb.lathe(0, 0.2, 0, [[0.158, 0.0], [0.17, 0.06], [0.14, 0.14], [0.07, 0.2], [0.0, 0.215]], { color: steel, seg: 16, xs: 1.0, zs: 0.98, ao0: 0.8 });
        mb.box(0.145, 0.2, 0, 0.025, 0.14, 0.04, S2(steel, 0.9), 1);
        mb.push().translate(0, 0.34, 0.14).rotX(0.9); mb.cone(0, 0, 0, 0.045, 0.24, 7, [214, 204, 172], 1, true); mb.pop();
        mb.push().translate(0, 0.34, -0.14).rotX(-0.9); mb.cone(0, 0, 0, 0.045, 0.24, 7, [214, 204, 172], 1, true); mb.pop();
      } else if (st.helm === 'helm') {
        mb.lathe(0, 0.16, 0, [[0.13, 0.0], [0.152, 0.07], [0.15, 0.15], [0.115, 0.23], [0.05, 0.28], [0.0, 0.29]], { color: S2(steel, 1.05), seg: 18, xs: 1.02, zs: 1.0, ao0: 0.8 });
        mb.box(0.145, 0.22, 0, 0.022, 0.15, 0.036, S2(steel, 0.9), 1);                      // nasal
        mb.ellipsoid(-0.02, 0.42, 0, 0.13, 0.04, 0.02, main, 8, 0.9, 1);                    // crest
        mb.ellipsoid(-0.12, 0.38, 0, 0.12, 0.04, 0.018, main, 8, 0.8, 1);
      } else if (st.hood) {
        const hc = S2(main, 0.62);
        mb.lathe(-0.03, 0.0, 0, [[0.0, 0.0], [0.17, 0.05], [0.185, 0.2], [0.16, 0.31], [0.07, 0.38], [0.0, 0.39]], { color: hc, seg: 16, xs: 0.98, zs: 1.0, ao0: 0.65 });
        mb.ellipsoid(-0.12, 0.05, 0, 0.1, 0.17, 0.14, hc, 10, 0.7, 1);
        mb.ellipsoid(0.08, 0.2, 0, 0.06, 0.1, 0.1, [28, 24, 22], 8, 0.4, 0.6);               // face shadow
      } else if (st.hat === 'wizard') {
        mb.ellipsoid(-0.03, 0.26, 0, 0.14, 0.09, 0.14, hair, 10, 0.85, 1);
        mb.lathe(0, 0.3, 0, [[0.0, 0.0], [0.32, 0.0], [0.34, 0.02], [0.2, 0.05], [0.14, 0.08]], { color: S2(main, 0.82), seg: 18, ao0: 0.9, ao1: 1 });
        mb.push().translate(-0.04, 0.32, 0).rotZ(0.22);
        mb.lathe(0, 0, 0, [[0.16, 0.0], [0.14, 0.15], [0.1, 0.32], [0.06, 0.5], [0.032, 0.64], [0.0, 0.72]], { color: S2(main, 0.9), seg: 14, ao0: 0.7 });
        mb.scyl(0, 0.03, 0, 0.165, 0.158, 0.06, trim, 14, { ao0: 0.9 });
        mb.pop();
      } else if (st.hat === 'cap') {
        mb.lathe(0, 0.24, 0, [[0.152, 0.0], [0.15, 0.05], [0.1, 0.1], [0.0, 0.12]], { color: [128, 62, 54], seg: 14, ao0: 0.85 });
        mb.ellipsoid(0.13, 0.28, 0, 0.08, 0.016, 0.1, [108, 50, 44], 8, 0.9, 1);
      } else if (!st.bald) {
        mb.ellipsoid(-0.035, 0.235, 0, 0.14, 0.13, 0.133, hair, 12, 0.8, 1);
        mb.ellipsoid(0.07, 0.3, 0, 0.07, 0.04, 0.12, hair, 8, 0.85, 1);                      // fringe
      }
      if (st.tusks) {
        for (let k = -1; k <= 1; k += 2) {
          mb.push().translate(0.115, 0.075, 0.05 * k).rotZ(-0.2);
          mb.cone(0, 0, 0, 0.022, 0.1, 6, [236, 230, 204], 1, true);
          mb.pop();
        }
        mb.ellipsoid(0.12, 0.12, 0, 0.04, 0.03, 0.08, S2(skin, 0.78), 8, 1, 1);
      }
      if (st.mask) mb.lathe(0.0, 0.05, 0, [[0.0, 0.0], [0.12, 0.0], [0.125, 0.1], [0.0, 0.12]], { color: [48, 40, 36], seg: 12, xs: 0.98, zs: 0.95 });
      if (st.hairLong) {
        mb.ellipsoid(-0.1, 0.0, 0, 0.07, 0.24, 0.14, hair, 10, 0.7, 1);
        mb.ellipsoid(-0.11, -0.14, 0, 0.06, 0.12, 0.1, hair, 8, 0.7, 1);
      }
      if (st.beard) {
        mb.ellipsoid(0.07, 0.03, 0, 0.085, 0.13, 0.1, hair, 10, 0.8, 1);
        mb.ellipsoid(0.1, 0.1, 0, 0.04, 0.03, 0.08, hair, 8, 0.9, 1);
      }
    });

    // ---- arms (origin at the shoulder) ----
    const sleeveW = st.robe ? 1.25 : 1;
    const arm = function (side) {
      return mk(function (mb) {
        mb.capsule(0, -0.34, 0, 0.05 * sleeveW, 0.064 * sleeveW, 0.36, sleeveCol, 10, { ao0: 0.8 });          // upper arm
        mb.capsule(0.01, -0.62, 0, 0.038 * sleeveW, 0.052 * sleeveW, 0.3, plate ? S2(steel, 0.92) : (st.robe ? sleeveCol : skin), 10, { ao0: 0.8 }); // forearm
        mb.ellipsoid(0.02, -0.64, 0, 0.055, 0.065, 0.05, skin, 10, 0.85, 1);                                  // hand
        if (plate) {
          mb.ellipsoid(0, 0.0, 0.0, 0.095, 0.075, 0.105, steel, 12, 0.85, 1);                                 // pauldron
          mb.ellipsoid(0, 0.035, 0.0, 0.07, 0.04, 0.085, S2(steel, 1.15), 10, 0.9, 1);
          mb.ellipsoid(0.01, -0.34, 0, 0.06, 0.06, 0.06, steel, 8, 0.9, 1);                                   // elbow cop
          mb.scyl(0.012, -0.64, 0, 0.044, 0.056, 0.12, S2(steel, 1.0), 10, { ao0: 0.85 });                   // gauntlet cuff
        } else if (leath) {
          mb.ellipsoid(0, 0.0, 0.0, 0.082, 0.06, 0.085, [96, 68, 44], 10, 0.85, 1);
          mb.scyl(0.01, -0.58, 0, 0.045, 0.04, 0.1, [84, 58, 36], 10, { ao0: 0.85 });
        } else {
          mb.ellipsoid(0, -0.01, 0, 0.07 * sleeveW, 0.06, 0.07 * sleeveW, sleeveCol, 10, 0.85, 1);
        }
      });
    };
    P.armR = arm(1);
    P.armL = arm(-1);

    // ---- weapons (hand space: +X = forward, +Y = up) ----
    const gold = [218, 188, 96];
    switch (st.weapon) {
      case 'sword':
        P.weapon = mk(function (mb) {
          mb.box(0.04, 0, 0, 0.16, 0.045, 0.045, [86, 60, 40], 0.9);
          mb.box(0.13, 0, 0, 0.035, 0.05, 0.22, gold, 1);
          mb.box(0.66, 0, 0, 1.0, 0.03, 0.1, [208, 214, 224], 1);
          mb.box(0.66, 0.0, 0, 0.9, 0.034, 0.025, [160, 168, 180], 1);
          mb.push().translate(1.16, 0, 0).rotZ(-HALF_PI);
          mb.cone(0, 0, 0, 0.05, 0.14, 4, [208, 214, 224], 1, true);
          mb.pop();
          mb.blob(-0.05, 0, 0, 0.035, 0.035, 0.035, gold, 0, 0, 1, 1);
        });
        break;
      case 'dagger':
        P.weapon = mk(function (mb) {
          mb.box(0.04, 0, 0, 0.12, 0.04, 0.04, [70, 52, 38], 0.9);
          mb.box(0.1, 0, 0, 0.03, 0.04, 0.12, [160, 140, 90], 1);
          mb.box(0.3, 0, 0, 0.36, 0.025, 0.07, [200, 204, 212], 1);
        });
        break;
      case 'axe':
        P.weapon = mk(function (mb) {
          mb.box(0.3, 0, 0, 0.78, 0.05, 0.05, [96, 70, 44], 0.9);
          mb.box(0.62, 0.0, 0.1, 0.16, 0.2, 0.12, [160, 164, 172], 1);
          mb.box(0.62, 0.0, 0.18, 0.1, 0.26, 0.05, [190, 194, 204], 1);
          mb.box(0.62, 0.0, -0.05, 0.06, 0.1, 0.06, [90, 90, 98], 1);
        });
        break;
      case 'club':
        P.weapon = mk(function (mb) {
          mb.box(0.36, 0, 0, 0.9, 0.07, 0.07, [100, 72, 46], 0.9);
          mb.box(0.78, 0, 0, 0.3, 0.2, 0.2, [84, 62, 42], 0.9);
          for (let a = 0; a < 4; a++) {
            mb.push().translate(0.78, 0, 0).rotX(a * 1.5708);
            mb.cone(0, 0.1, 0, 0.04, 0.12, 4, [190, 190, 196], 1, true);
            mb.pop();
          }
        });
        break;
      case 'spear':
        P.weapon = mk(function (mb) {
          mb.box(0.65, 0, 0, 2.1, 0.04, 0.04, [120, 88, 54], 0.9);
          mb.push().translate(1.7, 0, 0).rotZ(-HALF_PI);
          mb.cone(0, 0, 0, 0.06, 0.34, 4, [196, 202, 212], 1, true);
          mb.pop();
        });
        break;
      case 'hammer':
        P.weapon = mk(function (mb) {
          mb.box(0.3, 0, 0, 0.75, 0.05, 0.05, [110, 78, 46], 0.9);
          mb.box(0.7, 0, 0, 0.2, 0.15, 0.15, [74, 76, 84], 0.9);
        });
        break;
      case 'staff':
        P.weapon = mk(function (mb) {
          mb.push().rotZ(-0.26);
          mb.box(0, 0.35, 0, 0.05, 1.95, 0.05, [104, 74, 46], 0.85);
          mb.box(0, 1.3, 0, 0.1, 0.16, 0.1, gold, 1);
          mb.pop();
        });
        P.weaponGlow = mk(function (mb) {
          mb.push().rotZ(-0.26);
          if (st.crystal) {
            mb.cone(0, 1.42, 0, 0.1, 0.22, 5, [130, 190, 255], 1, true);
            mb.push().translate(0, 1.42, 0).rotZ(Math.PI);
            mb.cone(0, 0, 0, 0.1, 0.2, 5, [90, 150, 240], 1, true);
            mb.pop();
          } else {
            mb.blob(0, 1.46, 0, 0.1, 0.1, 0.1, [255, 236, 160], 1, 0, 1, 1);
          }
          mb.pop();
        });
        rig.glow = st.crystal ? [0.25, 0.4, 0.75] : [0.55, 0.48, 0.2];
        break;
      case 'bow': {
        P.offhand = mk(function (mb) {
          mb.push().rotZ(-0.4);
          const n = 10;
          for (let i = 0; i < n; i++) {
            const t0 = (i / n) * 2 - 1;
            const t1 = ((i + 1) / n) * 2 - 1;
            const p0 = [0.13 * (1 - t0 * t0), t0 * 0.7];
            const p1 = [0.13 * (1 - t1 * t1), t1 * 0.7];
            const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
            const ang = Math.atan2(-(p1[0] - p0[0]), p1[1] - p0[1]);
            const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.01;
            mb.push().translate(mx, my, 0).rotZ(ang);
            mb.box(0, 0, 0, 0.035, len, 0.04, [118, 82, 48], 0.9);
            mb.pop();
          }
          mb.box(0, 0, 0, 0.008, 1.42, 0.008, [226, 222, 206], 1);
          mb.pop();
        });
        break;
      }
      default:
        break;
    }
    if (st.shield) {
      P.offhand = mk(function (mb) {
        mb.push().translate(0.1, 0.0, -0.1).rotZ(HALF_PI);
        mb.cyl(0, -0.03, 0, 0.4, 0.4, 0.07, 10, main, 0.85);
        mb.cyl(0, 0.03, 0, 0.42, 0.42, 0.03, 10, trim, 1, true);
        mb.cyl(0, 0.04, 0, 0.12, 0.08, 0.06, 8, [200, 204, 214], 1);
        mb.pop();
      });
    }
    if (st.hat === 'wizard') rig.height = 2.4;
    return rig;
  }

  // ----------------------------------------------------------------------
  //  Dummy and sheep
  // ----------------------------------------------------------------------
  function buildDummy(e) {
    const body = C(e.color || '#d8bf72');
    const wood = C(e.trim || '#8a6038');
    const armored = e.def && e.def.armor >= 800;
    const puncher = !!e.attack;
    const rig = { kind: 'dummy', height: 2.15, parts: {}, puncher: puncher };
    rig.parts.base = mk(function (mb) {
      mb.cyl(0, 0, 0, 0.62, 0.55, 0.16, 8, [104, 74, 44], 0.55);
      mb.cyl(0, 0.15, 0, 0.09, 0.08, 1.75, 6, wood, 0.7, false);
      mb.blob(0, 1.18, 0, 0.3, 0.44, 0.26, body, 1, 0.08, 7, 0.55);
      mb.blob(0, 1.78, 0, 0.17, 0.19, 0.17, GL.shade(body, 0.92), 1, 0.08, 9, 0.7);
      mb.box(0.15, 1.82, 0.07, 0.03, 0.035, 0.035, [40, 30, 22], 1);
      mb.box(0.15, 1.82, -0.07, 0.03, 0.035, 0.035, [40, 30, 22], 1);
      mb.box(0.14, 1.12, 0, 0.03, 0.04, 0.6, [90, 64, 40], 0.9);
      mb.box(0.14, 1.12, 0, 0.03, 0.6, 0.04, [90, 64, 40], 0.9);
      if (armored) {
        mb.box(0.1, 1.2, 0, 0.12, 0.5, 0.46, [168, 172, 182], 0.8);
        mb.box(0.1, 1.5, 0, 0.14, 0.12, 0.5, [190, 194, 204], 1);
        mb.blob(0, 1.9, 0, 0.19, 0.12, 0.19, [168, 172, 182], 1, 0, 3, 0.8);
      }
    });
    rig.parts.arms = mk(function (mb) {
      mb.box(0, 1.42, 0, 0.1, 0.1, 1.15, wood, 0.8);
      mb.blob(0, 1.42, 0.62, 0.08, 0.08, 0.08, body, 0, 0, 1, 0.8);
      mb.blob(0, 1.42, -0.62, 0.08, 0.08, 0.08, body, 0, 0, 2, 0.8);
      if (puncher) {
        mb.box(0, 1.42, 0.72, 0.2, 0.2, 0.2, [168, 58, 42], 0.9);
        mb.box(0, 1.42, -0.72, 0.2, 0.2, 0.2, [168, 58, 42], 0.9);
      }
    });
    return rig;
  }

  function buildSheep() {
    const rig = { kind: 'sheep', height: 1.25, parts: {} };
    rig.parts.body = mk(function (mb) {
      const wool = [238, 236, 228];
      mb.blob(0, 0.62, 0, 0.55, 0.42, 0.4, wool, 1, 0.1, 3, 0.7);
      mb.blob(0.1, 0.78, 0.12, 0.34, 0.28, 0.28, GL.shade(wool, 0.97), 1, 0.1, 4, 0.8);
      mb.blob(-0.12, 0.8, -0.14, 0.3, 0.25, 0.26, GL.shade(wool, 0.95), 1, 0.1, 5, 0.8);
      mb.blob(0.55, 0.72, 0, 0.17, 0.2, 0.15, [70, 62, 58], 1, 0, 6, 0.9);
      mb.box(0.68, 0.74, 0.07, 0.03, 0.04, 0.04, [250, 250, 250], 1);
      mb.box(0.68, 0.74, -0.07, 0.03, 0.04, 0.04, [250, 250, 250], 1);
      mb.box(0.5, 0.88, 0.17, 0.12, 0.05, 0.1, [60, 54, 50], 1);
      mb.box(0.5, 0.88, -0.17, 0.12, 0.05, 0.1, [60, 54, 50], 1);
      const legs = [[0.3, 0.2], [0.3, -0.2], [-0.3, 0.2], [-0.3, -0.2]];
      legs.forEach(function (l) {
        mb.box(l[0], 0.2, l[1], 0.1, 0.4, 0.1, [66, 58, 54], 0.7);
      });
    });
    return rig;
  }

  // ----------------------------------------------------------------------
  //  Wolf
  // ----------------------------------------------------------------------
  function buildWolf(e) {
    const fur = C(e.color || '#6e6a62');
    const belly = C(e.trim || '#c9c2b2');
    const dark = GL.shade(fur, 0.6);
    const rig = { kind: 'wolf', height: 1.05, parts: {} };
    const P = rig.parts;
    P.body = mk(function (mb) {
      mb.ellipsoid(-0.05, 0.64, 0, 0.5, 0.25, 0.19, fur, 14, 0.7, 1);                 // barrel
      mb.ellipsoid(0.3, 0.7, 0, 0.27, 0.27, 0.2, fur, 12, 0.75, 1);                  // chest and shoulders
      mb.ellipsoid(-0.36, 0.63, 0, 0.26, 0.23, 0.19, GL.shade(fur, 0.96), 12, 0.7, 1); // haunches
      mb.ellipsoid(0.0, 0.49, 0, 0.42, 0.1, 0.15, belly, 10, 0.8, 1);                  // belly
      mb.ellipsoid(0.33, 0.56, 0, 0.16, 0.14, 0.15, belly, 8, 0.85, 1);                // throat
      // mane: tufts along the back
      for (let k = 0; k < 7; k++) {
        const x = 0.4 - k * 0.14;
        mb.push().translate(x, 0.84 - Math.abs(k - 2) * 0.012, 0).rotZ(-0.35 - k * 0.04);
        mb.cone(0, 0, 0, 0.065, 0.2 - k * 0.012, 6, GL.shade(fur, 0.78), 0.8, true);
        mb.pop();
      }
      mb.ellipsoid(0.42, 0.84, 0, 0.16, 0.12, 0.16, GL.shade(fur, 0.85), 8, 0.8, 1);   // neck ruff
    });
    P.head = mk(function (mb) {
      mb.ellipsoid(0.1, 0, 0, 0.17, 0.15, 0.135, fur, 12, 0.8, 1);                    // skull
      mb.push().translate(0.2, -0.03, 0).rotZ(-Math.PI / 2 + 0.08);
      mb.capsule(0, 0, 0, 0.05, 0.085, 0.3, belly, 10, { ao0: 0.85 });                // snout
      mb.pop();
      mb.ellipsoid(0.3, 0.0, 0, 0.1, 0.03, 0.06, fur, 8, 0.9, 1);                      // snout bridge
      mb.ellipsoid(0.495, -0.03, 0, 0.035, 0.03, 0.04, [26, 22, 22], 8, 1, 1);        // nose
      mb.ellipsoid(0.33, -0.095, 0, 0.1, 0.022, 0.05, [190, 80, 80], 8, 0.9, 1);      // lower jaw / tongue
      for (let k = -1; k <= 1; k += 2) {
        mb.push().translate(0.04, 0.12, 0.09 * k).rotX(0.25 * k);
        mb.cone(0, 0, 0, 0.06, 0.17, 7, dark, 1, true);
        mb.pop();
        mb.ellipsoid(0.2, 0.05, 0.078 * k, 0.026, 0.017, 0.012, [255, 214, 70], 6, 1, 1);  // eyes
        mb.push().translate(0.42, -0.07, 0.035 * k).rotZ(Math.PI);
        mb.cone(0, 0, 0, 0.014, 0.05, 5, [244, 240, 228], 1, true);                    // fangs
        mb.pop();
      }
    });
    P.tail = mk(function (mb) {
      mb.push().rotZ(Math.PI / 2 + 0.55);
      mb.capsule(0, 0, 0, 0.03, 0.07, 0.52, fur, 8, { ao0: 0.8 });
      mb.pop();
      mb.ellipsoid(-0.2, -0.28, 0, 0.1, 0.07, 0.07, GL.shade(fur, 0.8), 8, 0.8, 1);
    });
    P.leg = mk(function (mb) {
      mb.capsule(0, -0.3, 0, 0.055, 0.08, 0.34, fur, 8, { ao0: 0.75 });                // upper leg
      mb.capsule(0.015, -0.6, 0, 0.034, 0.052, 0.34, GL.shade(fur, 0.9), 8, { ao0: 0.75 }); // lower leg
      mb.ellipsoid(0.055, -0.6, 0, 0.085, 0.04, 0.052, dark, 8, 0.8, 1);               // paw
    });
    return rig;
  }

  function drawWolf(e, rig, x, y, z, now, a, tint, draw) {
    const P = rig.parts;
    const walk = a.walk;
    const sinP = Math.sin(a.phase * 1.25);
    const since = now - e.hitTime;
    const atkAge = now - a.atkT;
    const atk = atkAge >= 0 && atkAge < 0.45 ? atkAge / 0.45 : -1;
    const lunge = atk >= 0 ? Math.sin(atk * Math.PI) * 0.35 : 0;
    let fall = 0;
    if (!e.alive) fall = ease(U.clamp((MEO.Engine.time - e.deathTime) / 0.5, 0, 1));
    const sc = e.scale || 1;

    M4.identity(m0);
    M4.translate(m0, m0, x, y, z);
    M4.rotateY(m0, m0, -a.face);
    M4.scale(m0, m0, sc, sc, sc);
    if (fall > 0) {
      M4.translate(m0, m0, 0, 0.18 * fall, 0);
      M4.rotateX(m0, m0, 1.5 * fall);
    }
    const bob = Math.abs(sinP) * 0.07 * walk;
    const idle = Math.sin(now * 1.7 + e.id) * 0.012;
    const flinch = since < 0.2 && e.alive ? (0.2 - since) * -0.9 : 0;
    M4.translate(m1, m0, lunge, bob + idle, 0);
    M4.rotateZ(m1, m1, -0.05 * walk + flinch - (atk >= 0 ? Math.sin(atk * Math.PI) * 0.1 : 0));
    draw(P.body, m1, tint, NONE, 1);

    // head
    M4.translate(m2, m1, 0.5, 0.78, 0);
    const bite = atk >= 0 ? Math.sin(atk * Math.PI) * 0.55 : 0;
    M4.rotateZ(m2, m2, -0.18 - bite - walk * 0.05 + Math.sin(now * 0.9 + e.id) * 0.04 * (1 - walk));
    M4.rotateY(m2, m2, Math.sin(now * 0.6 + e.id) * 0.1 * (1 - walk));
    draw(P.head, m2, tint, NONE, 1);

    // tail
    M4.translate(m2, m1, -0.55, 0.7, 0);
    M4.rotateY(m2, m2, Math.sin(now * (e.inCombat ? 7 : 2.2) + e.id) * 0.35);
    M4.rotateZ(m2, m2, walk * 0.3 + (e.inCombat ? 0.25 : 0));
    draw(P.tail, m2, tint, NONE, 1);

    // legs: diagonal pairs
    const legs = [[0.32, 0.13, 0], [0.32, -0.13, Math.PI], [-0.34, 0.13, Math.PI], [-0.34, -0.13, 0]];
    for (let i = 0; i < 4; i++) {
      const l = legs[i];
      M4.translate(m2, m1, l[0], 0.62, l[1]);
      M4.rotateZ(m2, m2, Math.sin(a.phase * 1.25 + l[2]) * 0.95 * walk + (atk >= 0 && i < 2 ? -0.5 * Math.sin(atk * Math.PI) : 0));
      draw(P.leg, m2, tint, NONE, 1);
    }
  }

  // ----------------------------------------------------------------------
  //  Spider
  // ----------------------------------------------------------------------
  function buildSpider(e) {
    const body = C(e.color || '#2f2a36');
    const mark = C(e.trim || '#8a3a52');
    const rig = { kind: 'spider', height: 1.0, parts: {} };
    const P = rig.parts;
    P.body = mk(function (mb) {
      mb.ellipsoid(-0.38, 0.58, 0, 0.4, 0.32, 0.32, body, 14, 0.65, 1);                // abdomen
      mb.ellipsoid(-0.38, 0.86, 0, 0.14, 0.03, 0.1, mark, 8, 1, 1);                     // marking
      mb.ellipsoid(-0.38, 0.84, 0, 0.05, 0.04, 0.2, mark, 8, 1, 1);
      mb.ellipsoid(0.08, 0.52, 0, 0.28, 0.2, 0.24, GL.shade(body, 1.15), 12, 0.7, 1);  // cephalothorax
      mb.ellipsoid(0.38, 0.5, 0, 0.15, 0.13, 0.15, GL.shade(body, 1.25), 10, 0.8, 1);  // head
      for (let k = 0; k < 8; k++) {
        const zz = (k % 2 ? 1 : -1) * (k < 4 ? 0.045 : 0.085);
        const yy = 0.57 + (k < 4 ? 0.03 : -0.0) + (k % 4 > 1 ? 0.02 : 0);
        mb.ellipsoid(0.5, yy, zz * (1 + (k >> 1) * 0.1), 0.022, 0.022, 0.022, [236, 40, 40], 6, 1, 1);
      }
      for (let k = -1; k <= 1; k += 2) {
        mb.push().translate(0.5, 0.44, 0.06 * k).rotZ(Math.PI + 0.2);
        mb.cone(0, 0, 0, 0.035, 0.16, 6, [214, 204, 184], 1, true);
        mb.pop();
        mb.ellipsoid(0.46, 0.4, 0.1 * k, 0.05, 0.04, 0.04, GL.shade(body, 1.4), 6, 0.9, 1);  // palps
      }
      // bristles
      for (let k = 0; k < 10; k++) {
        const a = k * 0.9;
        mb.push().translate(-0.4 + Math.cos(a) * 0.18, 0.78 + Math.sin(a * 2) * 0.06, Math.sin(a) * 0.2).rotZ(-0.4);
        mb.cone(0, 0, 0, 0.012, 0.12, 4, GL.shade(body, 1.5), 1, true);
        mb.pop();
      }
    });
    P.leg = mk(function (mb) {
      mb.push().rotX(1.0);
      mb.capsule(0, 0, 0, 0.032, 0.05, 0.52, GL.shade(body, 1.2), 7, { ao0: 0.8 });
      mb.pop();
      mb.ellipsoid(0, 0.27, 0.42, 0.05, 0.05, 0.05, GL.shade(body, 1.3), 6, 0.9, 1);   // knee joint
      mb.push().translate(0, 0.27, 0.42).rotX(2.6);
      mb.capsule(0, 0, 0, 0.018, 0.04, 0.92, GL.shade(body, 1.05), 7, { ao0: 0.8 });
      mb.pop();
    });
    return rig;
  }

  function drawSpider(e, rig, x, y, z, now, a, tint, draw) {
    const P = rig.parts;
    const walk = a.walk;
    const since = now - e.hitTime;
    const atkAge = now - a.atkT;
    const atk = atkAge >= 0 && atkAge < 0.4 ? atkAge / 0.4 : -1;
    let fall = 0;
    if (!e.alive) fall = ease(U.clamp((MEO.Engine.time - e.deathTime) / 0.6, 0, 1));
    const sc = e.scale || 1;
    M4.identity(m0);
    M4.translate(m0, m0, x, y, z);
    M4.rotateY(m0, m0, -a.face);
    M4.scale(m0, m0, sc, sc, sc);
    if (fall > 0) {
      M4.translate(m0, m0, 0, 0.7 * fall, 0);
      M4.rotateX(m0, m0, Math.PI * fall);
    }
    const lunge = atk >= 0 ? Math.sin(atk * Math.PI) * 0.3 : 0;
    const pitch = atk >= 0 ? -Math.sin(atk * Math.PI) * 0.35 : since < 0.2 && e.alive ? 0.15 : 0;
    const bob = Math.abs(Math.sin(a.phase * 1.5)) * 0.04 * walk + Math.sin(now * 2 + e.id) * 0.01;
    M4.translate(m1, m0, lunge, bob, 0);
    M4.rotateZ(m1, m1, pitch);
    draw(P.body, m1, tint, NONE, 1);

    const yaws = [0.85, 0.3, -0.3, -0.85];
    for (let i = 0; i < 4; i++) {
      const wig = Math.sin(a.phase * 1.5 + (i % 2) * Math.PI + i * 0.5) * 0.42 * walk + Math.sin(now * 1.3 + i) * 0.03;
      const curl = fall * 0.9;
      // right (+Z)
      M4.translate(m2, m1, 0.2 - i * 0.14, 0.52, 0);
      M4.rotateY(m2, m2, yaws[i] + wig);
      if (curl) M4.rotateX(m2, m2, -curl);
      draw(P.leg, m2, tint, NONE, 1);
      // left (-Z): mirrored
      M4.translate(m2, m1, 0.2 - i * 0.14, 0.52, 0);
      M4.rotateY(m2, m2, Math.PI - yaws[i] + wig);
      if (curl) M4.rotateX(m2, m2, -curl);
      draw(P.leg, m2, tint, NONE, 1);
    }
  }

  // ----------------------------------------------------------------------
  //  Rig lookup
  // ----------------------------------------------------------------------
  function styleOf(e) {
    if (e.type === 'player' || e.type === 'party') return e.classId || 'guardian';
    return e.style || 'villager';
  }

  Models.rigFor = function (e) {
    const kind = e.shape === 'dummy' ? 'dummy' : e.shape === 'wolf' ? 'wolf' : e.shape === 'spider' ? 'spider' : 'humanoid';
    const style = kind !== 'humanoid' ? kind : styleOf(e);
    const key = [kind, style, e.color, e.trim, e.skin, e.hair, e.armored].join('|');
    if (e._rigKey === key && e._rig) return e._rig;
    Models._cache = Models._cache || {};
    let rig = Models._cache[key];
    if (!rig) {
      rig = kind === 'dummy' ? buildDummy(e) : kind === 'wolf' ? buildWolf(e) : kind === 'spider' ? buildSpider(e) : buildHumanoid(e, style);
      Models._cache[key] = rig;
    }
    e._rig = rig;
    e._rigKey = key;
    return rig;
  };

  Models.sheep = function () {
    if (!Models._sheep) Models._sheep = buildSheep();
    return Models._sheep;
  };

  Models.heightOf = function (e) {
    if (MEO.Buffs && e.buffs && e.buffs.length && MEO.Buffs.has(e, 'incapacitate')) return 1.35;
    return Models.rigFor(e).height * (e.scale || 1);
  };

  // ----------------------------------------------------------------------
  //  Animation and drawing
  // ----------------------------------------------------------------------
  const m0 = M4.create(), m1 = M4.create(), m2 = M4.create(), m3 = M4.create(), m4 = M4.create();
  const NONE = [0, 0, 0, 0];
  const lerp = U.lerp;
  const ease = function (t) { return 1 - (1 - t) * (1 - t); };

  function animState(e, now, moving) {
    let a = e._anim;
    if (!a) {
      a = e._anim = { phase: Math.random() * 6, walk: 0, last: now, atkT: -10, face: e.facing, castT: -10 };
    }
    const dt = Math.min(0.1, Math.max(0, now - a.last));
    a.last = now;
    a.walk += ((moving ? 1 : 0) - a.walk) * Math.min(1, dt * 11);
    a.phase += dt * (moving ? 6.2 : 2.2);
    // smooth turn toward facing
    let d = e.facing - a.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.face += d * Math.min(1, dt * 16);
    return a;
  }

  /**
   * Draw a creature. draw(mesh, matrix, tint[4], emis[3], alpha) called per part.
   * x,z in meters, y = terrain height, facing in radians (game angle).
   */
  Models.draw = function (e, x, y, z, now, draw) {
    const B = MEO.Buffs;
    const poly = e.buffs.length > 0 && B.has(e, 'incapacitate');
    const since = now - e.hitTime;
    const flash = since < 0.18 ? 1 - since / 0.18 : 0;
    const tint = flash > 0 ? [1, 0.35, 0.3, flash * 0.55] : NONE;
    const moving = e.moving && e.alive;
    const a = animState(e, now, moving);
    const face = e.type === 'mob' && e.shape === 'dummy' ? e.facing : a.face;

    // ---- sheep (polymorphed) ----
    if (poly && e.alive) {
      const rig = Models.sheep();
      M4.identity(m0);
      M4.translate(m0, m0, x, y + Math.abs(Math.sin(a.phase * 0.7)) * 0.05 * (moving ? 1 : 0.2), z);
      M4.rotateY(m0, m0, -face);
      M4.scale(m0, m0, 1.0, 1.0, 1.0);
      draw(rig.parts.body, m0, tint, NONE, 1);
      return;
    }

    const rig = Models.rigFor(e);
    if (rig.kind === 'dummy') return drawDummy(e, rig, x, y, z, now, a, tint, draw);
    if (rig.kind === 'wolf') return drawWolf(e, rig, x, y, z, now, a, tint, draw);
    if (rig.kind === 'spider') return drawSpider(e, rig, x, y, z, now, a, tint, draw);

    // ---- humanoid ----
    const P = rig.parts;
    const st = rig.st;
    const t = now;
    const walk = a.walk;
    const sinP = Math.sin(a.phase);
    const idle = Math.sin(t * 1.9 + e.id) * 0.012;

    // death animation
    let fall = 0;
    if (!e.alive) fall = U.clamp((MEO.Engine.time - e.deathTime) / 0.55, 0, 1);
    const fallE = ease(fall);

    // attack
    const atkAge = now - a.atkT;
    const atkDur = rig.weapon === 'staff' || rig.weapon === 'bow' ? 0.4 : 0.5;
    const atk = atkAge >= 0 && atkAge < atkDur ? atkAge / atkDur : -1;
    const casting = !!e.cast && e.alive;

    // base pose
    let armRa = 0.18 - sinP * 0.55 * walk + idle * 3;
    let armLa = 0.18 + sinP * 0.55 * walk - idle * 3;
    let twist = 0;
    let lunge = 0;
    let lean = -0.06 * walk;
    const weapon = rig.weapon;
    if (MELEE1H[weapon]) armRa = 0.45 - sinP * 0.35 * walk;
    if (weapon === 'spear') armRa = 0.7 - sinP * 0.2 * walk;
    if (weapon === 'staff') armRa = 0.3 - sinP * 0.25 * walk;
    if (weapon === 'bow') armLa = 1.0 - sinP * 0.15 * walk;
    if (st.shield) armLa = 0.6 - sinP * 0.15 * walk;

    if (atk >= 0) {
      if (MELEE1H[weapon] || !weapon) {
        const w1 = 0.34;
        armRa = atk < w1 ? lerp(armRa, 2.5, ease(atk / w1)) : lerp(2.5, -0.3, ease((atk - w1) / (1 - w1)));
        twist = atk < w1 ? lerp(0, 0.3, atk / w1) : lerp(0.3, -0.45, ease((atk - w1) / (1 - w1)));
        lunge = Math.sin(atk * Math.PI) * 0.2;
        lean = -0.05 - Math.sin(atk * Math.PI) * 0.16;
      } else if (weapon === 'spear') {
        armRa = lerp(0.7, 1.55, Math.sin(Math.min(1, atk * 1.2) * Math.PI));
        lunge = Math.sin(atk * Math.PI) * 0.32;
      } else if (weapon === 'staff') {
        armRa = lerp(0.3, 1.9, Math.sin(atk * Math.PI));
        armLa = lerp(armLa, 1.4, Math.sin(atk * Math.PI));
        lean = -0.05 - Math.sin(atk * Math.PI) * 0.1;
      } else if (weapon === 'bow') {
        armRa = lerp(0.2, 1.3, Math.sin(Math.min(1, atk * 1.4) * Math.PI * 0.5)) * (1 - ease(Math.max(0, (atk - 0.5) * 2)));
        armLa = 1.5;
        lean = 0.04;
      }
    } else if (casting) {
      const k = 1 + Math.sin(t * 9) * 0.05;
      armRa = (weapon === 'staff' ? 1.75 : 1.55) * k;
      if (weapon !== 'bow' && !st.shield) armLa = 1.5 * k;
      lean = 0.06;
    }

    // flinch
    if (since < 0.2 && e.alive) lean -= (0.2 - since) * 0.9;

    // root matrix
    M4.identity(m0);
    M4.translate(m0, m0, x, y, z);
    M4.rotateY(m0, m0, -face);
    if (e.scale && e.scale !== 1) M4.scale(m0, m0, e.scale, e.scale, e.scale);
    if (lunge) M4.translate(m0, m0, lunge, 0, 0);
    if (fallE > 0) {
      M4.rotateZ(m0, m0, 1.52 * fallE);
      M4.translate(m0, m0, 0, -0.0, 0);
    }
    if (poly) M4.scale(m0, m0, 1, 1, 1);

    const bob = Math.abs(sinP) * 0.045 * walk + idle * 0.6;

    // legs (hip at y=0.9)
    for (let s = -1; s <= 1; s += 2) {
      M4.translate(m1, m0, 0, 0.9 + bob, 0.12 * s);
      M4.rotateZ(m1, m1, sinP * 0.78 * walk * -s * 1.0);
      draw(P.leg, m1, tint, NONE, 1);
    }

    // tunic skirt
    if (P.robe) {
      M4.translate(m1, m0, 0, 0.03 + bob * 0.5, 0);
      M4.rotateZ(m1, m1, Math.abs(sinP) * 0.04 * walk);
      draw(P.robe, m1, tint, NONE, 1);
    }

    // torso
    M4.translate(m2, m0, 0, 0.9 + bob, 0);
    M4.rotateZ(m2, m2, lean);
    M4.rotateY(m2, m2, twist);
    draw(P.torso, m2, tint, NONE, 1);

    // head
    M4.translate(m3, m2, 0, 0.6, 0);
    M4.rotateZ(m3, m3, -lean * 0.8 + (casting ? -0.08 : 0));
    M4.rotateY(m3, m3, -twist * 0.6 + Math.sin(t * 0.7 + e.id) * 0.05 * (1 - walk));
    draw(P.head, m3, tint, NONE, 1);

    // arms
    M4.translate(m3, m2, 0, 0.53, 0.31);
    M4.rotateZ(m3, m3, armRa);
    draw(P.armR, m3, tint, NONE, 1);
    if (P.weapon) {
      M4.translate(m4, m3, 0, -0.6, 0);
      draw(P.weapon, m4, tint, NONE, 1);
      if (P.weaponGlow) draw(P.weaponGlow, m4, tint, rig.glow, 1);
      e._handM = e._handM || new Float32Array(16);
      e._handM.set(m4);
    }
    M4.translate(m3, m2, 0, 0.53, -0.31);
    M4.rotateZ(m3, m3, armLa);
    draw(P.armL, m3, tint, NONE, 1);
    if (P.offhand) {
      M4.translate(m4, m3, 0, -0.6, 0);
      if (weapon === 'bow') M4.rotateZ(m4, m4, -armLa + 0.1);
      draw(P.offhand, m4, tint, NONE, 1);
    }
  };

  function drawDummy(e, rig, x, y, z, now, a, tint, draw) {
    const since = now - e.hitTime;
    const hit = since < 0.45 ? 1 - since / 0.45 : 0;
    const sway = Math.sin(since * 34) * 0.1 * hit;
    let fall = 0;
    if (!e.alive) fall = ease(U.clamp((MEO.Engine.time - e.deathTime) / 0.5, 0, 1));
    M4.identity(m0);
    M4.translate(m0, m0, x, y, z);
    M4.rotateY(m0, m0, -e.facing);
    M4.rotateZ(m0, m0, sway - fall * 1.45);
    M4.rotateX(m0, m0, sway * 0.5);
    draw(rig.parts.base, m0, tint, NONE, 1);
    const atkAge = now - a.atkT;
    let spin = 0;
    if (rig.puncher && atkAge >= 0 && atkAge < 0.5) spin = ease(atkAge / 0.5) * Math.PI * 2;
    M4.rotateY(m1, m0, spin);
    draw(rig.parts.arms, m1, tint, NONE, 1);
  }

  /** Position of the weapon hand in world space (for effects): returns [x,y,z]. */
  Models.handPos = function (e, out) {
    const m = e._handM;
    if (!m) return null;
    M4.point(m, 0.2, 0, 0, out);
    return out;
  };

  /** Mark that the creature attacked just now (starts the attack animation). */
  Models.triggerAttack = function (e) {
    const a = (e._anim = e._anim || { phase: 0, walk: 0, last: performance.now() / 1000, atkT: -10, face: e.facing });
    a.atkT = performance.now() / 1000;
  };

  MEO.Events.on('fx', function (d) {
    if (d.src && (d.kind === 'slash' || d.kind === 'bolt')) Models.triggerAttack(d.src);
  });
  MEO.Events.on('ability:used', function (d) {
    if (d.entity && d.entity.type === 'player') {
      const def = d.def;
      const hasDmg = def && def.effects && def.effects.some(function (f) { return f.type === 'damage'; });
      if (hasDmg || (def && def.target === 'enemy')) Models.triggerAttack(d.entity);
    }
  });
})();
