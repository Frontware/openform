'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setToken, parseJWT } from '@/lib/auth/weladee';

export function TokenHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    console.log('[TokenHandler] Token from URL:', token ? 'present' : 'missing');

    if (token) {
      // Store the token in both localStorage and cookie
      setToken(token);
      console.log('[TokenHandler] Token stored to localStorage');

      // Parse JWT to get language preference
      const user = parseJWT(token);
      let targetLocale = 'en'; // Default language

      if (user && user.language && ['en', 'fr', 'th'].includes(user.language)) {
        targetLocale = user.language;
        console.log('[TokenHandler] Language from JWT:', targetLocale);
      } else {
        console.log('[TokenHandler] No valid language in JWT, using default: en');
      }

      console.log('[TokenHandler] Redirecting to:', `/${targetLocale}/dashboard`);
      // Use window.location for redirect instead of Next.js router (works better with static export)
      window.location.href = `/${targetLocale}/dashboard`;
    } else {
      console.log('[TokenHandler] Checking localStorage for existing token...');
      const storedToken = localStorage.getItem('weladee_token');
      console.log('[TokenHandler] Token from localStorage:', storedToken ? 'present' : 'missing');
    }
  }, [searchParams]);

  return null;
}
