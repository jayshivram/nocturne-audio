import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMusicStore } from '../store/useMusicStore';
import { LibraryTab } from '../types';
import { Search, Filter, MoreVertical, Folder, Settings, Music, ScanLine, X, Loader2, ArrowUpDown, ChevronLeft, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { scanAndRegisterFiles, cancelScan } from '../services/fileScanner';

export default function LibraryScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ track: typeof tracks[0]; x: number; y: number } | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [scanDismissed, setScanDismissed] = useState(false);

  const tracks = useMusicStore((s) => s.tracks);
  const albums = useMusicStore((s) => s.albums);
  const artists = useMusicStore((s) => s.artists);
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const playTrack = useMusicStore((s) => s.playTrack);
  const scanProgress = useMusicStore((s) => s.scanProgress);
  const setScanProgress = useMusicStore((s) => s.setScanProgress);
  const loadLibrary = useMusicStore((s) => s.loadLibrary);
  const sortField = useMusicStore((s) => s.sortField);
  const sortOrder = useMusicStore((s) => s.sortOrder);
  const setSortField = useMusicStore((s) => s.setSortField);
  const setSortOrder = useMusicStore((s) => s.setSortOrder);
  const addToQueue = useMusicStore((s) => s.addToQueue);
  const playNext = useMusicStore((s) => s.playNext);

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

  const handleCancelScan = useCallback(() => {
    cancelScan();
  }, []);

  // Filtered & sorted tracks
  const filteredTracks = useMemo(() => {
    let result = [...tracks];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tracks, searchQuery, sortField, sortOrder]);

  const filteredAlbums = useMemo(() => {
    if (!searchQuery) return albums;
    const q = searchQuery.toLowerCase();
    return albums.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, searchQuery]);

  const filteredArtists = useMemo(() => {
    if (!searchQuery) return artists;
    const q = searchQuery.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, searchQuery]);

  const tabs: { id: LibraryTab; label: string }[] = [
    { id: 'songs', label: 'Songs' },
    { id: 'albums', label: 'Albums' },
    { id: 'artists', label: 'Artists' },
    { id: 'folders', label: 'Folders' },
  ];

  // Derive folders from tracks
  const folders = useMemo(() => {
    const folderMap = new Map<string, number>();
    tracks.forEach((t) => {
      if (!t.filePath) return;
      const parts = t.filePath.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
      folderMap.set(folder, (folderMap.get(folder) || 0) + 1);
    });
    return Array.from(folderMap.entries()).map(([path, count]) => ({
      path,
      name: path.split('/').pop() || path,
      count,
    }));
  }, [tracks]);

  return (
    <div className="flex flex-col h-full pb-40">
      {/* Header */}
      <header className="px-6 flex flex-col gap-6" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Library</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSearch(!showSearch)} 
              className="p-2 rounded-full glass"
            >
              {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
            <button onClick={() => setShowSortMenu(true)} className="p-2 rounded-full glass hover:bg-white/10 transition-all active:scale-90">
              <ArrowUpDown className="w-5 h-5" />
            </button>
            <button onClick={handleScan} disabled={isScanning} className="p-2 rounded-full glass hover:bg-white/10 transition-all active:scale-90">
              {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
            </button>
            <button 
              onClick={onOpenSettings}
              className="p-2 rounded-full glass hover:bg-white/10 transition-all active:scale-90"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your library..."
              autoFocus
              className="w-full h-12 bg-surface/60 border border-white/[0.03] rounded-xl pl-4 pr-4 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 outline-none transition-all font-bold text-sm"
            />
          </motion.div>
        )}

        {/* Scan Progress */}
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {scanProgress.status === 'scanning' ? 'Discovering files...' : 'Extracting metadata...'}
              </p>
              <button onClick={handleCancelScan} className="text-xs text-red-400 font-bold">Cancel</button>
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
            {scanProgress.currentFile && (
              <p className="text-[10px] text-text-secondary truncate">{scanProgress.currentFile}</p>
            )}
          </motion.div>
        )}

        {/* Scan Complete */}
        {scanProgress.status === 'complete' && scanProgress.total > 0 && !scanDismissed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">✓</div>
            <div className="flex-1">
              <p className="text-sm font-bold">Scan complete! Processed {scanProgress.total} files.</p>
              {scanProgress.errors.length > 0 && (
                <p className="text-[10px] text-yellow-400">{scanProgress.errors.length} files had errors</p>
              )}
            </div>
            <button onClick={() => setScanDismissed(true)} className="p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          </motion.div>
        )}

        {/* Scan Error */}
        {scanProgress.status === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">✗</div>
            <div>
              <p className="text-sm font-bold text-red-400">Scan failed</p>
              {scanProgress.errors[0] && (
                <p className="text-[10px] text-text-secondary">{scanProgress.errors[0]}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <nav className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white text-background shadow-lg shadow-white/10" 
                  : "text-text-secondary hover:text-white/70"
              )}
            >
              {tab.label}
              {activeTab === tab.id && hasLibrary && tab.id === 'songs' && (
                <span className="ml-1 text-xs opacity-70">({filteredTracks.length})</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="mt-6 px-4 overflow-y-auto flex-1 no-scrollbar">
        {activeTab === 'songs' && (
          <div className="flex flex-col gap-1">
            {!hasLibrary && !isScanning && (
              <div className="text-center py-12 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Music className="w-8 h-8 text-text-secondary" />
                </div>
                <div>
                  <p className="text-text-secondary font-medium">No music scanned yet</p>
                  <p className="text-xs text-text-secondary/70 mt-1">Tap the scan button to add your music</p>
                </div>
                <button onClick={handleScan} className="bg-accent text-white px-6 py-2.5 rounded-full font-bold text-sm mt-2">
                  Scan Music
                </button>
              </div>
            )}
            {filteredTracks.map((track) => (
              <div 
                key={track.id}
                onClick={() => playTrack(track, filteredTracks)}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer active:scale-[0.98]",
                  currentTrack?.id === track.id ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative bg-surface">
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                      <Music className="w-6 h-6" />
                    </div>
                  )}
                  {currentTrack?.id === track.id && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-1 bg-white h-full animate-pulse" />
                        <div className="w-1 bg-white h-1/2 animate-pulse" />
                        <div className="w-1 bg-white h-3/4 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn("font-bold truncate", currentTrack?.id === track.id && "text-white")}>
                    {track.title}
                  </h4>
                  <p className="text-xs text-text-secondary truncate">{track.artist}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-text-secondary font-bold tabular-nums">{track.duration}</span>
                  <button className="p-1 text-text-secondary hover:text-white" onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ track, x: e.clientX, y: e.clientY });
                  }}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="grid grid-cols-2 gap-6 px-2">
            {filteredAlbums.map((album) => (
              <motion.div 
                key={album.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const albumTracks = album.trackIds
                    .map((id) => tracks.find((t) => t.id === id))
                    .filter((t): t is NonNullable<typeof t> => t != null);
                  if (albumTracks.length > 0) playTrack(albumTracks[0], albumTracks);
                }}
                className="flex flex-col gap-3 cursor-pointer"
              >
                <div className="aspect-square rounded-2xl overflow-hidden shadow-xl bg-surface">
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
        )}

        {activeTab === 'artists' && (
          <div className="flex flex-col gap-4">
            {filteredArtists.map((artist) => (
              <div key={artist.id} onClick={() => {
                const artistTracks = tracks.filter((t) => t.artist === artist.name);
                if (artistTracks.length > 0) playTrack(artistTracks[0], artistTracks);
              }} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 cursor-pointer">
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-surface">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                      <Music className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold">{artist.name}</h4>
                  <p className="text-xs text-text-secondary">{artist.trackCount} Tracks · {artist.albumCount} Albums</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="flex flex-col gap-2">
            {selectedFolder && (
              <button onClick={() => setSelectedFolder(null)} className="flex items-center gap-2 px-2 py-3 text-sm font-bold text-accent">
                <ChevronLeft className="w-4 h-4" /> Back to Folders
              </button>
            )}
            {selectedFolder ? (
              // Show tracks in selected folder
              tracks.filter((t) => {
                const parts = t.filePath.split('/');
                const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
                return folder === selectedFolder;
              }).map((track) => (
                <div
                  key={track.id}
                  onClick={() => {
                    const folderTracks = tracks.filter((t) => {
                      const parts = t.filePath.split('/');
                      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
                      return folder === selectedFolder;
                    });
                    playTrack(track, folderTracks);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer active:scale-[0.98]",
                    currentTrack?.id === track.id ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary"><Music className="w-5 h-5" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold truncate text-sm">{track.title}</h4>
                    <p className="text-[10px] text-text-secondary truncate">{track.artist}</p>
                  </div>
                  <span className="text-[10px] text-text-secondary font-bold tabular-nums">{track.duration}</span>
                </div>
              ))
            ) : folders.length > 0 ? (
              folders.map((folder) => (
                <div key={folder.path} onClick={() => setSelectedFolder(folder.path)} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">{folder.name}</h4>
                    <p className="text-xs text-text-secondary">{folder.count} tracks</p>
                  </div>
                  <Play className="w-4 h-4 text-text-secondary" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-secondary text-sm">No folders found. Scan music first.</div>
            )}
          </div>
        )}
      </main>

      {/* Context Menu Overlay */}
      <AnimatePresence>
        {contextMenu && (
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setContextMenu(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute glass rounded-2xl p-2 w-52 flex flex-col shadow-2xl"
              style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="px-3 py-2 text-xs font-bold text-text-secondary truncate">{contextMenu.track.title}</p>
              <button onClick={() => { playNext(contextMenu.track); setContextMenu(null); }} className="px-3 py-2.5 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Play Next</button>
              <button onClick={() => { addToQueue(contextMenu.track); setContextMenu(null); }} className="px-3 py-2.5 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors">Add to Queue</button>
              <button onClick={() => setContextMenu(null)} className="px-3 py-2.5 text-sm font-bold text-left rounded-xl hover:bg-white/10 text-text-secondary transition-colors">Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sort Menu Overlay */}
      <AnimatePresence>
        {showSortMenu && (
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setShowSortMenu(false)}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-20 left-4 right-4 glass rounded-2xl p-4 flex flex-col gap-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">Sort By</p>
              {([['title', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['duration', 'Duration'], ['addedAt', 'Date Added'], ['playCount', 'Play Count']] as const).map(([field, label]) => (
                <button
                  key={field}
                  onClick={() => {
                    if (sortField === field) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(field);
                      setSortOrder('asc');
                    }
                    setShowSortMenu(false);
                  }}
                  className={cn(
                    "px-3 py-2.5 text-sm font-bold text-left rounded-xl hover:bg-white/10 transition-colors flex justify-between",
                    sortField === field ? "text-accent" : "text-white"
                  )}
                >
                  {label}
                  {sortField === field && <span className="text-xs text-text-secondary">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
