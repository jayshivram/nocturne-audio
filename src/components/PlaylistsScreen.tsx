import React, { useState, useEffect, useMemo } from 'react';
import { Heart, ListMusic, Plus, Music, Play, Trash2 } from 'lucide-react';
import { useMusicStore } from '../store/useMusicStore';
import { cn } from '../lib/utils';
import { getAllPlaylists, createPlaylist, deletePlaylist, addTrackToPlaylist } from '../services/playlistManager';
import type { Playlist } from '../types';

export default function PlaylistsScreen() {
  const tracks = useMusicStore((s) => s.tracks);
  const likedTrackIds = useMusicStore((s) => s.likedTrackIds);
  const playTrack = useMusicStore((s) => s.playTrack);
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const toggleLike = useMusicStore((s) => s.toggleLike);

  const [activeTab, setActiveTab] = useState<'liked' | 'playlists'>('liked');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const likedTracks = useMemo(() => {
    return likedTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t != null);
  }, [likedTrackIds, tracks]);

  useEffect(() => {
    getAllPlaylists().then(setPlaylists);
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const pl = await createPlaylist(newPlaylistName.trim());
    setPlaylists((prev) => [...prev, pl]);
    setNewPlaylistName('');
    setShowCreateDialog(false);
  };

  const handleDeletePlaylist = async (id: string) => {
    await deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
  };

  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    return selectedPlaylist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t != null);
  }, [selectedPlaylist, tracks]);

  return (
    <div className="flex flex-col gap-6 pb-40">
      <header className="px-6 flex flex-col gap-4" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <h1 className="text-3xl font-display font-extrabold tracking-tight">Favorites</h1>
        <div className="flex gap-3">
          <button
            onClick={() => { setActiveTab('liked'); setSelectedPlaylist(null); }}
            className={cn(
              "px-5 py-2 rounded-full font-bold text-sm transition-all",
              activeTab === 'liked' ? "bg-white text-background shadow-lg" : "text-text-secondary"
            )}
          >
            <Heart className="w-4 h-4 inline mr-1.5" />
            Liked ({likedTracks.length})
          </button>
          <button
            onClick={() => { setActiveTab('playlists'); setSelectedPlaylist(null); }}
            className={cn(
              "px-5 py-2 rounded-full font-bold text-sm transition-all",
              activeTab === 'playlists' ? "bg-white text-background shadow-lg" : "text-text-secondary"
            )}
          >
            <ListMusic className="w-4 h-4 inline mr-1.5" />
            Playlists ({playlists.length})
          </button>
        </div>
      </header>

      <main className="px-4">
        {activeTab === 'liked' && (
          <div className="flex flex-col gap-1">
            {likedTracks.length > 0 && (
              <button
                onClick={() => { if (likedTracks.length > 0) playTrack(likedTracks[0], likedTracks); }}
                className="mx-2 mb-4 flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg shadow-accent/20 active:scale-95 transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                Play All
              </button>
            )}
            {likedTracks.length === 0 && (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <Heart className="w-12 h-12 text-text-secondary/30" />
                <p className="text-text-secondary text-sm">No liked tracks yet</p>
                <p className="text-text-secondary/70 text-xs">Tap the heart icon on any track to add it here</p>
              </div>
            )}
            {likedTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, likedTracks)}
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
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                  className="p-2 text-red-500 active:scale-90"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'playlists' && !selectedPlaylist && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold">Create New Playlist</span>
            </button>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylist(pl)}
                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                  <ListMusic className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold">{pl.name}</h4>
                  <p className="text-xs text-text-secondary">{pl.trackIds.length} tracks</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                  className="p-2 text-text-secondary hover:text-red-400 active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {playlists.length === 0 && (
              <p className="text-center text-text-secondary text-sm py-8">No playlists yet. Create one to get started.</p>
            )}
          </div>
        )}

        {activeTab === 'playlists' && selectedPlaylist && (
          <div className="flex flex-col gap-2">
            <button onClick={() => setSelectedPlaylist(null)} className="text-sm font-bold text-accent px-2 py-2 self-start">
              ← Back to Playlists
            </button>
            <h2 className="text-xl font-display font-bold px-2">{selectedPlaylist.name}</h2>
            {playlistTracks.length > 0 && (
              <button
                onClick={() => playTrack(playlistTracks[0], playlistTracks)}
                className="mx-2 mb-2 flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg shadow-accent/20 active:scale-95 transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                Play All
              </button>
            )}
            {playlistTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, playlistTracks)}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer active:scale-[0.98] transition-all"
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
                <span className="text-[10px] text-text-secondary font-bold">{track.duration}</span>
              </div>
            ))}
            {playlistTracks.length === 0 && (
              <p className="text-center text-text-secondary text-sm py-8">This playlist is empty</p>
            )}
          </div>
        )}
      </main>

      {/* Create Playlist Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6" onClick={() => setShowCreateDialog(false)}>
          <div
            className="glass rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-bold">New Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name"
              autoFocus
              maxLength={50}
              className="w-full h-12 bg-surface/60 border border-white/[0.03] rounded-xl pl-4 pr-4 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 outline-none transition-all font-bold text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateDialog(false)} className="flex-1 h-12 glass rounded-xl font-bold">Cancel</button>
              <button onClick={handleCreatePlaylist} className="flex-1 h-12 bg-accent rounded-xl font-bold text-white">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
