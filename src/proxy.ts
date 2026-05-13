import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminCookieName, verifySessionToken } from '@/lib/admin/session';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (
      request.nextUrl.pathname === '/admin/login'
      || request.nextUrl.pathname.startsWith('/api/admin/login')
    ) {
      return NextResponse.next();
    }

    const authCookie = request.cookies.get(getAdminCookieName());
    const isAuthenticated = await verifySessionToken(authCookie?.value);

    if (!isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
