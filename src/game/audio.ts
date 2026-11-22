/**
 * Web Audio Procedural Sound Synthesis + Extensible SoundBed Hook Module.
 *
 * Zero external audio files — all sounds are synthesized with Web Audio API.
 * Named hooks (Chime, Door, Clack, Rumble, Polaroid) allow wiring real audio
 * clips in the future without rewriting callers.
 *
 * TBD: Exact final sound design and whether real audio clips will be supplied.
 */

export type SoundBedHookName = 'Chime' | 'Door' | 'Clack' | 'Rumble' | 'Polaroid';

export type SoundBedCustomHook = (
  ctx: AudioContext,
  destination: AudioNode,
  params?: Record<string, number>,
) => void;

export interface SoundBedRegistry {
  Chime: SoundBedCustomHook | null;
  Door: SoundBedCustomHook | null;
  Clack: SoundBedCustomHook | null;
  Rumble: SoundBedCustomHook | null;
  Polaroid: SoundBedCustomHook | null;
}

export class SubwayAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private muted = false;
  private masterVolume = 0.72;
  private paused = false;
  private started = false;
  private clackAccumulator = 0;
  private heartbeatAccumulator = 0;

  /**
   * Named SoundBed hooks — register external clip players here later (TBD).
   */
  public readonly soundBed: SoundBedRegistry = {
    Chime: null,
    Door: null,
    Clack: null,
    Rumble: null,
    Polaroid: null,
  };

  public registerHook(name: SoundBedHookName, hook: SoundBedCustomHook | null): void {
    this.soundBed[name] = hook;
  }

  public init(): void {
    if (this.started || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.masterVolume;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Continuous Tunnel Rumble (filtered brown/pink noise bed)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.03 * white) / 1.03;
        lastOut = data[i];
        data[i] *= 3.2;
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 95;
      filter.Q.value = 1.4;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.0;

      noiseSrc.connect(filter);
      filter.connect(rumbleGain);
      rumbleGain.connect(master);
      noiseSrc.start();

      this.rumbleFilter = filter;
      this.rumbleGain = rumbleGain;

      // Subtle 120Hz fluorescent ballast hum
      const humOsc = ctx.createOscillator();
      humOsc.type = 'sawtooth';
      humOsc.frequency.value = 120;

      const humFilter = ctx.createBiquadFilter();
      humFilter.type = 'bandpass';
      humFilter.frequency.value = 120;
      humFilter.Q.value = 8;

      const humGain = ctx.createGain();
      humGain.gain.value = 0.018;

      humOsc.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(master);
      humOsc.start();
      this.humGain = humGain;

      this.started = true;
    } catch {
      // Headless or blocked audio context — fail gracefully
    }
  }

  public unlock(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.muted || this.paused ? 0 : this.masterVolume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  /**
   * Continuous per-frame audio update: tunnel rumble scaled by train speed,
   * rhythmic rail joint clacks, fluorescent hum, and low-sanity heartbeat.
   */
  public updateContinuous(params: {
    dt: number;
    trainSpeed: number; // 0..1
    isBlackout: boolean;
    sanityTier: 'High' | 'Medium' | 'Low' | 'Critical';
    heartbeatBpm: number;
  }): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const speed = Math.max(0, Math.min(1.4, params.trainSpeed));

    // Tunnel rumble follows speed (or invokes custom SoundBed.Rumble hook if wired)
    if (this.rumbleGain && this.rumbleFilter) {
      const targetGain = 0.03 + speed * 0.28;
      const targetFreq = 65 + speed * 175;
      this.rumbleGain.gain.setTargetAtTime(targetGain, now, 0.08);
      this.rumbleFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    }

    if (this.humGain) {
      this.humGain.gain.setTargetAtTime(params.isBlackout ? 0.004 : 0.018, now, 0.06);
    }

    // Track joint clacks (ka-thunk ... ka-thunk) proportional to train speed
    if (speed > 0.14) {
      this.clackAccumulator += params.dt * speed * 1.45;
      if (this.clackAccumulator >= 1) {
        this.clackAccumulator -= 1;
        this.playClack(speed);
      }
    }

    // Low / Medium / Critical sanity heartbeat
    if (params.sanityTier !== 'High') {
      const interval = 60 / Math.max(82, Math.min(118, params.heartbeatBpm));
      this.heartbeatAccumulator += params.dt;
      if (this.heartbeatAccumulator >= interval) {
        this.heartbeatAccumulator -= interval;
        const amp =
          params.sanityTier === 'Critical' ? 0.32 : params.sanityTier === 'Low' ? 0.2 : 0.1;
        this.playHeartbeat(amp);
      }
    }
  }

  /** NYC MTA two-tone door closing chime (descending E5 -> C5) */
  public playDoorChime(): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    if (this.soundBed.Chime) {
      this.soundBed.Chime(this.ctx, this.masterGain);
      return;
    }

    const now = this.ctx.currentTime;
    const notes = [
      { freq: 659.25, start: 0, dur: 0.28 },
      { freq: 523.25, start: 0.26, dur: 0.45 },
    ];
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      g.gain.setValueAtTime(0.0001, now + n.start);
      g.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
  }

  /** Pneumatic subway sliding door hiss + mechanical thud */
  public playDoorSlide(opening: boolean): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    if (this.soundBed.Door) {
      this.soundBed.Door(this.ctx, this.masterGain, { opening: opening ? 1 : 0 });
      return;
    }

    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.55);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opening ? 950 : 750, now);
    bp.frequency.linearRampToValueAtTime(opening ? 1400 : 420, now + 0.5);
    bp.Q.value = 2.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);

    // Metallic thump at end of slide
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(86, now + 0.48);
    thud.frequency.exponentialRampToValueAtTime(34, now + 0.62);
    tg.gain.setValueAtTime(0.22, now + 0.48);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.64);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now + 0.48);
    thud.stop(now + 0.66);
  }

  /** Rail joint clack (double-tap steel wheel on gap) */
  public playClack(speed = 1): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    if (this.soundBed.Clack) {
      this.soundBed.Clack(this.ctx, this.masterGain, { speed });
      return;
    }

    const now = this.ctx.currentTime;
    const offsets = [0, 0.13 / Math.max(0.5, speed)];
    for (const off of offsets) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(115 + Math.random() * 25, now + off);
      osc.frequency.exponentialRampToValueAtTime(42, now + off + 0.055);
      g.gain.setValueAtTime(0.06 * Math.min(1, speed), now + off);
      g.gain.exponentialRampToValueAtTime(0.0005, now + off + 0.06);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 340;

      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(now + off);
      osc.stop(now + off + 0.07);
    }
  }

  /** Overhead intercom PA ding (metallic single bell + subtle static) */
  public playPaDing(): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.48);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Polaroid camera mechanical shutter snap + motor whir */
  public playPolaroidShutter(): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    if (this.soundBed.Polaroid) {
      this.soundBed.Polaroid(this.ctx, this.masterGain);
      return;
    }

    const now = this.ctx.currentTime;
    // Crisp click impulse
    const len = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.16));
    }
    const click = this.ctx.createBufferSource();
    click.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const cg = this.ctx.createGain();
    cg.gain.value = 0.28;
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.masterGain);
    click.start(now);

    // Ejection roller whir
    const whir = this.ctx.createOscillator();
    const wg = this.ctx.createGain();
    whir.type = 'sawtooth';
    whir.frequency.setValueAtTime(210, now + 0.07);
    whir.frequency.linearRampToValueAtTime(290, now + 0.42);
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 480;
    wg.gain.setValueAtTime(0.001, now + 0.07);
    wg.gain.linearRampToValueAtTime(0.065, now + 0.12);
    wg.gain.exponentialRampToValueAtTime(0.0005, now + 0.46);
    whir.connect(wf);
    wf.connect(wg);
    wg.connect(this.masterGain);
    whir.start(now + 0.07);
    whir.stop(now + 0.48);
  }

  /** Tape recorder mechanical button clack */
  public playTapeClick(): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.045);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /** EVP tape playback hiss + eerie formant whisper resonance */
  public playEvpClip(hasAnomalyResonance: boolean): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    this.playTapeClick();
    const now = this.ctx.currentTime + 0.08;
    const duration = 2.2;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * 0.25;
    }
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(hasAnomalyResonance ? 620 : 1200, now);
    if (hasAnomalyResonance) {
      bp.frequency.linearRampToValueAtTime(380, now + 0.9);
      bp.frequency.linearRampToValueAtTime(790, now + 1.6);
    }
    bp.Q.value = hasAnomalyResonance ? 5.5 : 1.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.15);
    g.gain.setValueAtTime(0.14, now + duration - 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    hiss.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    hiss.start(now);
  }

  /** Subtle double-thump heartbeat */
  private playHeartbeat(amplitude: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const beats = [
      { delay: 0, freq: 58, gain: amplitude },
      { delay: 0.17, freq: 48, gain: amplitude * 0.65 },
    ];
    for (const b of beats) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.freq, now + b.delay);
      osc.frequency.exponentialRampToValueAtTime(28, now + b.delay + 0.13);
      g.gain.setValueAtTime(0.001, now + b.delay);
      g.gain.exponentialRampToValueAtTime(b.gain, now + b.delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, now + b.delay + 0.14);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + b.delay);
      osc.stop(now + b.delay + 0.16);
    }
  }

  /** Subtle transit radio carrier pulse when tuning frequencies */
  public playTunerPulse(signalStrength: number): void {
    if (!this.ctx || !this.masterGain || this.paused) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = signalStrength > 0.72 ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(signalStrength > 0.72 ? 640 : 180 + signalStrength * 260, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.045 * Math.max(0.25, signalStrength), now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
      this.started = false;
    }
  }
}
