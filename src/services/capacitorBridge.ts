import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

// Status bar configuration
export async function configureStatusBar() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0A0A0D' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Not available
  }
}

// Back button handler for Android
export function setupBackButton(handlers: {
  onPlayerClose?: () => boolean;
  onSettingsClose?: () => boolean;
  onNavigateBack?: () => boolean;
}): () => void {
  if (!isNative) return () => {};

  const handle = App.addListener('backButton', ({ canGoBack }) => {
    // Try handlers in priority order
    if (handlers.onPlayerClose?.()) return;
    if (handlers.onSettingsClose?.()) return;
    if (handlers.onNavigateBack?.()) return;

    // If nothing handled it, minimize app
    App.minimizeApp();
  });

  return () => {
    handle.then(h => h.remove());
  };
}

// App state changes (foreground/background)
export function onAppStateChange(callback: (isActive: boolean) => void) {
  if (!isNative) {
    // Web fallback using visibility API
    document.addEventListener('visibilitychange', () => {
      callback(!document.hidden);
    });
    return;
  }

  App.addListener('appStateChange', ({ isActive }) => {
    callback(isActive);
  });
}

// Haptic feedback
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative) return;
  try {
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[style];
    await Haptics.impact({ style: impactStyle });
  } catch {
    // Not available
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isNative) return;
  try {
    const notificationType = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    }[type];
    await Haptics.notification({ type: notificationType });
  } catch {
    // Not available
  }
}

export async function hapticSelection() {
  if (!isNative) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    // Not available
  }
}
