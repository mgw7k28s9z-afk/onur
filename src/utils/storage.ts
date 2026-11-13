import type { AppState, UserProfile } from '../types/nutrition';

const STORAGE_KEY = 'denge_beslenme_app_v1';

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  gender: 'kadin',
  age: 29,
  heightCm: 168,
  weightKg: 64,
  activityLevel: 'hafif',
  goal: 'koruma',
  allergies: [],
  dietPreferences: [],
  trackingTopics: [],
  customWaterTargetMl: null,
  hideWeightTracking: false,
  reminderCount: 4,
  quietHoursStart: '22:30',
  quietHoursEnd: '08:00',
  kvkkAcceptedAt: null,
  onboardingCompleted: false,
};

export const EMPTY_APP_STATE: AppState = {
  theme: 'light',
  profile: DEFAULT_PROFILE,
  days: {},
  favorites: [],
  weightHistory: [],
  dailyAdviceByDate: {},
  chatMessages: [],
};

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_APP_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
      days: parsed.days ?? {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      weightHistory: Array.isArray(parsed.weightHistory) ? parsed.weightHistory : [],
      dailyAdviceByDate: parsed.dailyAdviceByDate ?? {},
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
    };
  } catch {
    return EMPTY_APP_STATE;
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Handle storage quota gracefully if user uploads many large photos: strip oldest meal thumbnails and retry
    try {
      const trimmedDays: AppState['days'] = {};
      const dateKeys = Object.keys(state.days).sort();
      const recentCutoff = Math.max(0, dateKeys.length - 5);
      dateKeys.forEach((dk, idx) => {
        const day = state.days[dk];
        trimmedDays[dk] =
          idx < recentCutoff
            ? { ...day, meals: day.meals.map((m) => ({ ...m, photoDataUrl: undefined })) }
            : day;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, days: trimmedDays }));
    } catch {
      console.warn('Yerel depolama sınırına yaklaşıldı:', err);
    }
  }
}

export function clearAppState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Compresses user's real uploaded photo client-side before storing in localStorage
 * and sending to Gemini API so payloads stay fast and within storage limits.
 */
export async function compressImageFile(file: File, maxDimension = 1024, quality = 0.78): Promise<{
  dataUrl: string;
  base64: string;
  mimeType: string;
}> {
  const mime = (file.type || '').toLowerCase();
  const explicitlyNonImage =
    mime !== '' &&
    mime !== 'application/octet-stream' &&
    !mime.startsWith('image/');
  if (explicitlyNonImage) {
    throw new Error('Lütfen görsel formatında bir dosya (JPG, PNG, WEBP) seçin.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(
          new Error(
            'Görsel biçimi bu tarayıcıda açılamadı (HEIC/RAW ise JPG veya PNG formatında deneyin).'
          )
        );
      img.onload = () => {
        let { width, height } = img;
        if (!width || !height) {
          reject(new Error('Görsel boyutları okunamadı. Lütfen başka bir fotoğraf seçin.'));
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDimension) / width));
            width = maxDimension;
          } else {
            width = Math.max(1, Math.round((width * maxDimension) / height));
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Görsel işlenemedi.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(',')[1] ?? '';
        if (!base64) {
          reject(new Error('Görsel verisi oluşturulamadı. Lütfen farklı bir fotoğraf deneyin.'));
          return;
        }
        resolve({ dataUrl, base64, mimeType });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function copyTextReliably(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for restricted iframe contexts
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
