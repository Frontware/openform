'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth/weladee';

export function TokenHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Store the token in both localStorage and cookie
      setToken(token);

      // Get current locale from URL path
      const pathLocale = window.location.pathname.split('/')[1];
      const locale = ['en', 'fr', 'th'].includes(pathLocale) ? pathLocale : 'en';

      // Use window.location for redirect instead of Next.js router (works better with static export)
      window.location.href = `/${locale}/dashboard`;
    }
  }, [searchParams]);

  return null;
}
