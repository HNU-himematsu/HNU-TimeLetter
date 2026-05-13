import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin/auth';
import {
  AnnouncementConfigValidationError,
  getAnnouncementConfig,
  updateAnnouncementConfig,
} from '@/lib/admin/announcement-config';
import type { AnnouncementConfig } from '@/lib/admin/announcement-config';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  return NextResponse.json(getAnnouncementConfig(), { headers: noStoreHeaders });
}

export async function PATCH(request: Request) {
  const isAuth = await checkAuth();
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const body = (await request.json()) as Partial<AnnouncementConfig>;
    const updated = updateAnnouncementConfig(body);
    return NextResponse.json(updated, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof AnnouncementConfigValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400, headers: noStoreHeaders });
    }
    return NextResponse.json({ message: 'Server error' }, { status: 500, headers: noStoreHeaders });
  }
}
