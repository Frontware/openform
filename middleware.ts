import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run next-intl middleware to handle locale routing (redirects/rewrites)
  const response = intlMiddleware(request);

  // 2. Pass the response to Supabase middleware to handle session/auth
  // This allows Supabase to set cookies on the response created by next-intl
  return await updateSession(request, response);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    // - … public form pages (/f/...)
    '/((?!api|_next|_vercel|f/|.*\\..*).*)',
  ],
};