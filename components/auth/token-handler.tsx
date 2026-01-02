'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth/weladee';

export function TokenHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Store the token in both localStorage and cookie
      setToken(token);

      // Get current locale from URL path
      const pathLocale = window.location.pathname.split('/')[1];
      const locale = ['en', 'fr', 'th'].includes(pathLocale) ? pathLocale : 'en';

      // Redirect to dashboard with locale
      router.replace(`/${locale}/dashboard`);
    }
  }, [searchParams, router]);

  return null;
}
