'use client'

import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

export function AuthMessage() {
  const t = useTranslations('authMessage')
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const auth = searchParams.get('auth')
    if (auth === 'required' || auth === 'expired') {
      setVisible(true)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  if (!visible) return null

  return (
    <div className="fixed top-20 left-0 right-0 z-50 flex justify-center px-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium">{t('title')}</p>
          <p className="text-xs mt-1">
            {t.rich('instructions', {
              code: (chunks) => <code>?token=YOUR_JWT</code>
            })}
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="flex-shrink-0 text-amber-600 hover:text-amber-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

