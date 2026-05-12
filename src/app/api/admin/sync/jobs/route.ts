import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin/auth';
import {
  createSyncJob,
  getSyncJobs,
  SyncValidationError,
} from '@/lib/sync/orchestrator';
import { SyncConflictError } from '@/lib/sync/lock';
import type { SyncRunRequest } from '@/lib/sync/types';

export async function GET(request: NextRequest) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') || 20);
  const clampedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  return NextResponse.json({
    items: getSyncJobs(clampedLimit),
  });
}

export async function POST(request: Request) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SyncRunRequest;
    const job = await createSyncJob(body, { executeInBackground: true });

    return NextResponse.json(
      {
        jobId: job.jobId,
        status: job.status,
        kind: job.kind,
        tables: job.tables,
        effectiveTables: job.effectiveTables,
        createdAt: job.createdAt,
      },
      { status: 202 },
    );
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

    if (error instanceof SyncValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
