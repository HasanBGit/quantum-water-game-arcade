// Cheaper people. A person is about 23 small meshes, all casting shadows: that was two thirds of the
// draw calls. Here the parts that never move are merged into one mesh (each part keeps its colour in its
// vertices), each arm becomes one mesh, real shadows are replaced by a soft blob under the feet, and the
// parts that animate (feet, the arm pivots) are left alone.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

let blobMaterial = null;
let blobGeometry = null;
let peopleMaterial = null;

function blob() {
  if (!blobMaterial) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, "rgba(27,27,75,0.55)");
    grad.addColorStop(0.6, "rgba(27,27,75,0.28)");
    grad.addColorStop(1, "rgba(27,27,75,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    blobMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    blobGeometry = new THREE.CircleGeometry(0.62, 24);
    blobGeometry.rotateX(-Math.PI / 2);
  }
  const m = new THREE.Mesh(blobGeometry, blobMaterial);
  m.position.y = 0.03;
  m.renderOrder = 1;
  m.name = "blob_shadow";
  return m;
}

function colouredMaterial() {
  // Two-sided because a few parts (the hem, the head cloth) are open tubes.
  if (!peopleMaterial) peopleMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide });
  return peopleMaterial;
}

/** Merge `meshes` (children of `parent`) into one coloured mesh, baking each mesh's own transform and colour. */
function mergeInto(parent, meshes) {
  if (meshes.length < 2) return;
  const geos = [];
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrix);
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    const c = mesh.material.color;
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geos.push(geo.index ? geo.toNonIndexed() : geo);
    parent.remove(mesh);
    mesh.geometry.dispose();
  }
  const merged = new THREE.Mesh(mergeGeometries(geos, false), colouredMaterial());
  merged.name = "body_part";
  parent.add(merged);
  geos.forEach((g) => g.dispose());
}

/** Make a person cheap to draw. Safe to call once per person. */
export function cheapPeople(person) {
  const body = person.children[0];
  if (body && body.isGroup && !person.userData.cheap) {
    mergeInto(body, body.children.filter((c) => c.isMesh && c.userData.rest === undefined));
    for (const arm of body.children.filter((c) => c.isGroup)) mergeInto(arm, arm.children.filter((c) => c.isMesh));
  }
  person.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  if (!person.getObjectByName("blob_shadow")) person.add(blob());
  person.userData.cheap = true;
}
