import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Track, Album, Artist, Playlist, Folder, ScanProgress, EQPreset, RepeatMode, SortField, SortOrder } from '../types';
import { audioEngine } from '../services/audioEngine';
import { db, getTrackCoverUrl } from '../db/musicDatabase';
import type { DBTrack } from '../db/musicDatabase';
import { getFileUrl } from '../services/fileScanner';

// Convert DBTrack to Track (with object URL for cover art)
async function dbTrackToTrack(dbTrack: DBTrack): Promise<Track> {
  let coverUrl = '';
  try {
    coverUrl = await getTrackCoverUrl(dbTrack.id);
  } catch {
    // Cover art failed to load, continue without it
  }
  return {
    id: dbTrack.id,
    title: dbTrack.title,
    artist: dbTrack.artist,
    album: dbTrack.album,
    duration: dbTrack.duration,
    durationMs: dbTrack.durationMs,
    coverUrl,
    color: dbTrack.color,
    filePath: dbTrack.filePath,
    genre: dbTrack.genre,
    year: dbTrack.year,
    trackNumber: dbTrack.trackNumber,
    discNumber: dbTrack.discNumber,
    bitrate: dbTrack.bitrate,
    sampleRate: dbTrack.sampleRate,
    format: dbTrack.format,
    size: dbTrack.size,
    lastModified: dbTrack.lastModified,
    lastPlayed: dbTrack.lastPlayed,
    playCount: dbTrack.playCount,
    replayGainTrack: dbTrack.replayGainTrack,
    replayGainAlbum: dbTrack.replayGainAlbum,
    lyrics: dbTrack.lyrics,
    addedAt: dbTrack.addedAt,
  };
}

// --- Library Slice ---
interface LibrarySlice {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  folders: Folder[];
  isLibraryLoading: boolean;
  scanProgress: ScanProgress;
  sortField: SortField;
  sortOrder: SortOrder;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setScanProgress: (progress: ScanProgress) => void;
  loadLibrary: () => Promise<void>;
  clearLibrary: () => Promise<void>;
}

// --- Playback Slice ---
interface PlaybackSlice {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  history: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  isPlayerOpen: boolean;

  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  setPlayerOpen: (open: boolean) => void;
  setQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

// --- Audio Settings Slice ---
interface AudioSettingsSlice {
  equalizerEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: number[];
  crossfadeDuration: number;
  gaplessPlayback: boolean;
  customPresets: EQPreset[];

  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerPreset: (name: string) => void;
  setEqualizerBand: (index: number, value: number) => void;
  setEqualizerBands: (bands: number[]) => void;
  setCrossfadeDuration: (duration: number) => void;
  setGaplessPlayback: (enabled: boolean) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  resetEqualizer: () => void;
}

// --- UI Slice ---
interface UISlice {
  sleepTimerMinutes: number | null;
  sleepTimerEndTime: number | null;
  setSleepTimer: (minutes: number | null) => void;
  clearSleepTimer: () => void;
}

// --- Liked Tracks Slice ---
interface LikedSlice {
  likedTrackIds: string[];
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
}

export type MusicStore = LibrarySlice & PlaybackSlice & AudioSettingsSlice & UISlice & LikedSlice;

// Default EQ presets
const DEFAULT_EQ_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const BUILTIN_PRESETS: EQPreset[] = [
  { id: 'flat', name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], isCustom: false },
  { id: 'bass_boost', name: 'Bass Boost', bands: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0], isCustom: false },
  { id: 'vocal', name: 'Vocal', bands: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1], isCustom: false },
  { id: 'classical', name: 'Classical', bands: [4, 3, 1, 0, -1, 0, 1, 2, 3, 4], isCustom: false },
  { id: 'rock', name: 'Rock', bands: [5, 3, 1, 0, -1, -1, 0, 2, 3, 5], isCustom: false },
  { id: 'jazz', name: 'Jazz', bands: [3, 2, 0, 1, -1, -1, 0, 1, 2, 4], isCustom: false },
  { id: 'electronic', name: 'Electronic', bands: [5, 4, 2, 0, -2, -1, 0, 2, 4, 5], isCustom: false },
];

function findPreset(name: string, customPresets: EQPreset[]): EQPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.name === name) ?? customPresets.find((p) => p.name === name);
}

