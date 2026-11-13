import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, ArrowLeft, Info, Check } from 'lucide-react';
import type { ActivityLevel, Gender, GoalType, UserProfile } from '../types/nutrition';
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  calculateCalorieTarget,
  calculateWaterTargetMl,
} from '../utils/nutritionMath';

interface OnboardingFlowProps {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
}

const COMMON_ALLERGIES = ['Gluten / Buğday', 'Süt / Laktoz', 'Yumurta', 'Kuruyemiş / Fıstık', 'Susam', 'Balık / Deniz Ürünü', 'Soya'];
const DIET_PREFS = ['Dengeli / Kısıt yok', 'Vejetaryen', 'Vegan', 'Helal hassasiyeti', 'Glütensiz', 'Laktozsuz'];
const TRACKING_TOPICS = ['Kan şekeri dengesi', 'Kolesterol', 'Tansiyon', 'Tuz tüketimi'];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ initialProfile, onComplete }) => {
  const [step, setStep] = useState<number>(initialProfile.kvkkAcceptedAt ? 1 : 0);
  const [kvkkChecked, setKvkkChecked] = useState(Boolean(initialProfile.kvkkAcceptedAt));
  const [draft, setDraft] = useState<UserProfile>(initialProfile);
  const [ageStr, setAgeStr] = useState(String(initialProfile.age));
  const [heightStr, setHeightStr] = useState(String(initialProfile.heightCm));
  const [weightStr, setWeightStr] = useState(String(initialProfile.weightKg));
  const [customAllergy, setCustomAllergy] = useState('');

  const calorieCalc = calculateCalorieTarget(draft);
  const waterCalc = calculateWaterTargetMl(draft);
  const isUnder18 = draft.age < 18;

  const toggleArrayValue = (field: 'allergies' | 'dietPreferences' | 'trackingTopics', val: string) => {
    setDraft((prev) => {
      const current = prev[field];
      const exists = current.includes(val);
      return {
        ...prev,
        [field]: exists ? current.filter((x) => x !== val) : [...current, val],
      };
    });
  };

  const addCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (!trimmed) return;
    if (!draft.allergies.includes(trimmed)) {
      setDraft((prev) => ({ ...prev, allergies: [...prev.allergies, trimmed] }));
    }
    setCustomAllergy('');
  };

  if (step === 0) {
    return (
      <div className="flex-1 flex flex-col px-5 min-[375px]:px-6 pt-5 safe-bottom-lg overflow-y-auto ios-scroll">
        <div className="mt-2 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-[#2D8256] dark:text-[#78D0A1]" />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight text-[#1C241F] dark:text-[#EDF1ED]">
            Denge’ye Hoş Geldin
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#59655D] dark:text-[#A4B0A8]">
            Yediklerini sakin bir dille anlamana yardımcı olan kişisel beslenme asistanın. Hesap açmadan hemen deneyebilirsin.
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-5 space-y-3.5 text-[13px] leading-relaxed text-[#3E4A42] dark:text-[#C8D2CB]">
          <h2 className="text-sm font-semibold text-[#1C241F] dark:text-[#EDF1ED]">
            KVKK ve Sağlık Verisi Açık Rıza Bilgilendirmesi
          </h2>
          <p>
            Boy, kilo, yaş, alerji ve seçtiğiniz sağlık takip konuları yalnızca sizin cihazınızdaki tarayıcı belleğinde saklanır.
          </p>
          <p>
            Fotoğraf, barkod ve sohbet içerikleri yalnızca analiz üretmek amacıyla yapay zeka servisine iletilir; sunucuda kalıcı kişisel profil tutulmaz.
          </p>
          <p className="text-xs text-[#69756D] dark:text-[#8E9B92] pt-1 border-t border-[#ECEFE9] dark:border-[#242E29]">
            Bu uygulama tıbbi tanı, tedavi veya ilaç önerisi sunmaz. Tüm içerikler genel bilgilendirme amaçlıdır ve tıbbi tavsiye değildir.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 p-3.5 rounded-2xl bg-white/70 dark:bg-[#171F1B]/70 border border-[#E5E9E2] dark:border-[#242E29] cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={kvkkChecked}
            onChange={(e) => setKvkkChecked(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded accent-[#46A573] shrink-0"
          />
          <span className="text-[13px] leading-snug text-[#2D3831] dark:text-[#DCE5DF]">
            Kişisel sağlık ve beslenme verilerimin yalnızca bu cihazda saklanmasını ve analiz için işlenmesini onaylıyorum (KVKK).
          </span>
        </label>

        <div className="mt-auto pt-6">
          <button
            type="button"
            disabled={!kvkkChecked}
            onClick={() => {
              setDraft((prev) => ({ ...prev, kvkkAcceptedAt: new Date().toISOString() }));
              setStep(1);
            }}
            className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-[0.98]"
          >
            <span>Devam Et</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4 safe-bottom-lg overflow-y-auto ios-scroll">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-[#59655D] dark:text-[#A4B0A8] cursor-pointer"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx <= step
                  ? 'w-6 bg-[#46A573] dark:bg-[#6AC696]'
                  : 'w-2 bg-[#DCE2DA] dark:bg-[#28342D]'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium tabular-nums text-[#69756D] dark:text-[#8E9B92] w-10 text-right">
          {step}/4
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Seni tanıyalım</h2>
            <p className="text-[13px] text-[#59655D] dark:text-[#9AA89F] mt-1">
              Günlük enerji gereksinimini gerçek formülle hesaplamak için temel bilgiler.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-1.5">
                Adın (isteğe bağlı)
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Örn. Deniz"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm outline-none focus:border-[#5A7D65]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-1.5">
                Biyolojik cinsiyet (BMR formülü için)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['kadin', 'erkek'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setDraft({ ...draft, gender: g })}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-all cursor-pointer active:scale-95 ${
                      draft.gender === g
                        ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60'
                        : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B] text-[#2F3B33] dark:text-[#D5DFD8]'
                    }`}
                  >
                    {g === 'kadin' ? 'Kadın' : 'Erkek'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-1.5">
                Yaş
              </label>
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
                    setDraft({ ...draft, age: num });
                  }
                }}
                onBlur={() => {
                  const num = Math.max(12, Math.min(100, Number(ageStr) || draft.age || 18));
                  setAgeStr(String(num));
                  setDraft({ ...draft, age: num });
                }}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none focus:border-[#5A7D65]"
              />
              {isUnder18 && (
                <p className="mt-2 text-xs text-[#8C6126] dark:text-[#E0A352] flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>18 yaş altında büyüme sağlığı için kilo verme hedefi önerilmez; dengeli koruma uygulanır.</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Ölçülerin</h2>
            <p className="text-[13px] text-[#59655D] dark:text-[#9AA89F] mt-1">
              Mifflin-St Jeor hesabı ve günlük su hedefi için kullanılır.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-1.5">
                  Boy (cm)
                </label>
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
                      setDraft({ ...draft, heightCm: num });
                    }
                  }}
                  onBlur={() => {
                    const num = Math.max(120, Math.min(230, Number(heightStr) || draft.heightCm || 168));
                    setHeightStr(String(num));
                    setDraft({ ...draft, heightCm: num });
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none focus:border-[#5A7D65]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-1.5">
                  Kilo (kg)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={250}
                  step="0.5"
                  value={weightStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWeightStr(val);
                    const num = Number(val);
                    if (val !== '' && !Number.isNaN(num) && num >= 30 && num <= 250) {
                      setDraft({ ...draft, weightKg: num });
                    }
                  }}
                  onBlur={() => {
                    const num = Math.max(30, Math.min(250, Number(weightStr) || draft.weightKg || 64));
                    setWeightStr(String(num));
                    setDraft({ ...draft, weightKg: num });
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none focus:border-[#5A7D65]"
                />
              </div>
            </div>

            <label className="flex items-center justify-between pt-2 border-t border-[#ECEFE9] dark:border-[#242E29] cursor-pointer min-h-[44px]">
              <span className="text-[13px] text-[#2F3B33] dark:text-[#DCE5DF]">
                Özet ekranında kilo takibini gizle
              </span>
              <input
                type="checkbox"
                checked={draft.hideWeightTracking}
                onChange={(e) => setDraft({ ...draft, hideWeightTracking: e.target.checked })}
                className="w-5 h-5 accent-[#5A7D65] rounded"
              />
            </label>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Hareket ve Hedef</h2>
            <p className="text-[13px] text-[#59655D] dark:text-[#9AA89F] mt-1">
              Hedefin gerçekçi ve güvenli sınırlar içinde hesaplanır.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
            <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F]">
              Günlük hareket düzeyi
            </label>
            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDraft({ ...draft, activityLevel: lvl })}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                    draft.activityLevel === lvl
                      ? 'bg-[#E5F6EC] dark:bg-[#1B3125] border-[#73CFA0] dark:border-[#6AC696]'
                      : 'bg-[#F4F6F2] dark:bg-[#101713] border-transparent'
                  }`}
                >
                  <div className="text-sm font-medium">{ACTIVITY_LABELS[lvl].label}</div>
                  <div className="text-xs text-[#69756D] dark:text-[#93A097]">{ACTIVITY_LABELS[lvl].desc}</div>
                </button>
              ))}
            </div>

            <label className="block text-xs font-medium text-[#59655D] dark:text-[#9AA89F] pt-2">
              Genel hedefin
            </label>
            <div className="space-y-2">
              {(['koruma', 'verme', 'alma'] as GoalType[]).map((goal) => {
                const blocked = isUnder18 && goal === 'verme';
                return (
                  <button
                    key={goal}
                    type="button"
                    disabled={blocked}
                    onClick={() => setDraft({ ...draft, goal })}
                    className={`w-full text-left px-3.5 py-2.5 rounded-2xl border transition-all ${
                      blocked
                        ? 'opacity-45 cursor-not-allowed bg-[#F4F6F2] dark:bg-[#101713] border-transparent'
                        : draft.goal === goal
                        ? 'bg-[#E5F6EC] dark:bg-[#1B3125] border-[#73CFA0] dark:border-[#6AC696] cursor-pointer active:scale-[0.99]'
                        : 'bg-[#F4F6F2] dark:bg-[#101713] border-transparent cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <div className="text-sm font-medium">{GOAL_LABELS[goal]}</div>
                    {blocked && (
                      <div className="text-[11px] text-[#8C6126] dark:text-[#E0A352]">
                        18 yaş altında devre dışıdır
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Alerji ve Tercihler</h2>
            <p className="text-[13px] text-[#59655D] dark:text-[#9AA89F] mt-1">
              Yalnızca senin seçtiğin konulara göre yönlendirme yapılır.
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-2">
                Alerjiler (isteğe bağlı)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ALLERGIES.map((item) => {
                  const active = draft.allergies.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleArrayValue('allergies', item)}
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
              <div className="flex gap-2 mt-2.5">
                <input
                  type="text"
                  value={customAllergy}
                  onChange={(e) => setCustomAllergy(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomAllergy()}
                  placeholder="Başka alerji ekle..."
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomAllergy}
                  className="px-3 h-10 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Ekle
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-2">
                Beslenme tercihi
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIET_PREFS.map((item) => {
                  const active = draft.dietPreferences.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleArrayValue('dietPreferences', item)}
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
              <div className="text-xs font-medium text-[#59655D] dark:text-[#9AA89F] mb-2">
                Özen gösterdiğin konular
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TRACKING_TOPICS.map((item) => {
                  const active = draft.trackingTopics.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleArrayValue('trackingTopics', item)}
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
          </div>

          {/* Transparent real formula summary */}
          <div className="rounded-3xl bg-[#E8F7EE] dark:bg-[#193023] border border-[#C3E9D3] dark:border-[#2B4B39] p-4 space-y-1.5">
            <div className="text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD]">
              Hesaplanan Günlük Hedefin
            </div>
            <div className="flex items-baseline gap-4 tabular-nums">
              <span className="text-xl font-bold">{calorieCalc.targetCalories} kcal</span>
              <span className="text-sm font-semibold text-[#427AA8] dark:text-[#76B2E8]">
                {waterCalc.targetMl} ml su
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#2B6647] dark:text-[#A9B7AE]">
              {calorieCalc.formulaText}
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-5">
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
          >
            <span>Devam Et</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onComplete({
                ...draft,
                goal: isUnder18 && draft.goal === 'verme' ? 'koruma' : draft.goal,
                kvkkAcceptedAt: draft.kvkkAcceptedAt || new Date().toISOString(),
                onboardingCompleted: true,
              })
            }
            className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Başla</span>
          </button>
        )}
      </div>
    </div>
  );
};
