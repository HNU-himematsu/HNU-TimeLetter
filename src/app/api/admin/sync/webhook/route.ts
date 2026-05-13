/**
 * POST /api/admin/sync/webhook
 *
 * 飞书自动化专用同步接口，无需 Cookie，使用 Bearer Token 鉴权。
 *
 * 鉴权方式（任选其一）：
 *   1. 请求头 Authorization: Bearer <SYNC_WEBHOOK_SECRET>
 *   2. 查询参数 ?secret=<SYNC_WEBHOOK_SECRET>（用于不支持自定义 Header 的情况）
 *
 * 环境变量：
 *   SYNC_WEBHOOK_SECRET — Webhook 专用密钥（推荐单独设置）
 *                         未设置时回退使用 ADMIN_PASSWORD
 *
 * 响应：
 *   202  同步任务已创建（后台异步执行）
 *   401  密钥错误或未提供
 *   409  已有同步任务运行中
 *   429  请求过于频繁
 *   500  服务器内部错误
 */

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSyncJob, SyncValidationError } from '@/lib/sync/orchestrator';
import { SyncConflictError } from '@/lib/sync/lock';

// ─── 鉴权 ────────────────────────────────────────────────────────────────────

function getWebhookSecret(): string {
  return process.env.SYNC_WEBHOOK_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
}

/**
 * 常数时间字符串比较，防止时序攻击。
 * 注意：长度不同时直接返回 false（长度本身不属于需要保护的信息）。
 */
function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function checkWebhookAuth(request: NextRequest): boolean {
  const secret = getWebhookSecret();
  if (!secret) return false;

  // 优先：Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return timingSafeCompare(authHeader.slice(7), secret);
  }

  // 备用：?secret=<token>（适配不支持自定义 Header 的 Webhook 服务）
  const querySecret = request.nextUrl.searchParams.get('secret') ?? '';
  if (querySecret) {
    return timingSafeCompare(querySecret, secret);
  }

  return false;
}

// ─── 限流 ─────────────────────────────────────────────────────────────────────
// 每个 IP 每小时最多 60 次请求（飞书自动化最多触发 20 次/天，60 次已足够宽松）

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 60) return false;
  entry.count += 1;
  return true;
}

// ─── 处理器 ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { message: '请求过于频繁，请稍后重试' },
      { status: 429 },
    );
  }

  if (!checkWebhookAuth(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const job = await createSyncJob(
      {
        tables: ['creation_board'],
        kind: 'sync-data',
        dependencyMode: 'run_dependencies',
        includeAssets: true,
        continueOnTableError: false,
        triggeredBy: 'webhook',
        note: '飞书自动化 Webhook 触发',
      },
      { executeInBackground: true },
    );

    return NextResponse.json(
      {
        jobId: job.jobId,
        status: job.status,
        message: '同步任务已创建',
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof SyncConflictError) {
      return NextResponse.json(
        {
          message: '已有同步任务运行中，请等待完成后重试',
          currentJobId: error.currentJobId,
        },
        { status: 409 },
      );
    }

    if (error instanceof SyncValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error('[Webhook] 创建同步任务失败:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
