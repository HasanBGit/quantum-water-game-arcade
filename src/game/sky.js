// A cartoon sky that matches the arcade look: a three-colour gradient dome, a flat sun with a soft
// halo, and puffy white clouds that drift. It also lights the scene: the dome is baked once into the
// environment map, so water and paint pick up its colours instead of a photo of a beach.
import * as THREE from "three";

const RADIUS = 450;

function cloudTexture(seed) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  // a flat-bottomed cloud from overlapping circles, with a soft blue-grey underside
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const puffs = [];
  for (let i = 0; i < 6; i++) puffs.push([40 + i * 33 + rnd() * 10, 78 - Math.sin((i / 5) * Math.PI) * (22 + rnd() * 14), 24 + Math.sin((i / 5) * Math.PI) * 14 + rnd() * 6]);
  g.fillStyle = "#cfe3ff";
  for (const [x, y, rad] of puffs) {
    g.beginPath();
    g.arc(x, y + 7, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#ffffff";
  for (const [x, y, rad] of puffs) {
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "destination-out";
  g.fillRect(0, 100, 256, 40); // flat bottom
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** `sunDir` is the direction towards the sun. Call update(dt, camera) every frame. */
export function createSky(renderer, scene, sunDir, { reduceMotion = false } = {}) {
  const dir = sunDir.clone().normalize();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color("#2f6dff") },
      mid: { value: new THREE.Color("#58bfff") },
      horizon: { value: new THREE.Color("#b4ecff") },
      below: { value: new THREE.Color("#f3e7c6") },
      sun: { value: dir },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 below; uniform vec3 sun;
      varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.18, 0.85, h));
        c = mix(c, below, smoothstep(0.0, -0.06, h));
        float d = dot(normalize(vDir), normalize(sun));
        c += vec3(1.0, 0.85, 0.5) * 0.35 * smoothstep(0.93, 1.0, d);      // soft halo
        c = mix(c, vec3(1.0, 0.96, 0.7), smoothstep(0.9975, 0.9982, d));  // flat sun disc
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -2;
  scene.add(dome);

  // Light from the dome for water, paint and metal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const bake = new THREE.Scene();
  bake.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), material));
  scene.environment = pmrem.fromScene(bake, 0, 1, 1000).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  // Clouds: flat sprites on a ring, slowly turning.
  const clouds = new THREE.Group();
  clouds.renderOrder = -1;
  const textures = [cloudTexture(11), cloudTexture(23), cloudTexture(37)];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
    const elev = 0.07 + ((i * 7) % 5) * 0.07; // low enough to sit above the horizon in the play view
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i % 3], depthWrite: false, fog: false, transparent: true, opacity: 0.96 }));
    const rr = RADIUS * 0.85;
    sprite.position.set(Math.cos(a) * rr * Math.cos(elev), Math.sin(elev) * rr, Math.sin(a) * rr * Math.cos(elev));
    sprite.scale.set(110 + ((i * 13) % 5) * 18, 55 + ((i * 13) % 5) * 9, 1);
    sprite.renderOrder = -1;
    clouds.add(sprite);
  }
  scene.add(clouds);

  return {
    update(dt, camera) {
      dome.position.copy(camera.position);
      clouds.position.copy(camera.position);
      if (!reduceMotion) clouds.rotation.y += dt * 0.004;
    },
  };
}
