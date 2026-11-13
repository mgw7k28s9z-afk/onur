import React, { useRef, useState } from 'react';
import {
  Utensils,
  Trash2,
  Bookmark,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Edit3,
} from 'lucide-react';
import type { MealEntry } from '../types/nutrition';
import { PORTION_MULTIPLIERS, computeMealTotals } from '../utils/nutritionMath';

interface MealCardProps {
  meal: MealEntry;
  onDelete: (id: string) => void;
  onFavoriteOrRepeat: (meal: MealEntry) => void;
  onLongPressEdit: (meal: MealEntry) => void;
}

export const MealCard: React.FC<MealCardProps> = ({
  meal,
  onDelete,
  onFavoriteOrRepeat,
  onLongPressEdit,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const lockedAxisRef = useRef<'x' | 'y' | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const movedRef = useRef(false);

  const totals = computeMealTotals(meal);
  const timeStr = new Date(meal.createdAt).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const resetDragVisuals = () => {
    currentOffsetRef.current = 0;
    setIsDragging(false);
    setOffsetX(0);
    lockedAxisRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = 0;
    lockedAxisRef.current = null;
    movedRef.current = false;
    setIsDragging(true);

    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      if (!movedRef.current) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(12);
          } catch {
            // ignore
          }
        }
        resetDragVisuals();
        onLongPressEdit(meal);
      }
    }, 460);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
      movedRef.current = true;
      clearLongPress();
    }

    if (!lockedAxisRef.current) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        lockedAxisRef.current = 'x';
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore if pointer already released
        }
      } else if (Math.abs(dy) > 12) {
        lockedAxisRef.current = 'y';
        resetDragVisuals();
        return;
      }
    }

    if (lockedAxisRef.current === 'x') {
      const clamped = Math.max(-116, Math.min(116, dx));
      currentOffsetRef.current = clamped;
      setOffsetX(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    const finalOffset = currentOffsetRef.current;
    if (lockedAxisRef.current === 'x') {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      if (finalOffset <= -64) {
        onDelete(meal.id);
      } else if (finalOffset >= 64) {
        onFavoriteOrRepeat(meal);
      }
    }
    resetDragVisuals();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    resetDragVisuals();
  };

  const portionName = PORTION_MULTIPLIERS[meal.portionSize]?.label ?? 'Normal';
  const confidenceIcon =
    meal.base.confidence === 'yüksek' ? (
      <CheckCircle2 className="w-3 h-3 text-[#2D8256] dark:text-[#78D0A1]" />
    ) : (
      <HelpCircle className="w-3 h-3 text-[#9B743B] dark:text-[#E0A352]" />
    );

  return (
    <div className="relative overflow-hidden rounded-3xl gesture-surface touch-pan-y">
      {/* Underlying swipe action cues */}
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none">
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold transition-opacity ${
            offsetX > 16 ? 'opacity-100 text-[#226B44] dark:text-[#78D0A1]' : 'opacity-0'
          }`}
        >
          {meal.isFavorite ? <RotateCcw className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          <span>{meal.isFavorite ? 'Tekrar ekle' : 'Favoriye ekle'}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold transition-opacity ${
            offsetX < -16 ? 'opacity-100 text-[#A26D27] dark:text-[#E0A352]' : 'opacity-0'
          }`}
        >
          <span>Sil</span>
          <Trash2 className="w-4 h-4" />
        </div>
      </div>

      {/* Foreground draggable meal card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => {
          if (!((e.target as HTMLElement).closest('a, button'))) {
            e.preventDefault();
          }
        }}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {/* User's actual uploaded food photo if present */}
        {meal.photoDataUrl && (
          <div className="relative h-36 w-full bg-[#E9EDE6] dark:bg-[#1E2823] overflow-hidden">
            <img
              src={meal.photoDataUrl}
              alt={meal.base.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold leading-snug drop-shadow-sm truncate">
                  {meal.base.name}
                </h3>
                <div className="text-xs text-white/90 flex items-center gap-1.5 mt-0.5">
                  <span className="shrink-0">{timeStr}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">
                    {meal.servingCount !== 1 ? `${meal.servingCount}× ` : ''}
                    {meal.base.portionLabel} ({portionName})
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <div className="text-[15px] font-bold tabular-nums drop-shadow-sm">
                  {totals.caloriesMin}–{totals.caloriesMax}
                </div>
                <div className="text-[11px] text-white/85">kcal</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-2.5">
          {/* Header when there is no photo (text / barcode / favorite entry) */}
          {!meal.photoDataUrl && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#E5F6EC] dark:bg-[#1D3529] flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug truncate">
                    {meal.base.name}
                  </h3>
                  <div className="text-xs text-[#69756D] dark:text-[#93A097] flex items-center gap-1.5 mt-0.5">
                    <span className="shrink-0">{timeStr}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">
                      {meal.servingCount !== 1 ? `${meal.servingCount}× ` : ''}
                      {meal.base.portionLabel} ({portionName})
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-bold tabular-nums">
                  {totals.caloriesMin}–{totals.caloriesMax} kcal
                </div>
              </div>
            </div>
          )}

          {/* Metadata row (unboxed text, never pill sandwiches) */}
          <div className="flex items-center justify-between text-xs text-[#5E6A62] dark:text-[#9BA8A0]">
            <div className="flex items-center gap-1.5">
              {confidenceIcon}
              <span>güven: {meal.base.confidence}</span>
              {meal.cookedInExtraOil && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>ekstra yağlı</span>
                </>
              )}
              {meal.isFavorite && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#2D8256] dark:text-[#78D0A1] font-medium">favori</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] bg-[#E5F6EC] dark:bg-[#1B3125] px-2.5 py-1 rounded-xl cursor-pointer active:scale-95 transition-transform"
            >
              <span>{showDetails ? 'Gizle' : 'Detay'}</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Allergen reminder if relevant */}
          {meal.base.detectedAllergens.length > 0 && (
            <div className="flex items-start gap-2 text-[11px] text-[#966524] dark:text-[#E0A352] bg-[#C98A3A]/10 dark:bg-[#E0A352]/12 rounded-2xl px-3 py-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {meal.base.detectedAllergens.join(', ')} içerebilir. İçindekiler listesini mutlaka kontrol et.
              </span>
            </div>
          )}

          {/* Impact card (2-3 calm lines generated specifically for this meal) */}
          {meal.impact && (
            <div className="pt-2.5 border-t border-[#ECEFE9] dark:border-[#242E29] space-y-1 text-[12.5px] leading-relaxed text-[#38443C] dark:text-[#CBD5CE]">
              <p>{meal.impact.whatItContains}</p>
              <p>{meal.impact.generalEffect}</p>
              <p className="text-[#2D7751] dark:text-[#8CE0B4]">{meal.impact.gentleSuggestion}</p>
              <p className="text-[10.5px] text-[#7B877F] dark:text-[#7D8A82]">
                {meal.impact.disclaimer}
              </p>
            </div>
          )}

          {/* Expandable macro, source breakdown & accessible one-tap card actions */}
          {showDetails && (
            <div className="pt-2.5 border-t border-[#ECEFE9] dark:border-[#242E29] space-y-2.5 text-xs">
              <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] py-2">
                  <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Protein</div>
                  <div className="font-semibold">{totals.proteinG} g</div>
                </div>
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] py-2">
                  <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Karb</div>
                  <div className="font-semibold">{totals.carbsG} g</div>
                </div>
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] py-2">
                  <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Yağ</div>
                  <div className="font-semibold">{totals.fatG} g</div>
                </div>
                <div className="rounded-xl bg-[#F4F6F2] dark:bg-[#101713] py-2">
                  <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Lif</div>
                  <div className="font-semibold">{totals.fiberG} g</div>
                </div>
              </div>

              {meal.base.sources.length > 0 && (
                <div className="text-[11px] text-[#69756D] dark:text-[#8E9B92] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Kaynak:</span>
                  {meal.base.sources.map((src, i) =>
                    src.url ? (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-[#2D8256] dark:text-[#78D0A1]"
                      >
                        {src.title}
                      </a>
                    ) : (
                      <span key={i}>{src.title}</span>
                    )
                  )}
                </div>
              )}

              {/* Direct tap actions alongside swipe & long-press */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onLongPressEdit(meal)}
                  className="flex-1 min-w-[90px] h-9 px-2.5 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] text-[#1C593A] dark:text-[#9FE2BD] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Düzenle</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFavoriteOrRepeat(meal)}
                  className="flex-1 min-w-[96px] h-9 px-2.5 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] text-[#1C593A] dark:text-[#9FE2BD] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  {meal.isFavorite ? <RotateCcw className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                  <span>{meal.isFavorite ? 'Tekrar Ekle' : 'Favorile'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(meal.id)}
                  className="h-9 px-3 rounded-xl bg-[#C98A3A]/12 hover:bg-[#C98A3A]/20 text-[#966524] dark:text-[#E0A352] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sil</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
