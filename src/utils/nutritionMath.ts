import type {
  ActivityLevel,
  DayLog,
  GoalType,
  MealEntry,
  PortionSize,
  UserProfile,
} from '../types/nutrition';

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string; factor: number }> = {
  az: { label: 'Az hareketli', desc: 'Masa başı, günlük yürüyüş az', factor: 1.2 },
  hafif: { label: 'Hafif aktif', desc: 'Haftada 1-3 gün hafif yürüyüş', factor: 1.375 },
  orta: { label: 'Orta aktif', desc: 'Haftada 3-5 gün hareketli yaşam', factor: 1.55 },
  cok: { label: 'Çok aktif', desc: 'Yoğun fiziksel aktivite / iş', factor: 1.725 },
};

export const GOAL_LABELS: Record<GoalType, string> = {
  koruma: 'Kilo koruma ve denge',
  verme: 'Yavaş ve sağlıklı kilo verme',
  alma: 'Sağlıklı kilo alma',
};

export const PORTION_MULTIPLIERS: Record<PortionSize, { label: string; factor: number }> = {
  kucuk: { label: 'Küçük', factor: 0.7 },
  normal: { label: 'Normal', factor: 1.0 },
  buyuk: { label: 'Büyük', factor: 1.35 },
};

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function formatTurkishDateLabel(dateKey: string): string {
  const today = getTodayDateKey();
  if (dateKey === today) return 'Bugün';
  if (dateKey === shiftDateKey(today, -1)) return 'Dün';
  if (dateKey === shiftDateKey(today, 1)) return 'Yarın';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
}

export interface CalorieTargetBreakdown {
  bmr: number;
  tdee: number;
  targetCalories: number;
  safeFloorApplied: boolean;
  under18GuardApplied: boolean;
  safeFloorValue: number;
  weeklyPaceNote: string;
  formulaText: string;
}

/**
 * Real Mifflin-St Jeor calculation performed strictly in code.
 * Enforces safe minimum calorie floors (1200 kcal women / 1500 kcal men)
 * and disables weight-loss deficits for users under age 18.
 */
export function calculateCalorieTarget(profile: UserProfile): CalorieTargetBreakdown {
  const weight = Math.max(30, Math.min(300, Number(profile.weightKg) || 68));
  const height = Math.max(100, Math.min(240, Number(profile.heightCm) || 170));
  const age = Math.max(10, Math.min(110, Number(profile.age) || 30));

  const genderOffset = profile.gender === 'erkek' ? 5 : -161;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + genderOffset);
  const factor = ACTIVITY_LABELS[profile.activityLevel]?.factor ?? 1.375;
  const tdee = Math.round(bmr * factor);

  const safeFloorValue = profile.gender === 'erkek' ? 1500 : 1200;
  const under18GuardApplied = age < 18 && profile.goal === 'verme';

  let rawTarget = tdee;
  let weeklyPaceNote = 'Mevcut kilonuzu korumak için günlük enerji dengesi hedeflendi.';

  if (under18GuardApplied) {
    rawTarget = tdee;
    weeklyPaceNote =
      '18 yaş altında büyüme ve gelişim için kilo verme açığı uygulanmaz; dengeli koruma hedefi kullanılır.';
  } else if (profile.goal === 'verme') {
    rawTarget = tdee - 400; // ~0.35 - 0.4 kg / hafta makul hız
    weeklyPaceNote = 'Haftada yaklaşık 0,35–0,4 kg gibi makul ve sürdürülebilir bir hız için -400 kcal dengesi.';
  } else if (profile.goal === 'alma') {
    rawTarget = tdee + 300;
    weeklyPaceNote = 'Haftada yaklaşık 0,25–0,3 kg dengeli artış için +300 kcal desteği.';
  }

  let safeFloorApplied = false;
  let targetCalories = rawTarget;
  if (targetCalories < safeFloorValue) {
    targetCalories = safeFloorValue;
    safeFloorApplied = true;
  }

  const formulaText =
    `Mifflin-St Jeor: (10 × ${weight} kg) + (6,25 × ${height} cm) - (5 × ${age} yaş) ` +
    `${genderOffset >= 0 ? '+ 5' : '- 161'} = ${bmr} kcal BMR × ${factor} hareket = ${tdee} kcal günlük harcama`;

  return {
    bmr,
    tdee,
    targetCalories,
    safeFloorApplied,
    under18GuardApplied,
    safeFloorValue,
    weeklyPaceNote,
    formulaText,
  };
}

