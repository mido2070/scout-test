import { AnalysisMode, PlotData, Language, PolicyData, LibraryDocument, PolicyUpdate } from "../types";
import { libraryDB } from "./libraryDB";

// --- BRING YOUR OWN KEY (BYOK) STORAGE ---
const BYOK_KEY_STORAGE = 'codescout_user_gemini_api_key';

export const getStoredApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(BYOK_KEY_STORAGE)?.trim() || '';
};

export const setStoredApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(BYOK_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(BYOK_KEY_STORAGE);
  }
};

export const hasStoredApiKey = (): boolean => {
  return Boolean(getStoredApiKey());
};

const getApiHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const userKey = getStoredApiKey();
  if (userKey) {
    headers['x-gemini-api-key'] = userKey;
  }
  return headers;
};

// --- SELF-LEARNING MEMORY SYSTEM ---
// Uses LocalStorage to persist zoning knowledge by City/Country

const getMemoryKey = (city: string, country: string) => 
  `codescout_kb_${country.toLowerCase().trim()}_${city.toLowerCase().trim()}`;

const getLearnedContext = (city: string, country: string): string | null => {
  if (!city || !country) return null;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(getMemoryKey(city, country));
};

const saveLearnedContext = (city: string, country: string, data: string) => {
  if (!city || !country || typeof window === 'undefined') return;
  localStorage.setItem(getMemoryKey(city, country), data);
  console.log(`[CodeScout Memory] Updated knowledge base for ${city}, ${country}`);
};

// --- CLIENT-SIDE API CLIENT (DISPATCHES TO /api/*) ---

export const analyzePolicy = async (
  policyData: PolicyData,
  libraryDocs: LibraryDocument[],
  uiLanguage: Language
): Promise<string> => {
  const response = await fetch('/api/analyze-policy', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ policyData, libraryDocs, uiLanguage }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({ message: response.statusText }))) as any;
    throw new Error(err?.message || `Policy analysis failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.reportHtml;
};

export const refinePolicyReport = async (
  currentHtml: string,
  policyData: PolicyData,
  updatePayload: PolicyUpdate,
  versionNumber: number
): Promise<{ html: string; changeLog: string }> => {
  const response = await fetch('/api/refine-policy', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ currentHtml, policyData, updatePayload, versionNumber }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({ message: response.statusText }))) as any;
    throw new Error(err?.message || `Policy refinement failed with status ${response.status}`);
  }

  return (await response.json()) as { html: string; changeLog: string };
};

export const analyzeZoning = async (
  mode: AnalysisMode,
  dataA: PlotData,
  dataB: PlotData | undefined,
  language: Language
): Promise<{ html: string; groundingMetadata: any }> => {
  // 1. Fetch relevant library documents (Context Retrieval in browser IndexedDB)
  let libraryContext = "";
  try {
    const docs = await libraryDB.findRelevantDocuments(dataA.country, dataA.city);
    if (docs.length > 0) {
      libraryContext = docs.map(d => 
        `- [${d.visibility === 'PUBLIC' ? 'Community' : 'My Library'}] ${d.title} (${d.codeType}): ${d.notes || ''} ${d.url ? `(${d.url})` : ''}`
      ).join('\n');
    }
  } catch (e) {
    console.warn("Failed to retrieve library docs", e);
  }

  // 2. Fetch memory context from LocalStorage
  const learnedContext = getLearnedContext(dataA.city, dataA.country);

  // 3. Dispatch to secure API endpoint
  const response = await fetch('/api/analyze-zoning', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({
      mode,
      dataA,
      dataB,
      language,
      libraryContext,
      learnedContext,
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({ message: response.statusText }))) as any;
    throw new Error(err?.message || `Zoning analysis failed with status ${response.status}`);
  }

  const result = (await response.json()) as { html: string; groundingMetadata: any };
  const html = result.html || "";

  // 4. Extract and persist learned self-knowledge in LocalStorage
  const jsonMatch = html.match(/<!-- LEARNING_BLOCK_START([\s\S]*?)LEARNING_BLOCK_END -->/);
  if (jsonMatch && jsonMatch[1]) {
    saveLearnedContext(dataA.city, dataA.country, jsonMatch[1]);
  }

  return result;
};

export const translateReport = async (htmlContent: string, targetLang: Language): Promise<string> => {
  const response = await fetch('/api/translate-report', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ htmlContent, targetLang }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({ message: response.statusText }))) as any;
    throw new Error(err?.message || `Translation failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.translatedHtml;
};

export const chatWithAssistant = async (
  history: any[], 
  lastMessage: string, 
  context: { plot?: PlotData, analysisResult?: string | null, language: Language, policyContext?: any }
): Promise<string> => {
  const response = await fetch('/api/chat-assistant', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ history, lastMessage, context }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({ message: response.statusText }))) as any;
    throw new Error(err?.message || `Assistant query failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.replyText;
};
