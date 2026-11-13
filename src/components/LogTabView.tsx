import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Barcode,
  Type as TypeIcon,
  Mic,
  MicOff,
  Bookmark,
  Copy,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import type {
  FavoriteTemplate,
  MealEntry,
  MealInputMethod,
  NutritionBase,
  PortionSize,
  UserProfile,
} from '../types/nutrition';
import { compressImageFile } from '../utils/storage';
import {
  analyzeBarcodeOrLabelApi,
  analyzeMealPhotoApi,
  parseTextMealApi,
} from '../services/aiClient';
import { AnalysisResultSheet } from './AnalysisResultSheet';
import { PhotoSourceSheet } from './PhotoSourceSheet';

interface LogTabViewProps {
  profile: UserProfile;
  favorites: FavoriteTemplate[];
  yesterdayMeals: MealEntry[];
  onSaveMeal: (
    params: {
      base: NutritionBase;
      portionSize: PortionSize;
      servingCount: number;
      cookedInExtraOil: boolean;
      method: MealInputMethod;
      photoDataUrl?: string;
    },
    options?: { stayOnTab?: boolean }
  ) => void;
  onRemoveFavorite: (favoriteId: string) => void;
  onCopyYesterday: () => number;
  onGoToTodayTab: () => void;
}

type CaptureMode = 'foto' | 'barkod' | 'yazi' | 'favori';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const LogTabView: React.FC<LogTabViewProps> = ({
  profile,
  favorites,
  yesterdayMeals,
  onSaveMeal,
  onRemoveFavorite,
  onCopyYesterday,
  onGoToTodayTab,
}) => {
  const [mode, setMode] = useState<CaptureMode>('foto');

  // Photo & Scanning Beam state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoHint, setPhotoHint] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [photoSheetTarget, setPhotoSheetTarget] = useState<'foto' | 'barkod' | null>(null);

  // Barcode / Label state
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const lastMealCompressedRef = useRef<{ dataUrl: string; base64: string; mimeType: string } | null>(null);
  const lastBarcodeCompressedRef = useRef<{ dataUrl: string; base64: string; mimeType: string } | null>(null);

  // Text / Voice state
  const [mealText, setMealText] = useState('');
  const [parsedItems, setParsedItems] = useState<NutritionBase[]>([]);
  const [editingParsedIndex, setEditingParsedIndex] = useState<number | null>(null);
  const [addedItemToast, setAddedItemToast] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Slide-up Result Sheet state
  const [pendingResult, setPendingResult] = useState<{
    nutrition: NutritionBase;
    photoDataUrl?: string;
    method: MealInputMethod;
  } | null>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const analyzeCompressedMealPhoto = async (compressed: {
    dataUrl: string;
    base64: string;
    mimeType: string;
  }) => {
    setScanError(null);
    setAnalyzing(true);
    try {
      const nutrition = await analyzeMealPhotoApi({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        userHint: photoHint.trim() || undefined,
        profile,
      });
      setPendingResult({
        nutrition,
        photoDataUrl: compressed.dataUrl,
        method: 'foto',
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
    } finally {
      setAnalyzing(false);
    }
  };

  const processMealPhotoFile = async (file: File) => {
    setScanError(null);
    setAnalyzing(true);
    try {
      const compressed = await compressImageFile(file, 1024, 0.8);
      lastMealCompressedRef.current = compressed;
      setPhotoPreview(compressed.dataUrl);
      await analyzeCompressedMealPhoto(compressed);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
      setAnalyzing(false);
    }
  };

  const analyzeCompressedBarcodePhoto = async (compressed: {
    dataUrl: string;
    base64: string;
    mimeType: string;
  }) => {
    setScanError(null);
    setAnalyzing(true);
    try {
      const nutrition = await analyzeBarcodeOrLabelApi({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        manualBarcode: manualBarcode.trim() || undefined,
        profile,
      });
      setPendingResult({
        nutrition,
        photoDataUrl: compressed.dataUrl,
        method: 'barkod',
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
    } finally {
      setAnalyzing(false);
    }
  };

  const processBarcodePhotoFile = async (file: File) => {
    setScanError(null);
    setAnalyzing(true);
    try {
      const compressed = await compressImageFile(file, 1024, 0.82);
      lastBarcodeCompressedRef.current = compressed;
      setBarcodePreview(compressed.dataUrl);
      await analyzeCompressedBarcodePhoto(compressed);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
      setAnalyzing(false);
    }
  };

  const handleManualBarcodeLookup = async () => {
    if (!manualBarcode.trim()) return;
    setScanError(null);
    setAnalyzing(true);
    try {
      const nutrition = await analyzeBarcodeOrLabelApi({
        manualBarcode: manualBarcode.trim(),
        profile,
      });
      setPendingResult({
        nutrition,
        method: 'barkod',
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleParseText = async () => {
    if (!mealText.trim()) return;
    setScanError(null);
    setAnalyzing(true);
    setParsedItems([]);
    try {
      const items = await parseTextMealApi({ text: mealText.trim(), profile });
      if (items.length === 1) {
        setPendingResult({ nutrition: items[0], method: 'yazi' });
      } else {
        setParsedItems(items);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Analiz edilemedi, tekrar dene.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) return;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'tr-TR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setMealText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-6 space-y-4">
        <div className="pt-2">
          <h1 className="text-[24px] font-bold tracking-tight">Öğün Kaydet</h1>
          <p className="text-xs text-[#69756D] dark:text-[#93A097] mt-0.5">
            Fotoğraf, barkod/etiket, yazı veya favorilerden seç
          </p>
        </div>

        {/* Mode Segmented Bar */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#E8F0EA] dark:bg-[#19221D]">
          {(
            [
              { id: 'foto', label: 'Fotoğraf', icon: Camera },
              { id: 'barkod', label: 'Barkod', icon: Barcode },
              { id: 'yazi', label: 'Yaz / Ses', icon: TypeIcon },
              { id: 'favori', label: 'Favori', icon: Bookmark },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setScanError(null);
                }}
                className={`min-h-[42px] py-1.5 min-[390px]:py-0 min-[390px]:h-10 px-1 rounded-xl text-[10px] min-[390px]:text-[11px] font-semibold flex flex-col min-[390px]:flex-row items-center justify-center gap-0.5 min-[390px]:gap-1 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  active
                    ? 'bg-[#8EE0B3] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] shadow-xs'
                    : 'text-[#4E5C53] dark:text-[#93A097]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error banner with one-tap retry */}
        {scanError && (
          <div className="rounded-2xl bg-[#C98A3A]/12 dark:bg-[#E0A352]/14 p-3.5 flex items-center justify-between gap-2.5 text-xs text-[#8C6126] dark:text-[#E0A352]">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
            {!analyzing &&
              ((mode === 'foto' && lastMealCompressedRef.current) ||
                (mode === 'barkod' && (lastBarcodeCompressedRef.current || manualBarcode.trim())) ||
                (mode === 'yazi' && mealText.trim())) && (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'foto' && lastMealCompressedRef.current) {
                      void analyzeCompressedMealPhoto(lastMealCompressedRef.current);
                    } else if (mode === 'barkod' && lastBarcodeCompressedRef.current) {
                      void analyzeCompressedBarcodePhoto(lastBarcodeCompressedRef.current);
                    } else if (mode === 'barkod' && manualBarcode.trim()) {
                      void handleManualBarcodeLookup();
                    } else if (mode === 'yazi' && mealText.trim()) {
                      void handleParseText();
                    }
                  }}
                  className="shrink-0 font-semibold underline cursor-pointer py-1 px-1"
                >
                  Tekrar Dene
                </button>
              )}
          </div>
        )}

        {/* Mode 1: Photo Capture + Scanning Beam */}
        {mode === 'foto' && (
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
            <div
              onClick={() => {
                if (!analyzing) setPhotoSheetTarget('foto');
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !analyzing) {
                  e.preventDefault();
                  setPhotoSheetTarget('foto');
                }
              }}
              className="relative h-44 min-[390px]:h-52 rounded-2xl overflow-hidden bg-[#EFF2EC] dark:bg-[#101713] border border-dashed border-[#C7D0C4] dark:border-[#2C3931] flex flex-col items-center justify-center cursor-pointer"
            >
              {photoPreview ? (
                <>
                  <img
                    src={photoPreview}
                    alt="Yemek fotoğrafı"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/25 overflow-hidden pointer-events-none">
                      <div className="w-full h-16 bg-gradient-to-b from-transparent via-[#8EC49D]/65 to-transparent animate-scan-beam" />
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                        <span className="px-3 py-1.5 rounded-full bg-black/65 text-white text-xs font-medium backdrop-blur-sm">
                          Görseldeki tüm yiyecekler taranıyor...
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center px-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6 text-[#2D8256] dark:text-[#78D0A1]" />
                  </div>
                  <p className="text-xs font-medium text-[#3E4A42] dark:text-[#C8D2CB]">
                    Tabağının veya yiyeceğin fotoğrafını ekle
                  </p>
                  <p className="text-[11px] text-[#69756D] dark:text-[#8E9B92]">
                    Görselde ne varsa tamamının kalorisi hesaplanır; istersen sonra dilim/porsiyon ayarlayabilirsin.
                  </p>
                </div>
              )}
            </div>

            <input
              type="text"
              value={photoHint}
              onChange={(e) => setPhotoHint(e.target.value)}
              placeholder="İstersen kısa not ekle (ör. büyük boy pizza, sadece 2 dilim yedim)"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-xs outline-none focus:border-[#46A573]"
            />

            <button
              type="button"
              disabled={analyzing}
              onClick={() => setPhotoSheetTarget('foto')}
              className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analiz ediliyor...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>{photoPreview ? 'Yeni Fotoğraf Ekle' : 'Fotoğraf Ekle'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Mode 2: Barcode / Label Photo */}
        {mode === 'barkod' && (
          <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-4">
            <div
              onClick={() => {
                if (!analyzing) setPhotoSheetTarget('barkod');
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !analyzing) {
                  e.preventDefault();
                  setPhotoSheetTarget('barkod');
                }
              }}
              className="relative h-36 min-[390px]:h-44 rounded-2xl overflow-hidden bg-[#EFF2EC] dark:bg-[#101713] border border-dashed border-[#C7D0C4] dark:border-[#2C3931] flex flex-col items-center justify-center cursor-pointer"
            >
              {barcodePreview ? (
                <>
                  <img
                    src={barcodePreview}
                    alt="Ürün etiketi veya barkodu"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/25 overflow-hidden pointer-events-none">
                      <div className="w-full h-14 bg-gradient-to-b from-transparent via-[#8EC49D]/65 to-transparent animate-scan-beam" />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center px-6 space-y-1.5">
                  <Barcode className="w-7 h-7 text-[#2D8256] dark:text-[#78D0A1] mx-auto" />
                  <p className="text-xs font-medium">Barkod veya Besin Değerleri Tablosu</p>
                  <p className="text-[11px] text-[#69756D] dark:text-[#8E9B92]">
                    Ürün barkodu webde araştırılır; bulunamazsa etiket tablosu doğrudan okunur.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={analyzing}
              onClick={() => setPhotoSheetTarget('barkod')}
              className="w-full h-12 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Barkod / Etiket okunuyor...</span>
                </>
              ) : (
                <>
                  <Barcode className="w-4 h-4" />
                  <span>Barkod veya Etiket Fotoğrafı Ekle</span>
                </>
              )}
            </button>

            <div className="pt-2 border-t border-[#ECEFE9] dark:border-[#242E29] space-y-2">
              <label className="block text-[11px] text-[#69756D] dark:text-[#93A097]">
                Veya barkod numarasını yaz
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualBarcode.trim() && !analyzing) {
                      void handleManualBarcodeLookup();
                    }
                  }}
                  placeholder="Örn. 8690504..."
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm tabular-nums outline-none focus:border-[#46A573]"
                />
                <button
                  type="button"
                  disabled={analyzing || !manualBarcode.trim()}
                  onClick={handleManualBarcodeLookup}
                  className="h-11 px-4 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                >
                  Ara
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Text & Voice Entry */}
        {mode === 'yazi' && (
          <div className="space-y-3">
            <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 space-y-3">
              <textarea
                rows={3}
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                placeholder="Örn. iki dilim peynirli pide, bir bardak ayran ve bir çay bardağı şekersiz çay"
                className="w-full p-3.5 rounded-2xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] text-sm outline-none focus:border-[#46A573] resize-none"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={analyzing || !mealText.trim()}
                  onClick={handleParseText}
                  className="flex-1 h-11 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer active:scale-[0.98] transition-all"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kalemlere ayrılıyor...</span>
                    </>
                  ) : (
                    <span>Çözümle</span>
                  )}
                </button>

                {speechSupported ? (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer transition-colors ${
                      listening
                        ? 'bg-[#C98A3A] text-white border-transparent'
                        : 'bg-[#F4F6F2] dark:bg-[#101713] border-[#E2E7DF] dark:border-[#26312B]'
                    }`}
                    aria-label={listening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
                    title="Sesle yaz (Türkçe)"
                  >
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                ) : (
                  <div
                    className="h-11 px-3 rounded-2xl bg-[#F4F6F2] dark:bg-[#101713] border border-[#E2E7DF] dark:border-[#26312B] flex items-center gap-1.5 text-[10px] text-[#69756D] dark:text-[#8E9B92]"
                    title="Tarayıcınız sesli girişi desteklemiyor"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Gerçek uygulamada etkinleşir</span>
                  </div>
                )}
              </div>
            </div>

            {addedItemToast && (
              <div className="rounded-2xl bg-[#E5F6EC] dark:bg-[#1B3125] border border-[#C3E9D3] dark:border-[#2C4B3A] px-3.5 py-2.5 flex items-center justify-between text-xs text-[#1C593A] dark:text-[#9FE2BD]">
                <span>{addedItemToast}</span>
                <button
                  type="button"
                  onClick={onGoToTodayTab}
                  className="font-semibold underline cursor-pointer"
                >
                  Bugün&apos;e Git
                </button>
              </div>
            )}

            {parsedItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold px-1 text-[#59655D] dark:text-[#9AA89F]">
                  Ayrıştırılan kalemler (onaylamak için dokun):
                </div>
                {parsedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.name}</div>
                      <div className="text-xs text-[#69756D] dark:text-[#93A097] tabular-nums">
                        {item.portionLabel} · {item.caloriesMin}–{item.caloriesMax} kcal
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingParsedIndex(idx);
                          setPendingResult({ nutrition: item, method: 'yazi' });
                        }}
                        className="h-9 px-3 rounded-xl bg-[#E5F6EC] hover:bg-[#D7F0E1] dark:bg-[#1B3125] text-[#1C593A] dark:text-[#9FE2BD] text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const hasMore = parsedItems.length > 1;
                          onSaveMeal(
                            {
                              base: item,
                              portionSize: 'normal',
                              servingCount: 1,
                              cookedInExtraOil: false,
                              method: 'yazi',
                            },
                            { stayOnTab: hasMore }
                          );
                          setParsedItems((prev) => prev.filter((_, i) => i !== idx));
                          if (hasMore) {
                            setAddedItemToast(`${item.name} bugüne eklendi.`);
                            window.setTimeout(() => setAddedItemToast(null), 3500);
                          }
                        }}
                        className="h-9 px-3 rounded-xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Ekle</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode 4: Favorites & Copy Yesterday */}
        {mode === 'favori' && (
          <div className="space-y-3">
            <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Dünü Kopyala</div>
                <div className="text-xs text-[#69756D] dark:text-[#93A097]">
                  {yesterdayMeals.length > 0
                    ? `Dün kaydedilen ${yesterdayMeals.length} öğünü bugüne ekle`
                    : 'Dün için kayıtlı öğün bulunmuyor'}
                </div>
              </div>
              <button
                type="button"
                disabled={yesterdayMeals.length === 0}
                onClick={() => {
                  const count = onCopyYesterday();
                  if (count > 0) {
                    setCopyFeedback(`${count} öğün bugüne kopyalandı.`);
                    window.setTimeout(() => setCopyFeedback(null), 3000);
                  }
                }}
                className="h-10 px-4 rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Kopyala</span>
              </button>
            </div>

            {copyFeedback && (
              <p className="text-xs font-medium text-[#2D8256] dark:text-[#78D0A1] px-1">
                {copyFeedback}
              </p>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold px-1 text-[#59655D] dark:text-[#9AA89F]">
                Sık Yenenler ve Favoriler
              </div>
              {favorites.length === 0 ? (
                <div className="rounded-3xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-5 text-center text-xs text-[#69756D] dark:text-[#93A097]">
                  Henüz favorin yok. Bugün ekranında bir öğün kartını sağa kaydırarak favorilerine ekleyebilirsin.
                </div>
              ) : (
                favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="rounded-2xl bg-white dark:bg-[#171F1B] border border-[#E5E9E2] dark:border-[#242E29] p-3.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {fav.photoDataUrl ? (
                        <img
                          src={fav.photoDataUrl}
                          alt={fav.base.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] flex items-center justify-center shrink-0">
                          <Bookmark className="w-4 h-4 text-[#2D8256] dark:text-[#78D0A1]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{fav.base.name}</div>
                        <div className="text-xs text-[#69756D] dark:text-[#93A097] tabular-nums">
                          {fav.base.portionLabel} · {fav.base.caloriesMin}–{fav.base.caloriesMax} kcal
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRemoveFavorite(fav.id)}
                        className="h-9 px-2.5 rounded-xl bg-[#F4F6F2] dark:bg-[#1E2722] text-[#69756D] dark:text-[#93A097] text-xs font-medium cursor-pointer active:scale-95"
                        aria-label={`${fav.base.name} favoriden kaldır`}
                      >
                        Kaldır
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveMeal({
                            base: fav.base,
                            portionSize: fav.defaultPortionSize,
                            servingCount: 1,
                            cookedInExtraOil: fav.defaultExtraOil,
                            method: 'favori',
                            photoDataUrl: fav.photoDataUrl,
                          })
                        }
                        className="h-9 px-3.5 rounded-xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] text-[#103924] dark:text-[#0A2014] text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slide-up Result Bottom Sheet */}
      {pendingResult && (
        <AnalysisResultSheet
          initialNutrition={pendingResult.nutrition}
          photoDataUrl={pendingResult.photoDataUrl}
          profile={profile}
          onClose={() => {
            setPendingResult(null);
            setEditingParsedIndex(null);
          }}
          onConfirmSave={({ base, portionSize, servingCount, cookedInExtraOil }) => {
            const method = pendingResult.method;
            const photoDataUrl = pendingResult.photoDataUrl;
            const editedIdx = editingParsedIndex;
            const hasMoreParsed = editedIdx !== null && parsedItems.length > 1;
            setPendingResult(null);
            setEditingParsedIndex(null);

            if (editedIdx !== null) {
              setParsedItems((prev) => prev.filter((_, i) => i !== editedIdx));
              if (hasMoreParsed) {
                setAddedItemToast(`${base.name} bugüne eklendi.`);
                window.setTimeout(() => setAddedItemToast(null), 3500);
              }
            }

            onSaveMeal(
              {
                base,
                portionSize,
                servingCount,
                cookedInExtraOil,
                method,
                photoDataUrl,
              },
              { stayOnTab: hasMoreParsed }
            );
          }}
        />
      )}
      {/* Photo Source Selection Sheet (Fotoğraf Çek / Fotoğraf Arşivi / Dosyalar) */}
      <PhotoSourceSheet
        open={photoSheetTarget !== null}
        title={photoSheetTarget === 'barkod' ? 'Barkod veya Etiket Fotoğrafı' : 'Fotoğraf Ekle'}
        subtitle={
          photoSheetTarget === 'barkod'
            ? 'Ürün etiketini kamerayla çek veya arşiv/dosyalardan seç'
            : 'Kamerayla çek, fotoğraf arşivinden ya da dosyalardan seç'
        }
        onClose={() => setPhotoSheetTarget(null)}
        onSelectFile={(file) => {
          if (photoSheetTarget === 'barkod') {
            void processBarcodePhotoFile(file);
          } else {
            void processMealPhotoFile(file);
          }
        }}
      />
    </div>
  );
};
