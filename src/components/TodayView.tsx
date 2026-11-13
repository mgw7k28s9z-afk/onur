import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Sparkles,
  BookOpen,
  ChefHat,
  Loader2,
  X,
  ImagePlus,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import type {
  DailyAdvice,
  DayLog,
  MealEntry,
  UserProfile,
  WhatToEatSuggestion,
} from '../types/nutrition';
import {
  calculateCalorieTarget,
  calculateWaterTargetMl,
  computeDayTotals,
  formatTurkishDateLabel,
  getTodayDateKey,
  shiftDateKey,
} from '../utils/nutritionMath';
import { ActivityRings } from './ActivityRings';
import { MealCard } from './MealCard';
import { QuickEditMealModal } from './QuickEditMealModal';
import { generateDailyAdviceApi, generateWhatToEatApi } from '../services/aiClient';
import { compressImageFile } from '../utils/storage';
import { PhotoSourceSheet } from './PhotoSourceSheet';

interface TodayViewProps {
  selectedDateKey: string;
  onChangeDateKey: (dateKey: string) => void;
  dayLog: DayLog;
  profile: UserProfile;
  dailyAdvice?: DailyAdvice;
  onSaveDailyAdvice: (advice: DailyAdvice) => void;
  onAddWater: (deltaMl: number) => void;
  onDeleteMeal: (id: string) => void;
  onFavoriteOrRepeatMeal: (meal: MealEntry) => void;
  onUpdateMeal: (meal: MealEntry) => void;
  onGoToLogTab: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  selectedDateKey,
  onChangeDateKey,
  dayLog,
  profile,
  dailyAdvice,
  onSaveDailyAdvice,
  onAddWater,
  onDeleteMeal,
  onFavoriteOrRepeatMeal,
  onUpdateMeal,
  onGoToLogTab,
}) => {
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // "Ne yesem?" modal state
  const [whatOpen, setWhatOpen] = useState(false);
  const [whatLoading, setWhatLoading] = useState(false);
  const [whatError, setWhatError] = useState<string | null>(null);
  const [whatIntro, setWhatIntro] = useState<string>('');
  const [whatSuggestions, setWhatSuggestions] = useState<WhatToEatSuggestion[]>([]);
  const [fridgePreviewUrl, setFridgePreviewUrl] = useState<string | null>(null);
  const [fridgePayload, setFridgePayload] = useState<{ base64: string; mimeType: string } | null>(
    null
  );
  const [fridgeSheetOpen, setFridgeSheetOpen] = useState(false);

  // Horizontal day swipe tracking on header + rings container
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);

  const todayKey = getTodayDateKey();
  const canGoNext = selectedDateKey < todayKey;
  const calorieBreakdown = calculateCalorieTarget(profile);
  const waterInfo = calculateWaterTargetMl(profile);
  const dayTotals = computeDayTotals(dayLog.meals);

  const remainingMin = Math.max(0, calorieBreakdown.targetCalories - dayTotals.caloriesMax);
  const remainingMax = Math.max(0, calorieBreakdown.targetCalories - dayTotals.caloriesMin);

  const handleDaySwipeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    swipeStartXRef.current = e.clientX;
    swipeStartYRef.current = e.clientY;
  };

  const handleDaySwipeCancel = () => {
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  const handleDaySwipeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;
    const dx = e.clientX - swipeStartXRef.current;
    const dy = e.clientY - swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;

    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      if (dx > 0) {
        onChangeDateKey(shiftDateKey(selectedDateKey, -1));
      } else if (canGoNext) {
        onChangeDateKey(shiftDateKey(selectedDateKey, 1));
      }
    }
  };

  const handleGenerateAdvice = async () => {
    if (dayLog.meals.length === 0 && dayLog.waterMl === 0) return;
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      const mealListStr =
        dayLog.meals.length > 0
          ? dayLog.meals.map((m) => `${m.base.name} (${m.base.portionLabel})`).join(', ')
          : 'Henüz öğün eklenmedi';
      const totalsStr = `${dayTotals.caloriesMin}-${dayTotals.caloriesMax} kcal, Protein ${dayTotals.proteinG}g, Lif ${dayTotals.fiberG}g, Karbonhidrat ${dayTotals.carbsG}g, Yağ ${dayTotals.fatG}g`;
      const result = await generateDailyAdviceApi({
        dayMealsSummary: mealListStr,
        totalsSummary: totalsStr,
        waterMl: dayLog.waterMl,
        waterTargetMl: waterInfo.targetMl,
        profile,
      });
      onSaveDailyAdvice({
        dateKey: selectedDateKey,
        mealCountAtGeneration: dayLog.meals.length,
        waterMlAtGeneration: dayLog.waterMl,
        ...result,
      });
    } catch (err) {
      setAdviceError(err instanceof Error ? err.message : 'Tavsiye oluşturulamadı.');
    } finally {
      setAdviceLoading(false);
    }
  };

  const handleFetchWhatToEat = async (customFridge?: { base64: string; mimeType: string }) => {
    setWhatLoading(true);
    setWhatError(null);
    try {
      const missingParts: string[] = [];
      if (dayTotals.fiberG < 18) missingParts.push(`Lif (şu an ${dayTotals.fiberG} g)`);
      if (dayTotals.proteinG < 45) missingParts.push(`Protein (şu an ${dayTotals.proteinG} g)`);
      if (dayLog.waterMl < waterInfo.targetMl * 0.6) {
        missingParts.push(`Su (${dayLog.waterMl}/${waterInfo.targetMl} ml)`);
      }

      const activeFridge = customFridge ?? fridgePayload;
      const result = await generateWhatToEatApi({
        remainingCalMin: remainingMin,
        remainingCalMax: remainingMax,
        dayMealsSummary:
          dayLog.meals.map((m) => `${m.base.name} (${m.base.portionLabel})`).join(', ') ||
          'Henüz öğün kaydı yok',
        missingSummary: missingParts.join(', ') || 'Genel denge',
        profile,
        fridgeImageBase64: activeFridge?.base64,
        fridgeMimeType: activeFridge?.mimeType,
      });
      setWhatIntro(result.intro);
      setWhatSuggestions(result.suggestions);
    } catch (err) {
      setWhatError(err instanceof Error ? err.message : 'Öneriler oluşturulamadı, tekrar dene.');
    } finally {
      setWhatLoading(false);
    }
  };

  const processFridgeFile = async (file: File) => {
    try {
      const compressed = await compressImageFile(file, 960, 0.78);
      setFridgePreviewUrl(compressed.dataUrl);
      const payload = { base64: compressed.base64, mimeType: compressed.mimeType };
      setFridgePayload(payload);
      await handleFetchWhatToEat(payload);
    } catch (err) {
      setWhatError(err instanceof Error ? err.message : 'Buzdolabı fotoğrafı okunamadı.');
    }
  };

  const adviceStale =
    dailyAdvice &&
    (dailyAdvice.mealCountAtGeneration !== dayLog.meals.length ||
      Math.abs(dailyAdvice.waterMlAtGeneration - dayLog.waterMl) >= 400);

  return (
    <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-6 space-y-4">
      {/* Top date header + horizontal day-swipe area */}
      <div
        onPointerDown={handleDaySwipeStart}
        onPointerUp={handleDaySwipeEnd}
        onPointerCancel={handleDaySwipeCancel}
        className="pt-2 space-y-3 gesture-surface touch-pan-y"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#69756D] dark:text-[#93A097]">
              {profile.name ? `Merhaba ${profile.name}` : 'Günlük özet'}
            </p>
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              {formatTurkishDateLabel(selectedDateKey)}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeDateKey(shiftDateKey(selectedDateKey, -1))}
              className="w-10 h-10 rounded-full bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] flex items-center justify-center text-[#1C593A] dark:text-[#9FE2BD] cursor-pointer active:scale-95 transition-transform"
              aria-label="Önceki gün"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => onChangeDateKey(shiftDateKey(selectedDateKey, 1))}
              className="w-10 h-10 rounded-full bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] flex items-center justify-center text-[#1C593A] dark:text-[#9FE2BD] disabled:opacity-35 cursor-pointer active:scale-95 transition-transform"
              aria-label="Sonraki gün"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calorie & Water Rings */}
        <ActivityRings
          caloriesMin={dayTotals.caloriesMin}
          caloriesMax={dayTotals.caloriesMax}
          caloriesMid={dayTotals.caloriesMid}
          calorieBreakdown={calorieBreakdown}
          waterMl={dayLog.waterMl}
          waterTargetMl={waterInfo.targetMl}
          onAddWater={onAddWater}
        />
      </div>

      {/* Meals Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold tracking-tight">Öğünler</h2>
          {dayLog.meals.length > 0 && (
            <span className="text-xs text-[#69756D] dark:text-[#93A097] tabular-nums">
              {dayLog.meals.length} kayıt
            </span>
          )}
        </div>

        {dayLog.meals.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center mx-auto">
              <Camera className="w-5 h-5 text-[#2D8256] dark:text-[#78D0A1]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold">Henüz öğün eklenmedi</h3>
              <p className="text-xs leading-relaxed text-[#69756D] dark:text-[#93A097] max-w-[250px] mx-auto">
                Tabağının fotoğrafını çek, ürün etiketi okut veya ne yediğini yazarak sakin bir şekilde takip et.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToLogTab}
              className="h-11 px-5 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>İlk Öğününü Kaydet</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayLog.meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={onDeleteMeal}
                onFavoriteOrRepeat={onFavoriteOrRepeatMeal}
                onLongPressEdit={(m) => setEditingMeal(m)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Short Card 1: Günün Tavsiyesi */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
            <h2 className="text-sm font-bold">Günün Tavsiyesi</h2>
          </div>
          {dayLog.meals.length > 0 && (
            <button
              type="button"
              disabled={adviceLoading}
              onClick={handleGenerateAdvice}
              className="text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] rounded-xl cursor-pointer py-1 px-2.5 active:scale-95 transition-all"
            >
              {adviceLoading
                ? 'Hazırlanıyor...'
                : dailyAdvice
                ? adviceStale
                  ? 'Güncelle'
                  : 'Yenile'
                : 'Oluştur'}
            </button>
          )}
        </div>

        {adviceError && <p className="text-xs text-[#A26D27] dark:text-[#E0A352]">{adviceError}</p>}

        {dailyAdvice ? (
          <div className="space-y-1.5">
            <div className="text-[13px] font-semibold">{dailyAdvice.title}</div>
            <p className="text-xs leading-relaxed text-[#455249] dark:text-[#C0CCC4]">
              {dailyAdvice.advice}
            </p>
            <div className="text-[11px] text-[#69756D] dark:text-[#8E9B92] flex flex-wrap items-center gap-2 pt-0.5">
              <span>Kaynak: {dailyAdvice.sourceLabel}</span>
              {dailyAdvice.sources.slice(0, 2).map((s, idx) =>
                s.url ? (
                  <a
                    key={idx}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 underline text-[#5A7D65] dark:text-[#7FA68B]"
                  >
                    <span>{s.title}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : null
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[#69756D] dark:text-[#93A097]">
            {dayLog.meals.length === 0
              ? 'Bugün ilk öğününü kaydettiğinde, yediklerine özel kısa bir denge tavsiyesi burada oluşturulabilir.'
              : 'Bugün kaydettiklerine göre kaynaklı bir besin tavsiyesi oluşturmak için "Oluştur"a dokun.'}
          </p>
        )}
      </section>

      {/* Short Card 2: Tek bir "Ne yesem?" kartı */}
      <section className="rounded-3xl bg-[#E8F7EE] dark:bg-[#193023] border border-[#C3E9D3] dark:border-[#2B4B39] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-bold text-[#14472D] dark:text-[#A8E6C3]">
              <ChefHat className="w-4 h-4 shrink-0" />
              <span>Ne yesem?</span>
            </div>
            <p className="text-xs text-[#2B6647] dark:text-[#96D1B0]">
              Kalan {remainingMin}–{remainingMax} kcal için ev yemeklerinden fikir al
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setWhatOpen(true);
              if (whatSuggestions.length === 0) {
                void handleFetchWhatToEat();
              }
            }}
            className="h-10 px-4 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-xs font-semibold shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            Fikir Al
          </button>
        </div>
      </section>

      {/* Long-press quick-edit modal */}
      {editingMeal && (
        <QuickEditMealModal
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={(updated) => {
            onUpdateMeal(updated);
            setEditingMeal(null);
          }}
          onDelete={onDeleteMeal}
        />
      )}

      {/* "Ne yesem?" Bottom Sheet Modal */}
      {whatOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setWhatOpen(false);
          }}
          className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
        >
          <div className="animate-sheet-up w-full max-h-[86%] rounded-t-[32px] bg-[#F7F8F5] dark:bg-[#141C18] border-t border-[#DCE2DA] dark:border-[#26322B] flex flex-col overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#E5E9E2] dark:border-[#242E29]">
              <div>
                <h3 className="text-base font-bold">Bugün İçin Fikirler</h3>
                <p className="text-[11px] text-[#69756D] dark:text-[#93A097]">
                  Diyet reçetesi değil, kalan dengene uygun öneriler
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatOpen(false)}
                className="w-10 h-10 -mr-1.5 rounded-full flex items-center justify-center text-[#59655D] cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto ios-scroll p-5 safe-bottom-lg space-y-4">
              {/* Fridge photo optional upload */}
              <div className="rounded-2xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {fridgePreviewUrl ? (
                    <img
                      src={fridgePreviewUrl}
                      alt="Buzdolabı içeriği"
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center shrink-0">
                      <ImagePlus className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">Evdeki malzemelerle öner</div>
                    <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
                      İstersen buzdolabı fotoğrafı ekle
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {fridgePreviewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFridgePreviewUrl(null);
                        setFridgePayload(null);
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F2F4F0] dark:bg-[#222C26] text-xs font-medium cursor-pointer"
                    >
                      Temizle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFridgeSheetOpen(true)}
                    className="h-9 px-3 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold inline-flex items-center cursor-pointer"
                  >
                    {fridgePreviewUrl ? 'Değiştir' : 'Fotoğraf Ekle'}
                  </button>
                </div>
              </div>

              {whatLoading ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-[#69756D] dark:text-[#93A097]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2D8256] dark:text-[#78D0A1]" />
                  <span>Türk mutfağından uygun fikirler hazırlanıyor...</span>
                </div>
              ) : whatError ? (
                <div className="rounded-2xl bg-white dark:bg-[#171F1B] p-4 text-center space-y-2">
                  <p className="text-xs text-[#A26D27] dark:text-[#E0A352]">{whatError}</p>
                  <button
                    type="button"
                    onClick={() => handleFetchWhatToEat()}
                    className="h-9 px-4 rounded-xl bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] text-xs font-semibold cursor-pointer"
                  >
                    Tekrar Dene
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {whatIntro && (
                    <p className="text-xs text-[#4C5950] dark:text-[#BCC8C0]">{whatIntro}</p>
                  )}
                  {whatSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold">{item.title}</h4>
                        <span className="text-xs font-semibold tabular-nums text-[#2D8256] dark:text-[#78D0A1] shrink-0">
                          {item.caloriesMin}–{item.caloriesMax} kcal
                        </span>
                      </div>
                      <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
                        {item.portionLabel}
                      </div>
                      <p className="text-xs leading-relaxed text-[#3E4A42] dark:text-[#CBD5CE]">
                        {item.whyItFits}
                      </p>
                      {item.allergenNote && (
                        <div className="flex items-start gap-1.5 text-[11px] text-[#8C6126] dark:text-[#E0A352] pt-1">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{item.allergenNote}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleFetchWhatToEat()}
                    className="w-full h-10 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Farklı Fikirler Üret</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <PhotoSourceSheet
        open={fridgeSheetOpen}
        title="Malzeme Fotoğrafı Ekle"
        subtitle="Buzdolabını veya malzemeleri çek ya da arşiv/dosyalardan seç"
        onClose={() => setFridgeSheetOpen(false)}
        onSelectFile={(file) => {
          void processFridgeFile(file);
        }}
      />
    </div>
  );
};
