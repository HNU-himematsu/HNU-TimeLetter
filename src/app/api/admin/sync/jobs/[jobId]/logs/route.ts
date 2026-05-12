import * as fs from 'fs';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin/auth';
import { getJob } from '@/lib/sync/job-store';
import { getJobLogPath } from '@/lib/sync/paths';

const MAX_LOG_LINES = 200;

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await context.params;

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const logPath = getJobLogPath(jobId);

  if (!fs.existsSync(logPath)) {
    return NextResponse.json({ lines: [], total: 0 });
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const all = content.split('\n').filter(Boolean);
    const lines = all.slice(-MAX_LOG_LINES);
    return NextResponse.json({ lines, total: all.length });
  } catch {
    return NextResponse.json({ message: 'Failed to read log file' }, { status: 500 });
  }
}
