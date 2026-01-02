'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function TokenHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Store the token
      localStorage.setItem('weladee_token', token);
      
      // Clean up the URL by removing the token
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('token');
      
      const newPath = newParams.toString() 
        ? `${window.location.pathname}?${newParams.toString()}`
        : window.location.pathname; // Redirect to dashboard if on home? 
                                    // For now, just clean URL, but user might want auto-redirect.
                                    // The prompt said "Redirect the user to /dashboard".
      
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  return null;
}
