import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzePolicy } from '../services/geminiServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { policyData, libraryDocs, uiLanguage } = req.body;

    if (!policyData || !uiLanguage) {
      return res.status(400).json({ message: 'Missing required fields: policyData, uiLanguage' });
    }

    const reportHtml = await analyzePolicy(policyData, libraryDocs ?? [], uiLanguage);
    return res.status(200).json({ reportHtml });
  } catch (error: any) {
    console.error('[API analyze-policy] Error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
}
