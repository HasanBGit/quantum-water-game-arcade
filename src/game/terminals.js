// Control posts: each gets its own screen (slot, on or off, price) and its own lamp (green on, red off).
import * as THREE from "three";

const ON = 0x39d96b;
const OFF = 0xd6452b;

function drawScreen(canvas, slot, on, price, labels) {
  const g = canvas.getContext("2d");
  g.fillStyle = "#0b1d24";
  g.fillRect(0, 0, 256, 128);
  g.textBaseline = "alphabetic";
  g.font = "bold 28px system-ui, sans-serif";
  g.fillStyle = "#bfe9f2";
  g.fillText(`${labels.slot} ${slot}`, 16, 36);
  g.font = "bold 38px system-ui, sans-serif";
  g.fillStyle = on ? "#39d96b" : "#e9a69a";
  g.fillText(on ? labels.on : labels.off, 16, 82);
  g.font = "bold 26px system-ui, sans-serif";
  g.fillStyle = "#f1b80a"; // yellow means price, everywhere in the game
  g.fillText(`${labels.price} ${price}`, 16, 114);
}

export function createTerminals(infos, model, labels) {
  const items = infos.map((info) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    info.screen.material = new THREE.MeshBasicMaterial({ map: texture });
    info.lamp.material = info.lamp.material.clone();
    return { info, canvas, texture };
  });

  function set(index, on) {
    const { info, canvas, texture } = items[index];
    drawScreen(canvas, info.slot, on, model.prices[index], labels);
    texture.needsUpdate = true;
    const color = on ? ON : OFF;
    info.lamp.material.color.setHex(color);
    info.lamp.material.emissive.setHex(color);
  }
  infos.forEach((_, i) => set(i, false));
  return { set };
}
