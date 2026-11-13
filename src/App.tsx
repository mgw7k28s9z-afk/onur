import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Camera,
  MessageCircle,
  BarChart3,
  User,
  Droplets,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  AppState,
  ChatMessage,
  DailyAdvice,
  DayLog,
  FavoriteTemplate,
  MealEntry,
  MealInputMethod,
  NutritionBase,
  PortionSize,
  UserProfile,
} from './types/nutrition';
import {
  EMPTY_APP_STATE,
  clearAppState,
  loadAppState,
  saveAppState,
} from './utils/storage';
import {
  calculateCalorieTarget,
  calculateWaterTargetMl,
  computeDayTotals,
  computeMealTotals,
  getTodayDateKey,
  shiftDateKey,
} from './utils/nutritionMath';
import { generateMealImpactApi } from './services/aiClient';
import { IPhoneFrame } from './components/IPhoneFrame';
import { OnboardingFlow } from './components/OnboardingFlow';
import { TodayView } from './components/TodayView';
import { LogTabView } from './components/LogTabView';
import { AssistantView } from './components/AssistantView';
import { SummaryView } from './components/SummaryView';
import { ProfileView } from './components/ProfileView';

type ActiveTab = 'bugun' | 'kaydet' | 'asistan' | 'ozet' | 'profil';

