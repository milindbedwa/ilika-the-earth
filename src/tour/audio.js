// ILIKA tour: optional ambience, synthesised in the browser (no audio files).
// Breeze and water are filtered noise; birds are short sine chirps. Off until the visitor turns it on.
export class Ambience {
  constructor() {
    this.on = false;
  }
  start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ac = (this.ac = this.ac || new AC());
    if (!this.master) {
      this.master = ac.createGain();
      this.master.gain.value = 0;
      this.master.connect(ac.destination);
      const len = ac.sampleRate * 3;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // brown-ish noise, soft on the ear
        last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03;
        d[i] = last * 3.2;
      }
      const src = (freq, q, type) => {
        const s = ac.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        const f = ac.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ac.createGain();
        g.gain.value = 0;
        s.connect(f).connect(g).connect(this.master);
        s.start(0, Math.random() * 2);
        return g;
      };
      this.breeze = src(420, 0.4, 'lowpass');
      this.breeze.gain.value = 0.5;
      this.water = src(1700, 0.8, 'bandpass');
      // slow swell on the breeze
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.09;
      const lg = ac.createGain();
      lg.gain.value = 0.22;
      lfo.connect(lg).connect(this.breeze.gain);
      lfo.start();
    }
    ac.resume();
    this.on = true;
    this.master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 1.5);
    this.chirpLoop();
    return true;
  }
  stop() {
    this.on = false;
    if (this.master) this.master.gain.linearRampToValueAtTime(0, this.ac.currentTime + 0.6);
    clearTimeout(this.timer);
  }
  // 0..1: how close the listener is to the pool
  setWater(k) {
    if (this.water) this.water.gain.setTargetAtTime(0.05 + 0.5 * k, this.ac.currentTime, 0.4);
  }
  setIndoors(k) {
    if (this.breeze) this.breeze.gain.setTargetAtTime(0.5 - 0.3 * k, this.ac.currentTime, 0.6);
    this.indoor = k;
  }
  chirpLoop() {
    clearTimeout(this.timer);
    if (!this.on) return;
    this.timer = setTimeout(
      () => {
        this.chirp();
        this.chirpLoop();
      },
      1800 + Math.random() * 5200,
    );
  }
  chirp() {
    const ac = this.ac;
    const notes = 2 + ((Math.random() * 4) | 0);
    const base = 2200 + Math.random() * 1800;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    const vol = (0.035 + Math.random() * 0.03) * (1 - 0.5 * (this.indoor || 0));
    let t = ac.currentTime + 0.05;
    for (let i = 0; i < notes; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const f = base * (1 + (Math.random() - 0.5) * 0.25);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() > 0.5 ? 1.25 : 0.82), t + 0.09);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g);
      if (pan) g.connect(pan).connect(this.master);
      else g.connect(this.master);
      o.start(t);
      o.stop(t + 0.13);
      t += 0.1 + Math.random() * 0.09;
    }
  }
}
