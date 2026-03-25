import Dexie, { type Table } from 'dexie';

export interface DBTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationMs: number;
  coverArt?: Blob;
  color: string;
  filePath: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  bitrate?: number;
  sampleRate?: number;
  format?: string;
  size?: number;
  lastModified?: number;
  lastPlayed?: number;
  playCount: number;
  replayGainTrack?: number;
  replayGainAlbum?: number;
  lyrics?: string;
  addedAt: number;
}

export interface DBAlbum {
  id: string;
  title: string;
  artist: string;
  coverArt?: Blob;
  year: number;
  trackCount: number;
  trackIds: string[];
}

export interface DBArtist {
  id: string;
  name: string;
  imageArt?: Blob;
  trackCount: number;
  albumCount: number;
}

export interface DBPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  isSmartPlaylist: boolean;
  smartRules?: string; // JSON serialized
}

export interface DBSetting {
  key: string;
  value: string;
}

export interface DBQueueItem {
  id?: number;
  trackId: string;
  position: number;
}

export interface DBPlayHistory {
  id?: number;
  trackId: string;
  playedAt: number;
}

class NocturneDatabase extends Dexie {
  tracks!: Table<DBTrack, string>;
  albums!: Table<DBAlbum, string>;
  artists!: Table<DBArtist, string>;
  playlists!: Table<DBPlaylist, string>;
  settings!: Table<DBSetting, string>;
  queue!: Table<DBQueueItem, number>;
  playHistory!: Table<DBPlayHistory, number>;

  constructor() {
    super('NocturneAudio');
    this.version(1).stores({
      tracks: 'id, title, artist, album, genre, year, filePath, lastPlayed, playCount, addedAt',
      albums: 'id, title, artist, year',
      artists: 'id, name',
      playlists: 'id, name, createdAt',
      settings: 'key',
      queue: '++id, trackId, position',
      playHistory: '++id, trackId, playedAt',
    });
  }
}

export const db = new NocturneDatabase();

// Cover art URL cache (WeakMap-like with string keys)
const coverArtCache = new Map<string, string>();

export async function getTrackCoverUrl(trackId: string): Promise<string> {
  const cached = coverArtCache.get(trackId);
  if (cached) return cached;

  const track = await db.tracks.get(trackId);
  if (track?.coverArt) {
    const url = URL.createObjectURL(track.coverArt);
    coverArtCache.set(trackId, url);
    return url;
  }
  return '';
}

export async function getAlbumCoverUrl(albumId: string): Promise<string> {
  const cached = coverArtCache.get(`album_${albumId}`);
  if (cached) return cached;

  const album = await db.albums.get(albumId);
  if (album?.coverArt) {
    const url = URL.createObjectURL(album.coverArt);
    coverArtCache.set(`album_${albumId}`, url);
    return url;
  }
  return '';
}

export function clearCoverArtCache() {
  coverArtCache.forEach((url) => URL.revokeObjectURL(url));
  coverArtCache.clear();
}

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const setting = await db.settings.get(key);
  return setting?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getLibraryStats() {
  const trackCount = await db.tracks.count();
  const albumCount = await db.albums.count();
  const artistCount = await db.artists.count();
  let totalSize = 0;
  await db.tracks.each((track) => {
    totalSize += track.size ?? 0;
  });
  return { trackCount, albumCount, artistCount, totalSize };
}
