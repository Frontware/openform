import { routing } from '@/i18n/routing'
import { EditFormClient } from './EditFormClient'

export function generateStaticParams() {
  const paths: { locale: string; id: string }[] = []
  routing.locales.forEach((locale) => {
    paths.push({ locale, id: 'id' })
  })
  return paths
}

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditFormClient id={id} />
}
