// The five pump skids, drawn as instanced meshes: still one draw call per material, but each pump
// can shudder on its own. A cold start shakes a pump for about a quarter of a second.
import * as THREE from "three";

export function createPumps(scene, skid, bays, { reduceMotion = false } = {}) {
  const parts = [];
  for (const m of skid.children) {
    if (!m.isMesh) continue;
    const im = new THREE.InstancedMesh(m.geometry, m.material, bays.length);
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.name = "pump_skid";
    scene.add(im);
    parts.push(im);
  }
  const state = bays.map(() => ({ amp: 0, t: 0, on: false }));
  const m4 = new THREE.Matrix4();

  function write(time) {
    bays.forEach((b, i) => {
      const s = state[i];
      let ox = 0;
      let oy = 0;
      let oz = 0;
      if (s.amp > 0) {
        ox = Math.sin(s.t * 73) * s.amp;
        oy = Math.sin(s.t * 91 + 1) * s.amp * 0.6;
        oz = Math.sin(s.t * 57 + 2) * s.amp;
      }
      if (s.on && !reduceMotion) oy += Math.sin(time * 55 + i) * 0.0015; // a faint hum while running
      m4.makeTranslation(b.x + ox, b.y + oy, b.z + oz);
      for (const im of parts) im.setMatrixAt(i, m4);
    });
    for (const im of parts) im.instanceMatrix.needsUpdate = true;
  }
  write(0);

  return {
    shake(i) {
      state[i].amp = reduceMotion ? 0 : 0.035; // 3.5 cm, fading out in about 0.25 s
      state[i].t = 0;
    },
    setRunning(i, on) {
      state[i].on = on;
    },
    update(dt, time) {
      let busy = false;
      for (const s of state) {
        if (s.amp > 0) {
          s.t += dt;
          s.amp *= Math.exp(-dt * 8);
          if (s.amp < 0.0004) s.amp = 0;
          busy = true;
        }
        if (s.on) busy = true;
      }
      if (busy) write(time);
    },
    /** Which pumps are shaking right now (for the automated checks). */
    shaking: () => state.map((s) => s.amp > 0),
  };
}
