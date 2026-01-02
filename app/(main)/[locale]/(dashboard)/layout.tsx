'use client'

import { DashboardNav } from '@/components/dashboard/nav'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('weladee_token')
    if (!token) {
      // For now, redirect to landing if no token
      // router.replace('/')
    }
    // Mock user
    setUser({
      email: 'eric.fairon@gmail.com',
      user_metadata: {
        full_name: 'Eric Fairon',
        avatar_url: ''
      }
    })
  }, [router])

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