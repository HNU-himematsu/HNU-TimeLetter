'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import type {
  DependencyMode,
  SyncConfigResponse,
  SyncJobRecord,
  SyncTableKey,
} from '@/lib/sync/types';

type TableDefinition = {
  key: SyncTableKey;
  label: string;
  dependsOn: SyncTableKey[];
};

type ConfigResponse = SyncConfigResponse & {
  availableTables: TableDefinition[];
  nextRunAt?: string | null;
};

type Job = SyncJobRecord;

type ConfigFormState = {
  enabled: boolean;
  cron: string;
  defaultTables: SyncTableKey[];
  dependencyMode: DependencyMode;
};

type RunFormState = {
  tables: SyncTableKey[];
  dependencyMode: DependencyMode;
  includeAssets: boolean;
  continueOnTableError: boolean;
  note: string;
};

type NoticeState =
  | {
      type: 'success' | 'error';
      text: string;
    }
  | null;

const dependencyModeOptions: Array<{
  value: DependencyMode;
  label: string;
  description: string;
}> = [
  {
    value: 'read_local',
    label: '仅读本地依赖',
    description: '只同步你勾选的表，依赖表从现有产物读取。',
  },
  {
    value: 'run_dependencies',
    label: '执行依赖表',
    description: '自动补跑依赖表，并允许写入依赖产物。',
  },
  {
    value: 'strict',
    label: '严格模式',
    description: '缺依赖就直接失败，不自动读取也不自动补跑。',
  },
];

