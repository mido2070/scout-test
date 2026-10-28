import { refinePolicyReport } from '../services/geminiServer';
import { errorResponse, jsonResponse } from '../services/apiUtils';

export async function handleRefinePolicy(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json() as any;
    const { currentHtml, policyData, updatePayload, versionNumber } = body || {};

    if (!currentHtml || !policyData || !updatePayload || !versionNumber) {
      return jsonResponse(
        {
          message:
            'Missing required fields: currentHtml, policyData, updatePayload, versionNumber',
        },
        400
      );
    }

    const result = await refinePolicyReport(
      currentHtml,
      policyData,
      updatePayload,
      versionNumber,
      { request: req, env }
    );
    return jsonResponse(result);
  } catch (error: any) {
    console.error('[API refine-policy] Error:', error?.message || error);
    return errorResponse(error);
  }
}

export default handleRefinePolicy;
