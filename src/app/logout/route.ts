
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logoutAction } from '@/app/actions/authActions';

export async function GET(request: NextRequest) {
  await logoutAction();
  
  // Redirect to the login page after logging out
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}
