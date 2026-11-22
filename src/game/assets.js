// Loads downloaded models and skies listed in public/assets/manifest.json.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export function createAssets(manager) {
  const gltf = new GLTFLoader(manager);
  const hdr = new HDRLoader(manager);
  const models = new Map();
  let manifest = null;

  async function entry(type, id) {
    if (!manifest) manifest = await (await fetch(`${import.meta.env.BASE_URL}assets/manifest.json`)).json();
    const e = manifest.find((m) => m.type === type && m.id === id);
    if (!e) throw new Error(`No ${type} asset "${id}" in the manifest`);
    return e;
  }

  /** A loaded model. Returns a fresh clone each time; clones share geometry and materials. */
  async function model(id) {
    if (!models.has(id)) {
      const e = await entry("models", id);
      const g = await gltf.loadAsync(`${import.meta.env.BASE_URL}assets/${e.folder}/${e.main}`);
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      models.set(id, g.scene);
    }
    return models.get(id).clone(true);
  }

  async function sky(id) {
    const e = await entry("hdris", id);
    const tex = await hdr.loadAsync(`${import.meta.env.BASE_URL}assets/${e.folder}/${e.main}`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  return { model, sky };
}
