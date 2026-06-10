/* ============================================================
 * audio.js — all sound is synthesized with the Web Audio API.
 * No audio files. The AudioContext is created lazily on the
 * first user gesture (browsers block audio before interaction).
 * ============================================================ */

const Sfx = (() => {
  let ctx = null;

  /** Create/resume the AudioContext. Call from a user-gesture handler. */
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return; // no Web Audio support; game still plays silently
      ctx = new AC();
    }
    // Only start the music once the context is actually running — if the
    // browser is still blocking autoplay, resume() resolves on a later
    // (gesture-driven) unlock() call and the music begins then.
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { if (ctx.state === 'running') startMusic(); });
    } else {
      startMusic();
    }
  }

  /** Shared helper: oscillator with a quick gain envelope. */
  function tone({ type = 'sine', freq = 440, freqEnd = null, start = 0,
                  dur = 0.2, vol = 0.2, attack = 0.005 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Shared helper: a burst of filtered white noise (for splats). */
  function noiseBurst({ start = 0, dur = 0.12, vol = 0.25, cutoff = 900 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  /** Soft squishy "icing splat" — noise puff + a low pitch-dropping thump. */
  function splat() {
    noiseBurst({ dur: 0.10, vol: 0.22, cutoff: 1100 });
    tone({ type: 'sine', freq: 220, freqEnd: 70, dur: 0.14, vol: 0.25 });
  }

  /** Tiny "plip" when picking frosting up from a bucket. */
  function pickup() {
    tone({ type: 'sine', freq: 520, freqEnd: 740, dur: 0.07, vol: 0.10 });
  }

  /** Cheerful two-note bell "ding" for a completed order. */
  function ding() {
    tone({ type: 'sine', freq: 880,  dur: 0.45, vol: 0.18 });
    tone({ type: 'sine', freq: 1318, dur: 0.55, vol: 0.14, start: 0.09 });
    // faint sparkle overtone
    tone({ type: 'triangle', freq: 1760, dur: 0.35, vol: 0.05, start: 0.09 });
  }

  /** Quick bright shaker rattle for applying sprinkles. */
  function sprinkle() {
    noiseBurst({ dur: 0.05, vol: 0.12, cutoff: 5000 });
    noiseBurst({ start: 0.06, dur: 0.05, vol: 0.09, cutoff: 6500 });
    noiseBurst({ start: 0.12, dur: 0.04, vol: 0.07, cutoff: 8000 });
  }

  /** Soft, non-harsh error buzz for a miss. */
  function buzz() {
    tone({ type: 'triangle', freq: 196, freqEnd: 147, dur: 0.30, vol: 0.16 });
    tone({ type: 'triangle', freq: 147, freqEnd: 110, dur: 0.28, vol: 0.12, start: 0.10 });
  }

  /* ---------- Background music ----------
   * A calm, music-box style loop, fully synthesized: a four-chord
   * progression with a soft sine bass and twinkly triangle arpeggios,
   * fed through a feedback delay for a cozy, roomy feel. Notes are
   * scheduled a little ahead of time on a timer so playback stays
   * smooth even if the main thread hiccups.
   */
  const MUSIC_TEMPO = 84;       // BPM — slow and gentle
  const MUSIC_VOL   = 0.16;     // master music level (well under the SFX)
  // Chord progression in F major (MIDI note numbers): F — Dm — Bb — C
  const MUSIC_CHORDS = [
    [53, 57, 60],   // F3  A3  C4
    [50, 53, 57],   // D3  F3  A3
    [46, 50, 53],   // Bb2 D3  F3
    [48, 52, 55],   // C3  E3  G3
  ];

  let musicStarted = false;
  let musicBus = null;          // gain node all music routes through
  let nextBarTime = 0;
  let barCount = 0;

  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /** One soft plucked note routed to the music bus. */
  function pluck(freq, t, dur, vol, type = 'triangle') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Queue one bar: two bass notes + an eighth-note music-box arpeggio. */
  function scheduleBar(t, bar) {
    const beat = 60 / MUSIC_TEMPO;
    const chord = MUSIC_CHORDS[bar % MUSIC_CHORDS.length];
    // soft low root, twice per bar
    pluck(midiHz(chord[0] - 12), t, beat * 2.2, 0.22, 'sine');
    pluck(midiHz(chord[0] - 12), t + beat * 2, beat * 2.2, 0.17, 'sine');
    // arpeggio two octaves up; contour alternates rising/falling per bar
    const rise = [0, 1, 2, 1, 0, 1, 2, 1];
    const fall = [2, 1, 0, 1, 2, 1, 0, 1];
    const pat = bar % 2 === 0 ? rise : fall;
    for (let i = 0; i < 8; i++) {
      pluck(midiHz(chord[pat[i]] + 24), t + i * beat / 2, beat * 1.6, 0.10);
    }
    // a high twinkle at the end of every 4-bar phrase
    if (bar % 4 === 3) pluck(midiHz(chord[2] + 36), t + beat * 3, beat * 2, 0.05);
  }

  /** Keep ~0.8s of notes queued ahead of the playhead. */
  function scheduleAhead() {
    const barDur = (60 / MUSIC_TEMPO) * 4;
    while (nextBarTime < ctx.currentTime + 0.8) {
      scheduleBar(nextBarTime, barCount++);
      nextBarTime += barDur;
    }
  }

  function startMusic() {
    if (!ctx || musicStarted) return;
    musicStarted = true;
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_VOL;
    musicBus.connect(ctx.destination);
    // gentle echo: bus -> delay -> (quieter) feedback -> out
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    musicBus.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(ctx.destination);
    nextBarTime = ctx.currentTime + 0.15;
    setInterval(scheduleAhead, 200);
  }

  return { unlock, splat, pickup, ding, buzz, sprinkle };
})();
