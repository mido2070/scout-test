import { DurableObject } from 'cloudflare:workers';

export interface QuotaCheckResult {
  allowed: boolean;
  status: number;
  reason?: string;
  userRemaining?: number;
  globalRemaining?: number;
  retryAfterSeconds?: number;
  dateUtc?: string;
}

export interface AdminUsageStats {
  dateUtc: string;
  totalCallsToday: number;
  successfulCallsToday: number;
  failedCallsToday: number;
  rateLimitedCallsToday: number;
  globalQuotaRemaining: number;
  globalQuotaLimit: number;
  activeUsersToday: number;
  aiDisabled: boolean;
  featureBreakdown: Record<string, number>;
}

export class UsageLimiter extends DurableObject {
  private hasSql = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.initStorage();
  }

  private initStorage() {
    try {
      if ((this.ctx.storage as any)?.sql) {
        this.hasSql = true;
        (this.ctx.storage as any).sql.exec(`
          CREATE TABLE IF NOT EXISTS global_daily_usage (
            date_utc TEXT PRIMARY KEY,
            total_calls INTEGER NOT NULL DEFAULT 0,
            successful_calls INTEGER NOT NULL DEFAULT 0,
            failed_calls INTEGER NOT NULL DEFAULT 0,
            rate_limited_calls INTEGER NOT NULL DEFAULT 0,
            ai_disabled INTEGER NOT NULL DEFAULT 0
          );

          CREATE TABLE IF NOT EXISTS user_daily_usage (
            user_id TEXT NOT NULL,
            date_utc TEXT NOT NULL,
            request_count INTEGER NOT NULL DEFAULT 0,
            last_request_time INTEGER NOT NULL DEFAULT 0,
            in_progress INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, date_utc)
          );

          CREATE TABLE IF NOT EXISTS feature_usage (
            date_utc TEXT NOT NULL,
            feature_name TEXT NOT NULL,
            calls INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (date_utc, feature_name)
          );

          CREATE TABLE IF NOT EXISTS idempotency_keys (
            idempotency_key TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            user_id TEXT NOT NULL
          );
        `);
      }
    } catch (e) {
      console.warn('[UsageLimiter] SQLite init failed, falling back to KV storage:', e);
      this.hasSql = false;
    }
  }

  private getTodayUtc(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getSecondsUntilMidnightUtc(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
  }

  /**
   * Atomic quota reservation check
   */
  async checkAndReserve(
    userId: string,
    featureName: string,
    requestId?: string
  ): Promise<QuotaCheckResult> {
    const today = this.getTodayUtc();
    const now = Date.now();
    const retryAfterMidnight = this.getSecondsUntilMidnightUtc();

    if (this.hasSql) {
      const sql = (this.ctx.storage as any).sql;

      // 1. Check Global Emergency Kill Switch & Global Daily Cap (30 requests/day)
      const globalRow = sql
        .exec('SELECT total_calls, ai_disabled FROM global_daily_usage WHERE date_utc = ?', today)
        .one() as { total_calls: number; ai_disabled: number } | null;

      if (globalRow && globalRow.ai_disabled === 1) {
        return {
          allowed: false,
          status: 503,
          reason: 'AI analysis is temporarily paused by the administrator.',
          dateUtc: today,
        };
      }

      const totalCalls = globalRow?.total_calls || 0;
      const GLOBAL_LIMIT = 30;

      if (totalCalls >= GLOBAL_LIMIT) {
        sql.exec(
          `INSERT INTO global_daily_usage (date_utc, total_calls, rate_limited_calls)
           VALUES (?, 0, 1)
           ON CONFLICT(date_utc) DO UPDATE SET rate_limited_calls = rate_limited_calls + 1`,
          today
        );
        return {
          allowed: false,
          status: 429,
          reason:
            "CodeScout's free AI capacity has been reached for today. AI analysis will resume tomorrow at 00:00 UTC.",
          retryAfterSeconds: retryAfterMidnight,
          globalRemaining: 0,
          dateUtc: today,
        };
      }

      // 2. Check Idempotency Key (duplicate protection)
      if (requestId) {
        const existingKey = sql
          .exec(
            'SELECT created_at FROM idempotency_keys WHERE idempotency_key = ? AND user_id = ?',
            requestId,
            userId
          )
          .one();
        if (existingKey) {
          return {
            allowed: false,
            status: 429,
            reason: 'Duplicate request detected. Please wait for current analysis to complete.',
            retryAfterSeconds: 10,
            dateUtc: today,
          };
        }
      }

      // 3. Check User Quota & Concurrency
      const userRow = sql
        .exec(
          'SELECT request_count, last_request_time, in_progress FROM user_daily_usage WHERE user_id = ? AND date_utc = ?',
          userId,
          today
        )
        .one() as { request_count: number; last_request_time: number; in_progress: number } | null;

      const userRequests = userRow?.request_count || 0;
      const lastTime = userRow?.last_request_time || 0;
      const inProgress = userRow?.in_progress || 0;
      const USER_LIMIT = 3;

      // In-progress lock (times out after 90s)
      if (inProgress === 1 && now - lastTime < 90_000) {
        return {
          allowed: false,
          status: 429,
          reason: 'You already have an AI analysis in progress. Please wait for it to finish.',
          retryAfterSeconds: 15,
          userRemaining: Math.max(0, USER_LIMIT - userRequests),
          dateUtc: today,
        };
      }

      // Rate-limit: 1 analysis per minute (except conversational chat assistant)
      if (featureName !== 'chat-assistant' && lastTime > 0 && now - lastTime < 60_000) {
        const waitSec = Math.ceil((60_000 - (now - lastTime)) / 1000);
        return {
          allowed: false,
          status: 429,
          reason: `Please wait ${waitSec} seconds before starting another analysis.`,
          retryAfterSeconds: waitSec,
          userRemaining: Math.max(0, USER_LIMIT - userRequests),
          dateUtc: today,
        };
      }

      // Daily limit: 3 analyses per user per UTC day
      if (userRequests >= USER_LIMIT) {
        sql.exec(
          `INSERT INTO global_daily_usage (date_utc, total_calls, rate_limited_calls)
           VALUES (?, 0, 1)
           ON CONFLICT(date_utc) DO UPDATE SET rate_limited_calls = rate_limited_calls + 1`,
          today
        );
        return {
          allowed: false,
          status: 429,
          reason: 'You have reached your daily free analysis limit. Please return tomorrow.',
          retryAfterSeconds: retryAfterMidnight,
          userRemaining: 0,
          dateUtc: today,
        };
      }

      // 4. ATOMIC RESERVATION
      sql.exec(
        `INSERT INTO global_daily_usage (date_utc, total_calls)
         VALUES (?, 1)
         ON CONFLICT(date_utc) DO UPDATE SET total_calls = total_calls + 1`,
        today
      );

      sql.exec(
        `INSERT INTO user_daily_usage (user_id, date_utc, request_count, last_request_time, in_progress)
         VALUES (?, ?, 1, ?, 1)
         ON CONFLICT(user_id, date_utc) DO UPDATE SET
           request_count = request_count + 1,
           last_request_time = ?,
           in_progress = 1`,
        userId,
        today,
        now,
        now
      );

      if (requestId) {
        sql.exec(
          'INSERT OR REPLACE INTO idempotency_keys (idempotency_key, created_at, user_id) VALUES (?, ?, ?)',
          requestId,
          now,
          userId
        );
      }

      const updatedUserRemaining = Math.max(0, USER_LIMIT - (userRequests + 1));
      const updatedGlobalRemaining = Math.max(0, GLOBAL_LIMIT - (totalCalls + 1));

      return {
        allowed: true,
        status: 200,
        userRemaining: updatedUserRemaining,
        globalRemaining: updatedGlobalRemaining,
        dateUtc: today,
      };
    } else {
      // Fallback in-memory KV storage
      const globalKey = `global:${today}`;
      const userKey = `user:${userId}:${today}`;
      const killKey = 'global:ai_disabled';

      const isAiDisabled = (await this.ctx.storage.get<boolean>(killKey)) || false;
      if (isAiDisabled) {
        return {
          allowed: false,
          status: 503,
          reason: 'AI analysis is temporarily paused by the administrator.',
          dateUtc: today,
        };
      }

      const totalCalls = (await this.ctx.storage.get<number>(globalKey)) || 0;
      if (totalCalls >= 30) {
        return {
          allowed: false,
          status: 429,
          reason:
            "CodeScout's free AI capacity has been reached for today. AI analysis will resume tomorrow at 00:00 UTC.",
          retryAfterSeconds: retryAfterMidnight,
          globalRemaining: 0,
          dateUtc: today,
        };
      }

      const userData = (await this.ctx.storage.get<{ count: number; lastTime: number; inProgress: boolean }>(userKey)) || {
        count: 0,
        lastTime: 0,
        inProgress: false,
      };

      if (userData.inProgress && now - userData.lastTime < 90_000) {
        return {
          allowed: false,
          status: 429,
          reason: 'You already have an AI analysis in progress. Please wait for it to finish.',
          retryAfterSeconds: 15,
          userRemaining: Math.max(0, 3 - userData.count),
          dateUtc: today,
        };
      }

      if (featureName !== 'chat-assistant' && userData.lastTime > 0 && now - userData.lastTime < 60_000) {
        const waitSec = Math.ceil((60_000 - (now - userData.lastTime)) / 1000);
        return {
          allowed: false,
          status: 429,
          reason: `Please wait ${waitSec} seconds before starting another analysis.`,
          retryAfterSeconds: waitSec,
          userRemaining: Math.max(0, 3 - userData.count),
          dateUtc: today,
        };
      }

      if (userData.count >= 3) {
        return {
          allowed: false,
          status: 429,
          reason: 'You have reached your daily free analysis limit. Please return tomorrow.',
          retryAfterSeconds: retryAfterMidnight,
          userRemaining: 0,
          dateUtc: today,
        };
      }

      // Reserve
      await this.ctx.storage.put(globalKey, totalCalls + 1);
      await this.ctx.storage.put(userKey, {
        count: userData.count + 1,
        lastTime: now,
        inProgress: true,
      });

      return {
        allowed: true,
        status: 200,
        userRemaining: Math.max(0, 3 - (userData.count + 1)),
        globalRemaining: Math.max(0, 30 - (totalCalls + 1)),
        dateUtc: today,
      };
    }
  }

  /**
   * Release in-progress lock and record outcome
   */
  async completeRequest(userId: string, featureName: string, success: boolean): Promise<void> {
    const today = this.getTodayUtc();

    if (this.hasSql) {
      const sql = (this.ctx.storage as any).sql;
      sql.exec(
        'UPDATE user_daily_usage SET in_progress = 0 WHERE user_id = ? AND date_utc = ?',
        userId,
        today
      );

      if (success) {
        sql.exec(
          `INSERT INTO global_daily_usage (date_utc, total_calls, successful_calls)
           VALUES (?, 0, 1)
           ON CONFLICT(date_utc) DO UPDATE SET successful_calls = successful_calls + 1`,
          today
        );
        sql.exec(
          `INSERT INTO feature_usage (date_utc, feature_name, calls)
           VALUES (?, ?, 1)
           ON CONFLICT(date_utc, feature_name) DO UPDATE SET calls = calls + 1`,
          today,
          featureName
        );
      } else {
        sql.exec(
          `INSERT INTO global_daily_usage (date_utc, total_calls, failed_calls)
           VALUES (?, 0, 1)
           ON CONFLICT(date_utc) DO UPDATE SET failed_calls = failed_calls + 1`,
          today
        );
      }
    } else {
      const userKey = `user:${userId}:${today}`;
      const userData = await this.ctx.storage.get<{ count: number; lastTime: number; inProgress: boolean }>(userKey);
      if (userData) {
        await this.ctx.storage.put(userKey, { ...userData, inProgress: false });
      }
    }
  }

  /**
   * Get quota status for a user
   */
  async getUserQuotaStatus(userId: string): Promise<QuotaCheckResult> {
    const today = this.getTodayUtc();

    if (this.hasSql) {
      const sql = (this.ctx.storage as any).sql;

      const globalRow = sql
        .exec('SELECT total_calls, ai_disabled FROM global_daily_usage WHERE date_utc = ?', today)
        .one() as { total_calls: number; ai_disabled: number } | null;

      const userRow = sql
        .exec(
          'SELECT request_count FROM user_daily_usage WHERE user_id = ? AND date_utc = ?',
          userId,
          today
        )
        .one() as { request_count: number } | null;

      const isAiDisabled = Boolean(globalRow?.ai_disabled);
      const totalCalls = globalRow?.total_calls || 0;
      const userRequests = userRow?.request_count || 0;

      return {
        allowed: !isAiDisabled && totalCalls < 30 && userRequests < 3,
        status: isAiDisabled ? 503 : totalCalls >= 30 || userRequests >= 3 ? 429 : 200,
        userRemaining: Math.max(0, 3 - userRequests),
        globalRemaining: Math.max(0, 30 - totalCalls),
        dateUtc: today,
      };
    } else {
      const globalKey = `global:${today}`;
      const userKey = `user:${userId}:${today}`;
      const killKey = 'global:ai_disabled';

      const isAiDisabled = (await this.ctx.storage.get<boolean>(killKey)) || false;
      const totalCalls = (await this.ctx.storage.get<number>(globalKey)) || 0;
      const userData = (await this.ctx.storage.get<{ count: number }>(userKey)) || { count: 0 };

      return {
        allowed: !isAiDisabled && totalCalls < 30 && userData.count < 3,
        status: isAiDisabled ? 503 : totalCalls >= 30 || userData.count >= 3 ? 429 : 200,
        userRemaining: Math.max(0, 3 - userData.count),
        globalRemaining: Math.max(0, 30 - totalCalls),
        dateUtc: today,
      };
    }
  }

  /**
   * Get administrative statistics
   */
  async getAdminStats(): Promise<AdminUsageStats> {
    const today = this.getTodayUtc();

    if (this.hasSql) {
      const sql = (this.ctx.storage as any).sql;

      const globalRow = sql
        .exec(
          'SELECT total_calls, successful_calls, failed_calls, rate_limited_calls, ai_disabled FROM global_daily_usage WHERE date_utc = ?',
          today
        )
        .one() as any;

      const activeUsersCount = sql
        .exec('SELECT COUNT(DISTINCT user_id) as count FROM user_daily_usage WHERE date_utc = ?', today)
        .one() as { count: number } | null;

      const features = sql
        .exec('SELECT feature_name, calls FROM feature_usage WHERE date_utc = ?', today)
        .toArray() as Array<{ feature_name: string; calls: number }>;

      const breakdown: Record<string, number> = {};
      for (const f of features) {
        breakdown[f.feature_name] = f.calls;
      }

      const totalToday = globalRow?.total_calls || 0;

      return {
        dateUtc: today,
        totalCallsToday: totalToday,
        successfulCallsToday: globalRow?.successful_calls || 0,
        failedCallsToday: globalRow?.failed_calls || 0,
        rateLimitedCallsToday: globalRow?.rate_limited_calls || 0,
        globalQuotaRemaining: Math.max(0, 30 - totalToday),
        globalQuotaLimit: 30,
        activeUsersToday: activeUsersCount?.count || 0,
        aiDisabled: Boolean(globalRow?.ai_disabled),
        featureBreakdown: breakdown,
      };
    } else {
      const globalKey = `global:${today}`;
      const killKey = 'global:ai_disabled';
      const totalCalls = (await this.ctx.storage.get<number>(globalKey)) || 0;
      const isAiDisabled = (await this.ctx.storage.get<boolean>(killKey)) || false;

      return {
        dateUtc: today,
        totalCallsToday: totalCalls,
        successfulCallsToday: totalCalls,
        failedCallsToday: 0,
        rateLimitedCallsToday: 0,
        globalQuotaRemaining: Math.max(0, 30 - totalCalls),
        globalQuotaLimit: 30,
        activeUsersToday: 1,
        aiDisabled: isAiDisabled,
        featureBreakdown: { 'all-features': totalCalls },
      };
    }
  }

  /**
   * Toggle global emergency killswitch
   */
  async setKillSwitch(disabled: boolean): Promise<boolean> {
    const today = this.getTodayUtc();

    if (this.hasSql) {
      const sql = (this.ctx.storage as any).sql;
      sql.exec(
        `INSERT INTO global_daily_usage (date_utc, total_calls, ai_disabled)
         VALUES (?, 0, ?)
         ON CONFLICT(date_utc) DO UPDATE SET ai_disabled = ?`,
        today,
        disabled ? 1 : 0,
        disabled ? 1 : 0
      );
    } else {
      await this.ctx.storage.put('global:ai_disabled', disabled);
    }

    return disabled;
  }
}
