'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  MoreVertical, 
  ExternalLink,
  BarChart3,
  Pencil,
  Copy,
  LineChart,
  Share2
} from 'lucide-react'
import { Form, FormStatus } from '@/lib/database.types'
import { DeleteFormButton } from './delete-form-button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'


interface FormCardProps {
  form: Form
  responseCount: number
  onDelete?: (formId: string) => void
}

function getStatusBadge(status: FormStatus) {
  switch (status) {
    case 'published':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Published</Badge>
    case 'draft':
      return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Draft</Badge>
    case 'closed':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Closed</Badge>
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function getStatusColor(status: FormStatus) {
  switch (status) {
    case 'published':
      return 'from-emerald-400 to-teal-500'
    case 'draft':
      return 'from-slate-300 to-slate-400'
    case 'closed':
      return 'from-amber-400 to-orange-500'
  }
}

export function FormCard({ form, responseCount, onDelete }: FormCardProps) {
  const locale = useLocale()
  const isDraftForm = form.status === 'draft'
  
  const copyFormLink = () => {
    if (isDraftForm) {
      return
    }
    const link = `${window.location.origin}/f/${form.slug}`
    navigator.clipboard.writeText(link)
    toast.success('Link copied to clipboard')
  }

  const shareFormLink = async () => {
    if (isDraftForm) return

    const link = `${window.location.origin}/f/${form.slug}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: form.title,
          text: form.description || 'Check out this form',
          url: link,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err)
        }
      }
    } else {
      copyFormLink()
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-0.5 bg-white/80 backdrop-blur-sm border-slate-200/60">
      {/* Color accent bar */}
      <div className={`h-1 bg-gradient-to-r ${getStatusColor(form.status)}`} />
      <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <Link 
            href={`/${locale}/forms/${form.id}/edit`}
            className="text-lg font-semibold text-slate-900 hover:text-blue-600 truncate block transition-colors"
          >
            {form.title || 'Untitled Form'}
          </Link>
          <p className="text-sm text-slate-500 mt-1">
            Updated {formatDate(form.updated_at)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/forms/${form.id}/edit`} className="cursor-pointer">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            {form.status === 'published' && (
              <DropdownMenuItem asChild>
                <Link href={`/f/${form.slug}`} target="_blank" className="cursor-pointer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View form
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              asChild
              disabled={isDraftForm}
              className={cn(
                isDraftForm && 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <Link href={`/${locale}/forms/${form.id}/responses`} className={cn(
                'cursor-pointer',
                isDraftForm && 'pointer-events-none'
              )}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Responses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              asChild
              disabled={isDraftForm}
              className={cn(
                isDraftForm && 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <Link href={`/${locale}/forms/${form.id}/analytics`} className={cn(
                'cursor-pointer',
                isDraftForm && 'pointer-events-none'
              )}>
                <LineChart className="mr-2 h-4 w-4" />
                Stats
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={isDraftForm ? undefined : copyFormLink}
              disabled={isDraftForm}
              className={cn(
                'cursor-pointer',
                isDraftForm && 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={isDraftForm ? undefined : shareFormLink}
              disabled={isDraftForm}
              className={cn(
                'cursor-pointer',
                isDraftForm && 'opacity-50 cursor-not-allowed text-gray-400'
              )}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DeleteFormButton formId={form.id} formTitle={form.title} onDelete={onDelete} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between">
        {getStatusBadge(form.status)}
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Link href={`/${locale}/forms/${form.id}/responses`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>{responseCount} responses</span>
          </Link>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
        <Link href={`/${locale}/forms/${form.id}/edit`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors">
            <Pencil className="w-3 h-3 mr-2" />
            Edit
          </Button>
        </Link>
        <div className="flex-1">
          {isDraftForm ? (
            <Button 
              variant="outline" 
              size="sm" 
              disabled
              className="w-full opacity-50 cursor-not-allowed text-gray-400"
            >
              <BarChart3 className="w-3 h-3 mr-2" />
              Responses
            </Button>
          ) : (
            <Link href={`/${locale}/forms/${form.id}/responses`} className="block">
              <Button variant="outline" size="sm" className="w-full hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 transition-colors">
                <BarChart3 className="w-3 h-3 mr-2" />
                Responses
              </Button>
            </Link>
          )}
        </div>
        <div className="flex-1">
          {isDraftForm ? (
            <Button 
              variant="outline" 
              size="sm" 
              disabled
              className="w-full opacity-50 cursor-not-allowed text-gray-400"
            >
              <LineChart className="w-3 h-3 mr-2" />
              Stats
            </Button>
          ) : (
            <Link href={`/${locale}/forms/${form.id}/analytics`} className="block">
              <Button variant="outline" size="sm" className="w-full hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors">
                <LineChart className="w-3 h-3 mr-2" />
                Stats
              </Button>
            </Link>
          )}
        </div>
      </div>
      </div>
    </Card>
  )
}
