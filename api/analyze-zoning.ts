import { analyzeZoning } from '../services/geminiServer';
import { executeProtectedAiEndpoint, jsonResponse } from '../services/apiUtils';

export async function handleAnalyzeZoning(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  return executeProtectedAiEndpoint(req, env, 'analyze-zoning', async ({ user, env, request }) => {
    const body = (await request.json()) as any;
    const { mode, dataA, dataB, language, libraryContext, learnedContext } = body || {};

    if (!mode || !dataA || !language) {
      const err: any = new Error('Missing required fields: mode, dataA, language');
      err.status = 400;
      throw err;
    }

    return analyzeZoning(
      mode,
      dataA,
      dataB,
      language,
      libraryContext ?? '',
      learnedContext ?? null,
      { request, env, user }
    );
  });
}

export default handleAnalyzeZoning;
