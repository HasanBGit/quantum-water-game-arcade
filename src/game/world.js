// The plant site, laid out in zones along the water path:
//   intake (west, with the jetty) -> pump hall (five bays) -> membrane racks (behind the bays)
//   -> tank yard (east) -> control room (south-east, the place to talk to people).
import * as THREE from "three";
import { buildScenery, sandMaterial, tintSea } from "./scenery.js";
import { SLOT_COLORS } from "./palette.js";
import { buildPumpSkid, buildMembraneRack, buildTank, buildTerminal, buildSea, mergeStatic } from "./builders.js";
import { buildPipes, buildLampPost, buildWaterTower, buildSign, buildControlRoom, CONTROL_ROOM, buildFence, buildJetty, buildBollards, buildMarkings } from "./site.js";

export const BAY_X = [-12, -6, 0, 6, 12];
export const BOUNDS = { minX: -25.5, maxX: 27.5, minZ: -9.5, maxZ: 10.3 };
export const SPAWN = { x: -20, z: 6.5 };
export const CENTER = new THREE.Vector3(1, 1, -2);
// Where to stand to be "in" each zone. The checks walk the operator to these spots.
export const ZONES = [
  { id: "intake", entry: { x: -21, z: 4.5 } },
  { id: "pump_hall", entry: { x: -9, z: 5 } },
  { id: "membranes", entry: { x: -15.2, z: -6 } },
  { id: "tank_yard", entry: { x: 16, z: -4.5 } },
  { id: "control_room", entry: { x: 17.5, z: 9.4 } },
];

export const PAD_TOP = 0.1;
const FEED = 0x3a8f6a;
const PERMEATE = 0x3b8fc4;

// Floor like a 2D game board: two blues in a checker, one tile per two metres. Each tile has a
// light top-left edge and a darker bottom-right edge so it reads as a raised candy tile.
function tileMaterial() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const tile = (x, y, base, light, dark) => {
    g.fillStyle = base;
    g.fillRect(x, y, 128, 128);
    g.fillStyle = light; // top and left bevel
    g.fillRect(x, y, 128, 6);
    g.fillRect(x, y, 6, 128);
    g.fillStyle = dark; // bottom and right bevel
    g.fillRect(x, y + 122, 128, 6);
    g.fillRect(x + 122, y, 6, 128);
    g.fillStyle = "rgba(255,255,255,.10)"; // a soft shine in the corner
    g.beginPath();
    g.ellipse(x + 38, y + 34, 26, 12, -0.5, 0, Math.PI * 2);
    g.fill();
  };
  tile(0, 0, "#6c9cf2", "#9dc0ff", "#4f7fd6");
  tile(128, 0, "#5a8be6", "#8bb2fa", "#3f70c8");
  tile(0, 128, "#5a8be6", "#8bb2fa", "#3f70c8");
  tile(128, 128, "#6c9cf2", "#9dc0ff", "#4f7fd6");
  g.strokeStyle = "rgba(27,27,75,.35)";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.moveTo(0, 128);
  g.lineTo(256, 128);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 6);
  tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
}

// A lighter guide path along the walkway in front of the pump hall, with chevrons pointing east,
// the direction of the water path (intake to tanks).
function pathTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(225,240,255,.5)";
  g.beginPath();
  g.roundRect(4, 4, 1016, 120, 40);
  g.fill();
  g.strokeStyle = "rgba(27,27,75,.28)";
  g.lineWidth = 4;
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,.7)";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let x = 90; x < 960; x += 90) {
    g.beginPath();
    g.moveTo(x, 40);
    g.lineTo(x + 26, 64);
    g.lineTo(x, 88);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Candy kerb round the plot: white and navy blocks.
function kerbMaterial(repeatX) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#3a4bb8";
  g.fillRect(32, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, 1);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
}

function aabbOf(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  return { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hw: (b.max.x - b.min.x) / 2, hd: (b.max.z - b.min.z) / 2 };
}

