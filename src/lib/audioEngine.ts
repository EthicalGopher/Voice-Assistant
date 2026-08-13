import type { AudioData, AssistantState } from '../types';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  
  private freqArray: Uint8Array = new Uint8Array(256);
  private timeArray: Uint8Array = new Uint8Array(256);
  
  private isMicActive = false;
  private smoothedVol = 0;
  private soundEffectsEnabled = true;

  constructor() {
    // Lazy audio context init on user gesture
  }

  private initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;
      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      const ctx = this.initContext();
      if (this.micStream) {
        this.stopMicrophone();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      if (this.analyser) {
        this.sourceNode = ctx.createMediaStreamSource(stream);
        this.sourceNode.connect(this.analyser);
      }
      this.isMicActive = true;
      return true;
    } catch (err) {
      console.warn('Microphone access unavailable or denied:', err);
      this.isMicActive = false;
      return false;
    }
  }

  public stopMicrophone() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.isMicActive = false;
  }

  public getIsMicActive(): boolean {
    return this.isMicActive;
  }

  public setSoundEffects(enabled: boolean) {
    this.soundEffectsEnabled = enabled;
  }

  /**
   * Get real-time or procedural audio metrics for Three.js visualization
   */
  public getAudioData(state: AssistantState, time: number): AudioData {
    if (this.isMicActive && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqArray as unknown as Uint8Array<ArrayBuffer>);
      this.analyser.getByteTimeDomainData(this.timeArray as unknown as Uint8Array<ArrayBuffer>);

      let sum = 0;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      const len = this.freqArray.length;
      for (let i = 0; i < len; i++) {
        const val = this.freqArray[i];
        sum += val;
        if (i < 16) bassSum += val;
        else if (i < 80) midSum += val;
        else trebleSum += val;
      }

      const rawVol = sum / (len * 255);
      const bass = bassSum / (16 * 255);
      const mid = midSum / (64 * 255);
      const treble = trebleSum / ((len - 80) * 255);

      // Smooth volume for organic visuals
      this.smoothedVol += (rawVol - this.smoothedVol) * 0.25;

      return {
        volume: rawVol,
        bass,
        mid,
        treble,
        rawFrequencies: this.freqArray,
        timeDomainData: this.timeArray,
        smoothedVolume: this.smoothedVol,
      };
    }

    // Procedural synthesized audio data based on assistant state
    return this.generateProceduralAudio(state, time);
  }

  private generateProceduralAudio(state: AssistantState, time: number): AudioData {
    let targetVol = 0.08;
    let speed = 1.0;
    let chaos = 0.05;

    switch (state) {
      case 'idle':
        targetVol = 0.08 + Math.sin(time * 1.5) * 0.03 + Math.sin(time * 0.7) * 0.02;
        speed = 1.2;
        chaos = 0.04;
        break;
      case 'listening':
        targetVol = 0.35 + Math.sin(time * 4) * 0.15 + Math.sin(time * 8.5) * 0.08;
        speed = 3.0;
        chaos = 0.15;
        break;
      case 'processing':
        targetVol = 0.25 + Math.sin(time * 6) * 0.12 + Math.cos(time * 12) * 0.06;
        speed = 4.5;
        chaos = 0.2;
        break;
      case 'speaking':
        // Complex speech cadence simulation with syllable bursts
        const speechEnvelope = Math.max(0, Math.sin(time * 5.5) * Math.cos(time * 2.3));
        const syllables = Math.sin(time * 14) * 0.3 + Math.sin(time * 22) * 0.15;
        targetVol = 0.38 + speechEnvelope * 0.35 + Math.abs(syllables) * 0.2;
        speed = 3.5;
        chaos = 0.25;
        break;
    }

    this.smoothedVol += (targetVol - this.smoothedVol) * 0.18;

    const dummyFreq = new Uint8Array(256);
    const dummyTime = new Uint8Array(256);

    for (let i = 0; i < 256; i++) {
      const x = i / 256;
      // Synthesized harmonic spectrum
      const h1 = Math.sin(x * 12 + time * speed) * 0.5 + 0.5;
      const h2 = Math.sin(x * 28 - time * speed * 1.3) * 0.3 + 0.3;
      const h3 = Math.sin(x * 64 + time * speed * 2) * 0.2 + 0.2;
      const noise = (Math.random() - 0.5) * chaos;
      
      const val = Math.min(255, Math.max(0, Math.floor((h1 + h2 + h3 + noise) * this.smoothedVol * 255)));
      dummyFreq[i] = val;
      
      // Synthesized time domain wave centered around 128
      const waveVal = 128 + Math.floor(Math.sin(x * Math.PI * 8 + time * speed * 3) * this.smoothedVol * 110);
      dummyTime[i] = Math.min(255, Math.max(0, waveVal));
    }

    return {
      volume: targetVol,
      bass: Math.min(1, this.smoothedVol * 1.4),
      mid: Math.min(1, this.smoothedVol * 1.1),
      treble: Math.min(1, this.smoothedVol * 0.8),
      rawFrequencies: dummyFreq,
      timeDomainData: dummyTime,
      smoothedVolume: this.smoothedVol,
    };
  }

  /**
   * Premium futuristic sci-fi sound effects using Web Audio API synthesis
   */
  public playSoundFx(type: 'listen_start' | 'listen_stop' | 'processing' | 'response' | 'click' | 'toggle') {
    if (!this.soundEffectsEnabled) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      if (type === 'listen_start') {
        // Sci-Fi ascending harmonic chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.2);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(660, now + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.25);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.05);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
      } else if (type === 'listen_stop') {
        // Descending soft close tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(390, now + 0.2);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'response') {
        // Futuristic double bell chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'click') {
        // Subtle haptic acoustic tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {
      // Ignore audio synthesis errors on locked browsers
    }
  }
}

export const audioEngineInstance = new AudioEngine();
