// Poly Haven PBR textures (CC0), loaded once and shared.
import * as THREE from "three";

const loader = new THREE.TextureLoader();
const cache = new Map();

function load(url, srgb, repeat) {
  const key = `${url}|${repeat[0]}x${repeat[1]}`;
  if (cache.has(key)) return cache.get(key);
  const tex = loader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true; // never disposed when an asset is swapped out
  cache.set(key, tex);
  return tex;
}

/** A physically based material from a downloaded Poly Haven texture set. */
const materials = new Map();
export function pbr(name, repeat = [1, 1], extra = {}) {
  const key = `${name}|${repeat.join("x")}|${JSON.stringify(extra)}`;
  if (!materials.has(key)) materials.set(key, makePbr(name, repeat, extra));
  return materials.get(key);
}

function makePbr(name, repeat, extra) {
  const base = `${import.meta.env.BASE_URL}assets/polyhaven/textures/${name}`;
  const m = new THREE.MeshStandardMaterial({
    map: load(`${base}/diff.jpg`, true, repeat),
    roughnessMap: load(`${base}/rough.jpg`, false, repeat),
    normalMap: load(`${base}/nor.jpg`, false, repeat),
    roughness: 1,
    ...extra,
  });
  m.userData.texture = name;
  return m;
}
