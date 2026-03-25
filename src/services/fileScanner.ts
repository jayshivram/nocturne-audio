import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { parseBlob } from 'music-metadata-browser';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/musicDatabase';
import type { DBTrack, DBAlbum, DBArtist } from '../db/musicDatabase';
import type { ScanProgress } from '../types';

// Native plugin for Android MANAGE_EXTERNAL_STORAGE permission
interface StoragePermissionPlugin {
  check(): Promise<{ granted: boolean }>;
  request(): Promise<{ error?: string }>;
}

const StoragePermission = registerPlugin<StoragePermissionPlugin>('StoragePermission');

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'flac', 'm4a', 'wav', 'ogg', 'opus', 'aac', 'wma', 'webm',
]);

const ACCENT_COLORS = [
  '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B',
  '#6366F1', '#EF4444', '#14B8A6', '#F97316', '#A855F7',
];

function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.has(ext);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateAlbumId(title: string, artist: string): string {
  return `album_${(title + '_' + artist).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function generateArtistId(name: string): string {
  return `artist_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

let scanCancelled = false;

export function cancelScan() {
  scanCancelled = true;
}

/**
 * Scan for music files. On native (Capacitor), uses Filesystem API.
 * On web, uses File System Access API (showDirectoryPicker).
 */
export async function scanMusicFiles(onProgress?: ScanProgressCallback): Promise<number> {
  scanCancelled = false;
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return scanNativeFilesystem(onProgress);
  } else {
    return scanWebFilesystem(onProgress);
  }
}

// --- Web File System Access API ---
async function scanWebFilesystem(onProgress?: ScanProgressCallback): Promise<number> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported. Use Chrome or Edge.');
  }

  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
  const files: { file: File; path: string }[] = [];

  onProgress?.({
    current: 0,
    total: 0,
    status: 'scanning',
    currentFile: 'Discovering files...',
    errors: [],
  });

  // Recursively find audio files
  await collectAudioFiles(dirHandle, '', files, onProgress);

  if (scanCancelled) {
    onProgress?.({ current: 0, total: 0, status: 'cancelled', errors: [] });
    return 0;
  }

  onProgress?.({
    current: 0,
    total: files.length,
    status: 'extracting',
    currentFile: 'Extracting metadata...',
    errors: [],
  });

  // Process in batches
  const BATCH_SIZE = 25;
  const errors: string[] = [];
  let processedCount = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (scanCancelled) {
      onProgress?.({ current: processedCount, total: files.length, status: 'cancelled', errors });
      return processedCount;
    }

    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((entry) => processAudioFile(entry.file, entry.path))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(String(result.reason));
      }
    }

    processedCount += batch.length;
    onProgress?.({
      current: processedCount,
      total: files.length,
      status: 'extracting',
      currentFile: batch[batch.length - 1]?.path ?? '',
      errors,
    });
  }

  // Build album and artist tables
  await buildAlbumAndArtistTables();

  onProgress?.({
    current: files.length,
    total: files.length,
    status: 'complete',
    errors,
  });

  return processedCount;
}

async function collectAudioFiles(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string,
  results: { file: File; path: string }[],
  onProgress?: ScanProgressCallback
) {
  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (scanCancelled) return;

    const fullPath = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === 'directory') {
      await collectAudioFiles(handle as FileSystemDirectoryHandle, fullPath, results, onProgress);
    } else if (handle.kind === 'file' && isAudioFile(name)) {
      const file = await (handle as FileSystemFileHandle).getFile();
      results.push({ file, path: fullPath });

      if (results.length % 50 === 0) {
        onProgress?.({
          current: results.length,
          total: 0,
          status: 'scanning',
          currentFile: fullPath,
          errors: [],
        });
      }
    }
  }
}

