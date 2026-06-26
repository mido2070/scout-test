import { translateReport } from '../services/geminiServer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { htmlContent, targetLang } = req.body;
    const translatedHtml = await translateReport(htmlContent, targetLang);
    return res.status(200).json({ translatedHtml });
  } catch (error: any) {
    console.error('[API translate-report] Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}
