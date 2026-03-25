import { Capacitor, registerPlugin } from '@capacitor/core';

let MusicControls: any = null;
let isInitialized = false;
let controlsCreated = false;
let permissionRequested = false;

const NotificationPermission = Capacitor.isNativePlatform()
  ? registerPlugin('NotificationPermission')
  : null;

async function getPlugin() {
  if (MusicControls) return MusicControls;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('capacitor-music-controls-plugin');
    MusicControls = mod.CapacitorMusicControls;
    return MusicControls;
  } catch {
    console.warn('[MediaControls] Plugin not available');
    return null;
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!NotificationPermission) return false;
  if (permissionRequested) return true;
  permissionRequested = true;
  try {
    const { granted } = await (NotificationPermission as any).check();
    if (granted) return true;
    const result = await (NotificationPermission as any).request();
    return result.granted;
  } catch (err) {
    console.warn('[MediaControls] Could not request notification permission:', err);
    return false;
  }
}

// Convert blob: URL to base64 data URI so native plugin can display cover art
async function blobUrlToBase64(blobUrl: string): Promise<string> {
  if (!blobUrl || !blobUrl.startsWith('blob:')) return blobUrl;
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

interface MediaControlsOptions {
  title: string;
  artist: string;
  album: string;
  cover: string;
  isPlaying: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  duration: number;
  elapsed: number;
}

interface MediaControlsHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

let currentHandlers: MediaControlsHandlers | null = null;

function handleControlsMessage(message: string) {
  switch (message) {
    case 'music-controls-play':
      currentHandlers?.onPlay();
      break;
    case 'music-controls-pause':
      currentHandlers?.onPause();
      break;
    case 'music-controls-next':
      currentHandlers?.onNext();
      break;
    case 'music-controls-previous':
      currentHandlers?.onPrev();
      break;
    case 'music-controls-media-button-play-pause':
      currentHandlers?.onPause();
      break;
  }
}

export async function setupMediaControlsListeners(handlers: MediaControlsHandlers) {
  currentHandlers = handlers;
  if (isInitialized) return;
  isInitialized = true;

  // On Android the plugin fires a DOM CustomEvent via triggerJSEvent,
  // NOT a Capacitor plugin listener. Listen on document directly.
  document.addEventListener('controlsNotification', (event: Event) => {
    try {
      const raw = (event as CustomEvent).detail;
      const info = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      handleControlsMessage(info.message);
    } catch {
      // malformed event — ignore
    }
  });
}

export async function updateMediaControls(options: MediaControlsOptions) {
  const plugin = await getPlugin();
  if (!plugin) return;

  // Ensure notification permission is granted on Android 13+
  await ensureNotificationPermission();

  // Convert blob URL to base64 data URI for native layer
  let cover = options.cover || '';
  if (cover.startsWith('blob:')) {
    cover = await blobUrlToBase64(cover);
  }

  try {
    await plugin.create({
      track: options.title,
      artist: options.artist,
      album: options.album,
      cover,
      isPlaying: options.isPlaying,
      hasPrev: options.hasPrev,
      hasNext: options.hasNext,
      hasClose: true,
      dismissable: true,
      duration: options.duration,
      elapsed: options.elapsed,
      ticker: `Now playing: ${options.title}`,
      playIcon: 'media_play',
      pauseIcon: 'media_pause',
      prevIcon: 'media_prev',
      nextIcon: 'media_next',
      closeIcon: 'media_close',
      notificationIcon: 'ic_launcher',
    });
    controlsCreated = true;
  } catch (err) {
    console.warn('[MediaControls] Failed to create controls:', err);
  }
}

export async function updateIsPlaying(isPlaying: boolean) {
  const plugin = await getPlugin();
  if (!plugin || !controlsCreated) return;
  try {
    await plugin.updateIsPlaying({ isPlaying });
  } catch {
    // Ignore — controls may not exist
  }
}

export async function destroyMediaControls() {
  const plugin = await getPlugin();
  if (!plugin || !controlsCreated) return;
  try {
    await plugin.destroy();
    controlsCreated = false;
  } catch {
    // Ignore
  }
}
