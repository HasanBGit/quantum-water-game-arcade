// Six helpers who walk the plant. Go close to one: it stops, faces you, waves, and a speech bubble
// gives a clue. Clues come from the model's own numbers (prices, restart cost), so they stay right
// if the tariff changes. Bubbles are plain HTML placed over the canvas, like the site tags.
import * as THREE from "three";
import { buildPerson, NPC_LOOKS } from "./characters.js";
import { joinWithAnd, DEFAULT_LIST } from "./listText.js";

export const TALK_RANGE = 3.4;
const SPEED = 1.0;
const SAY_EVERY = 5.5; // seconds before the bubble moves on to the next clue while you stay close

// Each helper patrols a short stretch of the walkway in front of the pump hall.
const ROUTES = {
  maryam: [[-23, 7.6], [-17.5, 5.0]],
  noura: [[-14, 4.6], [-8.5, 8.0]],
  layla: [[-6.5, 8.0], [-1, 4.6]],
  faisal: [[1, 4.6], [6, 8.0]],
  omar: [[7.5, 8.2], [11.5, 4.6]],
  james: [[13.6, 4.2], [13.6, 8.4]],
};

const v = new THREE.Vector3();

/** Numbers the clue text can use, taken from the model. */
function facts(model, slots, L) {
  const idx = model.prices.map((_, i) => i);
  const byPrice = idx.slice().sort((a, b) => model.prices[a] - model.prices[b] || a - b);
  const cheap = byPrice.slice(0, 3).map((i) => i + 1).sort((a, b) => a - b);
  const top = byPrice[byPrice.length - 1];
  return {
    cheap: joinWithAnd(cheap, L),
    priciest: top + 1,
    pmax: model.prices[top],
    pmin: model.prices[byPrice[0]],
    cheapest: byPrice[0] + 1,
    restart: model.restart ?? 5,
    on: slots.reduce((a, b) => a + (b ? 1 : 0), 0),
  };
}
const fill = (s, vals) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vals ? vals[k] : `{${k}}`));

