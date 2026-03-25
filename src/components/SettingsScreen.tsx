import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  RefreshCw, 
  Zap, 
  Trash2, 
  Clock, 
  ChevronRight,
  Maximize2,
  X,
  Database,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useMusicStore } from '../store/useMusicStore';
import { scanAndRegisterFiles, cancelScan } from '../services/fileScanner';
import { getLibraryStats } from '../db/musicDatabase';
import { db, clearCoverArtCache } from '../db/musicDatabase';

export default function SettingsScreen({ onClose }: { onClose?: () => void }) {
  const gapless = useMusicStore((s) => s.gaplessPlayback);
  const crossfade = useMusicStore((s) => s.crossfadeDuration);
  const setGapless = useMusicStore((s) => s.setGaplessPlayback);
  const setCrossfade = useMusicStore((s) => s.setCrossfadeDuration);
  const sleepTimerMinutes = useMusicStore((s) => s.sleepTimerMinutes);
  const sleepTimerEndTime = useMusicStore((s) => s.sleepTimerEndTime);
  const setSleepTimer = useMusicStore((s) => s.setSleepTimer);
  const clearSleepTimer = useMusicStore((s) => s.clearSleepTimer);
  const scanProgress = useMusicStore((s) => s.scanProgress);
  const setScanProgress = useMusicStore((s) => s.setScanProgress);
  const clearLibrary = useMusicStore((s) => s.clearLibrary);

  const [stats, setStats] = useState({ trackCount: 0, albumCount: 0, artistCount: 0, totalSize: 0 });
  const [sleepInput, setSleepInput] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    getLibraryStats().then(setStats);
  }, [scanProgress.status]);

  // Update remaining time display
  useEffect(() => {
    if (!sleepTimerEndTime) { setTimeRemaining(''); return; }
    const interval = setInterval(() => {
      const remaining = sleepTimerEndTime - Date.now();
      if (remaining <= 0) { setTimeRemaining(''); return; }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndTime]);

  const handleScan = useCallback(async () => {
    try {
      await scanAndRegisterFiles(setScanProgress);
      const store = useMusicStore.getState();
      await store.loadLibrary();
    } catch { /* user cancel or error */ }
  }, [setScanProgress]);

  const handleClearLibrary = useCallback(async () => {
    await clearLibrary();
    clearCoverArtCache();
    setShowClearConfirm(false);
    setStats({ trackCount: 0, albumCount: 0, artistCount: 0, totalSize: 0 });
  }, [clearLibrary]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const sleepTimerOptions = [5, 10, 15, 30, 45, 60, 90];

  const SettingItem = ({ icon: Icon, label, sublabel, action, color = "text-text-secondary" }: any) => (
    <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-sm">{label}</p>
          {sublabel && <p className="text-[10px] text-text-secondary font-medium uppercase tracking-tighter">{sublabel}</p>}
        </div>
      </div>
      {action ? action : <ChevronRight className="w-4 h-4 text-text-secondary" />}
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h2 className="px-6 text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 mt-6">{title}</h2>
  );

  const isScanning = scanProgress.status === 'scanning';

  return (
    <div className="flex flex-col gap-2 pb-40">
      <header className="px-6 flex items-start justify-between" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Settings</h1>
          <p className="text-text-secondary font-medium mt-1">Advanced Audio Configuration</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl glass hover:bg-white/10 transition-all active:scale-90"
          >
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        )}
      </header>

      <main className="flex flex-col gap-2 px-2">
        <SectionHeader title="Library Management" />
        <div className="glass mx-4 rounded-3xl overflow-hidden">
          <SettingItem 
            icon={isScanning ? Loader2 : RefreshCw} 
            label="Scan Music" 
            sublabel={isScanning ? `${scanProgress.current}/${scanProgress.total} files` : `${stats.trackCount} tracks indexed`}
            color="text-accent"
            action={
              isScanning ? (
                <button onClick={cancelScan} className="bg-red-500/80 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Stop
                </button>
              ) : (
                <button onClick={handleScan} className="bg-accent text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20">
                  Scan
                </button>
              )
            }
          />
          {isScanning && scanProgress.currentFile && (
            <div className="px-4 pb-3">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-300" 
                  style={{ width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` }} 
                />
              </div>
              <p className="text-[9px] text-text-secondary mt-1 truncate">{scanProgress.currentFile}</p>
            </div>
          )}
          <SettingItem 
            icon={Database} 
            label="Library Stats" 
            sublabel={`${stats.trackCount} songs · ${stats.albumCount} albums · ${stats.artistCount} artists · ${formatSize(stats.totalSize)}`}
          />
          <SettingItem 
            icon={Trash2} 
            label="Clear Library" 
            sublabel="Remove all indexed data" 
            color="text-red-500"
            action={
              <button onClick={() => setShowClearConfirm(true)} className="bg-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                Clear
              </button>
            }
          />
        </div>

        <SectionHeader title="Audio Engine" />
        <div className="glass mx-4 rounded-3xl overflow-hidden">
          <SettingItem 
            icon={Zap} 
            label="Gapless Playback" 
            sublabel="Seamless transitions" 
            action={
              <button 
                onClick={() => setGapless(!gapless)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  gapless ? "bg-accent" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  gapless ? "left-7" : "left-1"
                )} />
              </button>
            }
          />
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <p className="font-bold text-sm">Crossfade Duration</p>
              </div>
              <span className="text-accent font-bold text-sm">{crossfade}s</span>
            </div>
            <input 
              type="range" 
              min="0" max="12" step="0.5" 
              value={crossfade}
              onChange={(e) => setCrossfade(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-accent cursor-pointer"
            />
          </div>
        </div>

        <SectionHeader title="Sleep Timer" />
        <div className="glass mx-4 rounded-3xl overflow-hidden">
          {sleepTimerMinutes ? (
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Timer Active</p>
                  <p className="text-[10px] text-accent font-bold uppercase tracking-tighter">{timeRemaining} remaining</p>
                </div>
              </div>
              <button onClick={clearSleepTimer} className="bg-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                Cancel
              </button>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="font-bold text-sm">Set Sleep Timer</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sleepTimerOptions.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setSleepTimer(mins)}
                    className="px-4 py-2 rounded-full bg-white/5 text-sm font-bold hover:bg-accent/20 hover:text-accent transition-all active:scale-90"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass mx-4 rounded-3xl overflow-hidden mt-4">
          <div className="p-6 text-center">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] opacity-30">
              Nocturne Audio<br/>
              Precision Audio Engine v1.0
            </p>
          </div>
        </div>
      </main>

      {/* Clear Library Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6" onClick={() => setShowClearConfirm(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-display font-bold">Clear Library</h3>
            </div>
            <p className="text-sm text-text-secondary">This will remove all indexed tracks, albums, and artists from the database. Your music files will not be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 h-12 glass rounded-xl font-bold">Cancel</button>
              <button onClick={handleClearLibrary} className="flex-1 h-12 bg-red-500 rounded-xl font-bold text-white">Clear All</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