async function processAudioFile(file: File, path: string): Promise<void> {
  // Check if already in DB
  const existing = await db.tracks.where('filePath').equals(path).first();
  if (existing) return;

  try {
    const metadata = await parseBlob(file, { duration: true, skipCovers: false });
    const common = metadata.common;
    const format = metadata.format;

    let coverArt: Blob | undefined;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      coverArt = new Blob([new Uint8Array(pic.data)], { type: pic.format });
    }

    const durationSec = format.duration ?? 0;
    const trackId = uuidv4();

    const track: DBTrack = {
      id: trackId,
      title: common.title || file.name.replace(/\.[^.]+$/, ''),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: formatDuration(durationSec),
      durationMs: Math.round(durationSec * 1000),
      coverArt,
      color: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
      filePath: path,
      genre: common.genre?.[0],
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      discNumber: common.disk?.no ?? undefined,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
      sampleRate: format.sampleRate,
      format: format.codec ?? file.name.split('.').pop()?.toUpperCase(),
      size: file.size,
      lastModified: file.lastModified,
      playCount: 0,
      replayGainTrack: common.replaygain_track_gain?.dB,
      replayGainAlbum: common.replaygain_album_gain?.dB,
      lyrics: common.lyrics?.join('\n'),
      addedAt: Date.now(),
    };

    await db.tracks.put(track);
  } catch (err) {
    throw new Error(`Failed to process ${path}: ${err}`);
  }
}

// --- Native Filesystem (Capacitor) ---
async function scanNativeFilesystem(onProgress?: ScanProgressCallback): Promise<number> {
  const directories = [
    'Music',
    'Download',
    'Downloads',
    'DCIM',
    'Audio',
    'Ringtones',
    'Notifications',
    'Podcasts',
    'Recordings',
    'media',
    'Media',
    'Songs',
    'Sounds',
    'Documents',
    'Telegram',
    'WhatsApp',
  ];

  const filePaths: string[] = [];

  onProgress?.({
    current: 0,
    total: 0,
    status: 'scanning',
    currentFile: 'Scanning device storage...',
    errors: [],
  });

  for (const dir of directories) {
    if (scanCancelled) break;
    try {
      await scanNativeDirectory(dir, Directory.ExternalStorage, filePaths, onProgress);
    } catch {
      // Directory might not exist, skip
    }
  }

  // Process files one at a time to avoid memory pressure
  onProgress?.({
    current: 0,
    total: filePaths.length,
    status: 'extracting',
    currentFile: 'Reading metadata...',
    errors: [],
  });

  const errors: string[] = [];
  let processedCount = 0;

  for (const filePath of filePaths) {
    if (scanCancelled) break;

    try {
      await processNativeAudioFile(filePath);
    } catch (err) {
      errors.push(`${filePath}: ${err}`);
    }
    processedCount++;
    onProgress?.({
      current: processedCount,
      total: filePaths.length,
      status: 'extracting',
      currentFile: filePath,
      errors,
    });
  }

  await buildAlbumAndArtistTables();

  onProgress?.({
    current: filePaths.length,
    total: filePaths.length,
    status: scanCancelled ? 'cancelled' : 'complete',
    errors,
  });

  return processedCount;
}

