import schedule from 'node-schedule';
import { getSyncConfig } from '@/lib/sync/config';
import { runSyncJob } from '@/lib/sync/orchestrator';
import { SyncConflictError } from '@/lib/sync/lock';

let syncJob: schedule.Job | null = null;

export function initScheduler() {
  const config = getSyncConfig();
  if (config.enabled && config.cron) {
    startSyncJob(config.cron);
  }
}

export function startSyncJob(cron: string) {
  if (syncJob) {
    syncJob.cancel();
  }

  console.log(`[Scheduler] Starting sync job with cron: ${cron}`);
  syncJob = schedule.scheduleJob(cron, async () => {
    const config = getSyncConfig();
    console.log('[Scheduler] Triggering scheduled sync...');

    try {
      await runSyncJob({
        kind: config.defaultJobKind,
        tables: config.defaultTables,
        triggeredBy: 'scheduler',
      });
    } catch (error) {
      if (error instanceof SyncConflictError) {
        console.warn(
          `[Scheduler] Sync skipped because job ${error.currentJobId ?? 'unknown'} is already running`,
        );
        return;
      }

      console.error('[Scheduler] Scheduled sync failed', error);
    }
  });
}

export function stopSyncJob() {
  if (syncJob) {
    syncJob.cancel();
    syncJob = null;
    console.log('[Scheduler] Sync job stopped');
  }
}

export function getNextRunAt(): string | null {
  if (!syncJob) return null;
  const next = syncJob.nextInvocation();
  return next ? next.toISOString() : null;
}

export async function runSyncTask() {
  const config = getSyncConfig();
  return runSyncJob({
    kind: config.defaultJobKind,
    tables: config.defaultTables,
    triggeredBy: 'scheduler',
  });
}
