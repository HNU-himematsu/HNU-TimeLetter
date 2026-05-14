import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin/auth';
import { startSyncJob, stopSyncJob, getNextRunAt } from '@/lib/admin/scheduler';
import { getSyncConfig, updateSyncConfig } from '@/lib/sync/config';
import { getRuntimeSummary } from '@/lib/sync/job-store';
import {
  getSyncTableDefinitions,
  SyncValidationError,
} from '@/lib/sync';

export async function GET() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    config: getSyncConfig(),
    runtime: getRuntimeSummary(),
    availableTables: getSyncTableDefinitions(),
    nextRunAt: getNextRunAt(),
  });
}

export async function PATCH(request: Request) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<ReturnType<typeof getSyncConfig>> & Record<string, unknown>;
    const nextConfig = updateSyncConfig({
      enabled: body.enabled,
      cron: body.cron,
      defaultTables: body.defaultTables,
    });

    if (nextConfig.enabled) {
      startSyncJob(nextConfig.cron);
    } else {
      stopSyncJob();
    }

    return NextResponse.json({
      config: nextConfig,
      runtime: getRuntimeSummary(),
      availableTables: getSyncTableDefinitions(),
      nextRunAt: getNextRunAt(),
    });
  } catch (error) {
    if (error instanceof SyncValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
