import { routing } from '@/i18n/routing'
import { EditFormClient } from './EditFormClient'

// No static generation for form IDs - Go server handles dynamic routes via template fallback
// But we still need to generate static params for locales
export function generateStaticParams() {
  // Return empty array for form IDs - Go server handles all dynamic form IDs
  return routing.locales.map((locale) => ({ locale, id: '00000000-0000-0000-0000-000000000001' }))
}

export default async function EditFormPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  return <EditFormClient id={id} />
}
