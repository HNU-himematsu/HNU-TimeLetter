import type {
  DependencyMode,
  SyncTableKey,
  TableSyncModule,
} from './types';
import { charactersModule } from './tables/characters.module';
import { creationBoardModule } from './tables/creation-board.module';
import { creationHeadersModule } from './tables/creation-headers.module';
import { locationsModule } from './tables/locations.module';
import { storiesModule } from './tables/stories.module';
import { contributorsModule } from './tables/contributors.module';

export class SyncValidationError extends Error {}

export const tableRegistry = {
  locations: locationsModule,
  characters: charactersModule,
  stories: storiesModule,
  creation_headers: creationHeadersModule,
  creation_board: creationBoardModule,
  contributors: contributorsModule,
} satisfies Record<SyncTableKey, TableSyncModule>;

export const SYNC_TABLE_KEYS = Object.keys(tableRegistry) as SyncTableKey[];

export function getSyncTableDefinitions() {
  return SYNC_TABLE_KEYS.map((key) => ({
    key,
    label: tableRegistry[key].label,
    dependsOn: tableRegistry[key].dependsOn ?? [],
  }));
}

export function normalizeSyncTables(
  tables: readonly string[] | undefined,
  fallback: SyncTableKey[] = [...SYNC_TABLE_KEYS],
) {
  if (!tables || tables.length === 0) {
    return [...fallback];
  }

  const invalid = tables.filter((table): table is string => !SYNC_TABLE_KEYS.includes(table as SyncTableKey));
  if (invalid.length > 0) {
    throw new SyncValidationError(`不支持的同步表: ${invalid.join(', ')}`);
  }

  return Array.from(new Set(tables)) as SyncTableKey[];
}

function visitTable(
  key: SyncTableKey,
  selected: Set<SyncTableKey>,
  visiting: Set<SyncTableKey>,
  visited: Set<SyncTableKey>,
  ordered: SyncTableKey[],
) {
  if (visited.has(key)) {
    return;
  }

  if (visiting.has(key)) {
    throw new SyncValidationError(`检测到同步表循环依赖: ${key}`);
  }

  visiting.add(key);
  const dependsOn = tableRegistry[key].dependsOn ?? [];
  dependsOn.forEach((dependency) => {
    if (selected.has(dependency)) {
      visitTable(dependency, selected, visiting, visited, ordered);
    }
  });
  visiting.delete(key);
  visited.add(key);
  ordered.push(key);
}

export function sortTablesForExecution(tables: SyncTableKey[]) {
  const ordered: SyncTableKey[] = [];
  const selected = new Set(tables);
  const visiting = new Set<SyncTableKey>();
  const visited = new Set<SyncTableKey>();

  tables.forEach((table) => {
    visitTable(table, selected, visiting, visited, ordered);
  });

  return ordered;
}

function collectDependencies(target: SyncTableKey, selected: Set<SyncTableKey>) {
  if (selected.has(target)) {
    return;
  }

  (tableRegistry[target].dependsOn ?? []).forEach((dependency) => {
    collectDependencies(dependency, selected);
  });

  selected.add(target);
}

export function resolveEffectiveTables(
  tables: SyncTableKey[],
  dependencyMode: DependencyMode,
) {
  if (dependencyMode !== 'run_dependencies') {
    return sortTablesForExecution(tables);
  }

  const expanded = new Set<SyncTableKey>();
  tables.forEach((table) => collectDependencies(table, expanded));
  return sortTablesForExecution(Array.from(expanded));
}
