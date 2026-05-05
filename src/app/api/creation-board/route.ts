import { NextResponse } from 'next/server';
import { getCreationBoardData } from '@/lib/server/content-files';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getCreationBoardData(), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
