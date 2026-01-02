'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { formClient } from '@/lib/grpc-client'
import { FormTheme } from '@/lib/proto/proto/form_pb'

export default function NewFormPage() {
  const router = useRouter()
  const creatingRef = useRef(false)

  useEffect(() => {
    async function createForm() {
      if (creatingRef.current) return
      creatingRef.current = true

      try {
        const response = await formClient.createForm({
          title: 'Untitled Form',
          description: '',
          theme: FormTheme.MINIMAL,
          questions: [],
          settings: {},
        })

        if (response.form) {
          router.replace(`/forms/${response.form.id}/edit`)
        } else {
          console.error('No form returned from createForm')
          router.replace('/dashboard')
        }
      } catch (error) {
        console.error('Error creating form:', error)
        router.replace('/dashboard')
      }
    }

    createForm()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
      <p className="text-slate-600">Creating your new form...</p>
    </div>
  )
}