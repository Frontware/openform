'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { FormCard } from '@/components/dashboard/form-card'
import { formClient } from '@/lib/grpc-client'
import { Form as PbForm, FormTheme } from '@/lib/proto/proto/form_pb'
import { Form as DBForm, ThemePreset } from '@/lib/database.types'

// Mapper function to convert gRPC Form to UI Form
function mapPbFormToDBForm(pbForm: PbForm): DBForm {
  // Map theme enum to string
  let theme: ThemePreset = 'weladee'
  switch (pbForm.theme) {
    case FormTheme.MINIMAL: theme = 'minimal'; break;
    case FormTheme.MIDNIGHT: theme = 'midnight'; break;
    case FormTheme.OCEAN: theme = 'ocean'; break;
    case FormTheme.SUNSET: theme = 'sunset'; break;
    case FormTheme.FOREST: theme = 'forest'; break;
    case FormTheme.LAVENDER: theme = 'lavender'; break;
    default: theme = 'weladee';
  }

  return {
    id: pbForm.id,
    user_id: pbForm.userId,
    title: pbForm.title,
    description: pbForm.description,
    slug: pbForm.id,
    status: pbForm.isPublished ? 'published' : 'draft',
    theme: theme,
    questions: [],
    thank_you_message: pbForm.customThankYouMessage,
    created_at: pbForm.createdAt?.toDate().toISOString() || new Date().toISOString(),
    updated_at: pbForm.updatedAt?.toDate().toISOString() || new Date().toISOString(),
  }
}

export function DashboardClient() {
  const locale = useLocale()
  const [forms, setForms] = useState<DBForm[]>([])
  const [loading, setLoading] = useState(true)
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map())

  const fetchForms = async () => {
    try {
      const response = await formClient.listForms({})
      const mappedForms = response.forms.map(mapPbFormToDBForm)
      setForms(mappedForms)
    } catch (error) {
      console.error('Failed to fetch forms:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchForms()
  }, [])

  const handleDeleteForm = (formId: string) => {
    // Remove the form from state immediately for better UX
    setForms(forms.filter(f => f.id !== formId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Forms</h1>
          <p className="text-slate-600 mt-1">Create and manage your forms</p>
        </div>
        <Link href={`/${locale}/forms/new`}>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5">
            <Plus className="w-4 h-4 mr-2" />
            Create Form
          </Button>
        </Link>
      </div>

      {forms.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2 border-blue-200/60 bg-gradient-to-br from-white via-blue-50/30 to-sky-50/30">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <FileText className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Create your first form</h2>
          <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
            Build beautiful, engaging forms that people actually want to fill out. One question at a time.
          </p>
          <Link href={`/${locale}/forms/new`}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/35 hover:-translate-y-0.5">
              <Plus className="w-5 h-5 mr-2" />
              Create your first form
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              responseCount={responseCounts.get(form.id) || 0}
              onDelete={handleDeleteForm}
            />
          ))}
        </div>
      )}
    </div>
  )
}
