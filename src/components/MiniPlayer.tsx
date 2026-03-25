import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import { useMusicStore } from '../store/useMusicStore';
import { cn } from '../lib/utils';

export default function MiniPlayer() {
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const setPlayerOpen = useMusicStore((s) => s.setPlayerOpen);
  const isPlayerOpen = useMusicStore((s) => s.isPlayerOpen);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);

  if (!currentTrack || isPlayerOpen) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
      className="fixed bottom-24 left-4 right-4 z-40"
      style={{ willChange: 'transform' }}
    >
      <div 
        onClick={() => setPlayerOpen(true)}
        className="glass rounded-[1.25rem] p-2.5 flex items-center shadow-[0_16px_48px_rgba(0,0,0,0.4)] cursor-pointer active:scale-[0.98] transition-transform border border-white/[0.03] backdrop-blur-2xl relative overflow-hidden"
      >
        {/* Subtle background glow based on track color */}
        <div 
          className="absolute inset-0 opacity-20 blur-2xl pointer-events-none"
          style={{ backgroundColor: currentTrack.color }}
        />

        <motion.div 
          layoutId="player-art"
          className="relative z-10 w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg bg-surface"
        >
          {currentTrack.coverUrl ? (
            <img 
              src={currentTrack.coverUrl} 
              alt={currentTrack.title} 
              className={cn("w-full h-full object-cover transition-transform duration-700", isPlaying ? "scale-105" : "scale-100")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-secondary">
              <Music className="w-6 h-6" />
            </div>
          )}
        </motion.div>
        
        <div className="relative z-10 flex-1 min-w-0 px-3 flex flex-col justify-center">
          <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
          <p className="text-[11px] font-medium text-text-secondary truncate uppercase tracking-wider mt-0.5">{currentTrack.artist}</p>
        </div>

        <div className="relative z-10 flex items-center gap-2 pr-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-90"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-90"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Integrated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
          <div 
            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