export const useMusicStore = create<MusicStore>()(
  persist(
    (set, get) => ({
      // --- Library ---
      tracks: [],
      albums: [],
      artists: [],
      folders: [],
      isLibraryLoading: false,
      scanProgress: { current: 0, total: 0, status: 'idle', errors: [] },
      sortField: 'title',
      sortOrder: 'asc',

      setSortField: (field) => set({ sortField: field }),
      setSortOrder: (order) => set({ sortOrder: order }),
      setScanProgress: (progress) => set({ scanProgress: progress }),

      loadLibrary: async () => {
        set({ isLibraryLoading: true });
        try {
          const dbTracks = await db.tracks.toArray();
          console.log('[Nocturne] Loading library, found', dbTracks.length, 'tracks in DB');
          
          // Use allSettled so one bad track doesn't break everything
          const results = await Promise.allSettled(dbTracks.map(dbTrackToTrack));
          const tracks = results
            .filter((r): r is PromiseFulfilledResult<Track> => r.status === 'fulfilled')
            .map((r) => r.value);
          
          const failedCount = results.filter((r) => r.status === 'rejected').length;
          if (failedCount > 0) {
            console.warn(`[Nocturne] ${failedCount} tracks failed to load`);
          }

          const dbAlbums = await db.albums.toArray();
          const albums: Album[] = [];
          for (const a of dbAlbums) {
            let coverUrl = '';
            try {
              if (a.coverArt) {
                coverUrl = URL.createObjectURL(a.coverArt);
              }
            } catch { /* skip cover */ }
            albums.push({
              id: a.id,
              title: a.title,
              artist: a.artist,
              coverUrl,
              year: a.year,
              trackCount: a.trackCount,
              trackIds: a.trackIds,
            });
          }

          const dbArtists = await db.artists.toArray();
          const artists: Artist[] = dbArtists.map((a) => {
            let imageUrl = '';
            try {
              if (a.imageArt) imageUrl = URL.createObjectURL(a.imageArt);
            } catch { /* skip image */ }
            return {
              id: a.id,
              name: a.name,
              imageUrl,
              trackCount: a.trackCount,
              albumCount: a.albumCount,
            };
          });

          console.log('[Nocturne] Library loaded:', tracks.length, 'tracks,', albums.length, 'albums,', artists.length, 'artists');
          set({ tracks, albums, artists, isLibraryLoading: false });
        } catch (err) {
          console.error('Failed to load library:', err);
          set({ isLibraryLoading: false });
        }
      },

      clearLibrary: async () => {
        await db.tracks.clear();
        await db.albums.clear();
        await db.artists.clear();
        set({ tracks: [], albums: [], artists: [] });
      },

      // --- Playback ---
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      history: [],
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      repeatMode: 'off',
      isShuffled: false,
      isPlayerOpen: false,

      playTrack: async (track, newQueue) => {
        const state = get();
        // Update queue if provided
        if (newQueue) {
          const idx = newQueue.findIndex((t) => t.id === track.id);
          set({ queue: newQueue, queueIndex: idx >= 0 ? idx : 0 });
        } else {
          // Find in current queue
          const idx = state.queue.findIndex((t) => t.id === track.id);
          if (idx >= 0) {
            set({ queueIndex: idx });
          }
        }

        // Add to history
        const history = [track, ...state.history.filter((t) => t.id !== track.id)].slice(0, 200);
        set({ currentTrack: track, isPlaying: false, currentTime: 0, duration: 0, history });

        // Update play count in DB
        db.tracks.update(track.id, {
          playCount: (track.playCount || 0) + 1,
          lastPlayed: Date.now(),
        }).catch(() => {});

        // Add to play history
        db.playHistory.add({ trackId: track.id, playedAt: Date.now() }).catch(() => {});

        // Dynamic accent color
        document.documentElement.style.setProperty('--color-accent', track.color);

        try {
          // Get playable URL
          const playUrl = getFileUrl(track.filePath) ?? track.filePath;
          console.log('[Nocturne] Playing track:', track.title, 'filePath:', track.filePath, 'playUrl:', playUrl);
          if (!playUrl) {
            console.warn('[Nocturne] No playable URL for track:', track.title);
            set({ isPlaying: false });
            return;
          }
          const playableTrack = { ...track, filePath: playUrl };
          await audioEngine.load(playableTrack);
          audioEngine.play();
          set({ isPlaying: true });
        } catch (err) {
          console.error('[Nocturne] Playback error:', err);
          set({ isPlaying: false });
        }
      },

      togglePlay: () => {
        const state = get();
        if (state.isPlaying) {
          audioEngine.pause();
          set({ isPlaying: false });
        } else {
          audioEngine.play();
          set({ isPlaying: true });
        }
      },

      nextTrack: async () => {
        try {
          const { queue, queueIndex, repeatMode, isShuffled } = get();
          if (queue.length === 0) return;

          let nextIndex: number;
          if (repeatMode === 'one') {
            nextIndex = queueIndex;
          } else if (isShuffled) {
            nextIndex = Math.floor(Math.random() * queue.length);
          } else {
            nextIndex = queueIndex + 1;
            if (nextIndex >= queue.length) {
              if (repeatMode === 'all') {
                nextIndex = 0;
              } else {
                set({ isPlaying: false });
                audioEngine.stop();
                return;
              }
            }
          }

          const nextTrack = queue[nextIndex];
          if (nextTrack) {
            set({ queueIndex: nextIndex });
            await get().playTrack(nextTrack);
          }
        } catch (err) {
          console.error('[Nocturne] nextTrack error:', err);
          set({ isPlaying: false });
        }
      },

      prevTrack: async () => {
        try {
          const { queue, queueIndex, currentTime } = get();
          // If more than 3 seconds in, restart current track
          if (currentTime > 3) {
            audioEngine.seek(0);
            set({ currentTime: 0 });
            return;
          }

          if (queue.length === 0) return;
          const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
          const prevTrack = queue[prevIndex];
          if (prevTrack) {
            set({ queueIndex: prevIndex });
            await get().playTrack(prevTrack);
          }
        } catch (err) {
          console.error('[Nocturne] prevTrack error:', err);
          set({ isPlaying: false });
        }
      },

      seekTo: (time) => {
        audioEngine.seek(time);
        set({ currentTime: time });
      },

      setVolume: (volume) => {
        audioEngine.setVolume(volume);
        set({ volume });
      },

      toggleMute: () => {
        const isMuted = !get().isMuted;
        audioEngine.setMuted(isMuted);
        set({ isMuted });
      },

      setPlaybackRate: (rate) => {
        audioEngine.setPlaybackRate(rate);
        set({ playbackRate: rate });
      },

      setRepeatMode: (mode) => set({ repeatMode: mode }),
      toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),
      setPlayerOpen: (open) => set({ isPlayerOpen: open }),

      setQueue: async (tracks, startIndex = 0) => {
        set({ queue: tracks, queueIndex: startIndex });
        if (tracks[startIndex]) {
          await get().playTrack(tracks[startIndex]);
        }
      },

      addToQueue: (track) => {
        set((s) => ({ queue: [...s.queue, track] }));
      },

      playNext: (track) => {
        set((s) => {
          const newQueue = [...s.queue];
          newQueue.splice(s.queueIndex + 1, 0, track);
          return { queue: newQueue };
        });
      },

      removeFromQueue: (index) => {
        set((s) => {
          const newQueue = [...s.queue];
          newQueue.splice(index, 1);
          let newIndex = s.queueIndex;
          if (index < s.queueIndex) newIndex--;
          if (index === s.queueIndex && newIndex >= newQueue.length) {
            newIndex = newQueue.length - 1;
          }
          return { queue: newQueue, queueIndex: newIndex };
        });
      },

      clearQueue: () => set({ queue: [], queueIndex: -1 }),

      // --- Audio Settings ---
      equalizerEnabled: true,
      equalizerPreset: 'Flat',
      equalizerBands: [...DEFAULT_EQ_BANDS],
      crossfadeDuration: 0,
      gaplessPlayback: true,
      customPresets: [],

      setEqualizerEnabled: (enabled) => {
        set({ equalizerEnabled: enabled });
        if (enabled) {
          audioEngine.setEQBands(get().equalizerBands);
        } else {
          audioEngine.resetEQ();
        }
      },

      setEqualizerPreset: (name) => {
        const preset = findPreset(name, get().customPresets);
        if (preset) {
          set({ equalizerPreset: name, equalizerBands: [...preset.bands] });
          if (get().equalizerEnabled) {
            audioEngine.setEQBands(preset.bands);
          }
        }
      },

      setEqualizerBand: (index, value) => {
        const bands = [...get().equalizerBands];
        bands[index] = value;
        set({ equalizerBands: bands, equalizerPreset: 'Custom' });
        if (get().equalizerEnabled) {
          audioEngine.setEQBand(index, value);
        }
      },

      setEqualizerBands: (bands) => {
        set({ equalizerBands: bands });
        if (get().equalizerEnabled) {
          audioEngine.setEQBands(bands);
        }
      },

      setCrossfadeDuration: (duration) => set({ crossfadeDuration: duration }),
      setGaplessPlayback: (enabled) => set({ gaplessPlayback: enabled }),

      saveCustomPreset: (name) => {
        const { equalizerBands, customPresets } = get();
        const id = `custom_${Date.now()}`;
        const newPreset: EQPreset = {
          id,
          name,
          bands: [...equalizerBands],
          isCustom: true,
        };
        set({
          customPresets: [...customPresets, newPreset],
          equalizerPreset: name,
        });
      },

      deleteCustomPreset: (id) => {
        set((s) => ({
          customPresets: s.customPresets.filter((p) => p.id !== id),
        }));
      },

      resetEqualizer: () => {
        set({
          equalizerBands: [...DEFAULT_EQ_BANDS],
          equalizerPreset: 'Flat',
        });
        audioEngine.resetEQ();
      },

      // --- UI ---
      sleepTimerMinutes: null,
      sleepTimerEndTime: null,
      setSleepTimer: (minutes) => {
        set({
          sleepTimerMinutes: minutes,
          sleepTimerEndTime: minutes ? Date.now() + minutes * 60000 : null,
        });
      },
      clearSleepTimer: () => set({ sleepTimerMinutes: null, sleepTimerEndTime: null }),

      // --- Liked Tracks ---
      likedTrackIds: [],
      toggleLike: (trackId) => {
        set((s) => {
          const liked = s.likedTrackIds.includes(trackId)
            ? s.likedTrackIds.filter((id) => id !== trackId)
            : [...s.likedTrackIds, trackId];
          return { likedTrackIds: liked };
        });
      },
      isLiked: (trackId) => get().likedTrackIds.includes(trackId),
    }),
    {
      name: 'nocturne-audio-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist settings, not tracks or playback state
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        equalizerEnabled: state.equalizerEnabled,
        equalizerPreset: state.equalizerPreset,
        equalizerBands: state.equalizerBands,
        crossfadeDuration: state.crossfadeDuration,
        gaplessPlayback: state.gaplessPlayback,
        customPresets: state.customPresets,
        sortField: state.sortField,
        sortOrder: state.sortOrder,
        likedTrackIds: state.likedTrackIds,
      }),
    }
  )
);

