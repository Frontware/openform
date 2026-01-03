'use client'

import { useEffect, useState } from 'react'
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
    default: return 'short_text'
  }
}

function mapPbQuestionToConfig(pbQ: PbQuestion): QuestionConfig {
  const optionsStruct = pbQ.options?.fields || {}
  const validationStruct = pbQ.validationRules?.fields || {}
  
  // Extract options array if present
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
    minValue: validationStruct['minValue']?.kind.case === 'numberValue' ? validationStruct['minValue'].kind.value : undefined,
    maxValue: validationStruct['maxValue']?.kind.case === 'numberValue' ? validationStruct['maxValue'].kind.value : undefined,
    maxFileSize: validationStruct['maxFileSize']?.kind.case === 'numberValue' ? validationStruct['maxFileSize'].kind.value : undefined,
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

export function EditFormClient({ id: propId }: { id: string }) {
  const params = useParams()
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)

  // Extract form ID from window.location as the primary source of truth
  // This works with static export where useParams may return build-time values
  const getFormIdFromUrl = (): string => {
    if (typeof window === 'undefined') return propId
    const pathname = window.location.pathname
    // Match pattern: /:locale/forms/:id/edit
    const match = pathname.match(/\/[a-z]{2}\/forms\/([a-f0-9-]+)\/edit/)
    if (match && match[1]) {
      return match[1]
    }
    return propId
  }

  const id = getFormIdFromUrl()

  useEffect(() => {
    async function load() {
      console.log('[EditFormClient] window.location.pathname:', typeof window !== 'undefined' ? window.location.pathname : 'server')
      console.log('[EditFormClient] URL params from useParams:', params)
      console.log('[EditFormClient] Extracted form ID from URL:', id)
      console.log('[EditFormClient] propId was:', propId)
      const token = getToken()
      console.log('[EditFormClient] Token present:', !!token)

      try {
        console.log('[EditFormClient] Calling formClient.getForm()...')
        const response = await formClient.getForm({
          id,
          includeQuestions: true
        })
        console.log('[EditFormClient] GetForm response received:', response)
        console.log('[EditFormClient] Form in response:', response.form)

        if (response.form) {
            console.log('[EditFormClient] Form loaded successfully, mapping to UI format')
            setForm(mapPbFormToDBForm(response.form))
        } else {
            console.error('[EditFormClient] Response.form is null/undefined')
        }
      } catch (error) {
        console.error('[EditFormClient] Failed to load form:', error)
        console.error('[EditFormClient] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        })
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

  return <FormBuilder form={form} />
}
