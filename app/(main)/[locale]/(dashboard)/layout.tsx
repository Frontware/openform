'use client'

import { DashboardNav } from '@/components/dashboard/nav'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, parseJWT, WeladeeUser } from '@/lib/auth/weladee'

interface User {
  id: string
  email?: string
  user_metadata?: {
    avatar_url?: string
    full_name?: string
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      // No token - redirect to home
      router.replace('/')
      return
    }

    // Parse JWT to get user info
    const claims: WeladeeUser | null = parseJWT(token)
    if (!claims) {
      // Invalid token - clear and redirect
      localStorage.removeItem('weladee_token')
      router.replace('/')
      return
    }

    // Set user from JWT claims
    setUser({
      id: String(claims.userId),
      email: claims.email,
      user_metadata: {
        full_name: claims.displayName,
        avatar_url: '',
      }
    })
    setIsLoading(false)
  }, [router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Sophisticated gradient background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.06) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 100% 50%, rgba(59, 130, 246, 0.04) 0%, transparent 50%), linear-gradient(to bottom, #f8faff 0%, #fafbff 100%)',
        }}
      />
      <DashboardNav user={user} />
      <main className="relative z-10 pt-16">
        {children}
      </main>
    </div>
  )
}