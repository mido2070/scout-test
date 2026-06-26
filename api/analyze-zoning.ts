import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeZoning } from '../services/geminiServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { mode, dataA, dataB, language, libraryContext, learnedContext } = req.body;

    if (!mode || !dataA || !language) {
      return res.status(400).json({ message: 'Missing required fields: mode, dataA, language' });
    }

    const result = await analyzeZoning(mode, dataA, dataB, language, libraryContext ?? '', learnedContext ?? null);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API analyze-zoning] Error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
}
