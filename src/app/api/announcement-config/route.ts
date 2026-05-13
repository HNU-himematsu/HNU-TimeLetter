import { NextResponse } from 'next/server';
import { getAnnouncementConfig } from '@/lib/admin/announcement-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/announcement-config
 *
 * 公开接口，返回活动公告弹窗配置（docUrl + featureConfig）。
 * 由前端 FeishuDocModal 在每次弹窗打开时调用，无需鉴权。
 */
export async function GET() {
  return NextResponse.json(getAnnouncementConfig(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
