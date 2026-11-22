// Which terminal the operator can use, and where to stand to use it.
export const USE_RANGE = 1.9;

/** The terminal closest to the operator, if within range. `terminals` are { slot, x, z }. */
export function nearestTerminal(pos, terminals, range = USE_RANGE) {
  let best = null;
  let bestDist = range;
  for (const t of terminals) {
    const d = Math.hypot(pos.x - t.x, pos.z - t.z);
    if (d <= bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

/** In front of a terminal, on the walkway side. */
export const standPoint = (t) => ({ x: t.x, z: t.z + 1.15 });

/** The terminal nearest to a clicked ground or machine point, if close enough. */
export function terminalAt(point, terminals, radius = 1.4) {
  return nearestTerminal(point, terminals, radius);
}
