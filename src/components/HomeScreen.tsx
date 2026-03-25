import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useMusicStore } from '../store/useMusicStore';
import { Play, Settings, Music, ScanLine, Loader2, X } from 'lucide-react';
import { getRecentlyPlayed, getMostPlayed } from '../services/playlistManager';
import { scanAndRegisterFiles } from '../services/fileScanner';

export default function HomeScreen({ onOpenSettings, onNavigate }: { onOpenSettings: () => void; onNavigate?: (screen: string) => void }) {
  const tracks = useMusicStore((s) => s.tracks);
  const albums = useMusicStore((s) => s.albums);
  const playTrack = useMusicStore((s) => s.playTrack);
  const history = useMusicStore((s) => s.history);
  const scanProgress = useMusicStore((s) => s.scanProgress);
  const setScanProgress = useMusicStore((s) => s.setScanProgress);
  const loadLibrary = useMusicStore((s) => s.loadLibrary);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const [mostPlayedIds, setMostPlayedIds] = useState<string[]>([]);
  const [scanDismissed, setScanDismissed] = useState(false);
  
  const hasLibrary = tracks.length > 0;
  const isScanning = scanProgress.status === 'scanning' || scanProgress.status === 'extracting';

  const handleScan = useCallback(async () => {
    setScanDismissed(false);
    try {
      await scanAndRegisterFiles((progress) => {
        setScanProgress(progress);
      });
      await loadLibrary();
    } catch (err) {
      console.error('Scan failed:', err);
      setScanProgress({
        current: 0,
        total: 0,
        status: 'error',
        errors: [String(err)],
      });
    }
  }, [setScanProgress, loadLibrary]);

  useEffect(() => {
    if (hasLibrary) {
      getRecentlyPlayed(20).then(setRecentTrackIds);
      getMostPlayed(20).then(setMostPlayedIds);
    }
  }, [hasLibrary, history.length]);

  const recentTracks = hasLibrary
    ? recentTrackIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean)
    : [];

  const recentAlbums = hasLibrary
    ? albums.slice(0, 8)
    : [];

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Late night vibes';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Late night vibes';
  })();

  return (
    <div className="flex flex-col gap-10 pb-40">
      {/* Header */}
      <header className="px-6 flex items-start justify-between" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            {greeting}, <span className="text-text-secondary">Audiophile</span>
          </h1>
          <p className="text-text-secondary mt-1 font-medium">
            {hasLibrary ? `${tracks.length} tracks in your library` : 'Ready for your nightly symphony?'}
          </p>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-3 rounded-2xl glass hover:bg-white/10 transition-all active:scale-90"
        >
          <Settings className="w-6 h-6 text-text-secondary" />
        </button>
      </header>

      {/* Quick Actions */}
      <section className="px-6 grid grid-cols-2 gap-4">
        <div 
          onClick={() => {
            if (recentTracks.length > 0) {
              const tracks = recentTracks.filter((t): t is NonNullable<typeof t> => t != null);
              if (tracks.length > 0) playTrack(tracks[0], tracks);
            }
          }}
          className="glass p-5 rounded-2xl flex flex-col gap-3 group cursor-pointer active:scale-95 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <span className="font-bold">Recently Played</span>
        </div>
        <div 
          onClick={() => {
            if (hasLibrary && mostPlayedIds.length > 0) {
              const mostPlayed = mostPlayedIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as typeof tracks;
              if (mostPlayed.length > 0) playTrack(mostPlayed[0], mostPlayed);
            }
          }}
          className="glass p-5 rounded-2xl flex flex-col gap-3 group cursor-pointer active:scale-95 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
            <Music className="w-5 h-5" />
          </div>
          <span className="font-bold">Most Played</span>
        </div>
      </section>

      {/* Empty State — No Library */}
      {!hasLibrary && !isScanning && (
        <section className="px-6 flex flex-col items-center gap-6 py-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
            <Music className="w-12 h-12 text-text-secondary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-display font-bold mb-2">No Music Yet</h2>
            <p className="text-text-secondary text-sm max-w-[260px]">
              Scan your device to find and play your local music files
            </p>
          </div>
          <button 
            onClick={handleScan}
            className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-accent/20 active:scale-95 transition-all"
          >
            <ScanLine className="w-5 h-5" />
            Scan Music
          </button>
          
          {/* Show scan errors */}
          {scanProgress.status === 'error' && scanProgress.errors.length > 0 && !scanDismissed && (
            <div className="w-full glass rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-red-400">Scan Error</p>
                <button onClick={() => setScanDismissed(true)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              {scanProgress.errors.map((err, i) => (
                <p key={i} className="text-xs text-text-secondary">{err}</p>
              ))}
            </div>
          )}
          
          {/* Show completion with errors */}
          {scanProgress.status === 'complete' && scanProgress.errors.length > 0 && !scanDismissed && (
            <div className="w-full glass rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-yellow-400">
                  Scan finished with {scanProgress.errors.length} errors
                </p>
                <button onClick={() => setScanDismissed(true)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              <p className="text-xs text-text-secondary">
                {scanProgress.current} files processed. Try granting "All Files Access" in Settings &gt; Apps &gt; Nocturne Audio &gt; Permissions.
              </p>
              <button 
                onClick={handleScan}
                className="mt-2 flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-2 rounded-full font-bold text-xs active:scale-95 transition-all"
              >
                <ScanLine className="w-4 h-4" />
                Retry Scan
              </button>
            </div>
          )}
        </section>
      )}

      {/* Scanning Progress */}
      {isScanning && (
        <section className="px-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <p className="text-sm font-bold">
                {scanProgress.status === 'scanning' ? 'Discovering files...' : 'Reading metadata...'}
              </p>
            </div>
            {scanProgress.total > 0 && (
              <>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-[width] duration-300"
                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-text-secondary font-bold">
                  {scanProgress.current} / {scanProgress.total} files
                </p>
              </>
            )}
          </motion.div>
        </section>
      )}

      {/* Recently Played Horizontal */}
      {recentAlbums.length > 0 && (
      <section className="flex flex-col gap-4">
        <div className="px-6 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold">Recently Played</h2>
          <button onClick={() => onNavigate?.('library')} className="text-xs font-bold text-text-secondary uppercase tracking-widest">View All</button>
        </div>
        <div className="flex overflow-x-auto no-scrollbar gap-6 px-6 pb-4">
          {recentAlbums.map((album) => (
            <motion.div 
              key={album.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const albumTracks = album.trackIds
                  .map((id) => tracks.find((t) => t.id === id))
                  .filter((t): t is NonNullable<typeof t> => t != null);
                if (albumTracks.length > 0) playTrack(albumTracks[0], albumTracks);
              }}
              className="flex-shrink-0 w-40 flex flex-col gap-3 cursor-pointer"
            >
              <div className="aspect-square rounded-2xl overflow-hidden shadow-xl shadow-black/20 bg-surface">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-secondary">
                    <Music className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="px-1">
                <h3 className="font-bold truncate">{album.title}</h3>
                <p className="text-xs text-text-secondary truncate">{album.artist}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      )}

      {/* Your Library */}
      {hasLibrary && (
      <section className="px-6 flex flex-col gap-4">
        <h2 className="text-xl font-display font-bold">Your Library</h2>
        <div className="flex flex-col gap-2">
          {tracks.slice(0, 10).map((track) => (
            <div 
              key={track.id}
              onClick={() => playTrack(track, tracks)}
              className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-surface">
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-secondary">
                    <Music className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold truncate">{track.title}</h4>
                <p className="text-xs text-text-secondary truncate">{track.artist}</p>
              </div>
              <span className="text-[10px] text-text-secondary font-bold tabular-nums">{track.duration}</span>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
