'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth/weladee';

export function TokenHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    console.log('[TokenHandler] Token from URL:', token ? 'present' : 'missing');

    if (token) {
      // Store the token in both localStorage and cookie
      setToken(token);
      console.log('[TokenHandler] Token stored to localStorage');

      // Get current locale from URL path
      const pathLocale = window.location.pathname.split('/')[1];
      const locale = ['en', 'fr', 'th'].includes(pathLocale) ? pathLocale : 'en';

      console.log('[TokenHandler] Redirecting to:', `/${locale}/dashboard`);
      // Use window.location for redirect instead of Next.js router (works better with static export)
      window.location.href = `/${locale}/dashboard`;
    } else {
      console.log('[TokenHandler] Checking localStorage for existing token...');
      const storedToken = localStorage.getItem('weladee_token');
      console.log('[TokenHandler] Token from localStorage:', storedToken ? 'present' : 'missing');
    }
  }, [searchParams]);

  return null;
}