function formatTime(value?: string) {
  if (!value) {
    return '未执行';
  }

  return new Date(value).toLocaleString();
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join('、') : '无';
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'running':
      return '执行中';
    case 'success':
      return '成功';
    case 'partial_success':
      return '部分成功';
    case 'failed':
      return '失败';
    case 'canceled':
      return '已取消';
    case 'success_with_warnings':
      return '成功（有警告）';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'partial_success':
    case 'success_with_warnings':
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'queued':
    case 'skipped':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getSummaryNumber(summary: Record<string, unknown> | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === 'number' ? value : null;
}

function dedupeTables(tables: SyncTableKey[]) {
  return Array.from(new Set(tables));
}

function getDependencyClosure(
  tables: SyncTableKey[],
  tableDefinitions: TableDefinition[],
): SyncTableKey[] {
  const dependenciesByTable = new Map(
    tableDefinitions.map((table) => [table.key, table.dependsOn]),
  );
  const selected = new Set<SyncTableKey>();

  const visit = (table: SyncTableKey) => {
    if (selected.has(table)) {
      return;
    }

    dependenciesByTable.get(table)?.forEach(visit);
    selected.add(table);
  };

  tables.forEach(visit);
  return tableDefinitions
    .map((table) => table.key)
    .filter((table) => selected.has(table));
}

export default function DashboardPage() {
  const showMapCoordinates = useAppStore((s) => s.showMapCoordinates);
  const setShowMapCoordinates = useAppStore((s) => s.setShowMapCoordinates);

  const [payload, setPayload] = useState<ConfigResponse | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [configForm, setConfigForm] = useState<ConfigFormState | null>(null);
  const [runForm, setRunForm] = useState<RunFormState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [expandedJobLog, setExpandedJobLog] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<string, string[]>>({});
  const [loadingLog, setLoadingLog] = useState<string | null>(null);

  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }

    try {
      const [configRes, jobsRes] = await Promise.all([
        fetch('/api/admin/sync/config', { cache: 'no-store' }),
        fetch('/api/admin/sync/jobs?limit=12', { cache: 'no-store' }),
      ]);

      if (configRes.ok) {
        const configData = (await configRes.json()) as ConfigResponse;
        setPayload(configData);
        setConfigForm((current) =>
          current ?? {
            enabled: configData.config.enabled,
            cron: configData.config.cron,
            defaultTables: [...configData.config.defaultTables],
            dependencyMode: 'run_dependencies',
          },
        );
        setRunForm((current) =>
          current ?? {
            tables: [...configData.config.defaultTables],
            dependencyMode: 'read_local',
            includeAssets: true,
            continueOnTableError: false,
            note: '',
          },
        );
      }

      if (jobsRes.ok) {
        const data = (await jobsRes.json()) as { items: Job[] };
        setJobs(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      setNotice({
        type: 'error',
        text: '刷新后台状态失败，请稍后重试。',
      });
    } finally {
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const availableTables = useMemo(
    () => payload?.availableTables ?? [],
    [payload?.availableTables],
  );
  const tableLabelMap = useMemo(() => {
    return Object.fromEntries(
      availableTables.map((table) => [table.key, table.label]),
    ) as Record<string, string>;
  }, [availableTables]);

  const currentJob = payload?.runtime.currentJobId
    ? jobs.find((job) => job.jobId === payload.runtime.currentJobId) || null
    : null;
  const lastJob = jobs[0] || null;
  const isRunning = Boolean(currentJob);

  const toggleRunTable = (tableKey: SyncTableKey) => {
    setRunForm((current) => {
      if (!current) return current;

      const tables = current.tables.includes(tableKey)
        ? current.tables.filter((item) => item !== tableKey)
        : dedupeTables([...current.tables, tableKey]);

      return {
        ...current,
        tables,
      };
    });
  };

  const toggleDefaultTable = (tableKey: SyncTableKey) => {
    setConfigForm((current) => {
      if (!current) return current;

      const defaultTables = current.defaultTables.includes(tableKey)
        ? current.defaultTables.filter((item) => item !== tableKey)
        : dedupeTables([...current.defaultTables, tableKey]);

      return {
        ...current,
        defaultTables,
      };
    });
  };

  const resetFormsFromServer = () => {
    if (!payload) {
      return;
    }

    setConfigForm({
      enabled: payload.config.enabled,
      cron: payload.config.cron,
      defaultTables: [...payload.config.defaultTables],
      dependencyMode: configForm?.dependencyMode ?? 'run_dependencies',
    });
    setRunForm((current) => ({
      dependencyMode: current?.dependencyMode ?? 'read_local',
      includeAssets: current?.includeAssets ?? true,
      continueOnTableError: current?.continueOnTableError ?? false,
      note: current?.note ?? '',
      tables: [...payload.config.defaultTables],
    }));
    setNotice(null);
  };

  const handleSync = async () => {
    if (!runForm || runForm.tables.length === 0) {
      setNotice({
        type: 'error',
        text: '请至少选择一张需要同步的表。',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/sync/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sync-data',
          tables: runForm.tables,
          dependencyMode: runForm.dependencyMode,
          includeAssets: runForm.includeAssets,
          continueOnTableError: runForm.continueOnTableError,
          note: runForm.note.trim() || undefined,
          triggeredBy: 'admin-ui',
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        jobId?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || '创建同步任务失败');
      }

      setNotice({
        type: 'success',
        text: `已创建同步任务 ${data.jobId ?? ''}`.trim(),
      });
      setTimeout(() => {
        void fetchData();
      }, 400);
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '创建同步任务失败',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm || configForm.defaultTables.length === 0) {
      setNotice({
        type: 'error',
        text: '默认同步表不能为空。',
      });
      return;
    }

    setSavingConfig(true);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/sync/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: configForm.enabled,
          cron: configForm.cron,
          defaultTables: configForm.dependencyMode === 'run_dependencies'
            ? getDependencyClosure(configForm.defaultTables, availableTables)
            : configForm.defaultTables,
        }),
      });

      const data = (await response.json()) as ConfigResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || '保存配置失败');
      }

      setPayload(data);
      setConfigForm({
        enabled: data.config.enabled,
        cron: data.config.cron,
        defaultTables: [...data.config.defaultTables],
        dependencyMode: configForm.dependencyMode,
      });
      setNotice({
        type: 'success',
        text: '调度配置已保存。',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : '保存配置失败',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleJobLog = async (jobId: string) => {
    if (expandedJobLog === jobId) {
      setExpandedJobLog(null);
      return;
    }
    setExpandedJobLog(jobId);
    if (jobLogs[jobId]) return;
    setLoadingLog(jobId);
    try {
      const res = await fetch(`/api/admin/sync/jobs/${jobId}/logs`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { lines: string[]; total: number };
        setJobLogs((prev) => ({ ...prev, [jobId]: data.lines }));
      }
    } catch {
      setJobLogs((prev) => ({ ...prev, [jobId]: ['（日志加载失败）'] }));
    } finally {
      setLoadingLog(null);
    }
  };

  if (!payload || !configForm || !runForm) {
    return <div className="p-8 text-sm text-gray-600">正在加载后台配置...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统控制台</h2>
          <p className="mt-1 text-sm text-gray-600">
            数据同步后立即生效，无需重新构建。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void fetchData(true)}
          disabled={refreshing}
        >
          {refreshing ? '刷新中...' : '刷新状态'}
        </Button>
      </div>

      {notice && (
        <div
          className={`rounded border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">开发工具</h3>
          <p className="mt-1 text-sm text-gray-600">
            仅用于调试的辅助功能，不影响用户侧体验。设置持久化至本地浏览器。
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex items-center justify-between gap-3 rounded border border-gray-200 px-4 py-3 text-sm">
            <div>
              <span className="block font-medium text-gray-800">地图坐标显示</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                在地图页左下角实时显示鼠标所在 SVG 横纵坐标百分比 (x / y，范围 0–100)
              </span>
            </div>
            <input
              type="checkbox"
              checked={showMapCoordinates}
              onChange={(e) => setShowMapCoordinates(e.target.checked)}
              className="h-5 w-5 shrink-0"
            />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">同步状态</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <span>任务状态</span>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                  isRunning ? 'running' : lastJob?.status,
                )}`}
              >
                {getStatusLabel(isRunning ? 'running' : lastJob?.status || 'queued')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>上次同步</span>
              <span className="text-right">{formatTime(payload.runtime.lastRunAt)}</span>
            </div>
            {currentJob && (
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                执行中任务：{currentJob.jobId}
              </div>
            )}
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">手动同步</h3>
              <p className="mt-1 text-sm text-gray-600">
                按表触发数据同步，更新后立即生效。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRunForm((current) =>
                    current
                      ? {
                          ...current,
                          tables: [...payload.config.defaultTables],
                        }
                      : current,
                  )
                }
              >
                使用默认表
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRunForm((current) =>
                    current
                      ? {
                          ...current,
                          tables: availableTables.map((table) => table.key),
                        }
                      : current,
                  )
                }
              >
                全选表
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-800">本次同步表</div>
              <div className="space-y-2">
                {availableTables.map((table) => (
                  <label
                    key={table.key}
                    className="flex items-start gap-3 rounded border border-gray-200 px-3 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={runForm.tables.includes(table.key)}
                      onChange={() => toggleRunTable(table.key)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900">{table.label}</span>
                      <span className="block text-xs text-gray-500">
                        key: {table.key}
                        {table.dependsOn.length > 0
                          ? ` | 依赖: ${table.dependsOn.map((item) => tableLabelMap[item] || item).join('、')}`
                          : ' | 独立输出'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  依赖处理方式
                </label>
                <select
                  value={runForm.dependencyMode}
                  onChange={(event) =>
                    setRunForm({
                      ...runForm,
                      dependencyMode: event.target.value as DependencyMode,
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {dependencyModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {
                    dependencyModeOptions.find(
                      (option) => option.value === runForm.dependencyMode,
                    )?.description
                  }
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={runForm.includeAssets}
                    onChange={(event) =>
                      setRunForm({
                        ...runForm,
                        includeAssets: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span>处理附件并回写 OSS URL</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={runForm.continueOnTableError}
                    onChange={(event) =>
                      setRunForm({
                        ...runForm,
                        continueOnTableError: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span>单表失败后继续执行剩余表</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  备注
                </label>
                <input
                  type="text"
                  value={runForm.note}
                  onChange={(event) =>
                    setRunForm({
                      ...runForm,
                      note: event.target.value,
                    })
                  }
                  placeholder="例如：手动刷新首页内容"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                已选 {runForm.tables.length} 张表，实际执行顺序将根据依赖解析后生成。
              </div>

              <Button
                onClick={() => void handleSync()}
                disabled={isSubmitting || isRunning || runForm.tables.length === 0}
                className="w-full"
              >
                {isSubmitting ? '创建中...' : '同步数据'}
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">定时任务配置</h3>
            <p className="mt-1 text-sm text-gray-600">
              设置自动同步的时间计划与默认同步表。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={resetFormsFromServer}>
              恢复服务器配置
            </Button>
            <Button size="sm" onClick={() => void handleSaveConfig()} disabled={savingConfig}>
              {savingConfig ? '保存中...' : '保存调度配置'}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded border border-gray-200 px-4 py-3 text-sm">
              <span className="font-medium text-gray-800">启用定时任务</span>
              <input
                type="checkbox"
                checked={configForm.enabled}
                onChange={(event) =>
                  setConfigForm({
                    ...configForm,
                    enabled: event.target.checked,
                  })
                }
                className="h-5 w-5"
              />
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Cron 表达式
              </label>
              <input
                type="text"
                value={configForm.cron}
                onChange={(event) =>
                  setConfigForm({
                    ...configForm,
                    cron: event.target.value,
                  })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
                <p className="mt-1 text-xs text-gray-500">
                例如：`0 0 * * *` 表示每天凌晨执行一次。
              </p>
              {payload.nextRunAt && (
                <p className="mt-1 text-xs text-blue-600">
                  下次执行：{formatTime(payload.nextRunAt)}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-800">默认同步表</div>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium text-gray-800">保存依赖策略</span>
              <select
                value={configForm.dependencyMode}
                onChange={(event) =>
                  setConfigForm({
                    ...configForm,
                    dependencyMode: event.target.value as DependencyMode,
                  })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {dependencyModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-gray-500">
                保存时按所选策略自动补齐默认同步表依赖。
              </span>
            </label>
            <div className="space-y-2">
              {availableTables.map((table) => (
                <label
                  key={table.key}
                  className="flex items-start gap-3 rounded border border-gray-200 px-3 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={configForm.defaultTables.includes(table.key)}
                    onChange={() => toggleDefaultTable(table.key)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{table.label}</span>
                    <span className="block text-xs text-gray-500">
                      key: {table.key}
                      {table.dependsOn.length > 0
                        ? ` | 依赖: ${table.dependsOn.map((item) => tableLabelMap[item] || item).join('、')}`
                        : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">最近任务</h3>
            <p className="mt-1 text-sm text-gray-600">
              展示任务总体状态、每一步执行结果，以及表级 warnings / errors。
            </p>
          </div>
          <div className="text-sm text-gray-500">共 {jobs.length} 条记录</div>
        </div>

        <div className="mt-5 space-y-4">
          {jobs.length === 0 && (
            <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              暂无任务记录。
            </div>
          )}

          {jobs.map((job) => (
            <article key={job.jobId} className="rounded border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{job.jobId}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    同步任务 | 创建于 {formatTime(job.createdAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded px-2 py-1 font-medium ${getStatusBadgeClass(job.status)}`}
                  >
                    {getStatusLabel(job.status)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                <div>请求表：{formatList(job.tables.map((item) => tableLabelMap[item] || item))}</div>
                <div>
                  实际执行表：
                  {formatList(job.effectiveTables.map((item) => tableLabelMap[item] || item))}
                </div>
                <div>依赖模式：{runForm.dependencyMode === job.dependencyMode ? dependencyModeOptions.find((item) => item.value === job.dependencyMode)?.label || job.dependencyMode : dependencyModeOptions.find((item) => item.value === job.dependencyMode)?.label || job.dependencyMode}</div>
                <div>附件处理：{job.includeAssets ? '开启' : '关闭'}</div>
                <div>继续执行：{job.continueOnTableError ? '开启' : '关闭'}</div>
                <div>同步完成：{formatTime(job.syncedAt)}</div>
                <div>开始时间：{formatTime(job.startedAt)}</div>
                <div>结束时间：{formatTime(job.finishedAt)}</div>
              </div>

              {job.summary && (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="font-medium text-gray-800">任务汇总</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div>总记录：{getSummaryNumber(job.summary, 'totalRecords') ?? '-'}</div>
                    <div>成功记录：{getSummaryNumber(job.summary, 'successRecords') ?? '-'}</div>
                    <div>跳过记录：{getSummaryNumber(job.summary, 'skippedRecords') ?? '-'}</div>
                    <div>失败记录：{getSummaryNumber(job.summary, 'failedRecords') ?? '-'}</div>
                    <div>地点数：{getSummaryNumber(job.summary, 'locationCount') ?? '-'}</div>
                    <div>故事数：{getSummaryNumber(job.summary, 'storyCount') ?? '-'}</div>
                    <div>
                      创作记录数：
                      {getSummaryNumber(job.summary, 'creationIdeaCount') ?? '-'}
                    </div>
                  </div>
                  {Array.isArray(job.summary.filesWritten) && job.summary.filesWritten.length > 0 && (
                    <div className="mt-2 break-all text-xs text-gray-500">
                      输出文件：{(job.summary.filesWritten as string[]).join('、')}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-gray-800">执行步骤</div>
                <div className="space-y-2">
                  {job.steps.map((step) => (
                    <div
                      key={`${job.jobId}-${step.step}`}
                      className="rounded border border-gray-200 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{tableLabelMap[step.step] || step.step}</div>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(step.status)}`}
                        >
                          {getStatusLabel(step.status)}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
                        <div>开始：{formatTime(step.startedAt)}</div>
                        <div>结束：{formatTime(step.finishedAt)}</div>
                        {step.summary && (
                          <>
                            <div>
                              成功 / 跳过 / 失败：
                              {(getSummaryNumber(step.summary, 'successRecords') ?? 0)}
                              {' / '}
                              {(getSummaryNumber(step.summary, 'skippedRecords') ?? 0)}
                              {' / '}
                              {(getSummaryNumber(step.summary, 'failedRecords') ?? 0)}
                            </div>
                            <div>
                              总记录：{getSummaryNumber(step.summary, 'totalRecords') ?? '-'}
                            </div>
                          </>
                        )}
                      </div>

                      {Array.isArray(step.summary?.filesWritten) && step.summary.filesWritten.length > 0 && (
                        <div className="mt-2 break-all text-xs text-gray-500">
                          写入文件：{(step.summary.filesWritten as string[]).join('、')}
                        </div>
                      )}

                      {step.warnings && step.warnings.length > 0 && (
                        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          <div className="font-medium">Warnings</div>
                          <div className="mt-1 space-y-1">
                            {step.warnings.map((warning, index) => (
                              <div key={`${step.step}-warning-${index}`}>{warning}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.errors && step.errors.length > 0 && (
                        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          <div className="font-medium">Errors</div>
                          <div className="mt-1 space-y-1">
                            {step.errors.map((error, index) => (
                              <div key={`${step.step}-error-${index}`}>{error}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {job.warnings.length > 0 && (
                <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="font-medium">任务 Warnings</div>
                  <div className="mt-1 space-y-1">
                    {job.warnings.map((warning, index) => (
                      <div key={`${job.jobId}-warning-${index}`}>{warning}</div>
                    ))}
                  </div>
                </div>
              )}

              {job.errors.length > 0 && (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <div className="font-medium">任务 Errors</div>
                  <div className="mt-1 space-y-1">
                    {job.errors.map((error, index) => (
                      <div key={`${job.jobId}-error-${index}`}>{error}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  onClick={() => void toggleJobLog(job.jobId)}
                  className="text-sm text-blue-500 hover:underline"
                >
                  {loadingLog === job.jobId
                    ? '加载中...'
                    : expandedJobLog === job.jobId
                    ? '收起日志'
                    : '查看日志'}
                </button>
                {expandedJobLog === job.jobId && (
                  <pre className="mt-2 max-h-80 overflow-auto rounded border border-gray-200 bg-gray-950 p-3 text-xs text-green-300 whitespace-pre-wrap">
                    {(jobLogs[job.jobId] ?? []).length > 0
                      ? jobLogs[job.jobId].join('\n')
                      : '（暂无日志）'}
                  </pre>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
