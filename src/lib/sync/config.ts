import * as fs from 'fs';
import { ensureSyncPaths, getSyncPaths } from './paths';
import {
  SYNC_TABLE_KEYS,
  normalizeSyncTables,
} from './registry';
import type { SyncConfigRecord } from './types';

export function getDefaultSyncConfig(): SyncConfigRecord {
  return {
    enabled: false,
    cron: '0 0 * * *',
    defaultTables: [...SYNC_TABLE_KEYS],
    defaultJobKind: 'sync-data',
  };
}

export function getSyncConfig() {
  ensureSyncPaths();
  const { configPath } = getSyncPaths();
  const defaultConfig = getDefaultSyncConfig();

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      'utf-8',
    );
    return { ...defaultConfig };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(configPath, 'utf-8'),
    ) as Partial<SyncConfigRecord>;

    return {
      ...defaultConfig,
      ...parsed,
      defaultTables: normalizeSyncTables(
        parsed.defaultTables,
        defaultConfig.defaultTables,
      ),
    } satisfies SyncConfigRecord;
  } catch {
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      'utf-8',
    );
    return { ...defaultConfig };
  }
}

export function updateSyncConfig(
  patch: Partial<SyncConfigRecord>,
) {
  const current = getSyncConfig();
  const next: SyncConfigRecord = {
    ...current,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
    ...(patch.defaultJobKind !== undefined
      ? { defaultJobKind: patch.defaultJobKind }
      : {}),
    defaultTables:
      patch.defaultTables === undefined
        ? current.defaultTables
        : normalizeSyncTables(patch.defaultTables, current.defaultTables),
  };

  ensureSyncPaths();
  fs.writeFileSync(
    getSyncPaths().configPath,
    JSON.stringify(next, null, 2),
    'utf-8',
  );

  return next;
}
