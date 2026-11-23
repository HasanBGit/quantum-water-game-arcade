// Quality tiers. Start from the device type, then step down if frames are slow and up if they hold
// close to 60 fps. If a step up is followed by a step down within 20 s, that tier is not tried again.
// The player can override with the Quality control. The numbers are starting points to tune on real devices.
export const TIERS = {
  high: { pixelRatio: 2, shadow: 2048, seaEvery: 2, trees: 1, shrubs: true, treeShadows: true },
  medium: { pixelRatio: 1.5, shadow: 1024, seaEvery: 3, trees: 1, shrubs: false, treeShadows: false },
  low: { pixelRatio: 1, shadow: 512, shadows: false, seaEvery: 6, trees: 0.5, shrubs: false, treeShadows: false },
};
const ORDER = ["high", "medium", "low"];
export const SLOW_MS = 19; // below about 52 fps: step down, so a tier that cannot hold close to 60 is not kept
export const FAST_MS = 18; // about 55 fps or better: try a step up

// Everyone starts on medium: a laptop that cannot hold 60 fps on high spends its first seconds janky before it steps
// down, while a strong one steps up to high after 15 s of fast frames.
export function startingTier() {
  return "medium";
}

export function createQuality({ start, apply }) {
  let tier = start;
  let mode = "auto";
  let frames = 0;
  let sum = 0;
  let sinceChange = 0;
  let total = 0;
  let lastUpAt = -Infinity;
  let bestIndex = 0; // the best tier automatic mode may use (0 is high)
  let skip = 20; // ignore frames right after a change

  const set = (name) => {
    tier = name;
    apply(tier);
    frames = 0;
    sum = 0;
    sinceChange = 0;
    skip = 20;
  };
  apply(tier);

  return {
    get tier() {
      return tier;
    },
    get mode() {
      return mode;
    },
    choose(value) {
      if (value === "auto") {
        mode = "auto";
        frames = 0;
        sum = 0;
        skip = 30;
      } else {
        mode = "manual";
        set(value);
      }
    },
    /** Call every frame with the real frame time in milliseconds. */
    tick(ms) {
      if (mode !== "auto") return;
      total += ms;
      sinceChange += ms;
      if (skip > 0) {
        skip--;
        return;
      }
      frames++;
      sum += ms;
      // A slow window is judged after 45 frames so a weak machine drops a tier quickly; a fast one waits for 120.
      const avgNow = sum / frames;
      if (frames < 45 || (frames < 120 && avgNow <= SLOW_MS)) return;
      const avg = avgNow;
      frames = 0;
      sum = 0;
      const i = ORDER.indexOf(tier);
      if (avg > SLOW_MS && i < ORDER.length - 1 && sinceChange > 1500) {
        if (total - lastUpAt < 20000) bestIndex = i + 1; // the step up did not hold
        set(ORDER[i + 1]);
      } else if (avg < FAST_MS && i > bestIndex && sinceChange > 15000) {
        lastUpAt = total;
        set(ORDER[i - 1]);
      }
    },
  };
}