export async function buildWorld(scene, assets, text) {
  const colliders = [];
  const solid = (c) => colliders.push({ x: c.x, z: c.z, hw: c.hw, hd: c.hd });
  const post = (x, z, r = 0.15) => solid({ x, z, hw: r, hd: r });
  const add = (obj) => {
    scene.add(obj);
    return obj;
  };
  // Everything that never moves goes in here and is merged once, one mesh per material.
  const staticRoot = new THREE.Group();
  staticRoot.name = "site";
  const stat = (obj) => {
    staticRoot.add(obj);
    return obj;
  };

  // ---- Ground: asphalt yard, sand, sloping shore, sea
  const apron = new THREE.Mesh(new THREE.BoxGeometry(56, 0.3, 23.5), tileMaterial());
  apron.position.set(1, -0.15, -0.5);
  apron.receiveShadow = true;
  add(apron);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 5.6),
    new THREE.MeshBasicMaterial({ map: pathTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(1, 0.015, 6.4);
  add(path);

  // Kerb along all four edges of the apron (looks only; the fence and bounds already stop the player).
  const kerbX = kerbMaterial(28);
  const kerbZ = kerbMaterial(12);
  [[56, 0.5, 1, 11.0, kerbX], [56, 0.5, 1, -12.0, kerbX], [0.5, 23.5, 28.75, -0.5, kerbZ], [0.5, 23.5, -26.75, -0.5, kerbZ]].forEach(([w, d, x, z, m]) => {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), m);
    kerb.position.set(x, 0.06, z);
    kerb.receiveShadow = true;
    add(kerb);
  });

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(500, 140), sandMaterial(70, 20));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.12, 45);
  sand.receiveShadow = true;
  add(sand);

  const shoreGeo = new THREE.PlaneGeometry(500, 30, 1, 1);
  shoreGeo.rotateX(-Math.PI / 2);
  shoreGeo.translate(0, 0, -26);
  const sp = shoreGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setY(i, -0.12 - (-11 - sp.getZ(i)) * 0.055);
  shoreGeo.computeVertexNormals();
  const shore = new THREE.Mesh(shoreGeo, sandMaterial(70, 6));
  shore.receiveShadow = true;
  add(shore);

  const sea = buildSea();
  sea.object.position.set(0, -0.55, -60);
  tintSea(sea.object, -60); // turquoise at the shore, deep blue far out (the arcade look, not a photo sea)
  add(sea.object);

  // ---- Pump hall: pads, skids, control posts, bollards
  const padMats = SLOT_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
  const skid = buildPumpSkid();
  const terminal = buildTerminal();
  const pads = new THREE.Group();
  const posts = new THREE.Group();
  const terminals = [];
  BAY_X.forEach((x, i) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 5), padMats[i]);
    pad.position.set(x, 0.05, -0.5);
    pads.add(pad);
    solid({ x, z: -0.5, hw: 1.4, hd: 0.55 });
    const t = terminal.clone(true);
    t.position.set(x + 1.8, PAD_TOP, 1.4);
    t.name = `terminal_${i + 1}`;
    posts.add(t);
    solid({ x: x + 1.8, z: 1.4, hw: 0.35, hd: 0.25 });
    terminals.push({ slot: i + 1, x: x + 1.8, z: 1.4, object: t, screen: t.getObjectByName("screen"), lamp: t.getObjectByName("lamp") });
  });
  stat(mergeStatic(pads)).name = "pads";
  stat(mergeStatic(posts, ["screen", "lamp"])).name = "terminals";
  stat(buildBollards(BAY_X.map((x) => [x - 2.3, 2.5]))).name = "bollards";
  BAY_X.forEach((x) => post(x - 2.3, 2.5, 0.2));

  // ---- Membrane racks, tanks, tower
  const rack = buildMembraneRack();
  const racks = new THREE.Group();
  BAY_X.forEach((x) => {
    const r = rack.clone(true);
    r.position.set(x, 0, -6);
    racks.add(r);
    solid({ x, z: -6, hw: 1.95, hd: 0.7 });
  });
  stat(mergeStatic(racks)).name = "membrane_racks";

  const tank = buildTank({ inlet: -1 });
  const tanks = new THREE.Group();
  for (const z of [-1, -8]) {
    const t = tank.clone(true);
    t.position.set(21, 0, z);
    tanks.add(t);
    solid({ x: 21, z, hw: 2.5, hd: 2.5 });
  }
  stat(mergeStatic(tanks)).name = "tanks";

  const tower = buildWaterTower();
  tower.position.set(-20.5, 0, -5.5);
  stat(tower).name = "feed_tower";
  solid({ x: -20.5, z: -5.5, hw: 1.9, hd: 1.9 });

  // ---- Pipes: seawater (green) from the jetty to the pumps, product water (blue) to the tanks
  const specs = [
    { points: [[-23, 0.75, -23], [-23, 0.75, -9.3], [-23, 3.2, -9.3], [16, 3.2, -9.3]], radius: 0.16, color: FEED, supportEvery: 8 },
    ...BAY_X.map((x) => ({ points: [[x + 3, 3.2, -9.3], [x + 3, 3.2, -0.5], [x + 3, 0.57, -0.5], [x + 1.37, 0.57, -0.5]], radius: 0.09, color: FEED })),
    { points: [[-10.18, 1.95, -6], [17.6, 1.95, -6]], radius: 0.08, color: PERMEATE },
    ...BAY_X.map((x) => ({ points: [[x + 1.82, 1.75, -6], [x + 1.82, 1.95, -6]], radius: 0.055, color: PERMEATE })),
    { points: [[17.6, 1.95, -8], [17.6, 1.95, -1]], radius: 0.08, color: PERMEATE },
    { points: [[17.6, 1.95, -1], [17.6, 0.6, -1], [18.25, 0.6, -1]], radius: 0.08, color: PERMEATE },
    { points: [[17.6, 1.95, -8], [17.6, 0.6, -8], [18.25, 0.6, -8]], radius: 0.08, color: PERMEATE },
  ];
  const pipes = buildPipes(specs);
  stat(pipes.object).name = "pipes";
  pipes.supports.forEach(([x, z]) => post(x, z, 0.2));
  BAY_X.forEach((x) => post(x + 3, -0.5, 0.12));
  post(17.6, -1, 0.12);
  post(17.6, -8, 0.12);

  // ---- Control room, signs, lamps, jetty, fence, floor markings
  const room = buildControlRoom(text.signs.control_room);
  const ROOM = { x: 20, z: 5.5 };
  const cutaway = room.userData.cutaway; // roof and front wall; hidden while the operator is inside
  room.position.set(ROOM.x, 0, ROOM.z);
  cutaway.position.set(ROOM.x, 0, ROOM.z);
  stat(room);
  add(cutaway);
  for (const [x, z, hw, hd] of CONTROL_ROOM.walls) solid({ x: ROOM.x + x, z: ROOM.z + z, hw, hd });
  // True while (x, z) is under the control room's roof, door plane included.
  const inControlRoom = (x, z) => Math.abs(x - ROOM.x) < CONTROL_ROOM.W / 2 - CONTROL_ROOM.T && z - ROOM.z < CONTROL_ROOM.fz + 0.1 && z - ROOM.z > -CONTROL_ROOM.D / 2;

  const signSpots = [
    ["intake", -20.5, 2.6],
    ["pump_hall", -16.2, 3.0],
    ["membranes", -16.2, -3.8],
    ["tank_yard", 15.9, -9.0],
  ];
  for (const [id, x, z] of signSpots) {
    const sign = buildSign(text.signs[id]);
    sign.position.set(x, 0, z);
    stat(sign);
    solid({ x, z, hw: 1.1, hd: 0.15 });
  }

  const lamp = buildLampPost();
  const lamps = new THREE.Group();
  for (const x of [-20, -8, 4, 14]) {
    const l = lamp.clone(true);
    l.position.set(x, 0, -10.3);
    lamps.add(l);
  }
  stat(mergeStatic(lamps)).name = "lamp_posts";

  const jetty = buildJetty(13);
  jetty.position.set(-23, 0, -11.9);
  stat(jetty).name = "jetty";

  stat(buildFence([[-26.5, 11], [-26.5, -11.7], [28.5, -11.7], [28.5, 11]])).name = "fence";

  const lines = [[-5.2, 3.3, 39.5, 0.12, "yellow"]];
  BAY_X.forEach((x) => lines.push([x, 2.2, 5, 0.1, "yellow"]));
  stat(buildMarkings(lines)).name = "markings";

  // ---- Downloaded props (Poly Haven, CC0), merged into a few draw calls
  const [generator, powerBox, utility1, utility2, barrel, ibc, manhole, barrier] = await Promise.all([
    assets.model("portable_generator"),
    assets.model("power_box_01"),
    assets.model("utility_box_01"),
    assets.model("utility_box_02"),
    assets.model("Barrel_01"),
    assets.model("industrial_pastic_container"),
    assets.model("water_manhole_cover"),
    assets.model("concrete_road_barrier_02"),
  ]);
  const props = new THREE.Group();
  const place = (model, x, z, ry = 0, collide = true) => {
    const m = model.clone(true);
    m.rotation.y = ry;
    m.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m);
    m.position.set(x, -b.min.y, z);
    props.add(m);
    if (collide) solid(aabbOf(m));
    return m;
  };
  place(generator, -24.6, -2.6, Math.PI / 2);
  place(powerBox, -25, -8.6, Math.PI / 2);
  place(utility1, -25.1, 0.6, Math.PI / 2);
  place(utility2, -21.2, -9.1);
  [[-24.6, -6.4], [-23.9, -6.9], [-24.8, -7.3], [-23.8, -5.9], [-24.4, -5.4]].forEach(([x, z]) => place(barrel, x, z));
  [[-17.8, -8.7], [-16.4, -8.7], [-15, -8.7]].forEach(([x, z]) => place(ibc, x, z));
  [[-9, 5.8], [3, 6.4], [12, 6.0]].forEach(([x, z]) => place(manhole, x, z, 0, false));
  place(barrier, 26.9, 2.2, Math.PI / 2);
  place(barrier, 26.9, 4.4, Math.PI / 2);
  stat(mergeStatic(props)).name = "props";
  add(mergeStatic(staticRoot, ["screen", "lamp"]));

  // ---- Everything outside the fence: palms, dunes, rocks, foam, boats, gulls, far hills (see scenery.js)
  const scenery = buildScenery(scene);

  return {
    colliders,
    terminals,
    sea: sea.object,
    pumpModel: skid,
    pumpBays: BAY_X.map((x) => ({ x, y: PAD_TOP, z: -0.5 })),
    zones: ZONES,
    inControlRoom,
    setControlRoomOpen: (open) => {
      cutaway.visible = !open;
    },
    trees: scenery.trees,
    shrubs: scenery.shrubs,
    update(t) {
      sea.update(t);
      scenery.update(t);
    },
    setSeaEvery: sea.setEvery,
  };
}
