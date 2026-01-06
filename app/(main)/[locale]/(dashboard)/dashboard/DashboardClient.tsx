'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { FormCard } from '@/components/dashboard/form-card'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { formClient } from '@/lib/grpc-client'
import { Form as PbForm, FormTheme, FormSortBy, FormSortOrder, FormStatusFilter } from '@/lib/proto/proto/form_pb'
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

  // Map progress bar style enum to string
  let progress_bar_style: 'none' | 'linear' | 'steps' | 'circular' = 'none'
  switch (pbForm.progressBarStyle) {
    case 1: progress_bar_style = 'none'; break
    case 2: progress_bar_style = 'linear'; break
    case 3: progress_bar_style = 'steps'; break
    case 4: progress_bar_style = 'circular'; break
    default: progress_bar_style = 'none';
  }

  return {
    id: pbForm.id,
    user_id: pbForm.userId,
    title: pbForm.title,
    description: pbForm.description,
    slug: pbForm.id,  // Use form ID as slug for now (friendly URLs can be added later)
    status: pbForm.isPublished ? 'published' : 'draft',
    theme: theme,
    questions: [],
    thank_you_message: pbForm.customThankYouMessage,
    force_captcha: pbForm.forceCaptcha,
    progress_bar_style: progress_bar_style,
    allow_multiple_submissions: pbForm.allowMultipleSubmissions,
    created_at: pbForm.createdAt?.toDate().toISOString() || new Date().toISOString(),
    updated_at: pbForm.updatedAt?.toDate().toISOString() || new Date().toISOString(),
  }
}

export function DashboardClient() {
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const [forms, setForms] = useState<DBForm[]>([])
  const [loading, setLoading] = useState(true)
  const [totalFormsCount, setTotalFormsCount] = useState(0)
  const [responseCounts, setResponseCounts] = useState<Map<string, number>>(new Map())

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'closed'>('all')
  const [sortBy, setSortBy] = useState('updated_at_desc')

  const fetchForms = useCallback(async () => {
    try {
      // Map frontend values to proto enums
      let statusFilterEnum: FormStatusFilter | undefined
      switch (statusFilter) {
        case 'draft':
          statusFilterEnum = FormStatusFilter.DRAFT
          break
        case 'published':
          statusFilterEnum = FormStatusFilter.PUBLISHED
          break
        case 'closed':
          statusFilterEnum = FormStatusFilter.CLOSED
          break
        default: // 'all'
          statusFilterEnum = undefined
      }

      // Map sort string to proto enums
      let sortByEnum: FormSortBy | undefined
      let sortOrderEnum: FormSortOrder | undefined
      if (sortBy) {
        const [field, order] = sortBy.split('_')
        switch (field) {
          case 'updated_at':
            sortByEnum = FormSortBy.UPDATED_AT
            break
          case 'created_at':
            sortByEnum = FormSortBy.CREATED_AT
            break
          case 'title':
            sortByEnum = FormSortBy.TITLE
            break
          case 'response_count':
            sortByEnum = FormSortBy.RESPONSE_COUNT
            break
        }
        sortOrderEnum = order === 'asc' ? FormSortOrder.ASC : FormSortOrder.DESC
      }

      const response = await formClient.listForms({
        searchQuery: searchQuery || undefined,
        statusFilter: statusFilterEnum,
        sortBy: sortByEnum,
        sortOrder: sortOrderEnum,
      })
      const mappedForms = response.forms.map(mapPbFormToDBForm)
      setForms(mappedForms)
      setTotalFormsCount(Number(response.pagination?.total || 0))

      // Fetch response counts for each form
      const countsMap = new Map<string, number>()
      await Promise.all(
        mappedForms.map(async (form) => {
          try {
            const statsRes = await formClient.getFormStats({ formId: form.id })
            countsMap.set(form.id, Number(statsRes.stats?.totalResponses || 0))
          } catch (error) {
            console.error(`Failed to fetch stats for form ${form.id}:`, error)
            countsMap.set(form.id, 0)
          }
        })
      )
      setResponseCounts(countsMap)
    } catch (error) {
      console.error('Failed to fetch forms:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, sortBy])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  const handleDeleteForm = (formId: string) => {
    // Remove the form from state immediately for better UX
    setForms(forms.filter(f => f.id !== formId))
    setTotalFormsCount(prev => Math.max(0, prev - 1))
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
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-slate-600 mt-1">{t('subtitle')}</p>
        </div>
        <Link href="/forms/new">
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5">
            <Plus className="w-4 h-4 mr-2" />
            {t('createFirst.button')}
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultCount={forms.length}
        totalFormsCount={totalFormsCount}
      />

      {forms.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2 border-blue-200/60 bg-gradient-to-br from-white via-blue-50/30 to-sky-50/30">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <FileText className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{t('createFirst.title')}</h2>
          <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
            {t('createFirst.description')}
          </p>
          <Link href="/forms/new">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/35 hover:-translate-y-0.5">
              <Plus className="w-5 h-5 mr-2" />
              {t('createFirst.button')}
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
