// Copyright (c) 2025 Frontware International Co.,Ltd.
// All rights reserved.

'use client'

import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardButtonProps {
  className?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'lg'
  children: React.ReactNode
}

const TOKEN_KEY = 'weladee_form_token'

export function DashboardButton({
  className,
  variant = 'default',
  size = 'default',
  children,
}: DashboardButtonProps) {
  const [hasToken, setHasToken] = useState<boolean | null>(null)

  useEffect(() => {
    // Check for token in localStorage
    const localToken = localStorage.getItem(TOKEN_KEY)
    if (localToken) {
      setHasToken(true)
      return
    }

    // Check for token in cookies
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === TOKEN_KEY && value) {
        setHasToken(true)
        return
      }
    }

    setHasToken(false)
  }, [])

  // While checking, render disabled button
  if (hasToken === null) {
    return (
      <Button
        className={className}
        variant={variant}
        size={size}
        disabled
      >
        {children}
      </Button>
    )
  }

  // Has token - navigate to dashboard (will be relative link)
  if (hasToken) {
    return (
      <Link href="/dashboard">
        <Button
          className={className}
          variant={variant}
          size={size}
        >
          {children}
        </Button>
      </Link>
    )
  }

  // No token - redirect to Weladee based on build-time env var
  const weladeeBaseUrl = process.env.NEXT_PUBLIC_WELADEE_BASE_URL || 'https://weladee.com'
  const redirectUrl = `${weladeeBaseUrl}/weladeeform`

  return (
    <a href={redirectUrl}>
      <Button
        className={className}
        variant={variant}
        size={size}
      >
        {children}
      </Button>
    </a>
  )
}
