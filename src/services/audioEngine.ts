import { Howl, Howler } from 'howler';
import { Capacitor } from '@capacitor/core';
import type { Track } from '../types';

export type AudioEngineEvent =
  | 'play'
  | 'pause'
  | 'stop'
  | 'end'
  | 'seek'
  | 'timeupdate'
  | 'load'
  | 'error'
  | 'contextConnected';

type EventCallback = (...args: unknown[]) => void;

class AudioEngine {
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
  private currentTrack: Track | null = null;
  private listeners = new Map<AudioEngineEvent, Set<EventCallback>>();
  private animFrameId: number | null = null;
  private _volume = 1;
  private _isMuted = false;
  private _playbackRate = 1;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isContextConnected = false;
  private playErrorRetries = 0;
  private connectedElements = new WeakSet<HTMLAudioElement>();

  // EQ frequencies
  private readonly EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  constructor() {
    Howler.autoUnlock = true;
    Howler.html5PoolSize = 10;
  }

  private emit(event: AudioEngineEvent, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  on(event: AudioEngineEvent, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: AudioEngineEvent, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  initAudioContext() {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();

    // Create analyser
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Create EQ filter chain
    this.eqFilters = this.EQ_FREQUENCIES.map((freq, i) => {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === this.EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = 0;
      filter.Q.value = 1.4;
      return filter;
    });

    // Chain filters together
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }
    // Last filter -> analyser -> destination
    this.eqFilters[this.eqFilters.length - 1].connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
  }

  private connectHowlToContext(howl: Howl) {
    if (!this.audioContext || this.isContextConnected) return;
    try {
      // Access the underlying audio element from Howler
      const soundNode = (howl as any)._sounds?.[0]?._node;
      if (soundNode && soundNode instanceof HTMLAudioElement) {
        // Only create a MediaElementSource once per element (browser restriction)
        if (this.connectedElements.has(soundNode)) {
          // Already connected, just re-wire
          this.isContextConnected = true;
          return;
        }
        if (this.sourceNode) {
          try { this.sourceNode.disconnect(); } catch { /* ignore */ }
        }
        this.sourceNode = this.audioContext.createMediaElementSource(soundNode);
        this.sourceNode.connect(this.eqFilters[0]);
        this.connectedElements.add(soundNode);
        this.isContextConnected = true;
        // Notify listeners so persisted EQ bands can be re-applied
        this.emit('contextConnected');
      }
    } catch {
      // If MediaElementSource already created for this element, ignore
    }
  }

  async load(track: Track): Promise<void> {
    // Initialize audio context on first user-gesture-initiated load
    this.initAudioContext();

    // Cleanup previous
    this.stopTimeUpdate();
    if (this.currentHowl) {
      this.currentHowl.unload();
      this.isContextConnected = false;
    }

    this.currentTrack = track;

    // Detect audio format from file path or URL for Howler
    const detectedFormat = this.detectFormat(track.filePath);
    console.log('[AudioEngine] Loading track:', track.title, 'url:', track.filePath, 'format:', detectedFormat);

    return new Promise((resolve, reject) => {
      this.playErrorRetries = 0;
      const howlOptions: any = {
        src: [track.filePath],
        html5: true,
        volume: this._isMuted ? 0 : this._volume,
        rate: this._playbackRate,
        onload: () => {
          this.emit('load', track);
          resolve();
        },
        onplay: () => {
          this.playErrorRetries = 0;
          this.startTimeUpdate();
          this.emit('play');
          this.updateMediaSession(track);
          this.updateMediaSessionPlaybackState('playing');
        },
        onpause: () => {
          this.stopTimeUpdate();
          this.emit('pause');
          this.updateMediaSessionPlaybackState('paused');
        },
        onstop: () => {
          this.stopTimeUpdate();
          this.emit('stop');
          this.updateMediaSessionPlaybackState('none');
        },
        onend: () => {
          this.stopTimeUpdate();
          this.emit('end');
          this.updateMediaSessionPlaybackState('paused');
        },
        onseek: () => {
          this.emit('seek', this.getCurrentTime());
        },
        onloaderror: (_id: number, err: unknown) => {
          console.error('[AudioEngine] Load error:', err, 'url:', track.filePath);
          this.emit('error', err);
          reject(new Error(`Failed to load: ${err}`));
        },
        onplayerror: (_id: number, err: unknown) => {
          console.error('[AudioEngine] Play error:', err);
          this.playErrorRetries++;
          if (this.playErrorRetries <= 1 && this.currentHowl) {
            // One retry attempt via unlock
            this.currentHowl.once('unlock', () => {
              this.currentHowl?.play();
            });
          } else {
            // Give up — emit error to trigger auto-skip
            console.error('[AudioEngine] Play error unrecoverable, emitting error');
            this.emit('error', err);
          }
        },
      };

      // Add format hint if detected — helps Howler with encoded URLs
      if (detectedFormat) {
        howlOptions.format = [detectedFormat];
      }

      this.currentHowl = new Howl(howlOptions);
    });
  }

  private detectFormat(src: string): string | null {
    // Try to extract file extension from URL or path
    // Handle encoded URLs like https://localhost/_capacitor_file_/.../song.mp3
    try {
      // Strip query string only (not #, since file paths can contain # characters)
      const ext = src.split('?')[0].split('.').pop()?.toLowerCase();
      const formatMap: Record<string, string> = {
        'mp3': 'mp3',
        'flac': 'flac',
        'm4a': 'mp4',
        'aac': 'aac',
        'ogg': 'ogg',
        'opus': 'opus',
        'wav': 'wav',
        'wma': 'wma',
        'webm': 'webm',
      };
      return (ext && formatMap[ext]) || null;
    } catch {
      return null;
    }
  }

  play() {
    if (!this.currentHowl) return;
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    this.currentHowl.play();
    // Try to connect to audio context for EQ/visualizer
    setTimeout(() => {
      if (this.currentHowl) {
        this.connectHowlToContext(this.currentHowl);
      }
    }, 100);
  }

  pause() {
    this.currentHowl?.pause();
  }

  stop() {
    this.currentHowl?.stop();
  }

  togglePlay() {
    if (!this.currentHowl) return;
    if (this.currentHowl.playing()) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time: number) {
    this.currentHowl?.seek(time);
    this.emit('timeupdate', time, this.getDuration());
  }

  getCurrentTime(): number {
    return (this.currentHowl?.seek() as number) || 0;
  }

  getDuration(): number {
    return this.currentHowl?.duration() || 0;
  }

  isPlaying(): boolean {
    return this.currentHowl?.playing() ?? false;
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (!this._isMuted && this.currentHowl) {
      this.currentHowl.volume(this._volume);
    }
    Howler.volume(this._isMuted ? 0 : this._volume);
  }

  getVolume(): number {
    return this._volume;
  }

  setMuted(muted: boolean) {
    this._isMuted = muted;
    if (this.currentHowl) {
      this.currentHowl.volume(muted ? 0 : this._volume);
    }
  }

  isMuted(): boolean {
    return this._isMuted;
  }

  setPlaybackRate(rate: number) {
    this._playbackRate = rate;
    this.currentHowl?.rate(rate);
  }

  getPlaybackRate(): number {
    return this._playbackRate;
  }

  // EQ methods
  setEQBand(bandIndex: number, gainDb: number) {
    if (bandIndex >= 0 && bandIndex < this.eqFilters.length) {
      this.eqFilters[bandIndex].gain.setTargetAtTime(
        gainDb,
        this.audioContext?.currentTime ?? 0,
        0.02 // Smooth transition to avoid clicks
      );
    }
  }

  setEQBands(gains: number[]) {
    gains.forEach((gain, i) => this.setEQBand(i, gain));
  }

  resetEQ() {
    this.eqFilters.forEach((filter) => {
      filter.gain.setTargetAtTime(0, this.audioContext?.currentTime ?? 0, 0.02);
    });
  }

  getEQBands(): number[] {
    return this.eqFilters.map((f) => f.gain.value);
  }

  getEQFrequencies(): number[] {
    return [...this.EQ_FREQUENCIES];
  }

  // Analyser for visualizer
  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  // Preload next track for gapless
  preloadNext(track: Track) {
    if (this.nextHowl) {
      this.nextHowl.unload();
    }
    this.nextHowl = new Howl({
      src: [track.filePath],
      html5: true,
      preload: true,
      volume: this._isMuted ? 0 : this._volume,
      rate: this._playbackRate,
    });
  }

  // Crossfade to the preloaded next track
  crossfadeToNext(duration: number = 3): Howl | null {
    if (!this.nextHowl || !this.currentHowl) return null;

    const outgoing = this.currentHowl;
    const incoming = this.nextHowl;

    // Fade out current
    outgoing.fade(this._volume, 0, duration * 1000);
    setTimeout(() => {
      outgoing.stop();
      outgoing.unload();
    }, duration * 1000);

    // Fade in next
    incoming.volume(0);
    incoming.play();
    incoming.fade(0, this._isMuted ? 0 : this._volume, duration * 1000);

    this.currentHowl = incoming;
    this.nextHowl = null;
    this.isContextConnected = false;

    // Re-connect audio context
    setTimeout(() => {
      if (this.currentHowl) {
        this.connectHowlToContext(this.currentHowl);
      }
    }, 100);

    this.startTimeUpdate();
    return this.currentHowl;
  }

  // Media Session API for lock screen controls (web/PWA only — native uses MediaSessionCompat via plugin)
  private updateMediaSession(track: Track) {
    if (Capacitor.isNativePlatform()) return;
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.coverUrl
        ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    this.updateMediaSessionPositionState();
  }

  private updateMediaSessionPlaybackState(state: MediaSessionPlaybackState) {
    if (Capacitor.isNativePlatform()) return;
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
    if (state === 'playing' || state === 'paused') {
      this.updateMediaSessionPositionState();
    }
  }

  private updateMediaSessionPositionState() {
    if (Capacitor.isNativePlatform()) return;
    if (!('mediaSession' in navigator)) return;
    try {
      const duration = this.getDuration();
      const position = this.getCurrentTime();
      if (duration > 0 && isFinite(duration) && isFinite(position)) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: this._playbackRate,
          position: Math.min(position, duration),
        });
      }
    } catch {
      // setPositionState may not be supported
    }
  }

  setupMediaSessionHandlers(handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onNextTrack?: () => void;
    onPrevTrack?: () => void;
    onSeekForward?: () => void;
    onSeekBackward?: () => void;
  }) {
    if (Capacitor.isNativePlatform()) return;
    if (!('mediaSession' in navigator)) return;

    if (handlers.onPlay) {
      navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    }
    if (handlers.onPause) {
      navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    }
    if (handlers.onNextTrack) {
      navigator.mediaSession.setActionHandler('nexttrack', handlers.onNextTrack);
    }
    if (handlers.onPrevTrack) {
      navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevTrack);
    }
    if (handlers.onSeekForward) {
      navigator.mediaSession.setActionHandler('seekforward', handlers.onSeekForward);
    }
    if (handlers.onSeekBackward) {
      navigator.mediaSession.setActionHandler('seekbackward', handlers.onSeekBackward);
    }
  }

  private startTimeUpdate() {
    this.stopTimeUpdate();
    const update = () => {
      if (this.currentHowl?.playing()) {
        this.emit('timeupdate', this.getCurrentTime(), this.getDuration());
      }
      this.animFrameId = requestAnimationFrame(update);
    };
    this.animFrameId = requestAnimationFrame(update);
  }

  private stopTimeUpdate() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  destroy() {
    this.stopTimeUpdate();
    this.currentHowl?.unload();
    this.nextHowl?.unload();
    this.currentHowl = null;
    this.nextHowl = null;
    this.currentTrack = null;
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.listeners.clear();
  }
}

// Singleton
export const audioEngine = new AudioEngine();
