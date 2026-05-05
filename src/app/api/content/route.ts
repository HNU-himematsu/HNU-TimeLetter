import { NextResponse } from 'next/server';
import { getContentData } from '@/lib/server/content-files';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getContentData(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
