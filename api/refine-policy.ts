import type { VercelRequest, VercelResponse } from '@vercel/node';
import { refinePolicyReport } from '../services/geminiServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { currentHtml, policyData, updatePayload, versionNumber } = req.body;

    if (!currentHtml || !policyData || !updatePayload || !versionNumber) {
      return res.status(400).json({ message: 'Missing required fields: currentHtml, policyData, updatePayload, versionNumber' });
    }

    const result = await refinePolicyReport(currentHtml, policyData, updatePayload, versionNumber);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API refine-policy] Error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
}
