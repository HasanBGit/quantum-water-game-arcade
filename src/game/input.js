// One input path for keyboard and on-screen arrows.
// Up is away from the camera, down is towards it, left and right are sideways.
const KEYS = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

export function createInput(onAction) {
  const held = { up: false, down: false, left: false, right: false };
  const reset = () => Object.keys(held).forEach((k) => (held[k] = false));

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYS[e.code];
    if (dir) {
      held[dir] = true;
      e.preventDefault();
    } else if ((e.code === "KeyE" || e.code === "Space") && !e.repeat) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (e.code === "Space" && (tag === "BUTTON" || tag === "SELECT" || tag === "SUMMARY")) return;
      e.preventDefault();
      onAction("use");
    } else if (e.code === "KeyO" && !e.repeat) onAction("overview");
    else if (e.code === "KeyM" && !e.repeat) onAction("sound");
  });
  window.addEventListener("keyup", (e) => {
    const dir = KEYS[e.code];
    if (dir) held[dir] = false;
  });
  window.addEventListener("blur", reset);

  for (const btn of document.querySelectorAll("[data-dir]")) {
    const dir = btn.dataset.dir;
    btn.addEventListener("pointerdown", (e) => {
      held[dir] = true;
      btn.setPointerCapture(e.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      btn.addEventListener(type, () => (held[dir] = false));
    }
  }

  return {
    axis: () => ({
      x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
      z: (held.down ? 1 : 0) - (held.up ? 1 : 0),
    }),
  };
}
