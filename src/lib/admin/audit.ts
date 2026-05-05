import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureSyncPaths, getSyncPaths } from '@/lib/sync/paths';

type AdminAuditEvent =
  | 'login_success'
  | 'login_failed'
  | 'login_rate_limited'
  | 'logout';

export type AdminAuditRecord = {
  event: AdminAuditEvent;
  ip: string;
  userAgent: string;
  reason?: string;
  createdAt?: string;
};

function getAdminAuditLogPath() {
  ensureSyncPaths();
  return path.join(getSyncPaths().adminRoot, 'audit.log');
}

export function writeAdminAuditLog(record: AdminAuditRecord) {
  const line = JSON.stringify({
    ...record,
    userAgent: record.userAgent.slice(0, 256),
    createdAt: record.createdAt ?? new Date().toISOString(),
  });

  fs.appendFileSync(getAdminAuditLogPath(), `${line}\n`, 'utf-8');
}
