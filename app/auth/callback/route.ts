import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // For username-only auth, we don't need to exchange codes
    // Just redirect to home
    // The callback route is kept for compatibility but doesn't do anything
  }

  return NextResponse.redirect(new URL('/stats', requestUrl.origin));
}

