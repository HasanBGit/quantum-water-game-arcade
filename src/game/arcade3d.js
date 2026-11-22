// Game props in the 3D scene: a price coin above each control post, a glowing ring under each pump
// that is running, and a bouncing arrow over the post the operator can use.
import * as THREE from "three";
import { SLOT_COLORS, NAVY } from "./palette.js";

function coinTexture(price, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = NAVY;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.35)";
  g.beginPath();
  g.ellipse(48, 42, 22, 12, -0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.strokeStyle = NAVY;
  g.lineWidth = 8;
  g.lineJoin = "round";
  g.font = "900 64px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.strokeText(String(price), 64, 70);
  g.fillText(String(price), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArcade3d(scene, terminals, bays, model) {
  const coins = terminals.map((t, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTexture(model.prices[i], SLOT_COLORS[i]), depthWrite: false }));
    sprite.position.set(t.x, 2.3, t.z);
    sprite.scale.setScalar(0.95);
    sprite.renderOrder = 5;
    scene.add(sprite);
    return sprite;
  });

  const rings = bays.map((b, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: SLOT_COLORS[i], transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.45, 48), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(b.x, b.y + 0.04, b.z);
    scene.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 48),
      new THREE.MeshBasicMaterial({ color: SLOT_COLORS[i], transparent: true, opacity: 0, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(b.x, b.y + 0.035, b.z);
    scene.add(disc);
    return { ring, disc, on: false, level: 0 };
  });

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false }),
  );
  arrow.rotation.x = Math.PI;
  arrow.renderOrder = 6;
  arrow.visible = false;
  scene.add(arrow);

  let target = null;
  return {
    setOn(i, on) {
      rings[i].on = on;
      coins[i].scale.setScalar(on ? 1.25 : 0.95);
    },
    pointAt(t) {
      target = t;
    },
    update(dt, time, enabled) {
      coins.forEach((c, i) => (c.position.y = 2.3 + Math.sin(time * 2.4 + i * 1.3) * 0.12));
      rings.forEach((r, i) => {
        r.level += ((r.on ? 1 : 0) - r.level) * Math.min(1, dt * 8);
        const pulse = 0.55 + Math.sin(time * 4 + i) * 0.15;
        r.ring.material.opacity = r.level * pulse;
        r.disc.material.opacity = r.level * 0.22;
        r.ring.visible = r.disc.visible = r.level > 0.01;
      });
      arrow.visible = Boolean(enabled && target);
      if (arrow.visible) arrow.position.set(target.x, (target.y ?? 1.55) + Math.sin(time * 6) * 0.14, target.z);
    },
  };
}