async function scanNativeDirectory(
  path: string,
  directory: Directory,
  results: string[],
  onProgress?: ScanProgressCallback
) {
  try {
    const listing = await Filesystem.readdir({ path, directory });
    for (const entry of listing.files) {
      if (scanCancelled) return;

      const fullPath = `${path}/${entry.name}`;
      if (entry.type === 'directory') {
        await scanNativeDirectory(fullPath, directory, results, onProgress);
      } else if (isAudioFile(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission denied or directory doesn't exist
  }
}

async function processNativeAudioFile(filePath: string): Promise<void> {
  // Resolve the web-playable URL first so we can check both paths in the DB
  let resolvedWebUrl = '';
  try {
    const uriResult = await Filesystem.getUri({ path: filePath, directory: Directory.ExternalStorage });
    resolvedWebUrl = Capacitor.convertFileSrc(uriResult.uri);
  } catch {
    console.warn('[Nocturne] Filesystem.getUri failed for:', filePath);
  }

  // Check DB by both the relative path and the resolved web URL (previous scans stored the web URL)
  const existing = resolvedWebUrl
    ? await db.tracks.where('filePath').anyOf([filePath, resolvedWebUrl]).first()
    : await db.tracks.where('filePath').equals(filePath).first();
  if (existing) {
    // Re-process tracks that failed metadata extraction previously
    const needsRescan = existing.artist === 'Unknown Artist' && !existing.coverArt;
    if (!needsRescan) {
      console.log('[Nocturne] Skipping already-indexed file:', filePath);
      return;
    }
    console.log('[Nocturne] Re-scanning track with missing metadata:', filePath);
    // Delete old entry so we can re-create it with fresh metadata
    await db.tracks.delete(existing.id);
  }

  const fileName = filePath.split('/').pop() ?? filePath;
  const ext = fileName.split('.').pop()?.toUpperCase() ?? '';
  console.log('[Nocturne] Processing file:', filePath);

  // ALWAYS create a basic track first from filename — this guarantees files load
  // even if metadata parsing fails entirely
  const trackId = uuidv4();
  const basicTrack: DBTrack = {
    id: trackId,
    title: fileName.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim(),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: '0:00',
    durationMs: 0,
    color: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
    filePath,
    format: ext,
    playCount: 0,
    addedAt: Date.now(),
  };

  // Try to get file info from Filesystem.stat
  try {
    const statResult = await Filesystem.stat({
      path: filePath,
      directory: Directory.ExternalStorage,
    });
    basicTrack.size = statResult.size;
  } catch {
    // stat failed, continue without size
  }

  // Try multiple approaches to read metadata, from fastest to most reliable
  let metadataLoaded = false;

  // Store the web-playable URL so playback doesn't need runtime path conversion
  if (resolvedWebUrl) {
    basicTrack.filePath = resolvedWebUrl;
  }

  // Approach 1: convertFileSrc + fetch (most efficient, no base64)
  if (!metadataLoaded && resolvedWebUrl) {
    try {
      console.log('[Nocturne] Trying fetch via:', resolvedWebUrl);

      const response = await fetch(resolvedWebUrl);
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0) {
          basicTrack.size = blob.size;
          try {
            const metadata = await parseBlob(blob, { duration: true, skipCovers: false });
            applyMetadata(basicTrack, metadata, fileName);
            metadataLoaded = true;
            console.log('[Nocturne] Metadata loaded via fetch:', basicTrack.title);
          } catch (parseErr) {
            console.warn('[Nocturne] Metadata parse failed (fetch):', filePath, parseErr);
          }
        }
      }
    } catch (fetchErr) {
      console.warn('[Nocturne] Fetch approach failed:', filePath, fetchErr);
    }
  }

  // Approach 2: Filesystem.readFile (base64, slower but more compatible)
  if (!metadataLoaded) {
    try {
      console.log('[Nocturne] Trying Filesystem.readFile for:', filePath);
      const fileResult = await Filesystem.readFile({
        path: filePath,
        directory: Directory.ExternalStorage,
      });

      let blob: Blob;
      if (fileResult.data instanceof Blob) {
        blob = fileResult.data;
      } else if (typeof fileResult.data === 'string') {
        const binaryStr = atob(fileResult.data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes]);
      } else {
        blob = new Blob([fileResult.data as BlobPart]);
      }

      if (blob.size > 0) {
        basicTrack.size = blob.size;
        try {
          const metadata = await parseBlob(blob, { duration: true, skipCovers: false });
          applyMetadata(basicTrack, metadata, fileName);
          metadataLoaded = true;
          console.log('[Nocturne] Metadata loaded via readFile:', basicTrack.title);
        } catch (parseErr) {
          console.warn('[Nocturne] Metadata parse failed (readFile):', filePath, parseErr);
        }
      }
    } catch (readErr) {
      console.warn('[Nocturne] readFile approach failed:', filePath, readErr);
    }
  }

  if (!metadataLoaded) {
    console.warn('[Nocturne] No metadata for:', filePath, '- saving with filename as title');
  }

  // ALWAYS save the track — even without metadata, the file can still be played
  await db.tracks.put(basicTrack);
  console.log('[Nocturne] Track saved:', basicTrack.title, '-', basicTrack.artist, metadataLoaded ? '(with metadata)' : '(filename only)');
}

