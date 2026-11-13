import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  if (rawMsg.includes('MISSING_GEMINI_API_KEY')) {
    return {
      status: 500,
      message: 'GEMINI_API_KEY tanımlı değil. Settings > Secrets panelinden API anahtarınızı kontrol edin.',
    };
  }
  if (status === 403 || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
    return {
      status: 403,
      message: 'API anahtarı geçersiz veya yetkisiz. Lütfen Settings > Secrets panelinden anahtarınızı kontrol edin.',
    };
  }
  if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'API kullanım kotası doldu. Kısa süre bekleyin veya Settings > Secrets panelinden faturalandırmalı bir anahtar seçin.',
    };
  }
  if (status === 400 || rawMsg.includes('INVALID_ARGUMENT') || rawMsg.includes('Unable to process input image')) {
    return {
      status: 400,
      message: 'Fotoğraf biçimi işlenemedi. Lütfen JPG veya PNG formatında net bir fotoğraf seçin.',
    };
  }
  if (rawMsg.includes('TIMEOUT:')) {
    return {
      status: 504,
      message: 'Yapay zeka yanıt süresi doldu, lütfen tekrar dene.',
    };
  }
  if (rawMsg.includes('fetch failed') || rawMsg.includes('ECONNRESET') || rawMsg.includes('ETIMEDOUT')) {
    return {
      status: 503,
      message: 'Bağlantı geçici olarak kesildi, lütfen tekrar dene.',
    };
  }
  if (status === 404 || rawMsg.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'Yapay zeka modeli yanıt vermedi.',
    };
  }
  return {
    status: 500,
    message: 'Analiz edilemedi, tekrar dene.',
  };
}

function sanitizeBase64Data(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^data:[^;]+;base64,/i, '').trim();
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAuthOrKeyError(err: unknown): boolean {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return (
    rawMsg.includes('MISSING_GEMINI_API_KEY') ||
    status === 403 ||
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('API key not valid')
  );
}

async function generateWithSearchFallback(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    systemInstruction?: string;
    useSearch?: boolean;
    thinkingLevel?: ThinkingLevel;
    responseMimeType?: string;
  }
) {
  const baseConfig: Record<string, unknown> = {};
  if (params.systemInstruction) {
    baseConfig.systemInstruction = params.systemInstruction;
  }
  if (params.thinkingLevel) {
    baseConfig.thinkingConfig = { thinkingLevel: params.thinkingLevel };
  }
  if (params.responseMimeType) {
    baseConfig.responseMimeType = params.responseMimeType;
  }

  const typedContents =
    params.contents as Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];

  if (params.useSearch) {
    try {
      const searchConfig: Record<string, unknown> = {
        ...baseConfig,
        tools: [{ googleSearch: {} }],
      };
      delete searchConfig.responseMimeType;
      return await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: typedContents,
          config: searchConfig,
        }),
        14000,
        'googleSearch'
      );
    } catch (err) {
      if (isAuthOrKeyError(err)) {
        throw err;
      }
      console.warn('Search grounding fallback triggered:', err instanceof Error ? err.message : err);
    }
  }

  try {
    return await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: typedContents,
        config: baseConfig,
      }),
      25000,
      'primaryModel'
    );
  } catch (err) {
    if (isAuthOrKeyError(err)) {
      throw err;
    }
    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 429 || status === 503 || msg.includes('TIMEOUT') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('Primary model fallback triggered, trying gemini-3.1-flash-lite...', msg);
      const liteConfig: Record<string, unknown> = {};
      if (params.systemInstruction) {
        liteConfig.systemInstruction = params.systemInstruction;
      }
      if (params.responseMimeType) {
        liteConfig.responseMimeType = params.responseMimeType;
      }
      return await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: typedContents,
          config: liteConfig,
        }),
        20000,
        'liteModel'
      );
    }
    throw err;
  }
}

interface GroundingSource {
  title: string;
  url: string;
}

function extractGroundingSources(response: unknown): GroundingSource[] {
  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      let fallbackHost = 'Kaynak';
      try {
        fallbackHost = new URL(uri).hostname;
      } catch {
        // ignore malformed URI
      }
      sources.push({
        title: title?.trim() || fallbackHost,
        url: uri,
      });
    }
  }
  return sources.slice(0, 4);
}

function extractFirstBalancedJson(text: string): string | null {
  let startIdx = -1;
  let openChar = '{';
  let closeChar = '}';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      startIdx = i;
      openChar = ch;
      closeChar = ch === '{' ? '}' : ']';
      break;
    }
  }
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }
  return text.slice(startIdx);
}

function parseJsonResponse<T>(rawText: string | undefined): T {
  if (!rawText || !rawText.trim()) {
    throw new Error('Model boş yanıt döndürdü.');
  }
  const withoutFences = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonSlice = extractFirstBalancedJson(withoutFences);
  if (!jsonSlice) {
    throw new Error('JSON yanıtı çözümlenemedi.');
  }
  try {
    return JSON.parse(jsonSlice) as T;
  } catch {
    // Remove trailing commas before } or ] as a minor repair attempt
    const repaired = jsonSlice.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(repaired) as T;
  }
}

