import React, { useEffect, useState } from 'react';
import { Moon, Sun, Wifi, Battery } from 'lucide-react';
import type { ThemeMode } from '../types/nutrition';

interface IPhoneFrameProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ theme, onToggleTheme, children }) => {
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockText(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="h-[100dvh] w-full bg-[#F7F8F5] dark:bg-[#0F1512] desktop-frame:bg-[#EFF1EC] desktop-frame:dark:bg-[#0B100D] text-[#1C241F] dark:text-[#EDF1ED] transition-colors duration-300 flex flex-col items-center justify-center desktop-frame:py-4 desktop-frame:px-4 overflow-hidden">
      {/* Desktop controls bar outside the iPhone frame */}
      <div className="hidden desktop-frame:flex items-center justify-between w-full max-w-[390px] mb-2.5 px-1 no-print shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#59655D] dark:text-[#98A69D]">
          <span className="font-semibold text-[#1C241F] dark:text-[#EDF1ED]">Denge</span>
          <span aria-hidden="true">·</span>
          <span>iPhone Önizleme</span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E5F6EC] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] hover:bg-[#D7F0E1] dark:hover:bg-[#223D2F] transition-colors cursor-pointer active:scale-95"
          aria-label={theme === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#E0A352]" />
              <span>Açık Mod</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#2D8256]" />
              <span>Koyu Mod</span>
            </>
          )}
        </button>
      </div>

      {/* Smartphone 9:19.5 frame on large desktop; true edge-to-edge 100dvh on all phones & landscape */}
      <div
        className="
          relative w-full h-full
          desktop-frame:h-[min(836px,calc(100dvh-68px))] desktop-frame:w-auto desktop-frame:aspect-[393/852] desktop-frame:min-w-[330px] desktop-frame:max-w-[94vw]
          desktop-frame:rounded-[50px] desktop-frame:p-[10px]
          desktop-frame:bg-gradient-to-b desktop-frame:from-[#2C332E] desktop-frame:via-[#1E2420] desktop-frame:to-[#2C332E]
          desktop-frame:shadow-[0_28px_70px_-18px_rgba(18,28,22,0.38),0_0_0_1px_rgba(255,255,255,0.12)_inset]
          flex flex-col print-only-full
        "
      >
        {/* Inner App Screen */}
        <div
          id="iphone-screen"
          className="
            relative w-full h-full flex flex-col overflow-hidden
            bg-[#F7F8F5] dark:bg-[#0F1512]
            desktop-frame:rounded-[40px]
            transition-colors duration-300
            safe-x
            print-only-full
          "
        >
          {/* Desktop Preview iOS Status Bar + Dynamic Island */}
          <div className="hidden desktop-frame:flex items-center justify-between px-7 pt-2.5 pb-1.5 shrink-0 select-none no-print z-20">
            <span className="text-[12px] font-semibold tracking-tight tabular-nums text-[#1C241F] dark:text-[#EDF1ED] w-12">
              {clockText}
            </span>
            <div
              className="w-[96px] h-[25px] rounded-full bg-[#0B0E0C] flex items-center justify-end px-2.5 shadow-inner"
              aria-hidden="true"
            >
              <div className="w-2 h-2 rounded-full bg-[#19231D] ring-1 ring-[#2B3A31]" />
            </div>
            <div className="flex items-center justify-end gap-1.5 w-12 text-[#1C241F] dark:text-[#EDF1ED]">
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-4 h-4" />
            </div>
          </div>

          {/* Real Phone Safe-Area Top Strip (clears notch/Dynamic Island & never overlaps page headers) */}
          <div className="desktop-frame:hidden flex items-center justify-between w-full max-w-[540px] mx-auto px-4 safe-top pb-1.5 border-b border-[#E5E9E2]/70 dark:border-[#242E29]/70 bg-[#F7F8F5]/95 dark:bg-[#0F1512]/95 shrink-0 z-20 no-print">
            <span className="text-[13px] font-bold tracking-tight text-[#1C241F] dark:text-[#EDF1ED]">
              Denge
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              className="h-8 px-2.5 rounded-full bg-[#E5F6EC] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1C593A] dark:text-[#9FE2BD] cursor-pointer active:scale-95 transition-transform"
              aria-label={theme === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#E0A352]" />
                  <span>Açık</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#2D8256]" />
                  <span>Koyu</span>
                </>
              )}
            </button>
          </div>

          {/* Main App Viewport (edge-to-edge on all phones, centered max-w-540px on foldables/tablets) */}
          <div className="relative flex-1 min-h-0 w-full max-w-[540px] desktop-frame:max-w-none mx-auto flex flex-col overflow-hidden">
            {children}
          </div>

          {/* Desktop Preview iPhone Home Indicator */}
          <div className="hidden desktop-frame:flex justify-center pt-1 pb-2 shrink-0 bg-transparent no-print pointer-events-none">
            <div className="w-28 h-1 rounded-full bg-[#1C241F]/20 dark:bg-[#EDF1ED]/20" />
          </div>
        </div>
      </div>
    </div>
  );
};
