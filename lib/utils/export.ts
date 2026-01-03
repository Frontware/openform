import { Form, Response, QuestionConfig, Json } from '@/lib/database.types'

interface FileUpload {
  name: string
  type: string
  size?: number
  data?: string  // base64 data URL (fallback)
  url?: string   // R2 URL (preferred)
}

function isFileUpload(answer: Json): boolean {
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) {
    return false
  }
  const obj = answer as Record<string, unknown>
  // Check if it has name and either url or data (file upload signature)
  return (
    'name' in obj &&
    typeof obj.name === 'string' &&
    (('url' in obj && typeof obj.url === 'string') || 
     ('data' in obj && typeof obj.data === 'string'))
  )
}

function asFileUpload(answer: Json): FileUpload {
  return answer as unknown as FileUpload
}

function formatFileUrl(file: FileUpload): string {
  // Prefer URL (R2) over data (base64)
  return file.url || file.data || ''
}

export function exportResponsesToJSON(form: Form, responses: Response[]) {
  const exportData = {
    form_title: form.title,
    form_id: form.id,
    form_slug: form.slug,
    exported_at: new Date().toISOString(),
    total_responses: responses.length,
    responses: responses.map(response => {
      const answers = response.answers as Record<string, Json>
      const questions = (form.questions as QuestionConfig[]) || []
      
      return {
        response_id: response.id,
        submitted_at: response.submitted_at,
        answers: questions.map(question => {
          const answer = answers[question.id]
          
          // Handle file uploads specially
          if (isFileUpload(answer)) {
            const file = asFileUpload(answer)
            return {
              question_id: question.id,
              question_text: question.title || 'Untitled',
              question_type: question.type,
              answer: {
                type: 'file_upload',
                filename: file.name,
                file_type: file.type,
                file_size: file.size,
                url: formatFileUrl(file)
              }
            }
          }
          
          // Handle regular answers
          let formattedAnswer: any = null
          if (answer !== null && answer !== undefined) {
            if (typeof answer === 'boolean') {
              formattedAnswer = answer ? 'Yes' : 'No'
            } else if (Array.isArray(answer)) {
              formattedAnswer = answer.join(', ')
            } else if (typeof answer === 'object') {
              formattedAnswer = JSON.stringify(answer)
            } else {
              formattedAnswer = String(answer)
            }
          }
          
          return {
            question_id: question.id,
            question_text: question.title || 'Untitled',
            question_type: question.type,
            answer: formattedAnswer
          }
        })
      }
    })
  }

  const jsonString = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${form.title.replace(/\s+/g, '_').replace(/[^\w\-_]/g, '')}_responses_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
