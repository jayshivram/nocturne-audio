import React, { useState, useEffect, useRef } from 'react';
import HomeScreen from './components/HomeScreen';
import LibraryScreen from './components/LibraryScreen';
import EqualizerScreen from './components/EqualizerScreen';
import SearchScreen from './components/SearchScreen';
import SettingsScreen from './components/SettingsScreen';
import PlaylistsScreen from './components/PlaylistsScreen';
import BottomNav from './components/BottomNav';
import MiniPlayer from './components/MiniPlayer';
import FullPlayer from './components/FullPlayer';
import { Screen } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { useMusicStore } from './store/useMusicStore';
import { configureStatusBar, setupBackButton, onAppStateChange } from './services/capacitorBridge';
import { audioEngine } from './services/audioEngine';
import { scanAndRegisterFiles, requestStoragePermissions } from './services/fileScanner';
import { Capacitor } from '@capacitor/core';
import { cn } from './lib/utils';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;
  const isSettingsOpenRef = useRef(isSettingsOpen);
  isSettingsOpenRef.current = isSettingsOpen;
  const isPlayerOpen = useMusicStore((s) => s.isPlayerOpen);
  const setPlayerOpen = useMusicStore((s) => s.setPlayerOpen);
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const loadLibrary = useMusicStore((s) => s.loadLibrary);
  const sleepTimerEndTime = useMusicStore((s) => s.sleepTimerEndTime);
  const clearSleepTimer = useMusicStore((s) => s.clearSleepTimer);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const isPlaying = useMusicStore((s) => s.isPlaying);

  // Show MiniPlayer when there's a track and FullPlayer is closed
  const showMiniPlayer = !!currentTrack && !isPlayerOpen;

  useEffect(() => {
    configureStatusBar();
    
    const initApp = async () => {
      // Request storage permissions immediately on native
      if (Capacitor.isNativePlatform()) {
        console.log('[Nocturne] Requesting storage permissions...');
        const granted = await requestStoragePermissions();
        console.log('[Nocturne] Storage permissions granted:', granted);
        
        if (!granted) {
          console.warn('[Nocturne] Storage permission not granted yet.');
          useMusicStore.getState().setScanProgress({
            current: 0,
            total: 0,
            status: 'error',
            errors: ['Storage permission required. Please enable "All files access" for Nocturne Audio, then tap "Scan Music".'],
          });
          // Still load library in case there are cached tracks
          await loadLibrary();
          return;
        }
      }

      // Load library from IndexedDB
      await loadLibrary();

      // Auto-scan on native if library is empty
      if (Capacitor.isNativePlatform()) {
        const state = useMusicStore.getState();
        console.log('[Nocturne] Library has', state.tracks.length, 'tracks');
        if (state.tracks.length === 0) {
          console.log('[Nocturne] Starting auto-scan...');
          try {
            const count = await scanAndRegisterFiles((progress) => {
              useMusicStore.getState().setScanProgress(progress);
            });
            console.log('[Nocturne] Auto-scan complete, processed', count, 'files. Reloading library...');
            await useMusicStore.getState().loadLibrary();
            const finalState = useMusicStore.getState();
            console.log('[Nocturne] Library reloaded, tracks:', finalState.tracks.length);
          } catch (err) {
            console.error('[Nocturne] Auto-scan failed:', err);
            useMusicStore.getState().setScanProgress({
              current: 0,
              total: 0,
              status: 'error',
              errors: [String(err)],
            });
          }
        }
      }
    };

    initApp();

    const cleanupBackButton = setupBackButton({
      onPlayerClose: () => {
        const state = useMusicStore.getState();
        if (state.isPlayerOpen) {
          state.setPlayerOpen(false);
          return true;
        }
        return false;
      },
      onSettingsClose: () => {
        if (isSettingsOpenRef.current) {
          setIsSettingsOpen(false);
          return true;
        }
        return false;
      },
      onNavigateBack: () => {
        if (activeScreenRef.current !== 'home') {
          setActiveScreen('home');
          return true;
        }
        return false;
      },
    });

    // Pause visualizer when app is backgrounded
    onAppStateChange(() => {});

    return () => {
      cleanupBackButton();
    };
  }, []);

  // Sleep timer
  useEffect(() => {
    if (!sleepTimerEndTime) return;
    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEndTime) {
        if (isPlaying) togglePlay();
        clearSleepTimer();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndTime]);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home': return <HomeScreen onOpenSettings={() => setIsSettingsOpen(true)} onNavigate={(s) => setActiveScreen(s as Screen)} />;
      case 'library': return <LibraryScreen onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'equalizer': return <EqualizerScreen />;
      case 'search': return <SearchScreen />;
      case 'playlists': return <PlaylistsScreen />;
      default: return <HomeScreen onOpenSettings={() => setIsSettingsOpen(true)} onNavigate={(s) => setActiveScreen(s as Screen)} />;
    }
  };

  return (
    <div className="relative w-full h-screen bg-background bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-surface/40 via-background to-background overflow-hidden flex flex-col">
      {/* Main Content Area */}
      <div className={cn("flex-1 overflow-y-auto no-scrollbar", showMiniPlayer ? "pb-44" : "pb-24")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Persistent UI */}
      <MiniPlayer />
      <BottomNav activeScreen={activeScreen} onScreenChange={setActiveScreen} />
      <FullPlayer />

      {/* Settings Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 bg-background overflow-y-auto"
          >
            <SettingsScreen onClose={() => setIsSettingsOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