// --- Wire up audio engine events ---
audioEngine.on('timeupdate', (currentTime, duration) => {
  useMusicStore.setState({
    currentTime: currentTime as number,
    duration: duration as number,
  });

  // Preload next track at 80% completion
  const state = useMusicStore.getState();
  const dur = duration as number;
  const cur = currentTime as number;
  if (dur > 0 && cur / dur > 0.8 && state.gaplessPlayback) {
    const nextIndex = state.queueIndex + 1;
    if (nextIndex < state.queue.length) {
      const nextTrack = state.queue[nextIndex];
      if (nextTrack) {
        const playUrl = getFileUrl(nextTrack.filePath) ?? nextTrack.filePath;
        audioEngine.preloadNext({ ...nextTrack, filePath: playUrl });
      }
    }
  }
});

audioEngine.on('end', () => {
  const state = useMusicStore.getState();
  const { crossfadeDuration, queue, queueIndex, repeatMode, isShuffled } = state;

  // If crossfade is enabled and next track exists, crossfade
  if (crossfadeDuration > 0) {
    const nextHowl = audioEngine.crossfadeToNext(crossfadeDuration);
    if (nextHowl) {
      // Crossfade already started audio — just advance the store state
      let nextIndex: number;
      if (repeatMode === 'one') {
        nextIndex = queueIndex;
      } else if (isShuffled) {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) nextIndex = repeatMode === 'all' ? 0 : queueIndex;
      }
      const nextTrack = queue[nextIndex];
      if (nextTrack) {
        useMusicStore.setState({ currentTrack: nextTrack, queueIndex: nextIndex, isPlaying: true, currentTime: 0 });
        document.documentElement.style.setProperty('--color-accent', nextTrack.color);
      }
      return;
    }
  }

  // Otherwise, just play next (with error safety)
  state.nextTrack().catch((err) => {
    console.error('[Nocturne] Auto-advance error:', err);
  });
});

