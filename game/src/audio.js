// SOLMARA — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, crashes, pickups and jingles.

function makeAudio() {
  var A = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0,

    ensure: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.35;
    },

    // Short noise burst (gunshot, crash, punch).
    noiseBurst: function (dur, freq, vol, type) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    // Short sine/triangle blip (pickup, UI, jingle notes).
    blip: function (freq, dur, vol, type, when) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (when || 0);
      var o = this.ctx.createOscillator();
      o.type = type || 'sine'; o.frequency.value = freq;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    shoot: function (big) {
      this.noiseBurst(big ? 0.22 : 0.12, big ? 900 : 1800, big ? 0.6 : 0.4);
      this.blip(big ? 90 : 140, 0.08, 0.25, 'square');
    },
    punch: function () { this.noiseBurst(0.08, 500, 0.35); },
    crash: function (hard) { this.noiseBurst(hard ? 0.35 : 0.18, 400, hard ? 0.7 : 0.4); },
    pickup: function () { this.blip(660, 0.09, 0.3); this.blip(990, 0.12, 0.3, 'sine', 0.07); },
    cash: function () { this.blip(880, 0.07, 0.25); this.blip(1174, 0.07, 0.25, 'sine', 0.06); this.blip(1568, 0.12, 0.25, 'sine', 0.12); },
    click: function () { this.blip(440, 0.05, 0.2, 'square'); },
    missionDone: function () {
      var notes = [523, 659, 784, 1046];
      for (var i = 0; i < notes.length; i++) this.blip(notes[i], 0.16, 0.3, 'triangle', i * 0.11);
    },
    wasted: function () {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) this.blip(notes[i], 0.3, 0.3, 'sawtooth', i * 0.22);
    },
    busted: function () { this.blip(220, 0.4, 0.3, 'sawtooth'); this.blip(175, 0.5, 0.3, 'sawtooth', 0.3); },

    // Engine hum that follows the player's car speed. Call every frame.
    engine: function (speedFrac, on) {
      if (!this.ctx || this.muted) { this.engineStop(); return; }
      if (!on) { this.engineStop(); return; }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 700;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      var f = 55 + speedFrac * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(400 + speedFrac * 900, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speedFrac * 0.05, this.ctx.currentTime, 0.1);
    },
    engineStop: function () {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    },

    // Two-tone police siren while any police car is near. Call every frame.
    siren: function (on, dt) {
      if (!this.ctx || this.muted || !on) {
        if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        return;
      }
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      this.sirenTimer += dt;
      var hi = Math.floor(this.sirenTimer / 0.45) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.1);
    }
  };
  Game.audio = A;
  return A;
}
