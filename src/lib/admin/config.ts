import { getJob, getRuntimeSummary } from '@/lib/sync/job-store';
import { getSyncConfig, updateSyncConfig } from '@/lib/sync/config';

export interface AdminConfig {
  sync: {
    enabled: boolean;
    cron: string;
    lastRun?: string;
    status: 'idle' | 'running' | 'success' | 'failed';
    lastMessage?: string;
  };
}

export function getAdminConfig(): AdminConfig {
  const config = getSyncConfig();
  const runtime = getRuntimeSummary();
  const currentJob = runtime.currentJobId ? getJob(runtime.currentJobId) : null;
  const lastJob = runtime.lastJobId ? getJob(runtime.lastJobId) : null;

  return {
    sync: {
      enabled: config.enabled,
      cron: config.cron,
      lastRun: runtime.lastRunAt,
      status: currentJob
        ? 'running'
        : lastJob?.status === 'success' || lastJob?.status === 'partial_success'
          ? 'success'
          : lastJob?.status === 'failed'
            ? 'failed'
            : 'idle',
      lastMessage:
        currentJob
          ? '同步任务正在执行中'
          : lastJob?.errors[0] ?? undefined,
    },
  };
}

export function updateAdminConfig(newConfig: Partial<AdminConfig>) {
  const syncPatch = newConfig.sync;
  if (syncPatch) {
    updateSyncConfig({
      enabled: syncPatch.enabled,
      cron: syncPatch.cron,
    });
  }

  return getAdminConfig();
}
