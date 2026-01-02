'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export function SettingsClient() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // In the new architecture, user info might come from the token or a profile gRPC call
    // For now, we'll try to get it from what we have or mock it if unavailable
    const token = localStorage.getItem('weladee_token')
    if (!token) {
      router.replace('/')
      return
    }

    // Mock user for now since we don't have a getProfile RPC yet
    // In a real app, you'd call an RPC here
    setUser({
      email: 'eric.fairon@gmail.com',
      created_at: new Date().toISOString(),
      user_metadata: {
        full_name: 'Eric Fairon'
      }
    })
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings</p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={user?.email || ''} 
              disabled 
              className="mt-2 bg-gray-50"
            />
            <p className="text-sm text-gray-500 mt-1">
              Your email cannot be changed
            </p>
          </div>

          {user?.user_metadata?.full_name && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                value={user.user_metadata.full_name} 
                disabled 
                className="mt-2 bg-gray-50"
              />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold mb-2">Account created</h2>
        <p className="text-gray-600">
          {user ? new Date(user.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }) : ''}
        </p>
      </Card>
    </div>
  )
}
