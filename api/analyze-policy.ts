import { analyzePolicy } from '../services/geminiServer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { policyData, libraryDocs, uiLanguage } = req.body;
    const reportHtml = await analyzePolicy(policyData, libraryDocs, uiLanguage);
    return res.status(200).json({ reportHtml });
  } catch (error: any) {
    console.error('[API analyze-policy] Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}
