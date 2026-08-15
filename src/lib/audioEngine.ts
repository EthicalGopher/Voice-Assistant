import type { AudioData, AssistantState } from '../types';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeTTSSource: AudioBufferSourceNode | null = null;
  
  private freqArray: Uint8Array = new Uint8Array(256);
  private timeArray: Uint8Array = new Uint8Array(256);
  
  private isMicActive = false;
  private isTTSPlaying = false;
  private smoothedVol = 0;
  private smoothedPitch = 0.5;
  private smoothedPitchFreq = 220;
  private soundEffectsEnabled = true;

  constructor() {
    // Audio context initialized on first interaction
  }

  private initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
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

  public async playAudioWav(
    wavBytes: Uint8Array,
    onStarted?: () => void,
    onEnded?: () => void
  ): Promise<void> {
    try {
      const ctx = this.initContext();
      this.stopAudio();

      const arrayBuffer = new ArrayBuffer(wavBytes.byteLength);
      new Uint8Array(arrayBuffer).set(wavBytes);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      this.activeTTSSource = source;
      this.isTTSPlaying = true;

      source.onended = () => {
        this.isTTSPlaying = false;
        this.activeTTSSource = null;
        onEnded?.();
      };

      source.start(0);
      onStarted?.();
    } catch (err) {
      console.warn('[AudioEngine] WAV playback failed:', err);
      this.isTTSPlaying = false;
      this.activeTTSSource = null;
      onEnded?.();
    }
  }

  public stopAudio() {
    if (this.activeTTSSource) {
      try {
        this.activeTTSSource.stop();
        this.activeTTSSource.disconnect();
      } catch {
        // Source may already have ended
      }
      this.activeTTSSource = null;
    }
    this.isTTSPlaying = false;
  }

  public getIsMicActive(): boolean {
    return this.isMicActive;
  }

  public getIsTTSPlaying(): boolean {
    return this.isTTSPlaying;
  }

  public setSoundEffects(enabled: boolean) {
    this.soundEffectsEnabled = enabled;
  }

  /**
   * Fast time-domain autocorrelation for vocal fundamental frequency (pitch) detection
   */
  private detectPitchFromTimeDomain(timeData: Uint8Array, sampleRate: number): number {
    const size = timeData.length;
    let rms = 0;
    const floatBuf = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const val = (timeData[i] - 128) / 128;
      floatBuf[i] = val;
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.015) {
      return -1; // Audio too quiet
    }

    // Vocal fundamental frequency range: 80Hz to 600Hz
    const minLag = Math.max(1, Math.floor(sampleRate / 600));
    const maxLag = Math.min(Math.floor(size / 2), Math.floor(sampleRate / 80));

    let bestLag = -1;
    let maxCorr = -1;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < size - lag; i++) {
        corr += floatBuf[i] * floatBuf[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag > 0 && maxCorr > 0.25) {
      return sampleRate / bestLag;
    }
    return -1;
  }

  /**
   * Get real-time or procedural audio metrics for Three.js visualization
   */
  public getAudioData(state: AssistantState, time: number): AudioData {
    const isLiveAudio = (this.isMicActive || this.isTTSPlaying) && this.analyser !== null;

    if (isLiveAudio && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqArray as unknown as Uint8Array<ArrayBuffer>);
      this.analyser.getByteTimeDomainData(this.timeArray as unknown as Uint8Array<ArrayBuffer>);

      let sum = 0;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      let weightedFreqSum = 0;
      let totalFreqMag = 0;

      const len = this.freqArray.length;
      for (let i = 0; i < len; i++) {
        const val = this.freqArray[i];
        sum += val;
        if (i < 16) bassSum += val;
        else if (i < 80) midSum += val;
        else trebleSum += val;

        weightedFreqSum += i * val;
        totalFreqMag += val;
      }

      const rawVol = sum / (len * 255);
      const bass = bassSum / (16 * 255);
      const mid = midSum / (64 * 255);
      const treble = trebleSum / ((len - 80) * 255);

      // Pitch detection via autocorrelation & spectral centroid
      const sampleRate = this.audioCtx ? this.audioCtx.sampleRate : 44100;
      const detectedFreq = this.detectPitchFromTimeDomain(this.timeArray, sampleRate);
      
      let currentPitchFreq = this.smoothedPitchFreq;
      let currentNormPitch = this.smoothedPitch;

      if (detectedFreq > 60 && detectedFreq < 800) {
        currentPitchFreq = detectedFreq;
        // Map 80Hz - 500Hz to 0.0 - 1.0 normalized pitch
        currentNormPitch = Math.max(0, Math.min(1, (detectedFreq - 80) / 420));
      } else if (totalFreqMag > 10) {
        // Fallback to spectral centroid
        const centroidBin = weightedFreqSum / totalFreqMag;
        const centroidFreq = (centroidBin * (sampleRate / 2)) / len;
        currentPitchFreq = Math.max(80, Math.min(600, centroidFreq * 0.35));
        currentNormPitch = Math.max(0, Math.min(1, (currentPitchFreq - 80) / 420));
      }

      // Smooth metrics for organic 3D fluid responses
      this.smoothedVol += (rawVol - this.smoothedVol) * 0.28;
      this.smoothedPitch += (currentNormPitch - this.smoothedPitch) * 0.2;
      this.smoothedPitchFreq += (currentPitchFreq - this.smoothedPitchFreq) * 0.2;

      return {
        volume: rawVol,
        bass,
        mid,
        treble,
        pitch: this.smoothedPitch,
        pitchFrequency: this.smoothedPitchFreq,
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
    let targetPitchFreq = 220;

    switch (state) {
      case 'idle':
        targetVol = 0.05 + Math.sin(time * 1.2) * 0.02;
        speed = 0.8;
        chaos = 0.01;
        targetPitchFreq = 180 + Math.sin(time * 0.8) * 15;
        break;
      case 'listening':
        targetVol = 0.22 + Math.sin(time * 3.0) * 0.08;
        speed = 1.6;
        chaos = 0.05;
        targetPitchFreq = 230 + Math.sin(time * 2.5) * 30;
        break;
      case 'processing':
        // Smooth, calm neural thinking pulsation (zero high-frequency jitter)
        targetVol = 0.12 + Math.sin(time * 2.0) * 0.03;
        speed = 0.9;
        chaos = 0.01;
        targetPitchFreq = 220 + Math.sin(time * 1.5) * 15;
        break;
      case 'speaking': {
        // Natural, smooth conversational speech envelope
        const speechEnvelope = Math.max(0, Math.sin(time * 3.8) * Math.cos(time * 1.9));
        const syllables = Math.sin(time * 8.5) * 0.15 + Math.sin(time * 14.0) * 0.08;
        targetVol = 0.26 + speechEnvelope * 0.18 + Math.abs(syllables) * 0.1;
        speed = 1.8;
        chaos = 0.04;

        // Dynamic intonation pitch modulation (180Hz to 300Hz)
        const intonation = Math.sin(time * 2.8) * 35 + Math.cos(time * 5.2) * 20;
        targetPitchFreq = 220 + intonation;
        break;
      }
    }

    const normPitch = Math.max(0, Math.min(1, (targetPitchFreq - 80) / 420));
    this.smoothedVol += (targetVol - this.smoothedVol) * 0.15;
    this.smoothedPitch += (normPitch - this.smoothedPitch) * 0.12;
    this.smoothedPitchFreq += (targetPitchFreq - this.smoothedPitchFreq) * 0.12;

    const dummyFreq = new Uint8Array(256);
    const dummyTime = new Uint8Array(256);

    for (let i = 0; i < 256; i++) {
      const x = i / 256;
      const h1 = Math.sin(x * 12 + time * speed) * 0.5 + 0.5;
      const h2 = Math.sin(x * 28 - time * speed * 1.3) * 0.3 + 0.3;
      const h3 = Math.sin(x * 64 + time * speed * 2) * 0.2 + 0.2;
      const noise = (Math.random() - 0.5) * chaos;
      
      const val = Math.min(255, Math.max(0, Math.floor((h1 + h2 + h3 + noise) * this.smoothedVol * 255)));
      dummyFreq[i] = val;
      
      const waveVal = 128 + Math.floor(Math.sin(x * Math.PI * 8 + time * speed * 3) * this.smoothedVol * 110);
      dummyTime[i] = Math.min(255, Math.max(0, waveVal));
    }

    return {
      volume: targetVol,
      bass: Math.min(1, this.smoothedVol * 1.4),
      mid: Math.min(1, this.smoothedVol * 1.1),
      treble: Math.min(1, this.smoothedVol * 0.8),
      pitch: this.smoothedPitch,
      pitchFrequency: this.smoothedPitchFreq,
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
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'click') {
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
      // Ignored
    }
  }
}

export const audioEngineInstance = new AudioEngine();
