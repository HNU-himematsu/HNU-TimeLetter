import { runSyncJob } from './sync/orchestrator';

export async function syncFeishuData(): Promise<{
  success: boolean;
  message: string;
  data?: { locationCount: number; storyCount: number; creationIdeaCount: number };
}> {
  const job = await runSyncJob({
    kind: 'sync-data',
    tables: ['locations', 'stories', 'creation_headers', 'creation_board'],
    dependencyMode: 'run_dependencies',
    includeAssets: true,
    continueOnTableError: false,
    triggeredBy: 'cli',
  });

  const success = job.status === 'success';

  return {
    success,
    message: success ? '同步完成' : job.errors[0] || '同步失败',
    data: job.summary
      ? {
          locationCount: Number(job.summary.locationCount ?? 0),
          storyCount: Number(job.summary.storyCount ?? 0),
          creationIdeaCount: Number(job.summary.creationIdeaCount ?? 0),
        }
      : undefined,
  };
}
