import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication (without locale prefix)
const PROTECTED_ROUTES = ['/dashboard', '/forms', '/settings']

// Public routes that don't require auth
const PUBLIC_ROUTES = ['/', '/f']

// Supported locales
const LOCALES = ['en', 'fr', 'th']

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

  // Extract locale from pathname if present
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/)
  const locale = localeMatch ? localeMatch[1] : null
  const pathWithoutLocale = locale ? pathname.substring(3) || '/' : pathname

  // Check if accessing a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathWithoutLocale === route || pathWithoutLocale.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if accessing a protected route (handle locale prefix)
  const isProtectedRoute = PROTECTED_ROUTES.some(route => {
    return pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`)
  })

  if (isProtectedRoute) {
    // Check for token in cookie
    const token = request.cookies.get('weladee_token')

    if (!token) {
      // No token - redirect to home with same locale
      const redirectLocale = locale || 'en' // default to 'en'
      const url = new URL(`/${redirectLocale}`, request.url)
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
