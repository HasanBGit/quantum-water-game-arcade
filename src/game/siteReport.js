// The site report: what each bay of the plant is doing in the player's plan, and why that plan
// won or lost against the cheapest one. Plain code, no browser, so it can be tested on its own.
//
// Per bay (slot), compared with the cheapest plan:
//   match   running, and the cheapest plan runs it too
//   extra   running, but the cheapest plan skips it
//   missed  idle, but the cheapest plan runs it
//   idle    idle, and the cheapest plan skips it too
// A bay is a cold start when it is on and the slot before it is off (the pump is off before slot 1).

/** `mine` and `best` are plan objects from allPlans(). On a tie for cheapest, `best` should be `mine`. */
export function siteReport(model, mine, best) {
  const rows = mine.x.map((on, t) => {
    const inBest = Boolean(best.x[t]);
    const cold = Boolean(on) && (t === 0 || !mine.x[t - 1]);
    const tag = on ? (inBest ? "match" : "extra") : inBest ? "missed" : "idle";
    return { slot: t + 1, price: model.prices[t], on: Boolean(on), inBest, cold, tag };
  });
  return {
    rows,
    won: mine.total === best.total,
    dTotal: mine.total - best.total,
    dElectricity: mine.electricity - best.electricity,
    starts: mine.starts,
    bestStarts: best.starts,
    coldSlots: rows.filter((r) => r.cold).map((r) => r.slot),
    switchOff: rows.filter((r) => r.tag === "extra").map((r) => r.slot),
    switchOn: rows.filter((r) => r.tag === "missed").map((r) => r.slot),
  };
}
