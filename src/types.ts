export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationMs: number;
  coverUrl: string;
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

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: number;
  trackCount: number;
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  trackCount: number;
  albumCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  isSmartPlaylist: boolean;
  smartRules?: SmartPlaylistRule[];
}

export interface SmartPlaylistRule {
  field: 'genre' | 'year' | 'artist' | 'album' | 'playCount' | 'addedAt' | 'lastPlayed';
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: string | number;
  value2?: number;
}

export interface Folder {
  path: string;
  name: string;
  trackCount: number;
  isExcluded: boolean;
}

export interface ScanProgress {
  current: number;
  total: number;
  status: 'idle' | 'scanning' | 'extracting' | 'complete' | 'error' | 'cancelled';
  currentFile?: string;
  errors: string[];
}

export interface EQPreset {
  id: string;
  name: string;
  bands: number[];
  isCustom: boolean;
}

export type Screen = 'home' | 'library' | 'search' | 'equalizer' | 'playlists' | 'settings';
export type LibraryTab = 'songs' | 'albums' | 'artists' | 'folders';
export type RepeatMode = 'off' | 'all' | 'one';
export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'addedAt' | 'playCount';
export type SortOrder = 'asc' | 'desc';