audioEngine.on('error', (err) => {
  console.error('[Nocturne] Audio engine error:', err);
  // Auto-skip to next track on error after a brief delay
  setTimeout(() => {
    const state = useMusicStore.getState();
    if (state.queue.length > 0 && state.queueIndex < state.queue.length - 1) {
      console.log('[Nocturne] Auto-skipping to next track after error');
      state.nextTrack().catch(() => {});
    } else {
      useMusicStore.setState({ isPlaying: false });
    }
  }, 500);
});

// Re-apply persisted EQ settings when the audio context connects to a new Howl
audioEngine.on('contextConnected', () => {
  const state = useMusicStore.getState();
  if (state.equalizerEnabled) {
    audioEngine.setEQBands(state.equalizerBands);
  }
});

// Media session handlers
audioEngine.setupMediaSessionHandlers({
  onPlay: () => useMusicStore.getState().togglePlay(),
  onPause: () => useMusicStore.getState().togglePlay(),
  onNextTrack: () => useMusicStore.getState().nextTrack(),
  onPrevTrack: () => useMusicStore.getState().prevTrack(),
  onSeekForward: () => {
    const state = useMusicStore.getState();
    audioEngine.seek(Math.min(state.currentTime + 10, state.duration));
  },
  onSeekBackward: () => {
    const state = useMusicStore.getState();
    audioEngine.seek(Math.max(state.currentTime - 10, 0));
  },
});