/** Apply parsed metadata to a track object */
function applyMetadata(track: DBTrack, metadata: ReturnType<typeof parseBlob> extends Promise<infer T> ? T : never, fileName: string): void {
  const common = metadata.common;
  const format = metadata.format;

  track.title = common.title || fileName.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
  track.artist = common.artist || 'Unknown Artist';
  track.album = common.album || 'Unknown Album';

  const durationSec = format.duration ?? 0;
  track.duration = formatDuration(durationSec);
  track.durationMs = Math.round(durationSec * 1000);

  track.genre = common.genre?.[0];
  track.year = common.year;
  track.trackNumber = common.track?.no ?? undefined;
  track.discNumber = common.disk?.no ?? undefined;
  track.bitrate = format.bitrate ? Math.round(format.bitrate / 1000) : undefined;
  track.sampleRate = format.sampleRate;
  track.format = format.codec ?? fileName.split('.').pop()?.toUpperCase();

  track.replayGainTrack = common.replaygain_track_gain?.dB;
  track.replayGainAlbum = common.replaygain_album_gain?.dB;
  track.lyrics = common.lyrics?.join('\n');

  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    try {
      track.coverArt = new Blob([new Uint8Array(pic.data)], { type: pic.format });
    } catch {
      // cover art conversion failed, skip
    }
  }
}

// --- Build derived tables ---
async function buildAlbumAndArtistTables(): Promise<void> {
  const albumMap = new Map<string, DBAlbum>();
  const artistMap = new Map<string, DBArtist>();

  await db.tracks.each((track) => {
    // Albums
    const albumId = generateAlbumId(track.album, track.artist);
    const existing = albumMap.get(albumId);
    if (existing) {
      existing.trackCount++;
      existing.trackIds.push(track.id);
      if (!existing.coverArt && track.coverArt) {
        existing.coverArt = track.coverArt;
      }
    } else {
      albumMap.set(albumId, {
        id: albumId,
        title: track.album,
        artist: track.artist,
        coverArt: track.coverArt,
        year: track.year ?? 0,
        trackCount: 1,
        trackIds: [track.id],
      });
    }

    // Artists
    const artistId = generateArtistId(track.artist);
    const existingArtist = artistMap.get(artistId);
    if (existingArtist) {
      existingArtist.trackCount++;
    } else {
      artistMap.set(artistId, {
        id: artistId,
        name: track.artist,
        imageArt: track.coverArt,
        trackCount: 1,
        albumCount: 0,
      });
    }
  });

  // Count albums per artist
  for (const album of albumMap.values()) {
    const artistId = generateArtistId(album.artist);
    const artist = artistMap.get(artistId);
    if (artist) {
      artist.albumCount++;
    }
  }

  await db.albums.bulkPut([...albumMap.values()]);
  await db.artists.bulkPut([...artistMap.values()]);
}

/**
 * For web: create object URLs from File handles for playback.
 * This stores a mapping of filePath -> objectURL for the current session.
 */
const fileObjectUrls = new Map<string, string>();

export function registerFileUrl(path: string, file: File) {
  const existing = fileObjectUrls.get(path);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(file);
  fileObjectUrls.set(path, url);
  return url;
}

export function getFileUrl(path: string): string | undefined {
  // On native, the filePath is already a web-playable URL (stored at scan time)
  // so just return it directly if it looks like a URL
  if (Capacitor.isNativePlatform() && path && (path.startsWith('https://') || path.startsWith('http://'))) {
    return path;
  }
  // For native paths that weren't converted yet (legacy), try to convert
  if (Capacitor.isNativePlatform() && path && !path.startsWith('blob:')) {
    return getNativePlaybackUrl(path);
  }
  return fileObjectUrls.get(path);
}

