const MAX_FAILURES = 5;
const WINDOW_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

type LoginAttemptRecord = {
  failures: number;
  firstFailureAt: number;
  cooldownUntil: number;
};

const loginAttempts = new Map<string, LoginAttemptRecord>();

// 定期清理已过期的限流记录，防止内存持续增长
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginAttempts.entries()) {
      const expired =
        record.cooldownUntil > 0
          ? record.cooldownUntil <= now
          : now - record.firstFailureAt > WINDOW_MS;
      if (expired) {
        loginAttempts.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export type LoginRateLimitState = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

function createLoginAttemptKey(ip: string, userAgent: string) {
  return `${ip}|${userAgent}`;
}

function getRetryAfterSeconds(until: number, now: number) {
  return Math.max(1, Math.ceil((until - now) / 1000));
}

export function getLoginRateLimitState(
  ip: string,
  userAgent: string,
  now = Date.now(),
): LoginRateLimitState {
  const key = createLoginAttemptKey(ip, userAgent);
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true };
  }

  if (record.cooldownUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: getRetryAfterSeconds(record.cooldownUntil, now),
    };
  }

  if (now - record.firstFailureAt > WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordLoginSuccess(ip: string, userAgent: string) {
  loginAttempts.delete(createLoginAttemptKey(ip, userAgent));
}

export function recordLoginFailure(ip: string, userAgent: string, now = Date.now()) {
  const key = createLoginAttemptKey(ip, userAgent);
  const current = loginAttempts.get(key);
  const withinWindow = current && now - current.firstFailureAt <= WINDOW_MS;
  const failures = withinWindow ? current.failures + 1 : 1;
  const firstFailureAt = withinWindow ? current.firstFailureAt : now;
  const cooldownUntil = failures >= MAX_FAILURES ? now + COOLDOWN_MS : 0;

  loginAttempts.set(key, {
    failures,
    firstFailureAt,
    cooldownUntil,
  });

  return {
    failures,
    cooldownUntil,
    retryAfterSeconds: cooldownUntil ? getRetryAfterSeconds(cooldownUntil, now) : undefined,
  };
}
