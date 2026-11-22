// Ambient sound made in the browser: sea, wind, machinery hum and birds.
// Nothing is downloaded, so there is no licence to track. It is off until the user asks.
export function createAmbience() {
  let ctx = null;
  let master = null;
  let birdTimer = null;
  let on = false;
  const LAYERS = ["sea", "wind", "machinery", "birds"];

  function brownNoise(c, seconds = 4) {
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  function noiseSource(c) {
    const s = c.createBufferSource();
    s.buffer = brownNoise(c);
    s.loop = true;
    s.start();
    return s;
  }

  function lfo(c, hz, depth, target) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = hz;
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Sea: slow swells of low noise.
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = "lowpass";
    seaFilter.frequency.value = 650;
    const seaGain = ctx.createGain();
    seaGain.gain.value = 0.22;
    lfo(ctx, 0.11, 0.16, seaGain.gain);
    noiseSource(ctx).connect(seaFilter).connect(seaGain).connect(master);

    // Wind: band of noise that drifts.
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.07;
    lfo(ctx, 0.05, 0.05, windGain.gain);
    lfo(ctx, 0.07, 160, windFilter.frequency);
    noiseSource(ctx).connect(windFilter).connect(windGain).connect(master);

    // Machinery: a steady hum at mains frequency and its octave.
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 220;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.035;
    for (const [type, hz] of [["sawtooth", 50], ["sine", 100]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz;
      o.connect(humFilter);
      o.start();
    }
    humFilter.connect(humGain).connect(master);
  }

  function tone(freqFrom, freqTo, start, dur, peak, pan, type = "sine") {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freqFrom, start);
    o.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function bird() {
    const t = ctx.currentTime + 0.05;
    const pan = Math.random() * 1.6 - 0.8;
    if (Math.random() < 0.25) {
      // A gull: one long falling cry.
      tone(1500, 850, t, 0.7, 0.03, pan, "triangle");
      tone(1560, 900, t + 0.02, 0.7, 0.012, pan, "sine");
    } else {
      // A small bird: a short run of quick chirps.
      const notes = 2 + Math.floor(Math.random() * 4);
      const base = 2300 + Math.random() * 1700;
      for (let i = 0; i < notes; i++) {
        tone(base, base * (0.75 + Math.random() * 0.6), t + i * 0.12, 0.08, 0.04, pan);
      }
    }
  }

  function schedule() {
    if (!on) return;
    bird();
    birdTimer = setTimeout(schedule, 1500 + Math.random() * 4500);
  }

  return {
    async start() {
      if (!ctx) build();
      await ctx.resume();
      master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.4);
      on = true;
      schedule();
    },
    stop() {
      on = false;
      clearTimeout(birdTimer);
      if (!ctx) return;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => !on && ctx.suspend(), 900);
    },
    get state() {
      return { on, context: ctx ? ctx.state : "none", layers: on ? LAYERS : [] };
    },
  };
}
