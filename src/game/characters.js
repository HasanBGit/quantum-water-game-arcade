// Chunky, colourful game characters built from simple shapes (no model files).
// buildPerson(spec) returns a group that faces +Z, about 1.75 m tall, with the same hooks as the
// operator: group.userData.walk(phase, amount) swings the limbs, group.userData.press(amount) reaches an arm.
import * as THREE from "three";

const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

// Skin tones.
export const SKIN = { saudi: 0xc68e5b, black: 0x6b4430, white: 0xf1c8a5, girlA: 0xd9a273, girlB: 0xb67a4d, girlC: 0xf0c4a0 };

/**
 * spec: {
 *   skin, outfit (thobe or abaya colour), trim (sleeve and hem accent), shoes,
 *   head: "ghutra" | "hijab" | "cap" | "bare",  headColor, headTrim (agal or hijab edge),
 *   vest (colour or null), hardHat (bool), beard (colour or null), glasses (bool),
 *   skirt (true for a long flowing outfit), height (scale, default 1)
 * }
 */
export function buildPerson(spec) {
  const s = { height: 1, beard: null, vest: null, hardHat: false, glasses: false, shoes: 0x2b2b2b, ...spec };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(s.skin, 0.65);
  const outfit = mat(s.outfit, 0.8);
  const trim = mat(s.trim ?? s.outfit, 0.8);
  const shoes = mat(s.shoes, 0.6);
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Everyone wears a long thobe or abaya, so there are no leg shapes to poke through the cloth:
  // only two shoes that step in and out under the hem.
  const foot = (x) => {
    const f = add(body, new THREE.BoxGeometry(0.15, 0.1, 0.28), shoes, x, 0.05, 0.06);
    f.userData.rest = 0.06;
    return f;
  };
  const footL = foot(-0.1);
  const footR = foot(0.1);

  // Torso and the long thobe or abaya (a cone skirt down to the ankles).
  add(body, new THREE.CapsuleGeometry(0.2, 0.34, 8, 16), outfit, 0, 1.2, 0).scale.set(1.05, 1, 0.78);
  const hem = add(body, new THREE.CylinderGeometry(0.2, 0.31, 0.82, 24, 1, true), outfit, 0, 0.5, 0);
  hem.material.side = THREE.DoubleSide;
  add(body, new THREE.TorusGeometry(0.305, 0.022, 8, 28), trim, 0, 0.1, 0).rotation.x = Math.PI / 2;
  if (s.vest) {
    add(body, new THREE.CapsuleGeometry(0.215, 0.26, 8, 16), mat(s.vest, 0.7), 0, 1.22, 0).scale.set(1.05, 0.9, 0.84);
    for (const y of [1.14, 1.3]) add(body, new THREE.TorusGeometry(0.222, 0.012, 6, 24), mat(0xe8eef2, 0.4), 0, y, 0).rotation.x = Math.PI / 2;
  }

  // Arms (sleeves in the outfit colour, hands in skin).
  const arm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.47, 0);
    add(pivot, new THREE.CapsuleGeometry(0.058, 0.4, 6, 12), outfit, 0, -0.27, 0);
    add(pivot, new THREE.SphereGeometry(0.06, 12, 10), skin, 0, -0.55, 0);
    body.add(pivot);
    return pivot;
  };
  const armL = arm(-0.27);
  const armR = arm(0.27);

  // Head: a big friendly sphere (game proportions), neck, face.
  const headY = 1.66;
  add(body, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), skin, 0, 1.56, 0);
  const head = add(body, new THREE.SphereGeometry(0.19, 28, 22), skin, 0, headY + 0.02, 0);
  head.scale.set(1, 1.0, 1);
  const eyeMat = mat(0x1b1b4b, 0.4);
  for (const x of [-0.075, 0.075]) {
    add(body, new THREE.SphereGeometry(0.028, 12, 10), eyeMat, x, headY + 0.05, 0.172);
  }
  add(body, new THREE.SphereGeometry(0.026, 10, 8), mat(0xc9604a, 0.6), 0, headY - 0.03, 0.18).scale.set(2.2, 0.55, 0.5); // mouth
  for (const x of [-0.115, 0.115]) add(body, new THREE.SphereGeometry(0.03, 10, 8), mat(0xff8aa0, 0.8), x, headY, 0.15).scale.set(1.2, 0.7, 0.4);
  if (s.glasses) {
    for (const x of [-0.075, 0.075]) add(body, new THREE.TorusGeometry(0.05, 0.009, 6, 16), mat(0x1b1b4b, 0.3), x, headY + 0.05, 0.178);
  }
  if (s.beard) {
    const beard = add(body, new THREE.SphereGeometry(0.192, 24, 14, 0, Math.PI * 2, Math.PI * 0.74, Math.PI * 0.26), mat(s.beard, 0.9), 0, headY + 0.02, 0.01);
    beard.scale.set(1.0, 1.0, 1.02);
    add(body, new THREE.BoxGeometry(0.1, 0.014, 0.02), mat(s.beard, 0.9), 0, headY - 0.01, 0.185); // moustache
  }

  // Head covering.
  if (s.head === "hijab") {
    const cloth = mat(s.headColor, 0.85);
    const wrap = add(body, new THREE.SphereGeometry(0.225, 28, 22), cloth, 0, headY + 0.03, -0.03);
    wrap.scale.set(1, 1.02, 1.0);
    // cut the face opening with a skin oval in front of the cloth
    add(body, new THREE.SphereGeometry(0.15, 24, 18), skin, 0, headY + 0.015, 0.1).scale.set(1, 1.1, 0.68);
    // cloth falling over the shoulders and chest
    const drape = add(body, new THREE.CylinderGeometry(0.2, 0.3, 0.36, 24, 1, true), cloth, 0, 1.44, -0.01);
    drape.material.side = THREE.DoubleSide;
    drape.scale.set(1, 1, 0.9);
    add(body, new THREE.TorusGeometry(0.15, 0.014, 8, 24), mat(s.headTrim ?? s.headColor, 0.7), 0, headY + 0.015, 0.165).scale.set(1, 1.1, 1);
  } else if (s.head === "ghutra") {
    const cloth = mat(s.headColor, 0.85);
    const cap = add(body, new THREE.SphereGeometry(0.215, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), cloth, 0, headY + 0.04, -0.015);
    cap.scale.set(1, 1.02, 1.04);
    // cloth hanging behind the head and over both shoulders
    for (const x of [-0.13, 0.13]) {
      const flap = add(body, new THREE.BoxGeometry(0.1, 0.3, 0.07), cloth, x * 1.4, 1.56, -0.09);
      flap.rotation.z = x > 0 ? -0.12 : 0.12;
    }
    add(body, new THREE.BoxGeometry(0.36, 0.3, 0.06), cloth, 0, 1.6, -0.15);
    add(body, new THREE.TorusGeometry(0.205, 0.018, 8, 28), mat(0x15151c, 0.5), 0, headY + 0.1, 0).rotation.x = Math.PI / 2; // agal
  } else if (s.head === "cap") {
    const cap = add(body, new THREE.SphereGeometry(0.2, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(s.headColor, 0.8), 0, headY + 0.04, 0);
    cap.scale.set(1, 1, 1.02);
  } else {
    add(body, new THREE.SphereGeometry(0.2, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), mat(s.headColor ?? 0x2a1c14, 0.9), 0, headY + 0.04, -0.01);
  }
  if (s.hardHat) {
    const hat = mat(0xffd23f, 0.35);
    const dome = add(body, new THREE.SphereGeometry(0.175, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, headY + 0.1, 0);
    dome.scale.set(1, 0.9, 1.05);
    add(body, new THREE.CylinderGeometry(0.19, 0.19, 0.014, 32), hat, 0, headY + 0.1, 0.01);
  }

  body.scale.set(1.1 * s.height, 0.93 * s.height, 1.1 * s.height);
  let pressing = 0;
  root.userData.walk = (phase, amount) => {
    const w = Math.sin(phase) * 0.7 * amount;
    const step = (f, a) => {
      f.position.z = f.userData.rest + Math.sin(a) * 0.15 * amount;
      f.position.y = 0.05 + Math.max(0, Math.cos(a)) * 0.05 * amount; // lift while swinging forward
    };
    step(footL, phase);
    step(footR, phase + Math.PI);
    armL.rotation.x = -w * 0.8;
    armR.rotation.x = pressing > 0 ? -pressing * 1.35 : w * 0.8;
    // a little bounce while walking
    body.position.y = Math.abs(Math.sin(phase)) * 0.03 * amount;
  };
  root.userData.press = (amount) => {
    pressing = amount;
  };
  // Wave: one arm up and swinging. 0 = off.
  root.userData.wave = (t) => {
    if (t > 0) armR.rotation.set(0, 0, 2.6 + Math.sin(t * 9) * 0.35);
    else armR.rotation.z = 0;
  };
  return root;
}

// The player: a regular Saudi man in a white thobe and a red-and-white shemagh, with the plant's
// yellow hard hat on top and a teal vest, so he reads as the operator at a glance.
export function buildPlayer() {
  return buildPerson({
    skin: SKIN.saudi,
    outfit: 0xfdfdfb,
    trim: 0xe3e6ea,
    head: "ghutra",
    headColor: 0xd8453c,
    vest: 0x19c3d6,
    hardHat: false,
    beard: 0x1d1612,
    shoes: 0x6b4a2b,
  });
}

// Six helpers. Colour and clothing differ so each reads clearly from the camera.
export const NPC_LOOKS = {
  maryam: { skin: SKIN.girlA, outfit: 0xff5d73, trim: 0xffffff, head: "hijab", headColor: 0xffb3c0, headTrim: 0xff5d73, shoes: 0xffffff, skirt: true },
  noura: { skin: SKIN.girlB, outfit: 0x8a5cff, trim: 0xffd23f, head: "hijab", headColor: 0xd8c8ff, headTrim: 0x8a5cff, shoes: 0xffd23f, skirt: true },
  layla: { skin: SKIN.girlC, outfit: 0x1f9e8f, trim: 0xffffff, head: "hijab", headColor: 0x55e07a, headTrim: 0x1f9e8f, shoes: 0xffffff, skirt: true, glasses: true },
  faisal: { skin: SKIN.saudi, outfit: 0xb9d8f2, trim: 0x8fb8dc, head: "ghutra", headColor: 0xffffff, beard: 0x2a1c14, shoes: 0x3a2a1a },
  omar: { skin: SKIN.black, outfit: 0xf4ead2, trim: 0xd9c9a0, head: "cap", headColor: 0xffffff, beard: 0x120d0a, shoes: 0x2b2b2b },
  james: { skin: SKIN.white, outfit: 0xe9e9ee, trim: 0xc7c9d1, head: "bare", headColor: 0xc58b3d, beard: 0xa8742c, shoes: 0x2b2b2b, glasses: true },
};