// Native notification media controls
import { setupMediaControlsListeners, updateMediaControls, updateIsPlaying } from '../services/mediaControls';

setupMediaControlsListeners({
  onPlay: () => useMusicStore.getState().togglePlay(),
  onPause: () => useMusicStore.getState().togglePlay(),
  onNext: () => useMusicStore.getState().nextTrack(),
  onPrev: () => useMusicStore.getState().prevTrack(),
});

// Keep notification controls in sync with playback state
let prevTrackId: string | null = null;
let prevIsPlaying: boolean | null = null;

useMusicStore.subscribe((state) => {
  const { currentTrack, isPlaying, queue, queueIndex, currentTime, duration } = state;
  if (!currentTrack) return;

  const trackChanged = currentTrack.id !== prevTrackId;
  const playStateChanged = isPlaying !== prevIsPlaying;

  if (trackChanged) {
    prevTrackId = currentTrack.id;
    updateMediaControls({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      cover: currentTrack.coverUrl || '',
      isPlaying,
      hasPrev: queueIndex > 0,
      hasNext: queueIndex < queue.length - 1,
      duration: Math.round(duration),
      elapsed: Math.round(currentTime),
    });
  }

  if (playStateChanged) {
    prevIsPlaying = isPlaying;
    // Re-create notification if it wasn't created yet (e.g. permission was just granted)
    if (!trackChanged) {
      updateMediaControls({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        cover: currentTrack.coverUrl || '',
        isPlaying,
        hasPrev: queueIndex > 0,
        hasNext: queueIndex < queue.length - 1,
        duration: Math.round(duration),
        elapsed: Math.round(currentTime),
      });
    }
    updateIsPlaying(isPlaying);
  }
});

// Initialize audio context on first user interaction
let audioContextInitialized = false;
function initOnInteraction() {
  if (audioContextInitialized) return;
  audioContextInitialized = true;
  audioEngine.initAudioContext();
  document.removeEventListener('click', initOnInteraction);
  document.removeEventListener('touchstart', initOnInteraction);
}
document.addEventListener('click', initOnInteraction);
document.addEventListener('touchstart', initOnInteraction);

// Export built-in presets for UI
export const BUILTIN_EQ_PRESETS = BUILTIN_PRESETS;