async function generateJsonWithFallback<T>(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    systemInstruction?: string;
    useSearch?: boolean;
    thinkingLevel?: ThinkingLevel;
  }
): Promise<{ parsed: T; sources: GroundingSource[] }> {
  if (params.useSearch) {
    try {
      const searchResp = await generateWithSearchFallback(ai, {
        contents: params.contents,
        systemInstruction: params.systemInstruction,
        useSearch: true,
        thinkingLevel: ThinkingLevel.LOW,
      });
      const parsed = parseJsonResponse<T>(searchResp.text);
      return { parsed, sources: extractGroundingSources(searchResp) };
    } catch (err) {
      if (isAuthOrKeyError(err)) {
        throw err;
      }
      console.warn('Search JSON attempt failed, retrying with strict JSON mode:', err instanceof Error ? err.message : err);
    }
  }

  const strictResp = await generateWithSearchFallback(ai, {
    contents: params.contents,
    systemInstruction: params.systemInstruction,
    useSearch: false,
    thinkingLevel: params.thinkingLevel ?? ThinkingLevel.LOW,
    responseMimeType: 'application/json',
  });
  const parsed = parseJsonResponse<T>(strictResp.text);
  return { parsed, sources: extractGroundingSources(strictResp) };
}

function formatProfileContext(profile: Record<string, unknown> | undefined): string {
  if (!profile) return 'Profil bilgisi yok.';
  const allergies = Array.isArray(profile.allergies) && profile.allergies.length > 0
    ? (profile.allergies as string[]).join(', ')
    : 'Belirtilmedi';
  const prefs = Array.isArray(profile.dietPreferences) && profile.dietPreferences.length > 0
    ? (profile.dietPreferences as string[]).join(', ')
    : 'Belirtilmedi';
  const topics = Array.isArray(profile.trackingTopics) && profile.trackingTopics.length > 0
    ? (profile.trackingTopics as string[]).join(', ')
    : 'Belirtilmedi';
  return [
    `Yaş: ${profile.age ?? 'bilinmiyor'}`,
    `Cinsiyet: ${profile.gender ?? 'bilinmiyor'}`,
    `Boy: ${profile.heightCm ?? '?'} cm, Kilo: ${profile.weightKg ?? '?'} kg`,
    `Alerjiler: ${allergies}`,
    `Beslenme tercihleri: ${prefs}`,
    `Takip edilen konular (yalnızca kullanıcının girdikleri): ${topics}`,
  ].join(' | ');
}

const NUTRITION_RULES = `
Sen Türkiye mutfağını, günlük ev ölçülerini (1 kepçe, 1 dilim, 1 çay bardağı, 1 yemek kaşığı, 1 kase, 1 adet, 1 porsiyon, bütün/yarım) ve paketli Türk gıda ürünlerini çok iyi bilen, kanıta dayalı bir beslenme analiz asistanısın.
Kurallar:
1. Besin değerlerini öncelikle TürKomp (Türkiye Ulusal Gıda Kompozisyon Veri Tabanı), USDA FoodData Central veya ürünün resmi etiketine dayandır. Bilmediğin yemek veya markalı ürün için Google Arama aracını kullan.
2. FOTOĞRAFTA GÖRÜNEN HER ŞEYİN TOPLAMINI HESAPLA (ASLA SADECE 1 DİLİM VEYA TEK PORSİYON VARSAYMA!):
   - Fotoğrafta bütün bir büyük boy pizza (ör. 8 dilim) varsa 1 dilimin değil TÜM PİZZANIN (8 dilimin tamamı) toplam kalorisini ve besin değerlerini hesapla.
   - Bir tabakta veya masada birden fazla yiyecek/içecek varsa (ör. ana yemek + pilav + salata + ekmek + içecek) her kalemi tek tek sayıp toplamını ver.
   - Yalnızca kullanıcı notunda açıkça "sadece 2 dilim yedim" veya "yarım porsiyon" gibi bir miktar sınırı yazdıysa o miktarı hesapla.
3. Kalori ve besin değerlerini gerçekçi bir ALT-ÜST ARALIK (caloriesMin, caloriesMax) olarak ver. Makro değerleri (proteinG, carbsG, fatG) kalori aralığıyla termodinamik olarak tutarlı olsun (1 g protein ≈ 4 kcal, 1 g karbonhidrat ≈ 4 kcal, 1 g yağ ≈ 9 kcal).
4. Emin değilsen ASLA uydurma: confidence değerini "düşük" veya "orta" yap ve kullanıcıya porsiyon, boyut veya içindekiler hakkında kısa, tek cümlelik bir clarificationQuestion sor.
5. Kullanıcının alerjileri varsa ve yemek bunu içeriyor olabilirse detectedAllergens listesine ekle.
6. Asla teşhis koyma, ilaç/takviye dozu önerme, korkutucu veya suçlayıcı dil kullanma.
7. Görselde gerçekten hiçbir yiyecek, içecek veya gıda etiketi yoksa (ör. boş duvar, manzara, tamamen karanlık/okunmaz kare) { "unrecognizable": true, "reason": "..." } döndür. Yiyecek seçilebiliyor ancak miktar/içerik net değilse "unrecognizable": false bırak, "confidence": "düşük" ver ve "clarificationQuestion" sor.
`.trim();

