import { analyzePolicy } from '../services/geminiServer';
import { errorResponse, jsonResponse } from '../services/apiUtils';

export async function handleAnalyzePolicy(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json() as any;
    const { policyData, libraryDocs, uiLanguage } = body || {};

    if (!policyData || !uiLanguage) {
      return jsonResponse(
        { message: 'Missing required fields: policyData, uiLanguage' },
        400
      );
    }

    const reportHtml = await analyzePolicy(policyData, libraryDocs ?? [], uiLanguage, {
      request: req,
      env,
    });
    return jsonResponse({ reportHtml });
  } catch (error: any) {
    console.error('[API analyze-policy] Error:', error?.message || error);
    return errorResponse(error);
  }
}

export default handleAnalyzePolicy;
