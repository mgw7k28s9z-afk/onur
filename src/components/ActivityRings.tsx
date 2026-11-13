import React, { useEffect, useState } from 'react';
import { Flame, Droplets, Info, Plus, Minus } from 'lucide-react';
import type { CalorieTargetBreakdown } from '../utils/nutritionMath';

interface ActivityRingsProps {
  caloriesMin: number;
  caloriesMax: number;
  caloriesMid: number;
  calorieBreakdown: CalorieTargetBreakdown;
  waterMl: number;
  waterTargetMl: number;
  onAddWater: (deltaMl: number) => void;
}

export const ActivityRings: React.FC<ActivityRingsProps> = ({
  caloriesMin,
  caloriesMax,
  caloriesMid,
  calorieBreakdown,
  waterMl,
  waterTargetMl,
  onAddWater,
}) => {
  const [mounted, setMounted] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const target = calorieBreakdown.targetCalories;
  const calRatio = target > 0 ? caloriesMid / target : 0;
  const isOverTarget = caloriesMid > target;
  const calProgress = mounted ? Math.min(1, calRatio) : 0;

  const waterRatio = waterTargetMl > 0 ? waterMl / waterTargetMl : 0;
  const waterProgress = mounted ? Math.min(1, waterRatio) : 0;

  // Outer ring (Calories) r=52, Inner ring (Water) r=37
  const rCal = 52;
  const cCal = 2 * Math.PI * rCal;
  const rWater = 37;
  const cWater = 2 * Math.PI * rWater;

  const calStrokeClass = isOverTarget
    ? 'stroke-[#C98A3A] dark:stroke-[#E0A352]'
    : 'stroke-[#46A573] dark:stroke-[#6AC696]';

  return (
    <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-3.5 min-[375px]:p-4 transition-colors">
      <div className="flex items-center gap-3 min-[375px]:gap-4">
        {/* Concentric Apple Health style SVG rings */}
        <div className="relative w-[96px] h-[96px] min-[375px]:w-[114px] min-[375px]:h-[114px] min-[410px]:w-[124px] min-[410px]:h-[124px] shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
            {/* Calorie track */}
            <circle
              cx="62"
              cy="62"
              r={rCal}
              fill="none"
              strokeWidth="11"
              className="stroke-[#E7F2EB] dark:stroke-[#212E26]"
            />
            <circle
              cx="62"
              cy="62"
              r={rCal}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={cCal}
              strokeDashoffset={cCal * (1 - calProgress)}
              className={`${calStrokeClass} transition-[stroke-dashoffset,stroke] duration-700 ease-out`}
            />

            {/* Water track */}
            <circle
              cx="62"
              cy="62"
              r={rWater}
              fill="none"
              strokeWidth="11"
              className="stroke-[#E6EFF6] dark:stroke-[#1E2C36]"
            />
            <circle
              cx="62"
              cy="62"
              r={rWater}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={cWater}
              strokeDashoffset={cWater * (1 - waterProgress)}
              className="stroke-[#5B9BD5] dark:stroke-[#76B2E8] transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] min-[375px]:text-[11px] font-medium text-[#6B776F] dark:text-[#96A39B]">Hedef</span>
            <span className="text-xs min-[375px]:text-sm font-bold tabular-nums">{target}</span>
          </div>
        </div>

        {/* Right metrics column */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#59655D] dark:text-[#9AA89F]">
                <Flame
                  className={`w-3.5 h-3.5 ${
                    isOverTarget
                      ? 'text-[#C98A3A] dark:text-[#E0A352]'
                      : 'text-[#46A573] dark:text-[#6AC696]'
                  }`}
                />
                <span>Kalori aralığı</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFormula((v) => !v)}
                className="text-[11px] font-semibold text-[#1C593A] dark:text-[#9FE2BD] bg-[#E5F6EC] dark:bg-[#1B3125] rounded-lg inline-flex items-center gap-0.5 cursor-pointer py-1 px-2"
                title="Hedef nasıl hesaplandı?"
              >
                <Info className="w-3 h-3" />
                <span>Hesap</span>
              </button>
            </div>

            <div className="text-[17px] min-[375px]:text-[19px] font-bold tracking-tight tabular-nums leading-tight mt-0.5">
              {caloriesMax > 0 ? `${caloriesMin}–${caloriesMax}` : '0'}{' '}
              <span className="text-xs font-normal text-[#69756D] dark:text-[#93A097]">kcal</span>
            </div>

            {isOverTarget ? (
              <p className="text-[11px] text-[#A26D27] dark:text-[#E0A352] mt-0.5 leading-snug">
                Hedefin biraz üstündesin, yarın dengelenir.
              </p>
            ) : (
              <p className="text-[11px] text-[#69756D] dark:text-[#93A097] mt-0.5 tabular-nums">
                {caloriesMax > 0
                  ? `Kalan yaklaşık ${Math.max(0, target - caloriesMax)}–${Math.max(0, target - caloriesMin)} kcal`
                  : `Günlük hedef ${target} kcal`}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-[#ECEFE9] dark:border-[#242E29]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#59655D] dark:text-[#9AA89F]">
                <Droplets className="w-3.5 h-3.5 text-[#5B9BD5] dark:text-[#76B2E8]" />
                <span>Su</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-[#356C9E] dark:text-[#76B2E8]">
                {waterMl} / {waterTargetMl} ml
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => onAddWater(200)}
                className="flex-1 min-w-0 h-9 px-1.5 rounded-xl bg-[#5B9BD5]/12 dark:bg-[#76B2E8]/15 text-[#2E6394] dark:text-[#8DC0EE] text-[11px] min-[375px]:text-xs font-semibold inline-flex items-center justify-center gap-0.5 min-[375px]:gap-1 hover:bg-[#5B9BD5]/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>200 ml</span>
              </button>
              <button
                type="button"
                onClick={() => onAddWater(500)}
                className="flex-1 min-w-0 h-9 px-1.5 rounded-xl bg-[#5B9BD5]/12 dark:bg-[#76B2E8]/15 text-[#2E6394] dark:text-[#8DC0EE] text-[11px] min-[375px]:text-xs font-semibold inline-flex items-center justify-center gap-0.5 min-[375px]:gap-1 hover:bg-[#5B9BD5]/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>500 ml</span>
              </button>
              <button
                type="button"
                onClick={() => onAddWater(-200)}
                disabled={waterMl <= 0}
                className="w-9 h-9 shrink-0 rounded-xl bg-[#F2F4F0] dark:bg-[#202A24] text-[#59655D] dark:text-[#9AA89F] inline-flex items-center justify-center disabled:opacity-40 cursor-pointer"
                aria-label="200 ml azalt"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable transparent formula explanation */}
      {showFormula && (
        <div className="mt-3 pt-3 border-t border-[#ECEFE9] dark:border-[#242E29] text-xs text-[#4C5950] dark:text-[#B5C2B9] space-y-1 leading-relaxed">
          <div className="font-semibold text-[#1C241F] dark:text-[#EDF1ED]">
            Hedefin Nasıl Hesaplandı?
          </div>
          <p className="tabular-nums">{calorieBreakdown.formulaText}</p>
          <p>{calorieBreakdown.weeklyPaceNote}</p>
          {calorieBreakdown.safeFloorApplied && (
            <p className="text-[#8C6126] dark:text-[#E0A352]">
              Güvenli alt sınır ({calorieBreakdown.safeFloorValue} kcal) uygulandı.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
