'use client'

import { Suspense } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function ErrorContent() {
  const searchParams = typeof window !== 'undefined' ? 
    new URLSearchParams(window.location.search) : null
  const error = searchParams?.get('error') || null

  const getErrorMessage = (errorType: string | null) => {
    switch (errorType) {
      case 'expired':
        return 'Your authentication token has expired. Please generate a new token.'
      case 'invalid':
        return 'The provided authentication token is invalid.'
      case 'missing':
        return 'No authentication token was provided.'
      case 'server':
        return 'There was an error validating your token. Please try again.'
      default:
        return 'Authentication failed. Please check your token and try again.'
    }
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGenerateNew = () => {
    // Redirect to instructions for generating a new token
    alert('Please run: go run ./cmd/server create-jwt\n\nThen visit the URL with your new token.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {getErrorMessage(error)}
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Token Information
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>To get a valid authentication token:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Stop the current server (Ctrl+C)</li>
                    <li>Run: <code className="bg-red-100 px-1 rounded">go run ./cmd/server create-jwt</code></li>
                    <li>Copy the generated token</li>
                    <li>Start the server again and visit with the token</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button 
              onClick={handleRefresh}
              className="flex-1"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleGenerateNew}
              className="flex-1"
            >
              Generate New Token
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
