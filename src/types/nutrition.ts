export type ThemeMode = 'light' | 'dark';

export type Gender = 'kadin' | 'erkek';

export type ActivityLevel = 'az' | 'hafif' | 'orta' | 'cok';

export type GoalType = 'koruma' | 'verme' | 'alma';

export type ConfidenceLevel = 'yüksek' | 'orta' | 'düşük';

export type PortionSize = 'kucuk' | 'normal' | 'buyuk';

export type MealInputMethod = 'foto' | 'barkod' | 'yazi' | 'favori' | 'kopya';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface UserProfile {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  allergies: string[];
  dietPreferences: string[];
  trackingTopics: string[]; // 'şeker' | 'kolesterol' | 'tansiyon' | 'tuz'
  customWaterTargetMl: number | null; // null => calculated from weight (weightKg * 33)
  hideWeightTracking: boolean;
  reminderCount: number; // default 3 or 4 gentle in-app reminders
  quietHoursStart: string; // e.g. "22:30"
  quietHoursEnd: string; // e.g. "08:00"
  kvkkAcceptedAt: string | null;
  onboardingCompleted: boolean;
}

export interface MealBreakdownItem {
  name: string;
  quantityLabel: string;
  estimatedGrams: number;
  caloriesMin: number;
  caloriesMax: number;
}

export interface NutritionBase {
  name: string;
  portionLabel: string; // Turkish household unit, e.g. "1 bütün büyük pizza (8 dilim)", "1 kepçe"
  caloriesMin: number;
  caloriesMax: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  ingredients: string[];
  detectedAllergens: string[];
  confidence: ConfidenceLevel;
  clarificationQuestion: string | null;
  sources: GroundingSource[];
  itemsBreakdown?: MealBreakdownItem[];
  barcode?: string | null;
  brand?: string | null;
}

export interface MealImpactCard {
  whatItContains: string;
  generalEffect: string;
  gentleSuggestion: string;
  disclaimer: string;
  generatedAt: string;
}

export interface MealEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD in local time
  createdAt: string;
  method: MealInputMethod;
  photoDataUrl?: string; // compressed dataUrl of user's real uploaded photo
  base: NutritionBase;
  portionSize: PortionSize;
  servingCount: number; // e.g., 1, 1.5, 2
  cookedInExtraOil: boolean;
  impact?: MealImpactCard | null;
  isFavorite?: boolean;
}

export interface FavoriteTemplate {
  id: string;
  base: NutritionBase;
  defaultPortionSize: PortionSize;
  defaultExtraOil: boolean;
  photoDataUrl?: string;
  useCount: number;
  lastUsedAt: string;
}

export interface WeightEntry {
  dateKey: string; // YYYY-MM-DD
  weightKg: number;
  recordedAt: string;
}

export interface DailyAdvice {
  dateKey: string;
  mealCountAtGeneration: number;
  waterMlAtGeneration: number;
  title: string;
  advice: string;
  sourceLabel: string;
  sources: GroundingSource[];
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  sources?: GroundingSource[];
  safetyNotice?: boolean;
}

export interface DayLog {
  dateKey: string;
  waterMl: number;
  meals: MealEntry[];
  restDay?: boolean; // "Dinlenme günü" hakkı - prevents streak penalty
}

export interface WhatToEatSuggestion {
  title: string;
  portionLabel: string;
  caloriesMin: number;
  caloriesMax: number;
  whyItFits: string;
  allergenNote?: string | null;
}

export interface AppState {
  theme: ThemeMode;
  profile: UserProfile;
  days: Record<string, DayLog>;
  favorites: FavoriteTemplate[];
  weightHistory: WeightEntry[];
  dailyAdviceByDate: Record<string, DailyAdvice>;
  chatMessages: ChatMessage[];
}
