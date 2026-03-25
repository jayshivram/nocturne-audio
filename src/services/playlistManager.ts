import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/musicDatabase';
import type { DBPlaylist } from '../db/musicDatabase';
import type { Playlist, SmartPlaylistRule, Track } from '../types';

export async function createPlaylist(name: string, trackIds: string[] = []): Promise<Playlist> {
  const now = Date.now();
  const playlist: DBPlaylist = {
    id: uuidv4(),
    name,
    trackIds,
    createdAt: now,
    updatedAt: now,
    isSmartPlaylist: false,
  };
  await db.playlists.put(playlist);
  return {
    ...playlist,
    isSmartPlaylist: false,
    smartRules: undefined,
  };
}

export async function updatePlaylist(id: string, updates: Partial<Pick<Playlist, 'name' | 'trackIds'>>): Promise<void> {
  await db.playlists.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deletePlaylist(id: string): Promise<void> {
  await db.playlists.delete(id);
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) return;
  if (playlist.trackIds.includes(trackId)) return;
  playlist.trackIds.push(trackId);
  playlist.updatedAt = Date.now();
  await db.playlists.put(playlist);
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) return;
  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
  playlist.updatedAt = Date.now();
  await db.playlists.put(playlist);
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const dbPlaylists = await db.playlists.toArray();
  return dbPlaylists.map((p) => ({
    ...p,
    isSmartPlaylist: p.isSmartPlaylist,
    smartRules: p.smartRules ? JSON.parse(p.smartRules) : undefined,
  }));
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) return [];

  const tracks: Track[] = [];
  for (const trackId of playlist.trackIds) {
    const dbTrack = await db.tracks.get(trackId);
    if (dbTrack) {
      let coverUrl = '';
      if (dbTrack.coverArt) {
        coverUrl = URL.createObjectURL(dbTrack.coverArt);
      }
      tracks.push({
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
        playCount: dbTrack.playCount,
        addedAt: dbTrack.addedAt,
      });
    }
  }
  return tracks;
}

// Smart playlist evaluation
export async function evaluateSmartPlaylist(rules: SmartPlaylistRule[]): Promise<string[]> {
  const allTracks = await db.tracks.toArray();
  const matching = allTracks.filter((track) =>
    rules.every((rule) => matchesRule(track, rule))
  );
  return matching.map((t) => t.id);
}

function matchesRule(track: any, rule: SmartPlaylistRule): boolean {
  const fieldValue = track[rule.field];
  if (fieldValue === undefined || fieldValue === null) return false;

  switch (rule.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(rule.value).toLowerCase();
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'greaterThan':
      return Number(fieldValue) > Number(rule.value);
    case 'lessThan':
      return Number(fieldValue) < Number(rule.value);
    case 'between':
      return Number(fieldValue) >= Number(rule.value) && Number(fieldValue) <= Number(rule.value2 ?? rule.value);
    default:
      return false;
  }
}

// Get recently played tracks from history
export async function getRecentlyPlayed(limit: number = 50): Promise<string[]> {
  const history = await db.playHistory.orderBy('playedAt').reverse().limit(limit).toArray();
  // Deduplicate but maintain order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of history) {
    if (!seen.has(entry.trackId)) {
      seen.add(entry.trackId);
      result.push(entry.trackId);
    }
  }
  return result;
}

// Get most played track IDs
export async function getMostPlayed(limit: number = 50): Promise<string[]> {
  const tracks = await db.tracks.orderBy('playCount').reverse().limit(limit).toArray();
  return tracks.filter((t) => t.playCount > 0).map((t) => t.id);
}

// Export playlist as JSON
export async function exportPlaylist(playlistId: string): Promise<string> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) throw new Error('Playlist not found');

  const tracks = await getPlaylistTracks(playlistId);
  const exportData = {
    name: playlist.name,
    createdAt: playlist.createdAt,
    tracks: tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}