function round1(val: number): number {
  return Math.round(Math.max(0, val) * 10) / 10;
}

function buildValidatedNutrition(
  parsed: Record<string, unknown>,
  sources: GroundingSource[],
  fallbackName: string,
  fallbackPortionLabel = 'Fotoğraftaki toplam miktar'
) {
  const rawBreakdown = Array.isArray(parsed.itemsBreakdown)
    ? (parsed.itemsBreakdown as Array<Record<string, unknown>>)
    : [];

  const itemsBreakdown = rawBreakdown
    .filter((item) => item && (item.name || item.caloriesMin || item.caloriesMax))
    .map((item) => {
      const cMin = Math.max(0, Math.round(Number(item.caloriesMin) || 0));
      const cMax = Math.max(cMin, Math.round(Number(item.caloriesMax) || cMin));
      return {
        name: String(item.name || fallbackName),
        quantityLabel: String(item.quantityLabel || item.portionLabel || '1 adet'),
        estimatedGrams: Math.max(0, Math.round(Number(item.estimatedGrams) || 0)),
        caloriesMin: cMin,
        caloriesMax: cMax,
        proteinG: Math.max(0, Number(item.proteinG) || 0),
        carbsG: Math.max(0, Number(item.carbsG) || 0),
        fatG: Math.max(0, Number(item.fatG) || 0),
        fiberG: Math.max(0, Number(item.fiberG) || 0),
        sugarG: Math.max(0, Number(item.sugarG) || 0),
        sodiumMg: Math.max(0, Math.round(Number(item.sodiumMg) || 0)),
      };
    });

  let caloriesMin = Math.max(0, Math.round(Number(parsed.caloriesMin) || 0));
  let caloriesMax = Math.max(caloriesMin, Math.round(Number(parsed.caloriesMax) || caloriesMin));
  let proteinG = Math.max(0, Number(parsed.proteinG) || 0);
  let carbsG = Math.max(0, Number(parsed.carbsG) || 0);
  let fatG = Math.max(0, Number(parsed.fatG) || 0);
  let fiberG = Math.max(0, Number(parsed.fiberG) || 0);
  let sugarG = Math.max(0, Number(parsed.sugarG) || 0);
  let sodiumMg = Math.max(0, Math.round(Number(parsed.sodiumMg) || 0));

  // Toplamları ve aralıkları kod hesaplar: öğe dökümü varsa kalemlerden topla
  if (itemsBreakdown.length > 0) {
    const sumMin = itemsBreakdown.reduce((s, i) => s + i.caloriesMin, 0);
    const sumMax = itemsBreakdown.reduce((s, i) => s + i.caloriesMax, 0);
    const sumP = itemsBreakdown.reduce((s, i) => s + i.proteinG, 0);
    const sumC = itemsBreakdown.reduce((s, i) => s + i.carbsG, 0);
    const sumF = itemsBreakdown.reduce((s, i) => s + i.fatG, 0);
    const sumFib = itemsBreakdown.reduce((s, i) => s + i.fiberG, 0);
    const sumSug = itemsBreakdown.reduce((s, i) => s + i.sugarG, 0);
    const sumSod = itemsBreakdown.reduce((s, i) => s + i.sodiumMg, 0);

    if (sumMax > 0) {
      caloriesMin = sumMin;
      caloriesMax = Math.max(sumMin, sumMax);
    }
    if (sumP + sumC + sumF > 0) {
      proteinG = sumP;
      carbsG = sumC;
      fatG = sumF;
    }
    if (sumFib > 0) fiberG = sumFib;
    if (sumSug > 0) sugarG = sumSug;
    if (sumSod > 0) sodiumMg = sumSod;
  }

  // Atwater termodinamik tutarlılık kontrolü (1g P=4, 1g C=4, 1g F=9 kcal)
  const atwaterKcal = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
  if (atwaterKcal > 40) {
    if (caloriesMin === 0 && caloriesMax === 0) {
      caloriesMin = Math.round(atwaterKcal * 0.9);
      caloriesMax = Math.round(atwaterKcal * 1.1);
    } else if (caloriesMax < atwaterKcal * 0.72 || caloriesMin > atwaterKcal * 1.32) {
      caloriesMin = Math.round(atwaterKcal * 0.9);
      caloriesMax = Math.round(atwaterKcal * 1.1);
    }
  }

  return {
    name: String(parsed.name || fallbackName),
    portionLabel: String(parsed.portionLabel || fallbackPortionLabel),
    caloriesMin,
    caloriesMax,
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    fiberG: round1(fiberG),
    sugarG: round1(sugarG),
    sodiumMg,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
    detectedAllergens: Array.isArray(parsed.detectedAllergens)
      ? parsed.detectedAllergens.map(String)
      : [],
    confidence:
      parsed.confidence === 'yüksek' || parsed.confidence === 'düşük'
        ? parsed.confidence
        : ('orta' as const),
    clarificationQuestion: parsed.clarificationQuestion
      ? String(parsed.clarificationQuestion)
      : null,
    sources,
    itemsBreakdown: itemsBreakdown.map(({ name, quantityLabel, estimatedGrams, caloriesMin: cMin, caloriesMax: cMax }) => ({
      name,
      quantityLabel,
      estimatedGrams,
      caloriesMin: cMin,
      caloriesMax: cMax,
    })),
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  // 1. Fotoğraftan yemek tanıma & analiz
  app.post('/api/analyze-meal-photo', async (req, res) => {
    try {
      const { imageBase64, mimeType, userHint, profile } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        userHint?: string;
        profile?: Record<string, unknown>;
      };
      const cleanBase64 = sanitizeBase64Data(imageBase64);
      if (!cleanBase64 || !mimeType) {
        res.status(400).json({ error: 'Fotoğraf verisi eksik veya geçersiz.' });
        return;
      }

      const ai = getAiClient();
      const promptText = `
${NUTRITION_RULES}

Kullanıcı profili: ${formatProfileContext(profile)}
${userHint ? `Kullanıcı notu: ${userHint}` : ''}

Bu fotoğraftaki TÜM yiyecek ve içecekleri dikkatle incele ve adım adım hesapla:
1. Fotoğrafta ne görüyorsan HEPSİNİ say (bütün bir büyük boy pizza ise 8 dilimin tamamını, tabakta birden çok çeşit varsa hepsini, yanında içecek/sos varsa onları da dahil et). ASLA bütün bir pizzanın sadece 1 dilimini veya büyük bir tabağın yarısını baz alma.
2. Her kalem için boyut (ör. büyük boy ~32-34 cm pizza, orta boy tabak, derin kase), adet/dilim sayısı ve tahmini toplam gramajı (estimatedGrams) belirle.
3. TürKomp / USDA FoodData Central verilerine göre gramajla uyumlu gerçekçi kalori aralığı ve makroları çıkar (ör. büyük boy bütün karışık/sucuklu kaşarlı pizza genellikle ~750–950 g ve toplam ~1.850–2.450 kcal civarındadır; 1 dilim ~230–310 kcal'dir).
4. "portionLabel" alanında fotoğraftaki toplam görünen miktarı açıkça belirt (ör. "1 bütün büyük boy pizza (8 dilim)" veya "1 tam tabak (4 köfte + pilav + salata)").

Sadece aşağıdaki JSON yapısında yanıt ver (başka metin ekleme):
{
  "unrecognizable": false,
  "name": "Fotoğraftaki öğünün Türkçe adı",
  "portionLabel": "Fotoğrafta görünen toplam miktar (ör. 1 bütün büyük boy pizza (8 dilim))",
  "itemsBreakdown": [
    {
      "name": "Karışık büyük boy pizza",
      "quantityLabel": "1 bütün (8 dilim)",
      "estimatedGrams": 820,
      "caloriesMin": 1900,
      "caloriesMax": 2300,
      "proteinG": 88,
      "carbsG": 225,
      "fatG": 78,
      "fiberG": 14,
      "sugarG": 16,
      "sodiumMg": 3600
    }
  ],
  "caloriesMin": 1900,
  "caloriesMax": 2300,
  "proteinG": 88,
  "carbsG": 225,
  "fatG": 78,
  "fiberG": 14,
  "sugarG": 16,
  "sodiumMg": 3600,
  "ingredients": ["pizza hamuru", "kaşar peyniri", "sucuk", "domates sos"],
  "detectedAllergens": ["gluten", "süt"],
  "confidence": "yüksek" | "orta" | "düşük",
  "clarificationQuestion": "Emin değilsen kısa soru (ör. hamur ince mi kalın mı / tamamını mı yedin?), eminsen null",
  "sourceNote": "TürKomp / USDA FoodData Central"
}
      `.trim();

      const { parsed, sources: groundingSources } = await generateJsonWithFallback<Record<string, unknown>>(ai, {
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: promptText },
          ],
        },
        useSearch: true,
        thinkingLevel: ThinkingLevel.LOW,
      });

      if (parsed.unrecognizable) {
        res.status(422).json({
          error: (parsed.reason as string) || 'Fotoğraftaki yiyecek net seçilemedi. Daha aydınlık ve net bir fotoğraf deneyin.',
        });
        return;
      }

      if (groundingSources.length === 0 && typeof parsed.sourceNote === 'string') {
        groundingSources.push({ title: parsed.sourceNote, url: '' });
      }

      res.json({
        nutrition: buildValidatedNutrition(parsed, groundingSources, 'Tanımlanan öğün'),
      });
    } catch (err) {
      console.error('analyze-meal-photo error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Barkod ve besin etiketi okuma + web araştırması
  app.post('/api/analyze-barcode-label', async (req, res) => {
    try {
      const { imageBase64, mimeType, manualBarcode, profile } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        manualBarcode?: string;
        profile?: Record<string, unknown>;
      };

      const cleanBase64 = sanitizeBase64Data(imageBase64);
      if (!cleanBase64 && !manualBarcode?.trim()) {
        res.status(400).json({ error: 'Barkod numarası veya etiket fotoğrafı gerekli.' });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
      if (cleanBase64 && mimeType) {
        parts.push({ inlineData: { mimeType, data: cleanBase64 } });
      }
      parts.push({
        text: `
${NUTRITION_RULES}

Kullanıcı profili: ${formatProfileContext(profile)}
${manualBarcode ? `Kullanıcının girdiği barkod: ${manualBarcode.trim()}` : ''}

Görevin:
1. Fotoğrafta barkod numarası varsa oku ve Google Arama ile bu ürünü (marka, ürün adı, besin değerleri) bul.
2. Barkod bulunamazsa veya okunmazsa, fotoğraftaki "Besin Değerleri / Enerji ve Besin Öğeleri" tablosunu doğrudan oku.
3. Değerleri 1 PORSİYON (veya 100g/100ml eğer porsiyon yazmıyorsa) bazında döndür ve portionLabel alanında bunu açıkça yaz (ör. "1 porsiyon (30 g)" veya "100 g").

Yalnızca JSON döndür:
{
  "unrecognizable": false,
  "barcode": "varsa barkod rakamları veya null",
  "brand": "marka veya null",
  "name": "Ürün adı",
  "portionLabel": "1 porsiyon (.. g) veya 100 g",
  "caloriesMin": 140,
  "caloriesMax": 155,
  "proteinG": 3.5,
  "carbsG": 18,
  "fatG": 6,
  "fiberG": 1.2,
  "sugarG": 8,
  "sodiumMg": 180,
  "ingredients": ["etikette veya aramada bulunan ana bileşenler"],
  "detectedAllergens": ["etiket/ürün alerjenleri"],
  "confidence": "yüksek" | "orta" | "düşük",
  "clarificationQuestion": "Varsa tüketilen miktar sorusu veya null",
  "sourceNote": "Ürün Etiketi / Web Araştırması"
}
        `.trim(),
      });

      const { parsed, sources } = await generateJsonWithFallback<Record<string, unknown>>(ai, {
        contents: { parts },
        useSearch: true,
        thinkingLevel: ThinkingLevel.LOW,
      });

      if (parsed.unrecognizable) {
        res.status(422).json({ error: 'Barkod veya besin etiketi okunamadı. Daha net bir fotoğraf dene.' });
        return;
      }

      if (sources.length === 0 && typeof parsed.sourceNote === 'string') {
        sources.push({ title: parsed.sourceNote, url: '' });
      }

      const validated = buildValidatedNutrition(parsed, sources, 'Paketli ürün', '1 porsiyon');
      res.json({
        nutrition: {
          ...validated,
          barcode: parsed.barcode ? String(parsed.barcode) : manualBarcode?.trim() || null,
          brand: parsed.brand ? String(parsed.brand) : null,
        },
      });
    } catch (err) {
      console.error('analyze-barcode-label error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Yazı veya ses metnini kalemlere bölerek analiz et
  app.post('/api/parse-text-meal', async (req, res) => {
    try {
      const { text, profile } = req.body as {
        text?: string;
        profile?: Record<string, unknown>;
      };
      if (!text?.trim()) {
        res.status(400).json({ error: 'Yediğiniz yiyeceği yazın.' });
        return;
      }

      const ai = getAiClient();
      const { parsed, sources } = await generateJsonWithFallback<{ items?: Array<Record<string, unknown>> }>(ai, {
        contents: `
${NUTRITION_RULES}

Kullanıcı profili: ${formatProfileContext(profile)}
Kullanıcının yazdığı öğün: "${text.trim()}"

Bu ifadeyi ayrı yiyecek/içecek kalemlerine böl (ör. "iki dilim peynirli pide ve ayran" -> 1. Peynirli pide (2 dilim), 2. Ayran (1 su bardağı)).
Her kalem için TürKomp / USDA FoodData Central verilerine dayalı aralık ve değerleri döndür.
Yalnızca JSON döndür:
{
  "items": [
    {
      "name": "Kalem adı",
      "portionLabel": "ör. 2 dilim",
      "caloriesMin": 420,
      "caloriesMax": 520,
      "proteinG": 18,
      "carbsG": 52,
      "fatG": 16,
      "fiberG": 3,
      "sugarG": 2,
      "sodiumMg": 650,
      "ingredients": ["un", "peynir"],
      "detectedAllergens": ["gluten", "süt"],
      "confidence": "orta",
      "clarificationQuestion": null,
      "sourceNote": "TürKomp"
    }
  ]
}
        `.trim(),
        useSearch: true,
        thinkingLevel: ThinkingLevel.LOW,
      });
      const items = (parsed.items ?? []).map((item) => {
        const itemSources =
          sources.length > 0
            ? sources
            : [{ title: String(item.sourceNote || 'TürKomp / USDA FoodData Central'), url: '' }];
        return buildValidatedNutrition(item, itemSources, text.trim(), '1 porsiyon');
      });

      if (items.length === 0) {
        res.status(422).json({ error: 'Yiyecek kalemi ayrıştırılamadı, tekrar dene.' });
        return;
      }

      res.json({ items });
    } catch (err) {
      console.error('parse-text-meal error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Kullanıcı düzeltmesi veya netleştirme cevabı ile yeniden hesaplama
  app.post('/api/recalculate-corrected-meal', async (req, res) => {
    try {
      const { correctedName, userAnswer, currentPortionLabel, profile } = req.body as {
        correctedName?: string;
        userAnswer?: string;
        currentPortionLabel?: string;
        profile?: Record<string, unknown>;
      };

      if (!correctedName?.trim()) {
        res.status(400).json({ error: 'Yemek adı gerekli.' });
        return;
      }

      const ai = getAiClient();
      const { parsed, sources } = await generateJsonWithFallback<Record<string, unknown>>(ai, {
        contents: `
${NUTRITION_RULES}

Kullanıcı profili: ${formatProfileContext(profile)}
Düzeltilmiş yemek adı: "${correctedName.trim()}"
Mevcut porsiyon/miktar: "${currentPortionLabel || '1 porsiyon'}"
${userAnswer ? `Kullanıcının ek detayı / cevabı: "${userAnswer.trim()}"` : ''}

Kullanıcının düzeltmesi ve porsiyon/ek detayına göre (eğer kullanıcı sadece belirli dilim veya porsiyon belirttiyse o miktarı, bütün ürün/tabak belirttiyse tamamını) TürKomp ve USDA verilerine dayanarak güncel besin değerlerini JSON olarak döndür:
{
  "name": "Yemek adı",
  "portionLabel": "Güncel miktar / porsiyon birimi",
  "itemsBreakdown": [
    {
      "name": "Kalem adı",
      "quantityLabel": "Miktar",
      "estimatedGrams": 250,
      "caloriesMin": 300,
      "caloriesMax": 380,
      "proteinG": 14,
      "carbsG": 35,
      "fatG": 12,
      "fiberG": 4,
      "sugarG": 3,
      "sodiumMg": 500
    }
  ],
  "caloriesMin": 300,
  "caloriesMax": 380,
  "proteinG": 14,
  "carbsG": 35,
  "fatG": 12,
  "fiberG": 4,
  "sugarG": 3,
  "sodiumMg": 500,
  "ingredients": ["malzeme 1"],
  "detectedAllergens": [],
  "confidence": "yüksek" | "orta" | "düşük",
  "clarificationQuestion": null,
  "sourceNote": "TürKomp / USDA FoodData Central"
}
        `.trim(),
        useSearch: true,
        thinkingLevel: ThinkingLevel.MEDIUM,
      });

      if (sources.length === 0) {
        sources.push({ title: String(parsed.sourceNote || 'TürKomp / USDA FoodData Central'), url: '' });
      }

      res.json({
        nutrition: buildValidatedNutrition(
          parsed,
          sources,
          correctedName.trim(),
          currentPortionLabel || '1 porsiyon'
        ),
      });
    } catch (err) {
      console.error('recalculate-corrected-meal error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Öğüne özel Etki Kartı (2-3 satır, şablonsuz, sakin ve yönlendirici)
  app.post('/api/meal-impact', async (req, res) => {
    try {
      const { mealSummary, dayContext, profile } = req.body as {
        mealSummary?: string;
        dayContext?: string;
        profile?: Record<string, unknown>;
      };

      const ai = getAiClient();
      const { parsed } = await generateJsonWithFallback<Record<string, unknown>>(ai, {
        contents: `
Sen sakin, destekleyici bir beslenme asistanısın. Aşağıdaki öğün için 2-3 cümlelik kısa bir "Etki Kartı" üret.
Öğün: ${mealSummary}
Bugünkü bağlam: ${dayContext}
Kullanıcı profili: ${formatProfileContext(profile)}

Kesin kurallar:
- Hazır kalıp kullanma; tam olarak bu öğünün içeriğine ve kullanıcının bugünkü durumuna göre yaz.
- Kişiselleştirmeyi YALNIZCA kullanıcının girdiği takip konularına (şeker, kolesterol, tansiyon, tuz gibi) ve alerjilere dayandır; profilde olmayan bir sağlık durumu varsayma.
- Sabit saat kuralı verme (ör. "2 saat tatlı yeme" YASAK).
- Korkutucu, uyarıcı, yargılayıcı veya teşhis/tedavi dili YASAK.
- Yalnızca JSON döndür:
{
  "whatItContains": "1 kısa cümle: Ne içeriyor (protein/lif/karbonhidrat/yağ dengesi)",
  "generalEffect": "1 kısa cümle: Vücuda ve enerji/tokluk veya takip konusuna genel etkisi",
  "gentleSuggestion": "1 kısa cümle: Sonraki öğün veya su için sakin küçük bir öneri"
}
        `.trim(),
        thinkingLevel: ThinkingLevel.LOW,
      });
      res.json({
        impact: {
          whatItContains: String(parsed.whatItContains || ''),
          generalEffect: String(parsed.generalEffect || ''),
          gentleSuggestion: String(parsed.gentleSuggestion || ''),
          disclaimer: 'Tıbbi tavsiye değildir.',
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('meal-impact error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Günün Tavsiyesi (o gün yenenlere özel, abartısız, kaynaklı)
  app.post('/api/daily-advice', async (req, res) => {
    try {
      const { dayMealsSummary, totalsSummary, waterMl, waterTargetMl, profile } = req.body as {
        dayMealsSummary?: string;
        totalsSummary?: string;
        waterMl?: number;
        waterTargetMl?: number;
        profile?: Record<string, unknown>;
      };

      const ai = getAiClient();
      const { parsed, sources } = await generateJsonWithFallback<Record<string, unknown>>(ai, {
        contents: `
Kullanıcının bugünkü gerçek kayıtlarına bakarak sakin, abartısız tek bir günlük besin tavsiyesi yaz.
Bugün yenilenler: ${dayMealsSummary}
Günlük toplamlar: ${totalsSummary}
Su tüketimi: ${waterMl ?? 0} ml / Hedef ${waterTargetMl ?? 2000} ml
Profil: ${formatProfileContext(profile)}

Kurallar:
- Vitamin veya takviye dozu ASLA önerme.
- Kesin saat kuralı koyma, korkutma.
- Kaynağını belirt (ör. Türkiye Beslenme Rehberi TÜBER, WHO veya TürKomp).
- Yalnızca JSON döndür:
{
  "title": "Kısa başlık (3-5 kelime)",
  "advice": "2-3 cümlelik sakin, bugüne özel tavsiye",
  "sourceLabel": "Kaynak adı (ör. TÜBER / WHO)"
}
        `.trim(),
        useSearch: false,
        thinkingLevel: ThinkingLevel.LOW,
      });

      res.json({
        advice: {
          title: String(parsed.title || 'Günün Dengesi'),
          advice: String(parsed.advice || ''),
          sourceLabel: String(parsed.sourceLabel || 'TÜBER / WHO'),
          sources,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('daily-advice error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 7. "Ne yesem?" önerisi (kalan kalori, eksik lif/protein/su + opsiyonel buzdolabı fotoğrafı)
  app.post('/api/what-to-eat', async (req, res) => {
    try {
      const {
        remainingCalMin,
        remainingCalMax,
        dayMealsSummary,
        missingSummary,
        profile,
        fridgeImageBase64,
        fridgeMimeType,
      } = req.body as {
        remainingCalMin?: number;
        remainingCalMax?: number;
        dayMealsSummary?: string;
        missingSummary?: string;
        profile?: Record<string, unknown>;
        fridgeImageBase64?: string;
        fridgeMimeType?: string;
      };

      const cleanFridgeBase64 = sanitizeBase64Data(fridgeImageBase64);
      const ai = getAiClient();
      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
      if (cleanFridgeBase64 && fridgeMimeType) {
        parts.push({ inlineData: { mimeType: fridgeMimeType, data: cleanFridgeBase64 } });
      }
      parts.push({
        text: `
Kullanıcıya "bugün için fikir" olarak Türk mutfağından 2-3 akşam yemeği veya ara öğün seçeneği öner. Bu bir diyet reçetesi değil, sakin bir fikir listesidir.
Kalan kalori aralığı: ${remainingCalMin ?? 300} – ${remainingCalMax ?? 500} kcal
Bugün yedikleri: ${dayMealsSummary || 'Henüz kayıt yok'}
Eksik görünen konular: ${missingSummary || 'Dengeli lif ve protein'}
Kullanıcı profili: ${formatProfileContext(profile)}
${fridgeImageBase64 ? 'Ekteki buzdolabı/mutfak fotoğrafındaki malzemeleri tespit et ve öncelikle eldeki malzemelerden pratik fikirler öner.' : ''}

Alerji varsa mutlaka "içerebilir — içindekiler listesini mutlaka kontrol et" notu ekle. Beslenme tercihlerine (vejetaryen, helal, glütensiz vb.) uy.
Yalnızca JSON döndür:
{
  "intro": "1 kısa cümle özet",
  "suggestions": [
    {
      "title": "Yemek fikri",
      "portionLabel": "ör. 1 kase + 1 dilim tam buğday ekmek",
      "caloriesMin": 320,
      "caloriesMax": 410,
      "whyItFits": "Neden bugün için iyi bir fikir (lif, protein veya hafiflik)",
      "allergenNote": "Varsa alerjen notu veya null"
    }
  ]
}
        `.trim(),
      });

      const { parsed } = await generateJsonWithFallback<{
        intro?: string;
        suggestions?: Array<Record<string, unknown>>;
      }>(ai, {
        contents: { parts },
        thinkingLevel: ThinkingLevel.LOW,
      });

      res.json({
        intro: String(parsed.intro || 'Bugün kalan dengene uygun birkaç sakin fikir:'),
        suggestions: (parsed.suggestions ?? []).slice(0, 3).map((s) => ({
          title: String(s.title || 'Ev yemeği seçeneği'),
          portionLabel: String(s.portionLabel || '1 porsiyon'),
          caloriesMin: Math.max(50, Math.round(Number(s.caloriesMin) || 250)),
          caloriesMax: Math.max(80, Math.round(Number(s.caloriesMax) || 350)),
          whyItFits: String(s.whyItFits || ''),
          allergenNote: s.allergenNote ? String(s.allergenNote) : null,
        })),
      });
    } catch (err) {
      console.error('what-to-eat error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 8. Haftalık eğilim özeti (yalnızca yeterli gerçek veri varsa çağrılır)
  app.post('/api/weekly-insight', async (req, res) => {
    try {
      const { weekStatsSummary, profile } = req.body as {
        weekStatsSummary?: string;
        profile?: Record<string, unknown>;
      };

      const ai = getAiClient();
      const response = await generateWithSearchFallback(ai, {
        contents: `
Kullanıcının son 7 günlük gerçek kayıt verilerine dayanarak 1-2 cümlelik sakin, yargılamayan bir eğilim özeti yaz.
Veriler: ${weekStatsSummary}
Profil: ${formatProfileContext(profile)}
Asla puanlama, suçluluk yaratan ifade veya tıbbi teşhis kullanma. Yalnızca düz Türkçe metin döndür (JSON değil).
        `.trim(),
        thinkingLevel: ThinkingLevel.LOW,
      });

      res.json({ summary: (response.text ?? '').trim() });
    } catch (err) {
      console.error('weekly-insight error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 9. Sohbet Asistanı (önceki mesajları, bugünkü kayıtları hatırlar, araştırma & güvenlik sınırları uygular)
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, dayContext, weekContext, profile } = req.body as {
        messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
        dayContext?: string;
        weekContext?: string;
        profile?: Record<string, unknown>;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Mesaj boş olamaz.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `
Sen Denge uygulamasının sakin, güvenilir Türkçe beslenme ve yaşam tarzı asistanısın.
Kullanıcı profili: ${formatProfileContext(profile)}
Bugünkü gerçek kayıtlar: ${dayContext || 'Bugün henüz kayıt yok.'}
Son 7 gün özeti: ${weekContext || 'Yeterli haftalık veri yok.'}

KESİN GÜVENLİK VE DAVRANIŞ KURALLARI:
1. Tıbbi teşhis koyma, hastalık tedavisi önerme, ilaç veya vitamin/takviye dozu verme. Yanıtların bilgi amaçlıdır ("tıbbi tavsiye değildir" bilinciyle konuş).
2. CİDDİ BELİRTİ KURALI: Kullanıcı göğüs ağrısı, bayılma, nefes darlığı, şiddetli baş dönmesi, aşırı halsizlik, çarpıntı gibi ciddi belirtilerden bahsederse KESİNLİKLE yemek/diyet tavsiyesi verme; doğrudan bir hekime veya 112 Acil / acil servise başvurmasını nazikçe ve netçe öner.
3. YEME BOZUKLUĞU KURALI: Kullanıcı aşırı kısıtlama, kendini aç bırakma, kusma, kendini cezalandırma veya yeme bozukluğu eğilimi belirtirse kalori hesabı ve diyet tavsiyesini DERHAL durdur; şefkatli bir dille bir uzmandan veya güvendiği bir yakınından destek almasını öner.
4. Bilimsel bilgi gerektiren sorularda Google Arama aracını kullanarak doğrulanmış bilgi (TürKomp, USDA, TÜBER, WHO) sun ve kaynak belirt.
5. Sabit saat yasakları (ör. "2 saat bir şey yeme") verme; suçluluk yaratan, korkutan ifadeler kullanma.
6. Kısa, anlaşılır, doğal ve samimi Türkçe ile yanıt ver.
      `.trim();

      const contents = messages.slice(-14).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const response = await generateWithSearchFallback(ai, {
        contents,
        systemInstruction,
        useSearch: true,
      });

      const replyText = (response.text ?? '').trim();
      if (!replyText) {
        res.status(500).json({ error: 'Yanıt oluşturulamadı, tekrar dene.' });
        return;
      }

      const sources = extractGroundingSources(response);
      const lower = replyText.toLowerCase();
      const safetyNotice =
        lower.includes('112') ||
        lower.includes('acil') ||
        lower.includes('doktor') ||
        lower.includes('hekim') ||
        lower.includes('uzman desteği');

      res.json({
        reply: replyText,
        sources,
        safetyNotice,
      });
    } catch (err) {
      console.error('chat error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite dev middleware vs Production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Denge sunucusu http://0.0.0.0:${PORT} adresinde hazır`);
  });
}

createServer().catch((err) => {
  console.error('Sunucu başlatılamadı:', err);
  process.exit(1);
});
