import type { VercelRequest, VercelResponse } from '@vercel/node';
import { translateReport } from '../services/geminiServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { htmlContent, targetLang } = req.body;

    if (!htmlContent || !targetLang) {
      return res.status(400).json({ message: 'Missing required fields: htmlContent, targetLang' });
    }

    const translatedHtml = await translateReport(htmlContent, targetLang);
    return res.status(200).json({ translatedHtml });
  } catch (error: any) {
    console.error('[API translate-report] Error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
}
