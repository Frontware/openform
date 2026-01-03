'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { setToken, getToken } from '@/lib/auth/weladee'

/**
 * AuthProvider component that extracts the JWT token from URL parameters
 * and stores it in localStorage/cookies for use in gRPC requests.
 *
 * This allows authentication via URL: http://localhost:50051/?token=eyJ...
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if token is already stored
    const existingToken = getToken()
    if (existingToken) {
      console.log('[AuthProvider] Token already exists in storage')
      return
    }

    // Extract token from URL parameters
    const token = searchParams.get('token')
    if (token) {
      console.log('[AuthProvider] Found token in URL, storing it...')
      setToken(token)
      console.log('[AuthProvider] Token stored successfully')

      // Clean up the URL by removing the token parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.toString())
      console.log('[AuthProvider] Token removed from URL')
    } else {
      console.log('[AuthProvider] No token found in URL')
    }
  }, [searchParams])

  return <>{children}</>
}
