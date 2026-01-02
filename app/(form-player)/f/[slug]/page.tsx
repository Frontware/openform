import { FormPlayerWrapper } from '@/components/form-player/form-player-wrapper'

export const dynamic = 'force-dynamic'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return [{ slug: 'form' }]
}

export async function generateMetadata({ params }: FormPageProps) {
  // Metadata generation skipped for migration as it requires server-side fetching via gRPC-Web
  return {
    title: 'Weladee Form',
    description: 'Fill out this form',
  }
}

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params
  return <FormPlayerWrapper slug={slug} />
}