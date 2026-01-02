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

      try {
        console.log('[NewFormClient] Calling formClient.createForm()...')
        const response = await formClient.createForm({
          title: 'Untitled Form',
          description: '',
          theme: FormTheme.MINIMAL,
          questions: [],
          settings: {},
        })

        console.log('[NewFormClient] CreateForm success:', response.form?.id)
        if (response.form) {
          router.replace(`/${locale}/forms/${response.form.id}/edit`)
        } else {
          console.error('[NewFormClient] No form returned from createForm')
          router.replace(`/${locale}/dashboard`)
        }
      } catch (error) {
        console.error('[NewFormClient] Error creating form:', error)
        router.replace(`/${locale}/dashboard`)
      }
    }

    createForm()
  }, [router, locale])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
      <p className="text-slate-600">Creating your new form...</p>
    </div>
  )
}
