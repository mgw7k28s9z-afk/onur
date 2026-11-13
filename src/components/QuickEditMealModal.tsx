import React, { useState } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import type { MealEntry, PortionSize } from '../types/nutrition';
import { PORTION_MULTIPLIERS, computeMealTotals } from '../utils/nutritionMath';

interface QuickEditMealModalProps {
  meal: MealEntry;
  onClose: () => void;
  onSave: (updated: MealEntry) => void;
  onDelete: (id: string) => void;
}

export const QuickEditMealModal: React.FC<QuickEditMealModalProps> = ({
  meal,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState(meal.base.name);
  const [portionLabel, setPortionLabel] = useState(meal.base.portionLabel);
  const [portionSize, setPortionSize] = useState<PortionSize>(meal.portionSize);
  const [servingCount, setServingCount] = useState<number>(meal.servingCount);
  const [cookedInExtraOil, setCookedInExtraOil] = useState<boolean>(meal.cookedInExtraOil);

  const preview = computeMealTotals({
    base: meal.base,
    portionSize,
    servingCount,
    cookedInExtraOil,
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px]"
    >
      <div className="w-full max-h-[90%] overflow-y-auto ios-scroll rounded-t-[30px] bg-[#F7F8F5] dark:bg-[#141C18] border-t border-[#DCE2DA] dark:border-[#26322B] p-5 safe-bottom-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Hızlı Düzenleme</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#59655D] dark:text-[#9AA89F] cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#59655D] dark:text-[#9AA89F] mb-1">
              Öğün adı
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#171F1B] border border-[#DCE2DA] dark:border-[#26322B] text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#59655D] dark:text-[#9AA89F] mb-1">
              Ölçü birimi (ör. 1 kepçe, 2 dilim, 1 kase)
            </label>
            <input
              type="text"
              value={portionLabel}
              onChange={(e) => setPortionLabel(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#171F1B] border border-[#DCE2DA] dark:border-[#26322B] text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['kucuk', 'normal', 'buyuk'] as PortionSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPortionSize(size)}
                className={`h-10 rounded-xl text-xs font-semibold border cursor-pointer active:scale-95 transition-all ${
                  portionSize === size
                    ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60'
                    : 'bg-white dark:bg-[#171F1B] border-[#DCE2DA] dark:border-[#26322B]'
                }`}
              >
                {PORTION_MULTIPLIERS[size].label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCookedInExtraOil((v) => !v)}
              className={`flex-1 min-w-[130px] h-10 px-3 rounded-xl text-xs font-medium border cursor-pointer ${
                cookedInExtraOil
                  ? 'bg-[#C98A3A]/15 dark:bg-[#E0A352]/18 border-[#C98A3A]/50 text-[#8C6126] dark:text-[#E0A352]'
                  : 'bg-white dark:bg-[#171F1B] border-[#DCE2DA] dark:border-[#26322B]'
              }`}
            >
              {cookedInExtraOil ? 'Ekstra yağlı (+)' : 'Normal yağ'}
            </button>

            <div className="flex items-center gap-1 bg-white dark:bg-[#171F1B] border border-[#DCE2DA] dark:border-[#26322B] rounded-xl px-2 h-10">
              <button
                type="button"
                onClick={() =>
                  setServingCount((c) => {
                    const step = c <= 1.5 ? 0.25 : 0.5;
                    return Math.max(0.25, Number((c - step).toFixed(2)));
                  })
                }
                className="w-7 h-7 font-bold cursor-pointer"
                aria-label="Miktarı azalt"
              >
                −
              </button>
              <span className="text-xs font-semibold tabular-nums w-11 text-center">
                {servingCount}×
              </span>
              <button
                type="button"
                onClick={() =>
                  setServingCount((c) => {
                    const step = c < 1.5 ? 0.25 : 0.5;
                    return Math.min(6, Number((c + step).toFixed(2)));
                  })
                }
                className="w-7 h-7 font-bold cursor-pointer"
                aria-label="Miktarı artır"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onDelete(meal.id);
              onClose();
            }}
            className="h-11 px-4 rounded-2xl text-xs font-semibold text-[#A26D27] dark:text-[#E0A352] bg-[#C98A3A]/12 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Sil</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSave({
                ...meal,
                base: {
                  ...meal.base,
                  name: name.trim() || meal.base.name,
                  portionLabel: portionLabel.trim() || meal.base.portionLabel,
                },
                portionSize,
                servingCount,
                cookedInExtraOil,
              })
            }
            className="h-11 px-5 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Kaydet ({preview.caloriesMin}–{preview.caloriesMax} kcal)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