/**
 * Fallback for legacy tracks that still store relative paths.
 * Uses Filesystem.getUri at runtime (sync fallback with hardcoded path).
 */
function getNativePlaybackUrl(relativePath: string): string {
  try {
    const encodedPath = relativePath.split('/').map(s => encodeURIComponent(s)).join('/');
    const fileUri = 'file:///storage/emulated/0/' + encodedPath;
    return Capacitor.convertFileSrc(fileUri);
  } catch {
    return relativePath;
  }
}

/**
 * Request storage permissions on Android.
 * Uses native plugin to check/request MANAGE_EXTERNAL_STORAGE (Android 11+).
 * Returns true if permissions are granted.
 */
export async function requestStoragePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  
  try {
    // Use native plugin to check actual MANAGE_EXTERNAL_STORAGE status
    const result = await StoragePermission.check();
    console.log('[Nocturne] MANAGE_EXTERNAL_STORAGE granted:', result.granted);
    
    if (result.granted) return true;
    
    // Open the "All Files Access" settings page
    console.log('[Nocturne] Opening All Files Access settings...');
    await StoragePermission.request();
    
    // Wait for user to return from settings (poll every second for up to 30 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const recheck = await StoragePermission.check();
      console.log('[Nocturne] Permission recheck:', recheck.granted);
      if (recheck.granted) return true;
    }
    
    return false;
  } catch (err) {
    console.error('[Nocturne] Permission error:', err);
    // Fallback: try the Capacitor Filesystem API
    try {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage === 'granted') {
        // Verify with actual file read
        try {
          await Filesystem.readdir({ path: 'Music', directory: Directory.ExternalStorage });
          return true;
        } catch {
          const req = await Filesystem.requestPermissions();
          return req.publicStorage === 'granted';
        }
      }
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    } catch {
      return false;
    }
  }
}

/**
 * Scan and register files for playback.
 * On web: uses File System Access API with object URLs.
 * On native: uses Capacitor Filesystem with convertFileSrc URLs.
 */
export async function scanAndRegisterFiles(onProgress?: ScanProgressCallback): Promise<number> {
  scanCancelled = false;
  
  if (Capacitor.isNativePlatform()) {
    // Request permissions first
    const hasPermissions = await requestStoragePermissions();
    if (!hasPermissions) {
      throw new Error('Storage permission denied. Please grant storage access in app settings.');
    }
    return scanNativeFilesystem(onProgress);
  }

  // Web path
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported. Use Chrome or Edge.');
  }

  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
  const files: { file: File; path: string }[] = [];

  onProgress?.({
    current: 0,
    total: 0,
    status: 'scanning',
    currentFile: 'Discovering files...',
    errors: [],
  });

  await collectAudioFiles(dirHandle, '', files, onProgress);

  if (scanCancelled) {
    onProgress?.({ current: 0, total: 0, status: 'cancelled', errors: [] });
    return 0;
  }

  // Register all file URLs for playback
  for (const entry of files) {
    registerFileUrl(entry.path, entry.file);
  }

  onProgress?.({
    current: 0,
    total: files.length,
    status: 'extracting',
    currentFile: 'Extracting metadata...',
    errors: [],
  });

  const errors: string[] = [];
  let processedCount = 0;
  const BATCH_SIZE = 25;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    if (scanCancelled) {
      onProgress?.({ current: processedCount, total: files.length, status: 'cancelled', errors });
      return processedCount;
    }

    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((entry) => processAudioFile(entry.file, entry.path))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(String(result.reason));
      }
    }

    processedCount += batch.length;
    onProgress?.({
      current: processedCount,
      total: files.length,
      status: 'extracting',
      currentFile: batch[batch.length - 1]?.path ?? '',
      errors,
    });
  }

  await buildAlbumAndArtistTables();

  onProgress?.({
    current: files.length,
    total: files.length,
    status: 'complete',
    errors,
  });

  return processedCount;
}
