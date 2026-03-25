import React, { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Save, Power } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMusicStore, BUILTIN_EQ_PRESETS } from '../store/useMusicStore';
import { EQ_FREQUENCY_LABELS } from '../constants';

export default function EqualizerScreen() {
  const equalizerEnabled = useMusicStore((s) => s.equalizerEnabled);
  const equalizerPreset = useMusicStore((s) => s.equalizerPreset);
  const equalizerBands = useMusicStore((s) => s.equalizerBands);
  const customPresets = useMusicStore((s) => s.customPresets);
  const setEqualizerEnabled = useMusicStore((s) => s.setEqualizerEnabled);
  const setEqualizerPreset = useMusicStore((s) => s.setEqualizerPreset);
  const setEqualizerBand = useMusicStore((s) => s.setEqualizerBand);
  const resetEqualizer = useMusicStore((s) => s.resetEqualizer);
  const saveCustomPreset = useMusicStore((s) => s.saveCustomPreset);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const allPresets = [...BUILTIN_EQ_PRESETS, ...customPresets];

  const handleSave = useCallback(() => {
    if (presetName.trim()) {
      saveCustomPreset(presetName.trim());
      setPresetName('');
      setShowSaveDialog(false);
    }
  }, [presetName, saveCustomPreset]);

  const handleSliderChange = useCallback((index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    setEqualizerBand(index, parseFloat(e.target.value));
  }, [setEqualizerBand]);

  return (
    <div className="flex flex-col gap-10 pb-40">
      {/* Header */}
      <header className="px-6 flex items-start justify-between" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}>
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Equalizer</h1>
          <p className="text-text-secondary mt-1 font-medium">Sculpt your perfect soundscape</p>
        </div>
        <button 
          onClick={() => setEqualizerEnabled(!equalizerEnabled)}
          className={cn(
            "p-3 rounded-2xl glass transition-all active:scale-90",
            equalizerEnabled ? "text-accent" : "text-text-secondary"
          )}
        >
          <Power className="w-6 h-6" />
        </button>
      </header>

      {/* Presets */}
      <section className="px-6 flex flex-col gap-4">
        <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Presets</h2>
        <div className="flex overflow-x-auto no-scrollbar gap-3">
          {allPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setEqualizerPreset(preset.name)}
              className={cn(
                "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                equalizerPreset === preset.name ? "bg-white text-background" : "glass text-text-secondary"
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      {/* 10-Band EQ Sliders */}
      <section className={cn("px-6 flex justify-between items-start gap-1 mt-4 transition-opacity", !equalizerEnabled && "opacity-40 pointer-events-none")}>
        {equalizerBands.map((value, index) => (
          <div key={index} className="flex flex-col items-center gap-2 flex-1">
            <span className="text-[10px] font-bold text-accent tabular-nums">
              {value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)}
            </span>
            <div className="relative h-48 w-full flex justify-center">
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={value}
                onChange={(e) => handleSliderChange(index, e)}
                className="absolute h-48 w-8 appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] direction-rtl 
                  [&::-webkit-slider-runnable-track]:w-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.3)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
                  [&::-moz-range-track]:w-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/10
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background"
              />
            </div>
            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-tighter">
              {EQ_FREQUENCY_LABELS[index]}
            </span>
          </div>
        ))}
      </section>

      {/* Active Preset Info */}
      <div className="px-6 text-center">
        <p className="text-xs font-bold text-text-secondary">
          Active: <span className="text-white">{equalizerPreset}</span>
          {!equalizerEnabled && <span className="text-red-400 ml-2">(Bypassed)</span>}
        </p>
      </div>

      {/* Actions */}
      <footer className="px-6 grid grid-cols-2 gap-4">
        <button 
          onClick={resetEqualizer}
          className="glass h-14 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </button>
        <button 
          onClick={() => setShowSaveDialog(true)}
          className="bg-white text-background h-14 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
        >
          <Save className="w-5 h-5" />
          Save Preset
        </button>
      </footer>

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6" onClick={() => setShowSaveDialog(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-bold">Save Preset</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              autoFocus
              maxLength={30}
              className="w-full h-12 bg-surface/60 border border-white/[0.03] rounded-xl pl-4 pr-4 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 outline-none transition-all font-bold text-sm"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveDialog(false)} className="flex-1 h-12 glass rounded-xl font-bold">Cancel</button>
              <button onClick={handleSave} className="flex-1 h-12 bg-accent rounded-xl font-bold text-white">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
