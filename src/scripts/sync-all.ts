/**
 * 全量同步触发脚本（使用项目同步框架）
 * 直接调用 runSyncJob，绕过 undici 依赖
 */
import { runSyncJob } from '../lib/sync/orchestrator';

async function main() {
  console.log('开始全量同步...');
  const job = await runSyncJob({
    kind: 'sync-data',
    tables: ['locations', 'stories', 'creation_headers', 'creation_board', 'contributors'],
    dependencyMode: 'run_dependencies',
    includeAssets: true,
    continueOnTableError: true,
    triggeredBy: 'cli',
  });

  console.log(`任务状态: ${job.status}  jobId: ${job.jobId}`);
  if (job.summary) {
    console.log('摘要:', JSON.stringify(job.summary, null, 2));
  }
  if (job.warnings.length > 0) {
    console.log('警告:', job.warnings.join('\n  '));
  }
  if (job.errors.length > 0) {
    console.error('错误:', job.errors.join('\n  '));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
