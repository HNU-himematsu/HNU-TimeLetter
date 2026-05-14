import * as fs from 'fs';
import * as path from 'path';
import { getCurrentLock } from './lock';
import { ensureSyncPaths, getJobFilePath, getSyncPaths } from './paths';
import type {
  SyncJobRecord,
  SyncRuntimeSummary,
} from './types';

const MAX_JOB_FILES = 100;

function readJobFile(jobPath: string) {
  try {
    return JSON.parse(fs.readFileSync(jobPath, 'utf-8')) as SyncJobRecord;
  } catch {
    return null;
  }
}

function listJobPaths() {
  ensureSyncPaths();
  return fs
    .readdirSync(getSyncPaths().jobsRoot)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.join(getSyncPaths().jobsRoot, fileName));
}

function cleanupOldJobs() {
  const jobPaths = listJobPaths()
    .map((jobPath) => {
      const job = readJobFile(jobPath);
      return job
        ? { jobPath, createdAt: Date.parse(job.createdAt) || 0 }
        : null;
    })
    .filter((item): item is { jobPath: string; createdAt: number } => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const stale of jobPaths.slice(MAX_JOB_FILES)) {
    fs.unlinkSync(stale.jobPath);
  }
}

export function writeJob(job: SyncJobRecord) {
  ensureSyncPaths();
  fs.writeFileSync(
    getJobFilePath(job.jobId),
    JSON.stringify(job, null, 2),
    'utf-8',
  );
  cleanupOldJobs();
  return job;
}

export function getJob(jobId: string) {
  const jobPath = getJobFilePath(jobId);
  if (!fs.existsSync(jobPath)) {
    return null;
  }

  return readJobFile(jobPath);
}

export function updateJob(
  jobId: string,
  updater: (current: SyncJobRecord) => SyncJobRecord,
) {
  const current = getJob(jobId);
  if (!current) {
    return null;
  }

  const next = updater(current);
  return writeJob(next);
}

export function listJobs(limit = 20) {
  return listJobPaths()
    .map((jobPath) => readJobFile(jobPath))
    .filter((job): job is SyncJobRecord => Boolean(job))
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    )
    .slice(0, limit);
}

export function getRuntimeSummary(): SyncRuntimeSummary {
  const jobs = listJobs(MAX_JOB_FILES);
  const currentLock = getCurrentLock();
  const currentJob = currentLock ? getJob(currentLock.jobId) : null;
  const lastJob = jobs[0] ?? null;

  return {
    currentJobId: currentLock?.jobId ?? null,
    lastJobId: lastJob?.jobId ?? null,
    lastRunAt: currentJob?.syncedAt ?? lastJob?.syncedAt,
  };
}
