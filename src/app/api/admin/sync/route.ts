/**
 * @deprecated 该路由为兼容旧版调用保留，不推荐使用。
 * 请使用以下新接口：
 *   - 触发同步任务：POST /api/admin/sync/jobs
 *   - 读取/修改调度配置：GET/PATCH /api/admin/sync/config
 * 旧版 action=trigger / action=update 的请求形态仍可用，但不再迭代新功能。
 */
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin/auth';
import { startSyncJob, stopSyncJob } from '@/lib/admin/scheduler';
import { getSyncConfig, updateSyncConfig } from '@/lib/sync/config';
import { getJob, getRuntimeSummary } from '@/lib/sync/job-store';
import {
  createSyncJob,
  getSyncJobs,
  SyncValidationError,
} from '@/lib/sync/orchestrator';
import { SyncConflictError } from '@/lib/sync/lock';
import type { SyncRunRequest } from '@/lib/sync/types';

function toLegacyResponse() {
  const config = getSyncConfig();
  const runtime = getRuntimeSummary();
  const currentJob = runtime.currentJobId ? getJob(runtime.currentJobId) : null;
  const lastJob = runtime.lastJobId ? getJob(runtime.lastJobId) : getSyncJobs(1)[0] ?? null;

  const status = currentJob
    ? 'running'
    : lastJob
      ? lastJob.status === 'success' || lastJob.status === 'partial_success'
        ? 'success'
        : 'failed'
      : 'idle';

  const lastMessage = currentJob
    ? '同步任务正在执行中'
    : lastJob?.errors[0] ??
      (lastJob?.publishStatus === 'pending'
        ? '数据已同步，尚未发布'
        : undefined);

  return {
    sync: {
      enabled: config.enabled,
      cron: config.cron,
      lastRun: runtime.lastRunAt,
      status,
      lastMessage,
    },
  };
}

export async function GET() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(toLegacyResponse());
}

export async function POST(request: Request) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, cron, enabled, tables } = body as {
      action?: string;
      cron?: string;
      enabled?: boolean;
      tables?: string[];
    };

    if (action === 'trigger') {
      try {
        const job = await createSyncJob(
          {
            kind: 'sync-data',
            tables: tables as SyncRunRequest['tables'],
            triggeredBy: 'admin-ui',
          },
          { executeInBackground: true },
        );

        return NextResponse.json({ message: 'Sync triggered', jobId: job.jobId });
      } catch (error) {
        if (error instanceof SyncConflictError) {
          return NextResponse.json(
            {
              message: error.message,
              currentJobId: error.currentJobId,
            },
            { status: 409 },
          );
        }

        throw error;
      }
    }

    if (action === 'update') {
      const nextConfig = updateSyncConfig({
        enabled: enabled ?? getSyncConfig().enabled,
        cron: cron || getSyncConfig().cron,
      });

      if (nextConfig.enabled) {
        startSyncJob(nextConfig.cron);
      } else {
        stopSyncJob();
      }

      return NextResponse.json(toLegacyResponse());
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof SyncValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
