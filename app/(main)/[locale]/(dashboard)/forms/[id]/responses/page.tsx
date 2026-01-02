import { routing } from '@/i18n/routing'
import { ResponsesClient } from './ResponsesClient'

// No static generation for form IDs - Go server handles dynamic routes via template fallback
// But we still need to generate static params for locales
export function generateStaticParams() {
  // Return empty array for form IDs - Go server handles all dynamic form IDs
  return routing.locales.map((locale) => ({ locale, id: '00000000-0000-0000-0000-000000000001' }))
}

export default async function ResponsesPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  return <ResponsesClient id={id} />
}
