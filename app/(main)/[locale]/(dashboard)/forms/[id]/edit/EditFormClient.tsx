'use client'

import { useEffect, useState, useRef } from 'react'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import { FormBuilder } from '@/components/form-builder/form-builder'
import { Form, QuestionConfig } from '@/lib/database.types'
import { formClient } from '@/lib/grpc-client'
import { Form as PbForm, Question as PbQuestion, QuestionType, FormTheme } from '@/lib/proto/proto/form_pb'
import { Loader2 } from 'lucide-react'
import { getToken } from '@/lib/auth/weladee'

// Map Proto Question Type to UI Question Type
function mapPbQuestionType(type: QuestionType): QuestionConfig['type'] {
  switch (type) {
    case QuestionType.SHORT_TEXT: return 'short_text'
    case QuestionType.LONG_TEXT: return 'long_text'
    case QuestionType.DROPDOWN: return 'dropdown'
    case QuestionType.CHECKBOXES: return 'checkboxes'
    case QuestionType.EMAIL: return 'email'
    case QuestionType.PHONE: return 'phone'
    case QuestionType.NUMBER: return 'number'
    case QuestionType.DATE: return 'date'
    case QuestionType.RATING: return 'rating'
    case QuestionType.OPINION_SCALE: return 'opinion_scale'
    case QuestionType.YES_NO: return 'yes_no'
    case QuestionType.FILE_UPLOAD: return 'file_upload'
    case QuestionType.URL: return 'url'
    case QuestionType.MATRIX: return 'matrix'
    case QuestionType.RANKING: return 'ranking'
    default: return 'short_text'
  }
}

function mapPbQuestionToConfig(pbQ: PbQuestion): QuestionConfig {
  const optionsStruct = pbQ.options?.fields || {}
  const validationStruct = pbQ.validationRules?.fields || {}
  const questionType = mapPbQuestionType(pbQ.type)

  // Extract options array if present (for dropdown/checkboxes)
  let options: string[] = []
  if (optionsStruct['items']?.kind.case === 'listValue') {
    options = optionsStruct['items'].kind.value.values.map(v =>
      v.kind.case === 'stringValue' ? v.kind.value : ''
    )
  }

  // Extract ranking_items for ranking questions
  let rankingItems: string[] = []
  if (optionsStruct['ranking_items']?.kind.case === 'listValue') {
    rankingItems = optionsStruct['ranking_items'].kind.value.values.map(v =>
      v.kind.case === 'stringValue' ? v.kind.value : ''
    )
  }

  // Extract rows for matrix questions
  let rows: string[] = []
  if (optionsStruct['rows']?.kind.case === 'listValue') {
    rows = optionsStruct['rows'].kind.value.values.map(v =>
      v.kind.case === 'stringValue' ? v.kind.value : ''
    )
  }

  // Extract columns for matrix questions
  let columns: string[] = []
  if (optionsStruct['columns']?.kind.case === 'listValue') {
    columns = optionsStruct['columns'].kind.value.values.map(v =>
      v.kind.case === 'stringValue' ? v.kind.value : ''
    )
  }

  const config: QuestionConfig = {
    id: pbQ.id,
    type: questionType,
    title: pbQ.label,
    description: pbQ.description,
    required: pbQ.required,
    placeholder: pbQ.placeholder,
    options: options.length > 0 ? options : undefined,
    minValue: validationStruct['minValue']?.kind.case === 'numberValue' ? validationStruct['minValue'].kind.value : undefined,
    maxValue: validationStruct['maxValue']?.kind.case === 'numberValue' ? validationStruct['maxValue'].kind.value : undefined,
    maxFileSize: validationStruct['maxFileSize']?.kind.case === 'numberValue' ? validationStruct['maxFileSize'].kind.value : undefined,
  }

  // Add ranking-specific properties
  if (questionType === 'ranking' && rankingItems.length > 0) {
    config.items = rankingItems
  }
  if (validationStruct['min_selections']?.kind.case === 'numberValue') {
    config.min_selections = validationStruct['min_selections'].kind.value
  }
  if (validationStruct['max_selections']?.kind.case === 'numberValue') {
    config.max_selections = validationStruct['max_selections'].kind.value
  }
  if (validationStruct['shuffle_items']?.kind.case === 'boolValue') {
    config.shuffle_items = validationStruct['shuffle_items'].kind.value
  }

  // Add matrix-specific properties
  if (questionType === 'matrix') {
    if (rows.length > 0) config.rows = rows
    if (columns.length > 0) config.columns = columns
  }
  if (validationStruct['input_type']?.kind.case === 'stringValue') {
    config.input_type = validationStruct['input_type'].kind.value as 'radio' | 'checkbox'
  }
  if (validationStruct['allow_multiple_per_row']?.kind.case === 'boolValue') {
    config.allow_multiple_per_row = validationStruct['allow_multiple_per_row'].kind.value
  }

  return config
}

function mapPbFormToDBForm(pbForm: PbForm): Form {
    let theme: any = 'weladee'
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
    slug: pbForm.id,
    status: pbForm.isPublished ? 'published' : 'draft',
    theme: theme,
    questions: pbForm.questions.map(mapPbQuestionToConfig),
    thank_you_message: pbForm.customThankYouMessage,
    force_captcha: pbForm.forceCaptcha,
    progress_bar_style: progress_bar_style,
    allow_multiple_submissions: pbForm.allowMultipleSubmissions,
    email_notification_mode: (pbForm.emailNotificationMode || 'never') as 'never' | 'immediate' | 'daily',
    created_at: pbForm.createdAt?.toDate().toISOString() || '',
    updated_at: pbForm.updatedAt?.toDate().toISOString() || '',
  }
}

export function EditFormClient({ id: propId }: { id?: string } = {}) {
  const params = useParams()
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)

  // Use ref to maintain stable object reference for FormBuilder
  // This prevents unnecessary remounts when EditFormClient re-renders
  const formRef = useRef<Form | null>(null)

  // Extract form ID from window.location as the primary source of truth
  // This works with static export where useParams may return build-time values
  const getFormIdFromUrl = (): string => {
    if (typeof window === 'undefined') return propId || (params.id as string) || ''
    const pathname = window.location.pathname
    // Match pattern: /:locale/forms/:id/edit
    const match = pathname.match(/\/[a-z]{2}\/forms\/([a-f0-9-]+)\/edit/)
    if (match && match[1]) {
      return match[1]
    }
    return propId || (params.id as string) || ''
  }

  const id = getFormIdFromUrl()

  useEffect(() => {
    async function load() {
      const token = getToken()

      try {
        const response = await formClient.getForm({
          id,
          includeQuestions: true
        })

        if (response.form) {
            setForm(mapPbFormToDBForm(response.form))
        }
      } catch (error) {
        console.error('[EditFormClient] Failed to load form:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )
  }

  if (!form) return <div>Form not found</div>

  // Use ref to maintain stable object reference for FormBuilder
  // This prevents unnecessary remounts when EditFormClient re-renders
  if (formRef.current?.id !== form.id) {
    formRef.current = form
  }

  return <FormBuilder form={formRef.current!} />
}
