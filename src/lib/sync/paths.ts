import * as fs from 'fs';
import * as path from 'path';

function resolveBaseDir(envValue: string | undefined, fallbackRelativePath: string) {
  if (!envValue || !envValue.trim()) {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), fallbackRelativePath);
  }

  return path.isAbsolute(envValue)
    ? envValue
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), envValue);
}

export function getSyncPaths() {
  const runtimeRoot = resolveBaseDir(process.env.SYNC_RUNTIME_DIR, 'runtime');
  const adminRoot = path.join(runtimeRoot, 'admin');
  const jobsRoot = path.join(adminRoot, 'sync-jobs');
  const logRoot = resolveBaseDir(process.env.SYNC_LOG_DIR, path.join('logs', 'sync'));

  return {
    runtimeRoot,
    adminRoot,
    jobsRoot,
    logRoot,
    configPath: path.join(adminRoot, 'sync-config.json'),
    lockPath: path.join(adminRoot, 'sync-lock.json'),
  };
}

export function ensureSyncPaths() {
  const { runtimeRoot, adminRoot, jobsRoot, logRoot } = getSyncPaths();

  [runtimeRoot, adminRoot, jobsRoot, logRoot].forEach((dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
  });
}

export function getJobFilePath(jobId: string) {
  ensureSyncPaths();
  return path.join(getSyncPaths().jobsRoot, `${jobId}.json`);
}

export function getJobLogPath(jobId: string) {
  ensureSyncPaths();
  return path.join(getSyncPaths().logRoot, `${jobId}.log`);
}
