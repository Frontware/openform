import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication (without locale prefix)
const PROTECTED_ROUTES = ['/dashboard', '/forms', '/settings']

// Public routes that don't require auth
const PUBLIC_ROUTES = ['/', '/f']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static files, etc.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if accessing a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if accessing a protected route (handle locale prefix)
  const isProtectedRoute = PROTECTED_ROUTES.some(route => {
    // Check with and without locale prefix (e.g., /dashboard or /en/dashboard)
    return pathname === route ||
           pathname.startsWith(`${route}/`) ||
           pathname.match(/^\/[a-z]{2}(\/)${route}/) // Matches /en/dashboard, /fr/dashboard, etc.
  })

  if (isProtectedRoute) {
    // Check for token in cookie
    const token = request.cookies.get('weladee_token')

    if (!token) {
      // No token - redirect to home with a hint
      const url = new URL('/', request.url)
      url.searchParams.set('auth', 'required')
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except for
    // - API routes
    // - _next/static
    // - _next/image
    // - favicon.ico
    // - public files
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
}
