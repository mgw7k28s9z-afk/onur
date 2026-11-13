import React, { useRef, useState } from 'react';
import {
  X,
  Check,
  Edit3,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import type { NutritionBase, PortionSize, UserProfile } from '../types/nutrition';
import { PORTION_MULTIPLIERS, computeMealTotals } from '../utils/nutritionMath';
import { recalculateCorrectedMealApi } from '../services/aiClient';

interface AnalysisResultSheetProps {
  initialNutrition: NutritionBase;
  photoDataUrl?: string;
  profile: UserProfile;
  onClose: () => void;
  onConfirmSave: (params: {
    base: NutritionBase;
    portionSize: PortionSize;
    servingCount: number;
    cookedInExtraOil: boolean;
  }) => void;
}

export const AnalysisResultSheet: React.FC<AnalysisResultSheetProps> = ({
  initialNutrition,
  photoDataUrl,
  profile,
  onClose,
  onConfirmSave,
}) => {
  const [base, setBase] = useState<NutritionBase>(initialNutrition);
  const [portionSize, setPortionSize] = useState<PortionSize>('normal');
  const [servingCount, setServingCount] = useState<number>(1);
  const [cookedInExtraOil, setCookedInExtraOil] = useState<boolean>(false);

  const [expanded, setExpanded] = useState<boolean>(false);
  const [dragY, setDragY] = useState<number>(0);
  const dragStartYRef = useRef<number | null>(null);
  const dragYRef = useRef<number>(0);

  // Manual correction & clarification answer state
  const [editingName, setEditingName] = useState<boolean>(false);
  const [correctedName, setCorrectedName] = useState<string>(initialNutrition.name);
  const [clarificationAnswer, setClarificationAnswer] = useState<string>('');
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  const totals = computeMealTotals({
    base,
    portionSize,
    servingCount,
    cookedInExtraOil,
  });

  // Check overlap with user allergies
  const matchedAllergens = base.detectedAllergens.filter((a) =>
    profile.allergies.some(
      (ua) =>
        ua.toLowerCase().includes(a.toLowerCase()) ||
        a.toLowerCase().includes(ua.toLowerCase())
    )
  );
  const displayedAllergens =
    matchedAllergens.length > 0 ? matchedAllergens : base.detectedAllergens;

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStartYRef.current = e.clientY;
    dragYRef.current = 0;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = e.clientY - dragStartYRef.current;
    dragYRef.current = dy;
    setDragY(dy);
  };

  const handleHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    const finalDy = e.clientY - dragStartYRef.current || dragYRef.current;
    if (finalDy > 72) {
      onClose();
    } else if (finalDy < -48) {
      setExpanded(true);
    } else if (expanded && finalDy > 30) {
      setExpanded(false);
    }
    dragStartYRef.current = null;
    dragYRef.current = 0;
    setDragY(0);
  };

  const handleHandlePointerCancel = () => {
    dragStartYRef.current = null;
    dragYRef.current = 0;
    setDragY(0);
  };

  const handleRecalculate = async () => {
    if (!correctedName.trim()) return;
    setIsRecalculating(true);
    setRecalcError(null);
    try {
      const updated = await recalculateCorrectedMealApi({
        correctedName: correctedName.trim(),
        userAnswer: clarificationAnswer.trim() || undefined,
        currentPortionLabel: base.portionLabel,
        profile,
      });
      setBase(updated);
      setEditingName(false);
      setClarificationAnswer('');
    } catch (err) {
      setRecalcError(err instanceof Error ? err.message : 'Yeniden hesaplanamadı, tekrar dene.');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="absolute inset-0 z-40 flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
    >
      <div
        style={{
          transform: dragY !== 0 ? `translate3d(0, ${Math.max(-24, dragY)}px, 0)` : undefined,
          transition: dragStartYRef.current !== null ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`animate-sheet-up w-full rounded-t-[32px] bg-[#F7F8F5] dark:bg-[#141C18] border-t border-[#DCE2DA] dark:border-[#26322B] shadow-2xl flex flex-col overflow-hidden transition-[max-height] duration-300 ${
          expanded ? 'max-h-[94%]' : 'max-h-[84%]'
        }`}
      >
        {/* Drag handle: pull down to close, pull up to expand details */}
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerCancel}
          className="pt-3 pb-2 px-5 flex flex-col items-center cursor-ns-resize touch-none gesture-surface shrink-0"
        >
          <div className="w-10 h-1.5 rounded-full bg-[#C7CFC4] dark:bg-[#344239]" />
          <div className="w-full flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] bg-[#E5F6EC] dark:bg-[#1B3125] px-2.5 py-1 rounded-xl inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
            >
              {expanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Ayrıntıları daralt</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Yukarı çek · Ayrıntılar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 -mr-1.5 rounded-full flex items-center justify-center text-[#59655D] dark:text-[#9AA89F] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto ios-scroll px-5 pb-4 space-y-4">
          {/* Header with optional real photo thumbnail */}
          <div className="flex items-start gap-3.5">
            {photoDataUrl && (
              <img
                src={photoDataUrl}
                alt={base.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-[#DCE2DA] dark:border-[#26322B]"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold leading-snug text-[#1C241F] dark:text-[#EDF1ED]">
                  {base.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingName((v) => !v)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] py-1 px-2.5 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] cursor-pointer active:scale-95 transition-transform"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Düzelt</span>
                </button>
              </div>
              <div className="text-xs text-[#59655D] dark:text-[#9AA89F] flex items-center gap-1.5 mt-1">
                <span>{base.portionLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  {base.confidence === 'yüksek' ? (
                    <CheckCircle2 className="w-3 h-3 text-[#2D8256] dark:text-[#78D0A1]" />
                  ) : (
                    <HelpCircle className="w-3 h-3 text-[#B67E32] dark:text-[#E0A352]" />
                  )}
                  güven: {base.confidence}
                </span>
              </div>
            </div>
          </div>

          {/* Calculated Calorie Range Display */}
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-[#69756D] dark:text-[#93A097]">Tahmini enerji aralığı</div>
              <div className="text-xl min-[380px]:text-2xl font-bold tabular-nums mt-0.5">
                {totals.caloriesMin}–{totals.caloriesMax}{' '}
                <span className="text-sm font-normal text-[#69756D] dark:text-[#93A097]">kcal</span>
              </div>
            </div>
            <div className="text-right text-xs text-[#59655D] dark:text-[#9AA89F] tabular-nums space-y-0.5 shrink-0">
              <div>Protein {totals.proteinG} g</div>
              <div>Karb {totals.carbsG} g · Yağ {totals.fatG} g</div>
            </div>
          </div>

          {/* Counted items breakdown */}
          {base.itemsBreakdown && base.itemsBreakdown.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] px-4 py-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#59655D] dark:text-[#9AA89F]">
                Fotoğrafta hesaplanan miktar (1× tamamı)
              </div>
              <div className="space-y-1">
                {base.itemsBreakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs text-[#2E3832] dark:text-[#D5DFD8]"
                  >
                    <span className="truncate">
                      {item.name} · <span className="text-[#69756D] dark:text-[#93A097]">{item.quantityLabel}</span>
                      {item.estimatedGrams > 0 ? (
                        <span className="text-[#69756D] dark:text-[#93A097]"> (~{item.estimatedGrams} g)</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums font-medium shrink-0 text-[#2D8256] dark:text-[#78D0A1]">
                      {item.caloriesMin}–{item.caloriesMax} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual name correction or AI clarification question */}
          {(editingName || base.clarificationQuestion) && (
            <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
              {base.clarificationQuestion && (
                <p className="text-xs font-medium text-[#8C6126] dark:text-[#E0A352]">
                  {base.clarificationQuestion}
                </p>
              )}
              {editingName && (
                <div>
                  <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">
                    Yemek adını düzelt
                  </label>
                  <input
                    type="text"
                    value={correctedName}
                    onChange={(e) => setCorrectedName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm outline-none"
                  />
                </div>
              )}
              <div>
                <input
                  type="text"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  placeholder="Ek detay (ör. tereyağsız, 1 kepçe, az peynirli)"
                  className="w-full h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs outline-none"
                />
              </div>
              {recalcError && (
                <p className="text-xs text-[#A26D27] dark:text-[#E0A352]">{recalcError}</p>
              )}
              <button
                type="button"
                disabled={isRecalculating}
                onClick={handleRecalculate}
                className="w-full h-10 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                {isRecalculating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Yeniden hesaplanıyor...</span>
                  </>
                ) : (
                  <span>Bilgiye Göre Yeniden Hesapla</span>
                )}
              </button>
            </div>
          )}

          {/* One-tap adjustments (real math recalculation) */}
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#59655D] dark:text-[#9AA89F]">
                Tek Dokunuşla Porsiyon & Pişirme
              </div>
              <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">
                1× = görselin tamamı
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['kucuk', 'normal', 'buyuk'] as PortionSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPortionSize(size)}
                  className={`h-10 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                    portionSize === size
                      ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60'
                      : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                  }`}
                >
                  {PORTION_MULTIPLIERS[size].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCookedInExtraOil((v) => !v)}
                className={`flex-1 min-w-[140px] h-10 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  cookedInExtraOil
                    ? 'bg-[#C98A3A]/15 dark:bg-[#E0A352]/18 border-[#C98A3A]/50 text-[#8C6126] dark:text-[#E0A352]'
                    : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                }`}
              >
                {cookedInExtraOil ? 'Yağda pişti (+ek yağ)' : 'Yağda mı pişti?'}
              </button>

              <div className="flex items-center gap-1 bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] rounded-xl px-2 h-10">
                <button
                  type="button"
                  onClick={() =>
                    setServingCount((c) => {
                      const step = c <= 1.5 ? 0.25 : 0.5;
                      return Math.max(0.25, Number((c - step).toFixed(2)));
                    })
                  }
                  className="w-7 h-7 flex items-center justify-center text-sm font-bold cursor-pointer"
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
                  className="w-7 h-7 flex items-center justify-center text-sm font-bold cursor-pointer"
                  aria-label="Miktarı artır"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Allergy caution */}
          {displayedAllergens.length > 0 && (
            <div className="rounded-2xl bg-[#C98A3A]/12 dark:bg-[#E0A352]/14 p-3.5 flex items-start gap-2.5 text-xs text-[#8C6126] dark:text-[#E0A352]">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>{displayedAllergens.join(', ')}</strong> içerebilir. İçindekiler listesini mutlaka kontrol et.
              </span>
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 tabular-nums">
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] p-2.5">
                  <div className="text-[#69756D] dark:text-[#8E9B92]">Lif</div>
                  <div className="font-semibold mt-0.5">{totals.fiberG} g</div>
                </div>
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] p-2.5">
                  <div className="text-[#69756D] dark:text-[#8E9B92]">Şeker</div>
                  <div className="font-semibold mt-0.5">{totals.sugarG} g</div>
                </div>
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] p-2.5">
                  <div className="text-[#69756D] dark:text-[#8E9B92]">Sodyum</div>
                  <div className="font-semibold mt-0.5">{totals.sodiumMg} mg</div>
                </div>
              </div>

              {base.ingredients.length > 0 && (
                <div>
                  <div className="font-semibold text-[#59655D] dark:text-[#9AA89F] mb-1">
                    Tahmini bileşenler
                  </div>
                  <p className="text-[#3A463E] dark:text-[#C8D2CB] leading-relaxed">
                    {base.ingredients.join(', ')}
                  </p>
                </div>
              )}

              {base.sources.length > 0 && (
                <div className="pt-2 border-t border-[#ECEFE9] dark:border-[#242E29]">
                  <div className="font-semibold text-[#59655D] dark:text-[#9AA89F] mb-1">
                    Dayanak Kaynaklar
                  </div>
                  <div className="space-y-1">
                    {base.sources.map((src, idx) =>
                      src.url ? (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[#5A7D65] dark:text-[#7FA68B] underline"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <div key={idx} className="text-[#69756D] dark:text-[#93A097]">
                          {src.title}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Confirm CTA */}
        <div className="px-5 pt-3.5 safe-bottom-lg bg-white/95 dark:bg-[#171F1B]/95 border-t border-[#E5E9E2] dark:border-[#242E29] shrink-0">
          <button
            type="button"
            onClick={() =>
              onConfirmSave({
                base,
                portionSize,
                servingCount,
                cookedInExtraOil,
              })
            }
            className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Bugüne Kaydet ({totals.caloriesMin}–{totals.caloriesMax} kcal)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
