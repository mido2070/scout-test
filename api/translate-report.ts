import { translateReport } from '../services/geminiServer';
import { errorResponse, jsonResponse } from '../services/apiUtils';

export async function handleTranslateReport(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json() as any;
    const { htmlContent, targetLang } = body || {};

    if (!htmlContent || !targetLang) {
      return jsonResponse(
        { message: 'Missing required fields: htmlContent, targetLang' },
        400
      );
    }

    const translatedHtml = await translateReport(htmlContent, targetLang, {
      request: req,
      env,
    });
    return jsonResponse({ translatedHtml });
  } catch (error: any) {
    console.error('[API translate-report] Error:', error?.message || error);
    return errorResponse(error);
  }
}

export default handleTranslateReport;
