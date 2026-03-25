import React from 'react';
import { Home, Library, Search, Sliders, Heart, Settings as SettingsIcon } from 'lucide-react';
import { Screen } from '../types';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function BottomNav({ activeScreen, onScreenChange }: BottomNavProps) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'library', icon: Library, label: 'Library' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'playlists', icon: Heart, label: 'Liked' },
    { id: 'equalizer', icon: Sliders, label: 'Equalizer' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass !rounded-none !border-x-0 !border-b-0 border-t border-white/[0.03] px-6 pt-4 flex justify-between items-center shadow-[0_-8px_32px_rgba(0,0,0,0.2)]" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id as Screen)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              isActive ? "text-white scale-110" : "text-text-secondary hover:text-white/70"
            )}
          >
            <div className={cn(
              "p-1 rounded-xl transition-colors",
              isActive && "bg-white/10"
            )}>
              <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter transition-opacity",
              isActive ? "opacity-100" : "opacity-0"
            )}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
