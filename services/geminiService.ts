import { AnalysisMode, PlotData, Language, PolicyData, LibraryDocument, PolicyUpdate } from "../types";
import { libraryDB } from "./libraryDB";
import { getCurrentIdToken } from "./firebaseClient";

export interface QuotaStatus {
  allowed: boolean;
  status: number;
  reason?: string;
  message?: string;
  userRemaining: number;
  globalRemaining: number;
  dateUtc: string;
}

// In-memory turnstile token holder
let currentTurnstileToken: string | null = null;

export const setTurnstileToken = (token: string | null) => {
  currentTurnstileToken = token;
};

export const getTurnstileToken = () => currentTurnstileToken;

const generateRequestId = () => 
  `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': generateRequestId(),
  };

  const idToken = await getCurrentIdToken();
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  if (currentTurnstileToken) {
    headers['cf-turnstile-response'] = currentTurnstileToken;
  }

  return headers;
};

// --- ROBUST API RESPONSE PARSER ---
/**
 * Safely parse JSON from an API Response.
 * Verifies Content-Type is application/json before parsing.
 * If HTML or invalid response is returned, displays a clean user-facing error message
 * without leaking raw HTML or JSON parse syntax errors.
 */
async function parseJsonResponse<T = any>(
  response: Response,
  defaultErrorMessage: string
): Promise<T> {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // If server unexpectedly returned HTML (e.g. SPA fallback, Cloudflare error page):
  if (!contentType.includes('application/json')) {
    throw new Error(
      'CodeScout API is temporarily unavailable. The server returned an unexpected response.'
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      'CodeScout API is temporarily unavailable. The server returned an unexpected response.'
    );
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || defaultErrorMessage;
    throw new Error(errorMsg);
  }

  return data as T;
}

// --- SELF-LEARNING MEMORY SYSTEM ---
const getMemoryKey = (city: string, country: string) => 
  `codescout_kb_${country.toLowerCase().trim()}_${city.toLowerCase().trim()}`;

const getLearnedContext = (city: string, country: string): string | null => {
  if (!city || !country || typeof window === 'undefined') return null;
  return localStorage.getItem(getMemoryKey(city, country));
};

const saveLearnedContext = (city: string, country: string, data: string) => {
  if (!city || !country || typeof window === 'undefined') return;
  localStorage.setItem(getMemoryKey(city, country), data);
};

// --- QUOTA STATUS CHECK ---
export const fetchUsageStatus = async (): Promise<QuotaStatus> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/usage-status', { headers });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!contentType.includes('application/json')) {
      return {
        allowed: false,
        status: res.status || 503,
        reason: 'CodeScout API is temporarily unavailable. The server returned an unexpected response.',
        userRemaining: 0,
        globalRemaining: 0,
        dateUtc: new Date().toISOString().split('T')[0],
      };
    }

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok || !data) {
      return {
        allowed: false,
        status: res.status || 503,
        reason: data?.message || 'Quota service is currently unavailable.',
        userRemaining: 0,
        globalRemaining: 0,
        dateUtc: new Date().toISOString().split('T')[0],
      };
    }

    return data as QuotaStatus;
  } catch {
    return {
      allowed: false,
      status: 503,
      reason: 'CodeScout API is temporarily unavailable. The server returned an unexpected response.',
      userRemaining: 0,
      globalRemaining: 0,
      dateUtc: new Date().toISOString().split('T')[0],
    };
  }
};

// --- CLIENT-SIDE API CLIENT (DISPATCHES TO /api/*) ---

export const analyzePolicy = async (
  policyData: PolicyData,
  libraryDocs: LibraryDocument[],
  uiLanguage: Language
): Promise<string> => {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Sign in with Google to start your free AI analysis.');
  }

  const response = await fetch('/api/analyze-policy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ policyData, libraryDocs, uiLanguage }),
  });

  const data = await parseJsonResponse<{ reportHtml: string }>(
    response,
    `Policy analysis failed (Status ${response.status})`
  );
  return data.reportHtml;
};

export const refinePolicyReport = async (
  currentHtml: string,
  policyData: PolicyData,
  updatePayload: PolicyUpdate,
  versionNumber: number
): Promise<{ html: string; changeLog: string }> => {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Sign in with Google to start your free AI analysis.');
  }

  const response = await fetch('/api/refine-policy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ currentHtml, policyData, updatePayload, versionNumber }),
  });

  return parseJsonResponse<{ html: string; changeLog: string }>(
    response,
    `Policy refinement failed (Status ${response.status})`
  );
};

export const analyzeZoning = async (
  mode: AnalysisMode,
  dataA: PlotData,
  dataB: PlotData | undefined,
  language: Language
): Promise<{ html: string; groundingMetadata: any }> => {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Sign in with Google to start your free AI analysis.');
  }

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
    headers,
    body: JSON.stringify({
      mode,
      dataA,
      dataB,
      language,
      libraryContext,
      learnedContext,
    }),
  });

  const result = await parseJsonResponse<{ html: string; groundingMetadata: any }>(
    response,
    `Zoning analysis failed (Status ${response.status})`
  );
  const html = result.html || "";

  // 4. Extract and persist learned self-knowledge in LocalStorage
  const jsonMatch = html.match(/<!-- LEARNING_BLOCK_START([\s\S]*?)LEARNING_BLOCK_END -->/);
  if (jsonMatch && jsonMatch[1]) {
    saveLearnedContext(dataA.city, dataA.country, jsonMatch[1]);
  }

  return result;
};

export const translateReport = async (htmlContent: string, targetLang: Language): Promise<string> => {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Sign in with Google to start your free AI analysis.');
  }

  const response = await fetch('/api/translate-report', {
    method: 'POST',
    headers,
    body: JSON.stringify({ htmlContent, targetLang }),
  });

  const data = await parseJsonResponse<{ translatedHtml: string }>(
    response,
    `Translation failed (Status ${response.status})`
  );
  return data.translatedHtml;
};

export const chatWithAssistant = async (
  history: any[], 
  lastMessage: string, 
  context: { plot?: PlotData, analysisResult?: string | null, language: Language, policyContext?: any }
): Promise<string> => {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Sign in with Google to use the AI Assistant.');
  }

  const response = await fetch('/api/chat-assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify({ history, lastMessage, context }),
  });

  const data = await parseJsonResponse<{ replyText: string }>(
    response,
    `Assistant error (Status ${response.status})`
  );
  return data.replyText;
};

// --- ADMIN API CLIENT ---

export const fetchAdminStats = async (): Promise<any> => {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/usage', { headers });
  return parseJsonResponse(res, 'Failed to fetch admin stats');
};

export const toggleAdminKillSwitch = async (disabled: boolean): Promise<any> => {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/admin/kill-switch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ disabled }),
  });
  return parseJsonResponse(res, 'Failed to update kill switch');
};
