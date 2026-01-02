'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function TokenHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Validate the token before storing
      validateToken(token)
        .then(isValid => {
          if (isValid) {
            // Store the token
            localStorage.setItem('weladee_token', token);
            
            // Clean up the URL by removing the token
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('token');
            
            const newPath = newParams.toString() 
              ? `${window.location.pathname}?${newParams.toString()}`
              : window.location.pathname;
            
            router.replace('/dashboard');
          } else {
            // Redirect to error page if token is invalid
            router.replace('/auth/error?error=invalid');
          }
        })
        .catch(() => {
          // Redirect to error page if validation fails
          router.replace('/auth/error?error=server');
        });
    }
  }, [searchParams, router]);

  return null;
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/validate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();
    return result.valid;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}
