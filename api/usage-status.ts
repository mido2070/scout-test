import { authenticateRequest } from '../services/firebaseAuthServer';
import { jsonResponse } from '../services/apiUtils';

export async function handleUsageStatus(req: Request, env?: any): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  let userId = 'anonymous';
  try {
    const user = await authenticateRequest(req, env);
    userId = user.uid;
  } catch {
    // Unauthenticated visitor
    return jsonResponse({
      allowed: true,
      status: 200,
      userRemaining: 3,
      globalRemaining: 30,
      dateUtc: today,
    });
  }

  if (env?.USAGE_LIMITER) {
    try {
      const id = env.USAGE_LIMITER.idFromName('global-coordinator');
      const limiter = env.USAGE_LIMITER.get(id);
      const status = await limiter.getUserQuotaStatus(userId);
      return jsonResponse(status);
    } catch (e) {
      console.warn('[UsageStatus] Error reading limiter status:', e);
    }
  }

  return jsonResponse({
    allowed: true,
    status: 200,
    userRemaining: 3,
    globalRemaining: 30,
    dateUtc: today,
  });
}

export default handleUsageStatus;
