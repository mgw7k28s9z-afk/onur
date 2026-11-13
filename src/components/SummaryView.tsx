import React, { useState } from 'react';
import {
  Calendar,
  Award,
  Droplets,
  Scale,
  FileText,
  Printer,
  Copy,
  Check,
  HeartPulse,
  Sparkles,
  Loader2,
  Coffee,
  X,
} from 'lucide-react';
import type { DayLog, UserProfile, WeightEntry } from '../types/nutrition';
import {
  calculateCalorieTarget,
  calculateWaterTargetMl,
  computeGentleStreak,
  computeWeeklyStats,
  getTodayDateKey,
} from '../utils/nutritionMath';
import { generateWeeklyInsightApi } from '../services/aiClient';
import { copyTextReliably } from '../utils/storage';

interface SummaryViewProps {
  days: Record<string, DayLog>;
  profile: UserProfile;
  weightHistory: WeightEntry[];
  onLogWeight: (weightKg: number) => void;
  onToggleRestDayToday: () => void;
  onToggleHideWeight: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  days,
  profile,
  weightHistory,
  onLogWeight,
  onToggleRestDayToday,
  onToggleHideWeight,
}) => {
  const todayKey = getTodayDateKey();
  const calorieBreakdown = calculateCalorieTarget(profile);
  const waterInfo = calculateWaterTargetMl(profile);
  const weekStats = computeWeeklyStats(
    days,
    todayKey,
    calorieBreakdown.targetCalories,
    waterInfo.targetMl
  );
  const streak = computeGentleStreak(days, todayKey);

  const [weightInput, setWeightInput] = useState(String(profile.weightKg));
  const [weightSaved, setWeightSaved] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // Doctor / Dietitian report modal
  const [reportOpen, setReportOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const hasEnoughWeeklyData = weekStats.loggedDaysCount >= 2;
  const maxCalInWeek = Math.max(
    calorieBreakdown.targetCalories,
    ...weekStats.dailyPoints.map((p) => p.caloriesMid),
    1
  );

  const handleGenerateInsight = async () => {
    if (!hasEnoughWeeklyData) return;
    setInsightLoading(true);
    try {
      const summaryInput = `Son 7 günde ${weekStats.loggedDaysCount} gün öğün kaydedildi. Ortalama kalori: ${weekStats.averageCaloriesMid} kcal (hedef ${calorieBreakdown.targetCalories} kcal). Ortalama su: ${weekStats.averageWaterMl} ml (hedef ${waterInfo.targetMl} ml). Hedef bandında gün: ${weekStats.daysWithinCalorieBand}. Su hedefi tamamlanan gün: ${weekStats.daysMetWaterGoal}.`;
      const res = await generateWeeklyInsightApi({ weekStatsSummary: summaryInput, profile });
      setAiInsight(res);
    } catch {
      setAiInsight('Haftalık eğilim özeti şu an oluşturulamadı.');
    } finally {
      setInsightLoading(false);
    }
  };

  // Real weight curve SVG path when >= 2 real points
  const recentWeights = weightHistory.slice(-10);
  const renderWeightChart = () => {
    if (recentWeights.length < 2) {
      return (
        <p className="text-xs text-[#69756D] dark:text-[#93A097]">
          Henüz yeterli veri yok — eğri için en az 2 farklı kilo kaydı gerekir.
        </p>
      );
    }
    const vals = recentWeights.map((w) => w.weightKg);
    const minW = Math.min(...vals) - 1;
    const maxW = Math.max(...vals) + 1;
    const span = Math.max(1, maxW - minW);
    const width = 280;
    const height = 74;

    const points = recentWeights
      .map((w, i) => {
        const x = (i / (recentWeights.length - 1)) * (width - 24) + 12;
        const y = height - 14 - ((w.weightKg - minW) / span) * (height - 28);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
        <polyline
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="stroke-[#46A573] dark:stroke-[#6AC696]"
        />
        {recentWeights.map((w, i) => {
          const x = (i / (recentWeights.length - 1)) * (width - 24) + 12;
          const y = height - 14 - ((w.weightKg - minW) / span) * (height - 28);
          return (
            <circle
              key={w.dateKey + i}
              cx={x}
              cy={y}
              r="3.5"
              className="fill-[#46A573] dark:fill-[#6AC696]"
            />
          );
        })}
      </svg>
    );
  };

  const buildReportPlainText = () => {
    const lines = [
      'DENGE — HAFTALIK BESLENME VE TAKİP RAPORU',
      `Tarih: ${new Date().toLocaleDateString('tr-TR')}`,
      `Danışan: ${profile.name || 'Belirtilmedi'} (${profile.age} yaş, ${profile.heightCm} cm, ${profile.weightKg} kg)`,
      `Günlük Kalori Hedefi (Mifflin-St Jeor): ${calorieBreakdown.targetCalories} kcal`,
      `Günlük Su Hedefi: ${waterInfo.targetMl} ml`,
      '',
      'SON 7 GÜN GERÇEK KAYIT ÖZETİ:',
      weekStats.loggedDaysCount > 0
        ? `- Kayıt yapılan gün sayısı: ${weekStats.loggedDaysCount} / 7`
        : '- Henüz yeterli veri yok.',
      weekStats.loggedDaysCount > 0
        ? `- Ortalama günlük kalori: ${weekStats.averageCaloriesMid} kcal`
        : '',
      weekStats.averageWaterMl > 0
        ? `- Ortalama su tüketimi: ${weekStats.averageWaterMl} ml`
        : '',
      weekStats.topFoods.length > 0
        ? `- En sık tüketilenler: ${weekStats.topFoods.map((f) => `${f.name} (${f.count}×)`).join(', ')}`
        : '',
      '',
      `Alerjiler: ${profile.allergies.join(', ') || 'Yok'}`,
      `Takip konuları: ${profile.trackingTopics.join(', ') || 'Genel denge'}`,
      !profile.hideWeightTracking && weightHistory.length > 0
        ? `Son kilo kayıtları: ${weightHistory
            .slice(-5)
            .map((w) => `${w.dateKey}: ${w.weightKg} kg`)
            .join(' | ')}`
        : '',
      '',
      'Not: Bu rapor kullanıcının kendi kayıtlarından derlenmiştir; tıbbi tanı veya reçete değildir.',
    ];
    return lines.filter(Boolean).join('\n');
  };

  return (
    <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-6 space-y-4">
      <div className="pt-2">
        <h1 className="text-[24px] font-bold tracking-tight">Özet</h1>
        <p className="text-xs text-[#69756D] dark:text-[#93A097] mt-0.5">
          Gerçek kayıtlarından oluşan haftalık denge görünümü
        </p>
      </div>

      {/* Gentle Streak & Rest Day */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-[#2D8256] dark:text-[#78D0A1]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tabular-nums">
                {streak.streakDays > 0 ? `${streak.streakDays} gün sakin takip` : 'Yeni başlangıç'}
              </div>
              <div className="text-xs text-[#69756D] dark:text-[#93A097]">
                Seri bozulunca ceza yok; dinlenebilirsin
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleRestDayToday}
            className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer transition-all shrink-0 active:scale-95 ${
              streak.usedRestDayToday
                ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border-[#73CFA0]/60'
                : 'bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD]'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{streak.usedRestDayToday ? 'Dinlenme Günü' : 'Dinlenme Hakkı'}</span>
          </button>
        </div>

        {/* Weekly Mini Goals */}
        <div className="pt-2 border-t border-[#ECEFE9] dark:border-[#242E29] space-y-2 text-xs">
          <div className="font-semibold text-[#59655D] dark:text-[#9AA89F]">
            Haftalık Küçük Hedefler
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-[#5B9BD5]" />
              <span>Bu hafta 4 gün su hedefini tamamla</span>
            </span>
            <span className="font-semibold tabular-nums">
              {Math.min(4, weekStats.daysMetWaterGoal)} / 4 gün
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#46A573] dark:text-[#6AC696]" />
              <span>En az 3 gün lif dengesi (≥20 g)</span>
            </span>
            <span className="font-semibold tabular-nums">
              {Math.min(3, weekStats.daysWithGoodFiber)} / 3 gün
            </span>
          </div>
        </div>
      </section>

      {/* Weekly 7-day Bars & Summary */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Son 7 Gün</h2>
          {hasEnoughWeeklyData && (
            <button
              type="button"
              disabled={insightLoading}
              onClick={handleGenerateInsight}
              className="text-xs font-semibold text-[#1C593A] dark:text-[#9FE2BD] bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] px-2.5 py-1 rounded-xl inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              {insightLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Eğilim Özeti</span>
            </button>
          )}
        </div>

        {/* 7-day bar chart built strictly from real logs */}
        <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-2">
          {weekStats.dailyPoints.map((pt) => {
            const pct = Math.round((pt.caloriesMid / maxCalInWeek) * 100);
            const over = pt.caloriesMid > calorieBreakdown.targetCalories;
            return (
              <div key={pt.dateKey} className="flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex-1 flex items-end justify-center">
                  <div
                    style={{ height: pt.caloriesMid > 0 ? `${Math.max(10, pct)}%` : '6%' }}
                    className={`w-full max-w-[22px] rounded-t-lg transition-all duration-500 ${
                      pt.caloriesMid === 0
                        ? 'bg-[#E7F2EB] dark:bg-[#222B26]'
                        : over
                        ? 'bg-[#C98A3A] dark:bg-[#E0A352]'
                        : 'bg-[#46A573] dark:bg-[#6AC696]'
                    }`}
                    title={`${pt.shortLabel}: ${pt.caloriesMid} kcal`}
                  />
                </div>
                <span className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">
                  {pt.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {!hasEnoughWeeklyData ? (
          <p className="text-xs text-[#69756D] dark:text-[#93A097] pt-1">
            Henüz yeterli veri yok — en az 2 gün öğün kaydettiğinde haftalık ortalama ve eğilim özetin burada görünür.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#ECEFE9] dark:border-[#242E29] text-center tabular-nums text-xs">
            <div>
              <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Ort. Kalori</div>
              <div className="font-bold mt-0.5">{weekStats.averageCaloriesMid} kcal</div>
            </div>
            <div>
              <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Hedef Dengesi</div>
              <div className="font-bold mt-0.5">{weekStats.daysWithinCalorieBand}/7 gün</div>
            </div>
            <div>
              <div className="text-[10px] text-[#69756D] dark:text-[#8E9B92]">Ort. Su</div>
              <div className="font-bold mt-0.5">{weekStats.averageWaterMl} ml</div>
            </div>
          </div>
        )}

        {aiInsight && (
          <p className="text-xs leading-relaxed text-[#3E4A42] dark:text-[#CBD5CE] bg-[#F4F6F2] dark:bg-[#101713] rounded-2xl p-3">
            {aiInsight}
          </p>
        )}
      </section>

      {/* Optional Weight Tracking */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#46A573] dark:text-[#6AC696]" />
            <h2 className="text-sm font-bold">Kilo Eğrisi (İsteğe Bağlı)</h2>
          </div>
          <button
            type="button"
            onClick={onToggleHideWeight}
            className="text-xs font-medium text-[#1C593A] dark:text-[#9FE2BD] underline cursor-pointer"
          >
            {profile.hideWeightTracking ? 'Göster' : 'Gizle'}
          </button>
        </div>

        {!profile.hideWeightTracking ? (
          <>
            {renderWeightChart()}
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min={30}
                max={250}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none focus:border-[#46A573]"
              />
              <button
                type="button"
                onClick={() => {
                  const val = Number(weightInput);
                  if (val >= 30 && val <= 250) {
                    onLogWeight(val);
                    setWeightSaved(true);
                    window.setTimeout(() => setWeightSaved(false), 2000);
                  }
                }}
                className="h-10 px-4 rounded-xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-xs font-semibold cursor-pointer active:scale-95 transition-all shrink-0"
              >
                {weightSaved ? 'Kaydedildi' : 'Kilo Kaydet'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-[#69756D] dark:text-[#93A097]">
            Kilo takibi tercihiniz üzerine gizlendi.
          </p>
        )}
      </section>

      {/* Apple Health Passive Integration Row */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 flex items-center justify-between gap-3 opacity-75">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#F2F4F0] dark:bg-[#222C26] flex items-center justify-center shrink-0">
            <HeartPulse className="w-4 h-4 text-[#69756D] dark:text-[#93A097]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Apple Sağlık Bağlantısı</div>
            <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
              Adım ve aktif enerji eşitleme
            </div>
          </div>
        </div>
        <span className="text-[11px] font-medium text-[#69756D] dark:text-[#93A097] text-right shrink-0 max-w-[110px]">
          Gerçek uygulamada etkinleşir
        </span>
      </section>

      {/* On-demand Dietitian / Doctor Report */}
      <section className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Diyetisyen / Doktor Raporu</div>
            <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
              Gerçek kayıtlarından haftalık özet oluştur
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="h-9 px-3.5 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold shrink-0 cursor-pointer active:scale-95 transition-all"
        >
          Oluştur
        </button>
      </section>

      {/* Report Modal */}
      {reportOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportOpen(false);
          }}
          className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
        >
          <div className="animate-sheet-up w-full max-h-[88%] rounded-t-[32px] bg-[#F7F8F5] dark:bg-[#141C18] border-t border-[#DCE2DA] dark:border-[#26322B] flex flex-col overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#E5E9E2] dark:border-[#242E29] no-print">
              <h3 className="text-base font-bold">Haftalık Takip Raporu</h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="w-10 h-10 -mr-1.5 rounded-full flex items-center justify-center cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto ios-scroll p-5">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] rounded-2xl p-4">
                {buildReportPlainText()}
              </pre>
            </div>

            <div className="px-5 pt-3.5 safe-bottom-lg border-t border-[#E5E9E2] dark:border-[#242E29] flex flex-wrap gap-2 no-print">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextReliably(buildReportPlainText());
                  if (ok) {
                    setCopiedReport(true);
                    window.setTimeout(() => setCopiedReport(false), 2500);
                  }
                }}
                className="flex-1 h-11 rounded-2xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                {copiedReport ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReport ? 'Kopyalandı' : 'Metni Kopyala'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([buildReportPlainText()], {
                    type: 'text/plain;charset=utf-8',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `denge-rapor-${todayKey}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="h-11 px-3.5 rounded-2xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold inline-flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              >
                İndir
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Yazdır</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
