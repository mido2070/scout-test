import { analyzePolicy } from '../services/geminiServer';
import { executeProtectedAiEndpoint, jsonResponse } from '../services/apiUtils';

export async function handleAnalyzePolicy(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  return executeProtectedAiEndpoint(req, env, 'analyze-policy', async ({ user, env, request }) => {
    const body = (await request.json()) as any;
    const { policyData, libraryDocs, uiLanguage } = body || {};

    if (!policyData || !uiLanguage) {
      const err: any = new Error('Missing required fields: policyData, uiLanguage');
      err.status = 400;
      throw err;
    }

    const reportHtml = await analyzePolicy(policyData, libraryDocs ?? [], uiLanguage, {
      request,
      env,
      user,
    });
    return { reportHtml };
  });
}

export default handleAnalyzePolicy;
