// Short interface sounds made in the browser (no files, no licence). A soft pop for every click or tap.
// The page's Sound button is for the ambience; click sounds have their own switch in Settings.
const KEY = "qw-click-sound";

export function createUiSound() {
  let ctx = null;
  let on = true;
  try {
    on = localStorage.getItem(KEY) !== "off";
  } catch {
    /* private mode: keep the default */
  }

  function click() {
    if (!on) return;
    try {
      ctx = ctx || new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(820, t);
      o.frequency.exponentialRampToValueAtTime(430, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.1);
    } catch {
      /* no audio available: stay silent */
    }
  }

  return {
    click,
    get enabled() {
      return on;
    },
    set(value) {
      on = value;
      try {
        localStorage.setItem(KEY, value ? "on" : "off");
      } catch {
        /* ignore */
      }
      if (on) click(); // let the person hear what they just turned on
    },
  };
}