export function createNpcs({ scene, stage, canvas, camera, text, model, blocked, reduceMotion, list = DEFAULT_LIST }) {
  const layer = document.createElement("div");
  layer.id = "npc-layer";
  layer.setAttribute("aria-hidden", "true"); // the same clues are read out through the live status line
  canvas.after(layer);

  const npcs = text.people.map((p) => {
    const group = buildPerson(NPC_LOOKS[p.id]);
    const route = ROUTES[p.id];
    group.position.set(route[0][0], 0, route[0][1]);
    scene.add(group);

    const el = document.createElement("div");
    el.className = "npc-tag";
    el.style.setProperty("--who", p.color);
    const chip = document.createElement("div");
    chip.className = "npc-name";
    chip.textContent = p.name;
    const say = document.createElement("div");
    say.className = "npc-say";
    const role = document.createElement("strong");
    role.textContent = `${p.name} · ${p.role}`;
    const line = document.createElement("span");
    say.append(role, line);
    el.append(chip, say);
    layer.append(el);

    return { p, group, route, leg: 1, el, line, near: false, clue: -1, sayClock: 0, wave: 0, walkPhase: 0, spoke: 0 };
  });

  let announce = () => {};
  let active = null;

  function step(n, dt, player, canTalk, vals) {
    const pos = n.group.position;
    const dist = Math.hypot(player.x - pos.x, player.z - pos.z);
    const wasNear = n.near;
    n.near = canTalk && dist < TALK_RANGE;

    // keep the numbers in the line live (slots on, bill) even when the clue itself has not changed
    const now = n.clue < 0 ? "" : fill(n.p.lines[n.clue], vals); // clue is -1 until the player first visits
    if (n.line.textContent !== now) n.line.textContent = now;

    if (n.near) {
      // a new visit moves on to the next clue
      if (!wasNear) {
        n.clue = (n.clue + 1) % n.p.lines.length;
        n.sayClock = 0;
        n.spoke++;
        n.line.textContent = fill(n.p.lines[n.clue], vals);
      }
      n.sayClock += dt;
      if (n.sayClock > SAY_EVERY) {
        n.sayClock = 0;
        n.clue = (n.clue + 1) % n.p.lines.length;
        n.line.textContent = fill(n.p.lines[n.clue], vals);
      }
      n.wave += dt;
      n.walkPhase = 0;
      const want = Math.atan2(player.x - pos.x, player.z - pos.z);
      let d = want - n.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.group.rotation.y += d * Math.min(1, dt * 8);
      n.group.userData.walk(0, 0);
      n.group.userData.wave(reduceMotion ? 0 : n.wave);
      return dist;
    }

    n.wave = 0;
    n.group.userData.wave(0);
    // keep the line current while the bubble is hidden, so it never shows stale numbers
    if (!canTalk) {
      n.group.userData.walk(0, 0);
      return dist;
    }
    const target = n.route[n.leg];
    const dx = target[0] - pos.x;
    const dz = target[1] - pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) {
      n.leg = 1 - n.leg;
    } else {
      const nx = pos.x + (dx / len) * SPEED * dt;
      const nz = pos.z + (dz / len) * SPEED * dt;
      if (blocked(nx, nz)) n.leg = 1 - n.leg; // something is in the way: head back
      else pos.set(nx, 0, nz);
      let d = Math.atan2(dx, dz) - n.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.group.rotation.y += d * Math.min(1, dt * 6);
      n.walkPhase += dt * 6;
    }
    n.group.userData.walk(n.walkPhase, 1);
    return dist;
  }

  return {
    /** Call once per frame. `player` is { x, z }. `canTalk` is false on the intro, simulate and result screens. */
    update(dt, player, canTalk, slots, quiet = false) {
      const vals = facts(model, slots, list);
      let best = null;
      let bestDist = Infinity;
      for (const n of npcs) {
        const d = step(n, dt, player, canTalk, vals);
        if (n.near && d < bestDist) {
          best = n;
          bestDist = d;
        }
      }
      if (best !== active) {
        active = best;
        if (active) announce(`${active.p.name}, ${active.p.role}: ${active.line.textContent}`);
      }
      camera.updateMatrixWorld();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      layer.hidden = !canTalk || quiet;
      for (const n of npcs) {
        const pos = n.group.position;
        v.set(pos.x, 2.15, pos.z).project(camera);
        const visible = canTalk && !quiet && v.z < 1 && v.z > -1;
        n.el.style.display = visible ? "" : "none";
        if (!visible) continue;
        n.el.style.transform = `translate(-50%, -100%) translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
        const talking = n === active;
        n.el.classList.toggle("talking", talking);
        n.el.style.zIndex = talking ? 5 : 0;
      }
    },
    /** Hook for the screen-reader status line. */
    onSay(fn) {
      announce = fn;
    },
    /** The helper the player is standing next to, if any. */
    nearest(player) {
      let best = null;
      let bestDist = TALK_RANGE;
      for (const n of npcs) {
        const d = Math.hypot(player.x - n.group.position.x, player.z - n.group.position.z);
        if (d < bestDist) {
          best = n;
          bestDist = d;
        }
      }
      return best ? { id: best.p.id, name: best.p.name, role: best.p.role, color: best.p.color, position: best.group.position } : null;
    },
    /** The helper whose body contains this 3D object, if any (for clicks and taps). */
    byObject(obj) {
      for (let o = obj; o; o = o.parent) {
        const n = npcs.find((x) => x.group === o);
        if (n) return { id: n.p.id, name: n.p.name, role: n.p.role, color: n.p.color, position: n.group.position };
      }
      return null;
    },
    npcs,
    debug: () => ({
      active: active ? active.p.id : null,
      people: npcs.map((n) => ({ id: n.p.id, x: +n.group.position.x.toFixed(2), z: +n.group.position.z.toFixed(2), near: n.near, line: n.near ? n.line.textContent : "" })),
    }),
  };
}
