import { NextResponse } from 'next/server';
import { login, logout } from '@/lib/admin/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import {
  getLoginRateLimitState,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/admin/rate-limit';

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function getClientUserAgent(request: Request) {
  return request.headers.get('user-agent') || 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = getClientUserAgent(request);

  try {
    const rateLimitState = getLoginRateLimitState(ip, userAgent);
    if (!rateLimitState.allowed) {
      writeAdminAuditLog({
        event: 'login_rate_limited',
        ip,
        userAgent,
        reason: 'cooldown',
      });

      return NextResponse.json(
        { success: false, message: 'Too many failed attempts' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitState.retryAfterSeconds),
          },
        },
      );
    }

    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    const success = await login(password);

    if (success) {
      recordLoginSuccess(ip, userAgent);
      writeAdminAuditLog({ event: 'login_success', ip, userAgent });
      return NextResponse.json({ success: true });
    } else {
      const failure = recordLoginFailure(ip, userAgent);
      writeAdminAuditLog({
        event: 'login_failed',
        ip,
        userAgent,
        reason: `failures=${failure.failures}`,
      });

      return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
    }
  } catch {
    writeAdminAuditLog({
      event: 'login_failed',
      ip,
      userAgent,
      reason: 'server_error',
    });

    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  await logout();
  writeAdminAuditLog({
    event: 'logout',
    ip: getClientIp(request),
    userAgent: getClientUserAgent(request),
  });
  return NextResponse.json({ success: true });
}
