/**
 * Generated ambience (no audio files): wind from filtered noise, birdsong by day,
 * crickets at night, and a rustle when leaves burst. Starts only from a user click.
 */
export function createAmbience() {
  const ctx = new AudioContext();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = noise.getChannelData(0);
  for (let i = 0, b = 0; i < data.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); data[i] = b * 3.5; } // brown-ish noise

  const windSrc = ctx.createBufferSource(); windSrc.buffer = noise; windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
  const windGain = ctx.createGain(); windGain.gain.value = 0.55;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.09; lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(windFilter.frequency);
  windSrc.connect(windFilter).connect(windGain).connect(master);
  windSrc.start(); lfo.start();

  let phase = 0, timer = 0;
  function chirp() {
    const t = ctx.currentTime, notes = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1400;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * (0.09 + Math.random() * 0.05);
      o.type = 'sine'; o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), s); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.05, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, s + 0.09);
      o.connect(g).connect(master); o.start(s); o.stop(s + 0.1);
    }
  }
  function cricket() {
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.06;
      o.type = 'triangle'; o.frequency.value = 4400 + Math.random() * 200;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.018, s + 0.008); g.gain.linearRampToValueAtTime(0, s + 0.035);
      o.connect(g).connect(master); o.start(s); o.stop(s + 0.04);
    }
  }
  function schedule() {
    timer = window.setTimeout(() => { if (phase < 0.7) chirp(); else cricket(); schedule(); }, phase < 0.7 ? 1800 + Math.random() * 4500 : 500 + Math.random() * 900);
  }
  return {
    start() { void ctx.resume(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.5); clearTimeout(timer); schedule(); },
    stop() { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); clearTimeout(timer); },
    /** p = scroll progress; wind picks up with scroll speed. */
    update(p: number, speed: number) { phase = p; windGain.gain.setTargetAtTime(0.45 + Math.min(speed * 4, 0.6), ctx.currentTime, 0.4); windFilter.Q.value = 0.6 + p * 0.4; },
    rustle() {
      const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; f.type = 'highpass'; f.frequency.value = 2200; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + 1);
    },
    dispose() { clearTimeout(timer); void ctx.close(); },
  };
}
export type Ambience = ReturnType<typeof createAmbience>;
