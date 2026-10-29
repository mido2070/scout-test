import { translateReport } from '../services/geminiServer';
import { executeProtectedAiEndpoint, jsonResponse } from '../services/apiUtils';

export async function handleTranslateReport(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  return executeProtectedAiEndpoint(req, env, 'translate-report', async ({ user, env, request }) => {
    const body = (await request.json()) as any;
    const { htmlContent, targetLang } = body || {};

    if (!htmlContent || !targetLang) {
      const err: any = new Error('Missing required fields: htmlContent, targetLang');
      err.status = 400;
      throw err;
    }

    const translatedHtml = await translateReport(htmlContent, targetLang, {
      request,
      env,
      user,
    });
    return { translatedHtml };
  });
}

export default handleTranslateReport;
