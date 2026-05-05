import { NextResponse } from 'next/server';
import { getContributorsData } from '@/lib/server/content-files';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getContributorsData(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
