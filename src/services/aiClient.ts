import type {
  MealImpactCard,
  NutritionBase,
  UserProfile,
  WhatToEatSuggestion,
  GroundingSource,
} from '../types/nutrition';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let data: Record<string, unknown> = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        // Non-JSON HTML or proxy error response
      }
    }
    if (!res.ok) {
      throw new Error(
        (typeof data.error === 'string' && data.error) ||
          (res.status === 504 || res.status === 502
            ? 'Sunucu yanıt süresi doldu, tekrar dene.'
            : 'Analiz edilemedi, tekrar dene.')
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı, tekrar dene.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function analyzeMealPhotoApi(params: {
  imageBase64: string;
  mimeType: string;
  userHint?: string;
  profile: UserProfile;
}): Promise<NutritionBase> {
  const data = await postJson<{ nutrition: NutritionBase }>('/api/analyze-meal-photo', params);
  return data.nutrition;
}

export async function analyzeBarcodeOrLabelApi(params: {
  imageBase64?: string;
  mimeType?: string;
  manualBarcode?: string;
  profile: UserProfile;
}): Promise<NutritionBase> {
  const data = await postJson<{ nutrition: NutritionBase }>('/api/analyze-barcode-label', params);
  return data.nutrition;
}

export async function parseTextMealApi(params: {
  text: string;
  profile: UserProfile;
}): Promise<NutritionBase[]> {
  const data = await postJson<{ items: NutritionBase[] }>('/api/parse-text-meal', params);
  return data.items;
}

export async function recalculateCorrectedMealApi(params: {
  correctedName: string;
  userAnswer?: string;
  currentPortionLabel?: string;
  profile: UserProfile;
}): Promise<NutritionBase> {
  const data = await postJson<{ nutrition: NutritionBase }>(
    '/api/recalculate-corrected-meal',
    params
  );
  return data.nutrition;
}

export async function generateMealImpactApi(params: {
  mealSummary: string;
  dayContext: string;
  profile: UserProfile;
}): Promise<MealImpactCard> {
  const data = await postJson<{ impact: MealImpactCard }>('/api/meal-impact', params);
  return data.impact;
}

export async function generateDailyAdviceApi(params: {
  dayMealsSummary: string;
  totalsSummary: string;
  waterMl: number;
  waterTargetMl: number;
  profile: UserProfile;
}): Promise<{
  title: string;
  advice: string;
  sourceLabel: string;
  sources: GroundingSource[];
  generatedAt: string;
}> {
  const data = await postJson<{
    advice: {
      title: string;
      advice: string;
      sourceLabel: string;
      sources: GroundingSource[];
      generatedAt: string;
    };
  }>('/api/daily-advice', params);
  return data.advice;
}

export async function generateWhatToEatApi(params: {
  remainingCalMin: number;
  remainingCalMax: number;
  dayMealsSummary: string;
  missingSummary: string;
  profile: UserProfile;
  fridgeImageBase64?: string;
  fridgeMimeType?: string;
}): Promise<{ intro: string; suggestions: WhatToEatSuggestion[] }> {
  return postJson<{ intro: string; suggestions: WhatToEatSuggestion[] }>('/api/what-to-eat', params);
}

export async function generateWeeklyInsightApi(params: {
  weekStatsSummary: string;
  profile: UserProfile;
}): Promise<string> {
  const data = await postJson<{ summary: string }>('/api/weekly-insight', params);
  return data.summary;
}

export async function sendChatMessageApi(params: {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  dayContext: string;
  weekContext: string;
  profile: UserProfile;
}): Promise<{ reply: string; sources: GroundingSource[]; safetyNotice: boolean }> {
  return postJson<{ reply: string; sources: GroundingSource[]; safetyNotice: boolean }>(
    '/api/chat',
    params
  );
}
