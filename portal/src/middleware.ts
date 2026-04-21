import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth';

export default auth((req) => {
  const isAuthed = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/dashboard')
    || pathname.startsWith('/onboarding')
    || pathname.startsWith('/applications')
    || pathname.startsWith('/settings')
    || pathname.startsWith('/stats');

  if (isProtected && !isAuthed) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png).*)'],
};
