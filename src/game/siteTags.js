// Floating labels over the five bays on the Result screen: what each bay is doing and whether it
// helped or hurt the bill. Plain HTML placed over the canvas, moved every frame to follow the bays.
import * as THREE from "three";

const v = new THREE.Vector3();

export function createSiteTags({ stage, canvas, camera, bays, text }) {
  const layer = document.createElement("div");
  layer.id = "site-tags";
  layer.hidden = true;
  layer.setAttribute("aria-hidden", "true"); // the same facts are in the report text beside it
  const tags = bays.map((_, i) => {
    const el = document.createElement("div");
    el.className = "site-tag";
    el.style.setProperty("--slot", `var(--slot${i + 1}, var(--water))`);
    layer.append(el);
    return el;
  });
  stage.append(layer);

  return {
    show(rows) {
      rows.forEach((r, i) => {
        const el = tags[i];
        el.dataset.tag = r.tag;
        el.classList.toggle("cold", r.cold);
        el.replaceChildren();
        const head = document.createElement("strong");
        head.textContent = `${text.slot} ${r.slot}: ${r.on ? text.running : text.idle}`;
        const body = document.createElement("span");
        body.textContent = text.tag[r.tag];
        el.append(head, body);
        if (r.cold) {
          const cold = document.createElement("em");
          cold.textContent = text.cold;
          el.append(cold);
        }
      });
      layer.hidden = false;
    },
    hide() {
      layer.hidden = true;
    },
    /** Call every frame while shown. */
    update() {
      if (layer.hidden) return;
      camera.updateMatrixWorld();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      bays.forEach((b, i) => {
        v.set(b.x, b.y + 3.2, b.z).project(camera);
        const visible = v.z < 1 && v.z > -1;
        tags[i].style.display = visible ? "" : "none";
        tags[i].style.transform = `translate(-50%, -100%) translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
      });
    },
  };
}