export function calculateWaterTargetMl(profile: UserProfile): {
  targetMl: number;
  isCustom: boolean;
  formulaNote: string;
} {
  if (profile.customWaterTargetMl && profile.customWaterTargetMl >= 500) {
    return {
      targetMl: Math.round(profile.customWaterTargetMl),
      isCustom: true,
      formulaNote: 'Doktorunuzun veya sizin belirlediğiniz özel günlük su hedefi.',
    };
  }
  const weight = Math.max(30, Math.min(300, Number(profile.weightKg) || 68));
  const raw = Math.round((weight * 33) / 50) * 50;
  const targetMl = Math.max(1500, Math.min(4000, raw));
  return {
    targetMl,
    isCustom: false,
    formulaNote: `Kilonuza göre yaklaşık hesaplandı (${weight} kg × 33 ml ≈ ${targetMl} ml).`,
  };
}

export interface ComputedMealTotals {
  caloriesMin: number;
  caloriesMax: number;
  caloriesMid: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

/**
 * Deterministic calculation of meal calories & macros from AI's base serving
 * plus user's one-tap adjustments (portion size, serving count, extra cooking oil).
 */
export function computeMealTotals(meal: Pick<MealEntry, 'base' | 'portionSize' | 'servingCount' | 'cookedInExtraOil'>): ComputedMealTotals {
  const portionFactor = PORTION_MULTIPLIERS[meal.portionSize]?.factor ?? 1.0;
  const count = Math.max(0.25, meal.servingCount || 1);
  const mult = portionFactor * count;

  const oilMin = meal.cookedInExtraOil ? 85 : 0;
  const oilMax = meal.cookedInExtraOil ? 135 : 0;
  const oilFatG = meal.cookedInExtraOil ? 11 : 0;

  const baseMin = Math.max(0, Number(meal.base.caloriesMin) || 0);
  const baseMax = Math.max(baseMin, Number(meal.base.caloriesMax) || baseMin);

  const caloriesMin = Math.round(baseMin * mult + oilMin);
  const caloriesMax = Math.round(baseMax * mult + oilMax);
  const caloriesMid = Math.round((caloriesMin + caloriesMax) / 2);

  return {
    caloriesMin,
    caloriesMax,
    caloriesMid,
    proteinG: Math.round((Number(meal.base.proteinG) || 0) * mult * 10) / 10,
    carbsG: Math.round((Number(meal.base.carbsG) || 0) * mult * 10) / 10,
    fatG: Math.round(((Number(meal.base.fatG) || 0) * mult + oilFatG) * 10) / 10,
    fiberG: Math.round((Number(meal.base.fiberG) || 0) * mult * 10) / 10,
    sugarG: Math.round((Number(meal.base.sugarG) || 0) * mult * 10) / 10,
    sodiumMg: Math.round((Number(meal.base.sodiumMg) || 0) * mult),
  };
}

export function computeDayTotals(meals: MealEntry[]): ComputedMealTotals {
  return meals.reduce<ComputedMealTotals>(
    (acc, meal) => {
      const m = computeMealTotals(meal);
      return {
        caloriesMin: acc.caloriesMin + m.caloriesMin,
        caloriesMax: acc.caloriesMax + m.caloriesMax,
        caloriesMid: acc.caloriesMid + m.caloriesMid,
        proteinG: Math.round((acc.proteinG + m.proteinG) * 10) / 10,
        carbsG: Math.round((acc.carbsG + m.carbsG) * 10) / 10,
        fatG: Math.round((acc.fatG + m.fatG) * 10) / 10,
        fiberG: Math.round((acc.fiberG + m.fiberG) * 10) / 10,
        sugarG: Math.round((acc.sugarG + m.sugarG) * 10) / 10,
        sodiumMg: acc.sodiumMg + m.sodiumMg,
      };
    },
    {
      caloriesMin: 0,
      caloriesMax: 0,
      caloriesMid: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    }
  );
}

/**
 * Gentle streak calculation: counts consecutive active days (logged >=1 meal OR water >= 500ml OR marked as restDay).
 * Never punishes; rest days bridge the streak softly.
 */
export function computeGentleStreak(days: Record<string, DayLog>, todayKey: string): {
  streakDays: number;
  usedRestDayToday: boolean;
} {
  let streakDays = 0;
  let cursor = todayKey;

  // Check if today itself has activity or restDay; if today is empty, start checking from yesterday so streak isn't prematurely 0 in the morning
  const todayLog = days[todayKey];
  const hasTodayActivity =
    Boolean(todayLog?.restDay) ||
    (todayLog?.meals?.length ?? 0) > 0 ||
    (todayLog?.waterMl ?? 0) >= 400;

  if (!hasTodayActivity) {
    cursor = shiftDateKey(todayKey, -1);
  }

  for (let i = 0; i < 365; i++) {
    const log = days[cursor];
    const active =
      Boolean(log?.restDay) ||
      (log?.meals?.length ?? 0) > 0 ||
      (log?.waterMl ?? 0) >= 400;
    if (!active) break;
    streakDays += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return {
    streakDays,
    usedRestDayToday: Boolean(todayLog?.restDay),
  };
}

export interface WeeklyRealStats {
  dayKeys: string[];
  loggedDaysCount: number;
  averageCaloriesMid: number;
  averageWaterMl: number;
  daysWithinCalorieBand: number;
  daysMetWaterGoal: number;
  daysWithGoodFiber: number;
  topFoods: Array<{ name: string; count: number }>;
  dailyPoints: Array<{
    dateKey: string;
    shortLabel: string;
    caloriesMid: number;
    caloriesMin: number;
    caloriesMax: number;
    waterMl: number;
    mealCount: number;
    fiberG: number;
    restDay: boolean;
  }>;
}

export function computeWeeklyStats(
  days: Record<string, DayLog>,
  todayKey: string,
  calorieTarget: number,
  waterTargetMl: number
): WeeklyRealStats {
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dayKeys.push(shiftDateKey(todayKey, -i));
  }

  const foodCounts = new Map<string, number>();
  let loggedDaysCount = 0;
  let sumCal = 0;
  let sumWater = 0;
  let daysWithinCalorieBand = 0;
  let daysMetWaterGoal = 0;
  let daysWithGoodFiber = 0;

  const dailyPoints = dayKeys.map((dk) => {
    const log = days[dk];
    const meals = log?.meals ?? [];
    const totals = computeDayTotals(meals);
    const waterMl = log?.waterMl ?? 0;

    if (meals.length > 0) {
      loggedDaysCount += 1;
      sumCal += totals.caloriesMid;
      // Within gentle band: 75% to 110% of target
      if (totals.caloriesMid >= calorieTarget * 0.75 && totals.caloriesMid <= calorieTarget * 1.1) {
        daysWithinCalorieBand += 1;
      }
      if (totals.fiberG >= 20) {
        daysWithGoodFiber += 1;
      }
      meals.forEach((m) => {
        const key = m.base.name.trim();
        if (key) {
          foodCounts.set(key, (foodCounts.get(key) ?? 0) + 1);
        }
      });
    }

    if (waterMl > 0) {
      sumWater += waterMl;
    }
    if (waterMl >= waterTargetMl) {
      daysMetWaterGoal += 1;
    }

    const [y, m, d] = dk.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const shortLabel = dt.toLocaleDateString('tr-TR', { weekday: 'short' }).replace('.', '');

    return {
      dateKey: dk,
      shortLabel,
      caloriesMid: totals.caloriesMid,
      caloriesMin: totals.caloriesMin,
      caloriesMax: totals.caloriesMax,
      waterMl,
      mealCount: meals.length,
      fiberG: totals.fiberG,
      restDay: Boolean(log?.restDay),
    };
  });

  const topFoods = Array.from(foodCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const waterDaysCount = dailyPoints.filter((p) => p.waterMl > 0).length;

  return {
    dayKeys,
    loggedDaysCount,
    averageCaloriesMid: loggedDaysCount > 0 ? Math.round(sumCal / loggedDaysCount) : 0,
    averageWaterMl: waterDaysCount > 0 ? Math.round(sumWater / waterDaysCount) : 0,
    daysWithinCalorieBand,
    daysMetWaterGoal,
    daysWithGoodFiber,
    topFoods,
    dailyPoints,
  };
}
