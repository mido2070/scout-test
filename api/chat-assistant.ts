import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatWithAssistant } from '../services/geminiServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { history, lastMessage, context } = req.body;

    if (!lastMessage || !context) {
      return res.status(400).json({ message: 'Missing required fields: lastMessage, context' });
    }

    const replyText = await chatWithAssistant(history ?? [], lastMessage, context);
    return res.status(200).json({ replyText });
  } catch (error: any) {
    console.error('[API chat-assistant] Error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
}
