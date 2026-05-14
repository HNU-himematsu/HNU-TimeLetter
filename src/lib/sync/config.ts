import * as fs from 'fs';
import { ensureSyncPaths, getSyncPaths } from './paths';
import {
  SYNC_TABLE_KEYS,
  normalizeSyncTables,
} from './registry';
import type { SyncConfigRecord } from './types';

type LegacySyncConfigRecord = Partial<SyncConfigRecord> & Record<string, unknown>;

function normalizeSyncConfigRecord(config: LegacySyncConfigRecord): SyncConfigRecord {
  const defaultConfig = getDefaultSyncConfig();

  return {
    enabled: config.enabled ?? defaultConfig.enabled,
    cron: config.cron ?? defaultConfig.cron,
    defaultTables: normalizeSyncTables(
      config.defaultTables,
      defaultConfig.defaultTables,
    ),
  } satisfies SyncConfigRecord;
}

export function getDefaultSyncConfig(): SyncConfigRecord {
  return {
    enabled: false,
    cron: '0 0 * * *',
    defaultTables: [...SYNC_TABLE_KEYS],
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
    ) as LegacySyncConfigRecord;

    const normalized = normalizeSyncConfigRecord(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      fs.writeFileSync(
        configPath,
        JSON.stringify(normalized, null, 2),
        'utf-8',
      );
    }

    return normalized;
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
  const next = normalizeSyncConfigRecord({
    ...current,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
    ...(patch.defaultTables !== undefined
      ? { defaultTables: patch.defaultTables }
      : {}),
  });

  ensureSyncPaths();
  fs.writeFileSync(
    getSyncPaths().configPath,
    JSON.stringify(next, null, 2),
    'utf-8',
  );

  return next;
}