function isWithinQuietHours(startHHMM: string, endHHMM: string, now: Date): boolean {
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('bugun');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getTodayDateKey());

  // Undo snackbar on meal delete
  const [deletedUndo, setDeletedUndo] = useState<{ meal: MealEntry; dateKey: string } | null>(null);

  // In-app gentle water reminder banner
  const [waterReminderVisible, setWaterReminderVisible] = useState(false);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  // Persist every state change in localStorage
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Waking-hours in-app water reminder scheduler (only active while app is open)
  useEffect(() => {
    if (!state.profile.onboardingCompleted || state.profile.reminderCount <= 0) return;

    const waterTarget = calculateWaterTargetMl(state.profile).targetMl;
    const todayKey = getTodayDateKey();
    const todayWater = state.days[todayKey]?.waterMl ?? 0;
    if (todayWater >= waterTarget) return;

    // Approximate waking window ~14 hours (840 mins) divided by user's chosen count
    const intervalMs = Math.max(
      15 * 60 * 1000,
      Math.round((14 * 60 * 60 * 1000) / state.profile.reminderCount)
    );

    const timer = window.setInterval(() => {
      const now = new Date();
      if (!isWithinQuietHours(state.profile.quietHoursStart, state.profile.quietHoursEnd, now)) {
        const latestWater = state.days[getTodayDateKey()]?.waterMl ?? 0;
        if (latestWater < waterTarget) {
          setWaterReminderVisible(true);
        }
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    state.profile,
    state.days,
  ]);

  const getDayLog = (dateKey: string): DayLog => {
    return state.days[dateKey] ?? { dateKey, waterMl: 0, meals: [] };
  };

  const handleToggleTheme = () => {
    setState((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };

  const handleCompleteOnboarding = (profile: UserProfile) => {
    const todayKey = getTodayDateKey();
    setState((prev) => ({
      ...prev,
      profile,
      weightHistory: [
        ...prev.weightHistory.filter((w) => w.dateKey !== todayKey),
        { dateKey: todayKey, weightKg: profile.weightKg, recordedAt: new Date().toISOString() },
      ],
    }));
  };

  const handleAddWater = (deltaMl: number) => {
    setState((prev) => {
      const existing = prev.days[selectedDateKey] ?? {
        dateKey: selectedDateKey,
        waterMl: 0,
        meals: [],
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDateKey]: {
            ...existing,
            waterMl: Math.max(0, existing.waterMl + deltaMl),
          },
        },
      };
    });
    if (deltaMl > 0) setWaterReminderVisible(false);
  };

  const triggerMealImpactFetch = async (
    meal: MealEntry,
    dateKey: string,
    allMealsOnDay: MealEntry[],
    profile: UserProfile
  ) => {
    try {
      const mTotals = computeMealTotals(meal);
      const dayTotals = computeDayTotals(allMealsOnDay);
      const calTarget = calculateCalorieTarget(profile).targetCalories;
      const mealSummary = `${meal.base.name} (${meal.base.portionLabel}, ${mTotals.caloriesMin}-${mTotals.caloriesMax} kcal, Protein ${mTotals.proteinG}g, Karb ${mTotals.carbsG}g, Yağ ${mTotals.fatG}g, Lif ${mTotals.fiberG}g, Şeker ${mTotals.sugarG}g, Sodyum ${mTotals.sodiumMg}mg)`;
      const dayContext = `Bugün toplam ${allMealsOnDay.length} öğün, tahmini ${dayTotals.caloriesMin}-${dayTotals.caloriesMax} kcal (günlük hedef ${calTarget} kcal).`;

      const impact = await generateMealImpactApi({
        mealSummary,
        dayContext,
        profile,
      });

      setState((prev) => {
        const day = prev.days[dateKey];
        if (!day) return prev;
        return {
          ...prev,
          days: {
            ...prev.days,
            [dateKey]: {
              ...day,
              meals: day.meals.map((m) => (m.id === meal.id ? { ...m, impact } : m)),
            },
          },
        };
      });
    } catch {
      // If impact fetch fails, meal stays saved cleanly without fake fallback text
    }
  };

  const handleSaveMeal = (
    params: {
      base: NutritionBase;
      portionSize: PortionSize;
      servingCount: number;
      cookedInExtraOil: boolean;
      method: MealInputMethod;
      photoDataUrl?: string;
    },
    options?: { stayOnTab?: boolean }
  ) => {
    const newMeal: MealEntry = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dateKey: selectedDateKey,
      createdAt: new Date().toISOString(),
      method: params.method,
      photoDataUrl: params.photoDataUrl,
      base: params.base,
      portionSize: params.portionSize,
      servingCount: params.servingCount,
      cookedInExtraOil: params.cookedInExtraOil,
      impact: null,
    };

    const currentDay = state.days[selectedDateKey] ?? {
      dateKey: selectedDateKey,
      waterMl: 0,
      meals: [],
    };
    const updatedDayMeals = [newMeal, ...currentDay.meals];

    setState((prev) => {
      const day = prev.days[selectedDateKey] ?? {
        dateKey: selectedDateKey,
        waterMl: 0,
        meals: [],
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDateKey]: {
            ...day,
            meals: [newMeal, ...day.meals],
          },
        },
      };
    });

    if (!options?.stayOnTab) {
      setActiveTab('bugun');
    }
    void triggerMealImpactFetch(newMeal, selectedDateKey, updatedDayMeals, state.profile);
  };

  const handleDeleteMeal = (mealId: string) => {
    const day = getDayLog(selectedDateKey);
    const targetMeal = day.meals.find((m) => m.id === mealId);
    if (!targetMeal) return;

    setState((prev) => {
      const currentDay = prev.days[selectedDateKey];
      if (!currentDay) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDateKey]: {
            ...currentDay,
            meals: currentDay.meals.filter((m) => m.id !== mealId),
          },
        },
      };
    });

    setDeletedUndo({ meal: targetMeal, dateKey: selectedDateKey });
    window.setTimeout(() => {
      setDeletedUndo((curr) => (curr?.meal.id === mealId ? null : curr));
    }, 4500);
  };

  const handleUndoDelete = () => {
    if (!deletedUndo) return;
    const { meal, dateKey } = deletedUndo;
    setState((prev) => {
      const currentDay = prev.days[dateKey] ?? { dateKey, waterMl: 0, meals: [] };
      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...currentDay,
            meals: [meal, ...currentDay.meals],
          },
        },
      };
    });
    setDeletedUndo(null);
  };

  const handleFavoriteOrRepeatMeal = (meal: MealEntry) => {
    if (meal.isFavorite) {
      // Repeat log today
      handleSaveMeal({
        base: meal.base,
        portionSize: meal.portionSize,
        servingCount: meal.servingCount,
        cookedInExtraOil: meal.cookedInExtraOil,
        method: 'favori',
        photoDataUrl: meal.photoDataUrl,
      });
      return;
    }

    // Add to favorites & mark card
    const favTemplate: FavoriteTemplate = {
      id: `fav-${Date.now()}`,
      base: meal.base,
      defaultPortionSize: meal.portionSize,
      defaultExtraOil: meal.cookedInExtraOil,
      photoDataUrl: meal.photoDataUrl,
      useCount: 1,
      lastUsedAt: new Date().toISOString(),
    };

    setState((prev) => {
      const currentDay = prev.days[selectedDateKey];
      const alreadyExists = prev.favorites.some(
        (f) => f.base.name.toLowerCase() === meal.base.name.toLowerCase()
      );
      return {
        ...prev,
        favorites: alreadyExists ? prev.favorites : [favTemplate, ...prev.favorites],
        days: currentDay
          ? {
              ...prev.days,
              [selectedDateKey]: {
                ...currentDay,
                meals: currentDay.meals.map((m) =>
                  m.id === meal.id ? { ...m, isFavorite: true } : m
                ),
              },
            }
          : prev.days,
      };
    });
  };

  const handleRemoveFavorite = (favoriteId: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((f) => f.id !== favoriteId),
    }));
  };

  const handleUpdateMeal = (updated: MealEntry) => {
    setState((prev) => {
      const currentDay = prev.days[selectedDateKey];
      if (!currentDay) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDateKey]: {
            ...currentDay,
            meals: currentDay.meals.map((m) => (m.id === updated.id ? updated : m)),
          },
        },
      };
    });
  };

  const handleCopyYesterday = (): number => {
    const yesterdayKey = shiftDateKey(selectedDateKey, -1);
    const yesterdayMeals = state.days[yesterdayKey]?.meals ?? [];
    if (yesterdayMeals.length === 0) return 0;

    const clonedMeals: MealEntry[] = yesterdayMeals.map((m, idx) => ({
      ...m,
      id: `m-${Date.now()}-${idx}`,
      dateKey: selectedDateKey,
      createdAt: new Date().toISOString(),
      method: 'kopya',
    }));

    setState((prev) => {
      const currentDay = prev.days[selectedDateKey] ?? {
        dateKey: selectedDateKey,
        waterMl: 0,
        meals: [],
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDateKey]: {
            ...currentDay,
            meals: [...clonedMeals, ...currentDay.meals],
          },
        },
      };
    });
    return clonedMeals.length;
  };

  const handleSaveDailyAdvice = (advice: DailyAdvice) => {
    setState((prev) => ({
      ...prev,
      dailyAdviceByDate: {
        ...prev.dailyAdviceByDate,
        [advice.dateKey]: advice,
      },
    }));
  };

  const handleAppendChatMessages = (newMsgs: ChatMessage[]) => {
    setState((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, ...newMsgs],
    }));
  };

  const handleLogWeight = (weightKg: number) => {
    const todayKey = getTodayDateKey();
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, weightKg },
      weightHistory: [
        ...prev.weightHistory.filter((w) => w.dateKey !== todayKey),
        { dateKey: todayKey, weightKg, recordedAt: new Date().toISOString() },
      ],
    }));
  };

  const handleToggleRestDayToday = () => {
    const todayKey = getTodayDateKey();
    setState((prev) => {
      const existing = prev.days[todayKey] ?? { dateKey: todayKey, waterMl: 0, meals: [] };
      return {
        ...prev,
        days: {
          ...prev.days,
          [todayKey]: {
            ...existing,
            restDay: !existing.restDay,
          },
        },
      };
    });
  };

  const handleResetAllData = () => {
    clearAppState();
    setState(EMPTY_APP_STATE);
    setActiveTab('bugun');
    setSelectedDateKey(getTodayDateKey());
  };

  const currentDayLog = getDayLog(selectedDateKey);
  const yesterdayMeals = getDayLog(shiftDateKey(selectedDateKey, -1)).meals;

  return (
    <IPhoneFrame theme={state.theme} onToggleTheme={handleToggleTheme}>
      {!state.profile.onboardingCompleted ? (
        <OnboardingFlow
          initialProfile={state.profile}
          onComplete={handleCompleteOnboarding}
        />
      ) : (
        <>
          {/* Gentle in-app water reminder banner (only when open during waking hours) */}
          {waterReminderVisible && (
            <div className="mx-4 mt-2 mb-1 rounded-2xl bg-[#5B9BD5]/15 dark:bg-[#76B2E8]/18 border border-[#5B9BD5]/30 px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <Droplets className="w-4 h-4 text-[#356C9E] dark:text-[#76B2E8] shrink-0" />
                <span>Bir bardak su içmek için sakin bir mola</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAddWater(200)}
                  className="px-2.5 py-1 rounded-lg bg-[#5B9BD5] text-white text-[11px] font-semibold cursor-pointer"
                >
                  +200 ml
                </button>
                <button
                  type="button"
                  onClick={() => setWaterReminderVisible(false)}
                  className="p-1 text-[#59655D] dark:text-[#9AA89F] cursor-pointer"
                  aria-label="Kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Tab Screen (smooth fade transition, NO horizontal swipe between tabs) */}
          <div key={activeTab} className="flex-1 min-h-0 flex flex-col animate-page-in">
            {activeTab === 'bugun' && (
              <TodayView
                selectedDateKey={selectedDateKey}
                onChangeDateKey={setSelectedDateKey}
                dayLog={currentDayLog}
                profile={state.profile}
                dailyAdvice={state.dailyAdviceByDate[selectedDateKey]}
                onSaveDailyAdvice={handleSaveDailyAdvice}
                onAddWater={handleAddWater}
                onDeleteMeal={handleDeleteMeal}
                onFavoriteOrRepeatMeal={handleFavoriteOrRepeatMeal}
                onUpdateMeal={handleUpdateMeal}
                onGoToLogTab={() => setActiveTab('kaydet')}
              />
            )}

            {activeTab === 'kaydet' && (
              <LogTabView
                profile={state.profile}
                favorites={state.favorites}
                yesterdayMeals={yesterdayMeals}
                onSaveMeal={handleSaveMeal}
                onRemoveFavorite={handleRemoveFavorite}
                onCopyYesterday={handleCopyYesterday}
                onGoToTodayTab={() => setActiveTab('bugun')}
              />
            )}

            {activeTab === 'asistan' && (
              <AssistantView
                messages={state.chatMessages}
                onAppendMessages={handleAppendChatMessages}
                onClearMessages={() => setState((p) => ({ ...p, chatMessages: [] }))}
                todayLog={getDayLog(getTodayDateKey())}
                days={state.days}
                profile={state.profile}
              />
            )}

            {activeTab === 'ozet' && (
              <SummaryView
                days={state.days}
                profile={state.profile}
                weightHistory={state.weightHistory}
                onLogWeight={handleLogWeight}
                onToggleRestDayToday={handleToggleRestDayToday}
                onToggleHideWeight={() =>
                  setState((p) => ({
                    ...p,
                    profile: {
                      ...p.profile,
                      hideWeightTracking: !p.profile.hideWeightTracking,
                    },
                  }))
                }
              />
            )}

            {activeTab === 'profil' && (
              <ProfileView
                profile={state.profile}
                theme={state.theme}
                onToggleTheme={handleToggleTheme}
                onUpdateProfile={(profile) => setState((p) => ({ ...p, profile }))}
                onResetAllData={handleResetAllData}
              />
            )}
          </div>

          {/* Undo snackbar when meal swiped left to delete */}
          {deletedUndo && (
            <div className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] left-4 right-4 z-30 rounded-2xl bg-[#182920] dark:bg-[#21382C] text-white px-4 py-2.5 flex items-center justify-between shadow-lg text-xs">
              <span className="truncate mr-2">&ldquo;{deletedUndo.meal.base.name}&rdquo; silindi</span>
              <button
                type="button"
                onClick={handleUndoDelete}
                className="inline-flex items-center gap-1 font-semibold text-[#8EE0B3] shrink-0 cursor-pointer active:scale-95 py-1 px-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Geri Al</span>
              </button>
            </div>
          )}

          {/* 5-Tab Bottom Navigation Bar with prominent center Camera button */}
          <nav
            aria-label="Ana menü"
            className="shrink-0 bg-white/94 dark:bg-[#141C18]/94 backdrop-blur-md border-t border-[#E5E9E2] dark:border-[#242E29] px-2 pt-1.5 safe-bottom grid grid-cols-5 items-end no-print"
          >
            <button
              type="button"
              onClick={() => setActiveTab('bugun')}
              className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors active:scale-95 ${
                activeTab === 'bugun'
                  ? 'text-[#2D8256] dark:text-[#78D0A1]'
                  : 'text-[#6E7A72] dark:text-[#86948B]'
              }`}
            >
              <CalendarDays className="w-[21px] h-[21px]" />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">Bugün</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('asistan')}
              className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors active:scale-95 ${
                activeTab === 'asistan'
                  ? 'text-[#2D8256] dark:text-[#78D0A1]'
                  : 'text-[#6E7A72] dark:text-[#86948B]'
              }`}
            >
              <MessageCircle className="w-[21px] h-[21px]" />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">Asistan</span>
            </button>

            {/* Center elevated Camera button ("Kaydet") */}
            <div className="flex flex-col items-center justify-center -mt-4">
              <button
                type="button"
                onClick={() => setActiveTab('kaydet')}
                aria-label="Kaydet"
                className={`w-[54px] h-[54px] rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer border ${
                  activeTab === 'kaydet'
                    ? 'bg-[#7AD6A4] text-[#0E3622] border-[#5AC58B] ring-4 ring-[#8EE0B3]/35 dark:bg-[#78D0A1] dark:text-[#0B2216]'
                    : 'bg-[#8EE0B3] hover:bg-[#7DD8A6] text-[#103924] border-[#73CFA0]/60 dark:bg-[#6AC696] dark:text-[#0A2014]'
                }`}
              >
                <Camera className="w-6 h-6" />
              </button>
              <span
                className={`text-[10px] font-semibold tracking-tight mt-0.5 whitespace-nowrap ${
                  activeTab === 'kaydet'
                    ? 'text-[#2D8256] dark:text-[#78D0A1]'
                    : 'text-[#6E7A72] dark:text-[#86948B]'
                }`}
              >
                Kaydet
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('ozet')}
              className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors active:scale-95 ${
                activeTab === 'ozet'
                  ? 'text-[#2D8256] dark:text-[#78D0A1]'
                  : 'text-[#6E7A72] dark:text-[#86948B]'
              }`}
            >
              <BarChart3 className="w-[21px] h-[21px]" />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">Özet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profil')}
              className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors active:scale-95 ${
                activeTab === 'profil'
                  ? 'text-[#2D8256] dark:text-[#78D0A1]'
                  : 'text-[#6E7A72] dark:text-[#86948B]'
              }`}
            >
              <User className="w-[21px] h-[21px]" />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">Profil</span>
            </button>
          </nav>
        </>
      )}
    </IPhoneFrame>
  );
}
