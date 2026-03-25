import React, { useState, useMemo } from 'react';
import { Search as SearchIcon, X, Clock, Music } from 'lucide-react';
import { useMusicStore } from '../store/useMusicStore';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const tracks = useMusicStore((s) => s.tracks);
  const albums = useMusicStore((s) => s.albums);
  const artists = useMusicStore((s) => s.artists);
  const playTrack = useMusicStore((s) => s.playTrack);
  const history = useMusicStore((s) => s.history);

  const hasLibrary = tracks.length > 0;
  const searchPool = tracks;

  const filteredTracks = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return searchPool.filter(
      (track) =>
        track.title.toLowerCase().includes(q) ||
        track.artist.toLowerCase().includes(q) ||
        track.album.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [searchPool, query]);

  const filteredAlbums = useMemo(() => {
    if (!query || !hasLibrary) return [];
    const q = query.toLowerCase();
    return albums.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [albums, query, hasLibrary]);

  const filteredArtists = useMemo(() => {
    if (!query || !hasLibrary) return [];
    const q = query.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 10);
  }, [artists, query, hasLibrary]);

  const recentSearches = useMemo(() => {
    return history.slice(0, 5).map((t) => t.artist);
  }, [history]);

  return (
    <div className="flex flex-col gap-6 pb-40">
      <header className="px-6 flex flex-col gap-6" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <h1 className="text-3xl font-display font-extrabold tracking-tight">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, or albums"
            className="w-full h-14 bg-surface/60 border border-white/[0.03] shadow-inner rounded-2xl pl-12 pr-12 focus:bg-surface/80 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 outline-none transition-all font-bold"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="px-6">
        {!query ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              {recentSearches.length > 0 ? 'Recent Artists' : 'Recent Searches'}
            </h2>
            <div className="flex flex-col gap-4">
              {(recentSearches.length > 0 ? [...new Set(recentSearches)] : ['Synthwave', 'Lofi Hip Hop', 'Etheric Drift']).map((s) => (
                <div 
                  key={s} 
                  onClick={() => setQuery(s)}
                  className="flex items-center gap-4 text-text-secondary hover:text-white cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{s}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Artists section */}
            {filteredArtists.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Artists</h3>
                {filteredArtists.map((artist) => (
                  <div key={artist.id} onClick={() => {
                    const artistTracks = tracks.filter((t) => t.artist === artist.name);
                    if (artistTracks.length > 0) playTrack(artistTracks[0], artistTracks);
                  }} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 cursor-pointer">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex-shrink-0">
                      {artist.imageUrl ? (
                        <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary"><Music className="w-5 h-5" /></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{artist.name}</h4>
                      <p className="text-[10px] text-text-secondary">{artist.trackCount} tracks</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Albums section */}
            {filteredAlbums.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Albums</h3>
                {filteredAlbums.map((album) => (
                  <div key={album.id} onClick={() => {
                    const albumTracks = album.trackIds
                      .map((id) => tracks.find((t) => t.id === id))
                      .filter((t): t is NonNullable<typeof t> => t != null);
                    if (albumTracks.length > 0) playTrack(albumTracks[0], albumTracks);
                  }} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 cursor-pointer">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary"><Music className="w-5 h-5" /></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{album.title}</h4>
                      <p className="text-[10px] text-text-secondary">{album.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tracks section */}
            <div className="flex flex-col gap-2">
              {(filteredArtists.length > 0 || filteredAlbums.length > 0) && filteredTracks.length > 0 && (
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Songs</h3>
              )}
              {filteredTracks.map((track) => (
                <div 
                  key={track.id}
                  onClick={() => playTrack(track, filteredTracks)}
                  className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer"
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
                </div>
              ))}
              {filteredTracks.length === 0 && filteredAlbums.length === 0 && filteredArtists.length === 0 && (
                <div className="py-20 text-center text-text-secondary">
                  No results found for "{query}"
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
