import { getSyncConfig } from './config';
import { getJob, getRuntimeSummary, listJobs, updateJob, writeJob } from './job-store';
import { acquireSyncLock, releaseSyncLock, SyncConflictError } from './lock';
import { createSyncLogger } from './logger';
import { publishBuildTimeData } from './publish/publisher';
import {
  resolveEffectiveTables,
  normalizeSyncTables,
  SyncValidationError,
  tableRegistry,
} from './registry';
import { FeishuAuthClient } from './clients/feishu-auth-client';
import { FeishuBitableClient } from './clients/feishu-bitable-client';
import { FeishuDriveClient } from './clients/feishu-drive-client';
import { OssClient } from './clients/oss-client';
import { getSyncEnvironmentSettings } from './settings';
import type {
  DependencyMode,
  SyncContext,
  SyncJobKind,
  SyncJobRecord,
  SyncJobStep,
  SyncRunRequest,
  SyncStepStatus,
  SyncTableKey,
  SyncTableSummary,
} from './types';

let reservedJobId: string | null = null;

type ExecutionState = {
  totalRecords: number;
  successRecords: number;
  skippedRecords: number;
  failedRecords: number;
  locationCount?: number;
  storyCount?: number;
  creationIdeaCount?: number;
  contributorCount?: number;
  filesWritten: Set<string>;
  warnings: string[];
  errors: string[];
  successfulTables: number;
  failedTables: number;
};

