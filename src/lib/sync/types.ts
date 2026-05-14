import type { CardHeaderInfo, Contributor, CreationIdea, LocationPoint } from '../types';
import type { SyncLogger } from './logger';

export type SyncJobKind = 'sync-data';

/** 从 SyncTableOutputMap 派生，确保类型定义与输出映射始终一致。扩展同步表时在 SyncTableOutputMap 中添加条目，SyncTableKey 自动跟随更新。 */
export type SyncTableKey = keyof SyncTableOutputMap;

export type DependencyMode = 'read_local' | 'run_dependencies' | 'strict';

export type SyncJobStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'canceled';

export type SyncStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'success_with_warnings'
  | 'skipped'
  | 'failed';

export interface SyncConfigRecord {
  enabled: boolean;
  cron: string;
  defaultTables: SyncTableKey[];
}

export interface SyncRunRequest {
  kind?: SyncJobKind;
  tables?: SyncTableKey[];
  dependencyMode?: DependencyMode;
  includeAssets?: boolean;
  continueOnTableError?: boolean;
  triggeredBy?: 'admin-ui' | 'scheduler' | 'cli' | 'webhook';
  note?: string;
}

export interface SyncTableSummary {
  totalRecords?: number;
  successRecords?: number;
  skippedRecords?: number;
  failedRecords?: number;
  filesWritten?: string[];
  [key: string]: unknown;
}

export interface SyncJobStep {
  step: string;
  status: SyncStepStatus;
  startedAt?: string;
  finishedAt?: string;
  summary?: SyncTableSummary;
  warnings?: string[];
  errors?: string[];
}

export interface SyncJobRecord {
  jobId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  tables: SyncTableKey[];
  effectiveTables: SyncTableKey[];
  dependencyMode: DependencyMode;
  includeAssets: boolean;
  continueOnTableError: boolean;
  triggeredBy: 'admin-ui' | 'scheduler' | 'cli' | 'webhook';
  note?: string;
  createdAt: string;
  startedAt?: string;
  syncedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  steps: SyncJobStep[];
  summary?: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

export interface SyncRuntimeSummary {
  currentJobId: string | null;
  lastJobId: string | null;
  lastRunAt?: string;
}

export interface SyncConfigResponse {
  config: SyncConfigRecord;
  runtime: SyncRuntimeSummary;
}

export interface SyncEnvironmentSettings {
  feishuAppId?: string;
  feishuAppSecret?: string;
  feishuAppToken?: string;
  feishuTableId?: string;
  feishuViewId?: string;
  feishuCreationTableId?: string;
  feishuCreationViewId?: string;
  feishuCreationHeaderTableId?: string;
  feishuOssTableId?: string;
  feishuLocationsTableId?: string;
  feishuContributorsTableId?: string;
  ossRegion?: string;
  ossBucket?: string;
  ossAccessKeyId?: string;
  ossAccessKeySecret?: string;
}

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export interface FeishuAttachment {
  file_token?: string;
  token?: string;
  name?: string;
}

export interface LocationCoordsEntry {
  name: string;
  x: number;
  y: number;
}

export type LocationCoords = Record<string, LocationCoordsEntry>;

export interface SyncAuthService {
  getTenantAccessToken(): Promise<string>;
}

export interface SyncBitableService {
  listRecords(tableId: string): Promise<FeishuRecord[]>;
  searchRecords(tableId: string, body: Record<string, unknown>): Promise<FeishuRecord[]>;
  createRecord(tableId: string, fields: Record<string, unknown>): Promise<FeishuRecord>;
  updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<FeishuRecord>;
}

export interface SyncDriveService {
  downloadAttachment(fileToken: string): Promise<Buffer>;
}

export interface SyncOssService {
  readonly isConfigured: boolean;
  upload(
    buffer: Buffer,
    fileName: string,
  ): Promise<{ url: string; path: string; hash: string }>;
}

export interface SyncServices {
  feishuAuth: SyncAuthService;
  feishuBitable: SyncBitableService;
  feishuDrive: SyncDriveService;
  oss: SyncOssService;
}

export interface SyncTableOutputMap {
  locations: LocationCoords;
  stories: LocationPoint[];
  creation_board: CreationIdea[];
  creation_headers: CardHeaderInfo[];
  contributors: Contributor[];
}

export interface SyncContext {
  jobId: string;
  logger: SyncLogger;
  settings: SyncEnvironmentSettings;
  services: SyncServices;
  requestedTables: SyncTableKey[];
  effectiveTables: SyncTableKey[];
  dependencyMode: DependencyMode;
  includeAssets: boolean;
  continueOnTableError: boolean;
  outputs: Partial<SyncTableOutputMap>;
}

export interface TableSyncResult<
  TKey extends keyof SyncTableOutputMap = keyof SyncTableOutputMap,
  TOutput = SyncTableOutputMap[TKey],
> {
  output?: TOutput;
  filesWritten?: string[];
  summary?: SyncTableSummary;
  warnings?: string[];
}

export interface TableSyncModule<TKey extends SyncTableKey = SyncTableKey> {
  key: TKey;
  label: string;
  dependsOn?: SyncTableKey[];
  run(ctx: SyncContext): Promise<TableSyncResult<TKey>>;
}
