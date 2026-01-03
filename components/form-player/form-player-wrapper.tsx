'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { formClient } from '@/lib/grpc-client'
import { Form } from '@/lib/database.types'
import { Form as PbForm, FormTheme, QuestionType, Question as PbQuestion } from '@/lib/proto/proto/form_pb'
import { FormPlayer } from './form-player'
import { QuestionConfig } from '@/lib/database.types'

// Reusing mappers (should move to utils)
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
    default: return 'short_text'
  }
}

function mapPbQuestionToConfig(pbQ: PbQuestion): QuestionConfig {
  const optionsStruct = pbQ.options?.fields || {}
  
  let options: string[] = []
  if (optionsStruct['items']?.kind.case === 'listValue') {
    options = optionsStruct['items'].kind.value.values.map(v => 
      v.kind.case === 'stringValue' ? v.kind.value : ''
    )
  }

  return {
    id: pbQ.id,
    type: mapPbQuestionType(pbQ.type),
    title: pbQ.label,
    description: pbQ.description,
    required: pbQ.required,
    placeholder: pbQ.placeholder,
    options: options,
  }
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
    created_at: pbForm.createdAt?.toDate().toISOString() || '',
    updated_at: pbForm.updatedAt?.toDate().toISOString() || '',
  }
}

export function FormPlayerWrapper({ slug: serverSlug }: { slug: string }) {
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        // For static exports, read the actual slug from the browser URL
        // The serverSlug prop is just a placeholder from the static build
        const actualSlug = typeof window !== 'undefined'
          ? window.location.pathname.split('/').pop() || serverSlug
          : serverSlug

        console.log('[FormPlayerWrapper] Loading form with slug:', actualSlug)

        // Use getFormBySlug for public form access (no auth required)
        const response = await formClient.getFormBySlug({ slug: actualSlug })
        if (response.form) {
            setForm(mapPbFormToDBForm(response.form))
        } else {
            setError(true)
        }
      } catch (err) {
        console.error('Failed to load form:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [serverSlug])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Form not found</h1>
        <p className="text-slate-600">The form you are looking for does not exist or has been removed.</p>
      </div>
    )
  }

  return <FormPlayer form={form} />
}
