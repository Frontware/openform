import { routing } from '@/i18n/routing'
import { ResponsesClient } from './ResponsesClient'

export function generateStaticParams() {
  const paths: { locale: string; id: string }[] = []
  routing.locales.forEach((locale) => {
    paths.push({ locale, id: 'id' })
  })
  return paths
}

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResponsesClient id={id} />
}