function createJobId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `sync_${stamp}_${random}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function pushUnique(list: string[], values: string[]) {
  values.forEach((value) => {
    if (!list.includes(value)) {
      list.push(value);
    }
  });
}

function normalizeKind(kind: string): SyncJobKind {
  if (kind === 'sync-data' || kind === 'sync-data-and-publish') {
    return kind;
  }

  throw new SyncValidationError(`不支持的同步任务类型: ${kind}`);
}

function normalizeDependencyMode(mode: string): DependencyMode {
  if (
    mode === 'read_local'
    || mode === 'run_dependencies'
    || mode === 'strict'
  ) {
    return mode;
  }

  throw new SyncValidationError(`不支持的依赖模式: ${mode}`);
}

function resolveRequestedTables(request: SyncRunRequest, fallback: SyncTableKey[]) {
  return normalizeSyncTables(request.tables, fallback);
}

function createInitialJob(request: SyncRunRequest): SyncJobRecord {
  const config = getSyncConfig();
  const tables = resolveRequestedTables(request, config.defaultTables);
  const kind = normalizeKind(request.kind ?? config.defaultJobKind);
  const dependencyMode = normalizeDependencyMode(request.dependencyMode ?? 'read_local');
  const effectiveTables = resolveEffectiveTables(tables, dependencyMode);

  const steps: SyncJobStep[] = [
    ...effectiveTables.map(
      (table) =>
        ({
          step: table,
          status: 'pending',
        }) satisfies SyncJobStep,
    ),
    ...(kind === 'sync-data-and-publish'
      ? [
          {
            step: 'publish',
            status: 'pending',
          } satisfies SyncJobStep,
        ]
      : []),
  ];

  return {
    jobId: createJobId(),
    kind,
    status: 'queued',
    tables,
    effectiveTables,
    dependencyMode,
    includeAssets: request.includeAssets ?? true,
    continueOnTableError: request.continueOnTableError ?? false,
    triggeredBy: request.triggeredBy ?? 'admin-ui',
    note: request.note,
    createdAt: new Date().toISOString(),
    steps,
    warnings: [],
    errors: [],
  };
}

function updateStep(
  job: SyncJobRecord,
  stepName: string,
  patch: Partial<SyncJobRecord['steps'][number]>,
) {
  return {
    ...job,
    steps: job.steps.map((step) =>
      step.step === stepName ? { ...step, ...patch } : step,
    ),
  };
}

function markPendingStepsSkipped(
  job: SyncJobRecord,
  reason: string,
  predicate?: (step: SyncJobStep) => boolean,
) {
  const finishedAt = new Date().toISOString();

  return {
    ...job,
    steps: job.steps.map((step) => {
      if (step.status !== 'pending') {
        return step;
      }

      if (predicate && !predicate(step)) {
        return step;
      }

      return {
        ...step,
        status: 'skipped',
        finishedAt,
        warnings: step.warnings ? [...step.warnings, reason] : [reason],
      } satisfies SyncJobStep;
    }),
  };
}

function createExecutionState(): ExecutionState {
  return {
    totalRecords: 0,
    successRecords: 0,
    skippedRecords: 0,
    failedRecords: 0,
    filesWritten: new Set<string>(),
    warnings: [],
    errors: [],
    successfulTables: 0,
    failedTables: 0,
  };
}

function mergeStepSummary(
  state: ExecutionState,
  summary: SyncTableSummary | undefined,
) {
  if (!summary) {
    return;
  }

  state.totalRecords += Number(summary.totalRecords ?? 0);
  state.successRecords += Number(summary.successRecords ?? 0);
  state.skippedRecords += Number(summary.skippedRecords ?? 0);
  state.failedRecords += Number(summary.failedRecords ?? 0);

  if (typeof summary.locationCount === 'number') {
    state.locationCount = summary.locationCount;
  }

  if (typeof summary.storyCount === 'number') {
    state.storyCount = summary.storyCount;
  }

  if (typeof summary.creationIdeaCount === 'number') {
    state.creationIdeaCount = summary.creationIdeaCount;
  }

  if (typeof summary.contributorCount === 'number') {
    state.contributorCount = summary.contributorCount;
  }

  const filesWritten = summary.filesWritten ?? [];
  filesWritten.forEach((filePath) => state.filesWritten.add(filePath));
}

function buildJobSummary(state: ExecutionState) {
  const summary: Record<string, unknown> = {
    totalRecords: state.totalRecords,
    successRecords: state.successRecords,
    skippedRecords: state.skippedRecords,
    failedRecords: state.failedRecords,
    filesWritten: [...state.filesWritten],
  };

  if (state.locationCount !== undefined) {
    summary.locationCount = state.locationCount;
  }

  if (state.storyCount !== undefined) {
    summary.storyCount = state.storyCount;
  }

  if (state.creationIdeaCount !== undefined) {
    summary.creationIdeaCount = state.creationIdeaCount;
  }

  if (state.contributorCount !== undefined) {
    summary.contributorCount = state.contributorCount;
  }

  return summary;
}

function resolveSuccessStepStatus(
  warnings: string[],
  summary: SyncTableSummary | undefined,
): SyncStepStatus {
  if (warnings.length > 0 || Number(summary?.failedRecords ?? 0) > 0) {
    return 'success_with_warnings';
  }

  return 'success';
}

function createSyncContext(job: SyncJobRecord, logger: ReturnType<typeof createSyncLogger>): SyncContext {
  const settings = getSyncEnvironmentSettings();
  const feishuAuth = new FeishuAuthClient(settings);

  return {
    jobId: job.jobId,
    logger,
    settings,
    services: {
      feishuAuth,
      feishuBitable: new FeishuBitableClient(feishuAuth, settings),
      feishuDrive: new FeishuDriveClient(feishuAuth),
      oss: new OssClient(settings),
    },
    requestedTables: job.tables,
    effectiveTables: job.effectiveTables,
    dependencyMode: job.dependencyMode,
    includeAssets: job.includeAssets,
    continueOnTableError: job.continueOnTableError,
    outputs: {},
  };
}

export async function executeSyncJob(jobId: string) {
  const existing = getJob(jobId);
  if (!existing) {
    throw new Error(`Sync job not found: ${jobId}`);
  }

  const logger = createSyncLogger(jobId);
  const startedAt = new Date().toISOString();

  updateJob(jobId, (job) => ({
    ...job,
    status: 'running',
    startedAt,
  }));

  logger.info('Sync job started', { jobId, kind: existing.kind, tables: existing.tables });

  try {
    acquireSyncLock(jobId);
    if (reservedJobId === jobId) {
      reservedJobId = null;
    }
  } catch (error) {
    if (reservedJobId === jobId) {
      reservedJobId = null;
    }
    if (error instanceof SyncConflictError) {
      updateJob(jobId, (job) => ({
        ...job,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        durationMs: job.startedAt
          ? Date.now() - Date.parse(job.startedAt)
          : undefined,
        errors: [...job.errors, error.message],
        publishStatus: 'not_required',
      }));
    }
    throw error;
  }

  try {
    const executionState = createExecutionState();
    const context = createSyncContext(existing, logger);
    let aborted = false;

    for (const tableKey of existing.effectiveTables) {
      updateJob(jobId, (job) =>
        updateStep(job, tableKey, {
          status: 'running',
          startedAt: new Date().toISOString(),
          warnings: [],
          errors: [],
        }),
      );

      logger.info('Table step started', tableKey);

      const tableModule = tableRegistry[tableKey];

      try {
        const result = await tableModule.run(context);
        const warnings = result.warnings ?? [];
        const summary = result.summary;
        const filesWritten = result.filesWritten ?? result.summary?.filesWritten ?? [];
        filesWritten.forEach((filePath) => executionState.filesWritten.add(filePath));
        mergeStepSummary(executionState, summary);
        pushUnique(executionState.warnings, warnings);
        executionState.successfulTables += 1;

        if (result.output !== undefined) {
          (context.outputs as Record<string, unknown>)[tableKey] = result.output;
        }

        const stepStatus = resolveSuccessStepStatus(warnings, summary);

        updateJob(jobId, (job) => ({
          ...updateStep(job, tableKey, {
            status: stepStatus,
            finishedAt: new Date().toISOString(),
            summary: summary
              ? {
                  ...summary,
                  filesWritten,
                }
              : filesWritten.length > 0
                ? { filesWritten }
                : undefined,
            warnings,
          }),
          warnings: [...executionState.warnings],
          errors: [...executionState.errors],
          summary: buildJobSummary(executionState),
        }));

        logger.info('Table step finished', {
          table: tableKey,
          status: stepStatus,
          summary,
        });
      } catch (error) {
        const errorMessage = `${tableKey} 同步失败: ${toErrorMessage(error)}`;
        executionState.failedTables += 1;
        pushUnique(executionState.errors, [errorMessage]);

        updateJob(jobId, (job) => ({
          ...updateStep(job, tableKey, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            errors: [errorMessage],
          }),
          warnings: [...executionState.warnings],
          errors: [...executionState.errors],
          summary: buildJobSummary(executionState),
        }));

        logger.error('Table step failed', { table: tableKey, error: errorMessage });

        if (!existing.continueOnTableError) {
          aborted = true;
          break;
        }
      }
    }

    const anySuccessfulTables = executionState.successfulTables > 0;
    const anyFailedTables = executionState.failedTables > 0;
    const syncFinishedAt = new Date().toISOString();
    const syncStatus = anyFailedTables
      ? anySuccessfulTables
        ? 'partial_success'
        : 'failed'
      : 'success';

    updateJob(jobId, (job) => {
      const nextJob = aborted
        ? markPendingStepsSkipped(
            job,
            '前序同步步骤失败，未继续执行剩余步骤',
            (step) => step.step !== 'publish',
          )
        : job;

      return {
        ...nextJob,
        status: syncStatus,
        syncedAt: anySuccessfulTables ? syncFinishedAt : job.syncedAt,
        warnings: [...executionState.warnings],
        errors: [...executionState.errors],
        summary: buildJobSummary(executionState),
      };
    });

    const afterSync = getJob(jobId);
    if (!afterSync) {
      throw new Error(`Sync job disappeared after sync phase: ${jobId}`);
    }

    if (afterSync.kind === 'sync-data') {
      updateJob(jobId, (job) => ({
        ...job,
        publishStatus: anySuccessfulTables ? 'pending' : 'not_required',
        finishedAt: new Date().toISOString(),
        durationMs: job.startedAt
          ? Date.now() - Date.parse(job.startedAt)
          : undefined,
      }));

      logger.info('Sync job completed without publish step', {
        status: syncStatus,
      });
      return getJob(jobId);
    }

    if (syncStatus !== 'success') {
      const publishWarning = anySuccessfulTables
        ? '同步阶段存在失败步骤，已跳过发布'
        : '同步阶段未生成可发布产物，已跳过发布';

      updateJob(jobId, (job) => ({
        ...markPendingStepsSkipped(job, publishWarning, (step) => step.step === 'publish'),
        publishStatus: anySuccessfulTables ? 'pending' : 'not_required',
        finishedAt: new Date().toISOString(),
        durationMs: job.startedAt
          ? Date.now() - Date.parse(job.startedAt)
          : undefined,
        warnings: job.warnings.includes(publishWarning)
          ? job.warnings
          : [...job.warnings, publishWarning],
      }));

      logger.warn(publishWarning);
      return getJob(jobId);
    }

    updateJob(jobId, (job) =>
      updateStep(
        {
          ...job,
          publishStatus: 'building',
        },
        'publish',
        {
          status: 'running',
          startedAt: new Date().toISOString(),
        },
      ),
    );

    logger.info('Publish step started');
    await publishBuildTimeData(logger);

    updateJob(jobId, (job) => {
      const publishedSummary = {
        ...(job.summary ?? {}),
        published: true,
      };

      return {
        ...updateStep(job, 'publish', {
          status: 'success',
          finishedAt: new Date().toISOString(),
        }),
        status: syncStatus,
        publishStatus: 'published',
        publishedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: job.startedAt
          ? Date.now() - Date.parse(job.startedAt)
          : undefined,
        summary: publishedSummary,
      };
    });

    logger.info('Publish step finished successfully');
    return getJob(jobId);
  } catch (error) {
    logger.error('Sync job crashed', error);

    updateJob(jobId, (job) => {
      const failedMessage = toErrorMessage(error);
      const runningStep = job.steps.find((step) => step.status === 'running')?.step;
      const failedStepName = runningStep ?? job.effectiveTables.find(() => true) ?? 'publish';
      const failedStepJob = updateStep(job, failedStepName, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errors: [failedMessage],
      });

      return {
        ...markPendingStepsSkipped(
          failedStepJob,
          '同步任务异常终止，剩余步骤已跳过',
        ),
        status: 'failed',
        publishStatus:
          failedStepName === 'publish' ? 'publish_failed' : 'not_required',
        finishedAt: new Date().toISOString(),
        durationMs: job.startedAt
          ? Date.now() - Date.parse(job.startedAt)
          : undefined,
        warnings: job.warnings,
        errors: job.errors.includes(failedMessage)
          ? job.errors
          : [...job.errors, failedMessage],
      };
    });

    return getJob(jobId);
  } finally {
    if (reservedJobId === jobId) {
      reservedJobId = null;
    }
    releaseSyncLock(jobId);
  }
}

export async function createSyncJob(
  request: SyncRunRequest,
  options?: { executeInBackground?: boolean },
) {
  if (reservedJobId) {
    throw new SyncConflictError('已有同步任务正在执行', reservedJobId);
  }

  const currentLock = getRuntimeSummary().currentJobId;
  if (currentLock) {
    throw new SyncConflictError('已有同步任务正在执行', currentLock);
  }

  const job = createInitialJob(request);
  reservedJobId = job.jobId;

  try {
    writeJob(job);

    const executeInBackground = options?.executeInBackground ?? true;

    if (executeInBackground) {
      void executeSyncJob(job.jobId);
      return job;
    }

    await executeSyncJob(job.jobId);
    return getJob(job.jobId) ?? job;
  } catch (error) {
    if (reservedJobId === job.jobId) {
      reservedJobId = null;
    }
    throw error;
  }
}

export async function runSyncJob(request: SyncRunRequest) {
  return createSyncJob(request, { executeInBackground: false });
}

export function getSyncJobs(limit?: number) {
  return listJobs(limit);
}

export { SyncValidationError };
