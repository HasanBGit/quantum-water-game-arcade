// Quality tiers. Start from the device type, then step down if frames are slow and up if they hold
// close to 60 fps. If a step up is followed by a step down within 20 s, that tier is not tried again.
// The player can override with the Quality control. The numbers are starting points to tune on real devices.
export const TIERS = {
  high: { pixelRatio: 2, shadow: 2048, seaEvery: 2, trees: 1, shrubs: true, treeShadows: true },
  medium: { pixelRatio: 1.5, shadow: 1024, seaEvery: 3, trees: 1, shrubs: false, treeShadows: false },
  low: { pixelRatio: 1, shadow: 512, shadows: false, seaEvery: 6, trees: 0.5, shrubs: false, treeShadows: false },
};
const ORDER = ["high", "medium", "low"];
export const SLOW_MS = 33; // below about 30 fps: step down
export const FAST_MS = 18; // about 55 fps or better: try a step up

export function startingTier(coarse) {
  return coarse ? "medium" : "high";
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
  let skip = 30; // ignore frames right after a change

  const set = (name) => {
    tier = name;
    apply(tier);
    frames = 0;
    sum = 0;
    sinceChange = 0;
    skip = 30;
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
      if (frames < 120) return;
      const avg = sum / frames;
      frames = 0;
      sum = 0;
      const i = ORDER.indexOf(tier);
      if (avg > SLOW_MS && i < ORDER.length - 1 && sinceChange > 4000) {
        if (total - lastUpAt < 20000) bestIndex = i + 1; // the step up did not hold
        set(ORDER[i + 1]);
      } else if (avg < FAST_MS && i > bestIndex && sinceChange > 15000) {
        lastUpAt = total;
        set(ORDER[i - 1]);
      }
    },
  };
}
