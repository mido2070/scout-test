import { chatWithAssistant } from '../services/geminiServer';
import { errorResponse, jsonResponse } from '../services/apiUtils';

export async function handleChatAssistant(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json() as any;
    const { history, lastMessage, context } = body || {};

    if (!lastMessage || !context) {
      return jsonResponse(
        { message: 'Missing required fields: lastMessage, context' },
        400
      );
    }

    const replyText = await chatWithAssistant(
      history ?? [],
      lastMessage,
      context,
      { request: req, env }
    );
    return jsonResponse({ replyText });
  } catch (error: any) {
    console.error('[API chat-assistant] Error:', error?.message || error);
    return errorResponse(error);
  }
}

export default handleChatAssistant;
