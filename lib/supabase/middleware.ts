import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest, response?: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are not set, just continue without auth
  if (!supabaseUrl || !supabaseAnonKey) {
    return response || NextResponse.next({ request })
  }

  let supabaseResponse = response || NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define protected routes
  const protectedRoutes = ['/dashboard', '/forms']
  const path = request.nextUrl.pathname
  
  // Remove locale prefix (en, th, fr) to get internal path
  // Matches /en, /en/, /en/path, /path
  const internalPath = path.replace(/^\/(?:en|th|fr)(?:\/|$)/, '/')

  const isProtectedRoute = protectedRoutes.some(route => 
    internalPath === route || internalPath.startsWith(`${route}/`)
  )

  // Redirect to login if accessing protected route without auth
  /* MIGRATION: Bypassing Supabase Auth
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    // Keep the locale if present, or default to en?
    // If we are at /fr/dashboard, we want to go to /fr/login
    // But modifying pathname directly replaces everything.
    // simpler: construct new URL based on current locale
    
    const localeMatch = path.match(/^\/(en|th|fr)/)
    const locale = localeMatch ? localeMatch[0] : ''
    
    url.pathname = `${locale}/login`
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }
  */

  // Redirect to dashboard if already logged in and accessing login page
  // /login or /en/login -> /en/dashboard
  if ((internalPath === '/login' || internalPath === '/login/') && user) {
    const url = request.nextUrl.clone()
    
    const localeMatch = path.match(/^\/(en|th|fr)/)
    const locale = localeMatch ? localeMatch[0] : ''
    
    url.pathname = `${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

