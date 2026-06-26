import { analyzeZoning } from '../services/geminiServer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { mode, dataA, dataB, language, libraryContext, learnedContext } = req.body;
    const result = await analyzeZoning(mode, dataA, dataB, language, libraryContext, learnedContext);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[API analyze-zoning] Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}
