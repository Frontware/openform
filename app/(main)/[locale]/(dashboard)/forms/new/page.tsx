import { routing } from '@/i18n/routing'
import { NewFormClient } from './NewFormClient'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function NewFormPage() {
  return <NewFormClient />
}
