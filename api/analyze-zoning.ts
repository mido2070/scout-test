import { analyzeZoning } from '../services/geminiServer';
import { errorResponse, jsonResponse } from '../services/apiUtils';

export async function handleAnalyzeZoning(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json() as any;
    const { mode, dataA, dataB, language, libraryContext, learnedContext } = body || {};

    if (!mode || !dataA || !language) {
      return jsonResponse(
        { message: 'Missing required fields: mode, dataA, language' },
        400
      );
    }

    const result = await analyzeZoning(
      mode,
      dataA,
      dataB,
      language,
      libraryContext ?? '',
      learnedContext ?? null,
      { request: req, env }
    );
    return jsonResponse(result);
  } catch (error: any) {
    console.error('[API analyze-zoning] Error:', error?.message || error);
    return errorResponse(error);
  }
}

export default handleAnalyzeZoning;
