'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import { ResponsesDashboard } from '@/components/responses/responses-dashboard'
import { Form, Response, QuestionConfig } from '@/lib/database.types'
import { formClient, responseClient } from '@/lib/grpc-client'
import { Form as PbForm, Question as PbQuestion, QuestionType, FormTheme } from '@/lib/proto/proto/form_pb'
import { Response as PbResponse } from '@/lib/proto/proto/response_pb'
import { Loader2 } from 'lucide-react'
import { ConnectError } from '@bufbuild/connect'

// Reusing mappers
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

function mapPbResponseToDBResponse(pbR: PbResponse): Response {
    const answers: Record<string, any> = {}
    pbR.answers.forEach(a => {
        if (a.answerText !== undefined) answers[a.questionId] = a.answerText
        else if (a.answerNumber !== undefined) answers[a.questionId] = a.answerNumber
    })
    return {
        id: pbR.id,
        form_id: pbR.formId,
        answers: answers,
        submitted_at: pbR.submittedAt?.toDate().toISOString() || pbR.createdAt?.toDate().toISOString() || '',
    }
}

export function ResponsesClient() {
  const params = useParams()
  const [form, setForm] = useState<Form | null>(null)
  const [responses, setResponses] = useState<Response[]>([])
  const [loading, setLoading] = useState(true)

  // Extract form ID from window.location as the primary source of truth
  // This works with static export where useParams may return build-time values
  const getFormIdFromUrl = (): string => {
    if (typeof window === 'undefined') return (params.id as string) || ''
    const pathname = window.location.pathname
    // Match pattern: /:locale/forms/:id/responses
    const match = pathname.match(/\/[a-z]{2}\/forms\/([a-f0-9-]+)\/responses/)
    if (match && match[1]) {
      return match[1]
    }
    return (params.id as string) || ''
  }

  const id = getFormIdFromUrl()

  useEffect(() => {
    // Don't fetch if ID is the placeholder or empty
    if (!id || id === '__dynamic__' || id === '00000000-0000-0000-0000-000000000001') {
      setLoading(false)
      return
    }

    async function load() {
      try {
        const formRes = await formClient.getForm({ id, includeQuestions: true })

        if (formRes.form) {
            setForm(mapPbFormToDBForm(formRes.form))
            const respRes = await responseClient.listResponses({ formId: id, pagination: { page: 1, pageSize: 100 } })
            setResponses(respRes.responses.map(mapPbResponseToDBResponse))
        } else {
            notFound()
        }
      } catch (error) {
        console.error('[ResponsesClient] Failed to load responses:', error)
        // Check if it's a NotFound error using ConnectError code
        if (error instanceof ConnectError) {
          // Code 5 = NotFound in gRPC
          if (error.code === 5 || error.message.includes('NotFound') || error.message.includes('not found')) {
            notFound()
          }
        } else if (error instanceof Error && (error.message.includes('NotFound') || error.message.includes('not found'))) {
          notFound()
        }
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

  if (!form) notFound()

  return (
    <ResponsesDashboard 
      form={form} 
      responses={responses} 
    />
  )
}
