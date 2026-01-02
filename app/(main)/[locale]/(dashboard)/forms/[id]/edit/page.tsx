import { routing } from '@/i18n/routing'
import { EditFormClient } from './EditFormClient'

// Mock form IDs for static export
const MOCK_FORM_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
]

export function generateStaticParams() {
  const paths: { locale: string; id: string }[] = []
  routing.locales.forEach((locale) => {
    MOCK_FORM_IDS.forEach((id) => {
      paths.push({ locale, id })
    })
  })
  return paths
}

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditFormClient id={id} />
}
