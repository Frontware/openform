'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { formClient } from '@/lib/grpc-client'
import { FormTheme } from '@/lib/proto/proto/form_pb'
import { getToken } from '@/lib/auth/weladee'

export function NewFormClient({ locale }: { locale: string }) {
  const router = useRouter()
  const creatingRef = useRef(false)

  useEffect(() => {
    async function createForm() {
      if (creatingRef.current) return
      creatingRef.current = true

      console.log('[NewFormClient] Starting form creation...')
      const token = getToken()
      console.log('[NewFormClient] Token for gRPC call:', token ? 'present' : 'MISSING!')
      console.log('[NewFormClient] Token value:', token?.substring(0, 20) + '...')

      try {
        console.log('[NewFormClient] Calling formClient.createForm()...')
        const response = await formClient.createForm({
          title: 'Untitled Form',
          description: '',
          theme: FormTheme.MINIMAL,
          questions: [],
          settings: {},
        })

        console.log('[NewFormClient] CreateForm success!')
        console.log('[NewFormClient] Response:', response)
        console.log('[NewFormClient] Form ID:', response.form?.id)

        if (response.form) {
          console.log('[NewFormClient] Redirecting to edit page...')
          router.replace(`/${locale}/forms/${response.form.id}/edit`)
        } else {
          console.error('[NewFormClient] No form returned from createForm')
          alert('Failed to create form: No form returned from server')
          router.replace(`/${locale}/dashboard`)
        }
      } catch (error) {
        console.error('[NewFormClient] Error creating form:', error)
        console.error('[NewFormClient] Error details:', JSON.stringify(error, null, 2))
        alert(`Error creating form: ${error instanceof Error ? error.message : 'Unknown error'}`)
        router.replace(`/${locale}/dashboard`)
      }
    }

    console.log('[NewFormClient] Component mounted, calling createForm...')
    createForm()
  }, [router, locale])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
      <p className="text-slate-600">Creating your new form...</p>
    </div>
  )
}
