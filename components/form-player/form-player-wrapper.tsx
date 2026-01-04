'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { formClient, analyticsClient } from '@/lib/grpc-client'
import { v4 as uuidv4 } from 'uuid'
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
    force_captcha: pbForm.forceCaptcha,
    created_at: pbForm.createdAt?.toDate().toISOString() || '',
    updated_at: pbForm.updatedAt?.toDate().toISOString() || '',
  }
}

export function FormPlayerWrapper({ slug: serverSlug }: { slug: string }) {

  const t = useTranslations('errors')

  const [form, setForm] = useState<Form | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(false)

  const [sessionId] = useState(() => {

    if (typeof window === 'undefined') return ''

    let sid = sessionStorage.getItem('form_session_id')

    if (!sid) {

      sid = uuidv4()

      sessionStorage.setItem('form_session_id', sid)

    }

    return sid

  })



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



          // Track view

          if (typeof window !== 'undefined') {

            analyticsClient.trackView({

              formId: response.form.id,

              sessionId: sessionId,

              userAgent: navigator.userAgent,

              referrer: document.referrer,

              ipAddress: '' // Will be extracted on server

            }).catch(err => console.error('Failed to track view:', err))

          }

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

  }, [serverSlug, sessionId])



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

        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('notFound')}</h1>

        <p className="text-slate-600">{t('generic')}</p>

      </div>

    )

  }



  return <FormPlayer form={form} sessionId={sessionId} />

}
