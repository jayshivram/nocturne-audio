import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, ChevronDown, MoreVertical, ListMusic, Mic2, Cast, ListPlus, Share2, Music, X, Plus, Check } from 'lucide-react';
import { useMusicStore } from '../store/useMusicStore';
import { cn } from '../lib/utils';
import type { RepeatMode, Playlist } from '../types';
import { getAllPlaylists, addTrackToPlaylist, createPlaylist } from '../services/playlistManager';
import { Capacitor } from '@capacitor/core';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function FullPlayer() {
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const prevTrack = useMusicStore((s) => s.prevTrack);
  const isPlayerOpen = useMusicStore((s) => s.isPlayerOpen);
  const setPlayerOpen = useMusicStore((s) => s.setPlayerOpen);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const seekTo = useMusicStore((s) => s.seekTo);
  const repeatMode = useMusicStore((s) => s.repeatMode);
  const setRepeatMode = useMusicStore((s) => s.setRepeatMode);
  const isShuffled = useMusicStore((s) => s.isShuffled);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const queue = useMusicStore((s) => s.queue);
  const queueIndex = useMusicStore((s) => s.queueIndex);
  const playTrack = useMusicStore((s) => s.playTrack);
  const toggleLike = useMusicStore((s) => s.toggleLike);
  const likedTrackIds = useMusicStore((s) => s.likedTrackIds);
  const addToQueue = useMusicStore((s) => s.addToQueue);
  const playNext = useMusicStore((s) => s.playNext);

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [playlistAddedId, setPlaylistAddedId] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Load playlists when picker opens
  useEffect(() => {
    if (showPlaylistPicker) {
      getAllPlaylists().then(setPlaylists);
    }
  }, [showPlaylistPicker]);

  const cycleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  }, [repeatMode, setRepeatMode]);

  const handleShare = useCallback(async () => {
    if (!currentTrack) return;
    const shareData = { title: currentTrack.title, text: `${currentTrack.title} by ${currentTrack.artist}`, dialogTitle: 'Share Track' };
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share(shareData);
      } catch { /* user cancelled or plugin unavailable */ }
    } else if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    }
  }, [currentTrack]);

  const handleAddToPlaylist = useCallback(async (playlistId: string) => {
    if (!currentTrack) return;
    await addTrackToPlaylist(playlistId, currentTrack.id);
    setPlaylistAddedId(playlistId);
    setTimeout(() => {
      setPlaylistAddedId(null);
      setShowPlaylistPicker(false);
      setShowMoreMenu(false);
    }, 800);
  }, [currentTrack]);

  const handleCreateAndAdd = useCallback(async () => {
    if (!currentTrack || !newPlaylistName.trim()) return;
    const pl = await createPlaylist(newPlaylistName.trim(), [currentTrack.id]);
    setPlaylistAddedId(pl.id);
    setNewPlaylistName('');
    setShowNewPlaylistInput(false);
    setTimeout(() => {
      setPlaylistAddedId(null);
      setShowPlaylistPicker(false);
      setShowMoreMenu(false);
    }, 800);
  }, [currentTrack, newPlaylistName]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !duration) return;
    setIsSeeking(true);
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekValue(percent * duration);
  }, [duration]);

  const handleProgressMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSeeking || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekValue(percent * duration);
  }, [isSeeking, duration]);

  const handleProgressMouseUp = useCallback(() => {
    if (isSeeking) {
      seekTo(seekValue);
      setIsSeeking(false);
    }
  }, [isSeeking, seekValue, seekTo]);

  const handleProgressTouch = useCallback((e: React.TouchEvent) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    const time = percent * duration;
    setIsSeeking(true);
    setSeekValue(time);
  }, [duration]);

  const handleProgressTouchEnd = useCallback(() => {
    if (isSeeking) {
      seekTo(seekValue);
      setIsSeeking(false);
    }
  }, [isSeeking, seekValue, seekTo]);

  if (!currentTrack) return null;

  const displayTime = isSeeking ? seekValue : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
          style={{ willChange: 'transform' }}
          onMouseUp={handleProgressMouseUp}
          onMouseLeave={handleProgressMouseUp}
        >
          {/* Immersive Blurred Background */}
          {currentTrack.coverUrl && (
            <div 
              className="absolute inset-0 z-0 scale-110"
              style={{
                backgroundImage: `url(${currentTrack.coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(80px) brightness(0.3)',
              }}
            />
          )}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 via-background/60 to-background" />

          {/* Header */}
          <header className="relative z-10 flex items-center justify-between px-6 pb-4 shrink-0" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <button 
              onClick={() => setPlayerOpen(false)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-surface/60 border border-white/[0.03] shadow-md backdrop-blur-2xl hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-6 h-6 text-white" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center pointer-events-none">
              <span className="text-[9px] uppercase tracking-[0.2em] text-text-secondary font-bold mb-0.5">Playing from Album</span>
              <span className="text-xs font-bold text-white truncate max-w-[180px]">{currentTrack.album}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowQueue(!showQueue)}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full bg-surface/60 border border-white/[0.03] shadow-md backdrop-blur-2xl hover:bg-white/10 transition-colors",
                  showQueue ? "text-accent" : "text-white"
                )}
              >
                <ListMusic className="w-4 h-4" />
              </button>
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="flex items-center justify-center w-10 h-10 rounded-full bg-surface/60 border border-white/[0.03] shadow-md backdrop-blur-2xl hover:bg-white/10 transition-colors text-white">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Album Art, Queue, or Lyrics */}
          <main className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-6 sm:px-12 w-full">
            {showLyrics ? (
              <div className="w-full h-full overflow-y-auto no-scrollbar py-4 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest">Lyrics</h3>
                  <button onClick={() => setShowLyrics(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-text-secondary" /></button>
                </div>
                {currentTrack.lyrics ? (
                  <p className="text-base text-white/90 whitespace-pre-wrap leading-relaxed text-center font-medium">{currentTrack.lyrics}</p>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Mic2 className="w-12 h-12 text-text-secondary/50" />
                    <p className="text-text-secondary text-sm">No lyrics available for this track</p>
                  </div>
                )}
              </div>
            ) : showQueue ? (
              <div className="w-full h-full overflow-y-auto no-scrollbar py-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">Up Next ({queue.length - queueIndex - 1} tracks)</h3>
                <div className="flex flex-col gap-1">
                  {queue.slice(queueIndex + 1, queueIndex + 21).map((track, i) => (
                    <div key={`${track.id}-${i}`} onClick={() => {
                      const actualIndex = queueIndex + 1 + i;
                      playTrack(track);
                      useMusicStore.setState({ queueIndex: actualIndex });
                    }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer active:scale-[0.98] transition-transform">
                      <span className="text-xs text-text-secondary font-bold w-6 text-right">{i + 1}</span>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                        {track.coverUrl ? (
                          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary"><Music className="w-4 h-4" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{track.title}</p>
                        <p className="text-[10px] text-text-secondary truncate">{track.artist}</p>
                      </div>
                      <span className="text-[10px] text-text-secondary font-bold">{track.duration}</span>
                    </div>
                  ))}
                  {queue.length - queueIndex - 1 === 0 && (
                    <p className="text-center text-text-secondary text-sm py-8">Queue is empty</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full max-w-[400px] max-h-[400px] flex items-center justify-center">
                <div 
                  className="absolute inset-0 rounded-full blur-3xl opacity-30 transition-opacity duration-1000"
                  style={{ backgroundColor: currentTrack.color }}
                />
                <motion.div 
                  layoutId="player-art"
                  className="relative aspect-square h-full max-w-full rounded-[2rem] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-white/[0.05] bg-surface"
                  style={{ transform: isPlaying ? 'scale(1)' : 'scale(0.92)', transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                >
                  {currentTrack.coverUrl ? (
                    <img 
                      src={currentTrack.coverUrl} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                      <Music className="w-24 h-24" />
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </main>

          {/* Bottom Controls Area */}
          <div className="relative z-10 px-6 flex flex-col gap-4 w-full shrink-0" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            
            {/* Track Info & Action Row */}
            <div className="flex flex-col gap-1">
              <div className="flex items-end justify-between">
                <div className="flex flex-col min-w-0 pr-4">
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold leading-tight text-white tracking-tight truncate">
                    {currentTrack.title}
                  </h1>
                  <h2 className="text-sm sm:text-base font-medium text-text-secondary truncate mt-0.5">
                    {currentTrack.artist}
                  </h2>
                </div>
              </div>

              {/* Action Row */}
              <div className="flex items-center justify-between px-1 py-2">
                <button 
                  onClick={() => currentTrack && toggleLike(currentTrack.id)}
                  className={cn("flex items-center justify-center p-2 rounded-full transition-colors active:scale-90", isLiked ? "text-red-500" : "text-white/70 hover:text-white")}
                >
                  <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                </button>
                <button onClick={() => currentTrack && addToQueue(currentTrack)} className="flex items-center justify-center p-2 rounded-full text-white/70 hover:text-white transition-colors active:scale-90">
                  <ListPlus className="w-6 h-6" />
                </button>
                <button onClick={handleShare} className="flex items-center justify-center p-2 rounded-full text-white/70 hover:text-white transition-colors active:scale-90">
                  <Share2 className="w-6 h-6" />
                </button>
                <button onClick={() => { setShowLyrics(!showLyrics); setShowQueue(false); }} className={cn("flex items-center justify-center p-2 rounded-full transition-colors active:scale-90", showLyrics ? "text-accent" : "text-white/70 hover:text-white")}>
                  <Mic2 className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
              <div 
                ref={progressRef}
                className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                onMouseDown={handleProgressMouseDown}
                onMouseMove={handleProgressMouseMove}
                onTouchStart={handleProgressTouch}
                onTouchMove={handleProgressTouch}
                onTouchEnd={handleProgressTouchEnd}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-white rounded-full"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-text-secondary">
                <span>{formatTime(displayTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="flex items-center justify-between w-full px-1">
              <button 
                onClick={toggleShuffle}
                className={cn("transition-colors", isShuffled ? "text-accent" : "text-text-secondary hover:text-white")}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-6">
                <button 
                  onClick={prevTrack}
                  className="text-white hover:text-accent transition-colors active:scale-90"
                >
                  <SkipBack className="w-8 h-8 fill-current" />
                </button>
                <button 
                  onClick={togglePlay}
                  className="flex items-center justify-center w-16 h-16 rounded-full bg-white text-background shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </button>
                <button 
                  onClick={nextTrack}
                  className="text-white hover:text-accent transition-colors active:scale-90"
                >
                  <SkipForward className="w-8 h-8 fill-current" />
                </button>
              </div>
              <button 
                onClick={cycleRepeat}
                className={cn("transition-colors", repeatMode !== 'off' ? "text-accent" : "text-text-secondary hover:text-white")}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Home Indicator Pill */}
            <div className="w-full flex justify-center mt-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
          </div>

          {/* More Menu Overlay */}
          <AnimatePresence>
            {showMoreMenu && currentTrack && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-black/60 flex items-end"
                onClick={() => setShowMoreMenu(false)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="w-full glass rounded-t-3xl p-6 flex flex-col gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                      {currentTrack.coverUrl ? (
                        <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary"><Music className="w-5 h-5" /></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{currentTrack.title}</p>
                      <p className="text-xs text-text-secondary truncate">{currentTrack.artist}</p>
                    </div>
                  </div>
                  <button onClick={() => { playNext(currentTrack); setShowMoreMenu(false); }} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Play Next</button>
                  <button onClick={() => { addToQueue(currentTrack); setShowMoreMenu(false); }} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Add to Queue</button>
                  <button onClick={() => setShowPlaylistPicker(true)} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Add to Playlist</button>
                  <button onClick={() => { toggleLike(currentTrack.id); setShowMoreMenu(false); }} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">
                    {isLiked ? 'Remove from Liked' : 'Add to Liked'}
                  </button>
                  <button onClick={() => { handleShare(); setShowMoreMenu(false); }} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Share</button>
                  <button onClick={() => setShowMoreMenu(false)} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 text-text-secondary transition-colors mt-1">Cancel</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Playlist Picker Overlay */}
          <AnimatePresence>
            {showPlaylistPicker && currentTrack && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 bg-black/60 flex items-end"
                onClick={() => { setShowPlaylistPicker(false); setShowNewPlaylistInput(false); }}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="w-full glass rounded-t-3xl p-6 flex flex-col gap-1 max-h-[60vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Add to Playlist</p>
                  
                  {/* Create new playlist */}
                  {showNewPlaylistInput ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="Playlist name..."
                        autoFocus
                        className="flex-1 h-10 bg-surface/60 border border-white/[0.03] rounded-xl px-3 focus:border-accent/50 outline-none text-sm font-bold"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                      />
                      <button onClick={handleCreateAndAdd} className="h-10 px-4 bg-accent rounded-xl text-sm font-bold">Add</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewPlaylistInput(true)} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors flex items-center gap-3 text-accent">
                      <Plus className="w-5 h-5" /> Create New Playlist
                    </button>
                  )}

                  <div className="overflow-y-auto no-scrollbar flex-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => handleAddToPlaylist(pl.id)}
                        className="w-full px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between"
                      >
                        <span className="truncate">{pl.name}</span>
                        {playlistAddedId === pl.id && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      </button>
                    ))}
                    {playlists.length === 0 && !showNewPlaylistInput && (
                      <p className="text-sm text-text-secondary py-4 text-center">No playlists yet</p>
                    )}
                  </div>

                  <button onClick={() => { setShowPlaylistPicker(false); setShowNewPlaylistInput(false); }} className="px-4 py-3 text-sm font-bold text-left rounded-xl hover:bg-white/10 text-text-secondary transition-colors mt-1">Cancel</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
