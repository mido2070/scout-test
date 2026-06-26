import { AnalysisMode, PlotData, Language, PolicyData, LibraryDocument, PolicyUpdate } from "../types";
import { libraryDB } from "./libraryDB";

// --- SELF-LEARNING MEMORY SYSTEM ---
// Uses LocalStorage to persist zoning knowledge by City/Country on the client side.

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

// --- CLIENT-SIDE ENDPOINTS (Proxies to Vercel Serverless Functions) ---

export const analyzeZoning = async (
  mode: AnalysisMode,
  dataA: PlotData,
  dataB: PlotData | undefined,
  language: Language
): Promise<{ html: string; groundingMetadata: any }> => {
  // 1. Fetch relevant library documents (Context Retrieval) on client
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

  // 2. Fetch memory context on client
  const learnedContext = getLearnedContext(dataA.city, dataA.country);

  // 3. Call backend secure endpoint
  const response = await fetch('/api/analyze-zoning', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode,
      dataA,
      dataB,
      language,
      libraryContext,
      learnedContext
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server responded with ${response.status}`);
  }

  const result = await response.json();
  const html = result.html || "";

  // 4. Client-side Memory Extraction
  const jsonMatch = html.match(/<!-- LEARNING_BLOCK_START([\s\S]*?)LEARNING_BLOCK_END -->/);
  if (jsonMatch && jsonMatch[1]) {
     saveLearnedContext(dataA.city, dataA.country, jsonMatch[1]);
  }

  return {
    html,
    groundingMetadata: result.groundingMetadata
  };
};

export const translateReport = async (htmlContent: string, targetLang: Language): Promise<string> => {
  const response = await fetch('/api/translate-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      htmlContent,
      targetLang
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server responded with ${response.status}`);
  }

  const result = await response.json();
  return result.translatedHtml || htmlContent;
};

export const chatWithAssistant = async (
  history: any[], 
  lastMessage: string, 
  context: { plot?: PlotData, analysisResult?: string | null, language: Language, policyContext?: any }
): Promise<string> => {
  const response = await fetch('/api/chat-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      history,
      lastMessage,
      context
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server responded with ${response.status}`);
  }

  const result = await response.json();
  return result.replyText || "";
};

export const analyzePolicy = async (
  policyData: PolicyData,
  libraryDocs: LibraryDocument[],
  uiLanguage: Language
): Promise<string> => {
  const response = await fetch('/api/analyze-policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      policyData,
      libraryDocs,
      uiLanguage
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server responded with ${response.status}`);
  }

  const result = await response.json();
  return result.reportHtml || "";
};

export const refinePolicyReport = async (
  currentHtml: string,
  policyData: PolicyData,
  updatePayload: PolicyUpdate,
  versionNumber: number
): Promise<{ html: string; changeLog: string }> => {
  const response = await fetch('/api/refine-policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentHtml,
      policyData,
      updatePayload,
      versionNumber
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server responded with ${response.status}`);
  }

  return await response.json();
};
