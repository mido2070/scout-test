import { chatWithAssistant } from '../services/geminiServer';
import { executeProtectedAiEndpoint, jsonResponse } from '../services/apiUtils';

export async function handleChatAssistant(req: Request, env?: any): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  return executeProtectedAiEndpoint(req, env, 'chat-assistant', async ({ user, env, request }) => {
    const body = (await request.json()) as any;
    const { history, lastMessage, context } = body || {};

    if (!lastMessage || !context) {
      const err: any = new Error('Missing required fields: lastMessage, context');
      err.status = 400;
      throw err;
    }

    const replyText = await chatWithAssistant(
      history ?? [],
      lastMessage,
      context,
      { request, env, user }
    );
    return { replyText };
  });
}

export default handleChatAssistant;
