import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Bell,
  ShieldCheck,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
} from 'lucide-react';
import type { ActivityLevel, GoalType, ThemeMode, UserProfile } from '../types/nutrition';
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  calculateCalorieTarget,
  calculateWaterTargetMl,
} from '../utils/nutritionMath';

interface ProfileViewProps {
  profile: UserProfile;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onResetAllData: () => void;
}

const ALLERGY_OPTIONS = ['Gluten / Buğday', 'Süt / Laktoz', 'Yumurta', 'Kuruyemiş / Fıstık', 'Susam', 'Balık / Deniz Ürünü', 'Soya'];
const DIET_OPTIONS = ['Dengeli / Kısıt yok', 'Vejetaryen', 'Vegan', 'Helal hassasiyeti', 'Glütensiz', 'Laktozsuz'];
const TOPIC_OPTIONS = ['Kan şekeri dengesi', 'Kolesterol', 'Tansiyon', 'Tuz tüketimi'];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  theme,
  onToggleTheme,
  onUpdateProfile,
  onResetAllData,
}) => {
  const [showFormula, setShowFormula] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const savedTimerRef = useRef<number | null>(null);
  const [ageStr, setAgeStr] = useState(String(profile.age));
  const [heightStr, setHeightStr] = useState(String(profile.heightCm));
  const [weightStr, setWeightStr] = useState(String(profile.weightKg));
  const [customWaterStr, setCustomWaterStr] = useState(
    profile.customWaterTargetMl ? String(profile.customWaterTargetMl) : ''
  );

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const calorieBreakdown = calculateCalorieTarget(profile);
  const waterInfo = calculateWaterTargetMl(profile);
  const isUnder18 = profile.age < 18;

  const updateField = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) => {
    const next = { ...profile, [key]: val };
    if (next.age < 18 && next.goal === 'verme') {
      next.goal = 'koruma';
    }
    onUpdateProfile(next);
    setSavedBanner(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedBanner(false), 1400);
  };

  const toggleItem = (key: 'allergies' | 'dietPreferences' | 'trackingTopics', val: string) => {
    const arr = profile[key];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    updateField(key, next);
  };

  return (
    <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-6 space-y-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Profil</h1>
          <p className="text-xs text-[#69756D] dark:text-[#93A097]">
            Hedefler, alerjiler, hatırlatmalar ve gizlilik
          </p>
        </div>
        {savedBanner && (
          <span className="text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>Kaydedildi</span>
          </span>
        )}
      </div>

      {/* Personal Info & Mifflin-St Jeor */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <User className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
          <span>Bilgiler ve Günlük Hedef</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">Yaş</label>
            <input
              type="number"
              inputMode="numeric"
              min={12}
              max={100}
              value={ageStr}
              onChange={(e) => {
                const val = e.target.value;
                setAgeStr(val);
                const num = Number(val);
                if (val !== '' && !Number.isNaN(num) && num >= 10 && num <= 110) {
                  updateField('age', num);
                }
              }}
              onBlur={() => {
                const num = Math.max(12, Math.min(100, Number(ageStr) || profile.age));
                setAgeStr(String(num));
                updateField('age', num);
              }}
              className="w-full h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">Boy (cm)</label>
            <input
              type="number"
              inputMode="numeric"
              min={120}
              max={230}
              value={heightStr}
              onChange={(e) => {
                const val = e.target.value;
                setHeightStr(val);
                const num = Number(val);
                if (val !== '' && !Number.isNaN(num) && num >= 100 && num <= 240) {
                  updateField('heightCm', num);
                }
              }}
              onBlur={() => {
                const num = Math.max(120, Math.min(230, Number(heightStr) || profile.heightCm));
                setHeightStr(String(num));
                updateField('heightCm', num);
              }}
              className="w-full h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">Kilo (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={30}
              max={250}
              value={weightStr}
              onChange={(e) => {
                const val = e.target.value;
                setWeightStr(val);
                const num = Number(val);
                if (val !== '' && !Number.isNaN(num) && num >= 30 && num <= 250) {
                  updateField('weightKg', num);
                }
              }}
              onBlur={() => {
                const num = Math.max(30, Math.min(250, Number(weightStr) || profile.weightKg));
                setWeightStr(String(num));
                updateField('weightKg', num);
              }}
              className="w-full h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">Hareket</label>
            <select
              value={profile.activityLevel}
              onChange={(e) => updateField('activityLevel', e.target.value as ActivityLevel)}
              className="w-full h-10 px-2.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs outline-none"
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92] mb-1">Hedef</label>
            <select
              value={profile.goal}
              onChange={(e) => updateField('goal', e.target.value as GoalType)}
              className="w-full h-10 px-2.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs outline-none"
            >
              {(['koruma', 'verme', 'alma'] as GoalType[]).map((g) => (
                <option key={g} value={g} disabled={isUnder18 && g === 'verme'}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-[#ECEFE9] dark:border-[#242E29]">
          <button
            type="button"
            onClick={() => setShowFormula((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] py-1 cursor-pointer"
          >
            <span className="tabular-nums">
              Günlük Kalori Hedefin: {calorieBreakdown.targetCalories} kcal
            </span>
            {showFormula ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showFormula && (
            <div className="mt-2 text-[11px] leading-relaxed text-[#59655D] dark:text-[#9AA89F] space-y-1">
              <p className="tabular-nums">{calorieBreakdown.formulaText}</p>
              <p>{calorieBreakdown.weeklyPaceNote}</p>
            </div>
          )}
        </div>
      </section>

      {/* Allergies, Preferences, Tracking Topics */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-[#59655D] dark:text-[#9AA89F] mb-2">
            Alerjiler
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGY_OPTIONS.map((item) => {
              const active = profile.allergies.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem('allergies', item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer active:scale-95 transition-all ${
                    active
                      ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60 font-semibold'
                      : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[#59655D] dark:text-[#9AA89F] mb-2">
            Beslenme Tercihleri
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIET_OPTIONS.map((item) => {
              const active = profile.dietPreferences.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem('dietPreferences', item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer active:scale-95 transition-all ${
                    active
                      ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60 font-semibold'
                      : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[#59655D] dark:text-[#9AA89F] mb-2">
            Takip Konuları
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_OPTIONS.map((item) => {
              const active = profile.trackingTopics.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem('trackingTopics', item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer active:scale-95 transition-all ${
                    active
                      ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60 font-semibold'
                      : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Water Target & Reminder Settings */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Bell className="w-4 h-4 text-[#5B9BD5] dark:text-[#76B2E8]" />
          <span>Su Hedefi ve Hatırlatmalar</span>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] text-[#69756D] dark:text-[#8E9B92]">
            Özel doktor su hedefi (ml) — boş bırakırsan kiloya göre hesaplanır
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={500}
              max={6000}
              step={100}
              placeholder={String(waterInfo.targetMl)}
              value={customWaterStr}
              onChange={(e) => {
                const v = e.target.value;
                setCustomWaterStr(v);
                if (v.trim() === '') {
                  updateField('customWaterTargetMl', null);
                } else {
                  const num = Number(v);
                  if (!Number.isNaN(num) && num >= 500 && num <= 6000) {
                    updateField('customWaterTargetMl', num);
                  }
                }
              }}
              onBlur={() => {
                if (customWaterStr.trim() === '') {
                  updateField('customWaterTargetMl', null);
                } else {
                  const num = Math.max(500, Math.min(6000, Number(customWaterStr) || waterInfo.targetMl));
                  setCustomWaterStr(String(num));
                  updateField('customWaterTargetMl', num);
                }
              }}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none"
            />
            {profile.customWaterTargetMl && (
              <button
                type="button"
                onClick={() => {
                  setCustomWaterStr('');
                  updateField('customWaterTargetMl', null);
                }}
                className="h-10 px-3 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold cursor-pointer active:scale-95"
              >
                Otomatik
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#69756D] dark:text-[#8E9B92]">{waterInfo.formulaNote}</p>
        </div>

        <div className="grid grid-cols-2 min-[390px]:grid-cols-3 gap-2 pt-2 border-t border-[#ECEFE9] dark:border-[#242E29]">
          <div className="col-span-2 min-[390px]:col-span-1">
            <label className="block text-[10px] text-[#69756D] dark:text-[#8E9B92] mb-1">
              Uygulama içi sayı
            </label>
            <select
              value={profile.reminderCount}
              onChange={(e) => updateField('reminderCount', Number(e.target.value))}
              className="w-full h-10 px-2 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs tabular-nums outline-none"
            >
              {[0, 2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Kapalı' : `Günde ${n} kez`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#69756D] dark:text-[#8E9B92] mb-1">
              Sessiz başlangıç
            </label>
            <input
              type="time"
              value={profile.quietHoursStart}
              onChange={(e) => updateField('quietHoursStart', e.target.value)}
              className="w-full h-10 px-2 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs tabular-nums outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#69756D] dark:text-[#8E9B92] mb-1">
              Sessiz bitiş
            </label>
            <input
              type="time"
              value={profile.quietHoursEnd}
              onChange={(e) => updateField('quietHoursEnd', e.target.value)}
              className="w-full h-10 px-2 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs pt-1 opacity-75">
          <span className="text-[#59655D] dark:text-[#9AA89F]">Telefon / Kilit Ekranı Bildirimleri</span>
          <span className="text-[11px] font-medium text-[#69756D] dark:text-[#93A097] text-right shrink-0">
            Gerçek uygulamada etkinleşir
          </span>
        </div>
      </section>

      {/* Passive Widgets Section (no fake previews) */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-2.5 opacity-80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Smartphone className="w-4 h-4 text-[#69756D] dark:text-[#93A097] shrink-0" />
            <span>Widget&apos;lar</span>
          </div>
          <span className="text-[11px] font-medium text-[#69756D] dark:text-[#93A097] text-right shrink-0">
            Gerçek uygulamada etkinleşir
          </span>
        </div>
        <p className="text-xs text-[#69756D] dark:text-[#93A097] leading-relaxed">
          iPhone Ana Ekran ve Kilit Ekranı kalori/su widget&apos;ları iOS WidgetKit ile yerel uygulamada aktif olur.
        </p>
      </section>

      {/* Appearance & Privacy / KVKK */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1] shrink-0" />
            <span>Görünüm ve Gizlilik (KVKK)</span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="h-9 px-3 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold cursor-pointer shrink-0 active:scale-95 transition-all"
          >
            {theme === 'dark' ? 'Açık Moda Geç' : 'Koyu Moda Geç'}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-[#69756D] dark:text-[#93A097]">
          Tüm öğün, su ve profil kayıtların yalnızca bu tarayıcıda tutulur. Bu uygulama tıbbi tanı koymaz; hiçbir içerik tıbbi tavsiye değildir.
        </p>

        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="w-full h-10 rounded-xl bg-[#C98A3A]/12 dark:bg-[#E0A352]/14 text-[#8C6126] dark:text-[#E0A352] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Kayıtları ve Profili Sıfırla</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="flex-1 h-10 rounded-xl bg-[#EFF2EC] dark:bg-[#222C26] text-xs font-semibold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onResetAllData();
              }}
              className="flex-1 h-10 rounded-xl bg-[#C98A3A] text-white text-xs font-semibold cursor-pointer"
            >
              Evet, Sil
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
