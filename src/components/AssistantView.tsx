import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react';
import type { ChatMessage, DayLog, UserProfile } from '../types/nutrition';
import {
  calculateCalorieTarget,
  calculateWaterTargetMl,
  computeDayTotals,
  computeWeeklyStats,
  getTodayDateKey,
} from '../utils/nutritionMath';
import { sendChatMessageApi } from '../services/aiClient';

interface AssistantViewProps {
  messages: ChatMessage[];
  onAppendMessages: (newMsgs: ChatMessage[]) => void;
  onClearMessages: () => void;
  todayLog: DayLog;
  days: Record<string, DayLog>;
  profile: UserProfile;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  messages,
  onAppendMessages,
  onClearMessages,
  todayLog,
  days,
  profile,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (customText?: string, retryConversation?: ChatMessage[]) => {
    const text = (customText ?? input).trim();
    if ((!text && !retryConversation) || sending) return;

    let updatedConversation: ChatMessage[];
    if (retryConversation) {
      updatedConversation = retryConversation;
    } else {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
      };
      updatedConversation = [...messages, userMsg];
      onAppendMessages([userMsg]);
      if (!customText) setInput('');
    }

    setSending(true);
    setError(null);
    try {
      const calTarget = calculateCalorieTarget(profile).targetCalories;
      const waterTarget = calculateWaterTargetMl(profile).targetMl;
      const dayTotals = computeDayTotals(todayLog.meals);
      const dayContext = [
        `Tarih: ${todayLog.dateKey}`,
        `Hedef kalori: ${calTarget} kcal, Tüketilen aralık: ${dayTotals.caloriesMin}-${dayTotals.caloriesMax} kcal`,
        `Makrolar: Protein ${dayTotals.proteinG}g, Karb ${dayTotals.carbsG}g, Yağ ${dayTotals.fatG}g, Lif ${dayTotals.fiberG}g`,
        `Su: ${todayLog.waterMl} / ${waterTarget} ml`,
        `Öğünler: ${
          todayLog.meals.length > 0
            ? todayLog.meals
                .map((m) => `${m.base.name} (${m.base.portionLabel})`)
                .join(', ')
            : 'Henüz öğün kaydı yok'
        }`,
      ].join(' | ');

      const weekStats = computeWeeklyStats(days, getTodayDateKey(), calTarget, waterTarget);
      const weekContext =
        weekStats.loggedDaysCount >= 2
          ? `Son 7 günde ${weekStats.loggedDaysCount} gün kayıt var. Ortalama ${weekStats.averageCaloriesMid} kcal, ortalama su ${weekStats.averageWaterMl} ml.`
          : 'Son 7 gün için yeterli veri henüz yok.';

      const result = await sendChatMessageApi({
        messages: updatedConversation.map((m) => ({ role: m.role, text: m.text })),
        dayContext,
        weekContext,
        profile,
      });

      onAppendMessages([
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.reply,
          sources: result.sources,
          safetyNotice: result.safetyNotice,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yanıt alınamadı, tekrar dene.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-2 pb-2.5 flex items-center justify-between border-b border-[#E5E9E2] dark:border-[#242E29] shrink-0">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Asistan</h1>
          <p className="text-[11px] text-[#69756D] dark:text-[#93A097]">
            Bugünkü kayıtlarına göre sohbet · Tıbbi tavsiye değildir
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearMessages}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#69756D] dark:text-[#93A097] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Sohbeti temizle"
            title="Sohbeti temizle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto ios-scroll px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-5 space-y-3 mt-4">
            <h2 className="text-[15px] font-semibold">Merak ettiğini sor</h2>
            <p className="text-xs leading-relaxed text-[#59655D] dark:text-[#9AA89F]">
              Bugün yediklerine, kalan dengene, Türk mutfağı porsiyonlarına veya ürün içeriklerine dair dilediğin soruyu yazabilirsin.
            </p>
            <div className="space-y-2 pt-1">
              {[
                'Bugün protein ve lif dengem nasıl görünüyor?',
                'Akşam dışarıda pide yersem yanında ne tercih etmeliyim?',
                'Çayı şekersiz içmeye nasıl alışabilirim?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#EBF8F0] hover:bg-[#DCF3E5] dark:bg-[#172B20] border border-[#C7EAD6] dark:border-[#294736] text-xs font-medium text-[#174E32] dark:text-[#A4E4C0] cursor-pointer active:scale-[0.99] transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-[13px] leading-relaxed space-y-2 ${
                    isUser
                      ? 'bg-[#8EE0B3] dark:bg-[#234332] text-[#103924] dark:text-[#E5F6EC] rounded-br-lg'
                      : 'bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] rounded-bl-lg'
                  }`}
                >
                  {msg.safetyNotice && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C6126] dark:text-[#E0A352]">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Güvenlik yönlendirmesi</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-1.5 border-t border-[#ECEFE9] dark:border-[#242E29] space-y-1 text-[11px]">
                      <div className="text-[#69756D] dark:text-[#8E9B92]">Kaynaklar:</div>
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[#2D8256] dark:text-[#78D0A1] underline"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-3xl rounded-bl-lg bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] px-4 py-3 flex items-center gap-2 text-xs text-[#69756D] dark:text-[#93A097]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D8256] dark:text-[#78D0A1]" />
              <span>Düşünülüyor...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-[#C98A3A]/12 dark:bg-[#E0A352]/14 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#8C6126] dark:text-[#E0A352]">
            <span>{error}</span>
            {messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
              <button
                type="button"
                onClick={() => void handleSend(undefined, messages)}
                className="font-semibold underline shrink-0 cursor-pointer"
              >
                Tekrar Dene
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 bg-[#F7F8F5]/95 dark:bg-[#0F1512]/95 border-t border-[#E5E9E2] dark:border-[#242E29] shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Sorunu buraya yaz..."
            className="flex-1 h-11 px-4 rounded-2xl bg-white dark:bg-[#171F1B] border border-[#DCE2DA] dark:border-[#26322B] text-sm outline-none focus:border-[#46A573]"
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            onClick={() => void handleSend()}
            className="w-11 h-11 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 transition-all"
            aria-label="Gönder"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
