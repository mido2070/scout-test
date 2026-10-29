import { refinePolicyReport } from '../services/geminiServer';
import { executeProtectedAiEndpoint, jsonResponse } from '../services/apiUtils';

export async function handleRefinePolicy(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  return executeProtectedAiEndpoint(req, env, 'refine-policy', async ({ user, env, request }) => {
    const body = (await request.json()) as any;
    const { currentHtml, policyData, updatePayload, versionNumber } = body || {};

    if (!currentHtml || !policyData || !updatePayload || !versionNumber) {
      const err: any = new Error(
        'Missing required fields: currentHtml, policyData, updatePayload, versionNumber'
      );
      err.status = 400;
      throw err;
    }

    return refinePolicyReport(
      currentHtml,
      policyData,
      updatePayload,
      versionNumber,
      { request, env, user }
    );
  });
}

export default handleRefinePolicy;
