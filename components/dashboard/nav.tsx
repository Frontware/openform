'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { toast } from 'sonner'
import { signOut as authSignOut } from '@/lib/auth/weladee'

// TODO: Replace with Go backend user type
interface User {
  id: string
  email?: string
  user_metadata?: {
    avatar_url?: string
    full_name?: string
  }
}

interface DashboardNavProps {
  user: User | null
}

export function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter()
  const locale = useLocale()

  const handleSignOut = async () => {
    authSignOut()
    toast.success('Signed out successfully')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U'
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo href={`/${locale}/dashboard`} />
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href={`/${locale}/dashboard`}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              My Forms
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href={`/${locale}/forms/new`}>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5">
              Create Form
            </Button>
          </Link>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatarUrl} alt={user.email || 'User'} />
                    <AvatarFallback className="bg-blue-600 text-white font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.user_metadata?.full_name && (
                      <p className="font-medium">{user.user_metadata.full_name}</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/dashboard`} className="cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4" />
                    My Forms
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/settings`} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-1 py-1">
                  <LanguageSwitcher />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  )
}
