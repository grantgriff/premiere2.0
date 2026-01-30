import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Temporarily disabled middleware for debugging auth
// TODO: Re-enable auth protection after auth is working
export async function middleware(request: NextRequest) {
  // Allow all requests through for now
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
