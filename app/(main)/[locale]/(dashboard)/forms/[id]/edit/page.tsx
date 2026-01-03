import { routing } from '@/i18n/routing'
import { EditFormClient } from './EditFormClient'

// Static export - generate placeholder for build
// The actual form ID will be read from URL by the client component
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: '__dynamic__' }))
}

export default async function EditFormPage() {
  // Just render the client component - it will read the actual ID from URL
  return <EditFormClient />
}
