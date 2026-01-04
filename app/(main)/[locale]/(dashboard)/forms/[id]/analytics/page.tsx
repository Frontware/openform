import { routing } from '@/i18n/routing'
import AnalyticsClient from './AnalyticsClient'
import { setRequestLocale } from 'next-intl/server'

// Static export - generate placeholder for build
// The actual form ID will be read from URL by the client component
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: '__dynamic__' }))
}

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AnalyticsClient />
}