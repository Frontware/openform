import { routing } from '@/i18n/routing'
import { ResponsesClient } from './ResponsesClient'

// Static export - generate placeholder for build
// The actual form ID will be read from URL by the client component
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: '__dynamic__' }))
}

export default async function ResponsesPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  // Just render the client component - it will read the actual ID from URL
  return <ResponsesClient />
}
